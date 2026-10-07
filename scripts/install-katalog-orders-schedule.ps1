#Requires -RunAsAdministrator
<#
  Zadanie Harmonogramu: co 1 min sprawdza, czy w CRM kliknieto "Do WAPRO", i tworzy ZO w Mag.
  (Przycisk w CRM tylko KOLEJKUJE zlecenie - tworzy je ten agent; bez zadania nic sie samo nie dzieje.)

  Na serwerze WAPRO:
    1. Skopiuj sync-wapro-orders-server.ps1 do C:\katalog-sync\ (i uzupelnij katalog-sync.env).
    2. Uruchom ten plik jako administrator:
         powershell -ExecutionPolicy Bypass -File C:\katalog-sync\install-katalog-orders-schedule.ps1
       Zapyta o haslo konta Windows, na ktorym ma dzialac zadanie (musi miec dostep do SQL WAPRO,
       to samo konto, na ktorym dziala sync stanow).
  PLIK ASCII - bez polskich znakow w kodzie (PowerShell 5.1).
#>
param(
  [string]$SyncDir = 'C:\katalog-sync',
  [int]$EveryMinutes = 1,
  [string]$TaskName = 'Kenochem-WaproOrders',
  [switch]$NoPassword   # zadanie dziala tylko gdy to konto jest zalogowane (np. sesja RDP), bez hasla
)

$ErrorActionPreference = 'Stop'
$Ps1 = Join-Path $SyncDir 'sync-wapro-orders-server.ps1'
if (-not (Test-Path $Ps1)) {
  Write-Error "Brak $Ps1 - najpierw skopiuj sync-wapro-orders-server.ps1 do $SyncDir"
}
if (-not (Test-Path (Join-Path $SyncDir 'katalog-sync.env'))) {
  Write-Error "Brak $SyncDir\katalog-sync.env"
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Ps1`" -OnlyIfPending"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Usunieto stare zadanie $TaskName"
}

$who = "{0}\{1}" -f $env:USERDOMAIN, $env:USERNAME
if ($NoPassword) {
  $principal = New-ScheduledTaskPrincipal -UserId $who -LogonType Interactive -RunLevel Highest
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Principal $principal -Description 'Kenochem - zamowienia CRM -> WAPRO (ZO)' -Force | Out-Null
  $acc = "$who (tylko gdy zalogowany)"
} else {
  $cred = Get-Credential -UserName $who -Message 'Haslo konta Windows (dostep do SQL WAPRO)'
  if (-not $cred) { Write-Error 'Anulowano.' }
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Highest `
    -Description 'Kenochem - zamowienia CRM -> WAPRO (ZO)' -Force | Out-Null
  $acc = $cred.UserName
}
Write-Host "OK: zadanie $TaskName co $EveryMinutes min (-OnlyIfPending), konto $acc"
Write-Host "Log: $SyncDir\orders.log"
Write-Host "Test reczny:  powershell -ExecutionPolicy Bypass -File `"$Ps1`" -DryRun"
