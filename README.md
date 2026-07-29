# Katalog — Kenochem

Wewnętrzna aplikacja magazynowo-katalogowa Kenochem: przeglądanie towarów, stany, zdjęcia, zestawy oraz szybkie wyszukiwanie (w tym skan EAN / Lens).

**Produkcja:** [kenochem-katalog.web.app](https://kenochem-katalog.web.app)  
**Repozytorium:** [github.com/kenochem/Katalog](https://github.com/kenochem/Katalog)

## Co to jest

Katalog łączy dwa źródła produktów w jednej aplikacji webowej (PWA):

| Katalog | Źródło | Przeznaczenie |
|---------|--------|----------------|
| **Akcesoria** | Wapro / części do myjek | Magazyn części, braki zdjęć, zestawy |
| **Produkty** | Baselinker / sklep | Asortyment handlowy, stany, Lens (EAN + OCR) |

Stack: **React + Vite + TypeScript + Tailwind**, baza i storage w **Supabase**, hosting na **Firebase Hosting**.

## Główne funkcje

- Wyszukiwanie po SKU, nazwie, EAN (Fuse.js)
- Karty produktów ze stanem magazynowym i zdjęciami
- Edycja produktów, dodawanie nowych pozycji
- Widok „bez zdjęć” / postęp fotografowania
- Zestawy (komplety części)
- Druk / kolejka etykiet
- Role UI: admin / magazynier / robol (przełącznik lokalny)
- PWA (instalacja na telefonie i desktopie)
- **Lens** (tylko Produkty): skaner EAN na żywo + zdjęcie; przy braku EAN lokalny OCR z bramką marki (bez Gemini / CLIP na telefonie)

## Szybki start

```bash
npm install
cp .env.example .env   # uzupełnij klucze Supabase
npm run dev            # http://localhost:5173
```

## Konfiguracja Supabase (jednorazowo)

### 1. Utwórz projekt na [supabase.com](https://supabase.com)

### 2. Uruchom schemat bazy

Dashboard → **SQL Editor** → wklej zawartość pliku `supabase/schema.sql` → **Run**  
(w razie potrzeby kolejne migracje z folderu `supabase/`)

### 3. Utwórz Storage dla zdjęć

Dashboard → **Storage** → **New bucket**
- Nazwa: `product-images`
- **Public bucket**: włączony

Policies (SQL Editor):

```sql
create policy "public read" on storage.objects for select using (bucket_id = 'product-images');
create policy "public upload" on storage.objects for insert with check (bucket_id = 'product-images');
create policy "public update" on storage.objects for update using (bucket_id = 'product-images');
```

### 4. Klucze API → plik `.env`

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`SUPABASE_SERVICE_ROLE_KEY` tylko do skryptów importu — nie commituj `.env`.

## Import danych

```bash
npm run import:wapro         # części → data/products.json
npm run import:baselinker    # sklep → data/shop-products.json
npm run import:supabase      # wgranie do Supabase
npm run import:supabase:shop # tylko katalog Produkty
```

## Publikacja (Firebase Hosting)

Baza zostaje w Supabase — Firebase tylko hostuje front.

```bash
npx firebase login
npm run deploy
```

- https://kenochem-katalog.web.app  
- https://kenochem-f4a5b.web.app  

Własna domena: Firebase Console → Hosting → Add custom domain.

## Struktura (skrót)

```
src/                 # aplikacja React
  components/        # UI (katalog, Lens, zestawy, PWA…)
  lib/               # Supabase, search, visualSearch, ocrLens, role
public/              # PWA, ikony, dane statyczne
scripts/             # import Wapro / Baselinker / upload
supabase/            # schema + migracje SQL
data/                # eksporty lokalne (JSON)
docs/                # notatki rozwojowe, roadmapa
```

## Rozwój projektu

Notatki: dług techniczny, roadmapa i backlog — [`docs/ROZWÓJ.md`](docs/ROZWÓJ.md).

## Licencja / dostęp

Repozytorium firmowe Kenochem — użycie wewnętrzne.
