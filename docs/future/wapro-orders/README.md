# Schowek: zamówienia katalog → WAPRO Mag (ZO)

**Status (2026-10-07):** agent przepisany na podstawie nagrania wywołań WAPRO — `scripts/sync-wapro-orders-server.ps1` (tworzy ZO w transakcji: nagłówek → pozycje + sumowanie → kontrola cen → zatwierdzenie z numeracją WAPRO; kontrahent po NIP; artykuł z magazynu zamówienia; idempotencja po `NR_ZAMOWIENIA_KLIENTA = KAT-<id>`). Tryb próbny: `-DryRun` (dokument tworzony i cofany). Diagnostyka i nagrywanie: `scripts/wapro-orders-diagnose*.sql`, `scripts/wapro-trace-*.sql`. Stary szkic (błędne parametry, użytkownik `1`) został usunięty.

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
