#Requires -RunAsAdministrator
<#
  MODUL WYLACZONY — poczta CRM nie jest uzywana.

  Aby usunac istniejacy harmonogram:
    powershell -ExecutionPolicy Bypass -File scripts\uninstall-crm-mail-sync.ps1
#>
Write-Host "Kenochem CRM mail sync jest wylaczony (CRM_MAIL_SYNC_ENABLED=false)."
Write-Host "Jesli wczesniej instalowales harmonogram, uruchom:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\uninstall-crm-mail-sync.ps1"
exit 0
