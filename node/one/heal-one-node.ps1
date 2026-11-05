<#
  Knode Games "Run a node" - self-heal for ONE Koinos node (https://knodegames.com/run-node.html, step 8).

  Every 20 minutes (a Windows scheduled task) it compares your node's block height with the Koinos network.
  The rules are the same ones Knode Games uses for its own nodes (bot/heal.mjs):
    - FROZEN: more than 200 blocks (~10 minutes) behind and not moving since the last check, or no answer at two
      checks in a row, or its containers exist but none is running at two checks in a row -> full restart
      (docker compose down, then up -d);
    - behind but moving -> catching up, left alone;
    - STOPPED ON PURPOSE: no containers at all (someone ran "docker compose down" to repair, update or stop) -> it never
      starts the node; it reminds you every 3 hours that the node is stopped. A file named heal-paused in the folder
      pauses it completely (the guide's repair, stop and update boxes create it; starting the node removes it);
    - after a restart (even one that failed) it waits at least 50 minutes before trying again, and after 3 tries in
      6 hours it stops and tells you to look by hand (a restart can't fix everything);
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
  if ($Rpc -match '["\r\n]') { throw "-Rpc can't contain a double quote or a line break." }
  $Folder = (Resolve-Path -LiteralPath $Folder -ErrorAction Stop).Path.TrimEnd('\')
  $Koinos = Join-Path $Folder "koinos"
  $LogFile = Join-Path $Folder "heal.log"
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
  $s = @{ lastHeight = 0; misses = 0; heals = @(); lastRestart = 0; nagAt = 0; dockerAlert = 0; failAt = 0; stopAt = 0; healDownAt = 0; restarts = @{} }
  if (Test-Path $StateFile) {
    try {
      $j = Get-Content $StateFile -Raw | ConvertFrom-Json
      foreach ($k in @("lastHeight", "misses", "lastRestart", "nagAt", "dockerAlert", "failAt", "stopAt", "healDownAt")) { if ($null -ne $j.$k) { $s[$k] = [int64]$j.$k } }
      if ($j.heals) { $s.heals = @($j.heals | ForEach-Object { [int64]$_ }) }
      if ($j.restarts) { foreach ($p in $j.restarts.PSObject.Properties) { $s.restarts[$p.Name] = [int64]$p.Value } }
    } catch { Log "The state file was unreadable; starting fresh." }
  }
  # A time later than now (the clock was fast and was corrected) would block restarts until it caught up: drop it.
  $n = NowMs
  $s.heals = @($s.heals | Where-Object { $_ -le $n })
  foreach ($k in @("lastRestart", "nagAt", "dockerAlert", "failAt", "stopAt", "healDownAt")) { if ($s[$k] -gt $n) { $s[$k] = 0 } }
  return $s
}
function WriteState($s) { if (-not $DryRun) { $s | ConvertTo-Json -Depth 4 | Set-Content -Path $StateFile -Encoding ascii } }

# ---------- one check ----------
if (-not (Test-Path (Join-Path $Koinos "docker-compose.yml"))) { Log "No node found in $Koinos - nothing to check."; return }
# The pause file (made by the guide's repair, stop and update boxes) only counts while none of the node's containers is
# running: once the node runs again, a forgotten pause file can't switch the self-heal off.
if (Test-Path (Join-Path $Folder "heal-paused")) {
  $up = @(); $known = $true
  try { $up = @(Compose @("ps", "-q") | Where-Object { $_ }) } catch { $known = $false }
  if (-not $known -or -not $up.Count) { Log "Paused (heal-paused is in $Folder and the node isn't running): not checking."; return }
  Log "heal-paused is in $Folder, but the node is running again, so checking as usual."
}
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
$all = @(); $running = @()
try { $all = @(Compose @("ps", "-a", "-q") | Where-Object { $_ }); $running = @(Compose @("ps", "-q") | Where-Object { $_ }) }
catch { Log "Couldn't list the node's containers this time; checking again next time."; WriteState $st; return }
$local = $null
$why = ""
if (-not $all.Count -and $st.healDownAt) {
  # No containers because the self-heal's OWN restart ran "docker compose down" and its "up" didn't finish: try again
  # (within the same 50-minute wait and 3-in-6-hours limit below). This is not a stop on purpose.
  $why = "the self-heal's own restart didn't finish (no containers since it stopped the node)"
}
elseif (-not $all.Count) {
  # No containers at all: someone ran "docker compose down" (a repair, an update, or a stop). Never start it.
  Log "The node is stopped (no containers: stopped on purpose). Not starting it."
  if ($now - $st.stopAt -gt $NAG_MS) { Notify "Koinos node is stopped" "Start it with step 5a of knodegames.com/run-node.html when you're ready."; $st.stopAt = $now }
  $st.misses = 0
  WriteState $st
  return
}
else { $st.stopAt = 0; $st.healDownAt = 0 }
if ($why) { }
elseif (-not $running.Count) {
  $st.misses = $st.misses + 1
  if ($st.misses -ge 2) { $why = "its containers exist but none has been running at two checks in a row" } else { Log "None of the node's containers is running; checking again next time." }
}
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
      Notify "Koinos node needs you" "Restarts haven't fixed it. See 'What can go wrong' on knodegames.com/run-node.html, and heal.log."
      $st.nagAt = $now
    }
  } elseif ($st.lastRestart -and ($now - $st.lastRestart) -lt $COOLDOWN_MS) {
    Log "FROZEN ($why), but it was restarted less than 50 minutes ago. Giving it time."
  } elseif ($DryRun) {
    Log "FROZEN ($why): would restart it now (docker compose down, then up -d)."
  } else {
    Log "FROZEN ($why): restarting it."
    # Counted before trying, so a restart that fails still waits 50 minutes and counts toward the 3-in-6-hours limit.
    $st.heals = @($st.heals) + @($now)
    $st.lastRestart = $now
    $st.healDownAt = $now
    $st.misses = 0
    WriteState $st
    try {
      $null = Compose @("down")
      $null = Compose @("up", "-d")
      $st.healDownAt = 0
      Notify "Koinos node restarted" "It had frozen ($why). Check it again in 30 minutes."
    } catch {
      Log "The restart failed: $($_.Exception.Message)"
      if ($now - $st.failAt -gt $NAG_MS) { Notify "Koinos node: restart failed" "Open Docker Desktop, then see 'What can go wrong' on knodegames.com/run-node.html."; $st.failAt = $now }
    }
  }
}
WriteState $st
