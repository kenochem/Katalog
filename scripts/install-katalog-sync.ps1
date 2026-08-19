#Requires -Version 5.1
<#
.SYNOPSIS
  Instaluje / aktualizuje sync WAPRO na serwerze (C:\katalog-sync).

.USAGE
  Na maszynie WAPRO, z katalogu repo:
    powershell -ExecutionPolicy Bypass -File scripts\install-katalog-sync.ps1
#>
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$SyncDir = 'C:\katalog-sync'
)

$ErrorActionPreference = 'Stop'
$src = Join-Path $RepoRoot 'scripts\sync-wapro-stock-server.ps1'
$envExample = Join-Path $RepoRoot 'scripts\katalog-sync.env.example'

if (-not (Test-Path $src)) {
  throw "Brak pliku: $src"
}

if (-not (Test-Path $SyncDir)) {
  New-Item -ItemType Directory -Path $SyncDir | Out-Null
  Write-Host "Utworzono $SyncDir"
}

$dest = Join-Path $SyncDir 'sync-wapro-stock-server.ps1'
Copy-Item -Force $src $dest
Write-Host "Skopiowano -> $dest"

foreach ($helper in @('install-katalog-stock-schedule.ps1', 'uninstall-crm-mail-sync.ps1')) {
  $from = Join-Path $RepoRoot "scripts\$helper"
  if (Test-Path $from) {
    Copy-Item -Force $from (Join-Path $SyncDir $helper)
    Write-Host "Skopiowano -> $(Join-Path $SyncDir $helper)"
  }
}

$nodeFiles = @(
  @{ Src = 'scripts\wapro-auto-import.mjs'; Dst = 'wapro-auto-import.mjs' },
  @{ Src = 'scripts\import-wapro-customers.mjs'; Dst = 'import-wapro-customers.mjs' },
  @{ Src = 'scripts\sync-wapro-customers.ps1'; Dst = 'sync-wapro-customers.ps1' },
  @{ Src = 'scripts\lib\waproMagImport.mjs'; Dst = 'lib\waproMagImport.mjs' },
  @{ Src = 'scripts\lib\waproSkuMatch.mjs'; Dst = 'lib\waproSkuMatch.mjs' }
)

foreach ($f in $nodeFiles) {
  $from = Join-Path $RepoRoot $f.Src
  $to = Join-Path $SyncDir $f.Dst
  $toDir = Split-Path $to -Parent
  if (-not (Test-Path $from)) { throw "Brak pliku: $from" }
  if (-not (Test-Path $toDir)) { New-Item -ItemType Directory -Path $toDir | Out-Null }
  Copy-Item -Force $from $to
  Write-Host "Skopiowano -> $to"
}

$bundleDir = Join-Path $RepoRoot 'scripts\katalog-sync'
if (Test-Path $bundleDir) {
  Get-ChildItem $bundleDir -File | ForEach-Object {
    Copy-Item -Force $_.FullName (Join-Path $SyncDir $_.Name)
    Write-Host "Skopiowano -> $(Join-Path $SyncDir $_.Name)"
  }
}

$envDest = Join-Path $SyncDir 'katalog-sync.env'
if (-not (Test-Path $envDest)) {
  if (Test-Path $envExample) {
    Copy-Item $envExample $envDest
    Write-Host "Utworzono $envDest z example - uzupelnij SUPABASE_SERVICE_ROLE_KEY"
  }
} else {
  Write-Host "Zostawiono istniejacy $envDest"
}

Write-Host ""
Write-Host "Gotowe. Test diagnostyki sprzedazy (dwuklik lub z cmd):"
Write-Host "  $SyncDir\diagnose-wapro-sales.bat SON000083"
Write-Host "Albo PowerShell:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$dest`" -DiagnoseSalesSku SON000083"
Write-Host "Harmonogram stanow (Administrator na serwerze WAPRO):"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$(Join-Path $SyncDir 'install-katalog-stock-schedule.ps1')`""
Write-Host "  -> 07:00 pelny sync + co 15 min tylko pending (przycisk Sync WAPRO)"
Write-Host "Sprzedaz Ops (noc, duzy egress — opcjonalnie):"
Write-Host "  ... install-katalog-stock-schedule.ps1 -IncludeNightlySales"
Write-Host "Wylacz sync poczty CRM:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$(Join-Path $SyncDir 'uninstall-crm-mail-sync.ps1')`""
