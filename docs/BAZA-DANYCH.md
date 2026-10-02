# Baza danych (Supabase)

> Stan: 2026-10-02. Projekt Supabase jest jeden dla wszystkich aplikacji. Schemat: `supabase/schema.sql` + pliki `supabase/migration-*.sql`.

## Zasady pracy z migracjami

- Migracje uruchamiamy **ręcznie**: Dashboard → *SQL Editor* → wklej plik → *Run*. Projekt **nie używa** `supabase db push`.
- Każdy plik jest idempotentny (`create … if not exists`, `drop policy if exists`) i ma w nagłówku komentarz z zależnościami — przeczytaj go przed uruchomieniem.
- Nowa funkcja z nową tabelą = nowy plik `migration-<nazwa>.sql` w repo **oraz** informacja o konieczności ręcznego uruchomienia (w opisie zmiany / dzienniku aktualizacji).
- Dopóki migracja nie jest uruchomiona, odpowiednie ekrany działają „na sucho" (puste stany), ale zapis kończy się błędem.

## Tabele wg obszarów

### Katalog i produkty
| Tabela | Rola |
|--------|------|
| `products` | Główna tabela produktów obu katalogów (Akcesoria i Produkty; unikalność SKU per katalog). Pola: stan, ceny zakupu/sprzedaży netto i brutto, zdjęcia, kategoria, producent, `product_meta` (JSONB), `warehouse_location`, `wapro_sales_stats`, `wapro_sales_synced_at`, tagi |
| `kits` | Zestawy (komplety) |
| `product_collections` | Foldery użytkownika z produktami |
| `user_favorites` | Ulubione (chmura) |
| `catalog_product_overrides` | Nadpisania opisu/kategorii z *Katalogów marek* (Biblioteka) — klucz `catalog_slug` + `sku` |
| `technical_library_articles` | Edytowalna treść zeszytów Biblioteki Technicznej |

Ważne pola `product_meta` (JSONB): `baselinkerProductId`, `shopCategoryPath` / `shopCategoryWpId` (kategoria ze sklepu), `categoryAssignedBy/At`, `waproImport` / `waproSkeleton` / `waproImportedAt` (produkt dopisany przez auto-import z Mag → zakładka *Nowości*), `salesExcludeFromSum` (wykluczenie z martwego stocku i KPI — wspólne dla zespołu), `catalogHidden` (ukryty w katalogu), `shortDescription`, `parameters`.

### Synchronizacja z WAPRO
| Tabela | Rola |
|--------|------|
| `stock_sync_requests` | Zlecenia syncu stanów z aplikacji (`pending → running → done/error`, zakres `all/accessories/shop`) |
| `sales_sync_requests` | Zlecenia syncu sprzedaży z Operacji |
| `product_sync_changes` | Log realnych zmian stanu/cen per SKU per przebieg syncu (od 24.09.2026); zasila *Logi* i *Zmiany w czasie*. **Brak auto-czyszczenia** |
| `wapro_order_requests` | Zlecenia „zamówienie do WAPRO (ZO w buforze)" z koszyka CRM (przycisk tylko dla admina) — wymaga agenta po stronie serwera, patrz [`future/wapro-orders`](./future/wapro-orders/README.md) |
| `wapro_sales_requests` | Stara kolejka sprzedaży per SKU — już nieużywana przez UI |

### CRM
`crm_clients`, `crm_orders` (zamówienia i oferty; numeracja ofert), `crm_leads` (lejek), `crm_calendar_events` (kalendarz — **wspólny dla zespołu**), `crm_tasks`, `crm_notes`, `crm_client_notes`, `crm_user_settings`, `crm_mailbox_settings` / `crm_mailbox_credentials` / `crm_inbox_sync` (skrzynka e-mail IMAP/SMTP).

### Operacje
`ops_customers` (kontrahenci z WAPRO). Dane kosztowe Ops są ładowane m.in. z pliku `public/data/finance-koszty.json` (generowanego przez `npm run export:finance`), a analiza sprzedaży z `products.wapro_sales_stats`.

### Konta, role, ustawienia
`profiles` (rola, nazwa wyświetlana, avatar, `active`), `app_role_matrix` (nadpisania macierzy uprawnień), `app_settings` (flagi globalne edytowane przez admina, np. `crmMailEnabled`).

### Czat (Talk — chwilowo wyłączony)
`chat_threads`, `chat_thread_members`, `chat_messages`, `chat_message_reactions`, `chat_message_reads`, `chat_message_thanks`, `chat_push_subscriptions`, `chat_push_logs`.

## Kolejność uruchamiania (nowa instalacja)

1. `schema.sql` → `migration-catalog.sql`, `migration-stock.sql`, `migration-product-meta.sql`, `migration-product-prices.sql`, `migration-product-tags.sql`, `migration-extra-images.sql`, `migration-sku-per-catalog.sql`, `migration-warehouse-location.sql`
2. Konta i role: `migration-auth-profiles.sql`, `migration-user-sync-all.sql`, `migration-user-cloud-platform.sql` (definiuje `is_admin()`; wymagana m.in. przez `migration-app-settings.sql`), `migration-user-favorites*.sql`, `migration-product-collections.sql`, `migration-groups.sql`
3. Synchronizacja WAPRO: `migration-stock-sync-requests.sql`, `migration-stock-sync-catalog.sql`, `migration-product-wapro-sales-stats.sql`, `migration-sales-sync-requests.sql`, `migration-product-sync-changes.sql`, `migration-wapro-order-requests.sql`
4. CRM: `migration-crm-clients-orders.sql`, `migration-crm-client-*.sql`, `migration-crm-lead-owner.sql`, `migration-crm-notes.sql`, `migration-crm-personal-stores.sql`, `migration-crm-quote-number.sql`, `migration-crm-mailbox.sql`
5. Ops: `migration-ops-customers.sql`
6. Biblioteka: `migration-technical-library.sql`, `migration-catalog-brand-overrides.sql`
7. Ustawienia: `migration-app-settings.sql`
8. Czat (jeśli włączany): `migration-chat*.sql`

Jednorazowe czyszczenie: `cleanup-wapro-x-skeleton-products.sql` (usuwa szkielety pozycji archiwalnych „X…").

## Row Level Security — co warto wiedzieć

- `products`: odczyt otwarty (także dla gościa i klucza anon) — katalog jest publicznym podglądem; zapis dla zalogowanych wg ról.
- Tabele operacyjne i logi (`product_sync_changes`, `sales_sync_requests` i podobne) mają `select` **tylko dla `authenticated`**. Zapytanie kluczem anon zwraca pustą listę — **to nie znaczy, że tabela jest pusta**. Przy diagnozie sprawdzaj w SQL Editor lub po zalogowaniu.
- Zapisy agenta WAPRO idą kluczem `service_role` (omija RLS) — dlatego dla `product_sync_changes` nie ma polityki `insert`.
- Klucz `anon` jest w froncie z założenia publiczny; **`service_role` nigdy** nie trafia do frontu ani do repozytorium.

## Edge Functions (`supabase/functions/`)

| Funkcja | Po co |
|---------|-------|
| `admin-users` | Tworzenie kont i zarządzanie użytkownikami z panelu admina (używa service role po stronie serwera) |
| `nip-lookup` | Wyszukiwanie firmy po NIP w białej liście VAT (MF) — dodawanie klientów CRM |
| `crm-mail` | Skrzynka e-mail w CRM: pobieranie IMAP i wysyłka SMTP (hasło tylko po stronie serwera) |
| `chat-push` | Powiadomienia Web Push dla czatu (deploy z `--no-verify-jwt`: `npm run deploy:chat-push`) |
| `image-proxy` | Proxy obrazów (omijanie blokad hotlinkingu / CORS) |
| `product-knowledge` | API dla botów uzupełniających wiedzę o produktach — wymaga sekretu `KNOWLEDGE_BOT_SECRET`, patrz [`products/KNOWLEDGE-BOT-API.md`](./products/KNOWLEDGE-BOT-API.md) |

Deploy: `npx supabase functions deploy <nazwa>` (po `npx supabase login` i `npx supabase link --project-ref <ref>`).

## Storage

Bucket `product-images` (public) — zdjęcia produktów (upload z aplikacji; kompresja po stronie klienta). Dodatkowe buckety (np. głosówki czatu) tworzą odpowiednie migracje `migration-chat-*.sql`.
