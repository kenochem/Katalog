# Schowek: zamówienia katalog → WAPRO Mag (ZO)

**Status:** nieaktywne — hipoteza na późniejszy czas. Nie podłączone do UI ani do `C:\katalog-sync`.

Pomysł jak WFSync (Baselinker → Mag), tylko źródłem jest koszyk w katalogu.
SKU w katalogu = `INDEKS_KATALOGOWY` w WAPRO.

## Pliki w tym folderze

| Plik | Rola |
|------|------|
| `waproOrder.ts` | klient Supabase: payload + insert/select `wapro_order_requests` |
| `migration-wapro-order-requests.sql` | tabela + RLS (authenticated insert/select) |
| `sync-wapro-orders-server.ps1` | agent na Mag: pending → `RM_DodajZamowienie_Server` + pozycje |
| `ui-crm-snippet.md` | jak wyglądało podpięcie przycisku w CRM |

## Gdy wracamy do tematu

1. Przenieś pliki z powrotem (`src/lib/`, `supabase/`, `scripts/`).
2. Uruchom migrację w Supabase.
3. Uzupełnij `WAPRO_ORDER_*` w `katalog-sync.env` (wzór w `ui-crm-snippet.md`).
4. Harmonogram `-OnlyIfPending` dla agenta zamówień.
5. Przywróć UI z `ui-crm-snippet.md` w `CrmOrderView`.

Domyślnie ZO w **buforze** Mag (`TRYBREJESTRACJI=10`) — bezpieczniej na start.
