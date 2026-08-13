@echo off
REM Skopiuj caly folder scripts\katalog-sync\ do C:\katalog-sync\ na serwerze WAPRO
if "%~1"=="" (
  echo Uzycie: diagnose-wapro-sales.bat SKU
  echo Przyklad: diagnose-wapro-sales.bat SON000083
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-wapro-stock-server.ps1" -DiagnoseSalesSku %1
echo.
echo Log: C:\katalog-sync\sync.log
pause
