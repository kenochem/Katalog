# BaseLinker — mapowanie eksportu → katalog Kenochem

Eksport: **`Base__Produkty__*.csv`** (separator `;`, UTF-8) lub **`Base__Produkty__*.xml`** (zestawy / pełniejsze atrybuty).

## Co już robimy dziś

| Ścieżka | Co trafia do katalogu |
|--------|------------------------|
| **`npm run import:baselinker`** (`import-baselinker.py`) | Pełny katalog **Produkty (shop)** → JSON: opisy, waga, j.m., VAT, zdjęcia, EAN, `baselinkerProductId` |
| **Import WAPRO / brakujące** (`import-wapro-missing.py`) | Z BL po **SKU**: głównie **zdjęcie, EAN, ID** — opisy często **puste** |
| **Stary `import-wapro.py`** | BL z **jednego, sztywnego** pliku CSV — tylko zdjęcia + EAN |
| **Zestawy** (`import-baselinker-kits.mjs`) | XML/CSV zestawów + atrybuty `<attribute>` (pojemność, ilość w zestawie) |

Wniosek: **dane z BaseLinker są w eksporcie**, ale do Supabase dla pozycji „WAPRO + BL” ciągnęliśmy głównie media — nie całe mapowanie z `import-baselinker.py`.

## Mapowanie CSV → Supabase / `product_meta`

| Kolumna BaseLinker (typowa) | Pole katalogu | Uwagi |
|----------------------------|---------------|--------|
| `produkt_id` | `product_meta.baselinkerProductId` | Klucz do API BL / sync stanów |
| `produkt_sku` | `sku` | Dopasowanie z WAPRO (normalizacja zer w `norm_sku`) |
| `produkt_nazwa` | `name`, `display_name` | |
| `produkt_ean` | `ean` | Tylko cyfry, min. 8 znaków |
| `producent_nazwa` | `manufacturer` | |
| `kategoria_nazwa` | `category` | W shop: reguły jak w `import-baselinker.py` |
| `zdjecie` | `image_url`, `has_image` | |
| `zdjecie_dodatkowe_1` … `_15` | `extra_images` | |
| `opis` / `opis_dodatkowy_1` | `description` | HTML OK w DB; wiedza/AI → plain |
| `opis_krotki` / `opis_dodatkowy_2` | `product_meta.shortDescription` | ≤500 znaków |
| `waga` / `waga_brutto` | `product_meta.weightKg` | kg, przecinek → kropka |
| `jednostka` / `produkt_jednostka` | `product_meta.unit` | |
| `stawka_vat` / `vat` | `product_meta.vatRate` | |
| `szerokosc` / `wysokosc` / `glebokosc` (+ `_cm`) | `widthCm`, `heightCm`, `depthCm` | Jeśli są w eksporcie |
| `atrybut_N_nazwa` + `atrybut_N_wartosc` | `product_meta.parameters` | Scalane z istniejącymi |
| `ilosc` | `stock` | Przy pełnym imporcie shop; **nie** nadpisujemy przy enrich (WAPRO = prawda) |

### XML (produkty / zestawy)

| XML | Katalog |
|-----|---------|
| `product_id`, `name`, `category_name`, `manufacturer_name`, `image` | jak wyżej |
| `description`, `description_extra_1` | `description` / skrót |
| `<attribute><attribute_name>…</attribute_name><attribute_value>…</attribute_value>` | `parameters` |

Parser XML jest w `import-baselinker-kits.mjs` (`parseXmlProducts`).

## Wspólna warstwa w repo

- **`scripts/lib/baselinker_export.py`** — jeden parser wiersza CSV → `BaselinkerEnrichment`
- **`scripts/enrich-supabase-from-baselinker.py`** — uzupełnia **istniejące** produkty w Supabase (fill-only)
- Podgląd: `data/baselinker-enrich-preview.json`

### Komendy

```bash
# Statystyki kolumn w najnowszym CSV (Downloads)
py scripts/lib/baselinker_export.py

# Raport: co by się uzupełniło
py scripts/enrich-supabase-from-baselinker.py

# Zapis (puste opisy / meta / brak zdjęcia)
py scripts/enrich-supabase-from-baselinker.py --apply

# Jawna ścieżka CSV
py scripts/enrich-supabase-from-baselinker.py --csv "D:\Downloads\Base__Produkty__....csv" --apply
```

npm (w `package.json`): `import:baselinker-enrich` / `import:baselinker-enrich:apply`.

Po `--apply` w meta ustawiane jest `baselinkerEnrichedAt` (timestamp).

## Strategia na przyszłość

1. **Cotygodniowy eksport** pełnego katalogu Kenochem z BaseLinker (nie mały Sonax-only).
2. **`import:baselinker-enrich:apply`** po eksporcie — dopina opisy/wagi/atrybuty do pozycji już w Supabase (WAPRO + BL).
3. **Nowe SKU z WAPRO** — rozszerzyć `import-wapro-missing` o pełne `BaselinkerEnrichment` (ten sam moduł co enrich).
4. **Read:** `/data/knowledge/` · **Write botów:** [KNOWLEDGE-BOT-API.md](./KNOWLEDGE-BOT-API.md) · **Stany BL:** [BASELINKER-STOCK-SYNC.md](./BASELINKER-STOCK-SYNC.md).

## Czego BaseLinker nie rozwiązuje

- **Stan i ceny Mag** — nadal WAPRO / sync PC (nie CSV BL jako prawda).
- **Akcesoria bez oferty BL** — brak wiersza w CSV = brak enrich; tylko ręcznie / bot wiedzy.
- **Jakość opisów** — często HTML z marketplace; warto potem szlifować w katalogu (filtr „Opis / AI”).

## Inspekcja szablonu CSV

Jeśli Base doda nowe kolumny, uruchom:

```bash
py scripts/lib/baselinker_export.py "ścieżka\do\Base__Produkty__....csv"
```

Dopisz brakujące mapowania w `baselinker_export.py` → `collect_parameters_from_row` / `row_to_enrichment`.
