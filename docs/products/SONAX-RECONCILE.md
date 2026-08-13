# Sonax — zderzenie sprzedaży Subiekt + WAPRO

Analiza ROI przejęcia Sonax przez Kenochem. **Od 2026-03-01 liczymy wyłącznie WAPRO** — Subiekt służy do rozpoznania klientów Sonax (historia do 2026-02-28).

## Logika ROI (kto wchodzi w raport)

| Wchodzi w KPI | Warunek |
|---------------|---------|
| **Tak** | FV w Subiekcie Sonax przed 03/2026 **+** FV Kenochem (WAPRO) od 03/2026 **+** brak FV Kenochem przed 03/2026 |
| **Nie (overlap)** | Ten sam klient miał FV u Kenochem **przed** marcem — np. MOTOZBYT, DAFIPAPIER handlowali z oboma |
| **Faza 2** | Nowi klienci kupujący **tylko towary Sonax** — wymaga eksportu pozycji FV (SKU) z Mag |

Subiekt **nie** rozstrzyga overlap z Kenochem — do tego potrzebny jest eksport WAPRO sprzed marca.

## Źródła danych

| Źródło | Pliki | Okres |
|--------|-------|-------|
| **Subiekt (Sonax)** | `sonax-kontrahenci.tsv`, `sonax-faktury.tsv`, `sonax-towary.tsv` | do **2026-02-28** |
| **WAPRO (Kenochem)** | `wapro-faktury.tsv`, `wapro-kontrahenci.tsv` | od **2026-03-01** |
| **WAPRO overlap** | `wapro-kenochem-przed.tsv` | FV Kenochem **przed** 2026-03-01 (agregat per NIP) |

## Praca na serwerze WAPRO (RDP)

> Wymagany eksport SQL z Mag — nie da się tego zrobić samym deployem Firebase.

1. Skopiuj na serwer:
   - `scripts/sync-wapro-sonax-export.ps1` → `C:\katalog-sync\sync-wapro-sonax-export.ps1`

2. Diagnostyka schematu (opcjonalnie):
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-sonax-export.ps1 -DiagnoseSchema
   ```

3. Eksport (faktury od marca + kontrahenci + **klienci z FV przed marcem**):
   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\katalog-sync\sync-wapro-sonax-export.ps1
   ```

4. Skopiuj na PC z repo do `data/sonax-import/`:
   - `wapro-faktury.tsv`
   - `wapro-kontrahenci.tsv`
   - `wapro-kenochem-przed.tsv` ← **nowy, kluczowy dla wykluczenia overlap**

## Lokalnie (PC z repo)

```bash
npm run report:sonax-subiekt    # parsuje TSV Subiekt
npm run reconcile:sonax         # merge → sonax-reconcile.json
npm run deploy:ops              # panel Ops (po zmianach UI)
```

Wyjście:
- `sonax-reconcile.json` — pełny raport + segmenty + `acquisition` + `excludedOverlap`
- `sonax-acquisition-clients.tsv` — klienci ROI (segment `from_sonax`)
- `sonax-overlap-excluded.tsv` — wykluczeni overlap
- `sonax-acquisition-invoices.tsv` — faktury ROI

Kopia static: `public/data/sonax-import/`

## Segmentacja klientów

| Segment | Znaczenie |
|---------|-----------|
| `from_sonax` | Sonax przed marcem + WAPRO od marca, **bez** FV Kenochem przed marcem → **ROI** |
| `overlap_kenochem` | Sonax + WAPRO od marca, **ale** FV Kenochem przed marcem → **poza ROI** |
| `sonax_dormant` | Historia Sonax, brak WAPRO po przejęciu |
| `kenochem_new` | Tylko WAPRO od marca — brak historii Sonax |
| `*_unverified` | Dopasowanie tylko po nazwie (brak NIP) |

Dopasowanie: **NIP** → nazwa znormalizowana → surowa nazwa.

## Ops — Własne zbiory

Kafel **„Sonax — klienci z Sonax u nas”** w Ops → Własne zbiory:
- KPI tylko segment `from_sonax`
- Zakładka **Wykluczeni** — overlap Kenochem
- Ostrzeżenie, gdy brak `wapro-kenochem-przed.tsv`

## Faza 2 (opcjonalnie)

- Eksport **pozycji faktur** WAPRO od marca (SKU × netto) z Mag
- Mapowanie SKU → towary Sonax (`sonax-towary.tsv`, tag Sonax w katalogu)
- Segment: nowi klienci z samymi produktami Sonax

## SQL (referencja)

Skrypt PS1 próbuje kilka wariantów joinów (ID_KONTRAHENTA / ID_PLATNIKA, pozycje DH vs nagłówki).
