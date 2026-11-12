<#
  Knode - make sure the daily questions come out on time (Windows Task Scheduler, every 5 minutes): the 12:00 UTC
  round, and from the week of Mon 9 Nov also the 00:00 UTC round (D-092).

  Run once in PowerShell from C:\kprediction:
      powershell -ExecutionPolicy Bypass -File node\install-release-kick.ps1

  What it runs: node bot\release-kick.mjs (see that file). Windows starts it every 5 minutes, all day (UTC, so daylight
  saving time doesn't shift it). Around each round's release it makes sure the questions come out; at any hour, every
  15 minutes, the heartbeat starts the bot if it hasn't run for 120 minutes (at most 6 times a day, backing off after a
  GitHub error). Most runs do nothing and write nothing.
  Already set up before? Run it again after 'git pull': it replaces the task (all day now, owner 9 Nov).
  Its log is node\release-kick.log. It uses GITHUB_ALERT_TOKEN from .env (the self-heal email token).
  Check the task:    Get-ScheduledTask -TaskName "Knode question release" | Get-ScheduledTaskInfo
  Remove it again:   Unregister-ScheduledTask -TaskName "Knode question release" -Confirm:$false
#>
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$script = Join-Path $root "bot\release-kick.mjs"
if (-not (Test-Path $script)) { throw "bot\release-kick.mjs not found. Run 'git pull' in $root first." }
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { throw "Node.js isn't on the PATH. Open a new PowerShell window and try again." }
$node = $nodeCmd.Source
$envFile = Join-Path $root ".env"
if (-not ((Test-Path $envFile) -and (Select-String -Path $envFile -Pattern '^\s*GITHUB_ALERT_TOKEN\s*=\s*\S' -Quiet))) {
  throw "GITHUB_ALERT_TOKEN isn't in $envFile. It's the same token the self-heal emails use."
}

# Runs node with no window at all: "conhost --headless" gives it a console that is never shown (a hidden PowerShell
# window still flashes on screen for a moment). Windows older than 10 version 1809 has no --headless: hidden PowerShell.
$conhost = Join-Path $env:SystemRoot "System32\conhost.exe"
if ([Environment]::OSVersion.Version.Build -ge 17763 -and (Test-Path $conhost)) {
  $action = New-ScheduledTaskAction -Execute $conhost -Argument ('--headless "{0}" "{1}"' -f $node, $script) -WorkingDirectory $root
} else {
  $arg = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "& ''{0}'' ''{1}''"' -f $node, $script
  $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg -WorkingDirectory $root
}
# Daily from 00:00 UTC, every 5 minutes for a whole day. The start time is stored in UTC ("...Z", Task Scheduler's
# "synchronize across time zones"), so daylight saving time never moves it. The script itself works in UTC only.
$day = [DateTime]::UtcNow.ToString("yyyy-MM-dd")   # a past start is fine: it repeats every day from then
$t = New-ScheduledTaskTrigger -Daily -At ([DateTime]::Today)
$t.Repetition = (New-ScheduledTaskTrigger -Once -At ([DateTime]::Today) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Hours 23 -Minutes 59)).Repetition
$t.StartBoundary = "${day}T00:00:00Z"
$triggers = @($t)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "Knode question release" -Action $action -Trigger $triggers -Settings $settings -Description "Every 5 minutes, all day: start the Knode bot on GitHub so each round's questions come out on time, start it if it hasn't run for 120 minutes (at most 6 a day), and email if they don't. See C:\kprediction\bot\release-kick.mjs" -Force | Out-Null

Write-Host ""
$info = ((Get-ScheduledTask -TaskName "Knode question release").Triggers | ForEach-Object { $_.StartBoundary }) -join ", "
Write-Host "OK  'Knode question release' is set up: every 5 minutes, all day (stored as $info)." -ForegroundColor Green
Write-Host "    Log:          notepad $root\node\release-kick.log"
Write-Host "    Try it now:   node bot\release-kick.mjs --at 2026-10-29T11:52:00Z --dry-run"
