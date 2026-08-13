@echo off
REM Odbiera zlecenia sprzedazy z katalogu (bez pelnego sync stanow)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-wapro-stock-server.ps1" -SalesOnly -OnlyIfPending
echo Log: C:\katalog-sync\sync.log
