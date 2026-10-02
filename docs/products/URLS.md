# Adresy produktów Kenochem (Firebase Hosting)

> Stan: 2026-10-02. Jeden projekt GCP/Firebase: `kenochem-f4a5b`. Osobny build SPA (`dist-*`) na każdy adres.

| Produkt | Target (`firebase.json`) | Site ID | URL | Moduły | Status |
|---------|--------------------------|---------|-----|--------|--------|
| **Katalog** | `katalog` | `kenochem-katalog` | https://kenochem-katalog.web.app | katalog | ✅ produkcja |
| **Suite** | `suite` | `kenochem-f4a5b` | https://kenochem-f4a5b.web.app | katalog + CRM + Ops + kalendarz | ✅ produkcja |
| **Handel** | `sell` | `kenochem-sell` | https://kenochem-sell.web.app | katalog + CRM | ✅ produkcja |
| **Magazyn** | `stock` | `kenochem-stock` | https://kenochem-stock.web.app | katalog (tryb magazyn) | ✅ produkcja |
| **Operacje** | `ops` | `kenochem-ops` | https://kenochem-ops.web.app | Ops | ✅ produkcja |
| **Kalendarz** | `calendar` | `kenochem-calendar` | https://kenochem-calendar.web.app | kalendarz | ✅ produkcja |
| **Talk** | `talk` | `kenochem-talk` | https://kenochem-talk.web.app | czat | ⏸ wyłączony (`TALK_SUSPENDED = true`) |
| **Logistyka** | `logistics` | `kenochem-logistics` | https://kenochem-logistics.web.app | — | 🔜 placeholder |

Mapowanie target → site jest w [`.firebaserc`](../../.firebaserc), target → katalog buildu w [`firebase.json`](../../firebase.json).

Docelowo własne domeny (`katalog.kenochem.pl`, …) — Firebase → Hosting → Custom domains.

## Komendy

```bash
npm run setup:hosting-sites   # jednorazowo: tworzy witryny w Firebase
npm run build:<produkt>       # build jednego produktu (catalog|suite|sell|stock|ops|talk|logistics|calendar)
npm run deploy:<produkt>      # build + deploy jednej witryny
npm run deploy                # build wszystkich + deploy wszystkich (deploy:products to alias)
```

Pełna procedura wydania: [`docs/WDROZENIE.md`](../WDROZENIE.md). Czat — [`CHAT-STRATEGY.md`](./CHAT-STRATEGY.md).
