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

Stack: **React + Vite + TypeScript + Tailwind**, baza / Auth / storage w **Supabase**, hosting na **Firebase Hosting**.

## Główne funkcje

- Logowanie Supabase Auth (konta zakłada admin) lub **Przeglądaj jako gość**
- Role: gość / handlowiec / magazynier / operator / admin (+ panel użytkowników)
- Wyszukiwanie po SKU, nazwie, EAN
- Karty produktów ze stanem i zdjęciami
- Edycja, dodawanie, zestawy, etykiety (wg roli)
- PWA
- **Lens** (Produkty): EAN + OCR z bramką marki

## Szybki start

```bash
npm install
cp .env.example .env   # uzupełnij klucze Supabase
npm run dev            # http://localhost:5173
```

## Konfiguracja Supabase (jednorazowo)

### 1. Projekt + schemat

Dashboard → **SQL Editor** → uruchom `supabase/schema.sql`, potem migracje z `supabase/` (w tym **`migration-auth-profiles.sql`**).

### 2. Auth (Email) — bez publicznej rejestracji

1. **Authentication → Providers → Email** — włączone  
2. Wyłącz **Allow new users to sign up** (użytkowników tworzy tylko admin)  
3. Utwórz pierwsze konto: **Authentication → Users → Add user** (email + hasło)  
4. Nadaj rolę admina:

```sql
update public.profiles
set role = 'admin', display_name = 'Admin', active = true
where email = 'twoj@email.pl';
```

Jeśli wiersz w `profiles` nie powstał automatycznie, wstaw go ręcznie (`id` = UUID z Auth → Users).

### 3. Edge Function `admin-users` (panel Konta)

Tworzenie użytkowników z aplikacji wymaga funkcji (service role tylko po stronie serwera):

```bash
npx supabase login
npx supabase link --project-ref TWOJ_PROJECT_REF
npx supabase functions deploy admin-users
```

Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) są zwykle dostępne automatycznie w Edge Functions.

Bez deployu: admin może **listować / zmieniać role** przez RLS na `profiles`; **tworzenie kont** wymaga funkcji lub Dashboard → Users.

### 4. Storage zdjęć

Bucket `product-images` (public) + policies jak w `schema.sql`.

### 5. Plik `.env`

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`SUPABASE_SERVICE_ROLE_KEY` tylko do skryptów / CLI — nie commituj `.env`.

## Role (skrót)

| Rola | Uprawnienia |
|------|-------------|
| Gość | Podgląd + wyszukiwanie |
| Handlowiec | + ulubione, Lens |
| Magazynier | + stany, etykiety, edycja |
| Operator | + dodawanie produktów |
| Admin | + panel **Konta** |

Sesja zostaje w przeglądarce (PWA) — po zalogowaniu nie trzeba wpisywać hasła przy każdym wejściu. Gość: wybór na czas karty (`sessionStorage`).

### Edge Function `admin-users` (tworzenie kont z panelu)

```bash
npx supabase login
npx supabase link --project-ref fgkkvbniyjysgqcjuxpl
npx supabase functions deploy admin-users
```

## Sync stanów z WAPRO (cykliczny, stałe)

**Nie potrzeba SSH ani udziału sieciowego.** Job na serwerze WAPRO sam czyta SQL i wysyła stany do Supabase:

1. Na serwerze: folder `C:\katalog-sync\`
2. Skopiuj `scripts/sync-wapro-stock-server.ps1`
3. Plik `C:\katalog-sync\katalog-sync.env` (wzorzec `scripts/katalog-sync.env.example`) z `SUPABASE_URL` + **service_role**
4. Test: `powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1`
5. Harmonogram zadań → codziennie (np. 7:00) → ta sama komenda
6. Log: `C:\katalog-sync\sync.log`

SQL: `INDEKS_KATALOGOWY` + `STAN` (`scripts/sql/wapro-stock-export.sql`).

## Import danych

```bash
npm run import:wapro
npm run import:baselinker
npm run import:supabase
npm run import:supabase:shop
```

## Publikacja (Firebase Hosting)

```bash
npx firebase login
npm run deploy
```

- https://kenochem-katalog.web.app  
- https://kenochem-f4a5b.web.app  

## Struktura (skrót)

```
src/                 # aplikacja React
  components/        # UI (katalog, Lens, zestawy, PWA, LoginGate…)
  lib/               # Supabase, auth, search, visualSearch, ocrLens, roles
public/              # PWA, ikony, dane statyczne
scripts/             # import Wapro / Baselinker / sync stanów / upload
supabase/            # schema + migracje SQL + Edge Functions
data/                # eksporty lokalne (JSON)
docs/                # notatki rozwojowe, roadmapa
```

## Rozwój projektu

Notatki: dług techniczny, roadmapa i backlog — [`docs/ROZWÓJ.md`](docs/ROZWÓJ.md).

## Licencja / dostęp

Repozytorium firmowe Kenochem — użycie wewnętrzne.
