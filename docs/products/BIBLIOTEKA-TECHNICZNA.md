# Biblioteka Techniczna (zeszyty/poradniki)

> ⚠️ **Nie mylić z** [`KNOWLEDGE-LIBRARY.md`](./KNOWLEDGE-LIBRARY.md) / [`KNOWLEDGE-BOT-API.md`](./KNOWLEDGE-BOT-API.md).
> Te dokumenty opisują strukturalne dane **per produkt** (`shortDescription`,
> `parameters`, eksport `/data/knowledge/*.jsonl` dla botów/RAG). **Ten
> dokument opisuje coś innego**: kilka samodzielnych, statycznych stron HTML
> ("zeszytów") — poradniki techniczne pisane dla ludzi (magazyn, sprzedaż,
> obsługa klienta), niepowiązane z systemem product-knowledge. Podobna nazwa
> ("biblioteka"), zupełnie inna funkcja.

## Kontekst — czemu to powstało

Właściciel (Kenochem, hurtownia chemii samochodowej/obiektowej i akcesoriów do
myjni, Białystok) chciał wewnętrznych poradników, z których pracownicy mogą
się szybko doszkolić i trafnie doradzać klientom — np. "jaki płyn bez
alkoholu o odpowiednim pH do podłogi matowej" albo "jaki nypel pasuje do
Karchera z Easy!Lock". Zamiast generycznej wiedzy, każdy zeszyt jest mocno
zakotwiczony w **realnych produktach z katalogu** (konkretne SKU, stany
magazynowe) i w rzetelnych źródłach branżowych/producenckich.

Powstało w sesji z Claude (Anthropic) pracującej równolegle nad projektem
lokalnego "Klod" (patrz sekcja niżej) i nad tym repo. Ten dokument to
świadomy hand-off — żeby kolejny model (Cursor, inna sesja Claude, cokolwiek)
mógł podjąć pracę bez zgadywania.

## Co to jest — stan na dziś

Zakładka **"Biblioteka"** w aplikacji katalog (obok Start/Katalog/Ulubione/
Foldery), widoczna na [kenochem-katalog.web.app](https://kenochem-katalog.web.app).
Karty linkują do samodzielnych stron HTML, otwieranych w nowej karcie
(`target="_blank"`).

| # | Tytuł | Zawartość (skrót) |
|---|-------|--------------------|
| 1 | Atlas Dysz i Złączek | Gwinty (GZ/GW/cal/M22), dobór dysz, budowa lancy, standardy marek myjek (Karcher K/HD/HDS/Easy!Lock, Comet, bagnet), jak działają same myjki (pompy osiowe vs triplex, zimna/gorąca woda, 230V/400V), węże kanalizacyjne, osłony dysz, iniektory chemii (fizyka Venturiego + mapa 6 typów na rynku: pianownica ręczna, lanca+butelka, korpus INOX, kwasowy, przy szczotce turbo, dalekiego zasięgu), szybka diagnostyka. **10 rozdziałów** — najobszerniejszy zeszyt. |
| 2 | Atlas Chemii Obiektowej | pH, koncentrat vs RTU, mapa zastosowań, skala pH na realnych produktach, porównanie linii (Eco Shine, Cid Lines, Clinex, Eilfix, Draco), dawkowanie, bezpieczeństwo (REACH, mieszanie chloru z kwasem) |
| 3 | Atlas Aromamarketingu | Zimna dyfuzja (mechanizm), dobór mocy dyfuzora do m² (linia KALA), mapa produktów, dobór zapachu do branży, bezpieczeństwo/etyka (alergie, REACH) |

Zapowiedziany, **nierozpoczęty**: Zeszyt 4 — chemia profesjonalna do
detailingu (pasty polerskie, powłoki, technika nakładania).

Kandydaci na kolejne (rozpoznane w katalogu jako duże, nieopisane klastry
produktów, nikt jeszcze nie pisał): narzędzia/systemy higieny (Vikan + York —
kodowanie kolorystyczne stref, ściągaczki, mopy), sprzęt do aplikacji chemii
(Kwazar — opryskiwacze/pianownice ręczne), maszyny czyszczące (odkurzacze
przemysłowe, szorowarki).

## Gdzie są pliki — źródło prawdy

**`public/biblioteka/zeszyt-0N-*.html` w TYM repo to jedyne prawdziwe,
aktualne źródło.** Deployowane jako statyczne assety (Vite kopiuje `public/`
bez zmian do `dist-catalog/`).

Poza repo, na dysku lokalnym maszyny, na której to powstało, są dwie kopie
zapasowe — **mogą nie istnieć na innej maszynie, nie polegaj na nich**:

- `D:\Katalog-Produktowy\poradniki\wdrozenie\` — pełny mirror tych samych
  plików (backup, aktualizowany ręcznie po każdej zmianie w repo)
- `D:\Katalog-Produktowy\poradniki\*.html` (płasko, bez `wdrozenie/`) —
  wersje-fragmenty (bez `<!DOCTYPE>`/`<head>`/`<body>`) używane wyłącznie do
  publikowania jako Claude Artifact (podgląd w przeglądarce Claude.ai) — **nie
  są nigdzie deployowane**, to tylko wygodny podgląd przy edycji

Jeśli repo i `D:\...\wdrozenie\` się rozjadą — **repo wygrywa**, to jest
jedyne źródło, które trafia na produkcję.

### Projekt "Klod" — osobny, porzucony wątek

`D:\Katalog-Produktowy\` (poza tym repo) zawiera **świadomie porzucony**
projekt lokalnego asystenta AI (Ollama + RAG na Supabase-podobnych danych z
`/data/knowledge/`, nazwa robocza "Klod"). Użytkownik zrezygnował z powodu
zbyt słabego sprzętu (i5-6500, 8GB RAM, brak GPU) — nie wznawiaj tego bez
wyraźnej, świeżej prośby. Nie ma to związku z Biblioteką Techniczną poza tym,
że to ta sama sesja robocza go stworzyła po drodze.

## Integracja w aplikacji (pliki do znania)

- `src/types/index.ts` — `View` ma wariant `'library'`
- `src/components/LibraryView.tsx` — lista kart zeszytów (`LIBRARY_ENTRIES`,
  tablica obiektów z `file`, `title`, `description`, `icon`, `accent`) — **tu
  dopisujesz nowy zeszyt**
- `src/App.tsx` — realna zakładka nawigacji dla samodzielnej aplikacji
  katalog (desktop: `NavTab` obok "Katalog" ok. linii 1442; mobile:
  `src/components/MobileNav.tsx`, sekcja "Widoki" w `MobileMoreSheet`) — **to
  jest ta widoczna na `kenochem-katalog.web.app`**
- `src/components/hub/HubCatalogSubNav.tsx` — analogiczna zakładka, ale tylko
  gdy katalog jest osadzony w trybie "suite" (`embeddedInHub`) — rzadsza
  ścieżka, dodana dla spójności, prawdopodobnie mniej używana

## ⚠️ Pułapka, w którą sam wpadłem: odwrócona skala `slate`

Patrz [`.cursor/rules/light-theme-contrast.mdc`](../../.cursor/rules/light-theme-contrast.mdc).
`LibraryView.tsx` **musi** mieć klasę `catalog-home-view` na głównym
kontenerze — bez niej standardowo wyglądające klasy (`text-slate-950`,
`bg-slate-50`...) dają w jasnym motywie odwrotny efekt (biały tekst na
białym tle). Złapałem się na to przy pierwszej wersji, klient to zauważył na
screenshocie. Napraw = dodaj klasę, nie przepisuj kolorów ręcznie.

## Anatomia jednego pliku zeszytu (wzorzec dla Zeszytu 4+)

Każdy plik w `public/biblioteka/` to **pełny, samodzielny dokument HTML**
(`<!DOCTYPE html>`...`</html>`), z własnym, ręcznie pisanym systemem
wizualnym w `<style>` — **to nie Tailwind**, to osobne tokeny CSS
(`--paper`, `--ink`, `--blueprint`/`--brass`/`--violet` jako akcent per
zeszyt, itd.), świadomie odizolowane od reszty apki (inaczej style
wyciekałyby do całej SPA — stąd też strony otwierają się w nowej karcie, nie
w `<iframe>` czy inline).

Stały szkielet każdego pliku:

1. `<head>`: `<meta charset>`, skrypt czytający `localStorage.getItem('katalog-theme')`
   (ten sam klucz co przełącznik motywu appki, patrz `src/lib/theme.ts`) i
   ustawiający `data-theme` na `<html>` **przed** renderem (unika mignięcia
   złym motywem), `<meta viewport/description>`, `<title>`, `<link>` do
   Google Fonts (Big Shoulders Display / Source Serif 4 / IBM Plex Mono —
   powtarzane w każdym zeszycie dla spójności serii), `<style>`.
2. `<body>`: `<div class="wrap" id="klodArticle">` — **cały** widoczny
   content (hero, spis treści, rozdziały `<section class="chapter">`,
   stopka) w środku. `id="klodArticle"` to element, który panel edycji
   podmienia/zapisuje.
3. Każdy `<figure>` **musi** mieć `contenteditable="false"` — chroni
   diagramy SVG przed przypadkowym rozjechaniem w trybie edycji.
4. Na końcu `<body>`, przed `</body>`: panel edycji + motywu — wklej z
   [`biblioteka-edit-toolbar.template.html`](./biblioteka-edit-toolbar.template.html)
   (ten sam folder co ten dokument, **w repo**, portable), podmieniając
   `__SLUG__` na nazwę pliku bez `.html` (np. `zeszyt-04-detailing`).

Diagramy: ręcznie pisane inline SVG (bez bibliotek), jeden `<figure>` na
diagram, `<figcaption>` z podpisem `<b>Rys. N.</b>` — numeracja ciągła w
obrębie zeszytu.

## Edycja w przeglądarce — wymaga migracji SQL (jeszcze nieuruchomionej!)

Panel ma przycisk "✏️ Edytuj" (tylko dla zalogowanych — sprawdza
`supabase.auth.getSession()` z tym samym projektem Supabase co reszta apki,
więc goście automatycznie tego nie widzą) i zapisuje treść przez zwykły
klient `@supabase/supabase-js` ładowany z CDN (`esm.sh`) — **nie** przez
bundler tego repo, bo strony są poza jego buildem.

Migracja gotowa: [`supabase/migration-technical-library.sql`](../../supabase/migration-technical-library.sql).
**Trzeba wkleić ręcznie w Supabase SQL Editor** — zgodnie z konwencją tego
repo (patrz inne pliki `supabase/migration-*.sql` — nikt tu nie używa
`supabase db push` do zwykłych migracji). **Stan na koniec tej sesji: NIE
uruchomiona.** Dopóki ktoś tego nie zrobi, strony działają normalnie
(odczyt), ale "Zapisz" zwróci błąd w konsoli (404, tabela nie istnieje) —
obsłużone przez `try/catch`, nie wywala strony, po prostu edycja nie
zapisuje się trwale.

Po migracji: RLS pozwala czytać wszystkim (`select using (true)`), zapisywać
tylko `auth.role() = 'authenticated'` — dokładnie tak jak reszta katalogu.

## Deploy

Standardowo wg [`.cursor/rules/deploy-catalog-ui.mdc`](../../.cursor/rules/deploy-catalog-ui.mdc):

```bash
npm run deploy:catalog
```

(build + weryfikacja + `firebase deploy --only hosting:katalog`). URL:
https://kenochem-katalog.web.app

**Ważne, nieoczywiste:** w `firebase.json` dodano osobny nagłówek
`Cache-Control: no-cache, no-store, must-revalidate` dla `/biblioteka/**`.
Bez tego przeglądarka (i Service Worker PWA tej apki) potrafiła serwować
**starą wersję zeszytu mimo świeżego deployu** — złapałem to dopiero po
kilku rundach mylącej weryfikacji (wyglądało jakby zmiana "nie wgrała się",
a serwer miał już nową wersję). Jeśli dodajesz nowy typ statycznej treści w
`public/`, która ma się zawsze odświeżać, rozważ to samo.

## Co dalej (niedokończone na koniec sesji)

1. **Uruchomić migrację SQL** (sekcja wyżej) — priorytet, bez tego edycja
   jest tylko na niby.
2. Zeszyt 4: chemia profesjonalna do detailingu — nierozpoczęty.
3. Rozważyć kolejne zeszyty z listy kandydatów wyżej.
4. Drobna uwaga językowa: katalog/produkty konsekwentnie piszą "inżektor",
   artykuły świadomie używają poprawnej formy słownikowej "iniektor" (PWN:
   obie formy istnieją, "iniektor" jest formą podstawową/zalecaną) — to
   celowa niespójność, nie literówka, gdyby ktoś chciał "poprawiać".
