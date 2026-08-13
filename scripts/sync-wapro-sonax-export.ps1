#Requires -Version 5.1
<#
.SYNOPSIS
  Eksport faktur WAPRO Mag od 2026-03-01 (analiza Sonax).

  Skopiuj do C:\katalog-sync\ i uruchom:
  powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-sonax-export.ps1
#>
param(
  [switch]$DiagnoseSchema,
  [string]$FromDate = '2026-03-01'
)

$ErrorActionPreference = 'Stop'
$SyncDir = 'C:\katalog-sync'
$ExportDir = Join-Path $SyncDir 'sonax-export'
$LogFile = Join-Path $SyncDir 'sonax-export.log'
$SqlServer = 'localhost'
$SqlDatabase = 'WAPRO'

function Write-Log([string]$msg) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  if (-not (Test-Path $SyncDir)) { New-Item -ItemType Directory -Path $SyncDir | Out-Null }
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Invoke-WaproQuery([string]$query, [string]$outFile) {
  if (Test-Path $outFile) { Remove-Item $outFile -Force }
  & sqlcmd -S $SqlServer -d $SqlDatabase -E -W -h-1 -s "`t" -f 65001 -Q $query -o $outFile
  return $LASTEXITCODE
}

function Test-SqlExportError([int]$code, [string]$text) {
  if ($code -ne 0) { return $true }
  if ($text -match '(?i)Msg \d+|Invalid column|Invalid object name') { return $true }
  return $false
}

function New-SonaxFromDecl([string]$fromDate) {
  $fromEsc = $fromDate.Replace("'", "''")
  return "DECLARE @from int = CAST(CAST(CAST('$fromEsc' AS date) AS datetime) AS int) + 36163;"
}

function Get-InvoiceQueryVariants([string]$fromDate) {
  $fromDecl = New-SonaxFromDecl $fromDate
  $variants = New-Object System.Collections.Generic.List[hashtable]

  # UWAGA: nie uzywac ISNULL(kolA, kolB) gdy kolA moze nie istniec — SQL Server i tak ja waliduje.
  $numerExprs = @(
    @{ Name = 'numer'; Select = 'LTRIM(RTRIM(CAST(dh.NUMER AS varchar(80))))'; Group = 'LTRIM(RTRIM(CAST(dh.NUMER AS varchar(80))))' },
    @{ Name = 'id_dok'; Select = 'CAST(dh.ID_DOKUMENTU_HANDLOWEGO AS varchar(20))'; Group = 'CAST(dh.ID_DOKUMENTU_HANDLOWEGO AS varchar(20))' }
  )
  $joinKeys = @(
    @{ Name = 'id_kontrahent'; Expr = 'dh.ID_KONTRAHENTA' },
    @{ Name = 'id_platnik'; Expr = 'dh.ID_PLATNIKA' }
  )
  $nameExprs = @(
    @{ Name = 'nazwa'; Select = 'LTRIM(RTRIM(k.NAZWA))'; Group = 'LTRIM(RTRIM(k.NAZWA))' }
  )
  $dateCols = @('DATA_WYSTAWIENIA', 'DATA_SPRZEDAZY')
  $pdJoins = @(
    @{ Name = 'pd_id_dok_hand'; On = 'dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO' },
    @{ Name = 'pd_id_dokument'; On = 'dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOKUMENTU_HANDLOWEGO' }
  )
  $netExprs = @(
    @{ Name = 'cena'; Sql = 'CAST(SUM(pd.ILOSC * ISNULL(pd.CENA_NETTO, 0)) AS DECIMAL(18, 2))' },
    @{ Name = 'wart'; Sql = 'CAST(SUM(ISNULL(pd.WARTOSC_NETTO, 0)) AS DECIMAL(18, 2))' }
  )
  $rodzajFilters = @(
    @{ Name = 'rodzaj_r'; Sql = "  AND pd.RODZAJ_POZYCJI = 'R'`n" },
    @{ Name = 'bez_rodzaj'; Sql = '' }
  )

  foreach ($pj in $pdJoins) {
    foreach ($jk in $joinKeys) {
      foreach ($ne in $nameExprs) {
        foreach ($num in $numerExprs) {
          foreach ($dc in $dateCols) {
            foreach ($net in $netExprs) {
              foreach ($rf in $rodzajFilters) {
                $label = ('pd_{0}_{1}_{2}_{3}_{4}_{5}_{6}' -f $pj.Name, $jk.Name, $ne.Name, $num.Name, $dc, $net.Name, $rf.Name)
                $query = @"
SET NOCOUNT ON;
$fromDecl
SELECT
  CAST(dh.$dc AS varchar(12)) AS data_int,
  $($num.Select) AS numer,
  $($ne.Select) AS kontrahent,
  REPLACE(REPLACE(REPLACE(ISNULL(k.NIP, ''), '-', ''), ' ', ''), '.', '') AS nip,
  $($net.Sql) AS netto,
  $($net.Sql) AS brutto_proxy
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON $($pj.On)
LEFT JOIN dbo.KONTRAHENT k WITH (NOLOCK)
  ON k.ID_KONTRAHENTA = $($jk.Expr)
$($rf.Sql)  AND dh.$dc >= @from
GROUP BY dh.ID_DOKUMENTU_HANDLOWEGO, dh.$dc, $($num.Group), $($ne.Group), k.NIP
ORDER BY dh.$dc;
"@
                [void]$variants.Add(@{ Name = $label; Query = $query })
              }
            }
          }
        }
      }
    }
  }

  # Naglowki DH (bez pozycji) — tylko jesli kolumny wartosci istnieja
  $headerNetCols = @(
    @{ Name = 'wart_netto'; Net = 'CAST(ISNULL(dh.WARTOSC_NETTO, 0) AS DECIMAL(18, 2))'; Br = 'CAST(ISNULL(dh.WARTOSC_BRUTTO, 0) AS DECIMAL(18, 2))' },
    @{ Name = 'wart'; Net = 'CAST(ISNULL(dh.WARTOSC, 0) AS DECIMAL(18, 2))'; Br = 'CAST(ISNULL(dh.WARTOSC, 0) AS DECIMAL(18, 2))' }
  )
  foreach ($jk in $joinKeys) {
    foreach ($ne in $nameExprs) {
      foreach ($num in $numerExprs) {
        foreach ($dc in $dateCols) {
          foreach ($hn in $headerNetCols) {
            $label = ('hdr_{0}_{1}_{2}_{3}_{4}' -f $jk.Name, $ne.Name, $num.Name, $dc, $hn.Name)
            $query = @"
SET NOCOUNT ON;
$fromDecl
SELECT
  CAST(dh.$dc AS varchar(12)) AS data_int,
  $($num.Select) AS numer,
  $($ne.Select) AS kontrahent,
  REPLACE(REPLACE(REPLACE(ISNULL(k.NIP, ''), '-', ''), ' ', ''), '.', '') AS nip,
  $($hn.Net) AS netto,
  $($hn.Br) AS brutto_proxy
FROM dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
LEFT JOIN dbo.KONTRAHENT k WITH (NOLOCK)
  ON k.ID_KONTRAHENTA = $($jk.Expr)
WHERE dh.$dc >= @from
ORDER BY dh.$dc;
"@
            [void]$variants.Add(@{ Name = $label; Query = $query })
          }
        }
      }
    }
  }

  return @($variants)
}

function Get-KenochemBeforeQueryVariants([string]$fromDate) {
  $fromDecl = New-SonaxFromDecl $fromDate
  $variants = New-Object System.Collections.Generic.List[hashtable]

  $joinKeys = @(
    @{ Name = 'id_kontrahent'; Expr = 'dh.ID_KONTRAHENTA' },
    @{ Name = 'id_platnik'; Expr = 'dh.ID_PLATNIKA' }
  )
  $nameExprs = @(
    @{ Name = 'nazwa'; Select = 'LTRIM(RTRIM(k.NAZWA))'; Group = 'LTRIM(RTRIM(k.NAZWA))' }
  )
  $dateCols = @('DATA_WYSTAWIENIA', 'DATA_SPRZEDAZY')
  $pdJoins = @(
    @{ Name = 'pd_id_dok_hand'; On = 'dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO' },
    @{ Name = 'pd_id_dokument'; On = 'dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOKUMENTU_HANDLOWEGO' }
  )
  $netExprs = @(
    @{ Name = 'cena'; Sql = 'CAST(SUM(pd.ILOSC * ISNULL(pd.CENA_NETTO, 0)) AS DECIMAL(18, 2))' },
    @{ Name = 'wart'; Sql = 'CAST(SUM(ISNULL(pd.WARTOSC_NETTO, 0)) AS DECIMAL(18, 2))' }
  )
  $rodzajFilters = @(
    @{ Name = 'rodzaj_r'; Sql = "  AND pd.RODZAJ_POZYCJI = 'R'`n" },
    @{ Name = 'bez_rodzaj'; Sql = '' }
  )

  foreach ($pj in $pdJoins) {
    foreach ($jk in $joinKeys) {
      foreach ($ne in $nameExprs) {
        foreach ($dc in $dateCols) {
          foreach ($net in $netExprs) {
            foreach ($rf in $rodzajFilters) {
              $label = ('before_pd_{0}_{1}_{2}_{3}_{4}_{5}' -f $pj.Name, $jk.Name, $ne.Name, $dc, $net.Name, $rf.Name)
              $query = @"
SET NOCOUNT ON;
$fromDecl
SELECT
  REPLACE(REPLACE(REPLACE(ISNULL(k.NIP, ''), '-', ''), ' ', ''), '.', '') AS nip,
  $($ne.Select) AS kontrahent,
  COUNT(DISTINCT dh.ID_DOKUMENTU_HANDLOWEGO) AS fv_count,
  $($net.Sql) AS netto
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON $($pj.On)
LEFT JOIN dbo.KONTRAHENT k WITH (NOLOCK)
  ON k.ID_KONTRAHENTA = $($jk.Expr)
$($rf.Sql)  AND dh.$dc < @from
GROUP BY k.NIP, $($ne.Group)
HAVING COUNT(DISTINCT dh.ID_DOKUMENTU_HANDLOWEGO) > 0;
"@
              [void]$variants.Add(@{ Name = $label; Query = $query })
            }
          }
        }
      }
    }
  }

  return @($variants)
}

function Get-ClientQueryVariants {
  return @(
    @{ Name = 'kontrahenci_nazwa'; Query = @'
SET NOCOUNT ON;
SELECT
  CAST(ID_KONTRAHENTA AS varchar(20)) AS id,
  LTRIM(RTRIM(NAZWA)) AS nazwa,
  REPLACE(REPLACE(REPLACE(ISNULL(NIP, ''), '-', ''), ' ', ''), '.', '') AS nip
FROM dbo.KONTRAHENT WITH (NOLOCK)
WHERE ISNULL(NIP, '') <> ''
ORDER BY nazwa;
'@ }
  )
}

function Invoke-SqlProbe([string]$label, [string]$query) {
  $tmp = Join-Path $SyncDir ("probe-{0}.txt" -f $label)
  $code = Invoke-WaproQuery $query $tmp
  $raw = if (Test-Path $tmp) { Get-Content $tmp -Encoding UTF8 } else { @() }
  Write-Log ("PROBE {0}: exit={1}" -f $label, $code)
  foreach ($line in $raw | Select-Object -First 80) {
    if ($line.Trim()) { Write-Host $line }
  }
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
}

function Export-QueryVariants {
  param(
    [array]$Variants,
    [string]$OutPath,
    [string]$HeaderLine,
    [switch]$AllowEmpty
  )
  $tmp = Join-Path $SyncDir ('export-{0}.raw' -f ([guid]::NewGuid().ToString('N').Substring(0, 8)))
  $tried = 0
  $lastErr = ''
  foreach ($v in $Variants) {
    $tried++
    if ($tried -le 5 -or ($tried % 16) -eq 0) {
      Write-Log ("Proba ({0}/{1}): {2}" -f $tried, $Variants.Count, $v.Name)
    }
    $code = Invoke-WaproQuery $v.Query $tmp
    $rawText = if (Test-Path $tmp) { [System.IO.File]::ReadAllText($tmp) } else { '' }
    if (Test-SqlExportError $code $rawText) {
      if ($tried -le 8) {
        Write-Log ('  blad: {0}' -f ($rawText.Substring(0, [Math]::Min(140, $rawText.Length))))
      }
      $lastErr = $rawText
      continue
    }
    $lines = New-Object System.Collections.Generic.List[string]
    [void]$lines.Add($HeaderLine)
    $rows = 0
    foreach ($line in [System.IO.File]::ReadAllLines($tmp)) {
      $t = $line.Trim()
      if (-not $t) { continue }
      if ($t -match '^(Msg |Changed database|---|\(\d+ rows affected\))') { continue }
      if ($t -match '^(data_int|id)\b') { continue }
      [void]$lines.Add($t)
      $rows++
    }
    if ($rows -gt 0 -or $AllowEmpty) {
      if ($rows -eq 0) {
        Write-Log ("OK {0}: 0 wierszy (zapytanie dziala, brak FV w okresie)" -f $v.Name)
      } else {
        Write-Log ("OK {0}: {1} wierszy -> {2}" -f $v.Name, $rows, $OutPath)
      }
      $utf8 = New-Object System.Text.UTF8Encoding $false
      [System.IO.File]::WriteAllLines($OutPath, $lines.ToArray(), $utf8)
      if (Test-Path $tmp) { Remove-Item $tmp -Force }
      return @{ Rows = $rows; Variant = $v.Name }
    }
    if ($tried -le 8) {
      Write-Log ('  pusty wynik: {0}' -f $v.Name)
    }
  }
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
  if ($lastErr) {
    throw ('Zaden wariant nie dzialal. Ostatni blad: {0}' -f ($lastErr.Substring(0, [Math]::Min(240, $lastErr.Length))))
  }
  throw ('Zaden z {0} wariantow nie zwrocil danych (zapytania OK, ale 0 FV?)' -f $Variants.Count)
}

if (-not (Test-Path $ExportDir)) { New-Item -ItemType Directory -Path $ExportDir | Out-Null }

if ($DiagnoseSchema) {
  Write-Log 'Diagnostyka schematu WAPRO'
  Invoke-SqlProbe 'dh_all' @"
SET NOCOUNT ON;
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DOKUMENT_HANDLOWY'
ORDER BY ORDINAL_POSITION;
"@
  Invoke-SqlProbe 'pd_mag' @"
SET NOCOUNT ON;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'POZYCJA_DOKUMENTU_MAGAZYNOWEGO'
  AND COLUMN_NAME LIKE '%DOK%'
ORDER BY 1;
"@
  Invoke-SqlProbe 'k_cols' @"
SET NOCOUNT ON;
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'KONTRAHENT'
ORDER BY ORDINAL_POSITION;
"@
  Invoke-SqlProbe 'count_fv' @"
SET NOCOUNT ON;
DECLARE @from int = CAST(CAST(CAST('$($FromDate.Replace("'", "''"))' AS date) AS datetime) AS int) + 36163;
SELECT COUNT(*) FROM dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK) WHERE dh.DATA_WYSTAWIENIA >= @from;
"@
  exit 0
}

Write-Log ("Eksport Sonax/WAPRO od {0}" -f $FromDate)
$invPath = Join-Path $ExportDir 'wapro-faktury.tsv'
$cliPath = Join-Path $ExportDir 'wapro-kontrahenci.tsv'

try {
  $invResult = Export-QueryVariants -Variants (Get-InvoiceQueryVariants $FromDate) -OutPath $invPath -HeaderLine "data_int`tnumer`tkontrahent`tnip`tnetto`tbrutto_proxy"
} catch {
  Write-Log $_.Exception.Message
  Write-Log 'Uruchom: sync-wapro-sonax-export.ps1 -DiagnoseSchema'
  throw
}

$cliResult = Export-QueryVariants -Variants (Get-ClientQueryVariants) -OutPath $cliPath -HeaderLine "id`tnazwa`tnip"

$beforePath = Join-Path $ExportDir 'wapro-kenochem-przed.tsv'
$beforeResult = $null
try {
  $beforeResult = Export-QueryVariants -Variants (Get-KenochemBeforeQueryVariants $FromDate) -OutPath $beforePath -HeaderLine "nip`tkontrahent`tfv_count`tnetto_pln"
} catch {
  Write-Log ('Eksport klientow Kenochem przed {0} nieudany: {1}' -f $FromDate, $_.Exception.Message)
  Write-Log 'Raport Sonax bedzie bez wykluczenia overlap Kenochem — uruchom ponownie po naprawie SQL.'
}

$meta = @{
  exportedAt = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  fromDate = $FromDate
  invoiceRows = $invResult.Rows
  invoiceVariant = $invResult.Variant
  clientRows = $cliResult.Rows
  clientVariant = $cliResult.Variant
  kenochemBeforeRows = if ($beforeResult) { $beforeResult.Rows } else { $null }
  kenochemBeforeVariant = if ($beforeResult) { $beforeResult.Variant } else { $null }
} | ConvertTo-Json -Compress
Set-Content -Path (Join-Path $ExportDir 'wapro-export-meta.json') -Value $meta -Encoding UTF8

Write-Log 'Gotowe. Skopiuj sonax-export\ na PC do data\sonax-import\'
