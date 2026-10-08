#Requires -Version 5.1
<#
.SYNOPSIS
  CRM / katalog -> WAPRO Mag: tworzy zamowienie od odbiorcy (ZO) dokladnie tak, jak robi to program WAPRO.

.NOTES
  UWAGA: plik ASCII (bez polskich znakow w kodzie) - PowerShell 5.1 czyta skrypt bez BOM jako Windows-1250.

  Kolejnosc wywolan odtworzona z nagrania (Extended Events) zwyklego ZO utworzonego w WAPRO:
    RM_DodajZamowienie -> RM_DodajPozycjeZamowienia (+ RM_SumujZamowienie) -> RM_KontrolaCenPozycjiZamowienia
    -> RM_ZatwierdzZamowienie (numer ZO nadaje WAPRO). Wszystko w jednej transakcji.
  Naglowek tworzymy wariantem _Server (ma parametr wyjsciowy z ID zamowienia).

  Kontrahent: dopasowanie po NIP (KONTRAHENT.NIP). Artykuly: INDEKS_KATALOGOWY = SKU, tylko wiersz z ID_MAGAZYNU = magazyn
  zamowienia (kazdy indeks ma po jednym wierszu na magazyn).

  Idempotencja: numer zamowienia klienta (NR_ZAMOWIENIA_KLIENTA) = H<7 znakow id zlecenia> (8 znakow, H = handlowcy). Jesli ZO o tym numerze
  juz istnieje, zlecenie jest zamykane jako wykonane bez tworzenia duplikatu.

.PARAMETER OnlyIfPending
  Tryb dla Harmonogramu zadan: nic nie robi, gdy brak zlecen (status pending).
.PARAMETER DryRun
  Test: tworzy caly dokument w transakcji i na koncu ja COFA. Status zlecenia NIE jest zmieniany.
  Najpierw uruchom tak, potem dopiero bez -DryRun.
.PARAMETER RequestId
  Przetwarza tylko wskazane zlecenie (id z tabeli wapro_order_requests).

.ENV (C:\katalog-sync\katalog-sync.env)
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY            (jak w agencie stanow)
  WAPRO_ORDER_ID_UZYTKOWNIKA=3000001                 (wymagane; uzytkownik WAPRO, np. admin)
  WAPRO_ORDER_ID_FIRMY=1  WAPRO_ORDER_ID_MAGAZYNU=1  WAPRO_ORDER_ID_RACHUNKU=3  WAPRO_ORDER_ID_TYPU=12
  WAPRO_ORDER_RESERVE=1                              (1 = rezerwuj towar jak w programie; 0 = bez rezerwacji)
  WAPRO_ORDER_BRUTTO_NETTO=Netto                     (Netto lub Brutto)
  WAPRO_ORDER_CUSTOM_PRICE_MARK=m                    (znacznik ceny gdy cena inna niz katalogowa)
  WAPRO_ORDER_ID_KONTRAHENTA=0                       (opcjonalnie: kontrahent zastepczy, gdy klient CRM bez NIP)
#>
param(
  [switch]$OnlyIfPending,
  [switch]$DryRun,
  [string]$RequestId = ''
)

$ErrorActionPreference = 'Stop'
$SyncDir = 'C:\katalog-sync'
$EnvFile = Join-Path $SyncDir 'katalog-sync.env'
$LogFile = Join-Path $SyncDir 'orders.log'
$SqlServer = 'localhost'
$SqlDatabase = 'WAPRO'
$Inv = [System.Globalization.CultureInfo]::InvariantCulture

function Write-Log([string]$msg) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-EnvMap([string]$path) {
  $map = @{}
  Get-Content $path -Encoding UTF8 | ForEach-Object {
    $t = $_.Trim()
    if (-not $t -or $t.StartsWith('#')) { return }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { return }
    $map[$t.Substring(0, $i).Trim()] = $t.Substring($i + 1).Trim()
  }
  return $map
}

function ConvertTo-Num([object]$v) {
  if ($null -eq $v -or "$v" -eq '') { return $null }
  $d = 0.0
  if ([double]::TryParse(([string]$v).Replace(',', '.'), [System.Globalization.NumberStyles]::Float, $Inv, [ref]$d)) { return $d }
  return $null
}

function Format-Num([double]$d, [string]$fmt = '0.####') { return $d.ToString($fmt, $Inv) }

function Esc([string]$s) {
  if ($null -eq $s) { return '' }
  return ($s -replace "'", "''")
}

function Invoke-SqlFile([string]$sql) {
  $sqlPath = Join-Path $SyncDir ('order-{0}.sql' -f [guid]::NewGuid().ToString('N'))
  $outPath = [System.IO.Path]::ChangeExtension($sqlPath, '.out')
  try {
    [System.IO.File]::WriteAllText($sqlPath, $sql, (New-Object System.Text.UTF8Encoding $true))
    & sqlcmd -S $SqlServer -d $SqlDatabase -E -b -W -h -1 -s '|' -f 65001 -i $sqlPath -o $outPath | Out-Null
    $code = $LASTEXITCODE
    $text = ''
    if (Test-Path $outPath) { $text = [System.IO.File]::ReadAllText($outPath, [System.Text.Encoding]::UTF8) }
    return @{ Code = $code; Text = $text; Sql = $sqlPath }
  } finally {
    if (Test-Path $outPath) { Remove-Item $outPath -Force -ErrorAction SilentlyContinue }
  }
}

function Remove-SqlFile($res) {
  if ($res -and $res.Sql -and (Test-Path $res.Sql)) { Remove-Item $res.Sql -Force -ErrorAction SilentlyContinue }
}

function Get-Lines([string]$text, [string]$prefix) {
  return @($text -split "`r?`n" | Where-Object { $_.StartsWith($prefix) })
}

function Set-RequestStatus([string]$id, [hashtable]$body) {
  try {
    $json = $body | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    Invoke-RestMethod -Uri ('{0}/rest/v1/wapro_order_requests?id=eq.{1}' -f $script:SupabaseUrl, $id) `
      -Headers $script:JsonHeaders -Method Patch -Body $bytes -ContentType 'application/json; charset=utf-8' | Out-Null
  } catch {
    Write-Log ('Nie udalo sie zaktualizowac statusu zlecenia {0}: {1}' -f $id, $_.Exception.Message)
  }
}

# ------------------------------------------------------------------ konfiguracja
if (-not (Test-Path $SyncDir)) { New-Item -ItemType Directory -Path $SyncDir | Out-Null }
if (-not (Test-Path $EnvFile)) { Write-Log ('BRAK pliku {0}' -f $EnvFile); exit 1 }

$envMap = Get-EnvMap $EnvFile
$script:SupabaseUrl = $envMap['SUPABASE_URL']
$ServiceKey = $envMap['SUPABASE_SERVICE_ROLE_KEY']
if (-not $script:SupabaseUrl -or -not $ServiceKey) { Write-Log 'Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY'; exit 1 }

function Get-EnvInt([string]$key, [int]$default) {
  $v = 0
  if ($envMap[$key] -and [int]::TryParse($envMap[$key], [ref]$v)) { return $v }
  return $default
}

$idFirmy = Get-EnvInt 'WAPRO_ORDER_ID_FIRMY' 1
$idMag = Get-EnvInt 'WAPRO_ORDER_ID_MAGAZYNU' 1
$idUser = Get-EnvInt 'WAPRO_ORDER_ID_UZYTKOWNIKA' 0
$idRachunku = Get-EnvInt 'WAPRO_ORDER_ID_RACHUNKU' 3
$idTypu = Get-EnvInt 'WAPRO_ORDER_ID_TYPU' 12
$idKontrDefault = Get-EnvInt 'WAPRO_ORDER_ID_KONTRAHENTA' 0
$reserve = ($envMap['WAPRO_ORDER_RESERVE'] -ne '0')
$bruttoNetto = if ($envMap['WAPRO_ORDER_BRUTTO_NETTO'] -eq 'Brutto') { 'Brutto' } else { 'Netto ' }
$customMark = if ($envMap['WAPRO_ORDER_CUSTOM_PRICE_MARK']) { $envMap['WAPRO_ORDER_CUSTOM_PRICE_MARK'].Substring(0, 1) } else { 'm' }

if ($idUser -le 0) {
  Write-Log 'Ustaw WAPRO_ORDER_ID_UZYTKOWNIKA w katalog-sync.env (np. 3000001 = admin). Uzytkownik 1 NIE istnieje i blokuje dokumenty.'
  exit 1
}

$headers = @{ apikey = $ServiceKey; Authorization = "Bearer $ServiceKey"; Accept = 'application/json' }
$script:JsonHeaders = $headers + @{ 'Content-Type' = 'application/json'; Prefer = 'return=minimal' }

function Get-Initial([string]$text) {
  # pierwsza litera/cyfra (bez polskich znakow), wielka; brak -> X
  if (-not $text) { return 'X' }
  $t = $text.Replace([string][char]0x141, 'L').Replace([string][char]0x142, 'l')
  $d = $t.Normalize([Text.NormalizationForm]::FormD)
  foreach ($c in $d.ToCharArray()) {
    if ($c -match '[A-Za-z0-9]') { return ([string]$c).ToUpperInvariant() }
  }
  return 'X'
}

# ------------------------------------------------------------------ odczyt realizacji ZO z WAPRO (raz na ~10 min)
function Update-OrderStates {
  $stamp = Join-Path $SyncDir 'orders-status.stamp'
  if (Test-Path $stamp) {
    if (((Get-Date) - (Get-Item $stamp).LastWriteTime).TotalMinutes -lt 10) { return }
  }
  try {
    $since = (Get-Date).AddDays(-30).ToString('yyyy-MM-dd')
    $uri = '{0}/rest/v1/wapro_order_requests?status=eq.done&wapro_order_id=not.is.null&or=(wapro_state.is.null,wapro_state.in.(new,partial),and(wapro_state.eq.realized,wapro_docs.is.null,requested_at.gte.{1}))&select=id,wapro_order_id&order=requested_at.desc&limit=100' -f $script:SupabaseUrl, $since
    try {
      $raw = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    } catch {
      # brak kolumny wapro_docs (migration-wapro-order-docs.sql) - sam stan realizacji
      $uri = '{0}/rest/v1/wapro_order_requests?status=eq.done&wapro_order_id=not.is.null&or=(wapro_state.is.null,wapro_state.in.(new,partial))&select=id,wapro_order_id&order=requested_at.desc&limit=100' -f $script:SupabaseUrl
      $raw = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    }
    $rows = @()
    foreach ($x in @($raw)) { foreach ($y in @($x)) { if ($y -and $y.id -and ($y.id -is [string])) { $rows += $y } } }
    Set-Content -Path $stamp -Value (Get-Date -Format 'o')
    if ($rows.Count -eq 0) { return }

    $ids = @($rows | ForEach-Object { [int64]$_.wapro_order_id })
    $idList = ($ids | ForEach-Object { [string]$_ }) -join ','
    $q = @"
SET NOCOUNT ON;
SELECT 'ST|' + CAST(z.ID_ZAMOWIENIA AS varchar(20)) + '|' + ISNULL(z.STAN_REALIZ, '') + '|' + ISNULL(z.STATUS_ZAM, '') + '|' +
       REPLACE(CAST(ISNULL(p.zam, 0) AS varchar(32)), ',', '.') + '|' + REPLACE(CAST(ISNULL(p.real, 0) AS varchar(32)), ',', '.')
FROM dbo.ZAMOWIENIE z
LEFT JOIN (SELECT ID_ZAMOWIENIA, SUM(ZAMOWIONO) AS zam, SUM(ZREALIZOWANO) AS real FROM dbo.POZYCJA_ZAMOWIENIA GROUP BY ID_ZAMOWIENIA) p
  ON p.ID_ZAMOWIENIA = z.ID_ZAMOWIENIA
WHERE z.ID_ZAMOWIENIA IN ($idList);
"@
    $r = Invoke-SqlFile $q
    Remove-SqlFile $r
    if ($r.Code -ne 0) { Write-Log ('Odczyt realizacji: blad SQL ({0})' -f $r.Code); return }
    $found = @{}
    foreach ($line in (Get-Lines $r.Text 'ST|')) {
      $p = $line.Trim().Split('|')
      if ($p.Count -ge 6) { $found[$p[1]] = $p }
    }
    # dokumenty wydania/sprzedazy powiazane z pozycjami zamowienia (WZ, faktura)
    $docs = @{}
    $qD = @"
SET NOCOUNT ON;
SELECT DISTINCT 'DOC|' + CAST(pz.ID_ZAMOWIENIA AS varchar(20)) + '|' + ISNULL(RTRIM(dm.NUMER), '') + '|' + ISNULL(RTRIM(dh.NUMER), '')
FROM dbo.POZYCJA_ZAMOWIENIA pz
JOIN dbo.POZYCJA_DOKUMENTU_MAGAZYNOWEGO pd ON pd.ID_POZ_ZAM = pz.ID_POZYCJI_ZAMOWIENIA
LEFT JOIN dbo.DOKUMENT_MAGAZYNOWY dm ON dm.ID_DOK_MAGAZYNOWEGO = pd.ID_DOK_MAGAZYNOWEGO
LEFT JOIN dbo.DOKUMENT_HANDLOWY dh ON dh.ID_DOKUMENTU_HANDLOWEGO = CASE WHEN ISNULL(pd.ID_DOK_HANDLOWEGO, 0) > 0 THEN pd.ID_DOK_HANDLOWEGO ELSE dm.ID_DOKUMENTU_HANDLOWEGO END
WHERE pz.ID_ZAMOWIENIA IN ($idList);
"@
    $rD = Invoke-SqlFile $qD
    Remove-SqlFile $rD
    if ($rD.Code -eq 0) {
      foreach ($line in (Get-Lines $rD.Text 'DOC|')) {
        $dp = $line.Trim().Split('|')
        if ($dp.Count -lt 4) { continue }
        $parts = @()
        if ($dp[2]) { $parts += $dp[2] }
        if ($dp[3] -and ($dp[3] -ne $dp[2])) { $parts += $dp[3] }
        if ($parts.Count -eq 0) { continue }
        if ($docs.ContainsKey($dp[1])) { $docs[$dp[1]] = ($docs[$dp[1]] + ', ' + ($parts -join ', ')) } else { $docs[$dp[1]] = ($parts -join ', ') }
      }
    } else {
      Write-Log ('Odczyt dokumentow powiazanych: blad SQL ({0})' -f $rD.Code)
    }
    $now = (Get-Date).ToUniversalTime().ToString('o')
    $changed = 0
    foreach ($row in $rows) {
      $key = [string][int64]$row.wapro_order_id
      if (-not $found.ContainsKey($key)) {
        Set-RequestStatus ([string]$row.id) @{ wapro_state = 'deleted'; wapro_checked_at = $now }
        $changed++
        continue
      }
      $p = $found[$key]
      $zam = ConvertTo-Num $p[4]
      $real = ConvertTo-Num $p[5]
      if ($null -eq $zam) { $zam = 0.0 }
      if ($null -eq $real) { $real = 0.0 }
      $state = 'new'
      $pct = 0
      if ($zam -gt 0) {
        $pct = [Math]::Round([Math]::Min(100.0, 100.0 * $real / $zam), 0)
        if ($real -ge ($zam - 0.0001)) { $state = 'realized' } elseif ($real -gt 0) { $state = 'partial' }
      }
      # STAN_REALIZ z WAPRO: Z = zrealizowane, N = nie (potwierdzone na danych)
      if ($p[2] -eq 'Z') { $state = 'realized'; $pct = 100 }
      $upd = @{ wapro_state = $state; wapro_realized_pct = $pct; wapro_raw = ('{0}/{1}' -f $p[2], $p[3]); wapro_checked_at = $now }
      if ($docs.ContainsKey($key)) { $upd['wapro_docs'] = $docs[$key] }
      Set-RequestStatus ([string]$row.id) $upd
      if ($state -ne 'new') { $changed++ }
    }
    Write-Log ('Odczyt realizacji ZO: sprawdzono {0}, zmian {1}' -f $rows.Count, $changed)
  } catch {
    Write-Log ('Odczyt realizacji ZO nieudany (migracja migration-wapro-order-state.sql wykonana?): {0}' -f $_.Exception.Message)
  }
}

# ------------------------------------------------------------------ pobranie zlecen
if ($RequestId) {
  $pendingUri = '{0}/rest/v1/wapro_order_requests?id=eq.{1}&select=id,seq,payload,requested_at' -f $script:SupabaseUrl, $RequestId
} else {
  $pendingUri = '{0}/rest/v1/wapro_order_requests?status=eq.pending&select=id,seq,payload,requested_at&order=requested_at.asc&limit=5' -f $script:SupabaseUrl
}
try {
  # Windows PowerShell 5.1 potrafi zwrocic cala tablice JSON jako JEDEN obiekt - rozwijamy ja recznie,
  # inaczej dwa zlecenia sa traktowane jak jedno (sklejone id, NIP i nazwa).
  $rawPending = Invoke-RestMethod -Uri $pendingUri -Headers $headers -Method Get
  $pending = @()
  foreach ($x in @($rawPending)) {
    foreach ($y in @($x)) {
      if ($y -and $y.id -and ($y.id -is [string])) { $pending += $y }
    }
  }
} catch {
  if ($OnlyIfPending) { Write-Log ('Brak tabeli wapro_order_requests lub blad: {0}' -f $_.Exception.Message); exit 0 }
  throw
}
if (-not $DryRun -and -not $RequestId) { Update-OrderStates }
if ($pending.Count -eq 0) {
  if (-not $OnlyIfPending) { Write-Log 'Brak zlecen do przetworzenia' }
  exit 0
}

if ($DryRun) { Write-Log 'TRYB TESTOWY (-DryRun): dokument zostanie utworzony i COFNIETY, status zlecenia bez zmian' }

# ------------------------------------------------------------------ przetwarzanie
foreach ($req in $pending) {
  $id = [string]$req.id
  # Numer zamowienia klienta (max 8 znakow): H + inicjal handlowca + inicjal firmy + 5 cyfr (globalny numer zlecenia)
  $idHex = $id.Replace('-', '').ToUpperInvariant()
  $nrKlientaHex = 'H' + $idHex.Substring(0, 7)       # poprzedni format (wykrywanie duplikatow)
  $nrKlientaOld = 'KAT-' + $idHex.Substring(0, 8)    # najstarszy format
  $pl0 = $req.payload
  if ($pl0 -is [string]) { $pl0 = $pl0 | ConvertFrom-Json }
  if ($req.seq) {
    $nrKlienta = 'H' + (Get-Initial ([string]$pl0.salesperson)) + (Get-Initial ([string]$pl0.clientName)) + ([int64]$req.seq).ToString('00000')
  } else {
    $nrKlienta = $nrKlientaHex
  }
  Write-Log ('Zlecenie {0} (nr klienta {1})' -f $id, $nrKlienta)
  if (-not $DryRun) { Set-RequestStatus $id @{ status = 'running'; started_at = (Get-Date).ToUniversalTime().ToString('o') } }

  try {
    $payload = $req.payload
    if ($payload -is [string]) { $payload = $payload | ConvertFrom-Json }
    $items = @($payload.items | Where-Object { $_ })
    if ($items.Count -eq 0) { throw 'Pusty koszyk' }

    $clientName = [string]$payload.clientName
    $clientNip = (([string]$payload.clientNip) -replace '[^0-9A-Za-z]', '').ToUpperInvariant()
    if ($clientNip.StartsWith('PL')) { $clientNip = $clientNip.Substring(2) }
    $note = [string]$payload.note

    # ---- idempotencja: czy ZO z tym numerem klienta juz istnieje
    $qDup = "SET NOCOUNT ON; SELECT 'DUP|' + CAST(ID_ZAMOWIENIA AS varchar(20)) + '|' + RTRIM(NUMER) FROM dbo.ZAMOWIENIE WHERE NR_ZAMOWIENIA_KLIENTA IN ('$(Esc $nrKlienta)', '$(Esc $nrKlientaHex)', '$(Esc $nrKlientaOld)');"
    $rDup = Invoke-SqlFile $qDup
    Remove-SqlFile $rDup
    $dup = Get-Lines $rDup.Text 'DUP|' | Select-Object -First 1
    if ($dup) {
      $p = $dup.Trim().Split('|')
      $msg = 'ZO {0} juz istnieje w WAPRO (ID {1}) - zlecenie zamkniete bez tworzenia duplikatu' -f $p[2], $p[1]
      Write-Log $msg
      if (-not $DryRun) {
        Set-RequestStatus $id @{ status = 'done'; finished_at = (Get-Date).ToUniversalTime().ToString('o'); message = $msg; wapro_order_id = [decimal]$p[1]; wapro_order_number = $p[2] }
      }
      continue
    }

    # ---- kontrahent po NIP
    $idKontr = 0
    $kontrName = ''
    $forma = 'przelew'
    $dni = 0
    if ($clientNip.Length -ge 8) {
      $qK = @"
SET NOCOUNT ON;
SELECT TOP 1 'KONTR|' + CAST(ID_KONTRAHENTA AS varchar(20)) + '|' + REPLACE(ISNULL(NAZWA,''), '|', ' ') + '|' +
       REPLACE(ISNULL(FORMA_PLATNOSCI,''), '|', ' ') + '|' + CAST(ISNULL(TERMIN_NALEZNOSCI,0) AS varchar(10))
FROM dbo.KONTRAHENT
WHERE UPPER(REPLACE(REPLACE(REPLACE(ISNULL(NIP,''), '-', ''), ' ', ''), 'PL', '')) = '$(Esc $clientNip)'
  AND ISNULL(ZABLOKOWANY, 0) = 0
ORDER BY ID_KONTRAHENTA;
"@
      $rK = Invoke-SqlFile $qK
      Remove-SqlFile $rK
      $kl = Get-Lines $rK.Text 'KONTR|' | Select-Object -First 1
      if ($kl) {
        $kp = $kl.Trim().Split('|')
        $idKontr = [int]$kp[1]
        $kontrName = $kp[2]
        if ($kp[3]) { $forma = $kp[3] }
        $d = 0
        [void][int]::TryParse($kp[4], [ref]$d)
        $dni = $d
      }
    }
    if ($idKontr -le 0) {
      if ($idKontrDefault -gt 0) {
        $idKontr = $idKontrDefault
        $kontrName = '(zastepczy)'
      } elseif ($clientNip.Length -lt 8) {
        throw ('Klient "{0}" nie ma NIP w CRM - uzupelnij NIP, zeby dopasowac kontrahenta w WAPRO' -f $clientName)
      } else {
        throw ('Brak kontrahenta o NIP {0} w WAPRO ("{1}") - dodaj go w WAPRO i wyslij ponownie' -f $clientNip, $clientName)
      }
    }

    # ---- artykuly (tylko wiersz z magazynu zamowienia)
    $skus = @($items | ForEach-Object { ([string]$_.sku).Trim().ToUpperInvariant() } | Where-Object { $_ } | Select-Object -Unique)
    $skuList = ($skus | ForEach-Object { "'" + (Esc $_) + "'" }) -join ','
    $qA = @"
SET NOCOUNT ON;
SELECT 'ART|' + UPPER(LTRIM(RTRIM(a.INDEKS_KATALOGOWY))) + '|' + CAST(a.ID_ARTYKULU AS varchar(20)) + '|' +
       RTRIM(ISNULL(a.VAT_SPRZEDAZY, '23')) + '|' + ISNULL(j.SKROT, 'szt.') + '|' +
       REPLACE(CAST(ISNULL(j.PRZELICZNIK, 1) AS varchar(32)), ',', '.') + '|' +
       REPLACE(CAST(ISNULL(w.CenaNettoSprzedazyDomyslna, 0) AS varchar(32)), ',', '.') + '|' +
       REPLACE(CAST(ISNULL(w.CenaBruttoSprzedazyDomyslna, 0) AS varchar(32)), ',', '.')
FROM dbo.ARTYKUL a
LEFT JOIN dbo.JEDNOSTKA j ON j.ID_JEDNOSTKI = CASE WHEN ISNULL(a.ID_JEDNOSTKI_SPRZ, 0) > 0 THEN a.ID_JEDNOSTKI_SPRZ ELSE a.ID_JEDNOSTKI END
LEFT JOIN dbo.WIDOK_ARTYKUL w ON w.IdArtykulu = a.ID_ARTYKULU
WHERE a.ID_MAGAZYNU = $idMag
  AND UPPER(LTRIM(RTRIM(a.INDEKS_KATALOGOWY))) IN ($skuList);
"@
    $rA = Invoke-SqlFile $qA
    Remove-SqlFile $rA
    $art = @{}
    foreach ($line in (Get-Lines $rA.Text 'ART|')) {
      $p = $line.Trim().Split('|')
      if ($p.Count -ge 8 -and -not $art.ContainsKey($p[1])) {
        $art[$p[1]] = [pscustomobject]@{ Id = [int]$p[2]; Vat = $p[3]; Unit = $p[4]; Przel = $p[5]; CatNet = (ConvertTo-Num $p[6]); CatGross = (ConvertTo-Num $p[7]) }
      }
    }
    $missing = @($skus | Where-Object { -not $art.ContainsKey($_) })
    if ($missing.Count -gt 0) { throw ('Brak w WAPRO (INDEKS_KATALOGOWY, magazyn {0}): {1}' -f $idMag, ($missing -join ', ')) }

    # ---- pozycje: ceny i znacznik ceny
    $sbPos = New-Object System.Text.StringBuilder
    $lineNo = 0
    $priceNotes = New-Object System.Collections.Generic.List[string]
    foreach ($it in $items) {
      $sku = ([string]$it.sku).Trim().ToUpperInvariant()
      if (-not $sku) { continue }
      $a = $art[$sku]
      $lineNo++
      $qty = ConvertTo-Num $it.qty
      if ($null -eq $qty -or $qty -le 0) { $qty = 1.0 }
      $disc = ConvertTo-Num $it.discountPercent
      if ($null -eq $disc -or $disc -lt 0 -or $disc -ge 100) { $disc = 0.0 }

      $baseNet = ConvertTo-Num $it.priceSaleNet
      $baseGross = ConvertTo-Num $it.priceSaleGross
      if ($null -eq $baseNet -and $null -eq $baseGross) { $baseNet = $a.CatNet; $baseGross = $a.CatGross }
      $vatPct = 23.0
      [void][double]::TryParse($a.Vat, [System.Globalization.NumberStyles]::Float, $Inv, [ref]$vatPct)
      if ($null -eq $baseNet -and $null -ne $baseGross) { $baseNet = $baseGross / (1 + $vatPct / 100) }
      if ($null -eq $baseGross -and $null -ne $baseNet) { $baseGross = $baseNet * (1 + $vatPct / 100) }
      if ($null -eq $baseNet -or $null -eq $baseGross -or $baseNet -le 0) { throw ('Brak ceny sprzedazy dla {0} (ani w koszyku, ani w katalogu WAPRO)' -f $sku) }
      $net = [Math]::Round($baseNet * (1 - $disc / 100), 2)
      $gross = [Math]::Round($baseGross * (1 - $disc / 100), 2)

      $isCatalog = ($disc -eq 0) -and ($null -ne $a.CatNet) -and ([Math]::Abs($net - $a.CatNet) -lt 0.006) -and ([Math]::Abs($gross - $a.CatGross) -lt 0.011)
      $mark = if ($isCatalog) { 'k' } else { $customMark }
      if (-not $isCatalog) {
        $priceNotes.Add(('{0}: cena {1}/{2}{3}' -f $sku, (Format-Num $net '0.00'), (Format-Num $gross '0.00'), $(if ($disc -gt 0) { (' (rabat {0}%)' -f (Format-Num $disc)) } else { '' })))
      }

      $doRez = if ($reserve) { Format-Num $qty } else { '0' }
      $opis = ''
      [void]$sbPos.AppendLine(("  EXEC dbo.RM_DodajPozycjeZamowienia 0, @id, {0}, '{1}', {2}, 0, 0, {3}, {4}, {5}, 0, 0, {6}, '{7}', 0, '{8}', 0, 0, 0, 0, '{9}', '', 'nie dotyczy';" -f `
        $a.Id, (Esc ($a.Vat.PadRight(3))), (Format-Num $qty), $doRez, (Format-Num $net '0.00'), (Format-Num $gross '0.00'), $a.Przel, (Esc $a.Unit), (Esc $opis), $mark))
      [void]$sbPos.AppendLine('  EXEC dbo.RM_SumujZamowienie @id;')
    }
    if ($lineNo -eq 0) { throw 'Brak pozycji do przeniesienia' }

    $uwagiText = ('Katalog CRM: {0}. {1}' -f $clientName, $note).Trim()
    if ($uwagiText.Length -gt 900) { $uwagiText = $uwagiText.Substring(0, 900) }
    $autoRez = if ($reserve) { 1 } else { 0 }

    $sql = @"
SET NOCOUNT ON; SET XACT_ABORT ON;
DECLARE @id numeric(9,0), @user numeric(9,0) = $idUser, @kontr numeric(9,0) = $idKontr;
DECLARE @data int = DATEDIFF(day, '19000101', CAST(GETDATE() AS date)) + 36163;
DECLARE @dry bit = $(if ($DryRun) { 1 } else { 0 });
BEGIN TRY
  BEGIN TRAN;
  EXEC dbo.RM_DodajZamowienie_Server $idFirmy, @kontr, $idMag, 1, @data, @user, 0, '$(Esc $bruttoNetto)', 1, @id OUTPUT, 0;
  IF @id IS NULL OR @id = 0 RAISERROR('RM_DodajZamowienie_Server nie zwrocil ID zamowienia', 16, 1);
  UPDATE dbo.ZAMOWIENIE SET FORMA_PLATNOSCI = '$(Esc $forma)' WHERE ID_ZAMOWIENIA = @id;
$($sbPos.ToString())
  EXEC dbo.RM_KontrolaCenPozycjiZamowienia @id, @user;
  EXEC dbo.RM_ZatwierdzZamowienie @id, @kontr, $idTypu, '<auto>              ', 'ZO ######/`$`$', 1, 1, 2, 0, $idFirmy, $idMag, @data, @data, 0, 2, $autoRez, '$(Esc $nrKlienta)', 1, 0, 1, 0, '   ', 0, 1, 0, 0, 0, '$(Esc $uwagiText)', $idRachunku, '', '', 0, '$(Esc $forma)', $dni, 0, '', 0, 0;
  SELECT 'OK|' + CAST(@id AS varchar(20)) + '|' + RTRIM(NUMER) + '|' + CAST(WARTOSC_NETTO AS varchar(30)) + '|' + CAST(WARTOSC_BRUTTO AS varchar(30)) + '|' + CAST(FLAGA_STANU AS varchar(5))
    FROM dbo.ZAMOWIENIE WHERE ID_ZAMOWIENIA = @id;
  IF @dry = 1 ROLLBACK ELSE COMMIT;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK;
  SELECT 'ERR|' + CAST(ERROR_NUMBER() AS varchar(20)) + '|' + ISNULL(ERROR_PROCEDURE(), '') + '|' + REPLACE(REPLACE(ERROR_MESSAGE(), CHAR(13), ' '), CHAR(10), ' ');
END CATCH
"@
    $rRun = Invoke-SqlFile $sql
    $okLine = Get-Lines $rRun.Text 'OK|' | Select-Object -First 1
    $errLine = Get-Lines $rRun.Text 'ERR|' | Select-Object -First 1
    if ($errLine -or -not $okLine) {
      $detail = if ($errLine) { $errLine.Trim() } else { ('brak odpowiedzi SQL (kod {0}): {1}' -f $rRun.Code, $rRun.Text.Substring(0, [Math]::Min(300, $rRun.Text.Length))) }
      Write-Log ('SQL zlecenia {0}: {1} (plik: {2})' -f $id, $detail, $rRun.Sql)

      # sprzatanie: czy po bledzie zostal niezatwierdzony naglowek (ZO w edycji)?
      $qLeft = "SET NOCOUNT ON; SELECT 'LEFT|' + CAST(ID_ZAMOWIENIA AS varchar(20)) + '|' + CAST(FLAGA_STANU AS varchar(5)) FROM dbo.ZAMOWIENIE WHERE ID_UZYTKOWNIKA = $idUser AND ID_KONTRAHENTA = $idKontr AND FLAGA_STANU = 1 AND DATA_UTWORZENIA_WIERSZA >= DATEADD(minute, -10, GETDATE());"
      $rLeft = Invoke-SqlFile $qLeft
      Remove-SqlFile $rLeft
      $left = Get-Lines $rLeft.Text 'LEFT|' | Select-Object -First 1
      $extra = ''
      if ($left) {
        $lid = $left.Trim().Split('|')[1]
        $extra = (' Uwaga: w WAPRO moze pozostac niezatwierdzone ZO (ID {0}) - sprawdz i usun.' -f $lid)
      }
      throw ('WAPRO odrzucilo zamowienie: {0}.{1}' -f ($detail -replace '^ERR\|', ''), $extra)
    }
    Remove-SqlFile $rRun
    $op = $okLine.Trim().Split('|')
    $waproId = $op[1]
    $waproNr = $op[2]
    $prices = if ($priceNotes.Count -gt 0) { ' Ceny inne niz katalogowe: ' + ($priceNotes -join '; ') + '.' } else { '' }

    if ($DryRun) {
      # sprawdz, czy rollback faktycznie cofnal dokument
      $rChk = Invoke-SqlFile ("SET NOCOUNT ON; SELECT 'DUP|' + CAST(ID_ZAMOWIENIA AS varchar(20)) FROM dbo.ZAMOWIENIE WHERE NR_ZAMOWIENIA_KLIENTA = '$(Esc $nrKlienta)';")
      Remove-SqlFile $rChk
      $still = Get-Lines $rChk.Text 'DUP|' | Select-Object -First 1
      if ($still) {
        Write-Log ('TEST: UWAGA - WAPRO zatwierdzilo dokument mimo ROLLBACK: {0} (ID {1}). Usun je w WAPRO.' -f $waproNr, $waproId)
      } else {
        Write-Log ('TEST OK (cofniete): {0}, pozycji {1}, kontrahent {2} ({3}), netto {4}, brutto {5}, plat. {6}/{7} dni.{8}' -f $waproNr, $lineNo, $kontrName, $idKontr, $op[3], $op[4], $forma, $dni, $prices)
      }
      continue
    }

    $msg = ('ZO {0} utworzone w WAPRO (ID {1}), pozycji {2}, kontrahent {3}, netto {4}, brutto {5}.{6}' -f $waproNr, $waproId, $lineNo, $kontrName, $op[3], $op[4], $prices)
    Write-Log $msg
    Set-RequestStatus $id @{ status = 'done'; finished_at = (Get-Date).ToUniversalTime().ToString('o'); message = $msg; wapro_order_id = [decimal]$waproId; wapro_order_number = $waproNr }
  } catch {
    $err = $_.Exception.Message
    Write-Log ('Blad zlecenia {0}: {1}' -f $id, $err)
    if (-not $DryRun) {
      Set-RequestStatus $id @{ status = 'error'; finished_at = (Get-Date).ToUniversalTime().ToString('o'); message = $err }
    }
  }
}
Write-Log 'Koniec kolejki zamowien'
