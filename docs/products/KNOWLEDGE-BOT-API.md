# API uzupełniania wiedzy (boty zewnętrzne)

Bot może **czytać** publiczny export (`/data/knowledge/*.jsonl`) oraz **dopisywać** opisy i parametry przez Edge Function — bez logowania użytkownika, za pomocą wspólnego sekretu.

## Wymagania po stronie serwera (Supabase)

1. **Secret:** `KNOWLEDGE_BOT_SECRET` — długi losowy ciąg (Dashboard → Project Settings → Edge Functions → Secrets).
2. **Deploy funkcji:**
   ```bash
   npx supabase functions deploy product-knowledge --project-ref TWOJ_REF
   ```
3. Lokalnie w `.env` (skrypty / testy): ten sam secret do nagłówka.

Bez deployu i secretu endpoint zwróci 503/401.

## URL

```
POST https://[PROJECT_REF].supabase.co/functions/v1/product-knowledge
```

Nagłówki:

| Nagłówek | Wartość |
|----------|---------|
| `Content-Type` | `application/json` |
| `apikey` | anon key Supabase (standardowo przy Functions) |
| `X-Knowledge-Bot-Key` | wartość `KNOWLEDGE_BOT_SECRET` |

Alternatywa: `Authorization: Bearer [KNOWLEDGE_BOT_SECRET]`.

## Odczyt stanu produktu

```json
{
  "action": "get",
  "sku": "INNE1006"
}
```

Odpowiedź (skrót): `shortDescription`, `parameters`, `descriptionPlain`, `completenessScore`, `knowledgeBotLast`.

## Uzupełnienie (domyślnie tylko puste pola)

```json
{
  "action": "patch",
  "sku": "INNE1006",
  "source": "moj-bot-v1",
  "overwrite": false,
  "patch": {
    "shortDescription": "Krótki opis produktu dla katalogu i RAG.",
    "description": "Dłuższy opis — HTML nie jest wymagany.",
    "parameters": {
      "Zastosowanie": "Myjnie ciśnieniowe",
      "Pojemność": "5 L"
    },
    "weightKg": 1.2,
    "unit": "szt."
  }
}
```

- **`parameters`** — zawsze scalane (klucze z patch nadpisują istniejące).
- **`shortDescription`**, **`description`**, liczby w meta — wypełniane tylko gdy puste, chyba że `"overwrite": true`.
- **`description`** w patch aktualizuje kolumnę `products.description` tylko gdy obecny opis ma &lt; 40 znaków (plain) lub `overwrite`.
- Po sukcesie w `product_meta.knowledgeBotLast` zapisywane są: `source`, `at`, `fields`.

Odpowiedź: `updated`, `fields`, `completenessScore` (0–100, ta sama logika co w katalogu).

## Bezpieczeństwo

- Sekret trzymaj poza repozytorium; rotuj przy wycieku.
- Bot **nie** powinien ustawiać cen, stanów magazynowych ani usuwać produktów — endpoint tego nie obsługuje.
- Rate limiting rozważ na poziomie Supabase / reverse proxy.

## Powiązane

- Export read-only: [KNOWLEDGE-LIBRARY.md](./KNOWLEDGE-LIBRARY.md)
- Ocena w UI: `assessProductKnowledge` w `src/lib/productKnowledge.ts`
