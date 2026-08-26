#Requires -Version 5.1
<#
.SYNOPSIS
  Eksport pozycji towarowych sprzedazy detalicznej (kontrahent "Sprzedaz detaliczna")
  z WAPRO Mag, do policzenia zarobku na przejetym asortymencie.

.OPIS
  Skrypt WYLACZNIE DO ODCZYTU (same SELECT-y) - nic nie zmienia w bazie WAPRO ani
  w synchronizacji stanow. Dziala niezaleznie od sync-wapro-stock-server.ps1,
  ale czyta ta sama konfiguracje polaczenia z C:\katalog-sync\katalog-sync.env
  (WAPRO_SQL_SERVER / WAPRO_SQL_DATABASE), zeby nie trzeba bylo niczego dodatkowo
  konfigurowac na serwerze, na ktorym juz dziala synchronizacja stanow.

.UZYCIE
  1. Skopiuj ten plik na serwer WAPRO, obok sync-wapro-stock-server.ps1
     (typowo C:\katalog-sync\wapro-retail-items-export.ps1).
  2. Najpierw uruchom BEZ przelacznika -Export - to tylko sprawdza nazwy kolumn
     (tabela KONTRAHENT, powiazanie z DOKUMENT_HANDLOWY) i nic nie eksportuje:
       powershell -File wapro-retail-items-export.ps1
     Wynik pokaze sie w konsoli - wyslij go z powrotem, jesli cos nie pasuje.
  3. Jesli probe wyglada dobrze (widac kolumne z nazwa kontrahenta), uruchom
     wlasciwy eksport:
       powershell -File wapro-retail-items-export.ps1 -Export
     Domyslny zakres dat: 2026-02-20 do dzis. Mozna zmienic:
       powershell -File wapro-retail-items-export.ps1 -Export -DateFrom 2026-02-20 -DateTo 2026-08-21
  4. Wynik: C:\katalog-sync\retail-items-export.csv - wyslij ten plik z powrotem
     do analizy (marza, sumy, ranking towarow).

.NOTES
  Zalozenia (do potwierdzenia probem, jesli WAPRO zglosi blad nazwy kolumny):
  - dbo.KONTRAHENT z kolumna NAZWA_PELNA (lub NAZWA) i ID_KONTRAHENTA
  - dbo.DOKUMENT_HANDLOWY.ID_KONTRAHENTA -> dbo.KONTRAHENT.ID_KONTRAHENTA
  - dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO.RODZAJ_POZYCJI = 'R' oznacza sprzedaz
  - dbo.ARTYKUL.CENA_ZAKUPU_NETTO = ostatnia znana cena zakupu netto (do marzy)
  Te same konwencje sa juz uzywane (i sprawdzone) w sync-wapro-stock-server.ps1.
#>
param(
  [switch]$Export,
  [string]$DateFrom = '2026-02-20',
  [string]$DateTo = (Get-Date -Format 'yyyy-MM-dd'),
  [string]$Kontrahent = 'Sprzedaz detaliczna'
)

$ErrorActionPreference = 'Stop'
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture

$SyncDir = 'C:\katalog-sync'
$EnvFile = Join-Path $SyncDir 'katalog-sync.env'
$OutFile = Join-Path $SyncDir 'retail-items-export.csv'

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

if (-not (Test-Path $EnvFile)) {
  Write-Host "Brak $EnvFile - skopiuj ten skrypt na serwer, gdzie dziala synchronizacja WAPRO (tam ten plik juz istnieje)." -ForegroundColor Red
  exit 1
}
$envMap = Get-EnvMap $EnvFile
$SqlServer = if ($envMap['WAPRO_SQL_SERVER']) { $envMap['WAPRO_SQL_SERVER'].Trim() } else { 'localhost' }
$SqlDatabase = if ($envMap['WAPRO_SQL_DATABASE']) { $envMap['WAPRO_SQL_DATABASE'].Trim() } else { 'WAPRO' }
Write-Host ("Polaczenie SQL: serwer={0}, baza={1}" -f $SqlServer, $SqlDatabase)

function Invoke-Sql([string]$query, [string]$outFile) {
  if (Test-Path $outFile) { Remove-Item $outFile -Force }
  & sqlcmd -S $SqlServer -d $SqlDatabase -E -W -s ';' -f 65001 -Q $query -o $outFile
  $code = $LASTEXITCODE
  Write-Host ("  (sqlcmd exit code: {0})" -f $code)
  if (Test-Path $outFile) {
    $content = Get-Content $outFile -Encoding UTF8
    if ($content) {
      $content | ForEach-Object { Write-Host "  $_" }
    } else {
      Write-Host '  (brak wynikow - pusty plik)' -ForegroundColor DarkYellow
    }
  } else {
    Write-Host '  (sqlcmd nie utworzyl pliku wyjsciowego - sprawdz czy sqlcmd jest zainstalowany / w PATH)' -ForegroundColor Red
  }
  return $code
}

if (-not $Export) {
  $probeDir = $SyncDir
  $p0 = Join-Path $probeDir 'probe-0-connection.txt'
  $p1 = Join-Path $probeDir 'probe-1-tabele-kontrah.txt'
  $p2 = Join-Path $probeDir 'probe-2-kolumny-tabeli.txt'
  $p3 = Join-Path $probeDir 'probe-3-kolumny-dok-handlowy.txt'
  $p4 = Join-Path $probeDir 'probe-4-wiersze-detal.txt'

  Write-Host ''
  Write-Host '=== PROBE 0: podstawowe polaczenie (nazwa bazy, wersja) ===' -ForegroundColor Cyan
  Invoke-Sql -outFile $p0 -query @"
SET NOCOUNT ON;
SELECT DB_NAME() AS baza, @@VERSION AS wersja;
"@ | Out-Null

  Write-Host ''
  Write-Host '=== PROBE 1: wszystkie tabele z KONTRAH w nazwie ===' -ForegroundColor Cyan
  Invoke-Sql -outFile $p1 -query @"
SET NOCOUNT ON;
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%KONTRAH%'
ORDER BY TABLE_NAME;
"@ | Out-Null

  Write-Host ''
  Write-Host '=== PROBE 2: kolumny KONTRAHENT (jesli istnieje pod ta nazwa) ===' -ForegroundColor Cyan
  Invoke-Sql -outFile $p2 -query @"
SET NOCOUNT ON;
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'KONTRAHENT'
ORDER BY ORDINAL_POSITION;
"@ | Out-Null

  Write-Host ''
  Write-Host '=== PROBE 3: kolumny DOKUMENT_HANDLOWY zawierajace KONTRAH ===' -ForegroundColor Cyan
  Invoke-Sql -outFile $p3 -query @"
SET NOCOUNT ON;
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'DOKUMENT_HANDLOWY' AND COLUMN_NAME LIKE '%KONTRAH%'
ORDER BY ORDINAL_POSITION;
"@ | Out-Null

  Write-Host ''
  Write-Host '=== PROBE 4: przykladowe wiersze KONTRAHENT z nazwa zawierajaca detal ===' -ForegroundColor Cyan
  Invoke-Sql -outFile $p4 -query @"
SET NOCOUNT ON;
SELECT TOP 5 *
FROM dbo.KONTRAHENT WITH (NOLOCK)
WHERE NAZWA_PELNA LIKE N'%detal%' OR NAZWA LIKE N'%detal%';
"@ | Out-Null

  Write-Host ''
  Write-Host 'Jesli powyzsze probe pokazuja realne kolumny/wiersze - uruchom z -Export.' -ForegroundColor Yellow
  Write-Host 'Jesli cos jest puste/bledne - wyslij caly powyzszy output z powrotem, zanim uruchomisz -Export.' -ForegroundColor Yellow
  exit 0
}

# WAPRO Mag (Clarion) przechowuje daty jako int: dni od 1899-12-30 + 36163 (ten sam
# przelicznik co w sync-wapro-stock-server.ps1, funkcja Convert-WaproIntDate).
$d1 = [int]([datetime]$DateFrom - (Get-Date '1900-01-01')).TotalDays + 36163
$d2 = [int]([datetime]$DateTo - (Get-Date '1900-01-01')).TotalDays + 36163 + 1

Write-Host ("Zakres dat: {0} .. {1} (int {2}..{3})" -f $DateFrom, $DateTo, $d1, $d2)
Write-Host ("Kontrahent: {0}" -f $Kontrahent)

# UWAGA: kontrahent ma w nazwie polskie "z kreska" (Sprzedaz -> ta litera to
# nie zwykle "z"). Zeby uniknac problemow z kodowaniem pliku (ten sam problem,
# ktory wczesniej psul caly skrypt), dopasowanie robimy przez SQL LIKE z
# wieloznacznikiem "_" (dokladnie jeden dowolny znak) zamiast wpisywac ta
# litere wprost w plik. To jest jedyne miejsce, gdzie kontrahent jest
# identyfikowany - jesli macie wiecej niz jednego kontrahenta pasujacego do
# wzorca "Sprzeda_ detaliczna", da to znac w probe 4 (juz sprawdzone - tylko
# ID_KONTRAHENTA=1 pasuje).
$kontrahentLikePattern = 'Sprzeda_ detaliczna'

# ID_KONTRAHENTA=1 zostalo juz potwierdzone w probie (probe 4) jako
# "Sprzedaz detaliczna" - filtrujemy bezposrednio po ID, to najpewniejsze.
Write-Host ''
Write-Host '=== Kalibracja: liczba pozycji dla kontrahenta (bez filtra daty) ===' -ForegroundColor Cyan
$calibFile = Join-Path $SyncDir 'probe-5-kalibracja.txt'
Invoke-Sql -outFile $calibFile -query @"
SET NOCOUNT ON;
SELECT
  COUNT(*) AS liczba_pozycji_bez_filtra_daty,
  MIN(dh.DATA_SPRZEDAZY) AS min_data_sprzedazy,
  MAX(dh.DATA_SPRZEDAZY) AS max_data_sprzedazy,
  MIN(dh.DATA_WYSTAWIENIA) AS min_data_wystawienia,
  MAX(dh.DATA_WYSTAWIENIA) AS max_data_wystawienia
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO
INNER JOIN dbo.KONTRAHENT k WITH (NOLOCK) ON k.ID_KONTRAHENTA = dh.ID_KONTRAHENTA
WHERE pd.RODZAJ_POZYCJI = 'R'
  AND k.NAZWA_PELNA LIKE N'$kontrahentLikePattern';
"@ | Out-Null
Write-Host 'Powyzsze pokazuje ile pozycji jest w ogole (bez wzgledu na daty) - jesli 0, problem jest w RODZAJ_POZYCJI albo polaczeniu tabel, nie w datach.' -ForegroundColor Yellow

$query = @"
SET NOCOUNT ON;
DECLARE @d1 int = $d1;
DECLARE @d2 int = $d2;

SELECT
  dh.DATA_SPRZEDAZY               AS data_int,
  dh.ID_DOKUMENTU_HANDLOWEGO       AS id_dokumentu,
  k.NAZWA_PELNA                    AS kontrahent,
  a.INDEKS_KATALOGOWY              AS sku,
  a.NAZWA                          AS nazwa_towaru,
  pd.ILOSC                         AS ilosc,
  pd.CENA_NETTO                    AS cena_sprzedazy_netto,
  CAST(pd.ILOSC * ISNULL(pd.CENA_NETTO, 0) AS DECIMAL(18,2)) AS wartosc_sprzedazy_netto,
  a.CENA_ZAKUPU_NETTO              AS cena_zakupu_netto,
  CAST(pd.ILOSC * ISNULL(a.CENA_ZAKUPU_NETTO, 0) AS DECIMAL(18,2)) AS wartosc_zakupu_netto,
  CAST((pd.ILOSC * ISNULL(pd.CENA_NETTO, 0)) - (pd.ILOSC * ISNULL(a.CENA_ZAKUPU_NETTO, 0)) AS DECIMAL(18,2)) AS marza_netto
FROM dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd WITH (NOLOCK)
INNER JOIN dbo.DOKUMENT_HANDLOWY dh WITH (NOLOCK)
  ON dh.ID_DOKUMENTU_HANDLOWEGO = pd.ID_DOK_HANDLOWEGO
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = pd.ID_ARTYKULU
INNER JOIN dbo.KONTRAHENT k WITH (NOLOCK) ON k.ID_KONTRAHENTA = dh.ID_KONTRAHENTA
WHERE pd.RODZAJ_POZYCJI = 'R'
  AND dh.DATA_SPRZEDAZY >= @d1 AND dh.DATA_SPRZEDAZY < @d2
  AND k.NAZWA_PELNA LIKE N'$kontrahentLikePattern'
ORDER BY dh.DATA_SPRZEDAZY, dh.ID_DOKUMENTU_HANDLOWEGO;
"@

Write-Host ''
Write-Host '=== Eksport ===' -ForegroundColor Cyan
$code = Invoke-Sql -query $query -outFile $OutFile
if ($code -ne 0) {
  Write-Host "sqlcmd zwrocil kod $code - sprawdz $OutFile (prawdopodobnie zla nazwa kolumny/tabeli, uruchom bez -Export zeby zdiagnozowac)." -ForegroundColor Red
  exit $code
}

Write-Host ("Zapisano: {0}" -f $OutFile) -ForegroundColor Green
Write-Host 'Wyslij ten plik z powrotem do analizy.'
