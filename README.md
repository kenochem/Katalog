# Katalog — Kenochem

Wewnętrzna platforma Kenochem: **katalog produktów** (stany, ceny, zdjęcia, kategorie), **CRM i oferty**, **Operacje** (finanse, sprzedaż, martwy stock), kalendarz i magazyn — jedna baza kodu, osiem osobnych aplikacji (PWA).

- Stack: **React 19 + Vite + TypeScript + Tailwind**, baza / Auth / storage / Edge Functions w **Supabase**, hosting na **Firebase Hosting**.
- Dane źródłowe: **WAPRO Mag** (stany, ceny, sprzedaż — przez agenta PowerShell na serwerze), **BaseLinker / sklep kenochem** (opisy, zdjęcia, kategorie).
- Repozytorium: [github.com/kenochem/Katalog](https://github.com/kenochem/Katalog) · użycie wewnętrzne.

## Aplikacje (produkty)

| Produkt | URL | Moduły | Do czego |
|---------|-----|--------|----------|
| **Katalog** | [kenochem-katalog.web.app](https://kenochem-katalog.web.app) | katalog | Praca na produktach: wyszukiwanie, stany, zdjęcia, kategorie, nowości, logi syncu |
| **Suite** | [kenochem-f4a5b.web.app](https://kenochem-f4a5b.web.app) | — (launcher) | Centrum narzędzi: kafelki aplikacji wg roli, zbiorcze powiadomienia, stan syncu WAPRO, własne oferty, przewodnik. **Bez** katalogu/CRM w środku |
| **Handel** | [kenochem-sell.web.app](https://kenochem-sell.web.app) | katalog + CRM | Handlowiec: koszyk, oferty PDF, klienci, lejek, mapa |
| **Magazyn** | [kenochem-stock.web.app](https://kenochem-stock.web.app) | katalog (tryb magazyn) | Stany, etykiety, lokalizacje, układ magazynu |
| **Operacje** | [kenochem-ops.web.app](https://kenochem-ops.web.app) | Ops | Finanse, marże, analiza sprzedaży, martwy stock |
| **Kalendarz** | [kenochem-calendar.web.app](https://kenochem-calendar.web.app) | kalendarz | Plan, wizyty, dostawy |
| **Talk** | [kenochem-talk.web.app](https://kenochem-talk.web.app) | czat | Czat zespołu — **chwilowo wyłączony** (`TALK_SUSPENDED`) |
| **Logistyka** | [kenochem-logistics.web.app](https://kenochem-logistics.web.app) | — | Placeholder |

Szczegóły: [`docs/products/URLS.md`](docs/products/URLS.md), architektura: [`docs/products/ARCHITECTURE.md`](docs/products/ARCHITECTURE.md).

## Szybki start

```bash
npm install
cp .env.example .env        # uzupełnij VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY
npm run dev:catalog         # tylko katalog (http://localhost:5173)
npm run dev                 # Suite (launcher: kafelki, powiadomienia, statystyki, przewodnik)
```

Inne tryby deweloperskie: `dev:sell`, `dev:stock`, `dev:ops`, `dev:calendar`, `dev:talk`.
Wdrożenie i lista komend: [`docs/WDROZENIE.md`](docs/WDROZENIE.md).

## Dokumentacja

Pełny indeks ze statusem aktualności: [`docs/README.md`](docs/README.md). Najważniejsze:

| Dokument | O czym |
|----------|--------|
| [`docs/KATALOG-FUNKCJE.md`](docs/KATALOG-FUNKCJE.md) | Przewodnik po funkcjach katalogu, menu i rolach |
| [`docs/WAPRO-SYNC.md`](docs/WAPRO-SYNC.md) | **Runbook serwera WAPRO** — sync stanów/cen/sprzedaży, harmonogram, rozwiązywanie problemów |
| [`docs/BAZA-DANYCH.md`](docs/BAZA-DANYCH.md) | Supabase: tabele, migracje, RLS, Edge Functions |
| [`docs/WDROZENIE.md`](docs/WDROZENIE.md) | Build, deploy, checklista wydania, dziennik aktualizacji |
| [`docs/products/ARCHITECTURE.md`](docs/products/ARCHITECTURE.md) | Jak kod dzieli się na aplikacje i moduły |
| [`docs/ROZWÓJ.md`](docs/ROZWÓJ.md) | Stan projektu, dług techniczny, backlog |

## Struktura repozytorium

```
src/
  main.tsx            # wejście — wybiera aplikację wg VITE_APP_PRODUCT
  App.tsx             # wspólna aplikacja: katalog / handel / operacje
  app/                # moduleRegistry (produkty, branding), dostęp, układ
  suite/              # Suite: launcher (kafelki, zbiorcze statystyki i powiadomienia z bazy)
  modules/            # kod per moduł: crm, ops, comms, stock, calendar, logistics…
  components/         # UI (katalog, CRM, Ops, magazyn, hub)
  lib/                # Supabase, auth, role, wyszukiwanie, synchronizacje, formatowanie
  data/               # dane w kodzie (np. appChangelog.ts — dziennik aktualizacji)
public/               # PWA (manifesty, ikony), dane statyczne (data/*.json), Biblioteka
scripts/              # importy (WAPRO, BaseLinker, sklep), agent sync WAPRO (.ps1), build
supabase/             # schema.sql, migracje, Edge Functions
docs/                 # dokumentacja
data/                 # lokalne eksporty robocze
```

## Role

| Rola | Zakres (skrót) |
|------|----------------|
| **Gość** | Podgląd katalogu ze zdjęciami — bez cen, edycji, CRM, Ops |
| **Handlowiec** | Edycja/dodawanie produktów, zdjęcia, etykiety, zestawy, ceny i marża, CRM, Operacje (podgląd) — bez stanów i kont |
| **Magazynier** | Edycja stanów, zdjęcia, etykiety, postęp zdjęć — bez cen i CRM |
| **Operator** | Pełna praca (ceny, CRM, Ops, usuwanie) — bez zarządzania kontami i macierzą uprawnień |
| **Admin** | Wszystko, w tym konta, macierz uprawnień i przyciski administracyjne (np. zamówienie do WAPRO) |

Źródłem prawdy jest macierz w [`src/lib/roleDefinitions.ts`](src/lib/roleDefinitions.ts) (domyślna) z nadpisaniami z bazy (`app_role_matrix`, edytowalna przez admina). Konta zakłada administrator — nie ma publicznej rejestracji.

## Dane i synchronizacja — w pigułce

```
WAPRO Mag (SQL Server)
   └─ agent: C:\katalog-sync\sync-wapro-stock-server.ps1  (Harmonogram zadań)
        ├─ stany + ceny  ──►  Supabase.products            (codziennie 07:00 + na żądanie)
        ├─ sprzedaż      ──►  products.wapro_sales_stats   (na żądanie z Ops / -SalesSyncOnly)
        ├─ log zmian     ──►  product_sync_changes         (od 24.09.2026)
        └─ nowe SKU      ──►  products (szkielety)         (zakładka „Nowości”)
BaseLinker / sklep ──► skrypty import:* ──► products (opisy, zdjęcia, kategorie)
Aplikacje (React) ◄── Supabase (RLS wg ról)
```

Kopiowanie skryptu na serwer jest **ręczne** (nie ma automatycznego deployu na maszynę WAPRO) — patrz [`docs/WAPRO-SYNC.md`](docs/WAPRO-SYNC.md).

## Konfiguracja Supabase (jednorazowo)

1. **Schemat i migracje** — Dashboard → *SQL Editor*: uruchom `supabase/schema.sql`, potem wymagane migracje (lista i kolejność: [`docs/BAZA-DANYCH.md`](docs/BAZA-DANYCH.md)). Migracje uruchamiamy ręcznie w SQL Editor — projekt nie używa `supabase db push`.
2. **Auth** — Providers → Email włączony, **wyłączone** „Allow new users to sign up". Pierwsze konto: Authentication → Users → *Add user*, potem:
   ```sql
   update public.profiles set role = 'admin', display_name = 'Admin', active = true
   where email = 'twoj@email.pl';
   ```
3. **Edge Functions** (`admin-users`, `nip-lookup`, `crm-mail`, `chat-push`, `image-proxy`, `product-knowledge`):
   ```bash
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase functions deploy <nazwa>
   ```
4. **Storage** — bucket `product-images` (public) z politykami z `schema.sql`.
5. **`.env`** (lokalnie, nie commitujemy): zmienne opisane w [`.env.example`](.env.example). `SUPABASE_SERVICE_ROLE_KEY` tylko dla skryptów CLI i serwera WAPRO — **nigdy w froncie ani w repo**.

## Zamówienia na Discord

Ustaw `VITE_DISCORD_ORDERS_WEBHOOK` w `.env` (webhook kanału), zrób **nowy build i deploy** — zmienne `VITE_*` wchodzą do bundla przy buildzie. Bez webhooka przycisk kopiuje treść zamówienia do schowka.

## Skrypty importu (CLI)

Importy działają na plikach eksportów i Supabase (Python `py` + Node). Najczęściej używane:

| Komenda | Co robi |
|---------|---------|
| `npm run import:baselinker` / `import:baselinker-enrich:apply` | Produkty ze sklepu (opisy, zdjęcia, EAN) z eksportu BaseLinker |
| `npm run sync:wapro-stock` | Jednorazowy sync stanów/cen z lokalnego CSV (awaryjnie; normalnie robi to agent na serwerze) |
| `npm run import:wapro-mag:full` | Pełny import brakujących SKU z Mag (szkielety) |
| `node scripts/sync-wp-shop-categories.mjs [--apply]` | Pobiera drzewo kategorii i przypisania SKU→kategoria ze sklepu (tryb podglądu domyślnie) |
| `npm run import:sonax` | Merge katalogu Sonax |
| `npm run export:knowledge` | Eksport wiedzy produktowej dla botów ([`docs/products/KNOWLEDGE-LIBRARY.md`](docs/products/KNOWLEDGE-LIBRARY.md)) |

Pełna lista: sekcja `scripts` w [`package.json`](package.json).

## Licencja / dostęp

Repozytorium firmowe Kenochem — użycie wewnętrzne.
