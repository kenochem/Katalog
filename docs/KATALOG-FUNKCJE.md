# Katalog — przewodnik po funkcjach

> Stan: 2026-10-02. Opis aplikacji **Katalog** (`kenochem-katalog.web.app`) i funkcji współdzielonych z Handlem, Operacjami i Suite. Dostępność zależy od roli ([`README.md`](../README.md#role)); dziennik zmian użytkownika jest w aplikacji: *Nowości → Aktualizacje*.

## Menu boczne

Kolejność i widoczność pozycji użytkownik może zmieniać (ikona ustawień menu). Na telefonie część pozycji jest w arkuszu **Więcej**.

| Pozycja | Kto widzi | Co robi |
|---------|-----------|---------|
| **Start** | wszyscy | Pulpit: liczniki (pozycji, na stanie, brak, niski stan), zadania porządkowe, skróty |
| **Katalog** | wszyscy | Lista produktów obu katalogów (Akcesoria / Produkty), filtry, sortowanie, eksport CSV widoku |
| **Biblioteka** | wszyscy | Zeszyty techniczne (poradniki) i **Katalogi marek do druku** (Eco Shine, Freshtek, SONAX) |
| **Logi** | wszyscy | Wynik ostatniego syncu WAPRO + **Szczegółowe zmiany produktów** (który SKU, jakie pole, było → jest), pogrupowane w zwijane przebiegi syncu |
| **Zmiany w czasie** | katalog | Wykres i tabela **cen** (zakup netto, sprzedaż netto/brutto) oraz **stanu** wybranego produktu. Wzrost stanu = dostawa, spadek = sprzedaż/korekta. Dane od 24.09.2026 |
| **Nowości** | katalog | Zakładki **Nowe produkty** (SKU dopisane automatycznie przez sync z Mag, filtr: ostatni dzień / tydzień / 30 dni / własny zakres) i **Aktualizacje** (dziennik zmian aplikacji, grupowany po dniach, z mapą aktywności) |
| **Ulubione** | `manageFavorites` | Ulubione produkty (synchronizowane z kontem) |
| **Foldery** | zalogowani | Własne foldery z produktami |
| **Zestawy** | `manageKits` | Komplety (zestawy) ze składnikami |
| **Postęp** | `viewProgress` | Postęp fotografowania i uzupełniania wiedzy o produktach |
| **Decyzje** | `viewProgress` | Produkty wymagające decyzji: kategoria, zdjęcie, EAN, producent, opis, cena. Przy produktach z gotową sugerowaną kategorią — **masowe zatwierdzanie** (zaznacz wiele, „Zastosuj zaznaczone"; do 220 pozycji na raz) |
| **Ukryte** | `viewProgress` | Produkty ukryte w katalogu (z możliwością przywrócenia) |
| **Bez zdjęć** | `viewProgress` | Produkty bez zdjęcia; wgrywanie z kafelka oraz tryb **Szybkie zdjęcia** (pełnoekranowy, kolejno produkt po produkcie, aparat od razu) |
| **Etykiety** | `printLabels` | Kolejka i wydruk etykiet półkowych |
| **Administracja** | admin | Konta, macierz uprawnień, higiena EAN, ustawienia globalne |
| **Magazyn** | produkt Magazyn | Stany ±, lokalizacje, edytor układu magazynu (widok izometryczny, regały) |

**Ctrl+K** — paleta poleceń: skoki do produktów po SKU/nazwie i do widoków.

## Wyszukiwanie

[`src/lib/productSearchIndex.ts`](../src/lib/productSearchIndex.ts). Kolejność dopasowania:

1. dokładny SKU (także SKU wariantów) → 2. EAN (≥ 8 cyfr, dopasowanie końcówki) → 3. podciąg w nazwie / producencie / kategorii → 4. prefiks SKU → 5. SKU zawiera frazę → 6. **dopiero gdy nic nie pasuje**: wyszukiwanie rozmyte (Fuse.js).

Uwagi:
- **Tagi produktów nie są indeksowane** w wyszukiwaniu tekstowym — mogą zawierać wewnętrzne znaczniki (np. „Sonax" z rozliczeń), które wypychały obce produkty na wyniki.
- Indeks buduje się w tle (`requestIdleCallback`) i jest cache'owany per lista; wyniki są liczone z krótkim opóźnieniem po przerwie w pisaniu (rzędu 100–300 ms), żeby nie dławić telefonów.
- Skaner EAN (kamera) korzysta z `html5-qrcode`. Kod OCR/Lens (`src/lib/ocrLens.ts`, skrypty embeddings) jest w repo, ale **nie jest podpięty do interfejsu**.

## Kategorie, producenci, „Do decyzji"

Kategoria wyświetlana produktu ([`src/lib/catalogCategory.ts`](../src/lib/catalogCategory.ts)) wyliczana jest w kolejności:

1. `product_meta.shopCategoryPath` — ścieżka kategorii ze sklepu (drzewo `public/data/shop-category-tree.json`),
2. kategoria źródłowa równa liściowi drzewa sklepu (o ile nie jest nazwą producenta),
3. heurystyka po słowach kluczowych w nazwie (np. „dysza" → *Dysze do myjek*),
4. w przeciwnym razie **„Do decyzji"**.

Przypisania ze sklepu zapisuje skrypt [`scripts/sync-wp-shop-categories.mjs`](../scripts/sync-wp-shop-categories.mjs):

```bash
node scripts/sync-wp-shop-categories.mjs                 # podgląd (dry-run): drzewo, mapa SKU→kategoria, raport zmian
node scripts/sync-wp-shop-categories.mjs --apply         # zapis kategorii dopasowanych po SKU do sklepu
node scripts/sync-wp-shop-categories.mjs --apply-all     # + kategorie z heurystyki dla reszty
```

Skrypt pobiera drzewo kategorii (`public/data/shop-category-tree.json`) i mapę SKU → kategoria ze sklepu przez publiczne WooCommerce Store API (adres z `WP_SHOP_URL`; opcjonalnie dane WC v3 `WP_SHOP_USER` / `WP_SHOP_APP_PASSWORD`), zapisuje podgląd w `data/shop-category-assignment-preview.json`, a przed zapisem robi **kopię zapasową** kategorii w `data/category-assignment-backups/`. W bazie ustawia `product_meta.shopCategoryPath`, `shopCategoryWpId`, `categoryAssignedBy/At`. Zawsze zaczynaj od podglądu.

Producent: pole `manufacturer` z uzupełnieniem heurystycznym (`waproManufacturers.ts`).

## Nowe produkty z WAPRO

Sync tworzy brakujące SKU z Mag jako **szkielety** (nazwa, stan, ceny; bez zdjęcia/opisu), zaznaczone w `product_meta`. Trafiają do *Nowości → Nowe produkty* (okno domyślnie 30 dni; plakietka w menu liczy to samo okno) oraz do *Decyzje* / *Bez zdjęć* jako praca do uzupełnienia. Pomijane są pozycje archiwalne (X…) i puste szkice „nowy artykuł". Szczegóły: [`WAPRO-SYNC.md`](./WAPRO-SYNC.md).

## Operacje (kenochem-ops)

- **Analiza sprzedaży** — koszyk SKU, trend miesięczny, 12 m vs poprzednie 12 m, rotacja, ABC/XYZ, ranking kategorii, eksport CSV.
- **Martwy stock** — towar na stanie bez sprzedaży w wybranym okresie (1/3/6/12 mc; domyślnie 12). Przyciski: *Odśwież widok* (z bazy) i **Sync z Mag WAPRO** (zleca realny sync sprzedaży). Baner pokazuje wiek danych i ostrzega, gdy minęło > 7 dni. **Wyklucz / Cofnij** zapisuje się na produkcie (`product_meta.salesExcludeFromSum`) — **widoczne i odwracalne dla całego zespołu**; palety, obudowy serwisowe i „kwiatki" są wykluczane automatycznie.
- **Finanse** — koszty, marże, wynik handlowców, prognoza salda, płatności.

Wymaga uprawnienia `viewOps`; ceny tylko z `viewPrices`.

## Handel / CRM (kenochem-sell)

Zakładki CRM: Pulpit, Katalog i koszyk, Lejek sprzedaży, Klienci, Mapa wizyt, Kalendarz, Historia, Prowizja, Obsługa klienta (skrzynka e-mail).

- **Koszyk** — wybór klienta na górze (wyraźny pasek), ilości +/- na kartach produktów, podsumowanie netto/brutto, wysyłka zamówienia na Discord, zapis do historii, PDF.
- **Edytor oferty** — ceny pozycji i **koszt transportu** w dwóch zsynchronizowanych polach **netto / brutto** (edycja jednego przelicza drugie), rabat per pozycja i globalny, uwagi, ważność oferty; sekcja **Wystawia ofertę** pozwala zmienić imię widoczne na PDF (zapisuje się w profilu). Numeracja ofert w bazie (`migration-crm-quote-number.sql`).
- **Zamówienie do WAPRO** (tylko admin) — przycisk „Do WAPRO (ZO w buforze)" tworzy zlecenie w `wapro_order_requests`; do realizacji potrzebny jest agent po stronie serwera (patrz [`future/wapro-orders`](./future/wapro-orders/README.md)).

## Zdjęcia

Upload z kafelka lub trybu **Szybkie zdjęcia**; obrazy są kompresowane po stronie klienta i trafiają do bucketa `product-images`. Źródła zdjęć z BaseLinker / sklepu: skrypty `import:baselinker-images*`, `import:kenochem-shop-images*`.

## Motywy

Jasny, ciemny, szary i „cookie". Własne style w `src/index.css` muszą pokrywać wszystkie cztery (klasy `dark:` Tailwinda nie obejmują motywu cookie).

## PWA i telefon

Każdy produkt jest instalowalną PWA (własny manifest i ikony). Przyciski nagłówka mają na telefonie min. ok. 40 px; ekran ładowania i logowania pokazują nazwę bieżącego produktu.
