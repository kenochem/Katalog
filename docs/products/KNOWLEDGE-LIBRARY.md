# Biblioteka wiedzy produktowej (boty AI / RAG)

Katalog Kenochem ma być **czytelny dla botów** — nie tylko siatka zdjęć w SPA, ale **strukturalne fakty**: co to jest, SKU, parametry, opisy.

## Warstwy

| Warstwa | Co | Gdzie |
|--------|-----|--------|
| **A. Export statyczny** | JSON / JSONL do skrapowania bez logowania | `public/data/knowledge/` po `npm run export:knowledge` |
| **B. Pola w produkcie** | `shortDescription`, `parameters`, opis, meta | Supabase `products` + `product_meta` |
| **C. UI (dynamicznie)** | Ocena kompletności 0–100%, brakujące pola, filtr „Opis / AI”, propozycja krótkiego opisu | `assessProductKnowledge`, `ProductKnowledgeStatus`, `ProductDetail` |
| **D. Indeks wektorowy** | Podobieństwo zdjęć / semantyka sklepu | `shop-embeddings.json` (osobny tor) |

Bot zewnętrzny: zacznij od **`https://kenochem-katalog.web.app/data/knowledge/manifest.json`**, potem pobieraj `batch-*.jsonl`.  
**Zapis do bazy (boty):** [KNOWLEDGE-BOT-API.md](./KNOWLEDGE-BOT-API.md) — Edge Function `product-knowledge` + secret `KNOWLEDGE_BOT_SECRET` (wymaga deployu w Supabase).

## Paczki uzupełniania treści (ludzie + import)

Pracujemy partiami — żeby dało się ogarnąć jakość.

### Paczka 1 — Tożsamość (już w dużej mierze jest)

- SKU, EAN, nazwa, katalog (Akcesoria / Produkty), kategoria  
- Źródła: WAPRO XLS, Base CSV, ręczne dodanie  
- Skrypt: `import-wapro-missing`, `import:baselinker`

### Paczka 2 — Opisy i parametry (priorytet pod AI)

- `product_meta.shortDescription` — 1–2 zdania „co to jest”  
- `product_meta.parameters` — pary klucz/wartość (gwint, ciśnienie, materiał, pojemność…)  
- `description` — pełniejszy opis (HTML OK w DB, export czyści do plain text)  
- **Kolejność:** top 200 po stanie / obrocie, potem „Bez zdjęć”, potem reszta kategorii

### Paczka 3 — Logistyka

- Waga, wymiary, jednostka (`product_meta`)  
- Lokalizacja regałowa (`warehouse_location`)  
- Stany z WAPRO (sync — już działa)

### Paczka 4 — Media

- Zdjęcie główne + dodatkowe (Base / ręczny upload)  
- W eksporcie: URL obrazu — bot wie, że produkt ma wizualną referencję

### Paczka 5 — Relacje

- Warianty (grupy dysz itd.)  
- Zestawy (`kits`) — osobny export w przyszłości

## Komendy

```bash
# Po uzupełnieniu opisów w Supabase / imporcie:
npm run export:knowledge

# Deploy katalogu (pliki w public/ lecą na Firebase):
npm run deploy:catalog
```

## Dla developera

- Rekord w TS: `src/lib/productKnowledge.ts` → `buildProductKnowledgeRecord` + `assessProductKnowledge` (te same progi co w `export-product-knowledge.mjs`)  
- Kontekst do czatu: `src/lib/productAiContext.ts` (z notatką wewnętrzną — **nie** trafia do exportu publicznego)  
- **Nie** umieszczaj cen / marży w publicznym eksporcie bez decyzji biznesowej (obecny export ma stany — można wyłączyć w skrypcie).

## Następne kroki (propozycja)

1. Uruchomić pierwszy `export:knowledge` i sprawdzić manifest w przeglądarce.  
2. Wybrać **kategorię pilot** (np. Dysze / Chemia) — uzupełnić `parameters` dla ~50 SKU.  
3. W katalogu: filtr **Opis / AI** → „Słaby opis”, uzupełniaj od listy ze statystyki (średnia wiedza / liczba słabych).  
4. `robots.txt` z `Allow: /data/knowledge/` — gdy ustalicie politykę crawlowania.
