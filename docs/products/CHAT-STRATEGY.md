# Strategia czatu (Talk)

## Rekomendacja (mały zespół Kenochem)

**Nie** doklejać pełnego czatu do każdego produktu (Katalog, Magazyn, Operacje). Rozprasza UX i duplikuje bundl.

| Gdzie | Czat | Dlaczego |
|-------|------|----------|
| **Talk** (`kenochem-talk.web.app`) | Pełny ekran, osobna PWA | Zostawiasz kartę/apkę otwartą na telefonie — jak Slack lite |
| **Suite** | Bańka (drawer) | Admin / operator — wszystko w jednym miejscu |
| **Handel (Sell)** | Bańka | Handlowiec: CRM + szybki DM bez przechodzenia na Talk |
| **Katalog** | Brak | Skupienie na produktach i stanach |
| **Magazyn (Stock)** | Brak | Skupienie na sync / etykietach |
| **Operacje (Ops)** | Brak | Finanse i raporty bez szumu |

### Powiadomienia

- Badge nieprzeczytanych: **Talk** i **Suite/Sell** (Realtime Supabase).
- Opcja później: push PWA tylko na Talk.

### Integracja między aplikacjami

Linki w stopce / menu „Więcej”: *Otwórz Talk* → `https://kenochem-talk.web.app` (ta sama sesja Supabase po zalogowaniu).

## Trade Hub (lab)

Ten sam wzorzec: produkt **Talk** osobno + **Suite** z comms; Sell opcjonalnie z bańką.
