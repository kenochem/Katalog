# Talk — etap 1 (wygląd, dźwięki, głosówki)

Frontend jest wdrożony w Talk i w drawerze czatu w katalogu.

## Co działa po etapie 1 (bez etapu 2)

| Funkcja | Gdzie |
|--------|--------|
| Motywy, tapety, kolory bańek, odstępy | Ustawienia czatu (ikona zębatki / menu profilu w Talk) |
| Dźwięk nowej wiadomości + wysłania | Włącz/wyłącz w ustawieniach |
| Powiadomienie systemowe gdy aplikacja w tle (ten sam telefon) | Po zezwoleniu w ustawieniach — bez VAPID tylko gdy Realtime dociera do otwartej PWA |
| Głosówki (max 60 s) | Przycisk mikrofonu w polu wiadomości |

## SQL — co wkleić w Supabase (etap 1)

Jeśli podstawowy czat już masz (`migration-chat.sql` itd.), **etap 1 wymaga tylko**:

```text
supabase/migration-chat-voice-bucket.sql
```

→ **Dashboard → SQL Editor → wklej cały plik → Run.**

Opcjonalnie (avatary w liście osób — jeśli jeszcze nie było):

- `migration-user-cloud-platform.sql`
- `migration-chat-peers-avatar.sql`

## Etap 2 (później — push jak WhatsApp przy zamkniętej apce)

Nie uruchamiaj tego w etapie 1, dopóki nie będziecie gotowi na VAPID i webhook:

1. `supabase/migration-chat-voice-push.sql` (tabela `chat_push_subscriptions` — można też osobno)
2. Klucze VAPID w `.env`: `VITE_VAPID_PUBLIC_KEY`
3. Deploy Edge Function: `supabase/functions/chat-push`
4. Database Webhook na `INSERT` do `chat_messages`

Szczegóły w komentarzach na górze `migration-chat-voice-push.sql`.

## Test etapu 1

1. Dwa konta, Talk: https://kenochem-talk.web.app  
2. Ustawienia → tapeta + dźwięki włączone  
3. DM: tekst + głosówka (mikrofon)  
4. Druga osoba na innym urządzeniu — wiadomość na żywo + dźwięk, jeśli nie patrzy w ten wątek  
