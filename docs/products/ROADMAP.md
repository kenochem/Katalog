# Kenochem — produkty modułowe

> **Cel:** rozwijać segmenty osobno (Katalog, CRM, Operacje…), składać je w **Suite** bez monolitu w jednym UX.

## Produkty

| ID | Nazwa | Build (`VITE_APP_PRODUCT`) | Hosting Firebase | Moduły |
|----|--------|------------------------------|------------------|--------|
| **catalog** | Kenochem Katalog | `catalog` | target `katalog` → kenochem-katalog.web.app | catalog |
| **suite** | Kenochem Suite (pełny hub) | `suite` (domyślnie) | target `default` → kenochem-f4a5b.web.app | catalog + crm + ops + comms |
| **sell** | Handel (plan) | `sell` | (osobny site później) | catalog + crm |
| **ops** | Operacje (plan) | `ops` | (osobny site później) | ops (+ raporty) |
| **talk** | Talk (plan) | `talk` | (osobny site później) | comms |

**Obecne korzystanie zespołu:** pełna aplikacja = **Suite** (`npm run deploy:suite` / URL `kenochem-f4a5b.web.app`).

> **Kierunek:** Jeden **Suite kompletny** jak hub-platform — segment po segmencie, dostosowany do Kenochem (WAPRO, Supabase). Plan: [HUB-PLATFORM-PORT-PLAN.md](./HUB-PLATFORM-PORT-PLAN.md). Osobne hostingi (sell, katalog…) pozostają; **nie liczą się do etapów** tego wdrożenia.

**Katalog publiczny / czysty produkt:** **Katalog** (`npm run deploy:catalog` / `kenochem-katalog.web.app`).

## Fazy wdrożenia

| Faza | Stan | Opis |
|------|------|------|
| **0** | ✅ | Dokumentacja produktów, konwencje |
| **1** | ✅ | `VITE_APP_PRODUCT`, osobne `dist-*`, deploy catalog vs suite |
| **2** | ✅ | `src/modules/*` + rejestr modułów |
| **3** | ✅ | Szkielet `apps/` + `packages/core` pod monorepo |
| **4** | ✅ | Skrypty deploy, README, domyślny `deploy` = oba produkty |
| **5** | 🔄 | **Suite kompletny 1:1 hub-platform** — [HUB-PLATFORM-PORT-PLAN.md](./HUB-PLATFORM-PORT-PLAN.md) (jeden URL, bez etapu „rozdzielenia”) |

## Zasady kodu

1. Nowe ekrany → `src/modules/{moduł}/`, nie bezpośrednio do `App.tsx`.
2. UI modułu w Suite **i** w produkcie wąskim: `moduleEnabled('crm') && roleCan(...)`.
3. Lazy import modułów tylko gdy `BUILD_HAS_*` (tree-shake w buildzie catalog).
4. Jedna Supabase — brak UI ≠ brak tabeli; RLS bez zmian.

## Komendy

```bash
npm run dev              # Suite (domyślnie)
npm run dev:catalog      # tylko Katalog
npm run build:suite
npm run build:catalog
npm run deploy           # oba buildy + Firebase hosting
npm run deploy:suite
npm run deploy:catalog
```
