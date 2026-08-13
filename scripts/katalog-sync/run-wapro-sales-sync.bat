@echo off
REM Zbiorczy sync sprzedaży WAPRO -> Supabase (wszystkie produkty, jedno SQL)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-wapro-stock-server.ps1" -SalesSyncOnly
echo.
echo Log: C:\katalog-sync\sync.log
pause
