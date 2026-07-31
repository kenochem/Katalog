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
Write-Host "Gotowe. Test:"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$dest`""
Write-Host "Harmonogram (zlecenia z apki):"
Write-Host "  powershell -ExecutionPolicy Bypass -File `"$dest`" -OnlyIfPending"
