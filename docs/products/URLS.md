# Adresy produktów Kenochem (Firebase Hosting)

Jeden projekt GCP: `kenochem-f4a5b`. Osobny build SPA (`dist-*`) na każdy URL.

| Produkt | Site ID | URL (web.app) | Moduły | Status |
|---------|---------|---------------|--------|--------|
| **Katalog** | `kenochem-katalog` | https://kenochem-katalog.web.app | catalog | ✅ produkcja |
| **Suite** | `kenochem-f4a5b` | https://kenochem-f4a5b.web.app | wszystko | ✅ produkcja |
| **Handel (CRM)** | `kenochem-sell` | https://kenochem-sell.web.app | catalog + crm + czat (bańka) | ✅ deploy |
| **Magazyn** | `kenochem-stock` | https://kenochem-stock.web.app | catalog (focus magazyn) | ✅ deploy → rozwój osobno |
| **Operacje** | `kenochem-ops` | https://kenochem-ops.web.app | ops (finanse, marże) | ✅ deploy |
| **Talk** | `kenochem-talk` | https://kenochem-talk.web.app | comms (pełny ekran) | ✅ deploy |
| **Logistyka** | `kenochem-logistics` | https://kenochem-logistics.web.app | (placeholder) | 🔜 trasy / dostawy |

Docelowo własne domeny: `katalog.kenochem.pl`, `sell.…`, itd. — mapowanie w Firebase → Custom domains.

## Czat — jak używać

Zobacz [`CHAT-STRATEGY.md`](./CHAT-STRATEGY.md).

## Komendy

```bash
npm run setup:hosting-sites   # jednorazowo: tworzy site w Firebase
npm run build:products        # wszystkie buildy
npm run deploy:products       # build + hosting (wszystkie witryny)
```
