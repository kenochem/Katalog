#Requires -Version 5.1
<#
  Kopiuje skrypty Node auto-importu Mag do C:\katalog-sync (obok sync-wapro-stock-server.ps1).
  Uruchom z repo po aktualizacji: powershell -File scripts\install-wapro-sync-bundle.ps1
#>
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent
$SyncDir = 'C:\katalog-sync'
$LibDir = Join-Path $SyncDir 'lib'

if (-not (Test-Path $SyncDir)) {
  New-Item -ItemType Directory -Path $SyncDir | Out-Null
}
if (-not (Test-Path $LibDir)) {
  New-Item -ItemType Directory -Path $LibDir | Out-Null
}

$files = @(
  @{ Src = 'scripts\wapro-auto-import.mjs'; Dst = 'wapro-auto-import.mjs' },
  @{ Src = 'scripts\lib\waproMagImport.mjs'; Dst = 'lib\waproMagImport.mjs' },
  @{ Src = 'scripts\lib\waproSkuMatch.mjs'; Dst = 'lib\waproSkuMatch.mjs' }
)

foreach ($f in $files) {
  $from = Join-Path $RepoRoot $f.Src
  $to = Join-Path $SyncDir $f.Dst
  if (-not (Test-Path $from)) {
    Write-Error "Brak pliku w repo: $from"
  }
  Copy-Item -Path $from -Destination $to -Force
  Write-Host "OK: $to"
}

Write-Host ''
Write-Host 'Na serwerze WAPRO trzymaj:'
Write-Host '  C:\katalog-sync\wapro-mag-catalog.json  (npm run export:wapro-mag na PC, potem skopiuj)'
Write-Host '  C:\katalog-sync\katalog-sync.env       (SUPABASE_*, opcjonalnie WAPRO_AUTO_IMPORT=0)'
Write-Host ''
Write-Host 'Sonax reconcile (eksport faktur od 2026-03):'
Write-Host '  Skopiuj scripts\sync-wapro-sonax-export.ps1 -> C:\katalog-sync\'
Write-Host '  Uruchom: run-wapro-sonax-export.bat, potem npm run reconcile:sonax'
Write-Host ''
Write-Host 'Po sync stanow serwer dopnie nowe SKU (jesli jest Node + JSON).'
