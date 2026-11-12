<#
  Knode - back up each node's block-producer key (R-VAULT-10, owner OK 4 Nov).

  With a backup, a replacement PC can produce at once with the same key (node\setup-node.ps1 -RestoreKey): the Desk
  then avoids its 48-hour key wait, and the pool needs no re-registering.

  Run in PowerShell from C:\kprediction, with the USB stick plugged in (E: here; use its letter):
      powershell -ExecutionPolicy Bypass -File node\backup-producer-keys.ps1 -To E:\
  It writes E:\knode-producer-keys-<date>\game\private.key, ...\desk\private.key and ...\personal\private.key (from
  the node's folder, or from its Docker volume after node\move-node-to-volume.ps1), checks each copy is identical to
  the original, then prints ONLY each node's PUBLIC key and checks it against the key registered on chain.

  It never prints, uploads or sends a private key. It refuses to write into C:\kprediction (the repository), into a
  node's own folder, through a link or junction, or into a cloud-synced folder (OneDrive); a drive that isn't removable
  needs a typed YES. No image code ever runs with the key mounted, and the helper container has no network.

  !! Never run two nodes with the same key at the same time (the old node must be off for good first). Keep the stick
     offline (a drawer, not a cloud folder), and never put a key file in a chat, an email or the repository.
#>
param(
  [Parameter(Mandatory = $true)][string]$To
)
$ErrorActionPreference = "Stop"
$Roots = @{ game = "C:\kpred-node"; desk = "C:\kpred-desk-node"; personal = "C:\koinos-personal" }
if ($env:KNODE_TEST_ROOTS) { $Roots = @{}; ($env:KNODE_TEST_ROOTS | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $Roots[$_.Name] = $_.Value } }   # tests only
$Repo = Split-Path $PSScriptRoot -Parent
$Alpine = "alpine:3.20@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc"   # the same pinned image as the Node chat's scripts (Repo Lens #F-8 F8-9)
$stamp = Get-Date -Format "yyyyMMdd-HHmm"

function Say($m) { Write-Host $m }
function Ok($m) { Write-Host "OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "!!  $m" -ForegroundColor Yellow }
function Full($p) { return [IO.Path]::GetFullPath($p).TrimEnd('\', '/') }
function Inside($p, $root) { $a = (Full $p) + [IO.Path]::DirectorySeparatorChar; $b = (Full $root) + [IO.Path]::DirectorySeparatorChar; return $a.StartsWith($b, [StringComparison]::OrdinalIgnoreCase) }
function DockerExit([string[]]$a) { $ErrorActionPreference = "Continue"; $null = & docker @a 2>&1; return $LASTEXITCODE }
# The node's Docker volume (written by node\move-node-to-volume.ps1 into docker-compose.override.yml), or $null.
function VolumeOf($dir) {
  $o = Join-Path (Join-Path $dir "koinos") "docker-compose.override.yml"
  if (-not (Test-Path $o)) { return $null }
  $m = Select-String -Path $o -Pattern "^#\s*knode-volume:\s*(\S+)" | Select-Object -First 1
  if ($m) { return $m.Matches[0].Groups[1].Value } else { return $null }
}
function Sha($file) { return (Get-FileHash -Algorithm SHA256 -Path $file).Hash.ToLowerInvariant() }
# Repo Lens #F-8 F8-6: a junction or symlink anywhere on the path could point into the repository or a node folder, and
# Inside() compares the path as written. Refuse any link on the way instead of guessing where it leads.
function LinkOnPath($p) {
  $cur = Full $p
  while ($cur) {
    $i = Get-Item -LiteralPath $cur -Force -ErrorAction SilentlyContinue
    if ($i -and $i.LinkType) { return "$cur ($($i.LinkType) to $($i.Target))" }
    $parent = Split-Path $cur -Parent
    if (-not $parent -or $parent -eq $cur) { break }
    $cur = $parent
  }
  return $null
}

# ---------- 1. where to ----------
if (-not (Test-Path $To)) { throw "Not found: $To. Plug in the USB stick and give its folder (e.g. -To E:\). Nothing was written." }
if (Inside $To $Repo) { throw "Refusing to write keys inside the repository ($Repo): they could end up on GitHub. Use the USB stick. Nothing was written." }
foreach ($r in $Roots.Values) { if ((Test-Path $r) -and (Inside $To $r)) { throw "Refusing to write into a node's own folder ($r). Use the USB stick. Nothing was written." } }
$link = LinkOnPath $To
if ($link) { throw "Refusing: the destination goes through a link or junction ($link). Give the USB stick's own folder (e.g. -To E:\). Nothing was written." }
foreach ($cloud in @($env:OneDrive, $env:OneDriveConsumer, $env:OneDriveCommercial)) {
  if ($cloud -and (Inside $To $cloud)) { throw "Refusing to write keys into a cloud-synced folder ($cloud): they would be uploaded. Use the USB stick. Nothing was written." }
}
$letter = try { (Split-Path -Qualifier (Full $To)).TrimEnd(':') } catch { "" }   # a network path has no drive letter
$volInfo = if ($letter) { Get-Volume -DriveLetter $letter -ErrorAction SilentlyContinue } else { $null }
if (-not $volInfo -or $volInfo.DriveType -ne "Removable") {
  Warn "$To is not on a removable drive (a USB stick). A key backup belongs offline, not on a disk that stays in this PC or syncs anywhere."
  $answer = Read-Host "Type YES to write the backup there anyway"
  if ($answer -cne "YES") { throw "Not confirmed. Nothing was written." }
}
$Dest = Join-Path $To "knode-producer-keys-$stamp"
if (Test-Path $Dest) { throw "$Dest already exists. Wait a minute and run again. Nothing was written." }
New-Item -ItemType Directory -Path $Dest | Out-Null
Ok "backup folder $Dest"

# ---------- 2. copy each node's key ----------
$copied = 0
foreach ($node in @("game", "desk", "personal")) {
  $dir = $Roots[$node]
  if (-not $dir -or -not (Test-Path $dir)) { Warn "$node node: no folder at $dir on this PC; skipped"; continue }
  $out = Join-Path $Dest $node
  New-Item -ItemType Directory -Path $out | Out-Null
  $target = Join-Path $out "private.key"
  $vol = VolumeOf $dir
  if ($vol) {
    # The key is inside the node's Docker volume: copy it out through a stopped helper container (docker cp writes
    # straight to the Windows path, so the USB stick never has to be shared with Docker).
    if ((DockerExit @("info", "--format", "{{.ServerVersion}}")) -ne 0) { throw "Docker isn't running, and the $node node keeps its key in the volume $vol. Open Docker Desktop and run again." }
    $ErrorActionPreference = "Continue"
    # The helper is created, never started: no image code runs with the key mounted (Repo Lens #F-8 F8-9), and it has no
    # network. The copy is checked by a second, independent read of the same file.
    $id = (& docker create --network none -v "${vol}:/from:ro" $Alpine true 2>$null | Select-Object -Last 1)
    $ErrorActionPreference = "Stop"
    if (-not $id) { throw "Couldn't create the helper container for the volume $vol (internet for the $Alpine image?)." }
    $second = $null
    try {
      $ErrorActionPreference = "Continue"
      & docker cp "${id}:/from/block_producer/private.key" $target 2>$null | Out-Null
      $code = $LASTEXITCODE
      $second = Join-Path $out "check.key"
      & docker cp "${id}:/from/block_producer/private.key" $second 2>$null | Out-Null
      $code2 = $LASTEXITCODE
      $ErrorActionPreference = "Stop"
      if ($code -ne 0 -or -not (Test-Path $target)) { throw "Couldn't copy the $node node's key out of the volume $vol." }
      $same = ($code2 -eq 0) -and (Test-Path $second) -and ((Sha $second) -eq (Sha $target))
      if (Test-Path $second) { Remove-Item -LiteralPath $second -Force }
      if (-not $same) { throw "The copy of the $node node's key isn't identical to a second read of the one in the volume. Run again." }
    } finally {
      $ErrorActionPreference = "Continue"
      if ($second -and (Test-Path $second)) { Remove-Item -LiteralPath $second -Force }
      & docker rm $id 2>$null | Out-Null
      $ErrorActionPreference = "Stop"
    }
    Ok "$node node: key copied from the volume $vol and checked"
  } else {
    $src = Join-Path $dir "basedir\block_producer\private.key"
    if (-not (Test-Path $src)) { Warn "$node node: no key at $src (never started?); skipped"; Remove-Item $out; continue }
    Copy-Item -LiteralPath $src -Destination $target
    if ((Sha $src) -ne (Sha $target)) { throw "The copy of the $node node's key isn't identical to the original. Run again." }
    Ok "$node node: key copied from $src and checked"
  }
  $copied++
}
if ($copied -eq 0) { throw "No key was found on this PC. Nothing was backed up." }

# ---------- 3. public keys, checked against the chain ----------
Say ""
Say "Each backed-up key's PUBLIC key, checked against the key registered on chain (read-only):"
Push-Location $Repo
try {
  $ErrorActionPreference = "Continue"
  if (-not $env:RPC) { $env:RPC = "https://koinos.armana.io" }
  & npx tsx tools/producer-keys.ts $Dest
  $check = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
} finally { Pop-Location }

Say ""
if ($check -eq 0) { Ok "Backup done: $Dest" } else { Warn "The backup is written ($Dest), but the check above needs a look. Paste its output (never a key file) to the Vault chat." }
Warn "Never run two nodes with the same key at the same time: the old node must be off for good before a key is restored."
Warn "Keep the stick offline (a drawer, not a cloud folder). Never put a key file in a chat, an email or the repository."
