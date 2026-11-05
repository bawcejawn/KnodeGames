<#
  Knode Games "Run a node" - self-heal for ONE Koinos node (https://knodegames.com/run-node.html, step 8).

  Every 20 minutes (a Windows scheduled task) it compares your node's block height with the Koinos network.
  The rules are the same ones Knode Games uses for its own nodes (bot/heal.mjs):
    - FROZEN: more than 200 blocks (~10 minutes) behind and not moving since the last check, or no answer at two
      checks in a row, or the node isn't running at all -> full restart (docker compose down, then up -d);
    - behind but moving -> catching up, left alone;
    - after a restart it waits at least 50 minutes before restarting again, and after 3 restarts in 6 hours it stops
      trying and tells you to look by hand (a restart can't fix everything);
    - CRASH LOOP: the block store or chain restarted 3+ times since the last check -> no restart (that doesn't cure
      damaged data); it tells you to "Repair from a fresh snapshot" (step 8 of the guide).
  It never deletes anything, never touches the node's key, and sends nothing anywhere except two read-only questions:
  "what's your height?" to your own node and to a public Koinos node. It tells you through a Windows notification
  and its log, C:\koinos-node\heal.log.

  Set it up (once), from PowerShell:
      powershell -ExecutionPolicy Bypass -File C:\koinos-node\heal-one-node.ps1 -DryRun     (shows what it would do)
      powershell -ExecutionPolicy Bypass -File C:\koinos-node\heal-one-node.ps1 -Install    (every 20 minutes)
  Remove it:
      powershell -ExecutionPolicy Bypass -File C:\koinos-node\heal-one-node.ps1 -Uninstall
#>
param(
  [switch]$Install,
  [switch]$Uninstall,
  [switch]$DryRun,
  [string]$Folder = "C:\koinos-node",
  [string]$Rpc = "http://127.0.0.1:8080"
)
$ErrorActionPreference = "Stop"
$TaskName = "Koinos node self-heal"
$Network = @("https://koinos.armana.io", "https://api.koinosblocks.com")
if ($env:KG_HEAL_NETWORK) { $Network = $env:KG_HEAL_NETWORK -split "," }   # tests only
$Docker = if ($env:KG_HEAL_DOCKER) { $env:KG_HEAL_DOCKER } else { "docker" }  # tests only
$Koinos = Join-Path $Folder "koinos"
$LogFile = Join-Path $Folder "heal.log"
$StateFile = Join-Path $Folder "heal-state.json"
$MAX_BEHIND = 200
$COOLDOWN_MS = 50 * 60000
$MAX_HEALS = 3
$WINDOW_MS = 6 * 3600000
$NAG_MS = 3 * 3600000
$LOOP_RESTARTS = 3

function NowMs { if ($env:KG_HEAL_NOW) { return [int64]$env:KG_HEAL_NOW } return [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
function Log($m) {
  $line = "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm"), $m
  Write-Host $line
  if (-not $DryRun) {
    Add-Content -Path $LogFile -Value $line -Encoding ascii
    try { $all = @(Get-Content $LogFile); if ($all.Count -gt 3000) { Set-Content -Path $LogFile -Value $all[-2000..-1] -Encoding ascii } } catch { }
  }
}
function Notify($title, $text) {
  Log "NOTICE: $title - $text"
  if ($DryRun) { return }
  try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
    $t = $xml.GetElementsByTagName("text")
    [void]$t.Item(0).AppendChild($xml.CreateTextNode($title))
    [void]$t.Item(1).AppendChild($xml.CreateTextNode($text))
    $app = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
  } catch { }   # no notifications on this system: the log still has it
}

# ---------- install / uninstall ----------
if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "OK  '$TaskName' removed. Your node keeps running; nothing else was changed." -ForegroundColor Green
  return
}
if ($Install) {
  $self = $PSCommandPath
  if (-not (Test-Path (Join-Path $Koinos "docker-compose.yml"))) { throw "No node found in $Koinos. Do steps 3-5 of the guide first, or pass -Folder <your folder>." }
  $psArgs = '-NoProfile -ExecutionPolicy Bypass -File "{0}" -Folder "{1}" -Rpc "{2}"' -f $self, $Folder, $Rpc
  $conhost = Join-Path $env:SystemRoot "System32\conhost.exe"
  if ([Environment]::OSVersion.Version.Build -ge 17763 -and (Test-Path $conhost)) {
    # "conhost --headless" runs it with no window at all (a hidden PowerShell window still flashes for a moment).
    $action = New-ScheduledTaskAction -Execute $conhost -Argument ('--headless powershell.exe ' + $psArgs) -WorkingDirectory $Folder
  } else {
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ('-WindowStyle Hidden ' + $psArgs) -WorkingDirectory $Folder
  }
  $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 20) -RepetitionDuration (New-TimeSpan -Days 3650)
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Every 20 minutes: restart the Koinos node in $Koinos if it has frozen. Log: $LogFile" -Force | Out-Null
  Write-Host ""
  Write-Host "OK  '$TaskName' is set up: it checks your node every 20 minutes, starting in 1 minute." -ForegroundColor Green
  Write-Host "    Its log:   notepad $LogFile"
  Write-Host "    Remove it: powershell -ExecutionPolicy Bypass -File `"$self`" -Uninstall"
  return
}

# ---------- helpers ----------
function Height($url, $timeoutSec) {
  $body = '{"jsonrpc":"2.0","id":1,"method":"chain.get_head_info","params":{}}'
  $r = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -TimeoutSec $timeoutSec
  $h = [int64]$r.result.head_topology.height
  if ($h -le 0) { throw "no height in the answer" }
  return $h
}
function NetworkHeight {
  $tries = @($Network[0]) + @($Network)
  $errors = @()
  foreach ($u in $tries) {
    try { return Height $u 15 } catch { $errors += ("{0}: {1}" -f $u, $_.Exception.Message) }
  }
  throw ($errors -join "; ")
}
function DockerOut([string[]]$a) {
  $ErrorActionPreference = "Continue"
  $out = & $Docker @a 2>$null
  if ($LASTEXITCODE -ne 0) { throw "docker $($a -join ' ') failed" }
  return @($out | ForEach-Object { "$_" })
}
function Compose([string[]]$a) {
  Push-Location $Koinos
  try { return DockerOut (@("compose") + $a) } finally { Pop-Location }
}
function ReadState {
  $s = @{ lastHeight = 0; misses = 0; heals = @(); lastRestart = 0; nagAt = 0; dockerAlert = 0; restarts = @{} }
  if (Test-Path $StateFile) {
    try {
      $j = Get-Content $StateFile -Raw | ConvertFrom-Json
      foreach ($k in @("lastHeight", "misses", "lastRestart", "nagAt", "dockerAlert")) { if ($null -ne $j.$k) { $s[$k] = [int64]$j.$k } }
      if ($j.heals) { $s.heals = @($j.heals | ForEach-Object { [int64]$_ }) }
      if ($j.restarts) { foreach ($p in $j.restarts.PSObject.Properties) { $s.restarts[$p.Name] = [int64]$p.Value } }
    } catch { Log "The state file was unreadable; starting fresh." }
  }
  return $s
}
function WriteState($s) { if (-not $DryRun) { $s | ConvertTo-Json -Depth 4 | Set-Content -Path $StateFile -Encoding ascii } }

# ---------- one check ----------
if (-not (Test-Path (Join-Path $Koinos "docker-compose.yml"))) { Log "No node found in $Koinos - nothing to check."; return }
$now = NowMs
$st = ReadState
$st.heals = @($st.heals | Where-Object { $now - $_ -lt $WINDOW_MS })
if ($DryRun) { Log "(dry run: nothing is restarted, written or notified)" }

try { $net = NetworkHeight }
catch { Log "Can't reach the Koinos network ($($_.Exception.Message)). Is the internet down? Skipping this check."; return }

try { $null = DockerOut @("info", "--format", "{{.ServerVersion}}") }
catch {
  Log "Docker isn't running, so the node is stopped."
  if ($now - $st.dockerAlert -gt $NAG_MS) { Notify "Koinos node: Docker isn't running" "Open Docker Desktop. Your node starts again with it."; $st.dockerAlert = $now }
  WriteState $st
  return
}
$st.dockerAlert = 0

# Crash loop: the block store or chain keeps restarting (Docker restarts them by itself; a restart can't cure bad data).
$loop = @()
foreach ($svc in @("block_store", "chain")) {
  try {
    $id = (Compose @("ps", "-q", $svc) | Select-Object -First 1)
    if (-not $id) { continue }
    $n = [int64]((DockerOut @("inspect", "-f", "{{.RestartCount}}", $id.Trim())) | Select-Object -First 1)
    $key = "$svc|$($id.Trim())"
    if ($st.restarts.ContainsKey($key) -and ($n - $st.restarts[$key]) -ge $LOOP_RESTARTS) { $loop += "$svc restarted $($n - $st.restarts[$key]) times since the last check" }
    foreach ($old in @($st.restarts.Keys | Where-Object { $_ -like "$svc|*" -and $_ -ne $key })) { $st.restarts.Remove($old) }
    $st.restarts[$key] = $n
  } catch { }
}
if ($loop.Count) {
  Log ("CRASH LOOP: " + ($loop -join "; ") + ". Not restarting: that doesn't fix damaged data.")
  if ($now - $st.nagAt -gt $NAG_MS) {
    Notify "Koinos node needs a repair" "It keeps crashing. Follow 'Repair from a fresh snapshot' in step 8 of knodegames.com/run-node.html."
    $st.nagAt = $now
  }
  WriteState $st
  return
}

# Is it running, answering, and keeping up?
$running = @()
try { $running = @(Compose @("ps", "-q") | Where-Object { $_ }) } catch { }
$local = $null
$why = ""
if (-not $running.Count) { $why = "the node isn't running" }
else {
  try { $local = Height $Rpc 10; $st.misses = 0 }
  catch { $st.misses = $st.misses + 1; if ($st.misses -ge 2) { $why = "it hasn't answered at two checks in a row" } else { Log "The node didn't answer this time ($($_.Exception.Message)); checking again next time." } }
}
if ($null -ne $local) {
  $behind = $net - $local
  if ($behind -gt $MAX_BEHIND -and $local -le $st.lastHeight) { $why = "it is $behind blocks behind and hasn't moved since the last check" }
  elseif ($behind -gt $MAX_BEHIND) { Log "Catching up: $behind blocks behind (height $local, network $net)." }
  else { Log "OK: height $local, network $net ($behind behind)." }
  $st.lastHeight = $local
}

if ($why) {
  if ($st.heals.Count -ge $MAX_HEALS) {
    Log "FROZEN ($why), but it was already restarted $($st.heals.Count) times in 6 hours. Not trying again."
    if ($now - $st.nagAt -gt $NAG_MS) {
      Notify "Koinos node needs you" "Restarts haven't fixed it. See 'If it keeps crashing' in step 8 of knodegames.com/run-node.html."
      $st.nagAt = $now
    }
  } elseif ($st.lastRestart -and ($now - $st.lastRestart) -lt $COOLDOWN_MS) {
    Log "FROZEN ($why), but it was restarted less than 50 minutes ago. Giving it time."
  } elseif ($DryRun) {
    Log "FROZEN ($why): would restart it now (docker compose down, then up -d)."
  } else {
    Log "FROZEN ($why): restarting it."
    try {
      $null = Compose @("down")
      $null = Compose @("up", "-d")
      $st.heals = @($st.heals) + @($now)
      $st.lastRestart = $now
      $st.misses = 0
      Notify "Koinos node restarted" "It had frozen ($why). Check it again in 30 minutes."
    } catch { Notify "Koinos node: restart failed" "$($_.Exception.Message). Open Docker Desktop and see step 8 of knodegames.com/run-node.html." }
  }
}
WriteState $st
