#Requires -RunAsAdministrator
<#
  Harmonogram sync WAPRO -> Supabase (mniejszy egress niż co 2 min):

  1. Kenochem-WaproStockDaily     — codziennie 07:00, pełny sync stanów/cen
  2. Kenochem-WaproStockOnDemand — co 15 min -OnlyIfPending (przycisk w apce → stock_sync_requests)
  3. Kenochem-WaproSalesDaily     — opcjonalnie -IncludeNightlySales (duzy egress)

  Usuwa stare: Kenochem-CrmMailSync (poczta CRM).

  Na serwerze WAPRO (po install-katalog-sync.ps1):
    powershell -ExecutionPolicy Bypass -File C:\katalog-sync\install-katalog-stock-schedule.ps1
#>
param(
  [string]$SyncDir = 'C:\katalog-sync',
  [int]$OnDemandMinutes = 15,
  [string]$StockDailyAt = '07:00',
  [string]$SalesDailyAt = '04:30',
  [switch]$IncludeNightlySales
)

$ErrorActionPreference = 'Stop'
$Ps1 = Join-Path $SyncDir 'sync-wapro-stock-server.ps1'
if (-not (Test-Path $Ps1)) {
  Write-Error "Brak $Ps1 — najpierw uruchom scripts\install-katalog-sync.ps1"
}

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2)

function Remove-TaskIfExists([string]$Name) {
  if (Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $Name -Confirm:$false
    Write-Host "Usunieto stare zadanie: $Name"
  }
}

Remove-TaskIfExists 'Kenochem-CrmMailSync'
Remove-TaskIfExists 'Kenochem-WaproStockDaily'
Remove-TaskIfExists 'Kenochem-WaproStockOnDemand'
Remove-TaskIfExists 'Kenochem-WaproSalesDaily'

# --- 07:00 pełny sync stanów ---
$stockAction = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Ps1`""

$stockTrigger = New-ScheduledTaskTrigger -Daily -At $StockDailyAt
Register-ScheduledTask `
  -TaskName 'Kenochem-WaproStockDaily' `
  -Action $stockAction `
  -Trigger $stockTrigger `
  -Settings $settings `
  -Description 'Kenochem — codzienny sync stanow/cen WAPRO -> Supabase (07:00)' `
  -Force | Out-Null
Write-Host "OK: Kenochem-WaproStockDaily o $StockDailyAt"

# --- co 15 min: tylko gdy zlecenie z aplikacji (pending) ---
$pendingAction = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Ps1`" -OnlyIfPending"

$start = (Get-Date).Date.AddMinutes(5)
$pendingTrigger = New-ScheduledTaskTrigger -Once -At $start `
  -RepetitionInterval (New-TimeSpan -Minutes $OnDemandMinutes) `
  -RepetitionDuration ([TimeSpan]::MaxValue)

Register-ScheduledTask `
  -TaskName 'Kenochem-WaproStockOnDemand' `
  -Action $pendingAction `
  -Trigger $pendingTrigger `
  -Settings $settings `
  -Description "Kenochem — sync stanow na zadanie (co ${OnDemandMinutes} min, tylko pending)" `
  -Force | Out-Null
Write-Host "OK: Kenochem-WaproStockOnDemand co $OnDemandMinutes min (-OnlyIfPending)"

# --- noc: zbiorcza sprzedaz Mag (Ops) — opcjonalnie, duzy egress ---
if ($IncludeNightlySales) {
  $salesAction = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Ps1`" -SalesSyncOnly"

  $salesTrigger = New-ScheduledTaskTrigger -Daily -At $SalesDailyAt
  Register-ScheduledTask `
    -TaskName 'Kenochem-WaproSalesDaily' `
    -Action $salesAction `
    -Trigger $salesTrigger `
    -Settings $settings `
    -Description 'Kenochem — cache sprzedazy Mag -> Supabase (Ops, 1x/dzień)' `
    -Force | Out-Null
  Write-Host "OK: Kenochem-WaproSalesDaily o $SalesDailyAt (duzy transfer — Ops)"
} else {
  Write-Host "Pominieto Kenochem-WaproSalesDaily (oszczednosc egress). Ops: przycisk Odswiez z Mag."
}

Write-Host ""
Write-Host "Log: $SyncDir\sync.log"
Write-Host "Reczny pelny sync: powershell -File `"$Ps1`""
Write-Host "Reczny sync sprzedazy: powershell -File `"$Ps1`" -SalesSyncOnly"
Write-Host ""
Write-Host "UWAGA: Jesli masz reczne zadanie co 2 min w Harmonogramie zadan — usun je."
Write-Host "Egress: -OnlyIfPending bez pending to kilka KB; duzy transfer to SalesSyncOnly i pelny sync o 7:00."
