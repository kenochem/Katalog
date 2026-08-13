# Architektura produktów Kenochem

```
┌─────────────────────────────────────────────────────────┐
│  Firebase Hosting (multi-target, jeden projekt GCP)      │
│  kenochem-katalog.web.app  → dist-catalog (product)     │
│  kenochem-f4a5b.web.app    → dist-suite (Suite)         │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│  Vite SPA — ten sam repo, build per VITE_APP_PRODUCT     │
│  src/App.tsx + src/app/moduleRegistry.ts                 │
└────────────────────────────┬────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     │                       │                       │
 packages/core (stub)   src/modules/*          supabase/
 auth, roles, theme     catalog, crm, ops,     wspólna baza
                        comms
```

## Integracja modułów

- **Katalog** nie importuje CRM/Ops/Comms w buildzie `catalog` (osobne chunki w suite).
- **Suite** ładuje wszystkie moduły z rejestru.
- Docelowo **Sell** = catalog + crm (bez ops/finanse w nav).

## Monorepo (faza 3 — szkielet)

Katalog nadal budowany z root `vite.config.ts`. Foldery `apps/*` opisują docelowe entrypointy; migracja stopniowa bez big-bang.
