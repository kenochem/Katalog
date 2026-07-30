@echo off
REM Sync stanów WAPRO → Katalog (Supabase) — raz dziennie w Harmonogramie zadań
REM Dostosuj SERWER jeśli łączysz się po IP: 192.168.1.100

setlocal
set SERWER=DESKTOP-PANA1RQ
set BAZA=WAPRO
set OUTDIR=C:\katalog-sync
set OUT=%OUTDIR%\wapro-stock.csv
set KATALOG_DIR=C:\Users\Biuro\Projects\katalog

if not exist "%OUTDIR%" mkdir "%OUTDIR%"

echo sku;stock> "%OUT%"

sqlcmd -S %SERWER% -d %BAZA% -E -W -h-1 -s";" -Q "SET NOCOUNT ON; SELECT LTRIM(RTRIM(INDEKS_KATALOGOWY)), CAST(SUM(COALESCE(STAN,0)) AS DECIMAL(18,3)) FROM dbo.ARTYKUL WHERE INDEKS_KATALOGOWY IS NOT NULL AND LTRIM(RTRIM(INDEKS_KATALOGOWY)) <> '' GROUP BY LTRIM(RTRIM(INDEKS_KATALOGOWY)) ORDER BY 1" >> "%OUT%"
if errorlevel 1 (
  echo Błąd sqlcmd — sprawdź SERWER / uprawnienia.
  exit /b 1
)

cd /d "%KATALOG_DIR%"
call npm run sync:wapro-stock -- "%OUT%"
endlocal
