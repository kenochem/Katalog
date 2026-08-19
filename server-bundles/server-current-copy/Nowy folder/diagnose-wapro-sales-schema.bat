@echo off
REM Skan schematu Mag (tabele + kolumny) pod zapytanie sprzedazy
set SKU=%~1
if "%SKU%"=="" set SKU=SON000083
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-wapro-stock-server.ps1" -DiagnoseSalesSchema -DiagnoseSalesSku %SKU%
pause
