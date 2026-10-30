# Analiza asortymentu — 29.10.2026

Źródło: pełny audyt z aplikacji (`audyt-asortymentu-2026-10-29.json`), 4320 produktów (bez grup), 169 kategorii, 101 producentów.
Bez uwag: 1171 produktów (27%). Z uwagami: 3149 (73%) — ale większość to braki EAN i opisów, nie błędy.

## 1. Gdzie są prawdziwe błędy (wpływają na sklep)

| Problem | Liczba | Co z tym zrobić |
|---|---|---|
| Brak kategorii („Do decyzji”) | 801 | 688 ma podpowiedź z nazwy; reszta to głównie części HYD (kolanka, zaślepki, uszczelniacze) |
| Brak producenta | 455 | 374 z nich to SKU `INNE…`, 79 to `KAT…` — części do myjek, bez marki |
| Producent „nie-marka” | 434 | INNI PRODUCENCI 109, DYFUZOR ELEKTRYCZNY 108, EILFIX - … 67, AKCESORIA DO SPRZĄTANIA 57, MPS - … 37, AKCESORIA DO MYJNI 32, HADWAO - … 24 |
| W nazwie inna marka niż producent | 108 | zob. pkt 2 |
| Kategoria źródłowa „Inne”/„Chemia” | 304 | produkt ma kategorię tylko z drzewa-zastępczego |
| Brak ceny sprzedaży | 35 | część ze stanem > 0 (np. ORING 28x2, zawór by-pass) |
| Sprzedaż poniżej zakupu | 20 | pilne — straty na sprzedaży |
| Duplikaty EAN | 56 | głównie płyny do spryskiwaczy (ATAS) i węże HYD — ten sam EAN na różnych produktach |
| Ucięte nazwy | 80 | m.in. ARO…, HYD… (kończą się przecinkiem lub „/”) |

## 2. Producenci — konkretne poprawki

- **Soft (34) i SOFT99 (35) to ta sama marka.** Nazwy produktów w „Soft” zaczynają się od „SOFT99”. Scalić do SOFT99 (33 trafienia „inna marka w nazwie”).
- **Zapis wielkości liter**: Orion/ORION, Aroma, Chemitech, Clinex, Krypton… mieszają formaty (to już normalizuje aplikacja, ale baza ma różne warianty).
- **Nazwy opisowe zamiast marek** — trzeba je zamienić na markę albo na „Bez producenta”:
  - `EILFIX - profesjonalne środki czystości` → EILFIX
  - `HADWAO - nanotechnologia w środkach czys` → HADWAO (nazwa ucięta w bazie)
  - `MPS - Profesjonalne Mydła` → MPS
  - `INNI PRODUCENCI` (109), `DYFUZOR ELEKTRYCZNY` (108), `AKCESORIA DO SPRZĄTANIA` (57), `AKCESORIA DO MYJNI` (32), `marka niezdefiniowana` (7), `Ogólna` (1) — to są kategorie, nie marki. Dla nich wyliczyć markę z nazwy produktu; reszta → „Bez producenta”.
- **CID LINES → KENOTEK (18)**: nazwy produktów wskazują KENOTEK. Do sprawdzenia, czy to marka własna dystrybuowana pod inną nazwą.
- **HYDROFLEX (659) jest zbiorczy**: obejmuje węże, lance i złączki różnych marek (12 produktów z „KARCHER” w nazwie, 4 DETAILING, 3 LAVOR…). HYDROFLEX to raczej dostawca niż marka; w sklepie klient szuka po marce urządzenia.
- **Literówka**: `MANZERNA` → MENZERNA (5).
- **Małe, jednoproduktowe marki (32)** — warto zdecydować, które zostają w słowniku (Aldis, FOEN, GRASS, QUIXX, Worwo, Merida…).

## 3. Kategorie

- Drzewo jest już dobre: 7 działów, 3 poziomy. Największe liście: Węże i bębny 180, Szybkozłącza i adaptery 162, Lance i pistolety 152, Dysze 145, Olejki do dyfuzorów 130. Warto je podzielić dalej (np. węże wg ciśnienia/typu, dysze wg marki myjki).
- **Pozostałości poza drzewem** (5 produktów): `Zlaczki i adaptery` (2, bez polskich znaków), `Czyszczenie wnętrza samochodu` (3), `Worki do odkurzacza` (2), `Weze i zakucia` (1), `Płyny eksploatacyjne` (1). Przenieść do właściwych liści i usunąć.
- **Podobne kategorie w różnych działach**: „Łazienki i sanitariaty” (91, Chemia profesjonalna) vs „Łazienka i WC” (16, Dom i ogród); „Mopy i stelaże” (61) vs „Mopy i wiadra” (46); „Szczotki do mycia samochodu” / „Szczotki do myjni” / „Miotły i szczotki”. To świadoma separacja B2B/B2C, ale warto potwierdzić.
- **Niedoładowane liście (1–3 produkty): ~45.** Albo je scalić, albo rozbudować asortyment.
- **Fałszywe alarmy „Nazwa wskazuje inną kategorię” (K-MODEL): ok. 41 z 105.** Model uczył się na 2 produktach z osieroconej kategorii „Zlaczki i adaptery”. To błąd w moim audycie — po poprawce lista będzie krótsza i wiarygodna.
- Prawdziwe rozjazdy K-MODEL do sprawdzenia: rękawice nitrylowe w „Gąbki i rękawice” zamiast „Rękawiczki” (14), dyfuzory/choinki w „Zapachy do samochodu” zamiast „Zawieszki zapachowe”, pianownice w „Węże…”/„Lance…”.

## 4. Nazwy

- 13 nazw z technicznym prefiksem `Z-Z` / `ŹZ-` (ręczniki papierowe) — usunąć prefiks. Mój audyt tego nie wykrył (wzorzec obejmował tylko „ŹZ”) — do poprawy.
- 6 nazw za krótkich: `Zawór`, `Dyfuzor`, `ORING`, `RM 746 - 10L`, `RM 770 - 1L`, `OPTI…`.
- 80 uciętych nazw (typowo kończą się na `,` lub `/`).
- 20 nazw prefiksowanych marką, ale z innym producentem w polu (np. „K2 CLAREN” pod SKU `ATAS0040`).

## 5. Gotowość do sklepu

- Brak zdjęcia: **1232** (367 ze stanem > 0). Najwięcej: HYDROFLEX 339, bez producenta 291, LINEA TRADE 81, KALA 56, MERSA 55.
- Brak opisu: **1993**. Brak EAN: **2521** (to normalne dla części hydraulicznych; ważne dla marek chemicznych).
- Podejrzana marża (>400%): 114, prawie wszystko części HYD — prawdopodobnie cena zakupu wpisana za niska. Nie wpływa na sklep, wpływa na rentowność.
- **Produkty w pełni gotowe** (kategoria, producent, zdjęcie, opis, cena): 2211 z 4320 (51%).
- Ze stanem > 0 i co najmniej jedną uwagą wysokiej wagi: **875 z 2949** — to najważniejsza kolejka do porządkowania.

## 6. Proponowana kolejność prac

1. **Producenci: scalić Soft → SOFT99, MANZERNA → MENZERNA, EILFIX/HADWAO/MPS bez opisu** (jedna operacja masowa, ok. 190 produktów).
2. **Przypisać producentów z nazwy** (49 pewnych podpowiedzi + 27 dla „nie-marek”) i ręcznie przejrzeć resztę.
3. **Zatwierdzić pewne podpowiedzi kategorii** (przycisk w Analizie) dla 688 produktów bez kategorii — w pierwszej kolejności te ze stanem > 0.
4. **Posprzątać kategorie-sieroty** (5 produktów) i scalić niedoładowane liście.
5. **Części HYD/INNE/KAT (ok. 700 produktów)**: zdecydować o polityce producenta — marka urządzenia, dostawca (HYDROFLEX) czy „Bez producenta” — i dopiero wtedy masowo przypisać.
6. **Nazwy**: usunąć prefiks Z-Z, uzupełnić ucięte (skrypt WAPRO z naprawą uciętych nazw nadal czeka na skopiowanie na serwer).
7. **Zdjęcia i opisy** dla produktów ze stanem > 0 (367 bez zdjęcia).
8. **Duplikaty EAN i sprzedaż poniżej zakupu** — małe liczby (56 i 20), a najbardziej szkodliwe.

## 7. Poprawki do samego audytu (do zrobienia)

- Model kategorii ma uczyć się tylko na kategoriach z drzewa (usuwa fałszywe K-MODEL).
- Wykrywać prefiks `Z-Z`.
- Dodać w audycie sygnał „producent = dostawca” (HYDROFLEX) oraz priorytet wg stanu magazynowego.
