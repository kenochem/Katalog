# CRM Kenochem ← wnioski z CRM-Base

Źródło: [CtrlAltStudent/CRM-Base](https://github.com/CtrlAltStudent/CRM-Base) (Django + PostgreSQL, projekt studencki).  
Cel: rozwijać CRM w katalogu (PWA + Supabase) według sprawdzonych praktyk modelu, bez kopiowania całego Django.

## Co już mamy w katalogu

| Obszar | Stan |
|--------|------|
| **Tryb globalny CRM** | Obok Akcesoria / Produkty / Operacje — panel handlowca |
| Kontrahent (`crm_clients`) | NIP, nazwa, adres, notatka, lookup GUS |
| Zamówienie / oferta (`crm_orders`) | pozycje JSON + snapshot cen, status sent/saved, kind order/quote |
| Koszyk lokalny → Discord / historia | działa |
| Żywy panel | klienci, obrót miesiąca, marża, prowizja % (lokalnie) |
| Role UI | handlowiec / operator / admin |
| Produkty | żywy katalog (SKU = WAPRO) |

Brakuje względem CRM-Base: lejek (lead → oferta → ZO), osoby kontaktowe, statusy słownikowe, aktywności, trasy, przypomnienia, owner w DB, historia zmian.

## Dobre praktyki z CRM-Base warte przeniesienia

### 1. Jasny lejek sprzedaży (nie wszystko „zamówienie”)
CRM-Base: **Lead → SalesOpportunity → Offer (rewizje) → SalesOrder**.  
U nas: `kind: order | quote` to dobry start. Docelowo:

- **Lead / zapytanie** — kontakt bez pełnego koszyka  
- **Oferta** — numer + ważność + rewizja (już mamy „Prośba o ofertę”)  
- **Zamówienie** — po akceptacji, opcjonalnie link do ZO w Mag  

Praktyka: osobne statusy słownikowe (`draft` / `sent` / `accepted` / `rejected` / `converted`), nie tylko sent/saved.

### 2. Kontrahent ≠ tylko nazwa
CRM-Base: Contractor + **ContactPerson** (email/telefon/stanowisko), owner, region, `is_active`.  
U nas dodać stopniowo:

- osoby kontaktowe (1–n przy kliencie)  
- opiekun handlowy (`owner` = user id)  
- flaga aktywny / archiwum  

NIP unique per firma — już idziemy w tę stronę.

### 3. Pozycje zamówienia z ceną jednostkową
CRM-Base: `OfferItem` / `SalesOrderItem` z `quantity` + `unit_price_net`.  
U nas pozycje to głównie SKU/qty z katalogu. Warto trzymać **snapshot ceny** w momencie oferty (żeby historia nie „pływała” po zmianie cennika).

### 4. Audyt i historia (TimeAudit + history tables)
CRM-Base: `created_at/by`, `updated_at/by`, `LeadStatusHistory`, `OfferRevisionHistory`, `AuditLog`.  
W Supabase:

- kolumny `created_by` / `updated_by` na `crm_*`  
- przy zmianie statusu oferty — wiersz w `crm_order_events` (append-only)  
- RLS: handlowiec widzi swoje + współdzielone; manager/admin wszystko  

### 5. Słowniki zamiast magicznych stringów
`lead_status`, `order_status`, `activity_type` — łatwa zmiana etykiet bez migracji logiki.  
U nas: tabela `crm_dictionaries` albo enum w check constraint + UI z etykietami PL.

### 6. Aktywności handlowe
CRM-Base: Activity (telefon / wizyta / mail) przy kontrahencie.  
W Kenochem: krótki log przy karcie klienta („zadzwoniłem”, „wysłano ofertę”) — bardzo praktyczne przy wielu handlowcach.

### 7. Bezpieczeństwo wg roli / właściciela
CRM-Base: Sales Rep = tylko swoje kontrahenty; Manager = region/pełny dostęp; maskowanie telefonu/email.  
Mapowanie na nasze role:

| CRM-Base | Katalog |
|----------|---------|
| Sales Rep | handlowiec (swoje klienci + zamówienia) |
| Sales Manager / Admin | operator / admin |
| Finance | opcjonalnie później (płatności) |

### 8. Przejścia procesowe (procedury)
`sp_convert_lead_to_opportunity`, `sp_create_sales_order_from_offer` — jedna akcja = spójny stan.  
U nas: przycisk **„Oferta → zamówienie”** (kopiuje pozycje, ustawia kind/status, zostawia link do źródła).

### 9. Dashboard KPI CRM
Liczniki: kontrahenci, oferty otwarte, zamówienia miesiąc, aktywności 30 dni, lejek wartości.  
Może siedzieć w **Operacje** albo jako zakładka w CRM — nie mieszać z finansami sklepu (arkusz kosztów).

### 10. Nie kopiować 1:1
Django + pełny ERP-CRM to za dużo na PWA magazynowo-handlową. Bierzemy **model myślenia** i kolejność wdrożeń, a produktami / stanami / ZO zostaje katalog + WAPRO.

## Proponowana kolejność wdrożeń (Kenochem)

1. **Statusy ofert/zamówień** + filtr w historii (draft / sent / accepted / archived)  
2. **Snapshot ceny** na pozycji przy zapisie oferty  
3. **Opiekun + aktywny** na `crm_clients`  
4. **Osoby kontaktowe** (osobna tabela)  
5. **Aktywności** (notatka + typ + data)  
6. **Oferta → zamówienie** (jedna akcja)  
7. **Dashboard KPI** w CRM / Operacjach  
8. **Events / audyt** append-only  
9. Płatności / należności — tylko jeśli będzie potrzeba (dziś Mag/WAPRO)

## Mapowanie encji (skrót)

```
CRM-Base Contractor     → crm_clients
CRM-Base ContactPerson  → crm_contacts (TODO)
CRM-Base Offer          → crm_orders WHERE kind = 'quote'
CRM-Base SalesOrder     → crm_orders WHERE kind = 'order'
CRM-Base OfferItem      → crm_orders.items[] (+ unitPriceNet)
CRM-Base Activity       → crm_activities (TODO)
CRM-Base Product        → products (katalog)
```

## Zasada na co dzień

Każda nowa funkcja CRM w katalogu: **najpierw pytanie „gdzie to siedzi w lejku CRM-Base?”**, potem minimalna tabela/pole w Supabase, potem UI w istniejących zakładkach (Klienci / Bieżące / Historia) — bez drugiego monolitu.
