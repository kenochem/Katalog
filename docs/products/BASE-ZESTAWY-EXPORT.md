# BaseLinker — eksport zestawów ze składnikami (dla importu do Katalogu)

Szablon z katalogu **Zestawy** → Eksport własny. Cel: jeden rekord zestawu + lista produktów z **SKU** i **ilością**.

## Struktura sekcji (jak na screenie)

| Sekcja | Zawartość pola „Kod sekcji” |
|--------|-----------------------------|
| **ROOT** | `[ZESTAW]` |
| **ZESTAW** | nagłówek zestawu + `[PRODUKT]` (powtórzone dla każdego składnika) |
| **PRODUKT** | pola jednego składnika (patrz niżej) |

## ZESTAW — wklej w „Kod sekcji [ZESTAW]”

Minimalnie (import po ID + SKU):

```text
[zestaw_id]
[zestaw_sku]
[zestaw_ean]
[PRODUKT]
```

Zalecane rozszerzenie (nazwa, kategoria, zdjęcie — mniej zgadywania w imporcie):

```text
[zestaw_id]
[zestaw_sku]
[zestaw_ean]
[zestaw_kategoria_nazwa]
[zestaw_zdjecie_1]
[PRODUKT]
```

> Jeśli Base nie ma osobnego tagu nazwy zestawu, nazwa często jest w powiązanym produkcie katalogowym — wtedy dopisz w ROOT osobny eksport lub użyj `[zestaw_sku]` jako tytułu.

## PRODUKT — wklej w „Kod sekcji [PRODUKT]”

**Minimum (wystarczy do mapowania w katalogu):**

```text
[produkt_id]
[produkt_sku]
[produkt_ean]
[SZTUKI_ERP]
```

**Pełniejsze (gdy brak dopasowania po SKU):**

```text
[produkt_id]
[produkt_sku]
[produkt_ean]
[produkt_nazwa]
[produkt_kategoria_nazwa]
[SZTUKI_ERP]
```

- **`[produkt_sku]`** — główne pole do wiązania z `shop-products.json` / WAPRO.
- **`[SZTUKI_ERP]`** — ilość sztuk **w zestawie** (jeśli w szablonie jest stałe `1`, sprawdź w podglądzie eksportu czy Base podstawia ilość ze zestawu; czasem trzeba tag **`[ilosc]`** / **`[zestaw_ilosc]`** z listy tagów dla zagnieżdżonego PRODUKT — wybierz ten, który w podglądzie pokazuje np. `2` dla duplikatu SKU).

## Format pliku

- Preferowany: **XML** (łatwiejsze zagnieżdżenie ZESTAW → wielokrotny PRODUKT).
- CSV też możliwy, jeśli każdy wiersz = jeden składnik z powtórzonym `zestaw_id`.

## Import w repo

```bash
node scripts/import-baselinker-kits.mjs "ścieżka\do\export.xml"
node scripts/import-baselinker-kits.mjs "ścieżka\do\export.xml" --apply
```

Skrypt rozpoznaje:

1. **Nowy format** — tagi `zestaw_*` + zagnieżdżone `produkt` / `produkt_sku`.
2. **Stary eksport katalogu produktów** — heurystyka zapachów z opisu (gorsze dopasowanie).

Po `--apply` zestawy trafiają do tabeli `kits` w Supabase i są widoczne w widoku **Zestawy** w katalogu.
