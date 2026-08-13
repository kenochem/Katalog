# Statystyki sprzedaży WAPRO w katalogu

Zakładka **Sprzedaż** pokazuje cache zsynchronizowanego zbiorczo z Mag WAPRO (okresy 1 / 3 / 6 / 12 miesięcy).

**Ilość i netto** liczone są **ze znakiem** (`SUM(pd.ILOSC)` bez `ABS`) — korekty faktur z ujemną ilością (np. −1) odejmują od wyniku okresu.

**Ops → Analiza sprzedaży** — koszyk wielu SKU, trend miesięczny, porównanie 12m vs poprzednie 12m, rotacja, ABC/XYZ, ranking kategorii, eksport CSV miesięczny.

### Schema v2 (miesiące + prev 12m)

Po aktualizacji `sync-wapro-stock-server.ps1` na Mag i `-SalesSyncOnly`, cache JSON zawiera:

- `monthly[]` — 12 miesięcy kalendarzowych (`yyyy-MM`, qty, netValue)
- `prev12m` — rolling 12–24 m wstecz (do porównania rok do roku)
- `schemaVersion: 2`

Stary cache (bez `monthly`) nadal działa — sumy 1/3/6/12 m; zaawansowana analiza pokaże komunikat o sync.

## Architektura

1. **Agent na serwerze WAPRO** uruchamia **jedno SQL** (`GROUP BY` SKU) i zapisuje wynik w kolumnach `products.wapro_sales_stats` + `wapro_sales_synced_at`.
2. **Frontend** czyta cache z Supabase — bez czekania na pojedyncze zapytania per produkt.
3. **Odśwież z Mag** w UI → `sales_sync_requests` (pending) → agent odpala ten sam bulk sync.

## Harmonogram (serwer WAPRO)

**Sync nocny sprzedaży** (zalecane 1× dziennie, np. 03:00):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1 -SalesSyncOnly
```

Albo dwuklik: `run-wapro-sales-sync.bat`

**Stany** — osobno, jak dotychczas co ~2 min z `-OnlyIfPending` (nie obciąża Mag sprzedażą).

**Ręczny sync z UI** — `-OnlyIfPending` przetwarza też `sales_sync_requests` (jedno SQL, gdy użytkownik kliknie Odśwież).

## Supabase (Dashboard → SQL Editor)

1. `supabase/migration-product-wapro-sales-stats.sql` — kolumny cache na `products`
2. `supabase/migration-sales-sync-requests.sql` — kolejka zleceń sync (jak stany)

Stara tabela `wapro_sales_requests` nie jest już używana przez UI (można zostawić).

## Pliki na serwerze

- `C:\katalog-sync\sync-wapro-stock-server.ps1` — agent (stany + bulk sprzedaż)
- `C:\katalog-sync\katalog-sync.env` — bez zmian

Test bulk na serwerze:

```powershell
powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1 -SalesSyncOnly
```

Diagnostyka pojedynczego SKU (opcjonalnie):

```powershell
powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1 -DiagnoseSalesSku SON000083
```

## Frontend

https://kenochem-katalog.web.app — zakładka Sprzedaż (uprawnienie **Ceny i marża**).
