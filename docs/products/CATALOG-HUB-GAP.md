# Katalog Kenochem ← luki vs Trade Hub (module-catalog)

> Priorytety przy rozwijaniu **kenochem-katalog.web.app** (produkt `catalog` / `stock`).

## Już mamy (zgodnie z hub CAT-*)

| Hub | Kenochem katalog |
|-----|------------------|
| Wiele katalogów (Akcesoria / Produkty) | ✅ |
| Wyszukiwanie SKU, nazwa, EAN, warianty | ✅ Fuse |
| Filtry kategoria / stan / zdjęcia | ✅ |
| Gęstość siatki sm/md/lg | ✅ |
| Ceny + marża wg roli | ✅ |
| Ulubione (+ merge Supabase) | ✅ |
| Skaner EAN | ✅ |
| Lens / CLIP (Produkty) | ✅ |
| Szczegóły produktu | ✅ |
| Etykiety, zestawy, postęp zdjęć | ✅ |

## Wprowadzamy teraz (z huba)

| # | Feature hub | Pliki | Status |
|---|-------------|-------|--------|
| 1 | **Command palette** (Ctrl+K) — SKU + skróty widoków | `CatalogCommandPalette.tsx`, `App.tsx` | ✅ wdrożone (produkt `catalog` / `stock`) |
| 2 | **Statystyki + eksport CSV** listy / filtrów | `catalogExport.ts`, `CatalogStatsBar.tsx`, `CatalogView` | ✅ |
| 3 | **Lokalizacja magazynowa** (strefa→pojemnik) | `warehouseLocation.ts`, `locationStore.ts`, `ProductDetail` | ✅ lokalnie (localStorage) |

## Kolejna kolejka (bez big-bang)

| # | Feature | Uwagi |
|---|---------|--------|
| 4 | `CatalogFilterBar` (dropdowny jak w hub) | `CatalogFilterBar.tsx`, `CatalogView` | ✅ (produkt catalog/stock) |
| 5 | Lokalizacja w **Supabase** (`warehouse_location jsonb`) | Po stabilizacji UI + sync z WAPRO |
| 6 | Etykiety **półka / lokalizacja** (hub labelPrint) | Rozszerzyć `printLabel.ts` |
| 7 | Tagi produktów (CAT-006) | migracja już częściowo |
| 8 | Import Baselinker z UI | hub `BaselinkerImportModal` — skrypty zostają CLI |
| 9 | Marketplace / Allegro opisy | raczej Sell, nie czysty katalog |
| 10 | Ulubione 100% cloud-first | dopracować merge |

## Świadomie poza katalogiem

- CRM, czat, finanse → osobne URL-e produktów  
- Command palette **hub-wide** (nawigacja między modułami) → tylko **Suite**
