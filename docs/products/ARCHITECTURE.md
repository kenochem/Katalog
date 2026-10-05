# Architektura Kenochem

> Stan: 2026-10-02. Kod jest jeden; różnica między aplikacjami to **tryb buildu** (`vite --mode <produkt>`), który ustawia `VITE_APP_PRODUCT`.

## Obraz całości

```
                Firebase Hosting (jeden projekt GCP: kenochem-f4a5b, 8 witryn)
   katalog │ suite │ sell │ stock │ ops │ talk │ logistics │ calendar
       ▲        ▲      ▲      ▲       ▲     ▲        ▲          ▲
       └────────┴──────┴──────┴───────┴─────┴────────┴──────────┘
                  osobny build (dist-<produkt>) z tych samych źródeł
                                  │
                       Vite SPA (React 19 + TS)
                                  │
                       Supabase (Postgres + RLS + Storage + Edge Functions)
                                  ▲
                                  │ service_role (tylko serwer)
                       Agent WAPRO (PowerShell, Harmonogram zadań)
                                  ▲
                          WAPRO Mag (SQL Server)
```

## Jak wybierana jest aplikacja

1. `scripts/prepare-product-build.mjs <produkt>` generuje `index.<produkt>.html` z `index.base.html` (tytuł, manifest PWA, ikony). Pliki `index.*.html` są w `.gitignore`.
2. `vite --mode <produkt>` buduje do `dist-<produkt>`. Produkt wyznacza **tryb** (`import.meta.env.MODE`); `VITE_APP_PRODUCT` (np. z lokalnych plików `.env.<produkt>`, które są w `.gitignore`) jest tylko opcjonalnym nadpisaniem — bez żadnego z nich aplikacja startuje jako Suite.
3. [`src/main.tsx`](../../src/main.tsx) w jednym `lazy()` wybiera korzeń wg `APP_PRODUCT`:

| `APP_PRODUCT` | Komponent startowy |
|---------------|--------------------|
| `suite` | `SuiteHubApp` (`src/suite/`) — lekki launcher; **nie importuje `App.tsx`** ani katalogu produktów |
| `stock` | `StockProductApp` (`src/modules/stock/`) |
| `talk` | `TalkProductApp` (`src/modules/comms/`) |
| `calendar` | `CalendarProductApp` (`src/modules/calendar/`) |
| `logistics` | `LogisticsProductApp` (placeholder) |
| **`catalog`, `sell`, `ops`** (i domyślnie) | **`App.tsx`** — jedna wspólna aplikacja |

> `App.tsx` jest duży (~3000 linii) i **współdzielony** przez Katalog, Handel i Operacje — wewnątrz sam decyduje, co pokazać, na podstawie `APP_PRODUCT`, `moduleEnabled()` i roli. Dlatego każdy tekst w nim musi korzystać z `branding.*`, a nie z nazwy konkretnego produktu (np. ekran ładowania pokazuje `branding.headerTitle`).

## Rejestr modułów

[`src/app/moduleRegistry.ts`](../../src/app/moduleRegistry.ts) to jedno źródło prawdy o produktach:

- `MODULES_BY_PRODUCT` — które moduły (`catalog`, `crm`, `ops`, `comms`, `calendar`) wchodzą do danego produktu,
- `BUILD_HAS_CRM / OPS / COMMS / CATALOG / CALENDAR` — flagi stałe na czas buildu,
- `PRODUCT_BRANDING` — tytuł, nazwa PWA, opis (ekran logowania, manifest, nagłówek),
- `HOSTING_SITE_BY_PRODUCT` — ID witryn Firebase,
- `TALK_SUSPENDED` — chwilowo wyłącza czat (zero pollingu/Realtime).

| Produkt | Moduły |
|---------|--------|
| catalog, stock | katalog |
| sell | katalog + CRM |
| ops | Ops |
| calendar | kalendarz |
| suite | brak (launcher: linki do osobnych aplikacji, `suite: []` w rejestrze) |

## Podział kodu i ładowanie

Cel: katalog ładuje się szybko, a ciężki kod trafia tylko tam, gdzie jest potrzebny.

- **Moduły opcjonalne** (CRM, Ops, czat) są ładowane przez `lazy()` w `src/modules/*/loaders.tsx`, tylko gdy odpowiednia flaga `BUILD_HAS_*` jest prawdziwa.
- **Rzadko używane widoki katalogu** (Logi, Nowości, Zmiany w czasie, Ukryte, Biblioteka, Zestawy, Postęp, tryb szybkich zdjęć…) są `lazy()` w `App.tsx` — pobierają się dopiero po wejściu.
- **Ciężkie biblioteki** mają własne chunki (`vite.config.ts` → `manualChunks`): `react`, `supabase`, `icons` (lucide), `fuse`, `recharts`, `echarts`, `leaflet`, `qrcode`, `barcode`. Duży chunk `echarts` (~1 MB) ładuje się wyłącznie w wykresach Ops.
- **Ścieżka krytyczna katalogu** (react + supabase + ikony + App + CSS) to ok. 250 KB gzip.
- **Dane produktów** startowo idą ze statycznych `public/data/products-lite.json` i `shop-products-lite.json` (kompresja brotli, cache 1 h), potem dociągane są stany/zdjęcia z Supabase. `loadBaseProducts()` w `src/lib/products.ts` ma blokadę „in-flight", żeby równoległe wywołania nie pobierały i nie parsowały tego samego pliku wielokrotnie.
- **Indeks wyszukiwania** (`src/lib/productSearchIndex.ts`) jest budowany w `requestIdleCallback`, nie blokuje pierwszego renderu.

## Role i uprawnienia

- Macierz domyślna: [`src/lib/roleDefinitions.ts`](../../src/lib/roleDefinitions.ts) (`DEFAULT_ROLE_MATRIX`), sprawdzana przez `roleCan(role, 'akcja')`.
- Nadpisania z bazy: tabela `app_role_matrix`, edycja przez admina (`roleMatrixStore`).
- To jest **warstwa UI**; twarda ochrona danych to RLS w Supabase ([`docs/BAZA-DANYCH.md`](../BAZA-DANYCH.md)).
- Gość (`mode === 'guest'`) widzi katalog tylko do odczytu. Część tabel (np. logi syncu) jest dostępna wyłącznie dla zalogowanych, więc gość widzi tam puste stany.

## Motywy

Cztery motywy: jasny, ciemny (`.dark`), szary (`.theme-gray`) i „cookie" (`.theme-cookie`). Własne klasy CSS w `src/index.css` muszą obsługiwać **wszystkie cztery** — same klasy Tailwind `dark:` nie obejmują motywu cookie.

## Ścieżki danych

| Dane | Źródło | Cel |
|------|--------|-----|
| Stany, ceny zakupu/sprzedaży | WAPRO → agent `.ps1` | `products.stock`, `price_*` |
| Sprzedaż (1/3/6/12 m, miesiące) | WAPRO → agent (`-SalesSyncOnly`) | `products.wapro_sales_stats` |
| Zmiany cen/stanów | agent (porównanie przed zapisem) | `product_sync_changes` |
| Nowe SKU z Mag | agent (auto-import) | `products` (szkielet + `product_meta.waproImport`) |
| Opisy, zdjęcia, EAN | BaseLinker (CSV/API) → skrypty `import:*` | `products` |
| Kategorie sklepu | `sync-wp-shop-categories.mjs` | `public/data/shop-category-tree.json`, `product_meta.shopCategoryPath` |

Szczegóły agenta: [`docs/WAPRO-SYNC.md`](../WAPRO-SYNC.md).

## Szkielet monorepo (nieużywany produkcyjnie)

Foldery `apps/*` i `packages/core` to szkielet pod ewentualny podział na paczki. Build nadal idzie z korzenia (`vite.config.ts`); nic z tych folderów nie jest importowane przez aplikację.
