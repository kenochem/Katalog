# Build, wdrożenie i wydania

> Stan: 2026-10-02.

## Wymagania

- Node.js (LTS) + npm, Python 3 (`py`) dla skryptów importu, Firebase CLI przez `npx firebase`, Supabase CLI przez `npx supabase`.
- `.env` (lokalnie, w `.gitignore`) — wzorzec: [`.env.example`](../.env.example). Zmienne `VITE_*` **wchodzą do bundla w czasie buildu** — po zmianie trzeba zrobić nowy build i deploy.
- Zalogowany Firebase CLI (`npx firebase login`) z dostępem do projektu `kenochem-f4a5b`.

## Komendy

| Cel | Komenda |
|-----|---------|
| Praca lokalna | `npm run dev:catalog` · `dev` (Suite) · `dev:sell` · `dev:stock` · `dev:ops` · `dev:calendar` · `dev:talk` |
| Sprawdzenie typów | `npx tsc -b` (bez błędów = OK) |
| Build jednego produktu | `npm run build:<produkt>` |
| Wdrożenie jednego produktu | `npm run deploy:<produkt>` (`catalog`, `suite`, `sell`, `stock`, `ops`, `calendar`, `talk`) |
| Wdrożenie wszystkiego | `npm run deploy` (to samo co `deploy:products`) |
| Podgląd buildu | `npm run preview:catalog` / `preview:suite` |

`build:<produkt>` robi kolejno: generowanie ikon → `prepare-product-build.mjs` (manifest PWA + `index.<produkt>.html`) → `tsc -b` → `vite build --mode <produkt>` → `finalize-product-dist.mjs`. Deploy katalogu dodatkowo sprawdza zawartość `dist-catalog` (`verify-hosting-dist.mjs`).

## Co wdrażać po zmianie

Kod `App.tsx` i wspólne komponenty trafiają do **wielu** produktów — wdrażaj wszystkie, których dotyczy zmiana:

| Zmiana w… | Wdróż |
|-----------|-------|
| Katalog (widoki, wyszukiwanie, karty produktów) | `catalog`, `suite`, `sell`, `stock` (wspólny kod) — minimum `catalog` |
| CRM (koszyk, oferty, klienci) | `sell`, `suite` (+ `catalog`, jeśli ruszasz kartę produktu) |
| Operacje | `ops`, `suite` |
| Wspólny nagłówek/nawigacja/CSS | wszystkie |
| Tylko dziennik aktualizacji (`appChangelog.ts`) | `catalog` |

## Elementy wdrażane ręcznie (poza Firebase)

| Co | Jak | Dokument |
|----|-----|----------|
| Agent WAPRO (`sync-wapro-stock-server.ps1`) | Skopiować plik na serwer WAPRO do `C:\katalog-sync\` | [`WAPRO-SYNC.md`](./WAPRO-SYNC.md) |
| Migracje SQL | Wkleić w Supabase → SQL Editor | [`BAZA-DANYCH.md`](./BAZA-DANYCH.md) |
| Edge Functions | `npx supabase functions deploy <nazwa>` | [`BAZA-DANYCH.md`](./BAZA-DANYCH.md) |

## Checklista wydania

1. `npx tsc -b` — czysto.
2. Zmiana widoczna dla użytkowników → **wpis w dzienniku aktualizacji**: `src/data/appChangelog.ts` (data, tytuł, opis, tag `nowość` / `poprawka` / `wydajność`). Wpisy są grupowane po dniach w *Nowości → Aktualizacje*.
3. Zmiana w `scripts/sync-wapro-stock-server.ps1` → sprawdź parser (zasady w [`WAPRO-SYNC.md`](./WAPRO-SYNC.md)) i przekaż informację o **ręcznym skopiowaniu** na serwer.
4. Nowa tabela / kolumna → migracja w `supabase/` + informacja o ręcznym uruchomieniu.
5. `npm run deploy:<produkt>` dla każdego dotkniętego produktu.
6. Sprawdź na produkcji (gość widzi tylko katalog; widoki CRM/Ops/logi wymagają logowania — przetestuj na koncie z odpowiednią rolą).
7. Commit i push do `main` (patrz niżej).

## Git

- Repozytorium: https://github.com/kenochem/Katalog, gałąź `main`.
- Nie commitujemy: `.env*` (poza `.env.example`), `dist*`, `node_modules`, `index.<produkt>.html` (generowane), `katalog-sync.env`, kluczy `service_role`, lokalnych narzędzi (`.claude/`, `.cursor/`).
- Komunikaty commitów po polsku, w trybie rozkazującym lub opisowym, z podaniem obszaru (np. `Katalog: …`, `Ops: …`, `WAPRO sync: …`, `Docs: …`).
- Zalecane commity tematyczne (jeden obszar = jeden commit), nie jeden wielki „WIP".

## Znane pułapki

- **Świeży klon bez `.env.<produkt>`**: produkt wyznacza tryb vite (`--mode`), więc `build:<produkt>` działa poprawnie; same pliki `.env.<produkt>` nie są potrzebne.
- **`index.<produkt>.html` jest generowany** przed buildem — nie edytuj go; zmiany w `index.base.html` i `scripts/product-build-config.mjs`.
- **Cache PWA / service worker**: po wdrożeniu użytkownicy mogą przez chwilę widzieć starą wersję; aplikacja sama odświeża się przy błędzie ładowania nieistniejącego chunka (`main.tsx`).
- **Brak CI** — build i deploy odbywają się lokalnie.
