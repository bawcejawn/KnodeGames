<#
  Knode Games - the live-file uploader (Capacity step A4b; docs/capacity/OWNER-STEPS.md).

  Run once in PowerShell from C:\kprediction:
      powershell -ExecutionPolicy Bypass -File node\install-live-uploader.ps1

  What it runs: node tools\capacity-live\uploader.mjs (see that file). Windows starts it every minute, all day; each run
  reads YOUR node on this PC every 5 seconds for 55 seconds and, when there is a new block, sends the small "latest
  blocks" file to the Knode Games Cloudflare Worker. Players' pages read that file instead of asking a public node.
  Nothing connects in to this PC. If this PC is off, pages simply go back to asking the public node.
  Needs in .env: LIVE_RPC (your node's address on this PC) and LIVE_TOKEN (the Worker secret). It reads no other line.
  Log:               notepad C:\kprediction\node\live-uploader.log
  Check the task:    Get-ScheduledTask -TaskName "Knode live uploader" | Get-ScheduledTaskInfo
  Pause it:          Disable-ScheduledTask -TaskName "Knode live uploader"
  Remove it again:   Unregister-ScheduledTask -TaskName "Knode live uploader" -Confirm:$false
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root "tools\capacity-live\uploader.mjs"
if (-not (Test-Path $script)) { throw "tools\capacity-live\uploader.mjs not found. Run 'git pull' in $root first." }
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { throw "Node.js isn't on the PATH. Open a new PowerShell window and try again." }
$node = $nodeCmd.Source
$envFile = Join-Path $root ".env"
foreach ($k in @("LIVE_RPC", "LIVE_TOKEN")) {
  if (-not ((Test-Path $envFile) -and (Select-String -Path $envFile -Pattern "^\s*$k\s*=\s*\S" -Quiet))) {
    throw "$k isn't in $envFile yet. Follow step A4a in docs\capacity\OWNER-STEPS.md first."
  }
}

# First a dry run: read the node once and print the file (sends nothing). Stops here if the node can't be read.
& $node $script --dry | Out-Null
if ($LASTEXITCODE -ne 0) { throw "The dry run couldn't read your node at LIVE_RPC. Check the address in .env and that the node is running." }

# Runs node with no window at all ("conhost --headless"); older Windows: hidden PowerShell.
$conhost = Join-Path $env:SystemRoot "System32\conhost.exe"
if ([Environment]::OSVersion.Version.Build -ge 17763 -and (Test-Path $conhost)) {
  $action = New-ScheduledTaskAction -Execute $conhost -Argument ('--headless "{0}" "{1}"' -f $node, $script) -WorkingDirectory $root
} else {
  $arg = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "& ''{0}'' ''{1}''"' -f $node, $script
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg -WorkingDirectory $root
}
$day = [DateTime]::UtcNow.ToString("yyyy-MM-dd")
$t = New-ScheduledTaskTrigger -Daily -At ([DateTime]::Today)
$t.Repetition = (New-ScheduledTaskTrigger -Once -At ([DateTime]::Today) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Hours 23 -Minutes 59)).Repetition
$t.StartBoundary = "${day}T00:00:00Z"
$boot = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "Knode live uploader" -Action $action -Trigger @($t, $boot) -Settings $settings -Description "Every minute: read this PC's Koinos node and send the small latest-blocks file to the Knode Games Cloudflare Worker (players' pages read it instead of a public node). See C:\kprediction\tools\capacity-live\uploader.mjs" -Force | Out-Null

Write-Host ""
Write-Host "OK  'Knode live uploader' is set up: every minute, all day, and at log-on." -ForegroundColor Green
Write-Host "    Log:          notepad $root\node\live-uploader.log   (look for 'ok: sent ...' lines)"
Write-Host "    Check online: (Invoke-WebRequest https://live.knodegames.com/live.json -UseBasicParsing).Content"
