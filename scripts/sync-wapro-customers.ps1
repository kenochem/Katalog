#Requires -Version 5.1
<#
.SYNOPSIS
  Import kontrahentow WAPRO do Supabase / Operacje.

.EXAMPLES
  powershell -ExecutionPolicy Bypass -File scripts\sync-wapro-customers.ps1
  powershell -ExecutionPolicy Bypass -File scripts\sync-wapro-customers.ps1 -InputPath data\wapro-kontrahenci.tsv
  powershell -ExecutionPolicy Bypass -File scripts\sync-wapro-customers.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File scripts\sync-wapro-customers.ps1 -InstallToSyncDir
#>
param(
  [string]$InputPath = '',
  [string]$EnvFile = '',
  [switch]$DryRun,
  [switch]$InstallToSyncDir
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path $PSScriptRoot -Parent
$SyncDir = 'C:\katalog-sync'
$LogFile = Join-Path $RepoRoot 'data\wapro-customers-sync.log'

function Write-Log([string]$Message) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Import-EnvFile([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path -Encoding UTF8 | ForEach-Object {
    $t = $_.Trim()
    if (-not $t -or $t.StartsWith('#')) { return }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { return }
    $name = $t.Substring(0, $i).Trim()
    $value = $t.Substring($i + 1).Trim().Trim('"')
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
  Write-Log "Wczytano env: $Path"
}

function Resolve-FirstExisting([string[]]$Paths) {
  $existing = @()
  foreach ($p in $Paths) {
    $full = if ([System.IO.Path]::IsPathRooted($p)) { $p } else { Join-Path $RepoRoot $p }
    if (Test-Path $full) { $existing += Get-Item $full }
  }
  if (-not $existing.Count) { return $null }
  return ($existing | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
}

if ($InstallToSyncDir) {
  if (-not (Test-Path $SyncDir)) {
    New-Item -ItemType Directory -Path $SyncDir | Out-Null
  }
  Copy-Item -Path (Join-Path $PSScriptRoot 'import-wapro-customers.mjs') -Destination (Join-Path $SyncDir 'import-wapro-customers.mjs') -Force
  Copy-Item -Path $PSCommandPath -Destination (Join-Path $SyncDir 'sync-wapro-customers.ps1') -Force
  Write-Log "Zainstalowano flow kontrahentow w $SyncDir"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Brak node.exe w PATH. Zainstaluj Node LTS albo uruchom na maszynie z Node.'
}

if (-not $InputPath) {
  $InputPath = Resolve-FirstExisting @(
    'data\wapro-customers.json',
    'data\wapro-kontrahenci.tsv',
    'data\wapro-customers.csv',
    'C:\katalog-sync\wapro-customers.json',
    'C:\katalog-sync\wapro-kontrahenci.tsv',
    'C:\katalog-sync\wapro-customers.csv'
  )
}

if (-not $InputPath -or -not (Test-Path $InputPath)) {
  throw 'Brak pliku kontrahentow. Oczekiwane np. data\wapro-kontrahenci.tsv albo data\wapro-customers.json.'
}

if (-not $EnvFile) {
  $EnvFile = Resolve-FirstExisting @('.env', 'C:\katalog-sync\katalog-sync.env')
}

if ($EnvFile) {
  Import-EnvFile $EnvFile
}

$script = Join-Path $PSScriptRoot 'import-wapro-customers.mjs'
$argsList = @($script, $InputPath)
if ($DryRun) { $argsList += '--dry-run' }

Write-Log "Start importu kontrahentow: $InputPath"
$output = & node @argsList 2>&1
$code = $LASTEXITCODE
$text = ($output | Out-String).Trim()
if ($text) { Write-Log ($text -replace '\s+', ' ') }
if ($code -ne 0) {
  throw "Import kontrahentow zakonczony bledem: $code"
}
Write-Log 'Import kontrahentow zakonczony poprawnie'
