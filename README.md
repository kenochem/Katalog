# Katalog — Kenochem

Wewnętrzna aplikacja magazynowo-katalogowa Kenochem: przeglądanie towarów, stany, zdjęcia, zestawy oraz szybkie wyszukiwanie (w tym skan EAN / Lens).

**Produkcja:** [kenochem-katalog.web.app](https://kenochem-katalog.web.app)  
**Repozytorium:** [github.com/kenochem/Katalog](https://github.com/kenochem/Katalog)

## Co to jest

Katalog łączy dwa źródła produktów w jednej aplikacji webowej (PWA):

| Katalog | Źródło | Przeznaczenie |
|---------|--------|----------------|
| **Akcesoria** | Wapro / części do myjek | Magazyn części, braki zdjęć, zestawy |
| **Produkty** | Baselinker / sklep | Asortyment handlowy, stany, Lens (rozpoznawanie po zdjęciu) |

Stack: **React + Vite + TypeScript + Tailwind**, baza / Auth / storage w **Supabase**, hosting na **Firebase Hosting**.

## Główne funkcje

- Logowanie Supabase Auth (konta zakłada admin) lub **Przeglądaj jako gość**
- Role: gość / handlowiec / magazynier / operator / admin (+ panel użytkowników)
- Wyszukiwanie po SKU, nazwie, EAN
- Karty produktów ze stanem i zdjęciami
- Edycja, dodawanie, zestawy, etykiety (wg roli)
- PWA
- **Lens** (Produkty): porównanie wyglądu (CLIP) ze zdjęciami katalogu — przód butelki/opakowania (top 3). Czytnik EAN osobno.
- Po dużym imporcie shop: `npm run embeddings:shop` (indeks `/data/shop-embeddings.json`)

## Szybki start

```bash
npm install
cp .env.example .env   # uzupełnij klucze Supabase
npm run dev            # http://localhost:5173
```

## Konfiguracja Supabase (jednorazowo)

### 1. Projekt + schemat

Dashboard → **SQL Editor** → uruchom `supabase/schema.sql`, potem migracje z `supabase/` (w tym **`migration-auth-profiles.sql`**, **`migration-user-favorites.sql`**).

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
# opcjonalnie — zamówienie → Discord (webhook)
# VITE_DISCORD_ORDERS_WEBHOOK=https://discord.com/api/webhooks/ID/TOKEN
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`SUPABASE_SERVICE_ROLE_KEY` tylko do skryptów / CLI — nie commituj `.env`.

### Discord — zamówienia z katalogu

1. Na Discordzie: kanał (np. `#zamowienia`) → **Edytuj kanał** → **Integracje** → **Webhooki** → **Nowy webhook**.
2. Skopiuj URL webhooka (`https://discord.com/api/webhooks/...`).
3. W pliku `.env` (lokalnie) i w zmiennych builda Firebase / CI ustaw:
   ```env
   VITE_DISCORD_ORDERS_WEBHOOK=https://discord.com/api/webhooks/...
   ```
4. Zrób **nowy build i deploy** (`npm run deploy`) — zmienne `VITE_*` wchodzą do bundla przy buildzie, nie działają „na żywo” po samym zapisaniu `.env` na serwerze.
5. W katalogu: **Zamówienie** → pozycje + klient → **Discord**. Wiadomość zaczyna się od `Handlowiec: {imię}` (np. Kamil).

Bez webhooka przycisk **Discord** kopiuje tekst do schowka (można wkleić ręcznie).

### CRM — klienci, NIP, historia

Rozwój lejka (oferty, statusy, audyt) — mapa z CRM-Base: [`docs/crm-from-crm-base.md`](docs/crm-from-crm-base.md).

1. W Supabase SQL Editor uruchom [`supabase/migration-crm-clients-orders.sql`](supabase/migration-crm-clients-orders.sql).
2. Deploy Edge Function (lookup NIP → biała lista VAT MF):
   ```bash
   npx supabase functions deploy nip-lookup
   ```
3. W aplikacji (zalogowany handlowiec/operator/admin): **Zamówienie** → zakładki **Aktualne / Klienci / Historia**.
4. **Po NIP** — wyszukuje firmę w MF; możesz nadać własną nazwę (`display_name`) i zapisać na swoją listę.
5. Po **Discord** zamówienie trafia do historii (i draft się czyści). **Zapisz** zapisuje bez wysyłki.

Klienci i historia są **tylko Twoje** (RLS po `auth.uid()`).

### Czat (ogólny + DM)

Kompaktowy panel (desktop: małe okienko prawy-dół; mobile: sheet od dołu) — tylko dla zalogowanych.

1. W Supabase SQL Editor uruchom [`supabase/migration-chat.sql`](supabase/migration-chat.sql) (tabele + Realtime + RLS).
2. Po deployu: zielona bańka → **Ogólny** lub DM.

### CRM — mapa i trasy

1. Migracja geo: [`supabase/migration-crm-client-geo.sql`](supabase/migration-crm-client-geo.sql) (`lat`/`lng` na klientach).
2. W CRM: **Mapa klientów** / **Trasy** — pinezki (klik mapę lub geokod z adresu), budowa trasy z czasami (OSRM + OpenStreetMap).

## Role (skrót)

| Rola | Uprawnienia |
|------|-------------|
| Gość | Podgląd katalogu ze zdjęciami — bez edycji, etykiet, zamówień, cen |
| Handlowiec | Zamówienia, oferty, zdjęcia (+), katalog, **ceny/marża** — bez stanów, usuwania zdjęć, kont |
| Magazynier | Stany, etykiety, dodawanie zdjęć — bez zamówień, zestawów, edycji produktów, cen |
| Operator | Pełna praca (w tym ceny) — bez panelu kont |
| Admin | + **Konta**, podgląd **Uprawnień**, **Higiena EAN** |

Ceny (zakup/sprzedaż netto + sprzedaż brutto z WAPRO; marża = (sprzedaż−zakup)/sprzedaż netto, jak w WAPRO) widać tylko handlowiec / operator / admin — w karcie produktu (Akcesoria i Produkty po wspólnym SKU). Migracja: `supabase/migration-product-prices.sql`. Dopisanie cen/stanów do Produktów z XLS: `npm run import:shop-prices` (generuje też `data/wapro-stock.csv`) → `npm run sync:wapro-stock` (oba katalogi w Supabase).

Admin → **Uprawnienia**: podgląd macierzy ról (edycja w przyszłości). **EAN**: lista podejrzanych kodów (brak / format / checksum / duplikaty).

Sesja zostaje w przeglądarce (PWA) — po zalogowaniu nie trzeba wpisywać hasła przy każdym wejściu. Gość: wybór na czas karty (`sessionStorage`).

### Edge Functions

```bash
npx supabase login
npx supabase link --project-ref fgkkvbniyjysgqcjuxpl
npx supabase functions deploy admin-users
npx supabase functions deploy nip-lookup
```

## Sync stanów z WAPRO (cykliczny, stałe)

**Nie potrzeba SSH ani udziału sieciowego.** Job na serwerze WAPRO sam czyta SQL i wysyła stany do Supabase:

1. Na serwerze: folder `C:\katalog-sync\`
2. Skopiuj skrypt (albo uruchom `powershell -File scripts\install-katalog-sync.ps1` z repo)
3. Plik `C:\katalog-sync\katalog-sync.env` (wzorzec `scripts/katalog-sync.env.example`) z `SUPABASE_URL` + **service_role**
4. Test: `powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1`
5. Harmonogram zadań → codziennie (np. 7:00) → ta sama komenda
6. Log: `C:\katalog-sync\sync.log`

SQL: stany (+ opcjonalnie ceny netto) — `scripts/sql/wapro-stock-export.sql`.  
CSV może zawierać `sku;stock;price_purchase_net;price_sale_net;price_sale_gross`.

**Ręczny sync z aplikacji:** strzałka przy Odśwież → „Synchronizuj stany WAPRO”.
Sync ustawia **stany i ceny dokładnie jak w Mag** (w górę i w dół). Zakres = **aktywna zakładka** (Akcesoria albo Produkty).

Po wdrożeniu aktualnego `scripts/sync-wapro-stock-server.ps1` na `C:\katalog-sync\` **skopiuj ponownie** `.ps1` na serwer WAPRO (oraz migracja `migration-stock-sync-catalog.sql`).

Jeśli toast pokazuje `brak w WAPRO: …` / `SKU z SQL: 0` — eksport SQL się wywalił; sprawdź `C:\katalog-sync\sync.log` i `wapro-stock.raw`.  
Wymaga migracji `supabase/migration-stock-sync-requests.sql` oraz drugiego zadania Harmonogramu co **2 min**:

```text
powershell.exe -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-stock-server.ps1 -OnlyIfPending
```

(podmień też `.ps1` na serwerze po aktualizacji).

## Import danych

```bash
npm run import:wapro
npm run import:baselinker
npm run import:sonax          # merge dziedziczonego katalogu sonax.sklep.pl (tag Sonax, bez duplikatów)
npm run import:shop-prices    # ceny WAPRO → Produkty po SKU
npm run import:supabase
npm run import:supabase:shop
```

Mały eksport Sonax (~500 SKU) nie nadpisuje pełnego katalogu przy `import:baselinker` — do merge używaj `import:sonax`. Migracja tagów: `supabase/migration-product-tags.sql`.
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
