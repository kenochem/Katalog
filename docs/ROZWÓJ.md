# Katalog Kenochem — notatki rozwojowe

> Dokument roboczy: przegląd stanu projektu, dług techniczny i propozycje dalszego rozwoju.  
> Ostatnia aktualizacja: 2026-07-29

## Kontekst

**Katalog** to wewnętrzna PWA magazynowo-katalogowa Kenochem — dwa katalogi w jednej aplikacji:

| Katalog | Źródło | Przeznaczenie |
|---------|--------|----------------|
| **Akcesoria** | Wapro / części do myjek | Magazyn części, braki zdjęć, zestawy |
| **Produkty** | Baselinker / sklep | Asortyment handlowy, stany, Lens (EAN + OCR) |

**Stack:** React + Vite + TypeScript + Tailwind, Supabase (baza + storage), Firebase Hosting.  
**Produkcja:** [kenochem-katalog.web.app](https://kenochem-katalog.web.app)

---

## Stan w repozytorium vs. wersja docelowa

W **tym** clone repozytorium (stan z GitHub) role UI działają przez `localStorage` — przełącznik admin / magazynier / robol bez prawdziwego logowania.

W **nowszej wersji** (lokalna / nie wypchnięta) jest już **logowanie (Supabase Auth)**. Po merge tej wersji poniższe punkty dotyczące auth należy traktować jako **do weryfikacji / domknięcia**, a nie jako start od zera:

- [ ] Czy role są mapowane z profilu użytkownika w Supabase (nie tylko z localStorage)?
- [ ] Czy RLS w bazie odzwierciedla uprawnienia ról (nie tylko front)?
- [ ] Czy anonimowy dostęp do zapisu jest wyłączony?

Reszta uwag technicznych i roadmapy pozostaje aktualna niezależnie od auth.

---

## Co już działa (funkcje)

- Wyszukiwanie Fuse.js: SKU, nazwa, EAN
- Skaner kodów kreskowych (html5-qrcode)
- Karty produktów: stan, zdjęcia, warianty / grupy SKU
- Edycja produktów, dodawanie pozycji (wg roli)
- Tryb edycji stanów (±1) z zapisem do Supabase
- Widok „Bez zdjęć” + dashboard postępu fotografowania
- Zestawy (komplety części) — katalog Akcesoria
- Ulubione (localStorage)
- Kolejka i druk etykiet półkowych
- Motyw jasny / ciemny
- PWA — instalacja na telefonie i desktopie
- **Lens** (katalog Produkty): EAN na żywo → OCR Tesseract z bramką marki (bez ciężkiego AI na telefonie)
- Importy: Wapro, Baselinker → JSON → Supabase (`scripts/`)

---

## Dług techniczny — do rozpatrzenia

### Bezpieczeństwo i dane

| Temat | Opis | Priorytet |
|-------|------|-----------|
| **RLS w Supabase** | W `schema.sql` polityki mają `using (true)` — pełny otwarty dostęp. Po wdrożeniu auth: SELECT dla zalogowanych, UPDATE stock/zdjęć dla magazyniera+, pełny CRUD dla admina. | 🔴 |
| **Service role key** | Tylko w skryptach importu, nigdy w froncie. Audyt `.env` i `.gitignore`. | 🔴 |
| **Weryfikacja auth w prod** | Upewnić się, że wersja z logowaniem jest wdrożona i stary front bez auth nie jest dostępny publicznie. | 🔴 |

### Architektura frontu

| Temat | Opis | Priorytet |
|-------|------|-----------|
| **Monolityczny `App.tsx`** | ~1100 linii — rozbić na hooki (`useCatalog`, `useProducts`, `useLabelQueue`) i mniejsze widoki. | 🟡 |
| **Shop z JSON fallback** | Katalog Produkty ładuje się też z `public/data/shop-products.json` (~2,5 MB). Pełna migracja do Supabase + paginacja / lazy load. | 🟡 |
| **Brak testów** | Smoke testy dla `search.ts`, `roles.ts`, mapowania DB, importów Python. | 🟡 |
| **Brak CI/CD** | GitHub Actions: `npm run build` + opcjonalnie deploy Firebase przy pushu na `main`. | 🟢 |

### Szkielety w kodzie (stan tego clone)

- Widok `admin` w `types/index.ts` — brak UI
- `roles.ts` — komentarze „logowanie później” (do usunięcia po merge wersji z auth)
- Skrypty CLIP embeddings (`build-shop-embeddings.mjs`) — Lens ich **nie używa** (świadomy wybór: lekki EAN + OCR na mobile)

### Wydajność

- Ładowanie całego katalogu naraz (5k+ rekordów) — przy dalszym wzroście rozważyć paginację, wirtualizację listy, indeksy full-text w Supabase
- Upload zdjęć bez automatycznej kompresji / miniatur — wolniejsze ładowanie na mobile

---

## Propozycje rozwoju — co dalej

### Faza 1 — Quick wins (1–2 tygodnie)

| Feature | Opis |
|---------|------|
| **Domknięcie auth + RLS** | Po merge logowania: role w profilu użytkownika, polityki Supabase, wyłączenie anon write. |
| **Historia zmian stanu** | Tabela `stock_log`: kto, kiedy, delta, poprzedni/nowy stan, opcjonalnie powód. Audyt magazynowy. |
| **Lens dla Akcesoriów** | Dziś Lens tylko w katalogu Produkty — magazyn części też skanuje EAN. |
| **Panel admin (statystyki)** | Widok `admin`: braki zdjęć, zerowe stany, ostatnie edycje, podsumowanie per kategoria. |
| **Import różnicowy** | Skrypt: diff Wapro/Baselinker vs Supabase (nowe / zmienione / usunięte) zamiast pełnego uploadu. |

### Faza 2 — Magazyn i operacje (2–4 tygodnie)

| Feature | Opis |
|---------|------|
| **Przyjęcie / wydanie towaru** | Skan EAN → ilość → powód (przyjęcie, sprzedaż, korekta). Zamiast samego ±1. |
| **Inwentaryzacja** | Tryb: lista do policzenia, skan → wpisz stan → raport rozbieżności. |
| **Lokalizacja regałowa** | Pole `location` (np. A-03-2) + wyszukiwanie + na etykiecie. |
| **Zestawy w Produkty** | Zestawy dziś tylko Akcesoria — rozszerzenie na chemię / komplety sklepowe. |
| **Powiadomienia o niskim stanie** | Progi per kategoria / SKU, lista „do zamówienia”. |

### Faza 3 — Wyszukiwanie i zdjęcia (1–2 miesiące)

| Feature | Opis |
|---------|------|
| **Wyszukiwanie obrazem (CLIP) — opcjonalnie desktop** | Skrypty embeddings już są (`@xenova/transformers`). Na desktopie / Wi‑Fi: „znajdź podobny produkt ze zdjęcia”. Mobile: zostawić lekki EAN + OCR. |
| **Batch upload zdjęć** | Widok „Bez zdjęć”: seria zdjęć, auto-przypisanie po EAN (skan / metadane). |
| **Pełna galeria zdjęć** | `extra_images` jest w schemacie — UI: wiele zdjęć, kolejność, usuwanie. |
| **Kompresja przy uploadzie** | WebP, max ~1200px — szybsze ładowanie na telefonie. |
| **OCR marki dla Akcesoriów** | Rozszerzyć słownik producentów części (Kärcher, Nilfisk, itd.) w `ocrLens.ts`. |

### Faza 4 — Integracje i skalowanie

| Feature | Opis |
|---------|------|
| **Sync stanów ↔ Baselinker** | Dwukierunkowy sync stock przez API Baselinker. |
| **Sync Wapro** | Automatyczny cron importu części (jeśli dostępne API / harmonogram eksportu). |
| **Webhook / proste API** | Endpoint do aktualizacji stanu z innych systemów Kenochem. |
| **Eksport CSV / PDF** | Raporty magazynowe, lista braków, etykiety hurtowo. |
| **Własna domena** | np. `katalog.kenochem.com` na Firebase Hosting. |
| **Offline / cache** | Service Worker: cache katalogu + kolejka zmian do sync po powrocie sieci. |
| **Monitoring** | Sentry, uptime — observability dla aplikacji produkcyjnej. |

---

## Proponowana kolejność prac

```
Tydzień 1–2:  Merge auth + RLS + weryfikacja ról w prod
Tydzień 3:    Historia stanów + Lens dla Akcesoriów
Tydzień 4:    Panel admin + import różnicowy
Miesiąc 2:    Przyjęcie/wydanie + lokalizacje regałowe
Miesiąc 3:    Offline cache + inwentaryzacja
Miesiąc 4+:   Baselinker sync + CLIP na desktopie (opcjonalnie)
```

---

## Struktura projektu (skrót)

```
src/
  components/     # UI: katalog, Lens, zestawy, PWA, skaner…
  lib/            # Supabase, search, visualSearch, ocrLens, role, etykiety
public/           # PWA, ikony, dane statyczne (JSON fallback)
scripts/          # import Wapro / Baselinker / upload / embeddings
supabase/         # schema + migracje SQL
data/             # eksporty lokalne (JSON)
docs/             # dokumentacja wewnętrzna (ten plik)
```

---

## Uwagi na spotkanie / backlog

- [ ] Zmergować wersję z logowaniem i zaktualizować ten dokument
- [ ] Ustalić docelowe uprawnienia per rola (admin / magazynier / robol)
- [ ] Priorytet biznesowy: co boli magazyn najbardziej? (stany, zdjęcia, lokalizacje, sync ze sklepem?)
- [ ] Czy CLIP / wyszukiwanie obrazem ma sens, czy wystarczy EAN + OCR?
- [ ] Harmonogram importów Wapro / Baselinker (ręcznie vs cron)

---

*Repozytorium firmowe Kenochem — użycie wewnętrzne.*
