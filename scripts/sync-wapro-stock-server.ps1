#Requires -Version 5.1
<#
.SYNOPSIS
  Na serwerze WAPRO: SQL → stany → Supabase (katalog Akcesoria).

.SETUP
  1. Skopiuj do C:\katalog-sync\sync-wapro-stock-server.ps1
  2. C:\katalog-sync\katalog-sync.env z SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  3. Harmonogram codzienny:
       powershell.exe -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1
  4. Harmonogram co 2 min (ręczne zlecenia z aplikacji):
       powershell.exe -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1 -OnlyIfPending

.NOTES
  Nie nadpisuje products.stock_manual = true.
  Przycisk w apce wstawia wiersz do stock_sync_requests (status=pending).
#>
param(
  [switch]$OnlyIfPending
)

$ErrorActionPreference = 'Stop'
$SyncDir = 'C:\katalog-sync'
$EnvFile = Join-Path $SyncDir 'katalog-sync.env'
$LogFile = Join-Path $SyncDir 'sync.log'
$SqlServer = 'localhost'
$SqlDatabase = 'WAPRO'

function Write-Log([string]$msg) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-EnvMap([string]$path) {
  $map = @{}
  Get-Content $path -Encoding UTF8 | ForEach-Object {
    $t = $_.Trim()
    if (-not $t -or $t.StartsWith('#')) { return }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { return }
    $map[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
  }
  return $map
}

if (-not (Test-Path $SyncDir)) { New-Item -ItemType Directory -Path $SyncDir | Out-Null }
if (-not (Test-Path $EnvFile)) {
  Write-Log ('BRAK pliku {0}' -f $EnvFile)
  exit 1
}

$envMap = Get-EnvMap $EnvFile
$SupabaseUrl = $envMap['SUPABASE_URL']
$ServiceKey = $envMap['SUPABASE_SERVICE_ROLE_KEY']
if (-not $SupabaseUrl -or -not $ServiceKey) {
  Write-Log 'Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY'
  exit 1
}
$SupabaseUrl = $SupabaseUrl.TrimEnd('/')

$headers = @{
  apikey        = $ServiceKey
  Authorization = "Bearer $ServiceKey"
  Accept        = 'application/json'
}
$jsonHeaders = $headers + @{
  'Content-Type' = 'application/json'
  Prefer         = 'return=representation'
}

# --- Zlecenia z aplikacji ---
$pendingIds = @()
try {
  $pendingUri = '{0}/rest/v1/stock_sync_requests?status=eq.pending&select=id&order=requested_at.asc' -f $SupabaseUrl
  $pending = @(Invoke-RestMethod -Uri $pendingUri -Headers $headers -Method Get)
  $pendingIds = @($pending | ForEach-Object { $_.id })
} catch {
  if ($OnlyIfPending) {
    Write-Log ('Brak tabeli stock_sync_requests lub blad: {0}' -f $_.Exception.Message)
    exit 0
  }
}

if ($OnlyIfPending -and $pendingIds.Count -eq 0) {
  exit 0
}

if ($pendingIds.Count -gt 0) {
  Write-Log ('Zlecenia pending: {0}' -f $pendingIds.Count)
  $now = (Get-Date).ToUniversalTime().ToString('o')
  foreach ($id in $pendingIds) {
    $body = @{ status = 'running'; started_at = $now } | ConvertTo-Json -Compress
    $uri = '{0}/rest/v1/stock_sync_requests?id=eq.{1}' -f $SupabaseUrl, $id
    try {
      Invoke-RestMethod -Uri $uri -Headers $jsonHeaders -Method Patch -Body $body | Out-Null
    } catch { }
  }
}

Write-Log 'Start sync WAPRO -> Supabase'

try {
  $query = @'
SET NOCOUNT ON;
SELECT LTRIM(RTRIM(INDEKS_KATALOGOWY)) AS sku,
       CAST(SUM(COALESCE(STAN, 0)) AS DECIMAL(18, 3)) AS stock
FROM dbo.ARTYKUL
WHERE INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(INDEKS_KATALOGOWY));
'@

  $csvPath = Join-Path $SyncDir 'wapro-stock.csv'
  $tmpRaw = Join-Path $SyncDir 'wapro-stock.raw'

  & sqlcmd -S $SqlServer -d $SqlDatabase -E -W -h-1 -s ';' -Q $query -o $tmpRaw
  if ($LASTEXITCODE -ne 0) {
    throw ('sqlcmd failed (kod {0})' -f $LASTEXITCODE)
  }

  'sku;stock' | Set-Content -Path $csvPath -Encoding UTF8
  Get-Content $tmpRaw | Where-Object { $_.Trim() -ne '' } | Add-Content -Path $csvPath -Encoding UTF8

  $stockBySku = @{}
  Import-Csv -Path $csvPath -Delimiter ';' | ForEach-Object {
    $sku = ([string]$_.sku).Trim().ToUpperInvariant()
    $stock = 0.0
    [void][double]::TryParse(
      ([string]$_.stock).Replace(',', '.'),
      [System.Globalization.NumberStyles]::Any,
      [System.Globalization.CultureInfo]::InvariantCulture,
      [ref]$stock
    )
    if ($sku) { $stockBySku[$sku] = $stock }
  }
  Write-Log ('Wczytano {0} SKU z WAPRO' -f $stockBySku.Count)

  $products = New-Object System.Collections.Generic.List[object]
  $from = 0
  $page = 1000
  do {
    $uri = '{0}/rest/v1/products?catalog=eq.accessories&select=id,sku,stock,stock_manual,is_group,variants&offset={1}&limit={2}&order=id' -f $SupabaseUrl, $from, $page
    $batch = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    if ($null -eq $batch) { break }
    $arr = @($batch)
    if ($arr.Count -eq 0) { break }
    foreach ($p in $arr) { $products.Add($p) }
    if ($arr.Count -lt $page) { break }
    $from += $page
  } while ($true)

  Write-Log ('Pobrano {0} produktow z Supabase' -f $products.Count)

  $updated = 0
  $skippedManual = 0
  $skippedMissing = 0
  $patchHeaders = $headers + @{
    'Content-Type' = 'application/json'
    Prefer         = 'return=minimal'
  }

  foreach ($p in $products) {
    if ($p.stock_manual -eq $true) { $skippedManual++; continue }

    if ($p.is_group -eq $true -and $p.variants) {
      $variants = @($p.variants)
      $touched = $false
      $next = foreach ($v in $variants) {
        $vsku = ([string]$v.sku).Trim().ToUpperInvariant()
        if ($stockBySku.ContainsKey($vsku)) {
          $touched = $true
          $v | Add-Member -NotePropertyName stock -NotePropertyValue $stockBySku[$vsku] -Force
        }
        $v
      }
      if (-not $touched) { $skippedMissing++; continue }
      $sum = 0.0
      foreach ($v in $next) { $sum += [double]$v.stock }
      $body = @{ stock = $sum; variants = @($next) } | ConvertTo-Json -Depth 8 -Compress
      $patchUri = '{0}/rest/v1/products?id=eq.{1}' -f $SupabaseUrl, $p.id
      Invoke-RestMethod -Uri $patchUri -Headers $patchHeaders -Method Patch -Body $body | Out-Null
      $updated++
      continue
    }

    $sku = ([string]$p.sku).Trim().ToUpperInvariant()
    if (-not $stockBySku.ContainsKey($sku)) { $skippedMissing++; continue }
    $stock = $stockBySku[$sku]
    if ([double]$p.stock -eq $stock) { continue }
    $body = @{ stock = $stock } | ConvertTo-Json -Compress
    $patchUri = '{0}/rest/v1/products?id=eq.{1}' -f $SupabaseUrl, $p.id
    Invoke-RestMethod -Uri $patchUri -Headers $patchHeaders -Method Patch -Body $body | Out-Null
    $updated++
  }

  $msg = 'Zaktualizowano: {0}, reczne: {1}, brak w WAPRO: {2}' -f $updated, $skippedManual, $skippedMissing
  Write-Log ('Koniec. {0}' -f $msg)

  if ($pendingIds.Count -gt 0) {
    $doneAt = (Get-Date).ToUniversalTime().ToString('o')
    foreach ($id in $pendingIds) {
      $body = @{ status = 'done'; finished_at = $doneAt; message = $msg } | ConvertTo-Json -Compress
      $uri = '{0}/rest/v1/stock_sync_requests?id=eq.{1}' -f $SupabaseUrl, $id
      try {
        Invoke-RestMethod -Uri $uri -Headers $jsonHeaders -Method Patch -Body $body | Out-Null
      } catch { }
    }
  }
}
catch {
  Write-Log ('BLAD: {0}' -f $_.Exception.Message)
  if ($pendingIds.Count -gt 0) {
    $doneAt = (Get-Date).ToUniversalTime().ToString('o')
    foreach ($id in $pendingIds) {
      $body = @{ status = 'error'; finished_at = $doneAt; message = $_.Exception.Message } | ConvertTo-Json -Compress
      $uri = '{0}/rest/v1/stock_sync_requests?id=eq.{1}' -f $SupabaseUrl, $id
      try {
        Invoke-RestMethod -Uri $uri -Headers $jsonHeaders -Method Patch -Body $body | Out-Null
      } catch { }
    }
  }
  exit 1
}
