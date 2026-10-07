# Synchronizacja z WAPRO Mag — runbook

> Stan: 2026-10-02. Dokument operacyjny dla serwera WAPRO. Źródło prawdy dla **stanów, cen i sprzedaży** to WAPRO Mag; do Supabase trafia przez agenta PowerShell. Szczegóły techniczne sprzedaży: [`products/WAPRO-SALES-STATS.md`](./products/WAPRO-SALES-STATS.md).

## Jak to działa

```
WAPRO Mag (SQL Server, baza WAPRO)
        │  sqlcmd (localhost)
        ▼
C:\katalog-sync\sync-wapro-stock-server.ps1      ← agent, uruchamiany z Harmonogramu zadań
        │  REST (service_role)
        ▼
Supabase: products, stock_sync_requests, sales_sync_requests, product_sync_changes
        ▲
        │  zlecenia z aplikacji (przyciski „Sync WAPRO”, „Sync z Mag WAPRO”)
   Aplikacje (Katalog, Handel, Operacje)
```

Agent **nie jest wdrażany automatycznie**. Po każdej zmianie w repo skopiuj plik ręcznie:

| Z (repo) | Na serwer WAPRO |
|----------|-----------------|
| `scripts/sync-wapro-stock-server.ps1` | `C:\katalog-sync\sync-wapro-stock-server.ps1` |

(Albo na serwerze: `powershell -File scripts\install-katalog-sync.ps1` z repo — kopiuje skrypt i szablon `.env`.)

## Co robi pełny sync

1. **Stany i ceny** — zapytanie do `dbo.ARTYKUL` **tylko dla magazynu głównego** (`ID_MAGAZYNU = 1`). WAPRO ma więcej magazynów (np. 2 = Stacja Dobrzyniewo, 3 = Stacja Kolno); bez tego filtra stany sumowały się z wszystkich i były zawyżone. Stany i ceny ustawiane są **dokładnie jak w Mag** (w górę i w dół). Nie nadpisuje `products.stock_manual = true`.
2. **Dopasowanie do produktów** po SKU (`INDEKS_KATALOGOWY`) w obu katalogach (Akcesoria i Produkty). Niedopasowane trafiają do `sync-unmatched-products.json/.csv`.
3. **Log zmian** — przed zapisem agent porównuje stary i nowy stan/cenę (zakup netto, sprzedaż netto, sprzedaż brutto) i zapisuje tylko **realne zmiany** do `product_sync_changes` (paczki po 300). Wszystkie wiersze jednego przebiegu mają ten sam `changed_at`. Zasila zakładki *Logi → Szczegółowe zmiany* i *Zmiany w czasie*. Historia istnieje **od 24.09.2026** — wcześniej nic nie było zapisywane.
4. **Auto-import nowych SKU** — pozycje z Mag, których nie ma w katalogu, są dopisywane jako szkielety (`product_meta.waproImport`, `waproSkeleton`, `waproImportedAt`) i widać je w *Nowości → Nowe produkty*. Pomijane są:
   - pozycje „archiwalne" (SKU lub nazwa zaczyna się od **X**),
   - **puste szkice** zakładane w Mag i nigdy nieuzupełnione (nazwa „nowy artykuł (ID)" / SKU w formie `(12345)`).
   Wyłączenie auto-importu: `WAPRO_AUTO_IMPORT=0` w `katalog-sync.env`.
5. **Eksport katalogu Mag** do `wapro-mag-catalog.json` (wejście dla auto-importu).
6. **Sprzedaż** (zakładka *Sprzedaż* na karcie produktu i Operacje) odświeża się po pełnym syncu stanów: w zaplanowanym zadaniu dziennym (bez `-OnlyIfPending`), jeśli ostatni przebieg był ≥ 20 h temu, oraz gdy czeka zlecenie z aplikacji (nie częściej niż co 20 min). Znacznik ostatniego przebiegu: `C:\katalog-sync\sales-last-run.txt`. Wyłączenie: `WAPRO_RUN_SALES_AFTER_STOCK=0`. Ręcznie: `-SalesSyncOnly`.

## Sync sprzedaży (Operacje)

Osobny tryb, bo ciężki: **jedno zbiorcze SQL** po dokumentach sprzedaży (`DOKUMENT_HANDLOWY` + `POZYCJA_DOKUMENTU_MAGAZYNOWEGO`) agreguje sprzedaż per SKU i zapisuje w `products.wapro_sales_stats` + `wapro_sales_synced_at`.

- Zapytania mają warianty: `extended_v2` (rozbicie na 12 miesięcy kalendarzowych + porównanie z poprzednimi 12 mc), `extended_v2_no_rodzaj`, `bulk_v1` (same sumy 1/3/6/12 m), `bulk_v1_no_rodzaj`. Agent bierze pierwszy, który zadziała. Jeśli w logu widać `schema=v1`, to warianty `extended_*` zgłosiły błąd SQL — pełny komunikat jest w logu (`blad sqlcmd exit=…: <tekst>`).
- Jeden zepsuty produkt **nie przerywa** syncu — jest pomijany i logowany z SKU i komunikatem; na końcu: `zaktualizowano / bez zmian / wyczyszczono / pominieto`.
- W aplikacji: *Operacje → Martwy stock / Analiza sprzedaży* → **Sync z Mag WAPRO** tworzy wiersz w `sales_sync_requests`; baner pokazuje, jak dawno dane były zsynchronizowane.

Ręcznie na serwerze:

```powershell
powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1 -SalesSyncOnly
```

## Harmonogram zadań (Task Scheduler)

Produkcyjnie działają dwa zadania (nazwy mogą się różnić od tych z `install-katalog-stock-schedule.ps1`):

| Zadanie | Wyzwalacz | Argumenty | Po co |
|---------|-----------|-----------|-------|
| **Katalog sync WAPRO** | codziennie 07:00 | _(brak)_ | Pełny sync stanów/cen, auto-import nowych SKU |
| **Manual sync** | co **2 min** | `-OnlyIfPending` | Odbiera zlecenia z aplikacji (stany i sprzedaż). Bez zlecenia kończy się od razu (kilka KB ruchu) |

Akcja obu zadań: program `powershell.exe`, argumenty `-ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1 [-OnlyIfPending]` (`-NoProfile` opcjonalnie).

Skrypt `install-katalog-stock-schedule.ps1` tworzy analogiczny zestaw (`Kenochem-WaproStockDaily`, `Kenochem-WaproStockOnDemand` co 15 min, opcjonalnie `Kenochem-WaproSalesDaily`). Interwał „na żądanie" ustawia się parametrem `-OnDemandMinutes`.

> **Dlaczego interwał ma znaczenie:** zlecenie z aplikacji czeka w kolejce, aż zadanie „na żądanie" je zauważy. Przy 60 min kliknięcie „Sync WAPRO" potrafi czekać godzinę (UI czeka tylko ok. 3 min); przy 2 min – praktycznie od razu.

Ważne ustawienia zadania: **„Uruchom niezależnie od tego, czy użytkownik jest zalogowany"** — inaczej po wylogowaniu z serwera zadanie się nie wykona (błąd `0x800710E0`).

## Flagi skryptu

| Flaga | Działanie |
|-------|-----------|
| _(brak)_ | Pełny sync stanów/cen (+ auto-import, log zmian) |
| `-OnlyIfPending` | Wykonuje pracę tylko, gdy w `stock_sync_requests` / `sales_sync_requests` jest zlecenie `pending`; inaczej kończy od razu |
| `-SalesSyncOnly` / `-SalesOnly` | Tylko zbiorczy sync sprzedaży |
| `-DiagnoseSku <SKU>` | Pokazuje, co SQL zwraca dla jednego SKU (np. weryfikacja stanu) |
| `-DiagnoseSalesSku <SKU>` / `-DiagnoseSalesSchema` | Diagnostyka zapytań sprzedaży |
| `-DiagnosePriceSchema` | Sonda schematu cen w Mag |

## Konfiguracja (`C:\katalog-sync\katalog-sync.env`)

Wzorzec: `scripts/katalog-sync.env.example`. **Nigdy nie commitujemy prawdziwego pliku** (`service_role` daje pełny dostęp do bazy).

| Zmienna | Znaczenie |
|---------|-----------|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Dostęp do bazy (wymagane) |
| `WAPRO_SQL_SERVER` / `WAPRO_SQL_DATABASE` | Gdy `sqlcmd` nie łączy się z `localhost` / bazą `WAPRO` |
| `WAPRO_PRICE_SQL`, `WAPRO_PRICE_CSV` | Własne zapytanie / CSV cen, gdy standardowy eksport nie zwraca cen |
| `WAPRO_AUTO_IMPORT=0` | Wyłącza auto-import nowych SKU |
| `WAPRO_AUTO_SYNC_MINUTES=10` | Zadanie `-OnlyIfPending` bez zleceń z aplikacji robi pełny sync stanów/cen co tyle minut (domyślnie 10; `0` = tylko na zlecenie i w zadaniu dziennym). Znacznik: `stock-last-full-run.txt` |
| `WAPRO_RUN_SALES_AFTER_STOCK=0` | Wyłącza automatyczne odświeżanie sprzedaży po syncu stanów (domyślnie włączone: raz dziennie + na zlecenie) |

## Pliki na serwerze

| Plik | Zawartość |
|------|-----------|
| `sync.log` | Log wszystkich uruchomień (zaczynaj diagnozę od niego) |
| `wapro-stock.raw`, `wapro-sales-bulk-*.raw` | Surowe wyjścia `sqlcmd` |
| `wapro-mag-catalog.json` | Katalog Mag dla auto-importu |
| `sync-unmatched-products.json/.csv` | SKU z Mag bez dopasowania w katalogu |

## Zasady edycji skryptu (ważne — to już raz zepsuło sync)

Skrypt jest uruchamiany przez **Windows PowerShell 5.1** i zapisany jako UTF-8 **bez BOM**.

1. **Żadnych polskich znaków w kodzie** (w tym w wyrażeniach regularnych). PowerShell 5.1 czyta plik w ANSI i zamienia je na śmieci; znak w klasie `[…]` w regexie wywala parser całego pliku. Komunikaty i komentarze piszemy bez ogonków (jak reszta pliku).
2. **Nie owijaj `List[object]` w `@(...)`** gdy lista powstała przez `New-Object` — w PS 5.1 rzuca to `Argument types do not match`. Twórz `[System.Collections.Generic.List[object]]::new()` i zwracaj `.ToArray()`.
3. Po edycji sprawdź parser (także w trybie ANSI):
   ```powershell
   $t=$null;$e=$null
   [System.Management.Automation.Language.Parser]::ParseFile('scripts\sync-wapro-stock-server.ps1',[ref]$t,[ref]$e) | Out-Null
   $e.Count   # oczekiwane: 0
   ```
4. Skopiuj plik na serwer (tabela wyżej).

## Rozwiązywanie problemów

> **Historia (2026-10-06):** do tej pory pusta odpowiedź z listy zleceń (`[]`) była liczona jako „1 zlecenie bez ID" — agent robił pełny sync co 2 min, a przy próbie oznaczenia zlecenia logował `Nie udalo sie zaktualizowac statusu zlecenia : (400)`. Naprawione filtrem pustych ID. Zapytanie sprzedaży `extended_v2` miało przecinek przed `FROM` (`Incorrect syntax near the keyword 'FROM'`) i zawsze spadało do `bulk_v1` (bez rozbicia miesięcznego) — też naprawione.

| Objaw | Przyczyna / działanie |
|-------|------------------------|
| Stany w katalogu stoją, brak nowych wpisów w `sync.log` | Zadanie nie startuje: sprawdź *Ostatni wynik* w Harmonogramie. `0x800710E0` → ustaw „Uruchom niezależnie od tego, czy użytkownik jest zalogowany" |
| `running scripts is disabled on this system` | Uruchamiaj z `-ExecutionPolicy Bypass` |
| Parser: `Unexpected token`, `Missing …`, krzaki typu `Ĺ‚` | Polski znak w kodzie skryptu — usuń (zasada 1) |
| `Argument types do not match` w sync sprzedaży | `@()` na `List[object]` (zasada 2) |
| Stan w katalogu wyższy niż w Mag | Brak filtra `ID_MAGAZYNU = 1` (suma z kilku magazynów); zweryfikuj `-DiagnoseSku <SKU>` |
| Sprzedaż w Ops „47 dni temu" | Nikt nie odpalił sync sprzedaży. Kliknij *Sync z Mag WAPRO* albo uruchom `-SalesSyncOnly`; zlecenie odbiera zadanie `-OnlyIfPending` |
| `Bulk sprzedaz wariant extended_v2: blad sqlcmd …` | Treść błędu SQL jest w logu; do czasu naprawy działa wariant `bulk_v1` (bez rozbicia miesięcznego) |
| Puste „Nowe produkty" mimo nowych SKU w Mag | Auto-import wyłączony (`WAPRO_AUTO_IMPORT=0`), pozycje archiwalne (X…) lub puste szkice — są celowo pomijane |
| Gość widzi puste logi / zmiany w czasie | Tabele logów są tylko dla zalogowanych (RLS) — to nie błąd |

## Zamówienia CRM → WAPRO (ZO)

Przycisk **Do WAPRO** w koszyku CRM (admin) tworzy zlecenie w `wapro_order_requests`. Agent `scripts/sync-wapro-orders-server.ps1` (kopiowany do `C:\katalog-sync\`) zamienia je na zamówienie od odbiorcy w Mag — tak samo jak program WAPRO (nagłówek → pozycje z sumowaniem → kontrola cen → zatwierdzenie z numeracją WAPRO), w jednej transakcji.

- **Kontrahent:** po NIP klienta z CRM (`KONTRAHENT.NIP`); brak → błąd z komunikatem albo kontrahent zastępczy (`WAPRO_ORDER_ID_KONTRAHENTA`). Płatność i termin z karty kontrahenta.
- **Pozycje:** SKU = `INDEKS_KATALOGOWY`, wiersz z magazynu zamówienia (każdy indeks ma po jednym wierszu na magazyn); VAT i jednostka z kartoteki; rezerwacja jak w programie (`WAPRO_ORDER_RESERVE=0` wyłącza).
- **Numer zamówienia klienta** w WAPRO: `H` + 7 znaków identyfikatora zlecenia (8 znaków). Służy też do wykrywania duplikatów — to samo zlecenie nie utworzy drugiego ZO.
- **Użytkownik:** `WAPRO_ORDER_ID_UZYTKOWNIKA` musi być istniejącym ID użytkownika WAPRO (np. 3000001 = admin). Nieistniejące ID (np. `1`) zostawia zablokowane, nieusuwalne zamówienie.

### Procedura krok po kroku

1. **Test bez śladu:** `powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-orders-server.ps1 -DryRun` — tworzy ZO i cofa transakcję, loguje wynik (`TEST OK (cofniete): ZO …`); status zlecenia się nie zmienia.
2. **Pojedyncze zlecenie:** `… -RequestId <id zlecenia>` albo bez parametrów (wszystkie czekające).
3. **Automat:** w Harmonogramie zadań zadanie uruchamiane co 1 min: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-orders-server.ps1 -OnlyIfPending` (to samo konto i opcje, co zadanie syncu stanów; „Uruchom niezależnie od tego, czy użytkownik jest zalogowany").
4. **Podgląd:** log `C:\katalog-sync\orders.log`; status i numer ZO w `wapro_order_requests` (`done` / `error` z opisem).
5. **Błąd:** zlecenie ma status `error` z powodem (brak kontrahenta, brak SKU, odmowa WAPRO). Popraw przyczynę i wyślij zamówienie ponownie z CRM (nowe zlecenie).
6. **Zablokowane ZO po awarii:** `scripts/wapro-orders-unlock-orphan.sql` (zmień ID zamówienia i `@zatwierdz`), potem usuń je w WAPRO.

### Diagnostyka struktury WAPRO

`scripts/wapro-orders-diagnose*.sql` (struktura tabel/procedur, bez haseł) i `scripts/wapro-trace-{1-start,2-read,3-stop}.sql` (nagranie wywołań procedur przy tworzeniu ZO w programie — Extended Events).
