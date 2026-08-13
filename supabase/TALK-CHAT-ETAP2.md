# Talk — etap 2 (push jak messenger przy zamkniętej apce)

Dotyczy **tylko** https://kenochem-talk.web.app — build `npm run build:talk` / `deploy:talk`.

## 1. SQL (Supabase Dashboard → SQL Editor)

Jeśli etap 1 już był — **tylko**:

```text
supabase/migration-chat-push-subscriptions.sql
```

→ wklej cały plik → **Run**.

(Jeśli nie było głosówek: najpierw `migration-chat-voice-bucket.sql`.)

## 2. Klucze VAPID

Lokalnie (PowerShell):

```powershell
npx web-push generate-vapid-keys
```

- **Public key** → w `.env` (i `.env.talk` jeśli używasz):

```env
VITE_VAPID_PUBLIC_KEY=BNx...
```

- **Private key** → **tylko** Supabase (Edge Function secrets), nigdy w repo.

Subject (mail kontaktowy):

```text
VAPID_SUBJECT=mailto:it@kenochem.pl
```

**Ważne:** po dodaniu `VITE_VAPID_PUBLIC_KEY` zrób ponownie `npm run deploy:talk` (klucz musi być w bundlu).

## 3. Edge Function `chat-push`

Z katalogu projektu (zalogowany `supabase login`, projekt podlinkowany):

```powershell
npx supabase secrets set VAPID_PUBLIC_KEY="..." VAPID_PRIVATE_KEY="..." VAPID_SUBJECT="mailto:it@kenochem.pl" CHAT_PUSH_WEBHOOK_SECRET="losowy-długi-ciag"
```

Deploy funkcji:

```powershell
npm run deploy:chat-push
```

(lub: `npx supabase functions deploy chat-push`)

Secrets `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` Supabase zwykle ustawia automatycznie dla funkcji.

## 4. Database Webhook

Supabase → **Database** → **Webhooks** → **Create a new hook**

| Pole | Wartość |
|------|---------|
| Name | `chat_messages_push` |
| Table | `chat_messages` |
| Events | **Insert** |
| Type | HTTP Request |
| Method | POST |
| URL | `https://<TWÓJ-REF>.supabase.co/functions/v1/chat-push` |
| Headers | `Content-Type: application/json` |
| | `x-chat-push-secret: <ten sam co CHAT_PUSH_WEBHOOK_SECRET>` |

(Jeżeli funkcja ma `verify_jwt = false` w `config.toml`, **nie** musisz dodawać `Authorization` — wystarczy secret w nagłówku.)

## 5. Telefon użytkownika

1. Otwórz Talk w Chrome / Safari.  
2. **Dodaj do ekranu głównego** (PWA).  
3. W Talk: ustawienia czatu → **Powiadomienia push** → zezwól.  
4. (Opcjonalnie) baner na dole ekranu „Włącz powiadomienia”.

Test: drugie konto wysyła DM → zamknij Talk całkowicie → powiadomienie systemowe.

## 6. Diagnostyka

- **Brak push, dźwięk działa** — brak VAPID w buildzie albo brak subskrypcji w `chat_push_subscriptions`.  
- **Funkcja 401** — zły `x-chat-push-secret` w webhooku.  
- **Funkcja 503** — brak VAPID w secrets funkcji.  
- **sent: 0** w logu funkcji — odbiorca nie włączył push / brak wiersza w `chat_push_subscriptions`.

Logi: Supabase → Edge Functions → chat-push → Logs.
