#Requires -RunAsAdministrator
# Harmonogram: sync poczty CRM co 10 min (IMAP → Supabase)
$TaskName = 'Kenochem-CrmMailSync'
$Ps1 = Join-Path $PSScriptRoot 'sync-crm-mail-server.ps1'
if (-not (Test-Path $Ps1)) {
  Write-Error "Brak $Ps1"
  exit 1
}

$SyncDir = 'C:\katalog-sync'
if (-not (Test-Path $SyncDir)) { New-Item -ItemType Directory -Path $SyncDir | Out-Null }

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Ps1`""

$start = (Get-Date).Date.AddMinutes(1)
$trigger = New-ScheduledTaskTrigger -Once -At $start `
  -RepetitionInterval (New-TimeSpan -Minutes 5) `
  -RepetitionDuration ([TimeSpan]::MaxValue)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Kenochem CRM — pobieranie skrzynki IMAP do Supabase' -Force

Write-Host "Zarejestrowano zadanie: $TaskName (co 5 min)"
Write-Host "Log: C:\katalog-sync\crm-mail-sync.log"
Write-Host "Uruchom recznie: powershell -File `"$Ps1`""
