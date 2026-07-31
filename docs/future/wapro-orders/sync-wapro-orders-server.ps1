#Requires -Version 5.1
<#
.SYNOPSIS
  Katalog → WAPRO Mag: tworzy zamówienie od odbiorcy (ZO) po indeksie katalogowym = SKU.

.SETUP
  1. Skopiuj do C:\katalog-sync\sync-wapro-orders-server.ps1
  2. Uzupełnij katalog-sync.env (patrz example)
  3. Uruchom migrację supabase/migration-wapro-order-requests.sql
  4. Harmonogram co 1–2 min: -OnlyIfPending
     (można ten sam cykl co sync stanów)

.NOTES
  Mapowanie jak WFSync: SKU katalogu = INDEKS_KATALOGOWY w Mag.
  Domyślnie ZO w buforze (TRYBREJESTRACJI=10), bez rezerwacji.
#>
param(
  [switch]$OnlyIfPending
)

$ErrorActionPreference = 'Stop'
$SyncDir = 'C:\katalog-sync'
$EnvFile = Join-Path $SyncDir 'katalog-sync.env'
$LogFile = Join-Path $SyncDir 'orders.log'
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

function Write-Utf8NoBom([string]$path, [string]$text) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($path, $text, $utf8)
}

function Invoke-SqlText([string]$query) {
  $tmp = Join-Path $SyncDir ('order-sql-{0}.txt' -f [guid]::NewGuid().ToString('N'))
  try {
    & sqlcmd -S $SqlServer -d $SqlDatabase -E -W -h-1 -f 65001 -Q $query -o $tmp
    $code = $LASTEXITCODE
    $text = ''
    if (Test-Path $tmp) { $text = [System.IO.File]::ReadAllText($tmp) }
    return @{ Code = $code; Text = $text }
  } finally {
    if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
  }
}

function Escape-SqlLiteral([string]$s) {
  if ($null -eq $s) { return '' }
  return ($s -replace "'", "''")
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

$idFirmy = 0; [void][int]::TryParse($envMap['WAPRO_ORDER_ID_FIRMY'], [ref]$idFirmy)
$idMag = 0; [void][int]::TryParse($envMap['WAPRO_ORDER_ID_MAGAZYNU'], [ref]$idMag)
$idUser = 0; [void][int]::TryParse($envMap['WAPRO_ORDER_ID_UZYTKOWNIKA'], [ref]$idUser)
$idKontrDefault = 0; [void][int]::TryParse($envMap['WAPRO_ORDER_ID_KONTRAHENTA'], [ref]$idKontrDefault)
$buffer = ($envMap['WAPRO_ORDER_BUFFER'] -ne '0')
$reserve = ($envMap['WAPRO_ORDER_RESERVE'] -eq '1')
$bruttoNetto = if ($envMap['WAPRO_ORDER_BRUTTO_NETTO']) { $envMap['WAPRO_ORDER_BRUTTO_NETTO'] } else { 'Netto' }

if ($idFirmy -le 0 -or $idMag -le 0 -or $idUser -le 0 -or $idKontrDefault -le 0) {
  Write-Log 'Uzupelnij WAPRO_ORDER_ID_FIRMY / ID_MAGAZYNU / ID_UZYTKOWNIKA / ID_KONTRAHENTA w katalog-sync.env'
  exit 1
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

$pendingUri = '{0}/rest/v1/wapro_order_requests?status=eq.pending&select=id,payload,requested_at&order=requested_at.asc&limit=5' -f $SupabaseUrl
try {
  $pending = @(Invoke-RestMethod -Uri $pendingUri -Headers $headers -Method Get)
} catch {
  if ($OnlyIfPending) {
    Write-Log ('Brak tabeli wapro_order_requests lub blad: {0}' -f $_.Exception.Message)
    exit 0
  }
  throw
}

if ($pending.Count -eq 0) {
  if ($OnlyIfPending) { exit 0 }
  Write-Log 'Brak pending zamowien'
  exit 0
}

$tryb = if ($buffer) { 10 } else { 0 }

foreach ($req in $pending) {
  $id = [string]$req.id
  Write-Log ('Start zamowienia {0}' -f $id)
  $now = (Get-Date).ToUniversalTime().ToString('o')
  try {
    $bodyRun = @{ status = 'running'; started_at = $now } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri ('{0}/rest/v1/wapro_order_requests?id=eq.{1}' -f $SupabaseUrl, $id) `
      -Headers $jsonHeaders -Method Patch -Body $bodyRun | Out-Null
  } catch { }

  try {
    $payload = $req.payload
    if ($payload -is [string]) { $payload = $payload | ConvertFrom-Json }
    $items = @($payload.items)
    if ($items.Count -eq 0) { throw 'Pusty koszyk' }

    $clientName = [string]$payload.clientName
    $clientNip = ([string]$payload.clientNip) -replace '\D', ''
    $note = [string]$payload.note

    # Kontrahent po NIP albo domyslny
    $idKontr = $idKontrDefault
    if ($clientNip.Length -eq 10) {
      $qKontr = @"
SET NOCOUNT ON;
SELECT TOP 1 CAST(ID_KONTRAHENTA AS varchar(30))
FROM dbo.KONTRAHENT
WHERE REPLACE(REPLACE(ISNULL(NIP,''),'-',''),' ','') = '$clientNip';
"@
      $rKontr = Invoke-SqlText $qKontr
      $line = ($rKontr.Text -split "`r?`n" | Where-Object { $_.Trim() -match '^\d+$' } | Select-Object -First 1)
      if ($line) { $idKontr = [int]$line.Trim() }
    }

    # Walidacja SKU → ID_ARTYKULU
    $resolved = @()
    $missing = New-Object System.Collections.Generic.List[string]
    foreach ($it in $items) {
      $sku = ([string]$it.sku).Trim().ToUpperInvariant()
      if (-not $sku) { continue }
      $skuEsc = Escape-SqlLiteral $sku
      $qArt = @"
SET NOCOUNT ON;
SELECT TOP 1
  CAST(a.ID_ARTYKULU AS varchar(30)) + '|' +
  ISNULL(NULLIF(LTRIM(RTRIM(CAST(ISNULL(v.SYMBOL, ISNULL(v.KOD, a.VAT)) AS varchar(10)))), ''), '23') + '|' +
  ISNULL(NULLIF(LTRIM(RTRIM(j.JEDNOSTKA)), ''), 'szt') + '|' +
  REPLACE(CAST(ISNULL(j.PRZELICZNIK, 1) AS varchar(32)), ',', '.') + '|' +
  REPLACE(CAST(ISNULL(a.CENA_SPRZEDAZY_NETTO, 0) AS varchar(32)), ',', '.') + '|' +
  REPLACE(CAST(ISNULL(a.CENA_SPRZEDAZY_BRUTTO, 0) AS varchar(32)), ',', '.')
FROM dbo.ARTYKUL a
LEFT JOIN dbo.VAT v ON v.ID_VAT = a.ID_VAT
OUTER APPLY (
  SELECT TOP 1 jed.JEDNOSTKA, jed.PRZELICZNIK
  FROM dbo.JEDNOSTKA jed
  WHERE jed.ID_ARTYKULU = a.ID_ARTYKULU
  ORDER BY jed.ID_JEDNOSTKI
) j
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = '$skuEsc';
"@
      $rArt = Invoke-SqlText $qArt
      $artLine = ($rArt.Text -split "`r?`n" | Where-Object { $_ -match '\|' } | Select-Object -First 1)
      if (-not $artLine -or $rArt.Text -match 'Invalid column|Msg \d+') {
        # Fallback: ID + ceny z ARTYKUL (bez VAT/jednostki)
        $qArt2 = @"
SET NOCOUNT ON;
SELECT TOP 1
  CAST(ID_ARTYKULU AS varchar(30)) + '|23|szt|1|' +
  REPLACE(CAST(ISNULL(CENA_SPRZEDAZY_NETTO, 0) AS varchar(32)), ',', '.') + '|' +
  REPLACE(CAST(ISNULL(CENA_SPRZEDAZY_BRUTTO, 0) AS varchar(32)), ',', '.')
FROM dbo.ARTYKUL
WHERE LTRIM(RTRIM(INDEKS_KATALOGOWY)) = '$skuEsc';
"@
        $rArt2 = Invoke-SqlText $qArt2
        $artLine = ($rArt2.Text -split "`r?`n" | Where-Object { $_ -match '\|' } | Select-Object -First 1)
        if (-not $artLine -or $rArt2.Text -match 'Invalid column|Msg \d+') {
          $qArt3 = @"
SET NOCOUNT ON;
SELECT TOP 1 CAST(ID_ARTYKULU AS varchar(30))
FROM dbo.ARTYKUL
WHERE LTRIM(RTRIM(INDEKS_KATALOGOWY)) = '$skuEsc';
"@
          $rArt3 = Invoke-SqlText $qArt3
          $idOnly = ($rArt3.Text -split "`r?`n" | Where-Object { $_.Trim() -match '^\d+$' } | Select-Object -First 1)
          if (-not $idOnly) {
            $missing.Add($sku)
            continue
          }
          $artLine = '{0}|23|szt|1|0|0' -f $idOnly.Trim()
        }
      }
      $parts = $artLine.Trim().Split('|')
      $qty = 1.0
      [void][double]::TryParse(
        ([string]$it.qty).Replace(',', '.'),
        [System.Globalization.NumberStyles]::Any,
        [System.Globalization.CultureInfo]::InvariantCulture,
        [ref]$qty
      )
      if ($qty -le 0) { $qty = 1 }
      $net = $null; $gross = $null; $disc = 0.0
      $magNet = $null; $magGross = $null
      if ($parts.Length -ge 6) {
        [void][double]::TryParse($parts[4], [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$magNet)
        [void][double]::TryParse($parts[5], [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$magGross)
      }
      if ($null -ne $it.priceSaleNet) {
        [void][double]::TryParse(([string]$it.priceSaleNet).Replace(',', '.'), [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$net)
      }
      if ($null -ne $it.priceSaleGross) {
        [void][double]::TryParse(([string]$it.priceSaleGross).Replace(',', '.'), [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$gross)
      }
      if ($null -eq $net -and $null -ne $magNet) { $net = $magNet }
      if ($null -eq $gross -and $null -ne $magGross) { $gross = $magGross }
      if ($null -ne $it.discountPercent) {
        [void][double]::TryParse(([string]$it.discountPercent).Replace(',', '.'), [System.Globalization.NumberStyles]::Any, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$disc)
      }
      $resolved += [pscustomobject]@{
        Sku      = $sku
        IdArt    = [int]$parts[0]
        Vat      = $parts[1]
        Jednostka = $parts[2]
        Przel    = $parts[3]
        Qty      = $qty
        Net      = $net
        Gross    = $gross
        Disc     = $disc
        Name     = [string]$it.displayName
      }
    }

    if ($missing.Count -gt 0) {
      throw ('Brak w WAPRO (INDEKS_KATALOGOWY): {0}' -f ($missing -join ', '))
    }
    if ($resolved.Count -eq 0) { throw 'Brak pozycji do importu' }

    $opisEsc = Escape-SqlLiteral (("Katalog: {0}. {1}" -f $clientName, $note).Trim().Substring(0, [Math]::Min(500, (("Katalog: {0}. {1}" -f $clientName, $note).Trim().Length))))
    $bnEsc = Escape-SqlLiteral $bruttoNetto

    # Budowa skryptu T-SQL tworzącego ZO
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine('SET NOCOUNT ON; SET XACT_ABORT ON;')
    [void]$sb.AppendLine('BEGIN TRAN;')
    [void]$sb.AppendLine('DECLARE @id_zam NUMERIC(18,0);')
    [void]$sb.AppendLine('DECLARE @data INT = ROUND(CONVERT(real, GETDATE()), 0) + 36163;')
    [void]$sb.AppendLine(('DECLARE @tryb TINYINT = {0};' -f $tryb))
    [void]$sb.AppendLine(@"
EXEC dbo.RM_DodajZamowienie_Server
  $idFirmy, $idKontr, $idMag,
  1, @data, $idUser,
  @tryb, '$bnEsc', 1, @id_zam OUTPUT, 1;
"@)
    [void]$sb.AppendLine('IF @id_zam IS NULL OR @id_zam = 0 BEGIN ROLLBACK; RAISERROR(''RM_DodajZamowienie_Server nie zwrocil ID'', 16, 1); RETURN; END;')
    if ($opisEsc) {
      [void]$sb.AppendLine(("UPDATE dbo.ZAMOWIENIE SET UWAGI = LEFT(ISNULL(UWAGI,'') + ' {0}', 500) WHERE ID_ZAMOWIENIA = @id_zam;" -f $opisEsc))
    }

    foreach ($r in $resolved) {
      $cenaNet = if ($null -ne $r.Net) { $r.Net.ToString([System.Globalization.CultureInfo]::InvariantCulture) } else { '0' }
      $cenaBru = if ($null -ne $r.Gross) { $r.Gross.ToString([System.Globalization.CultureInfo]::InvariantCulture) } else { $cenaNet }
      $qtyS = $r.Qty.ToString([System.Globalization.CultureInfo]::InvariantCulture)
      $przel = $r.Przel
      $jed = Escape-SqlLiteral $r.Jednostka
      $vat = Escape-SqlLiteral $r.Vat
      $doRez = if ($reserve) { $qtyS } else { '0' }
      $narzut = if ($r.Disc -gt 0) { $r.Disc.ToString([System.Globalization.CultureInfo]::InvariantCulture) } else { '0' }
      $znak = if ($r.Disc -gt 0) { 2 } else { 0 }
      $opisPoz = Escape-SqlLiteral $r.Name
      [void]$sb.AppendLine(@"
EXEC dbo.RM_DodajPozycjeZamowienia_Server
  0, @id_zam, $($r.IdArt),
  '$vat', $qtyS, 0,
  0, $doRez, $cenaNet,
  $cenaBru, 0, 0,
  $przel, '$jed', $narzut,
  '$opisPoz', $znak, @tryb, 0, 0;
"@)
    }

    [void]$sb.AppendLine('DECLARE @sn DECIMAL(16,6), @sb DECIMAL(16,6), @snw DECIMAL(16,2), @sbw DECIMAL(16,2);')
    [void]$sb.AppendLine('EXEC dbo.RM_SumujZamowienie_Server @id_zam, @sn OUTPUT, @sb OUTPUT, @snw OUTPUT, @sbw OUTPUT;')
    # Numeracja + zatwierdzenie — w buforze często wystarczy suma; pełne zatwierdzenie opcjonalne
    if (-not $buffer) {
      [void]$sb.AppendLine(@"
DECLARE @fmt varchar(100), @okres int, @p1 int, @p2 int, @numer int;
EXEC dbo.JL_PobierzFormatNumeracji_Server $idFirmy, 'ZAM', 0, $idMag, @fmt OUTPUT, @okres OUTPUT, @p1 OUTPUT, @p2 OUTPUT;
-- RM_ZatwierdzZamowienie — sygnatura zalezna od wersji Mag; bufor jest bezpieczniejszy na start
"@)
    }
    [void]$sb.AppendLine('COMMIT;')
    [void]$sb.AppendLine('SELECT CAST(@id_zam AS varchar(30));')

    $sqlPath = Join-Path $SyncDir 'last-order.sql'
    Write-Utf8NoBom $sqlPath $sb.ToString()
    $exec = Invoke-SqlText $sb.ToString()
    if ($exec.Code -ne 0 -or $exec.Text -match 'Msg \d+|RAISERROR|Error') {
      throw ('SQL blad: {0}' -f ($exec.Text.Substring(0, [Math]::Min(500, $exec.Text.Length))))
    }
    $orderIdLine = ($exec.Text -split "`r?`n" | Where-Object { $_.Trim() -match '^\d+$' } | Select-Object -Last 1)
    if (-not $orderIdLine) {
      throw ('Brak ID zamowienia w odpowiedzi SQL: {0}' -f ($exec.Text.Substring(0, [Math]::Min(300, $exec.Text.Length))))
    }
    $waproId = $orderIdLine.Trim()

    $msg = 'ZO utworzone w Mag (ID {0}), pozycji {1}, kontrahent {2}' -f $waproId, $resolved.Count, $idKontr
    Write-Log $msg
    $doneBody = @{
      status             = 'done'
      finished_at        = (Get-Date).ToUniversalTime().ToString('o')
      message            = $msg
      wapro_order_id     = [decimal]$waproId
      wapro_order_number = $waproId
    } | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri ('{0}/rest/v1/wapro_order_requests?id=eq.{1}' -f $SupabaseUrl, $id) `
      -Headers $jsonHeaders -Method Patch -Body $doneBody | Out-Null
  } catch {
    $err = $_.Exception.Message
    Write-Log ('Blad zamowienia {0}: {1}' -f $id, $err)
    $errBody = @{
      status      = 'error'
      finished_at = (Get-Date).ToUniversalTime().ToString('o')
      message     = $err
    } | ConvertTo-Json -Compress
    try {
      Invoke-RestMethod -Uri ('{0}/rest/v1/wapro_order_requests?id=eq.{1}' -f $SupabaseUrl, $id) `
        -Headers $jsonHeaders -Method Patch -Body $errBody | Out-Null
    } catch { }
  }
}

Write-Log 'Koniec kolejki zamowien'
