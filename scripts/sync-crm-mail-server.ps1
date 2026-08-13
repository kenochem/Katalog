#Requires -Version 5.1
<#
  Sync skrzynki CRM (IMAP Webio itd.) → Supabase crm_inbox_sync
  Uruchamiaj na maszynie z dostępem do poczty (ten PC / serwer WAPRO).

  SETUP:
    1. npm install w katalogu projektu (imapflow, @supabase/supabase-js)
    2. C:\katalog-sync\katalog-sync.env — SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
    3. CRM_MAIL_USER_ID — UUID użytkownika, który podłączył skrzynkę w CRM
    4. Harmonogram: co 5 min — patrz install-crm-mail-sync.ps1
  5. Opcjonalnie w katalog-sync.env: CRM_INITIAL_BACKFILL=100, CRM_FETCH_BODIES=20
#>
param(
  [string]$UserId = 'bfd9b95a-4cc0-4c19-b1fa-af395e5956e6'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
$SyncDir = 'C:\katalog-sync'
$EnvFile = Join-Path $SyncDir 'katalog-sync.env'
$LogFile = Join-Path $SyncDir 'crm-mail-sync.log'
$Script = Join-Path $Root 'scripts\crm-mail-pull.mjs'

function Write-Log([string]$msg) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  if (-not (Test-Path $SyncDir)) { New-Item -ItemType Directory -Path $SyncDir | Out-Null }
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-EnvMap([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }
  Get-Content $path -Encoding UTF8 | ForEach-Object {
    $t = $_.Trim()
    if (-not $t -or $t.StartsWith('#')) { return }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { return }
    $map[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
  }
  return $map
}

$localEnv = Join-Path $Root '.env'
$envMap = @{}
if (Test-Path $EnvFile) { $envMap = Get-EnvMap $EnvFile }
elseif (Test-Path $localEnv) { $envMap = Get-EnvMap $localEnv }
else {
  Write-Log "Brak $EnvFile i .env"
  exit 1
}

$url = $envMap['SUPABASE_URL']
if (-not $url) { $url = $envMap['VITE_SUPABASE_URL'] }
$key = $envMap['SUPABASE_SERVICE_ROLE_KEY']
if (-not $url -or -not $key) {
  Write-Log 'Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY'
  exit 1
}

$env:SUPABASE_URL = $url
$env:SUPABASE_SERVICE_ROLE_KEY = $key
$env:CRM_MAIL_USER_ID = $UserId
# CRM_INITIAL_BACKFILL, CRM_FETCH_BODIES — opcjonalnie w katalog-sync.env

if (-not (Test-Path $Script)) {
  Write-Log "Brak $Script"
  exit 1
}

Push-Location $Root
try {
  Write-Log "CRM mail sync start (user $UserId)"
  $out = node $Script 2>&1
  Write-Log $out
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally {
  Pop-Location
}

Write-Log 'CRM mail sync OK'
