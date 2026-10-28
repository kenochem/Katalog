# Diagnostyka: gdzie w WAPRO jest pelna nazwa produktu (nazwy w katalogu bywaja ucinane).
# Uruchom na serwerze WAPRO:  powershell -ExecutionPolicy Bypass -File wapro-name-columns.ps1 -Sku HYD001268
param(
  [string]$Sku = 'HYD001268',
  [string]$SqlServer = 'localhost',
  [string]$SqlDatabase = 'WAPRO'
)

function Run([string]$q) {
  & sqlcmd -S $SqlServer -d $SqlDatabase -E -W -s ' | ' -f 65001 -Q $q
}

Write-Host '=== Kolumny tekstowe ARTYKUL i WIDOK_ARTYKUL (nazwa, max dlugosc) ===' -ForegroundColor Cyan
Run @"
SET NOCOUNT ON;
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH AS max_len
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('ARTYKUL', 'WIDOK_ARTYKUL')
  AND DATA_TYPE IN ('varchar', 'nvarchar', 'char', 'nchar', 'text', 'ntext')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
"@

Write-Host ''
Write-Host ("=== Wartosci tekstowe dla SKU {0} ===" -f $Sku) -ForegroundColor Cyan
Run @"
SET NOCOUNT ON;
SELECT TOP 1 a.INDEKS_KATALOGOWY, a.NAZWA, LEN(a.NAZWA) AS dl_nazwa
FROM dbo.ARTYKUL a WITH (NOLOCK)
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = N'$Sku';
SELECT TOP 1 wa.*
FROM dbo.WIDOK_ARTYKUL wa WITH (NOLOCK)
INNER JOIN dbo.ARTYKUL a WITH (NOLOCK) ON a.ID_ARTYKULU = wa.IdArtykulu
WHERE LTRIM(RTRIM(a.INDEKS_KATALOGOWY)) = N'$Sku';
"@
