#Requires -RunAsAdministrator
<#
  Usuwa harmonogram Kenochem-CrmMailSync (IMAP co 5 min).
  Uruchom na serwerze / PC, gdzie był zarejestrowany:
    powershell -ExecutionPolicy Bypass -File scripts\uninstall-crm-mail-sync.ps1
#>
$TaskName = 'Kenochem-CrmMailSync'
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Usunieto zadanie: $TaskName"
} else {
  Write-Host "Brak zadania $TaskName — nic do usuniecia."
}

Write-Host "Modul poczty CRM jest wylaczony w aplikacji (CRM_MAIL_SYNC_ENABLED=false)."
