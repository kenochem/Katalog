#Requires -Version 5.1
<#
.SYNOPSIS
  Na serwerze WAPRO: SQL → stany (+ ceny jeśli dostępne) → Supabase (Akcesoria + Produkty).

.SETUP
  1. Skopiuj do C:\katalog-sync\sync-wapro-stock-server.ps1
  2. C:\katalog-sync\katalog-sync.env z SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
  3. Harmonogram: install-katalog-stock-schedule.ps1 (07:00 stany + co 15 min -OnlyIfPending)

.NOTES
  Nie nadpisuje products.stock_manual = true.
  Przycisk w apce → stock_sync_requests (pending).
  Oba katalogi (accessories + shop) po wspólnym SKU.
#>
param(
  [switch]$OnlyIfPending,
  [switch]$SalesSyncOnly,
  [switch]$SalesOnly,
  [string]$DiagnoseSku = '',
  [string]$DiagnoseSalesSku = '',
  [switch]$DiagnoseSalesSchema,
  [switch]$DiagnosePriceSchema
)

$ErrorActionPreference = 'Stop'
$PrevCulture = [System.Threading.Thread]::CurrentThread.CurrentCulture
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture
$PrevUICulture = [System.Threading.Thread]::CurrentThread.CurrentUICulture
[System.Threading.Thread]::CurrentThread.CurrentUICulture = [System.Globalization.CultureInfo]::InvariantCulture

function Restore-SyncCulture {
  [System.Threading.Thread]::CurrentThread.CurrentCulture = $PrevCulture
  [System.Threading.Thread]::CurrentThread.CurrentUICulture = $PrevUICulture
}

$SyncDir = 'C:\katalog-sync'
$EnvFile = Join-Path $SyncDir 'katalog-sync.env'
$LogFile = Join-Path $SyncDir 'sync.log'

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

function Write-Utf8NoBom([string]$path, [string[]]$lines) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($path, $lines, $utf8)
}

function ConvertTo-JsonText($value, [int]$depth = 8, [switch]$Compress) {
  if ($Compress) {
    return [string](($value | ConvertTo-Json -Depth $depth -Compress) -join [Environment]::NewLine)
  }
  return [string](($value | ConvertTo-Json -Depth $depth) -join [Environment]::NewLine)
}

function Write-JsonUtf8NoBom([string]$path, $value, [int]$depth = 8) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($path, (ConvertTo-JsonText $value $depth), $utf8)
}

function Get-WebExceptionBody($errorRecord) {
  try {
    if ($errorRecord.ErrorDetails -and $errorRecord.ErrorDetails.Message) {
      return [string]$errorRecord.ErrorDetails.Message
    }
  } catch { }
  try {
    $resp = $errorRecord.Exception.Response
    if ($null -eq $resp) { return '' }
    $stream = $resp.GetResponseStream()
    if ($null -eq $stream) { return '' }
    $reader = New-Object System.IO.StreamReader($stream)
    return $reader.ReadToEnd()
  } catch {
    return ''
  }
}

function ConvertTo-DoubleOrNull([string]$raw) {
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  $n = 0.0
  $ok = [double]::TryParse(
    $raw.Trim().Replace(',', '.'),
    [System.Globalization.NumberStyles]::Any,
    [System.Globalization.CultureInfo]::InvariantCulture,
    [ref]$n
  )
  if ($ok) { return $n }
  return $null
}

function ConvertTo-WaproGrossFallback($saleNet, $saleGross) {
  if ($null -ne $saleGross) { return $saleGross }
  if ($null -eq $saleNet) { return $null }
  return [Math]::Round(([double]$saleNet) * 1.23, 2)
}

function Test-PriceEmpty($raw) {
  $n = ConvertTo-DoubleOrNull ([string]$raw)
  return ($null -eq $n) -or ($n -eq 0)
}

function Test-PriceShouldSet($dbRaw, $incoming) {
  if ($null -eq $incoming) { return $false }
  if (Test-PriceEmpty $dbRaw) { return $true }
  $old = ConvertTo-DoubleOrNull ([string]$dbRaw)
  if ($null -eq $old) { return $true }
  return [Math]::Abs([double]$old - [double]$incoming) -gt 0.00005
}

function Resolve-WaproRowForProduct($p) {
  $meta = $p.product_meta
  if ($meta -is [string] -and $meta.Trim()) {
    try { $meta = $meta | ConvertFrom-Json } catch { $meta = $null }
  }
  $candidates = New-Object System.Collections.Generic.List[string]
  $sku = ([string]$p.sku).Trim().ToUpperInvariant()
  if ($sku) { [void]$candidates.Add($sku) }
  $id = ([string]$p.id).Trim().ToUpperInvariant()
  if ($id -match '^SHOP-(.+)$') {
    [void]$candidates.Add($Matches[1].Trim().ToUpperInvariant())
  } elseif ($id -and $id -ne $sku) {
    [void]$candidates.Add($id)
  }
  if ($meta) {
    foreach ($key in @('waproSku', 'legacySku', 'previousSku', 'baselinkerProductId')) {
      $v = [string]$meta.$key
      if ($v.Trim()) { [void]$candidates.Add($v.Trim().ToUpperInvariant()) }
    }
  }
  $primarySku = ([string]$p.sku).Trim().ToUpperInvariant()
  $seen = @{}
  foreach ($c in $candidates) {
    if ($seen.ContainsKey($c)) { continue }
    $seen[$c] = $true
    $row = Get-WaproRow $c
    if ($null -ne $row) {
      $viaAlt = ($primarySku -and $c -ne $primarySku)
      return @{ Row = $row; ViaAlt = $viaAlt }
    }
  }
  return $null
}

function Test-ProductNeedsWaproBootstrap($p) {
  if ($p.stock_manual -eq $true) { return $false }
  $stock = 0.0
  [void][double]::TryParse(([string]$p.stock).Replace(',', '.'), [ref]$stock)
  $emptyPrices = (Test-PriceEmpty $p.price_purchase_net) -and (Test-PriceEmpty $p.price_sale_net) -and (Test-PriceEmpty $p.price_sale_gross)
  return $emptyPrices -and ($stock -le 0.0005)
}

function Test-LikelyPlaceholderSku([string]$sku) {
  $s = $sku.Trim()
  if (-not $s) { return $false }
  if ($s -match '^BL' -and $s -match '\d') { return $true }
  return $false
}

function Get-NormSkuKey([string]$sku) {
  $s = ([string]$sku).Trim().ToUpperInvariant() -replace '[^A-Z0-9]', ''
  if ($s -match '^([A-Z]+)0*([0-9]+)$') {
    return $Matches[1] + ([int]$Matches[2]).ToString()
  }
  return $s
}

function Add-ExistingSkuKey([hashtable]$set, [string]$sku) {
  $key = ([string]$sku).Trim().ToUpperInvariant()
  if (-not $key) { return }
  $set[$key] = $true
  $set[(Get-NormSkuKey $key)] = $true
}

function Get-JsonTextValue($obj, [string]$key, [string]$fallback = '') {
  if ($null -eq $obj) { return $fallback }
  $v = $obj.$key
  if ($null -eq $v) { return $fallback }
  $s = ([string]$v).Trim()
  if ($s) { return $s }
  return $fallback
}

function Get-JsonNumberOrNull($obj, [string]$key) {
  if ($null -eq $obj) { return $null }
  $v = $obj.$key
  if ($null -eq $v -or $v -eq '') { return $null }
  $n = ConvertTo-DoubleOrNull ([string]$v)
  return $n
}

function Get-JsonNumberOrDefault($obj, [string]$key, [double]$defaultValue) {
  $n = Get-JsonNumberOrNull $obj $key
  if ($null -eq $n) { return $defaultValue }
  return $n
}

function Test-WaproArchivedProduct([string]$sku, [string]$name) {
  $s = ([string]$sku).Trim()
  $n = ([string]$name).Trim()
  if ($s -and $s.ToUpperInvariant().StartsWith('X')) { return $true }
  if ($n -and $n.ToUpperInvariant().StartsWith('X')) { return $true }
  return $false
}

function Get-ExistingProductSkuSet {
  param(
    [string]$SupabaseUrl,
    [hashtable]$Headers
  )
  $seen = @{}
  $from = 0
  $page = 1000
  do {
    $uri = '{0}/rest/v1/products?select=id,sku,product_meta&offset={1}&limit={2}&order=sku' -f $SupabaseUrl, $from, $page
    $batch = Invoke-RestMethod -Uri $uri -Headers $Headers -Method Get
    if ($null -eq $batch) { break }
    $arr = @($batch)
    if ($arr.Count -eq 0) { break }
    foreach ($p in $arr) {
      Add-ExistingSkuKey $seen ([string]$p.sku)
      $id = ([string]$p.id).Trim().ToUpperInvariant()
      if ($id -match '^SHOP-(.+)$') {
        Add-ExistingSkuKey $seen $Matches[1]
      } elseif ($id) {
        Add-ExistingSkuKey $seen $id
      }
      $meta = $p.product_meta
      if ($meta -is [string] -and $meta.Trim()) {
        try { $meta = $meta | ConvertFrom-Json } catch { $meta = $null }
      }
      if ($meta) {
        foreach ($key in @('waproSku', 'legacySku', 'previousSku')) {
          Add-ExistingSkuKey $seen ([string]$meta.$key)
        }
      }
    }
    if ($arr.Count -lt $page) { break }
    $from += $page
  } while ($true)
  return $seen
}

function New-WaproSkeletonProduct($row) {
  $sku = (Get-JsonTextValue $row 'sku').ToUpperInvariant()
  $catalog = Get-JsonTextValue $row 'catalog' 'accessories'
  if ($catalog -ne 'shop') { $catalog = 'accessories' }
  $name = Get-JsonTextValue $row 'name' $sku
  $categoryFallback = if ($catalog -eq 'shop') { 'Inne' } else { 'Inne czesci' }
  $category = Get-JsonTextValue $row 'category' $categoryFallback
  $manufacturerFallback = if ($catalog -eq 'accessories') { 'WAPRO' } else { '' }
  $manufacturer = Get-JsonTextValue $row 'manufacturer' $manufacturerFallback
  $id = if ($catalog -eq 'accessories') { $sku } else { 'shop-{0}' -f $sku }
  $meta = @{
    waproImport = $true
    waproSkeleton = $true
    waproSku = $sku
    waproImportedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
  if ($manufacturer) { $meta.waproManufacturer = $manufacturer }

  return [ordered]@{
    id = $id
    sku = $sku
    name = $name
    display_name = $name
    category = $category
    manufacturer = $manufacturer
    ean = ''
    image_url = ''
    custom_image_url = ''
    description = ''
    has_image = $false
    stock = (Get-JsonNumberOrDefault $row 'stock' 0)
    stock_manual = $false
    price_purchase_net = (Get-JsonNumberOrNull $row 'pricePurchaseNet')
    price_sale_net = (Get-JsonNumberOrNull $row 'priceSaleNet')
    price_sale_gross = (Get-JsonNumberOrNull $row 'priceSaleGross')
    extra_images = @()
    variants = @()
    is_group = $false
    catalog = $catalog
    product_meta = $meta
  }
}

function Invoke-WaproMagAutoImport {
  param(
    [string]$SupabaseUrl,
    [string]$ServiceKey,
    [string]$SyncDirPath,
    [hashtable]$EnvMap
  )
  if ($EnvMap['WAPRO_AUTO_IMPORT'] -eq '0') {
    return @{ inserted = 0; note = 'wylaczone (WAPRO_AUTO_IMPORT=0)' }
  }
  $catalog = Join-Path $SyncDirPath 'wapro-mag-catalog.json'
  if (-not (Test-Path $catalog)) {
    return @{ inserted = 0; note = 'brak wapro-mag-catalog.json' }
  }
  try {
    $headers = @{
      apikey = $ServiceKey
      Authorization = "Bearer $ServiceKey"
      Accept = 'application/json'
    }
    $jsonHeaders = $headers + @{
      'Content-Type' = 'application/json'
      Prefer = 'return=minimal'
    }
    $postHeaders = $headers + @{
      Prefer = 'return=minimal'
    }
    $parsed = Get-Content $catalog -Raw -Encoding UTF8 | ConvertFrom-Json
    $rows = if ($parsed -is [array]) { @($parsed) } else { @($parsed.rows) }
    if ($rows.Count -eq 0) { return @{ inserted = 0; candidates = 0; note = 'pusty katalog Mag' } }

    $existing = Get-ExistingProductSkuSet -SupabaseUrl $SupabaseUrl -Headers $headers
    $candidates = New-Object System.Collections.Generic.List[object]
    foreach ($row in $rows) {
      $sku = (Get-JsonTextValue $row 'sku').ToUpperInvariant()
      $name = Get-JsonTextValue $row 'name' $sku
      if (-not $sku -or (Test-WaproArchivedProduct $sku $name)) { continue }
      if ($existing.ContainsKey($sku) -or $existing.ContainsKey((Get-NormSkuKey $sku))) { continue }
      $p = New-WaproSkeletonProduct $row
      [void]$candidates.Add($p)
      Add-ExistingSkuKey $existing $sku
    }
    if ($candidates.Count -eq 0) {
      return @{ inserted = 0; candidates = 0; note = 'brak nowych SKU' }
    }

    $inserted = 0
    $batchSize = 80
    for ($i = 0; $i -lt $candidates.Count; $i += $batchSize) {
      $take = [Math]::Min($batchSize, $candidates.Count - $i)
      $chunk = @($candidates | Select-Object -Skip $i -First $take)
      $body = ConvertTo-JsonText $chunk 8 -Compress
      $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
      $uri = '{0}/rest/v1/products' -f $SupabaseUrl
      try {
        Invoke-RestMethod -Uri $uri -Headers $postHeaders -Method Post -Body $bodyBytes -ContentType 'application/json; charset=utf-8' | Out-Null
      } catch {
        $details = Get-WebExceptionBody $_
        $debugPath = Join-Path $SyncDirPath 'wapro-auto-import-failed-batch.json'
        Write-JsonUtf8NoBom $debugPath $chunk 8
        if ($details) {
          Write-Log ('WAPRO auto-import HTTP details: {0}' -f ($details -replace '\s+', ' '))
        }
        Write-Log ('WAPRO auto-import failed batch: start={0}, size={1}, file={2}' -f $i, $chunk.Count, $debugPath)
        throw
      }
      $inserted += $chunk.Count
    }
    return @{ inserted = $inserted; candidates = $candidates.Count; note = 'ok' }
  } catch {
    Write-Log ("WAPRO auto-import BLAD: {0}" -f $_.Exception.Message)
    return @{ inserted = 0; note = $_.Exception.Message }
  }
}

$script:StockBySku = @{}
$script:StockByNorm = @{}

function Get-WaproRow([string]$sku) {
  $u = $sku.Trim().ToUpperInvariant()
  if ($script:StockBySku.ContainsKey($u)) { return $script:StockBySku[$u] }
  $nk = ($u -replace '[^A-Z0-9]', '')
  if ($nk -match '^([A-Z]+)0*([0-9]+)$') {
    $nk = $Matches[1] + ([int]$Matches[2]).ToString()
  }
  if ($script:StockByNorm.ContainsKey($nk)) { return $script:StockByNorm[$nk] }
  return $null
}

function Set-WaproStockMaps([hashtable]$stockBySku) {
  $script:StockBySku = $stockBySku
  $script:StockByNorm = @{}
  foreach ($k in @($stockBySku.Keys)) {
    $nk = ($k -replace '[^A-Z0-9]', '')
    if ($nk -match '^([A-Z]+)0*([0-9]+)$') {
      $nk = $Matches[1] + ([int]$Matches[2]).ToString()
    }
    if (-not $script:StockByNorm.ContainsKey($nk)) {
      $script:StockByNorm[$nk] = $stockBySku[$k]
    }
  }
}

function Split-SqlOutputLine([string]$line) {
  if ($line -match "`t") {
    return @($line -split "`t" | ForEach-Object { $_.Trim() })
  }
  return @($line.Split(';') | ForEach-Object { $_.Trim() })
}

function Parse-WaproExportFile([string]$path, [ref]$rawTextOut) {
  $rawTextOut.Value = ''
  if (Test-Path $path) {
    $rawTextOut.Value = [System.IO.File]::ReadAllText($path)
  }
  $stockBySku = @{}
  $lineNo = 0
  foreach ($line in [System.IO.File]::ReadAllLines($path)) {
    $lineNo++
    $t = $line.Trim()
    if (-not $t) { continue }
    if ($t -match '^(Msg |Changed database|---|\(\d+ rows affected\))') { continue }
    $parts = Split-SqlOutputLine $t
    if ($parts.Count -lt 2) { continue }
    $sku = $parts[0].Trim().TrimStart([char]0xFEFF).ToUpperInvariant()
    if (-not $sku -or $sku -eq 'SKU') { continue }
    if ($sku.StartsWith('X')) { continue }
    $stockVal = ConvertTo-DoubleOrNull $parts[1]
    if ($null -eq $stockVal) { continue }
    $buy = $null
    $sale = $null
    $gross = $null
    if ($parts.Count -ge 3) { $buy = ConvertTo-DoubleOrNull $parts[2] }
    if ($parts.Count -ge 4) { $sale = ConvertTo-DoubleOrNull $parts[3] }
    if ($parts.Count -ge 5) { $gross = ConvertTo-DoubleOrNull $parts[4] }
    $gross = ConvertTo-WaproGrossFallback $sale $gross
    $stockBySku[$sku] = @{
      stock              = [double]$stockVal
      price_purchase_net = $buy
      price_sale_net     = $sale
      price_sale_gross   = $gross
    }
  }
  return @{ Map = $stockBySku; Lines = $lineNo }
}

function Normalize-WaproCatalogText([string]$raw) {
  if ([string]::IsNullOrWhiteSpace($raw)) { return '' }
  return (($raw -replace ';', ',') -replace '\s+', ' ').Trim()
}

function Get-WaproCatalogKind([string]$sku, [string]$name, [string]$manufacturer) {
  $text = ('{0} {1} {2}' -f $sku, $name, $manufacturer).ToLowerInvariant()
  if ($sku -match '^(HYD|LAN|DYS|PIA|PIS|SZY|WAZ)') { return 'accessories' }
  if ($text -match 'dysza|lanca|waz|pianownic|pistolet|szybkoz|zlacz|adapter|redukc|kolanko|trojnik|manometr|zawor|nypl|nypel|gwint|m22|hydro|zakuci|filtr') {
    return 'accessories'
  }
  return 'shop'
}

function Get-WaproCatalogCategory([string]$catalog, [string]$sku, [string]$name, [string]$manufacturer) {
  $text = ('{0} {1} {2}' -f $sku, $name, $manufacturer).ToLowerInvariant()
  if ($catalog -eq 'accessories') {
    if ($text -match 'dysza') { return 'Dysze' }
    if ($text -match 'lanca') { return 'Lance' }
    if ($text -match 'waz|zakuci') { return 'Weze i zakucia' }
    if ($text -match 'pianownic|piana') { return 'Pianownice' }
    if ($text -match 'pistolet') { return 'Pistolety' }
    if ($text -match 'szybkoz|zlacz|adapter|redukc|kolanko|trojnik|nypl|nypel') { return 'Zlaczki i adaptery' }
    if ($text -match 'filtr') { return 'Filtry' }
    return 'Inne czesci'
  }
  if ($manufacturer) {
    $m = $manufacturer.Trim()
    if ($m -match 'DETAIL') { return 'Detailing' }
    if ($m -match 'CHEM') { return 'Chemia' }
    if ($m -match 'PAPIER|HIGIEN') { return 'Papiery i higiena' }
  }
  if ($text -match 'szczotk') { return 'Szczotki' }
  if ($text -match 'papier|recznik|czysciw|chustecz|toalet') { return 'Papiery i higiena' }
  if ($text -match 'detailing|wosk|quick detailer|cleaner|powlok') { return 'Detailing' }
  if ($text -match 'plyn|zel|preparat|szampon|aktywna piana|odtluszcz') { return 'Chemia' }
  return 'Inne'
}

function Parse-WaproCatalogInfoFile([string]$path) {
  $info = @{}
  if (-not (Test-Path $path)) { return $info }
  foreach ($line in [System.IO.File]::ReadAllLines($path)) {
    $t = $line.Trim()
    if (-not $t) { continue }
    if ($t -match '^(Msg |Changed database|---|\(\d+ rows affected\))') { continue }
    $parts = Split-SqlOutputLine $t
    if ($parts.Count -lt 1) { continue }
    $sku = $parts[0].Trim().TrimStart([char]0xFEFF).ToUpperInvariant()
    if (-not $sku -or $sku -eq 'SKU' -or $sku.StartsWith('X')) { continue }
    $name = if ($parts.Count -ge 2) { Normalize-WaproCatalogText $parts[1] } else { '' }
    $manufacturer = if ($parts.Count -ge 3) { Normalize-WaproCatalogText $parts[2] } else { '' }
    $info[$sku] = @{ name = $name; manufacturer = $manufacturer }
  }
  return $info
}

function Write-WaproMagCatalogJson([hashtable]$stockBySku, [hashtable]$catalogInfo, [string]$path) {
  $rows = New-Object System.Collections.Generic.List[object]
  foreach ($sku in ($stockBySku.Keys | Sort-Object)) {
    if (-not $sku) { continue }
    $stockRow = $stockBySku[$sku]
    $info = if ($catalogInfo.ContainsKey($sku)) { $catalogInfo[$sku] } else { $null }
    $name = if ($info -and $info.name) { $info.name } else { $sku }
    if (Test-WaproArchivedProduct $sku $name) { continue }
    $manufacturer = if ($info -and $info.manufacturer) { $info.manufacturer } else { '' }
    $catalog = Get-WaproCatalogKind $sku $name $manufacturer
    $category = Get-WaproCatalogCategory $catalog $sku $name $manufacturer
    [void]$rows.Add([ordered]@{
      sku = $sku
      name = $name
      stock = [double]$stockRow.stock
      pricePurchaseNet = $stockRow.price_purchase_net
      priceSaleNet = $stockRow.price_sale_net
      priceSaleGross = $stockRow.price_sale_gross
      catalog = $catalog
      category = $category
      manufacturer = $manufacturer
    })
  }
  $payload = [ordered]@{
    exportedAt = (Get-Date).ToUniversalTime().ToString('o')
    source = 'WAPRO SQL dbo.ARTYKUL'
    rows = $rows.ToArray()
  }
  Write-JsonUtf8NoBom $path $payload 6
  return $rows.Count
}

function ConvertTo-CsvField([string]$raw) {
  $v = [string]$raw
  if ($null -eq $v) { $v = '' }
  $v = $v -replace '"', '""'
  return '"' + $v + '"'
}

function Write-UnmatchedWaproReport([System.Collections.Generic.List[object]]$rows, [string]$syncDirPath) {
  $jsonPath = Join-Path $syncDirPath 'sync-unmatched-products.json'
  $csvPath = Join-Path $syncDirPath 'sync-unmatched-products.csv'
  $payload = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    count = $rows.Count
    rows = @($rows)
  }
  Write-JsonUtf8NoBom $jsonPath $payload 5
  $lines = New-Object System.Collections.Generic.List[string]
  [void]$lines.Add('id;sku;catalog;name;reason')
  foreach ($row in $rows) {
    [void]$lines.Add((
      '{0};{1};{2};{3};{4}' -f
      (ConvertTo-CsvField $row.id),
      (ConvertTo-CsvField $row.sku),
      (ConvertTo-CsvField $row.catalog),
      (ConvertTo-CsvField $row.name),
      (ConvertTo-CsvField $row.reason)
    ))
  }
  [System.IO.File]::WriteAllLines($csvPath, $lines.ToArray(), (New-Object System.Text.UTF8Encoding $false))
  return @{ json = $jsonPath; csv = $csvPath }
}

function Test-SqlExportError([int]$code, [string]$rawText) {
  if ($code -ne 0) { return $true }
  if ([string]::IsNullOrWhiteSpace($rawText)) { return $true }
  if ($rawText -match 'Msg \d+') { return $true }
  if ($rawText -match 'Invalid column') { return $true }
  return $false
}

# Eksport tylko cen (sku;zakup;netto;brutto) — bez kolumny stanu.
function Parse-WaproPriceOnlyExportFile([string]$path) {
  $priceBySku = @{}
  if (-not (Test-Path $path)) { return $priceBySku }
  foreach ($line in [System.IO.File]::ReadAllLines($path)) {
    $t = $line.Trim()
    if (-not $t) { continue }
    if ($t -match '^(Msg |Changed database|---|\(\d+ rows affected\))') { continue }
    $parts = Split-SqlOutputLine $t
    if ($parts.Count -lt 2) { continue }
    $sku = $parts[0].Trim().TrimStart([char]0xFEFF).ToUpperInvariant()
    if (-not $sku -or $sku -eq 'SKU') { continue }
    $buy = ConvertTo-DoubleOrNull $parts[1]
    $sale = if ($parts.Count -ge 3) { ConvertTo-DoubleOrNull $parts[2] } else { $null }
    $gross = if ($parts.Count -ge 4) { ConvertTo-DoubleOrNull $parts[3] } else { $null }
    $gross = ConvertTo-WaproGrossFallback $sale $gross
    if (($null -eq $buy) -and ($null -eq $sale) -and ($null -eq $gross)) { continue }
    $priceBySku[$sku] = @{
      price_purchase_net = $buy
      price_sale_net     = $sale
      price_sale_gross   = $gross
    }
  }
  return $priceBySku
}

function Merge-WaproPricesIntoMap([hashtable]$stockBySku, [hashtable]$priceBySku) {
  $merged = 0
  foreach ($sku in @($priceBySku.Keys)) {
    if (-not $stockBySku.ContainsKey($sku)) { continue }
    $pr = $priceBySku[$sku]
    $row = $stockBySku[$sku]
    $touched = $false
    if ($null -ne $pr.price_purchase_net) {
      $row.price_purchase_net = $pr.price_purchase_net
      $touched = $true
    }
    if ($null -ne $pr.price_sale_net) {
      $row.price_sale_net = $pr.price_sale_net
      $touched = $true
    }
    if ($null -ne $pr.price_sale_gross) {
      $row.price_sale_gross = $pr.price_sale_gross
      $touched = $true
    }
    if ($touched) { $merged++ }
  }
  return $merged
}

function Test-WaproMapHasPrices([hashtable]$stockBySku, [int]$sampleSize) {
  $n = 0
  foreach ($sku in $stockBySku.Keys) {
    $r = $stockBySku[$sku]
    if ($null -ne $r.price_sale_net) {
      return $true
    }
    $n++
    if ($n -ge $sampleSize) { break }
  }
  return $false
}

function Merge-WaproPricesFromCsvFile([hashtable]$stockBySku, [string]$csvPath) {
  if (-not (Test-Path $csvPath)) { return 0 }
  $merged = 0
  $first = $true
  foreach ($line in [System.IO.File]::ReadAllLines($csvPath)) {
    $t = $line.Trim()
    if (-not $t) { continue }
    if ($first) {
      $first = $false
      if ($t -match '(?i)^sku') { continue }
    }
    $parts = @($t.Split(';') | ForEach-Object { $_.Trim() })
    if ($parts.Count -lt 3) { continue }
    $sku = $parts[0].Trim().ToUpperInvariant()
    if (-not $sku -or -not $stockBySku.ContainsKey($sku)) { continue }
    $buy = if ($parts.Count -ge 3) { ConvertTo-DoubleOrNull $parts[2] } else { $null }
    $sale = if ($parts.Count -ge 4) { ConvertTo-DoubleOrNull $parts[3] } else { $null }
    $gross = if ($parts.Count -ge 5) { ConvertTo-DoubleOrNull $parts[4] } else { $null }
    $gross = ConvertTo-WaproGrossFallback $sale $gross
    if (($null -eq $buy) -and ($null -eq $sale) -and ($null -eq $gross)) { continue }
    $row = $stockBySku[$sku]
    if ($null -ne $buy) { $row.price_purchase_net = $buy }
    if ($null -ne $sale) { $row.price_sale_net = $sale }
    if ($null -ne $gross) { $row.price_sale_gross = $gross }
    $merged++
  }
  return $merged
}

function Merge-WaproPricesFromCsvCandidates([hashtable]$stockBySku, [System.Collections.Generic.List[string]]$paths) {
  $total = 0
  foreach ($cp in ($paths | Select-Object -Unique)) {
    if (-not $cp) { continue }
    if (-not (Test-Path $cp)) {
      Write-Log ('Ceny CSV: brak pliku {0}' -f $cp)
      continue
    }
    $fromCsv = Merge-WaproPricesFromCsvFile $stockBySku $cp
    if ($fromCsv -gt 0) {
      Write-Log ('Ceny z CSV {0}: scalono {1} SKU' -f $cp, $fromCsv)
      $total += $fromCsv
    }
  }
  return $total
}

function Read-SqlCmdOutput([string]$path) {
  if (-not (Test-Path $path)) { return @() }
  return @(Get-Content $path -Encoding UTF8)
}

function Get-SqlCmdDataLines([string[]]$rawLines) {
  $rawLines = @($rawLines)
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($line in $rawLines) {
    $t = [string]$line
    $t = $t.Trim()
    if (-not $t) { continue }
    if ($t -match '^(Msg \d+|Level \d+|State \d+|Changed database|HResult)') { continue }
    if ($t -match '^\(\d+ rows affected\)$') { continue }
    if ($t -match '^(Invalid object|Invalid column|Cannot open|Login failed)') { continue }
    if ($t -match '[\d\.,\-]+') { [void]$out.Add($t) }
  }
  return @($out)
}

function Get-WaproSalesSqlLine([string[]]$rawLines) {
  $lines = @(Get-SqlCmdDataLines $rawLines)
  if ($lines.Count -eq 0) { return $null }
  $best = $null
  $bestParts = 0
  foreach ($line in $lines) {
    $pc = @($line.Split(';')).Count
    if ($pc -gt $bestParts) {
      $bestParts = $pc
      $best = $line
    }
  }
  if ($bestParts -ge 9) { return $best }
  $merged = ($lines -join ';')
  if (@($merged.Split(';')).Count -ge 9) { return $merged }
  if ($bestParts -ge 5) { return $best }
  return $null
}

function Invoke-WaproSqlProbe {
  param(
    [string]$Label,
    [string]$Query,
    [string]$SyncDirPath,
    [switch]$ToConsole
  )
  $tmp = Join-Path $SyncDirPath ("probe-{0}.raw" -f ($Label -replace '[^a-zA-Z0-9_-]', '_'))
  $code = Invoke-WaproQuery $Query $tmp
  $raw = Read-SqlCmdOutput $tmp
  $data = Get-SqlCmdDataLines $raw
  $snippet = if ($data.Count -gt 0) { ($data -join ' | ') } else { ($raw -join ' | ') }
  if ($snippet.Length -gt 500) { $snippet = $snippet.Substring(0, 500) + '...' }
  Write-Log ('PROBE {0}: exit={1} {2}' -f $Label, $code, $snippet)
  if ($ToConsole) {
    Write-Host ('PROBE {0}: exit={1}' -f $Label, $code)
    Write-Host $snippet
  }
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
  return @{ exit = $code; data = $data; raw = $raw }
}

function Invoke-WaproPriceSchemaProbe {
  param([string]$SyncDirPath)

  Write-Log '=== PROBE schematu cen WAPRO ==='
  Write-Host '=== PROBE schematu cen WAPRO ==='

  $schemaPath = Join-Path $SyncDirPath 'wapro-price-schema.csv'
  $artykulPath = Join-Path $SyncDirPath 'wapro-artykul-columns.csv'

  $querySchema = @'
SET NOCOUNT ON;
SELECT
  TABLE_NAME,
  COLUMN_NAME,
  DATA_TYPE,
  COALESCE(CAST(NUMERIC_PRECISION AS varchar(10)), '') AS NUMERIC_PRECISION,
  COALESCE(CAST(NUMERIC_SCALE AS varchar(10)), '') AS NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND (
    TABLE_NAME LIKE '%CEN%'
    OR TABLE_NAME LIKE '%CENN%'
    OR COLUMN_NAME LIKE '%CEN%'
    OR COLUMN_NAME LIKE '%BRUT%'
    OR COLUMN_NAME LIKE '%NETT%'
    OR COLUMN_NAME LIKE '%ZAKUP%'
    OR COLUMN_NAME LIKE '%SPRZED%'
    OR COLUMN_NAME LIKE '%RABAT%'
    OR COLUMN_NAME IN ('ID_ARTYKULU', 'ID_CENY', 'ID_CENNIKA', 'ID_JEDNOSTKI')
  )
ORDER BY TABLE_NAME, COLUMN_NAME;
'@

  $queryArtykul = @'
SET NOCOUNT ON;
SELECT
  COLUMN_NAME,
  DATA_TYPE,
  COALESCE(CAST(NUMERIC_PRECISION AS varchar(10)), '') AS NUMERIC_PRECISION,
  COALESCE(CAST(NUMERIC_SCALE AS varchar(10)), '') AS NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo'
  AND TABLE_NAME = 'ARTYKUL'
ORDER BY ORDINAL_POSITION;
'@

  $codeSchema = Invoke-WaproQuery $querySchema $schemaPath
  $codeArtykul = Invoke-WaproQuery $queryArtykul $artykulPath
  Write-Log ('Price schema probe: schema exit={0} -> {1}' -f $codeSchema, $schemaPath)
  Write-Log ('Price schema probe: artykul exit={0} -> {1}' -f $codeArtykul, $artykulPath)
  Write-Host ('Zapisano: {0}' -f $schemaPath)
  Write-Host ('Zapisano: {0}' -f $artykulPath)
  Write-Host 'Wklej mi pierwsze 80-120 linii z wapro-price-schema.csv albo podeślij kopię pliku.'
}

function Invoke-WaproSalesSchemaProbe {
  param(
    [string]$Sku,
    [string]$SyncDirPath
  )
  $escaped = $Sku.Trim().Replace("'", "''")
  Write-Log ('=== PROBE schematu sprzedazy SKU={0} ===' -f $Sku)
  Write-Host ('=== PROBE schematu Mag WAPRO, SKU={0} ===' -f $Sku)

  Invoke-WaproSqlProbe -Label 'ping' -Query 'SET NOCOUNT ON; SELECT 1,2,3,4,0,0,0,0,0;' -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Invoke-WaproSqlProbe -Label 'artykul' -Query @"
SET NOCOUNT ON;
SELECT COUNT(*) FROM dbo.ARTYKUL
WHERE LTRIM(RTRIM(INDEKS_KATALOGOWY)) = N'$escaped';
"@ -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Invoke-WaproSqlProbe -Label 'tabele' -Query @"
SET NOCOUNT ON;
SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%POZYC%' OR TABLE_NAME LIKE '%DOKUMENT%'
ORDER BY TABLE_NAME;
"@ -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Invoke-WaproSqlProbe -Label 'link_dh' -Query @"
SET NOCOUNT ON;
SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE '%ID_DOK%HANDL%' OR COLUMN_NAME = 'ID_DOKUMENTU_HANDLOWEGO'
ORDER BY TABLE_NAME, COLUMN_NAME;
"@ -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Invoke-WaproSqlProbe -Label 'kolumny_b1' -Query @"
SET NOCOUNT ON;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'B1_POZYCJA'
  AND (COLUMN_NAME LIKE '%ILOSC%' OR COLUMN_NAME LIKE '%WARTOSC%' OR COLUMN_NAME LIKE '%CENA%' OR COLUMN_NAME LIKE '%DOK%' OR COLUMN_NAME = 'ID_ARTYKULU' OR COLUMN_NAME = 'RODZAJ_POZYCJI')
ORDER BY 1;
"@ -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Invoke-WaproSqlProbe -Label 'kolumny_pdm' -Query @"
SET NOCOUNT ON;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'POZYCJA_DOKUMENTU_MAGAZYNOWEGO'
  AND (COLUMN_NAME LIKE '%DOK%' OR COLUMN_NAME LIKE '%ILOSC%' OR COLUMN_NAME LIKE '%WARTOSC%' OR COLUMN_NAME LIKE '%CENA%' OR COLUMN_NAME = 'ID_ARTYKULU' OR COLUMN_NAME = 'RODZAJ_POZYCJI')
ORDER BY 1;
"@ -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Invoke-WaproSqlProbe -Label 'kolumny_pozycja' -Query @"
SET NOCOUNT ON;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'POZYCJA_DOKUMENTU'
  AND (COLUMN_NAME LIKE '%DOK%' OR COLUMN_NAME LIKE '%ILOSC%' OR COLUMN_NAME LIKE '%WARTOSC%' OR COLUMN_NAME = 'ID_ARTYKULU' OR COLUMN_NAME = 'RODZAJ_POZYCJI')
ORDER BY 1;
"@ -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Invoke-WaproSqlProbe -Label 'kolumny_dh' -Query @"
SET NOCOUNT ON;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DOKUMENT_HANDLOWY'
  AND (COLUMN_NAME LIKE '%DATA%' OR COLUMN_NAME LIKE '%DOK%' OR COLUMN_NAME LIKE '%ANUL%' OR COLUMN_NAME LIKE '%SPRZED%' OR COLUMN_NAME = 'ZAKUP_SPRZEDAZ')
ORDER BY 1;
"@ -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Invoke-WaproSqlProbe -Label 'pozycje_sku' -Query @"
SET NOCOUNT ON;
SELECT COUNT(*)
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = N'$escaped';
"@ -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Invoke-WaproSqlProbe -Label 'pozycje_b1' -Query @"
SET NOCOUNT ON;
SELECT COUNT(*)
FROM dbo.B1_POZYCJA pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = N'$escaped';
"@ -SyncDirPath $SyncDirPath -ToConsole | Out-Null

  Write-Host ''
  Write-Host 'Pelny log: C:\katalog-sync\sync.log'
}

function Invoke-WaproQuery([string]$query, [string]$outFile) {
  if (Test-Path $outFile) { Remove-Item $outFile -Force }
  & sqlcmd -S $SqlServer -d $SqlDatabase -E -W -h-1 -s ';' -f 65001 -Q $query -o $outFile
  return $LASTEXITCODE
}

function Convert-WaproIntDate([int]$days) {
  if ($days -le 0) { return $null }
  try {
    # WAPRO Mag (Clarion): cast(datetime as int) + 36163
    if ($days -gt 30000) {
      $epoch = Get-Date '1900-01-01'
      return $epoch.AddDays($days - 36163).ToString('yyyy-MM-dd')
    }
    # starsze instalacje: dni od 1800-12-28
    $epochOld = Get-Date '1800-12-28'
    return $epochOld.AddDays($days).ToString('yyyy-MM-dd')
  } catch {
    return $null
  }
}

function Get-WaproSalesQueryVariants {
  # Wasza instalacja Mag: POZYCJA_DOKUMENTU_MAGAZYNOWEGO + DOKUMENT_HANDLOWY
  # join pd.ID_DOK_HANDLOWEGO = dh.ID_DOKUMENTU_HANDLOWEGO, kwoty z CENA_NETTO * ILOSC
  $pdMagDhCena = @'
SET NOCOUNT ON;
DECLARE @sku varchar(50) = N'__SKU__';
DECLARE @d1 int = CAST(CAST(DATEADD(month, -1, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d3 int = CAST(CAST(DATEADD(month, -3, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d6 int = CAST(CAST(DATEADD(month, -6, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d12 int = CAST(CAST(DATEADD(month, -12, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
SELECT
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_12m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_12m,
  CAST(ISNULL(MAX(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 AND pd.ILOSC <> 0 THEN dh.DATA_WYSTAWIENIA END), 0) AS INT) AS last_data_int
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = @sku
  AND pd.RODZAJ_POZYCJI = 'R'
  AND dh.DATA_WYSTAWIENIA >= @d12;
'@
  $pdMagDhCenaDataSprz = $pdMagDhCena -replace 'dh\.DATA_WYSTAWIENIA', 'dh.DATA_SPRZEDAZY'
  $pdMagDhCenaNoRodzaj = $pdMagDhCena -replace "  AND pd\.RODZAJ_POZYCJI = 'R'\r?\n", ''
  $pdMagDhCenaBezKosztu = $pdMagDhCena -replace 'pd\.CENA_NETTO', 'pd.CENA_NETTO_BEZ_KOSZTU'

  $pdMagDhQty = @'
SET NOCOUNT ON;
DECLARE @sku varchar(50) = N'__SKU__';
DECLARE @d1 int = CAST(CAST(DATEADD(month, -1, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d3 int = CAST(CAST(DATEADD(month, -3, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d6 int = CAST(CAST(DATEADD(month, -6, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d12 int = CAST(CAST(DATEADD(month, -12, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
SELECT
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_12m,
  CAST(0 AS DECIMAL(18, 2)) AS net_1m,
  CAST(0 AS DECIMAL(18, 2)) AS net_3m,
  CAST(0 AS DECIMAL(18, 2)) AS net_6m,
  CAST(0 AS DECIMAL(18, 2)) AS net_12m,
  CAST(ISNULL(MAX(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 AND pd.ILOSC <> 0 THEN dh.DATA_WYSTAWIENIA END), 0) AS INT) AS last_data_int
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = @sku
  AND pd.RODZAJ_POZYCJI = 'R'
  AND dh.DATA_WYSTAWIENIA >= @d12;
'@
  $pdMagDhQtyDataSprz = $pdMagDhQty -replace 'dh\.DATA_WYSTAWIENIA', 'dh.DATA_SPRZEDAZY'
  $pdMagDhQtyNoRodzaj = $pdMagDhQty -replace "  AND pd\.RODZAJ_POZYCJI = 'R'\r?\n", ''

  $clarion = @'
SET NOCOUNT ON;
DECLARE @sku varchar(50) = N'__SKU__';
DECLARE @d1 int = CAST(CAST(DATEADD(month, -1, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d3 int = CAST(CAST(DATEADD(month, -3, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d6 int = CAST(CAST(DATEADD(month, -6, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d12 int = CAST(CAST(DATEADD(month, -12, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
SELECT
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_12m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.WARTOSC_NETTO ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.WARTOSC_NETTO ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.WARTOSC_NETTO ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.WARTOSC_NETTO ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_12m,
  CAST(ISNULL(MAX(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 AND pd.ILOSC <> 0 THEN dh.DATA_WYSTAWIENIA END), 0) AS INT) AS last_data_int
FROM dbo.POZYCJA_DOKUMENTU pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOKUMENTU_HANDLOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = @sku
  AND pd.RODZAJ_POZYCJI = 'R'
  AND dh.DATA_WYSTAWIENIA >= @d12
  AND ISNULL(dh.FLG_ANULOWANY, 0) = 0;
'@
  $clarionDataSprz = $clarion -replace 'dh\.DATA_WYSTAWIENIA', 'dh.DATA_SPRZEDAZY'
  $clarionNoFlg = $clarion -replace '  AND ISNULL\(dh\.FLG_ANULOWANY, 0\) = 0;', ''
  $clarionWartPoz = $clarion -replace 'pd\.WARTOSC_NETTO', 'pd.WARTOSC_POZYCJI_NETTO'

  $magClarion = @'
SET NOCOUNT ON;
DECLARE @sku varchar(50) = N'__SKU__';
DECLARE @d1 int = CAST(CAST(DATEADD(month, -1, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d3 int = CAST(CAST(DATEADD(month, -3, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d6 int = CAST(CAST(DATEADD(month, -6, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d12 int = CAST(CAST(DATEADD(month, -12, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
SELECT
  CAST(ISNULL(SUM(CASE WHEN dm.DATA >= @d1 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_1m,
  CAST(ISNULL(SUM(CASE WHEN dm.DATA >= @d3 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_3m,
  CAST(ISNULL(SUM(CASE WHEN dm.DATA >= @d6 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_6m,
  CAST(ISNULL(SUM(CASE WHEN dm.DATA >= @d12 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_12m,
  CAST(0 AS DECIMAL(18, 2)) AS net_1m,
  CAST(0 AS DECIMAL(18, 2)) AS net_3m,
  CAST(0 AS DECIMAL(18, 2)) AS net_6m,
  CAST(0 AS DECIMAL(18, 2)) AS net_12m,
  CAST(ISNULL(MAX(CASE WHEN dm.DATA >= @d12 THEN dm.DATA END), 0) AS INT) AS last_data_int
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_MAGAZYNOWY dm WITH (NOLOCK)
  ON dm.ID_DOK_MAGAZYNOWEGO = pd.ID_DOK_MAGAZYNOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = @sku
  AND ISNULL(dm.ROZCHOD, 0) = 1
  AND dm.DATA >= @d12;
'@

  $clarionIdDok = $clarion -replace 'dh\.ID_DOKUMENTU_HANDLOWEGO = pd\.ID_DOKUMENTU_HANDLOWEGO', 'dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOKUMENTU'

  $legacy = @'
SET NOCOUNT ON;
DECLARE @sku varchar(50) = N'__SKU__';
DECLARE @epoch date = '18001228';
DECLARE @d1 int = DATEDIFF(day, @epoch, DATEADD(month, -1, CAST(GETDATE() AS date)));
DECLARE @d3 int = DATEDIFF(day, @epoch, DATEADD(month, -3, CAST(GETDATE() AS date)));
DECLARE @d6 int = DATEDIFF(day, @epoch, DATEADD(month, -6, CAST(GETDATE() AS date)));
DECLARE @d12 int = DATEDIFF(day, @epoch, DATEADD(month, -12, CAST(GETDATE() AS date)));
SELECT
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_12m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.WARTOSC_NETTO ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.WARTOSC_NETTO ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.WARTOSC_NETTO ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.WARTOSC_NETTO ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_12m,
  CAST(ISNULL(MAX(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 AND pd.ILOSC <> 0 THEN dh.DATA_WYSTAWIENIA END), 0) AS INT) AS last_data_int
FROM dbo.POZYCJA_DOKUMENTU pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK) ON dh.ID_DOK_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = @sku
  AND pd.RODZAJ_POZYCJI = 'R'
  AND dh.DATA_WYSTAWIENIA >= @d12
  AND ISNULL(dh.FLG_ANULOWANY, 0) = 0;
'@

  $variants = @(
    $pdMagDhCena, $pdMagDhCenaDataSprz, $pdMagDhCenaBezKosztu, $pdMagDhCenaNoRodzaj,
    $pdMagDhQty, $pdMagDhQtyDataSprz, $pdMagDhQtyNoRodzaj,
    $magClarion,
    $clarion, $clarionDataSprz, $clarionNoFlg, $clarionWartPoz, $clarionIdDok,
    $legacy
  )
  if ($script:EnvMapSales -and $script:EnvMapSales['WAPRO_SALES_SQL']) {
    $variants = @($script:EnvMapSales['WAPRO_SALES_SQL'].Trim()) + $variants
  }
  return $variants
}

function Parse-WaproSalesSqlLine([string]$line) {
  $line = $line.Trim()
  if (-not $line) { return $null }
  $parts = @($line.Split(';'))
  if ($parts.Count -lt 5) {
    $parts = @($line -split "`t")
  }
  if ($parts.Count -lt 5) { return $null }
  $nums = @()
  foreach ($p in $parts) {
    $n = ConvertTo-DoubleOrNull $p
    if ($null -eq $n) { $n = 0.0 }
    $nums += $n
  }
  while ($nums.Count -lt 9) { $nums += 0.0 }
  $lastInt = [int][Math]::Round($nums[8])
  $result = @{
    qty_1m         = $nums[0]
    qty_3m         = $nums[1]
    qty_6m         = $nums[2]
    qty_12m        = $nums[3]
    net_1m         = $nums[4]
    net_3m         = $nums[5]
    net_6m         = $nums[6]
    net_12m        = $nums[7]
    last_data_int  = $lastInt
    last_sale_date = (Convert-WaproIntDate $lastInt)
    qty_prev_12m   = 0.0
    net_prev_12m   = 0.0
  }
  if ($nums.Count -ge 11) {
    $result.qty_prev_12m = $nums[9]
    $result.net_prev_12m = $nums[10]
  }
  for ($m = 1; $m -le 12; $m++) {
    $tag = '{0:D2}' -f $m
    $qi = 10 + $m
    $ni = 22 + $m
    if ($nums.Count -gt $ni) {
      $result["qty_cal_m$tag"] = $nums[$qi]
      $result["net_cal_m$tag"] = $nums[$ni]
    }
  }
  return $result
}

function Invoke-WaproSalesQuery {
  param(
    [string]$Sku,
    [string]$SyncDirPath,
    [switch]$VerboseLog
  )
  $escaped = $Sku.Trim().Replace("'", "''")
  if (-not $escaped) { throw 'Pusty SKU' }
  $tmp = Join-Path $SyncDirPath ('wapro-sales-{0}.raw' -f ([guid]::NewGuid().ToString('N').Substring(0, 8)))
  $variants = Get-WaproSalesQueryVariants
  $lastErr = 'Brak wyniku SQL'
  $errLog = New-Object System.Collections.Generic.List[string]
  $vi = 0
  foreach ($tpl in $variants) {
    $vi++
    $query = $tpl.Replace('__SKU__', $escaped)
    $code = Invoke-WaproQuery $query $tmp
    $raw = Read-SqlCmdOutput $tmp
    if ($VerboseLog) {
      $rawSnippet = ($raw -join ' | ')
      if ($rawSnippet.Length -gt 300) { $rawSnippet = $rawSnippet.Substring(0, 300) + '...' }
      Write-Log ('Wariant {0}: exit={1} raw={2}' -f $vi, $code, $rawSnippet)
      Write-Host ('Wariant {0}: exit={1}' -f $vi, $code)
      if ($rawSnippet) { Write-Host $rawSnippet }
    }
    if ($code -ne 0) {
      $lastErr = ('sqlcmd exit {0}' -f $code)
      $errTail = ($raw -join ' | ')
      if ($errTail.Trim()) { $lastErr = ('{0}: {1}' -f $lastErr, $errTail) }
      if ($errLog.Count -lt 6) { [void]$errLog.Add(('v{0} {1}' -f $vi, $lastErr)) }
      continue
    }
    $lines = Get-SqlCmdDataLines $raw
    if ($lines.Count -lt 1) {
      $hint = ($raw -join ' | ')
      if ($hint.Trim()) { [void]$errLog.Add(('v{0} pusty wiersz: {1}' -f $vi, $hint)) }
      continue
    }
    $resultLine = Get-WaproSalesSqlLine $raw
    if (-not $resultLine) {
      [void]$errLog.Add(('v{0} nieparsowalny: {1}' -f $vi, ($lines -join ' | ')))
      continue
    }
    $parsed = Parse-WaproSalesSqlLine $resultLine
    if ($parsed) {
      if (Test-Path $tmp) { Remove-Item $tmp -Force }
      return $parsed
    }
    [void]$errLog.Add(('v{0} nieparsowalny: {1}' -f $vi, $resultLine))
  }
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
  if ($errLog.Count -gt 0) {
    throw ('Brak wyniku SQL. Szczegoly: {0}' -f ($errLog -join ' || '))
  }
  throw $lastErr
}

function Get-ProductSalesSkus($p) {
  $set = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  $sku = ([string]$p.sku).Trim().ToUpperInvariant()
  if ($sku) { [void]$set.Add($sku) }
  if ($p.variants) {
    foreach ($v in @($p.variants)) {
      $vs = ([string]$v.sku).Trim().ToUpperInvariant()
      if ($vs) { [void]$set.Add($vs) }
    }
  }
  return @($set)
}

function Get-WaproSalesMonthKeys {
  $keys = New-Object System.Collections.Generic.List[string]
  $d = Get-Date
  $base = Get-Date -Year $d.Year -Month $d.Month -Day 1
  for ($i = 0; $i -lt 12; $i++) {
    [void]$keys.Add($base.AddMonths(-(11 - $i)).ToString('yyyy-MM'))
  }
  return @($keys)
}

function New-WaproSalesExtendedBulkSql {
  $mbDecl = New-Object System.Collections.Generic.List[string]
  [void]$mbDecl.Add('DECLARE @base date = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1);')
  for ($i = 0; $i -le 11; $i++) {
    $back = 11 - $i
    [void]$mbDecl.Add("DECLARE @mb$i int = CAST(CAST(DATEADD(month, -$back, @base) AS datetime) AS int) + 36163;")
  }
  [void]$mbDecl.Add('DECLARE @mb12 int = CAST(CAST(DATEADD(month, 1, @base) AS datetime) AS int) + 36163;')

  $qtyMonth = New-Object System.Collections.Generic.List[string]
  $netMonth = New-Object System.Collections.Generic.List[string]
  for ($m = 1; $m -le 12; $m++) {
    $lo = $m - 1
    $hi = $m
    $tag = '{0:D2}' -f $m
    [void]$qtyMonth.Add("  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @mb$lo AND dh.DATA_WYSTAWIENIA < @mb$hi THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_cal_m$tag,")
    [void]$netMonth.Add("  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @mb$lo AND dh.DATA_WYSTAWIENIA < @mb$hi THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_cal_m$tag,")
  }

  $head = @'
SET NOCOUNT ON;
DECLARE @d1 int = CAST(CAST(DATEADD(month, -1, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d3 int = CAST(CAST(DATEADD(month, -3, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d6 int = CAST(CAST(DATEADD(month, -6, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d12 int = CAST(CAST(DATEADD(month, -12, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d24 int = CAST(CAST(DATEADD(month, -24, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
'@ + "`n" + ($mbDecl -join "`n") + @'

SELECT
  LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) AS sku,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_12m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_12m,
  CAST(ISNULL(MAX(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 AND pd.ILOSC <> 0 THEN dh.DATA_WYSTAWIENIA END), 0) AS INT) AS last_data_int,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d24 AND dh.DATA_WYSTAWIENIA < @d12 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_prev_12m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d24 AND dh.DATA_WYSTAWIENIA < @d12 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_prev_12m,
'@

  $tail = @'
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
WHERE pd.RODZAJ_POZYCJI = 'R'
  AND dh.DATA_WYSTAWIENIA >= @d24
  AND a.INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(a.INDEKS_KATALOGOWY));
'@

  return ($head + "`n" + ($qtyMonth -join "`n") + "`n" + ($netMonth -join "`n") + "`n" + $tail)
}

function Get-WaproSalesBulkQueryVariants {
  $extended = New-WaproSalesExtendedBulkSql
  $extendedNoRodzaj = $extended -replace "  AND pd\.RODZAJ_POZYCJI = 'R'\r?\n", ''
  $bulk = @'
SET NOCOUNT ON;
DECLARE @d1 int = CAST(CAST(DATEADD(month, -1, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d3 int = CAST(CAST(DATEADD(month, -3, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d6 int = CAST(CAST(DATEADD(month, -6, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
DECLARE @d12 int = CAST(CAST(DATEADD(month, -12, CAST(GETDATE() AS date)) AS datetime) AS int) + 36163;
SELECT
  LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) AS sku,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.ILOSC ELSE 0 END), 0) AS DECIMAL(18, 3)) AS qty_12m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d1 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_1m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d3 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_3m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d6 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_6m,
  CAST(ISNULL(SUM(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 THEN pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) ELSE 0 END), 0) AS DECIMAL(18, 2)) AS net_12m,
  CAST(ISNULL(MAX(CASE WHEN dh.DATA_WYSTAWIENIA >= @d12 AND pd.ILOSC <> 0 THEN dh.DATA_WYSTAWIENIA END), 0) AS INT) AS last_data_int
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
WHERE pd.RODZAJ_POZYCJI = 'R'
  AND dh.DATA_WYSTAWIENIA >= @d12
  AND a.INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(a.INDEKS_KATALOGOWY));
'@
  $bulkNoRodzaj = $bulk -replace "  AND pd\.RODZAJ_POZYCJI = 'R'\r?\n", ''
  $variants = @($extended, $extendedNoRodzaj, $bulk, $bulkNoRodzaj)
  if ($script:EnvMapSales -and $script:EnvMapSales['WAPRO_SALES_BULK_SQL']) {
    $variants = @($script:EnvMapSales['WAPRO_SALES_BULK_SQL'].Trim()) + $variants
  }
  return $variants
}

function Parse-WaproSalesBulkExportFile([string]$path) {
  $salesBySku = @{}
  $lineNo = 0
  if (-not (Test-Path $path)) { return @{ Map = $salesBySku; Lines = 0 } }
  $pending = New-Object System.Collections.Generic.List[string]
  foreach ($line in [System.IO.File]::ReadAllLines($path)) {
    $lineNo++
    $t = $line.Trim()
    if (-not $t) { continue }
    if ($t -match '^(Msg |Changed database|---|\(\d+ rows affected\))') { continue }
    [void]$pending.Add($t)
  }
  foreach ($chunk in $pending) {
    $parts = @(Split-SqlOutputLine $chunk)
    if ($parts.Count -lt 10) { continue }
    $sku = $parts[0].Trim().TrimStart([char]0xFEFF).ToUpperInvariant()
    if (-not $sku -or $sku -eq 'SKU') { continue }
    $parsed = Parse-WaproSalesSqlLine (($parts | Select-Object -Skip 1) -join ';')
    if (-not $parsed) { continue }
    $salesBySku[$sku] = $parsed
  }
  return @{ Map = $salesBySku; Lines = $lineNo }
}

function Invoke-WaproSalesBulkQuery {
  param([string]$SyncDirPath)
  $tmp = Join-Path $SyncDirPath ('wapro-sales-bulk-{0}.raw' -f ([guid]::NewGuid().ToString('N').Substring(0, 8)))
  $variants = Get-WaproSalesBulkQueryVariants
  $variantNames = @('extended_v2', 'extended_v2_no_rodzaj', 'bulk_v1', 'bulk_v1_no_rodzaj')
  $lastErr = 'Brak wyniku SQL (bulk sprzedaz)'
  for ($vi = 0; $vi -lt $variants.Count; $vi++) {
    $query = $variants[$vi]
    $variantName = if ($vi -lt $variantNames.Count) { $variantNames[$vi] } else { ('variant_{0}' -f $vi) }
    $code = Invoke-WaproQuery $query $tmp
    $raw = Read-SqlCmdOutput $tmp
    $rawText = if ($raw.Count -gt 0) { ($raw -join "`n") } else { '' }
    if (Test-SqlExportError $code $rawText) {
      $lastErr = ('bulk sqlcmd exit={0}: {1}' -f $code, ($rawText.Substring(0, [Math]::Min(200, $rawText.Length))))
      Write-Log ('Bulk sprzedaz wariant {0}: blad sqlcmd' -f $variantName)
      continue
    }
    $parsed = Parse-WaproSalesBulkExportFile $tmp
    if ($parsed.Map.Count -gt 0) {
      $hasMonthly = $false
      foreach ($row in $parsed.Map.Values) {
        if ($row.ContainsKey('qty_cal_m01')) { $hasMonthly = $true; break }
      }
      $schemaLabel = if ($hasMonthly) { 'v2 (monthly)' } else { 'v1 (sumy 1/3/6/12m)' }
      Write-Log ('Bulk sprzedaz SQL OK: wariant={0}, schema={1}, SKU={2}' -f $variantName, $schemaLabel, $parsed.Map.Count)
      if (Test-Path $tmp) { Remove-Item $tmp -Force }
      return $parsed
    }
    $lastErr = 'bulk: pusty export'
    Write-Log ('Bulk sprzedaz wariant {0}: pusty export' -f $variantName)
  }
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
  throw $lastErr
}

function Add-WaproSalesMonthlyToJson {
  param([hashtable]$Agg)
  $monthKeys = Get-WaproSalesMonthKeys
  $monthly = New-Object System.Collections.Generic.List[object]
  for ($m = 1; $m -le 12; $m++) {
    $tag = '{0:D2}' -f $m
    $qKey = "qty_cal_m$tag"
    $nKey = "net_cal_m$tag"
    if (-not $Agg.ContainsKey($qKey)) { return $null }
    $q = [double]$Agg[$qKey]
    $n = [double]$Agg[$nKey]
    [void]$monthly.Add(@{
        month    = $monthKeys[$m - 1]
        qty      = [Math]::Round($q, 3)
        netValue = [Math]::Round($n, 2)
      })
  }
  return @($monthly)
}

function Build-WaproSalesStatsJson {
  param(
    [string[]]$Skus,
    [hashtable]$Agg
  )
  $now = (Get-Date).ToUniversalTime().ToString('o')
  $periods = @(
    @{ months = 1; qty = [Math]::Round($Agg.qty_1m, 3); netValue = [Math]::Round($Agg.net_1m, 2) },
    @{ months = 3; qty = [Math]::Round($Agg.qty_3m, 3); netValue = [Math]::Round($Agg.net_3m, 2) },
    @{ months = 6; qty = [Math]::Round($Agg.qty_6m, 3); netValue = [Math]::Round($Agg.net_6m, 2) },
    @{ months = 12; qty = [Math]::Round($Agg.qty_12m, 3); netValue = [Math]::Round($Agg.net_12m, 2) }
  )
  $payload = @{
    sku          = $Skus[0]
    skus         = $Skus
    fetchedAt    = $now
    periods      = $periods
    lastSaleDate = if ($Agg.last_data_int -gt 0) { $Agg.last_sale_date } else { $null }
    source       = 'wapro-mag-bulk'
  }
  if ($Agg.ContainsKey('qty_prev_12m')) {
    $payload.prev12m = @{
      qty      = [Math]::Round([double]$Agg.qty_prev_12m, 3)
      netValue = [Math]::Round([double]$Agg.net_prev_12m, 2)
    }
    $payload.schemaVersion = 2
  }
  $monthly = Add-WaproSalesMonthlyToJson -Agg $Agg
  if ($monthly) { $payload.monthly = $monthly; $payload.schemaVersion = 2 }
  return $payload
}

function Aggregate-SalesRowsForSkus {
  param(
    [string[]]$Skus,
    [hashtable]$SalesBySku
  )
  $agg = @{
    qty_1m = 0.0; qty_3m = 0.0; qty_6m = 0.0; qty_12m = 0.0
    net_1m = 0.0; net_3m = 0.0; net_6m = 0.0; net_12m = 0.0
    qty_prev_12m = 0.0; net_prev_12m = 0.0
    last_data_int = 0; last_sale_date = $null
  }
  for ($m = 1; $m -le 12; $m++) {
    $tag = '{0:D2}' -f $m
    $agg["qty_cal_m$tag"] = 0.0
    $agg["net_cal_m$tag"] = 0.0
  }
  $hit = $false
  foreach ($s in $Skus) {
    $key = $s.Trim().ToUpperInvariant()
    if (-not $SalesBySku.ContainsKey($key)) { continue }
    $row = $SalesBySku[$key]
    $hit = $true
    $agg.qty_1m += $row.qty_1m
    $agg.qty_3m += $row.qty_3m
    $agg.qty_6m += $row.qty_6m
    $agg.qty_12m += $row.qty_12m
    $agg.net_1m += $row.net_1m
    $agg.net_3m += $row.net_3m
    $agg.net_6m += $row.net_6m
    $agg.net_12m += $row.net_12m
    if ($row.ContainsKey('qty_prev_12m')) {
      $agg.qty_prev_12m += [double]$row.qty_prev_12m
      $agg.net_prev_12m += [double]$row.net_prev_12m
    }
    for ($m = 1; $m -le 12; $m++) {
      $tag = '{0:D2}' -f $m
      $qk = "qty_cal_m$tag"
      $nk = "net_cal_m$tag"
      if ($row.ContainsKey($qk)) {
        $agg[$qk] += [double]$row[$qk]
        $agg[$nk] += [double]$row[$nk]
      }
    }
    if ($row.last_data_int -gt $agg.last_data_int -and $row.last_data_int -gt 0) {
      $agg.last_data_int = $row.last_data_int
      $agg.last_sale_date = $row.last_sale_date
    }
  }
  if (-not $hit) { return $null }
  return $agg
}

function Invoke-SyncWaproSalesBulk {
  param(
    [string]$SupabaseUrl,
    [hashtable]$Headers,
    [hashtable]$JsonHeaders,
    [string]$SyncDirPath,
    [string[]]$PendingIds = @()
  )
  Write-Log 'Start sync sprzedazy WAPRO (bulk) -> Supabase'
  $now = (Get-Date).ToUniversalTime().ToString('o')
  if ($PendingIds.Count -gt 0) {
    foreach ($id in $PendingIds) {
      $body = @{ status = 'running'; started_at = $now } | ConvertTo-Json -Compress
      $uri = '{0}/rest/v1/sales_sync_requests?id=eq.{1}' -f $SupabaseUrl, $id
      try { Invoke-RestMethod -Uri $uri -Headers $JsonHeaders -Method Patch -Body $body | Out-Null } catch { }
    }
  }

  try {
    $bulk = Invoke-WaproSalesBulkQuery -SyncDirPath $SyncDirPath
    $salesBySku = $bulk.Map
    Write-Log ('Bulk sprzedaz: {0} SKU z Mag (linie raw: {1})' -f $salesBySku.Count, $bulk.Lines)

    $products = New-Object System.Collections.Generic.List[object]
    $from = 0
    $page = 1000
    do {
      $uri = '{0}/rest/v1/products?select=id,sku,variants,is_group,wapro_sales_stats,wapro_sales_synced_at&offset={1}&limit={2}&order=id' -f $SupabaseUrl, $from, $page
      $batch = Invoke-RestMethod -Uri $uri -Headers $Headers -Method Get
      if ($null -eq $batch) { break }
      $arr = @($batch)
      if ($arr.Count -eq 0) { break }
      foreach ($p in $arr) { $products.Add($p) }
      if ($arr.Count -lt $page) { break }
      $from += $page
    } while ($true)

    Write-Log ('Bulk sprzedaz: {0} produktow w Supabase' -f $products.Count)
    $patchHeaders = $Headers + @{
      'Content-Type' = 'application/json'
      Prefer         = 'return=minimal'
    }
    $updated = 0
    $unchanged = 0
    $cleared = 0
    $syncedAt = (Get-Date).ToUniversalTime().ToString('o')

    foreach ($p in $products) {
      $skus = Get-ProductSalesSkus $p
      if ($skus.Count -eq 0) { continue }
      $agg = Aggregate-SalesRowsForSkus -Skus $skus -SalesBySku $salesBySku
      $payload = @{ wapro_sales_synced_at = $syncedAt }
      if ($agg) {
        $payload.wapro_sales_stats = Build-WaproSalesStatsJson -Skus $skus -Agg $agg
      } else {
        $payload.wapro_sales_stats = $null
        $cleared++
      }
      $body = $payload | ConvertTo-Json -Compress -Depth 8
      $existingJson = if ($p.wapro_sales_stats) { ($p.wapro_sales_stats | ConvertTo-Json -Compress -Depth 8) } else { '' }
      $newJson = if ($payload.wapro_sales_stats) { ($payload.wapro_sales_stats | ConvertTo-Json -Compress -Depth 8) } else { '' }
      if ($existingJson -eq $newJson -and [string]$p.wapro_sales_synced_at) {
        $unchanged++
        continue
      }
      $patchUri = '{0}/rest/v1/products?id=eq.{1}' -f $SupabaseUrl, $p.id
      Invoke-RestMethod -Uri $patchUri -Headers $patchHeaders -Method Patch -Body $body | Out-Null
      $updated++
    }

    $msg = 'Bulk sprzedaz OK: zaktualizowano {0}, bez zmian {1}, wyczyszczono {2}, SKU z Mag {3}' -f $updated, $unchanged, $cleared, $salesBySku.Count
    Write-Log $msg

    if ($PendingIds.Count -gt 0) {
      $doneAt = (Get-Date).ToUniversalTime().ToString('o')
      foreach ($id in $PendingIds) {
        $doneBody = @{ status = 'done'; finished_at = $doneAt; message = $msg } | ConvertTo-Json -Compress
        $doneUri = '{0}/rest/v1/sales_sync_requests?id=eq.{1}' -f $SupabaseUrl, $id
        try { Invoke-RestMethod -Uri $doneUri -Headers $JsonHeaders -Method Patch -Body $doneBody | Out-Null } catch { }
      }
    }
    return $msg
  } catch {
    $err = $_.Exception.Message
    Write-Log ('Bulk sprzedaz BLAD: {0}' -f $err)
    if ($PendingIds.Count -gt 0) {
      $doneAt = (Get-Date).ToUniversalTime().ToString('o')
      foreach ($id in $PendingIds) {
        $errBody = @{ status = 'error'; finished_at = $doneAt; message = $err } | ConvertTo-Json -Compress
        $errUri = '{0}/rest/v1/sales_sync_requests?id=eq.{1}' -f $SupabaseUrl, $id
        try { Invoke-RestMethod -Uri $errUri -Headers $JsonHeaders -Method Patch -Body $errBody | Out-Null } catch { }
      }
    }
    throw
  }
}

function Build-WaproSalesResult([string[]]$skus, [hashtable]$agg) {
  $now = (Get-Date).ToUniversalTime().ToString('o')
  $periods = @(
    @{ months = 1; qty = [Math]::Round($agg.qty_1m, 3); netValue = [Math]::Round($agg.net_1m, 2) },
    @{ months = 3; qty = [Math]::Round($agg.qty_3m, 3); netValue = [Math]::Round($agg.net_3m, 2) },
    @{ months = 6; qty = [Math]::Round($agg.qty_6m, 3); netValue = [Math]::Round($agg.net_6m, 2) },
    @{ months = 12; qty = [Math]::Round($agg.qty_12m, 3); netValue = [Math]::Round($agg.net_12m, 2) }
  )
  return @{
    sku          = $skus[0]
    skus         = $skus
    fetchedAt    = $now
    periods      = $periods
    lastSaleDate = if ($agg.qty_12m -gt 0) { $agg.last_sale_date } else { $null }
    source       = 'wapro-mag'
  }
}

function Invoke-WaproSalesRequests {
  param(
    [string]$SupabaseUrl,
    [hashtable]$Headers,
    [hashtable]$JsonHeaders,
    [string]$SyncDirPath,
    [object[]]$Requests
  )
  if (-not $Requests -or $Requests.Count -eq 0) { return }
  Write-Log ('Zlecenia sprzedazy pending: {0}' -f $Requests.Count)
  foreach ($req in $Requests) {
    $id = [string]$req.id
    $skuField = [string]$req.sku
    $skus = @($skuField.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    if ($skus.Count -eq 0) {
      $body = @{ status = 'error'; finished_at = (Get-Date).ToUniversalTime().ToString('o'); message = 'Brak SKU w zleceniu' } | ConvertTo-Json -Compress
      $uri = '{0}/rest/v1/wapro_sales_requests?id=eq.{1}' -f $SupabaseUrl, $id
      try { Invoke-RestMethod -Uri $uri -Headers $JsonHeaders -Method Patch -Body $body | Out-Null } catch { }
      continue
    }
    $now = (Get-Date).ToUniversalTime().ToString('o')
    $runBody = @{ status = 'running'; started_at = $now } | ConvertTo-Json -Compress
    $runUri = '{0}/rest/v1/wapro_sales_requests?id=eq.{1}' -f $SupabaseUrl, $id
    try { Invoke-RestMethod -Uri $runUri -Headers $JsonHeaders -Method Patch -Body $runBody | Out-Null } catch { }
    try {
      $agg = @{
        qty_1m = 0.0; qty_3m = 0.0; qty_6m = 0.0; qty_12m = 0.0
        net_1m = 0.0; net_3m = 0.0; net_6m = 0.0; net_12m = 0.0
        last_data_int = 0; last_sale_date = $null
      }
      foreach ($s in $skus) {
        $row = Invoke-WaproSalesQuery -Sku $s -SyncDirPath $SyncDirPath
        $agg.qty_1m += $row.qty_1m
        $agg.qty_3m += $row.qty_3m
        $agg.qty_6m += $row.qty_6m
        $agg.qty_12m += $row.qty_12m
        $agg.net_1m += $row.net_1m
        $agg.net_3m += $row.net_3m
        $agg.net_6m += $row.net_6m
        $agg.net_12m += $row.net_12m
        if ($row.last_data_int -gt $agg.last_data_int -and $row.last_data_int -gt 0) {
          $agg.last_data_int = $row.last_data_int
          $agg.last_sale_date = $row.last_sale_date
        }
      }
      $result = Build-WaproSalesResult $skus $agg
      $doneBody = @{
        status      = 'done'
        finished_at = (Get-Date).ToUniversalTime().ToString('o')
        result      = $result
        message     = ('OK: {0}' -f ($skus -join ', '))
      } | ConvertTo-Json -Compress -Depth 6
      $doneUri = '{0}/rest/v1/wapro_sales_requests?id=eq.{1}' -f $SupabaseUrl, $id
      Invoke-RestMethod -Uri $doneUri -Headers $JsonHeaders -Method Patch -Body $doneBody | Out-Null
      Write-Log ('Sprzedaz OK id={0} sku={1}' -f $id, ($skus -join ','))
    } catch {
      $errBody = @{
        status      = 'error'
        finished_at = (Get-Date).ToUniversalTime().ToString('o')
        message     = $_.Exception.Message
      } | ConvertTo-Json -Compress
      $errUri = '{0}/rest/v1/wapro_sales_requests?id=eq.{1}' -f $SupabaseUrl, $id
      try { Invoke-RestMethod -Uri $errUri -Headers $JsonHeaders -Method Patch -Body $errBody | Out-Null } catch { }
      Write-Log ('Sprzedaz BLAD id={0}: {1}' -f $id, $_.Exception.Message)
    }
  }
}

if (-not (Test-Path $SyncDir)) { New-Item -ItemType Directory -Path $SyncDir | Out-Null }
if (-not (Test-Path $EnvFile)) {
  Write-Log ('BRAK pliku {0}' -f $EnvFile)
  Restore-SyncCulture
  exit 1
}

$envMap = Get-EnvMap $EnvFile
$script:EnvMapSales = $envMap
$SupabaseUrl = $envMap['SUPABASE_URL']
$ServiceKey = $envMap['SUPABASE_SERVICE_ROLE_KEY']
if (-not $SupabaseUrl -or -not $ServiceKey) {
  Write-Log 'Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY'
  Restore-SyncCulture
  exit 1
}
$SupabaseUrl = $SupabaseUrl.TrimEnd('/')

$SqlServer = if ($envMap['WAPRO_SQL_SERVER']) { $envMap['WAPRO_SQL_SERVER'].Trim() } else { 'localhost' }
$SqlDatabase = if ($envMap['WAPRO_SQL_DATABASE']) { $envMap['WAPRO_SQL_DATABASE'].Trim() } else { 'WAPRO' }
Write-Log ('Konfiguracja SQL: serwer={0}, baza={1}' -f $SqlServer, $SqlDatabase)

if ($DiagnoseSalesSchema) {
  $probeSku = if ($DiagnoseSalesSku) { $DiagnoseSalesSku } else { 'SON000083' }
  Invoke-WaproSalesSchemaProbe -Sku $probeSku -SyncDirPath $SyncDir
  Restore-SyncCulture
  exit 0
}

if ($DiagnosePriceSchema) {
  Invoke-WaproPriceSchemaProbe -SyncDirPath $SyncDir
  Restore-SyncCulture
  exit 0
}

if ($DiagnoseSalesSku) {
  Write-Log ('Diagnostyka sprzedazy SKU: {0}' -f $DiagnoseSalesSku)
  Write-Host ('Diagnostyka sprzedazy SKU: {0}' -f $DiagnoseSalesSku)
  try {
    $row = Invoke-WaproSalesQuery -Sku $DiagnoseSalesSku -SyncDirPath $SyncDir -VerboseLog
    Write-Log (
      'Wynik sprzedazy: 1m={0} 3m={1} 6m={2} 12m={3} net12m={4} ostatnia={5}' -f
      $row.qty_1m, $row.qty_3m, $row.qty_6m, $row.qty_12m, $row.net_12m, $row.last_sale_date
    )
    Write-Host (
      'OK: 1m={0} 3m={1} 6m={2} 12m={3} net12m={4} ostatnia={5}' -f
      $row.qty_1m, $row.qty_3m, $row.qty_6m, $row.qty_12m, $row.net_12m, $row.last_sale_date
    )
  } catch {
    Write-Log ('BLAD diagnostyki sprzedazy: {0}' -f $_.Exception.Message)
    Write-Host ('BLAD: {0}' -f $_.Exception.Message)
    Write-Host 'Uruchom probe schematu: -DiagnoseSalesSchema -DiagnoseSalesSku' $DiagnoseSalesSku
    Restore-SyncCulture
    exit 1
  }
  Restore-SyncCulture
  exit 0
}

$headers = @{
  apikey        = $ServiceKey
  Authorization = "Bearer $ServiceKey"
  Accept        = 'application/json'
}
$jsonHeaders = $headers + @{
  'Content-Type' = 'application/json'
  Prefer         = 'return=representation'
}

# --- Zlecenia sync (stany + sprzedaż zbiorcza) ---
$pendingIds = @()
$salesSyncPendingIds = @()
$syncScope = 'all'
if (-not $DiagnoseSku) {
  try {
    $salesSyncUri = '{0}/rest/v1/sales_sync_requests?status=eq.pending&select=id&order=requested_at.asc' -f $SupabaseUrl
    $salesSyncPending = @(Invoke-RestMethod -Uri $salesSyncUri -Headers $headers -Method Get)
    $salesSyncPendingIds = @($salesSyncPending | ForEach-Object { $_.id })
  } catch {
    Write-Log ('Brak tabeli sales_sync_requests lub blad: {0}' -f $_.Exception.Message)
  }

  try {
    $pendingUri = '{0}/rest/v1/stock_sync_requests?status=eq.pending&select=id,catalog&order=requested_at.asc' -f $SupabaseUrl
    $pending = @(Invoke-RestMethod -Uri $pendingUri -Headers $headers -Method Get)
    $pendingIds = @($pending | ForEach-Object { $_.id })
    $scopes = @(
      $pending | ForEach-Object {
        if ($_.catalog -and $_.catalog -ne '') { $_.catalog } else { 'all' }
      } | Select-Object -Unique
    )
    if ($scopes.Count -eq 1 -and $scopes[0] -in @('accessories', 'shop')) {
      $syncScope = $scopes[0]
    } else {
      $syncScope = 'all'
    }
  } catch {
    if ($OnlyIfPending -and $salesSyncPendingIds.Count -eq 0) {
      Write-Log ('Brak tabeli stock_sync_requests lub blad: {0}' -f $_.Exception.Message)
      Restore-SyncCulture
      exit 0
    }
  }

  if ($SalesSyncOnly -or $SalesOnly) {
    try {
      Invoke-SyncWaproSalesBulk -SupabaseUrl $SupabaseUrl -Headers $headers -JsonHeaders $jsonHeaders -SyncDirPath $SyncDir -PendingIds $salesSyncPendingIds | Out-Null
    } catch {
      Restore-SyncCulture
      exit 1
    }
    Restore-SyncCulture
    exit 0
  }

  if ($OnlyIfPending -and $pendingIds.Count -eq 0 -and $salesSyncPendingIds.Count -eq 0) {
    Restore-SyncCulture
    exit 0
  }

  if ($OnlyIfPending -and $pendingIds.Count -eq 0 -and $salesSyncPendingIds.Count -gt 0) {
    try {
      Invoke-SyncWaproSalesBulk -SupabaseUrl $SupabaseUrl -Headers $headers -JsonHeaders $jsonHeaders -SyncDirPath $SyncDir -PendingIds $salesSyncPendingIds | Out-Null
    } catch {
      Restore-SyncCulture
      exit 1
    }
    Restore-SyncCulture
    exit 0
  }

  if ($pendingIds.Count -gt 0) {
    Write-Log ('Zlecenia sync stanow pending: {0}, zakres: {1}' -f $pendingIds.Count, $syncScope)
    $now = (Get-Date).ToUniversalTime().ToString('o')
    foreach ($id in $pendingIds) {
      $body = @{ status = 'running'; started_at = $now } | ConvertTo-Json -Compress
      $uri = '{0}/rest/v1/stock_sync_requests?id=eq.{1}' -f $SupabaseUrl, $id
      try {
        Invoke-RestMethod -Uri $uri -Headers $jsonHeaders -Method Patch -Body $body | Out-Null
      } catch { }
    }
  }
}

if ($DiagnoseSku) {
  Write-Log ('Diagnostyka SKU: {0}' -f $DiagnoseSku)
} else {
  Write-Log ('Start sync WAPRO -> Supabase (zakres: {0})' -f $syncScope)
}

try {
  $tmpRaw = Join-Path $SyncDir 'wapro-stock.raw'
  $csvPath = Join-Path $SyncDir 'wapro-stock.csv'

  $queryStockOnly = @'
SET NOCOUNT ON;
SELECT LTRIM(RTRIM(INDEKS_KATALOGOWY)) AS sku,
       CAST(SUM(COALESCE(STAN, 0)) AS DECIMAL(18, 3)) AS stock
FROM dbo.ARTYKUL
WHERE INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(INDEKS_KATALOGOWY));
'@

  $queryCatalogInfo = @'
SET NOCOUNT ON;
SELECT
       LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) AS sku,
       REPLACE(LTRIM(RTRIM(MAX(a.NAZWA))), ';', ',') AS name,
       REPLACE(LTRIM(RTRIM(MAX(k.NAZWA))), ';', ',') AS manufacturer
FROM dbo.ARTYKUL a WITH (NOLOCK)
LEFT JOIN dbo.KATEGORIA_ARTYKULU k WITH (NOLOCK)
  ON k.ID_KATEGORII = a.ID_KATEGORII
WHERE a.INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(a.INDEKS_KATALOGOWY));
'@

  $priceQueryVariants = @(
    @'
SET NOCOUNT ON;
SELECT LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) AS sku,
       CAST(MAX(COALESCE(NULLIF(wa.CenaNettoZakupu, 0), NULLIF(a.CENA_ZAKUPU_NETTO, 0))) AS DECIMAL(18, 4)) AS price_purchase_net,
       CAST(MAX(COALESCE(NULLIF(wa.PromocyjnaCenaNetto, 0), NULLIF(wa.CenaNettoSprzedazyDomyslna, 0), NULLIF(wa.CenaNettoKGO, 0))) AS DECIMAL(18, 4)) AS price_sale_net,
       CAST(NULL AS DECIMAL(18, 4)) AS price_sale_gross
FROM dbo.ARTYKUL a WITH (NOLOCK)
LEFT JOIN dbo.WIDOK_ARTYKUL wa WITH (NOLOCK)
  ON wa.IdArtykulu = a.ID_ARTYKULU
WHERE a.INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(a.INDEKS_KATALOGOWY));
'@
    @'
SET NOCOUNT ON;
SELECT LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) AS sku,
       CAST(MAX(a.CENA_ZAKUPU_NETTO) AS DECIMAL(18, 4)) AS price_purchase_net,
       CAST(MAX(COALESCE(NULLIF(c.cena_netto_b2b, 0), NULLIF(c.CENA_NETTO, 0), NULLIF(c.cena_netto_b2c, 0), NULLIF(cm.cena_netto_b2b, 0), NULLIF(cm.CENA_NETTO, 0), NULLIF(cm.cena_netto_b2c, 0))) AS DECIMAL(18, 4)) AS price_sale_net,
       CAST(MAX(COALESCE(NULLIF(c.cena_brutto_b2b, 0), NULLIF(c.CENA_BRUTTO, 0), NULLIF(c.cena_brutto_b2c, 0), NULLIF(cm.cena_brutto_b2b, 0), NULLIF(cm.CENA_BRUTTO, 0), NULLIF(cm.cena_brutto_b2c, 0))) AS DECIMAL(18, 4)) AS price_sale_gross
FROM dbo.ARTYKUL a WITH (NOLOCK)
LEFT JOIN dbo.A4BVIEW_CENA_ARTYKULU c WITH (NOLOCK)
  ON c.ID_ARTYKULU = a.ID_ARTYKULU
 AND c.ID_CENY = a.ID_CENY_DOM
LEFT JOIN dbo.A4BVIEW_CENA_ARTYKULU_MIN cm WITH (NOLOCK)
  ON cm.ID_ARTYKULU = a.ID_ARTYKULU
WHERE a.INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(a.INDEKS_KATALOGOWY));
'@
    @'
SET NOCOUNT ON;
SELECT LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) AS sku,
       CAST(MAX(a.CENA_ZAKUPU_NETTO) AS DECIMAL(18, 4)) AS price_purchase_net,
       CAST(MAX(COALESCE(NULLIF(cm.cena_netto_b2b, 0), NULLIF(cm.CENA_NETTO, 0), NULLIF(cm.cena_netto_b2c, 0))) AS DECIMAL(18, 4)) AS price_sale_net,
       CAST(MAX(COALESCE(NULLIF(cm.cena_brutto_b2b, 0), NULLIF(cm.CENA_BRUTTO, 0), NULLIF(cm.cena_brutto_b2c, 0))) AS DECIMAL(18, 4)) AS price_sale_gross
FROM dbo.ARTYKUL a WITH (NOLOCK)
LEFT JOIN dbo.A4BVIEW_CENA_ARTYKULU_MIN cm WITH (NOLOCK)
  ON cm.ID_ARTYKULU = a.ID_ARTYKULU
WHERE a.INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(a.INDEKS_KATALOGOWY));
'@
    @'
SET NOCOUNT ON;
SELECT LTRIM(RTRIM(INDEKS_KATALOGOWY)) AS sku,
       CAST(MAX(CENA_ZAKUPU_NETTO) AS DECIMAL(18, 4)) AS price_purchase_net,
       CAST(MAX(CENA_SPRZEDAZY_NETTO) AS DECIMAL(18, 4)) AS price_sale_net,
       CAST(MAX(CENA_SPRZEDAZY_BRUTTO) AS DECIMAL(18, 4)) AS price_sale_gross
FROM dbo.ARTYKUL
WHERE INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(INDEKS_KATALOGOWY));
'@
    @'
SET NOCOUNT ON;
SELECT LTRIM(RTRIM(INDEKS_KATALOGOWY)) AS sku,
       CAST(MAX(CENA_ZAKUPU) AS DECIMAL(18, 4)) AS price_purchase_net,
       CAST(MAX(CENA_SPRZEDAZY) AS DECIMAL(18, 4)) AS price_sale_net,
       CAST(MAX(CENA_SPRZEDAZY_BRUTTO) AS DECIMAL(18, 4)) AS price_sale_gross
FROM dbo.ARTYKUL
WHERE INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(INDEKS_KATALOGOWY));
'@
    @'
SET NOCOUNT ON;
SELECT LTRIM(RTRIM(INDEKS_KATALOGOWY)) AS sku,
       CAST(MAX(CENA_ZAKUPU_NETTO) AS DECIMAL(18, 4)) AS price_purchase_net,
       CAST(MAX(CENA_SPRZEDAZY_NETTO) AS DECIMAL(18, 4)) AS price_sale_net,
       CAST(NULL AS DECIMAL(18, 4)) AS price_sale_gross
FROM dbo.ARTYKUL
WHERE INDEKS_KATALOGOWY IS NOT NULL
  AND LTRIM(RTRIM(INDEKS_KATALOGOWY)) <> ''
GROUP BY LTRIM(RTRIM(INDEKS_KATALOGOWY));
'@
  )

  if ($envMap['WAPRO_PRICE_SQL']) {
    $priceQueryVariants = @($envMap['WAPRO_PRICE_SQL'].Trim()) + $priceQueryVariants
  }

  $tmpPriceRaw = Join-Path $SyncDir 'wapro-prices.raw'
  $tmpCatalogRaw = Join-Path $SyncDir 'wapro-catalog.raw'
  $catalogJsonPath = Join-Path $SyncDir 'wapro-mag-catalog.json'
  $waproPriceMode = 'tylko-stany'

  $code = Invoke-WaproQuery $queryStockOnly $tmpRaw
  $rawText = ''
  if (Test-Path $tmpRaw) {
    $rawText = [System.IO.File]::ReadAllText($tmpRaw)
  }
  if (Test-SqlExportError $code $rawText) {
    throw ('sqlcmd stany nieudane (kod {0}): {1}' -f $code, ($rawText.Substring(0, [Math]::Min(200, $rawText.Length))))
  }

  # Parsuj export SQL (sku;stock[;ceny…], obsługa też TAB)
  $parseRef = [ref]''
  $parsed = Parse-WaproExportFile $tmpRaw $parseRef
  $rawText = $parseRef.Value
  $stockBySku = $parsed.Map
  $lineNo = $parsed.Lines
  Set-WaproStockMaps $stockBySku

  $catalogInfo = @{}
  $catCode = Invoke-WaproQuery $queryCatalogInfo $tmpCatalogRaw
  $catRaw = ''
  if (Test-Path $tmpCatalogRaw) {
    $catRaw = [System.IO.File]::ReadAllText($tmpCatalogRaw)
  }
  if (Test-SqlExportError $catCode $catRaw) {
    Write-Log ('SQL katalog Mag nieudany (kod {0}) — auto-import uzyje nazw SKU' -f $catCode)
  } else {
    $catalogInfo = Parse-WaproCatalogInfoFile $tmpCatalogRaw
    Write-Log ('SQL katalog Mag: {0} SKU z nazwa/kategoria WAPRO' -f $catalogInfo.Count)
  }

  $priceVariantIdx = 0
  $priceSqlFailures = 0
  $priceSqlMergedAny = $false
  foreach ($pq in $priceQueryVariants) {
    $priceVariantIdx++
    $pCode = Invoke-WaproQuery $pq $tmpPriceRaw
    $pRaw = ''
    if (Test-Path $tmpPriceRaw) {
      $pRaw = [System.IO.File]::ReadAllText($tmpPriceRaw)
    }
    if (Test-SqlExportError $pCode $pRaw) {
      $priceSqlFailures++
      continue
    }
    $priceMap = Parse-WaproPriceOnlyExportFile $tmpPriceRaw
    $merged = Merge-WaproPricesIntoMap $stockBySku $priceMap
    Write-Log ('SQL ceny wariant {0}: {1} SKU z cenami, scalono {2}' -f $priceVariantIdx, $priceMap.Count, $merged)
    if ($merged -gt 0) { $priceSqlMergedAny = $true }
    if (Test-WaproMapHasPrices $stockBySku 80) { break }
  }

  if (-not (Test-WaproMapHasPrices $stockBySku 80)) {
    if ($priceSqlFailures -gt 0 -and -not $priceSqlMergedAny) {
      Write-Log ('Ceny SQL niedostepne w tym schemacie WAPRO ({0} warianty) — uzywam CSV fallback.' -f $priceSqlFailures)
    }
    $csvCandidates = New-Object System.Collections.Generic.List[string]
    if ($envMap['WAPRO_PRICE_CSV']) {
      [void]$csvCandidates.Add($envMap['WAPRO_PRICE_CSV'].Trim())
    }
    [void]$csvCandidates.Add((Join-Path $SyncDir 'wapro-prices.csv'))
    # Pełny eksport z PC (python enrich-shop-prices-from-wapro.py → data/wapro-stock.csv)
    [void]$csvCandidates.Add((Join-Path $SyncDir 'wapro-stock.csv'))
    $csvMerged = Merge-WaproPricesFromCsvCandidates $stockBySku $csvCandidates
    if ($csvMerged -le 0) {
      Write-Log 'Ceny CSV: zadnego dopasowania — skopiuj wapro-stock.csv z PC do C:\katalog-sync\ (po enrich-shop-prices-from-wapro.py)'
    }
  }

  if (Test-WaproMapHasPrices $stockBySku 80) {
    $waproPriceMode = 'stany+ceny'
  } else {
    Write-Log 'UWAGA: brak cen w mapie WAPRO — sync uzupelni tylko stany. Ustaw WAPRO_PRICE_SQL / skopiuj wapro-prices.csv (z XLS) do C:\katalog-sync\'
  }

  $catalogRows = Write-WaproMagCatalogJson $stockBySku $catalogInfo $catalogJsonPath
  Write-Log ('WAPRO katalog Mag JSON: {0} SKU -> {1}' -f $catalogRows, $catalogJsonPath)

  if ($DiagnoseSku) {
    $dSku = $DiagnoseSku.Trim().ToUpperInvariant()
    $row = Get-WaproRow $dSku
    if ($null -eq $row) {
      Write-Log ("DiagnoseSku '{0}': brak w mapie WAPRO ({1} SKU). Sprawdz INDEKS_KATALOGOWY w Mag." -f $dSku, $stockBySku.Count)
    } else {
      Write-Log ("DiagnoseSku '{0}': stock={1}, zakup={2}, netto={3}, brutto={4}" -f `
          $dSku, $row.stock, $row.price_purchase_net, $row.price_sale_net, $row.price_sale_gross)
    }
    Restore-SyncCulture
    exit 0
  }

  Write-Log ('Wczytano {0} SKU z WAPRO (linie raw: {1})' -f $stockBySku.Count, $lineNo)
  if ($stockBySku.Count -eq 0) {
    $preview = if ($rawText.Length -gt 300) { $rawText.Substring(0, 300) } else { $rawText }
    throw ('Brak SKU po eksporcie SQL — sprawdz wapro-stock.raw. Podglad: {0}' -f $preview)
  }

  # Debug CSV (opcjonalny podgląd)
  $csvLines = New-Object System.Collections.Generic.List[string]
  [void]$csvLines.Add('sku;stock;price_purchase_net;price_sale_net;price_sale_gross')
  foreach ($sku in ($stockBySku.Keys | Sort-Object)) {
    $r = $stockBySku[$sku]
    $b = if ($null -eq $r.price_purchase_net) { '' } else { $r.price_purchase_net }
    $sn = if ($null -eq $r.price_sale_net) { '' } else { $r.price_sale_net }
    $g = if ($null -eq $r.price_sale_gross) { '' } else { $r.price_sale_gross }
    [void]$csvLines.Add(('{0};{1};{2};{3};{4}' -f $sku, $r.stock, $b, $sn, $g))
  }
  Write-Utf8NoBom $csvPath $csvLines.ToArray()

  $sample = ($stockBySku.Keys | Select-Object -First 3) -join ', '
  Write-Log ('Przyklad SKU: {0}' -f $sample)

  $products = New-Object System.Collections.Generic.List[object]
  $from = 0
  $page = 1000
  do {
    if ($syncScope -eq 'accessories' -or $syncScope -eq 'shop') {
      $uri = '{0}/rest/v1/products?catalog=eq.{1}&select=id,sku,name,display_name,stock,stock_manual,is_group,variants,price_purchase_net,price_sale_net,price_sale_gross,catalog,product_meta&offset={2}&limit={3}&order=id' -f $SupabaseUrl, $syncScope, $from, $page
    } else {
      $uri = '{0}/rest/v1/products?select=id,sku,name,display_name,stock,stock_manual,is_group,variants,price_purchase_net,price_sale_net,price_sale_gross,catalog,product_meta&offset={1}&limit={2}&order=id' -f $SupabaseUrl, $from, $page
    }
    $batch = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    if ($null -eq $batch) { break }
    $arr = @($batch)
    if ($arr.Count -eq 0) { break }
    foreach ($p in $arr) { $products.Add($p) }
    if ($arr.Count -lt $page) { break }
    $from += $page
  } while ($true)

  Write-Log ('Pobrano {0} produktow z Supabase (zakres {1})' -f $products.Count, $syncScope)

  $updated = 0
  $skippedManual = 0
  $skippedMissing = 0
  $unchanged = 0
  $pricesFilled = 0
  $linkedViaAlt = 0
  $bootstrapped = 0
  $warnings = 0
  $unmatchedProducts = New-Object System.Collections.Generic.List[object]
  $patchHeaders = $headers + @{
    'Content-Type' = 'application/json'
    Prefer         = 'return=minimal'
  }

  foreach ($p in $products) {
    if ($p.is_group -eq $true -and $p.variants) {
      $variants = @($p.variants)
      $touched = $false
      $priceBuy = $null
      $priceSale = $null
      $priceGross = $null
      $next = foreach ($v in $variants) {
        $vsku = ([string]$v.sku).Trim().ToUpperInvariant()
        $row = Get-WaproRow $vsku
        if ($null -ne $row) {
          $touched = $true
          if ($p.stock_manual -ne $true) {
            $v | Add-Member -NotePropertyName stock -NotePropertyValue $row.stock -Force
          }
          if ($null -ne $row.price_purchase_net) { $priceBuy = $row.price_purchase_net }
          if ($null -ne $row.price_sale_net) { $priceSale = $row.price_sale_net }
          if ($null -ne $row.price_sale_gross) { $priceGross = $row.price_sale_gross }
        }
        $v
      }
      if (-not $touched) {
        $skippedMissing++
        if (Test-LikelyPlaceholderSku $p.sku) { $warnings++ }
        [void]$unmatchedProducts.Add([ordered]@{
          id = [string]$p.id
          sku = [string]$p.sku
          catalog = [string]$p.catalog
          name = if ($p.display_name) { [string]$p.display_name } else { [string]$p.name }
          reason = 'group variants not found in WAPRO'
        })
        continue
      }
      $payload = @{}
      $changed = $false
      if ($p.stock_manual -eq $true) {
        $skippedManual++
      } else {
        $sum = 0.0
        foreach ($v in $next) { $sum += [double]$v.stock }
        $payload.stock = $sum
        $payload.variants = @($next)
        $changed = $true
      }
      if (Test-PriceShouldSet $p.price_purchase_net $priceBuy) {
        $payload.price_purchase_net = $priceBuy
        $changed = $true
        $pricesFilled++
      }
      if (Test-PriceShouldSet $p.price_sale_net $priceSale) {
        $payload.price_sale_net = $priceSale
        $changed = $true
        $pricesFilled++
      }
      if (Test-PriceShouldSet $p.price_sale_gross $priceGross) {
        $payload.price_sale_gross = $priceGross
        $changed = $true
        $pricesFilled++
      }
      if (-not $changed) { $unchanged++; continue }
      if (Test-ProductNeedsWaproBootstrap $p) { $bootstrapped++ }
      $body = $payload | ConvertTo-Json -Depth 8 -Compress
      $patchUri = '{0}/rest/v1/products?id=eq.{1}' -f $SupabaseUrl, $p.id
      Invoke-RestMethod -Uri $patchUri -Headers $patchHeaders -Method Patch -Body $body | Out-Null
      $updated++
      continue
    }

    $resolved = Resolve-WaproRowForProduct $p
    if ($null -eq $resolved) {
      $skippedMissing++
      if (Test-LikelyPlaceholderSku $p.sku) { $warnings++ }
      [void]$unmatchedProducts.Add([ordered]@{
        id = [string]$p.id
        sku = [string]$p.sku
        catalog = [string]$p.catalog
        name = if ($p.display_name) { [string]$p.display_name } else { [string]$p.name }
        reason = if (Test-LikelyPlaceholderSku $p.sku) { 'placeholder SKU not found in WAPRO' } else { 'SKU not found in WAPRO' }
      })
      continue
    }
    $row = $resolved.Row
    if ($resolved.ViaAlt) { $linkedViaAlt++ }
    $payload = @{}
    $changed = $false
    $bootstrap = Test-ProductNeedsWaproBootstrap $p

    if ($p.stock_manual -eq $true) {
      $skippedManual++
    } else {
      $oldStock = 0.0
      [void][double]::TryParse(
        ([string]$p.stock).Replace(',', '.'),
        [System.Globalization.NumberStyles]::Any,
        [System.Globalization.CultureInfo]::InvariantCulture,
        [ref]$oldStock
      )
      if ($bootstrap -or [Math]::Abs($oldStock - [double]$row.stock) -gt 0.0005) {
        $payload.stock = $row.stock
        $changed = $true
      }
    }

    if ($null -ne $row.price_purchase_net) {
      if (Test-PriceShouldSet $p.price_purchase_net $row.price_purchase_net) {
        $payload.price_purchase_net = $row.price_purchase_net
        $changed = $true
        $pricesFilled++
      }
    }
    if ($null -ne $row.price_sale_net) {
      if (Test-PriceShouldSet $p.price_sale_net $row.price_sale_net) {
        $payload.price_sale_net = $row.price_sale_net
        $changed = $true
        $pricesFilled++
      }
    }
    if ($null -ne $row.price_sale_gross) {
      if (Test-PriceShouldSet $p.price_sale_gross $row.price_sale_gross) {
        $payload.price_sale_gross = $row.price_sale_gross
        $changed = $true
        $pricesFilled++
      }
    }

    if (-not $changed) { $unchanged++; continue }
    if ($bootstrap) { $bootstrapped++ }
    $body = $payload | ConvertTo-Json -Compress
    $patchUri = '{0}/rest/v1/products?id=eq.{1}' -f $SupabaseUrl, $p.id
    Invoke-RestMethod -Uri $patchUri -Headers $patchHeaders -Method Patch -Body $body | Out-Null
    $updated++
  }

  $unmatchedNote = ''
  if ($unmatchedProducts.Count -gt 0) {
    $unmatchedReport = Write-UnmatchedWaproReport $unmatchedProducts $SyncDir
    Write-Log ('Raport brakow WAPRO: {0} pozycji -> {1}' -f $unmatchedProducts.Count, $unmatchedReport.csv)
    $unmatchedNote = ', raport brakow: sync-unmatched-products.csv'
  }

  $msg = 'Tryb WAPRO: {0}. Zakres: {1}. Zaktualizowano: {2}, bez zmian: {3}, reczne stan: {4}, brak w WAPRO: {5}, uzupelnione pola cen: {6}, SKU z SQL: {7}, dopasowane po legacy/alt SKU: {8}, odkryte (pierwsze stany/ceny): {9}, ostrzezenia: {10}{11}' -f `
    $waproPriceMode, $syncScope, $updated, $unchanged, $skippedManual, $skippedMissing, $pricesFilled, $stockBySku.Count, $linkedViaAlt, $bootstrapped, $warnings, $unmatchedNote

  $importResult = Invoke-WaproMagAutoImport -SupabaseUrl $SupabaseUrl -ServiceKey $ServiceKey -SyncDirPath $SyncDir -EnvMap $envMap
  if ($importResult.inserted -gt 0) {
    $msg = '{0}, nowe SKU z Mag: {1}' -f $msg, $importResult.inserted
  } elseif ($importResult.note -and $importResult.note -ne 'ok') {
    Write-Log ("WAPRO auto-import pominiety: {0}" -f $importResult.note)
  }

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

  $runSalesAfterStock = $envMap['WAPRO_RUN_SALES_AFTER_STOCK'] -eq '1'
  if ($salesSyncPendingIds.Count -gt 0 -and $runSalesAfterStock) {
    try {
      Invoke-SyncWaproSalesBulk -SupabaseUrl $SupabaseUrl -Headers $headers -JsonHeaders $jsonHeaders -SyncDirPath $SyncDir -PendingIds $salesSyncPendingIds | Out-Null
    } catch {
      Write-Log ('Bulk sprzedaz po sync stanow BLAD: {0}' -f $_.Exception.Message)
    }
  } elseif ($salesSyncPendingIds.Count -gt 0) {
    Write-Log ('Sync sprzedazy pominiety przy syncu katalogu ({0} pending). Uruchom osobno -SalesSyncOnly.' -f $salesSyncPendingIds.Count)
  }
}
catch {
  Write-Log ('BLAD: {0}' -f $_.Exception.Message)
  Write-Log ('BLAD type: {0}' -f $_.Exception.GetType().FullName)
  if ($_.InvocationInfo) {
    Write-Log ('BLAD line: {0}' -f $_.InvocationInfo.ScriptLineNumber)
    Write-Log ('BLAD command: {0}' -f ($_.InvocationInfo.Line -replace '\s+', ' ').Trim())
  }
  if ($_.ScriptStackTrace) {
    Write-Log ('BLAD stack: {0}' -f ($_.ScriptStackTrace -replace '\r?\n', ' | '))
  }
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
  Restore-SyncCulture
  exit 1
}
finally {
  Restore-SyncCulture
}
