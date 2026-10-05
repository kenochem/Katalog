# Kenochem — produkty modułowe

> Stan: 2026-10-02. **Cel:** rozwijać segmenty (Katalog, CRM, Operacje…) osobno i składać je w **Suite**, bez monolitu w jednym UX.

## Produkty

| ID | Nazwa | Tryb buildu | Hosting | Moduły | Stan |
|----|-------|-------------|---------|--------|------|
| `catalog` | Katalog | `catalog` | `kenochem-katalog` | katalog | ✅ produkcja |
| `suite` | Suite (launcher + statystyki + przewodnik) | `suite` | `kenochem-f4a5b` | launcher | ✅ produkcja |
| `sell` | Handel | `sell` | `kenochem-sell` | katalog + CRM | ✅ produkcja |
| `stock` | Magazyn | `stock` | `kenochem-stock` | katalog (magazyn) | ✅ produkcja |
| `ops` | Operacje | `ops` | `kenochem-ops` | Ops | ✅ produkcja |
| `calendar` | Kalendarz | `calendar` | `kenochem-calendar` | kalendarz | ✅ produkcja |
| `talk` | Talk | `talk` | `kenochem-talk` | czat | ⏸ wyłączony (`TALK_SUSPENDED`) |
| `logistics` | Logistyka | `logistics` | `kenochem-logistics` | — | 🔜 placeholder |

Architektura i sposób wyboru aplikacji: [`ARCHITECTURE.md`](./ARCHITECTURE.md). Adresy: [`URLS.md`](./URLS.md).

## Fazy wdrożenia

| Faza | Stan | Opis |
|------|------|------|
| 0 | ✅ | Dokumentacja produktów, konwencje |
| 1 | ✅ | Tryb buildu wyznacza produkt, osobne `dist-*`, deploy per produkt |
| 2 | ✅ | `src/modules/*` + rejestr modułów (`moduleRegistry.ts`) |
| 3 | 🟡 | Szkielet `apps/` + `packages/core` — jest, ale nieużywany; build nadal z korzenia |
| 4 | ✅ | Skrypty `build:*` / `deploy:*` dla wszystkich produktów |
| 5 | ✅ | Suite jako zewnętrzny hub-launcher (decyzja 2026-10: bez osadzania katalogu/CRM; plan portu w [`HUB-PLATFORM-PORT-PLAN.md`](./HUB-PLATFORM-PORT-PLAN.md) jest archiwalny) |

## Zasady kodu

1. Nowe ekrany modułowe → `src/modules/{moduł}/`, nie bezpośrednio do `App.tsx`.
2. Widok modułu w produkcie, który go zawiera: `moduleEnabled('crm') && roleCan(...)`. Suite tylko linkuje do aplikacji (kafelek w `src/suite/suiteTools.ts`).
3. Opcjonalne moduły ładujemy `lazy()` tylko gdy `BUILD_HAS_*` (tree-shake w buildach, które ich nie mają).
4. Teksty w `App.tsx` biorą nazwę produktu z `branding.*` — ten plik obsługuje jednocześnie Katalog, Handel i Operacje.
5. Jedna baza Supabase: brak UI ≠ brak tabeli; RLS obowiązuje niezależnie od produktu.
6. Każda zmiana widoczna dla użytkowników dostaje wpis w `src/data/appChangelog.ts` (zakładka *Nowości → Aktualizacje*).

## Kierunki (backlog)

Aktualny backlog i dług techniczny: [`docs/ROZWÓJ.md`](../ROZWÓJ.md).
