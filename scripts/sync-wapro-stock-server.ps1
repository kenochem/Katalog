#Requires -Version 5.1
<#
.SYNOPSIS
  Na serwerze WAPRO: SQL → stany → Supabase (katalog Akcesoria).
  Bez npm, bez udziału sieciowego, bez SSH.

.SETUP
  1. Skopiuj ten plik na serwer, np. C:\katalog-sync\sync-wapro-stock-server.ps1
  2. Obok utwórz plik C:\katalog-sync\katalog-sync.env:
       SUPABASE_URL=https://fgkkvbniyjysgqcjuxpl.supabase.co
       SUPABASE_SERVICE_ROLE_KEY=eyJ...   (Dashboard → Settings → API → service_role)
  3. Harmonogram zadań Windows → codziennie rano:
       powershell.exe -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1

.NOTES
  Nie nadpisuje products.stock_manual = true.
#>

$ErrorActionPreference = 'Stop'
$SyncDir = 'C:\katalog-sync'
$EnvFile = Join-Path $SyncDir 'katalog-sync.env'
$LogFile = Join-Path $SyncDir 'sync.log'
$SqlServer = 'localhost'   # na serwerze WAPRO; ewentualnie .\SQLEXPRESS
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
  Write-Log ('BRAK pliku {0} - utworz SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY' -f $EnvFile)
  exit 1
}

$envMap = Get-EnvMap $EnvFile
$SupabaseUrl = $envMap['SUPABASE_URL']
$ServiceKey = $envMap['SUPABASE_SERVICE_ROLE_KEY']
if (-not $SupabaseUrl -or -not $ServiceKey) {
  Write-Log 'Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w katalog-sync.env'
  exit 1
}
$SupabaseUrl = $SupabaseUrl.TrimEnd('/')

Write-Log 'Start sync WAPRO -> Supabase'

# --- 1) Stany z SQL ---
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
  Write-Log ('sqlcmd failed (kod {0}). Sprawdz -S {1} / baze {2}' -f $LASTEXITCODE, $SqlServer, $SqlDatabase)
  exit 1
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
Write-Log ("Wczytano {0} SKU z WAPRO" -f $stockBySku.Count)

# --- 2) Produkty z Supabase (accessories) ---
$headers = @{
  apikey        = $ServiceKey
  Authorization = "Bearer $ServiceKey"
  Accept        = 'application/json'
}

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

# --- 3) Update ---
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

Write-Log ('Koniec. Zaktualizowano: {0}, reczne: {1}, brak w WAPRO: {2}' -f $updated, $skippedManual, $skippedMissing)
