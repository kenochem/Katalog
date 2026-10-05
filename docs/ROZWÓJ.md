# Rozwój projektu — stan, dług techniczny, backlog

> Dokument roboczy. Ostatnia aktualizacja: **2026-10-02** (przepisany od zera — poprzednia wersja z 07.2026 opisywała stan sprzed logowania i RLS).

## Stan obecny (skrót)

- 8 aplikacji z jednej bazy kodu ([`products/ARCHITECTURE.md`](./products/ARCHITECTURE.md)), wszystkie poza Talk (wyłączony) i Logistyką (placeholder) działają produkcyjnie.
- Logowanie Supabase Auth, role z macierzą uprawnień (domyślna w kodzie + nadpisania z bazy), konta zakłada admin.
- Dane z WAPRO Mag: stany/ceny (codziennie + na żądanie), sprzedaż (na żądanie), log zmian (od 24.09.2026), auto-import nowych SKU ([`WAPRO-SYNC.md`](./WAPRO-SYNC.md)).
- Funkcje katalogu: wyszukiwanie, Decyzje (z masowym zatwierdzaniem kategorii), Bez zdjęć (z trybem Szybkie zdjęcia), Nowości, Zmiany w czasie, Logi, Biblioteka, etykiety, zestawy, magazyn z układem 3D ([`KATALOG-FUNKCJE.md`](./KATALOG-FUNKCJE.md)).
- Operacje: analiza sprzedaży, martwy stock (współdzielone wykluczenia), finanse.
- CRM: koszyk, oferty PDF z numeracją i polami netto/brutto, lejek, klienci, mapa, kalendarz, skrzynka e-mail.

## Dług techniczny

| Temat | Opis | Priorytet |
|-------|------|-----------|
| **Brak testów automatycznych** | Zero testów (`vitest`/`jest`). Pierwsze kandydatury: `productSearchIndex`, `catalogCategory`, `roleDefinitions`, `quotePdf` (rachunki netto/brutto), mapowania `db.ts` | 🟡 |
| **Martwy kod trybu „hub osadzony”** | Po przebudowie Suite na launcher `embeddedInHub` w `App.tsx` jest zawsze `false`. Do usunięcia: `src/suite/SuiteHubContext.tsx`, `hubLoaders.tsx`, `HubSegmentOverlay.tsx`, `hubViewMap.ts`, `src/components/hub/HubShell*` i powiązane gałęzie w `App.tsx` | 🟢 |
| **Brak CI** | Build i deploy ręcznie z lokalnej maszyny. Minimum: GitHub Actions z `tsc -b` + `build:catalog` na PR | 🟡 |
| **Monolityczny `App.tsx`** | ~3000 linii, współdzielony przez Katalog/Handel/Operacje; widoki wbudowane w plik (`MissingImagesView`, `LabelsView`…). Wydzielać do `src/modules/*` i osobnych plików (zasada z `ROADMAP.md`) | 🟡 |
| **Agent WAPRO wdrażany ręcznie** | Kopiowanie `.ps1` na serwer bez wersjonowania. Pomysł: numer wersji w logu startu + prosty skrypt `install-katalog-sync.ps1` jako jedyna ścieżka aktualizacji | 🟡 |
| **Kruchość PowerShell 5.1** | Brak BOM + polskie znaki w kodzie psuły parser; `@(List[object])` rzuca wyjątek (zasady w [`WAPRO-SYNC.md`](./WAPRO-SYNC.md)). Rozważyć migrację agenta na PowerShell 7 lub zapis z BOM | 🟡 |
| **`product_sync_changes` bez czyszczenia** | Tabela rośnie bez końca; dodać cykliczne czyszczenie (np. > 18 mc) albo partycjonowanie | 🟢 |
| **Śmieci w repo** | `scripts/tmp-*`, `scripts/sync-wapro-stock-server.ps1.bak-check`, `docs/future/*`, szkielet `apps/` i `packages/` — sprawdzić i usunąć/zarchiwizować | 🟢 |
| **Martwy kod Lens/OCR** | `src/lib/ocrLens.ts` + `tesseract.js` + skrypty embeddings nie są podpięte do UI. Albo przywrócić funkcję, albo usunąć zależność | 🟢 |
| **Dane statyczne w repo** | `public/data/*.json` (~4 MB surowo) są generowane i commitowane; rozważyć generowanie w buildzie | 🟢 |

## Jakość danych — do posprzątania

- ~300 produktów sklepu ma tag „Sonax" (znacznik z rozliczeń Sonax w Ops), także te innych marek. Wyszukiwarka już go ignoruje, ale tag wciąż jest w danych.
- Kategoria „Do decyzji" / ogólne kategorie źródłowe — duży backlog; pomaga masowe zatwierdzanie w *Decyzjach* oraz skrypt `sync-wp-shop-categories.mjs` (drzewo kategorii w repo pochodzi z 24.08.2026 — odśwież przed użyciem).
- Braki zdjęć uzupełniane ręcznie (zespół w sklepie).

## Backlog funkcji (pomysły z rozmów, nieuruchomione)

**Szybkie zyski**
- *Braki EAN* — wąski widok „ma stan, brak EAN" (dziś to tylko jeden z sygnałów w *Decyzjach*).
- *Czego szukają, a nie znajdują* — log zapytań bez wyników (literówki, luki w katalogu).
- *Cennik PDF/do druku* per kategoria (obok surowego CSV).

**Średnie**
- *Kategorie* — widok drzewa kategorii sklepu z liczbą produktów i brakami przypisań.
- *Duplikaty* — wykrywanie tych samych EAN / podobnych nazw po scaleniu BaseLinker + WAPRO.
- *Marki* — zestawienie per producent (liczba SKU, braki, wartość stanu).
- *Marża* — przegląd marż z wykrywaniem ujemnych / podejrzanie niskich.
- *Generowanie opisów AI* — przycisk przy słabo opisanym produkcie. Kontekst jest gotowy (`src/lib/productAiContext.ts` → dziś ręczne wklejanie do czatu); brakuje Edge Function z kluczem po stronie serwera.

**Większe**
- *Historia z WAPRO wstecz (do 12–24 mc)*:
  - **sprzedaż** — da się (dokumenty sprzedaży sięgają 24 mc); zapytanie `extended_v2` (rozbicie miesięczne) obecnie spada do `bulk_v1` — do naprawy po odczytaniu komunikatu SQL z logu,
  - **stan w czasie** — rekonstrukcja wstecz z dokumentów magazynowych (przyjęcia − wydania),
  - **ceny w czasie** — nieznane, czy Mag przechowuje historię; sprawdzić `-DiagnosePriceSchema`.
- *Inwentaryzacja* — tryb „skanuj i porównaj ze stanem" na bazie istniejącego skanera.
- *Zamówienia do WAPRO (ZO)* — przycisk w CRM tworzy zlecenia; brakuje wdrożonego agenta serwerowego ([`future/wapro-orders`](./future/wapro-orders/README.md)).
- *Talk* — włączenie czatu (`TALK_SUSPENDED = false`) po ocenie kosztów Realtime/Storage.
- *Logistyka* — trasy i dostawy (placeholder).

## Bezpieczeństwo — pamiętać

- `SUPABASE_SERVICE_ROLE_KEY` tylko na serwerze WAPRO i w lokalnym `.env`; nigdy w froncie ani repo.
- Okresowo przejrzeć polityki RLS tabel z danymi wrażliwymi (CRM, ceny zakupu) pod kątem roli `anon`.
- Hasła skrzynek e-mail CRM trzymane są wyłącznie po stronie Edge Function `crm-mail`.
