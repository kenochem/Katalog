# Katalog — Kenochem

Wewnętrzny katalog części do myjek. Baza: **Supabase** (darmowy plan).

## Konfiguracja Supabase (jednorazowo)

### 1. Utwórz projekt na [supabase.com](https://supabase.com)

### 2. Uruchom schemat bazy

Dashboard → **SQL Editor** → wklej zawartość pliku `supabase/schema.sql` → **Run**

### 3. Utwórz Storage dla zdjęć

Dashboard → **Storage** → **New bucket**
- Nazwa: `product-images`
- **Public bucket**: włączony

Potem **Policies** na buckecie — dodaj reguły (lub w SQL Editor):

```sql
create policy "public read" on storage.objects for select using (bucket_id = 'product-images');
create policy "public upload" on storage.objects for insert with check (bucket_id = 'product-images');
create policy "public update" on storage.objects for update using (bucket_id = 'product-images');
```

### 4. Skopiuj klucze API

Dashboard → **Settings** → **API**:
- Project URL
- `anon` public key
- `service_role` secret key (tylko do importu z terminala)

### 5. Utwórz plik `.env` w katalogu projektu

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Uruchomienie

```bash
npm install
npm run import:wapro      # import z Wapro → data/products.json
npm run import:supabase   # wgranie do Supabase
npm run dev               # http://localhost:5173
```

## Funkcje

| Funkcja | Opis |
|---------|------|
| **Katalog** | 1274+ części z Wapro, wyszukiwanie po SKU |
| **Bez zdjęć** | 833 pozycji do sfotografowania |
| **Dodaj** | Nowy produkt ze strony |
| **Edycja** | Ołówek w szczegółach produktu |
| **Zestawy** | Gotowe komplety części |

## Publikacja na Firebase (własny URL)

**Baza zostaje w Supabase** — Firebase służy tylko do hostowania strony.

### Jednorazowo — zaloguj się

W terminalu w folderze projektu:

```bash
npx firebase login
```

Otworzy się przeglądarka — zaloguj się kontem Google powiązanym z projektem `kenochem-f4a5b`.

### Wgraj stronę

```bash
npm run deploy
```

Po chwili dostaniesz adres:

**https://kenochem-katalog.web.app**

(alternatywnie: **https://kenochem-f4a5b.web.app**)

### Własna domena (np. katalog.kenochem.com)

1. [Firebase Console](https://console.firebase.google.com/project/kenochem-f4a5b/hosting) → **Hosting**
2. **Add custom domain**
3. Wpisz domenę i postępuj według instrukcji (rekord DNS u rejestratora)
