# Katalogi marek (do druku) — edycja opisu i kategorii

Sekcja **"Katalogi marek (do druku)"** w widoku Biblioteki
([`src/components/LibraryView.tsx`](../../src/components/LibraryView.tsx),
`BRAND_CATALOGS`), obok "Zeszytów" Biblioteki Technicznej — inna funkcja, nie
mylić (patrz [`BIBLIOTEKA-TECHNICZNA.md`](./BIBLIOTEKA-TECHNICZNA.md)). Każda
marka to samodzielna strona HTML w `public/biblioteka/katalogi-marek/*.html`
(na dziś: `eco-shine.html`, `freshtek.html`, `sonax.html`) — gęsta siatka produktów ze
zdjęciem, opisem, cenami wg pojemności ("cena katalogowa" =
`priceSaleGross` z danych produktowych) i przypisaniem do kategorii, myślana
do wydruku lub pokazania klientowi na miejscu.

## Struktura danych (w każdym pliku HTML)

```js
var CATALOG_SLUG = "eco-shine"; // unikalny per marka, klucz w bazie
var CATALOG = {
  brand: "...",
  categoryOrder: [ { name: "...", note: "..." }, ... ], // kolejność i etykiety kategorii
  items: [ { n, cat, d, s: [{v, p}], sku, img }, ... ]   // płaska lista, cat = nazwa kategorii
};
```

`render()` grupuje `items` wg `cat` w kolejności `categoryOrder` — przenosinę
produktu do innej kategorii to tylko zmiana pola `cat`.

## Edycja w przeglądarce (opis + kategoria)

Wspólny silnik: [`catalog-edit.js`](../../public/biblioteka/katalogi-marek/catalog-edit.js)
(ES module, ładowany na końcu `<body>` każdej strony katalogu). Odpowiada za:
render, przełącznik motywu, i **edycję dla zalogowanych** — sprawdza
`supabase.auth.getSession()` (ten sam projekt Supabase co reszta apki), tylko
wtedy dokleja przycisk "✏️ Edytuj" do paska narzędzi.

W trybie edycji każda karta produktu dostaje `<textarea>` (opis) i `<select>`
(kategoria, opcje = `categoryOrder`); zmiany trafiają do mapy `dirty` i
zapisują się dopiero po kliknięciu "💾 Zapisz" — upsert do
`catalog_product_overrides` (klucz: `catalog_slug` + `sku`). Przy każdym
załadowaniu strony (także dla gości, bez logowania) silnik najpierw czyta tę
tabelę i podmienia opis/kategorię, jeśli jest zapisane nadpisanie — więc
zmiana widoczna jest dla wszystkich, nie tylko dla edytującego.

## Migracja SQL — wymaga ręcznego uruchomienia

[`supabase/migration-catalog-brand-overrides.sql`](../../supabase/migration-catalog-brand-overrides.sql)
— **wklej ręcznie w Supabase SQL Editor**, zgodnie z konwencją tego repo
(nikt tu nie używa `supabase db push`). Dopóki tabela nie istnieje, strony
działają normalnie (pokazują domyślną treść z pliku HTML), edycja w
przeglądarce da się włączyć i klikać, ale "Zapisz" zwróci błąd w konsoli
(404/`PGRST205`) — nieblokujące, obsłużone przez `try/catch`.

## Dodawanie kolejnej marki

1. Skopiuj `eco-shine.html` jako szablon, podmień `CATALOG_SLUG`, `CATALOG`
   (kategorie + produkty — dane z `public/data/shop-products.json`, filtr po
   `manufacturer`), tekst w `.hero`.
2. Dopisz wpis w `BRAND_CATALOGS` w `LibraryView.tsx`.
3. `npm run deploy:catalog`.

Kolor akcentu (`--leaf`) per marka jest dowolny — świadomie różny dla każdej,
żeby karty w Bibliotece dało się rozróżnić na pierwszy rzut oka.
