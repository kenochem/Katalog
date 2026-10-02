# Dokumentacja — indeks

> Ostatni przegląd całości: **2026-10-02**. Status: ✅ aktualne (zweryfikowane z kodem) · 📘 referencyjne (opis działa, ale może zawierać szczegóły sprzed zmian) · 🗄 archiwalne / plan (kontekst historyczny — nie traktuj jako opisu stanu).

## Zacznij tutaj

| Dokument | Status | O czym |
|----------|--------|--------|
| [`../README.md`](../README.md) | ✅ | Przegląd, aplikacje i URL-e, szybki start, role |
| [`KATALOG-FUNKCJE.md`](./KATALOG-FUNKCJE.md) | ✅ | Przewodnik po funkcjach katalogu, Ops i CRM |
| [`WAPRO-SYNC.md`](./WAPRO-SYNC.md) | ✅ | Runbook serwera WAPRO: sync, harmonogram, flagi, rozwiązywanie problemów |
| [`BAZA-DANYCH.md`](./BAZA-DANYCH.md) | ✅ | Supabase: tabele, migracje, RLS, Edge Functions |
| [`WDROZENIE.md`](./WDROZENIE.md) | ✅ | Build, deploy, checklista wydania, Git |
| [`ROZWÓJ.md`](./ROZWÓJ.md) | ✅ | Stan projektu, dług techniczny, backlog |

## Architektura i produkty

| Dokument | Status | O czym |
|----------|--------|--------|
| [`products/ARCHITECTURE.md`](./products/ARCHITECTURE.md) | ✅ | Wybór aplikacji w buildzie, rejestr modułów, podział kodu |
| [`products/URLS.md`](./products/URLS.md) | ✅ | Witryny Firebase i komendy |
| [`products/ROADMAP.md`](./products/ROADMAP.md) | ✅ | Produkty, fazy, zasady kodu |
| [`products/CHAT-STRATEGY.md`](./products/CHAT-STRATEGY.md) | 📘 | Gdzie czat ma sens (Talk obecnie wyłączony) |
| [`products/HUB-PLATFORM-PORT-PLAN.md`](./products/HUB-PLATFORM-PORT-PLAN.md) | 🗄 | Plan portu Suite z hub-platform (statusy segmentów nie są utrzymywane) |
| [`products/CATALOG-HUB-GAP.md`](./products/CATALOG-HUB-GAP.md) | 🗄 | Luki katalogu względem huba (lista z 2026-07) |

## Dane i integracje

| Dokument | Status | O czym |
|----------|--------|--------|
| [`products/WAPRO-SALES-STATS.md`](./products/WAPRO-SALES-STATS.md) | 📘 | Szczegóły statystyk sprzedaży (schema v2, miesiące, prev 12m) — kontekst operacyjny w `WAPRO-SYNC.md` |
| [`products/BASELINKER-STOCK-SYNC.md`](./products/BASELINKER-STOCK-SYNC.md) | 📘 | Import BaseLinker i metka „Base" |
| [`products/BASELINKER-EXPORT-MAPPING.md`](./products/BASELINKER-EXPORT-MAPPING.md) | 📘 | Mapowanie eksportu BaseLinker → katalog |
| [`products/BASE-ZESTAWY-EXPORT.md`](./products/BASE-ZESTAWY-EXPORT.md) | 📘 | Szablon eksportu zestawów |
| [`products/SONAX-RECONCILE.md`](./products/SONAX-RECONCILE.md) | 📘 | Zderzenie sprzedaży Subiekt + WAPRO (analiza ROI Sonax) |
| [`crm-from-crm-base.md`](./crm-from-crm-base.md) | 📘 | Wnioski z CRM-Base dla naszego CRM |
| [`products/KNOWLEDGE-LIBRARY.md`](./products/KNOWLEDGE-LIBRARY.md), [`KNOWLEDGE-BOT-API.md`](./products/KNOWLEDGE-BOT-API.md) | 📘 | Wiedza produktowa dla botów AI / RAG, API uzupełniania |

## Biblioteka

| Dokument | Status | O czym |
|----------|--------|--------|
| [`products/BIBLIOTEKA-TECHNICZNA.md`](./products/BIBLIOTEKA-TECHNICZNA.md) | 📘 | Zeszyty techniczne (statyczne strony HTML) |
| [`products/KATALOGI-MAREK.md`](./products/KATALOGI-MAREK.md) | ✅ | Katalogi marek do druku (Eco Shine, Freshtek, SONAX), edycja opisu/kategorii |

## Schowek (nieaktywne)

| Dokument | Status | O czym |
|----------|--------|--------|
| [`future/wapro-orders/`](./future/wapro-orders/README.md) | 🗄 | Agent „zamówienie → WAPRO ZO". Przycisk w CRM (admin) i tabela już są; agent serwerowy nie jest wdrożony |

## Zasady utrzymania dokumentacji

- Zmieniasz zachowanie opisane w dokumencie ✅ → popraw dokument w tym samym commicie.
- Każda zmiana widoczna dla użytkownika → wpis w `src/data/appChangelog.ts` (patrz [`WDROZENIE.md`](./WDROZENIE.md)).
- Dokument przestaje być prawdziwy, a nie masz czasu go poprawić → zmień status w tym indeksie na 🗄 zamiast zostawiać go jako „aktualny".
