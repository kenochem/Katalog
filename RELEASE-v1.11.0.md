# Kenochem Katalog v1.11.0

Największe wydanie dotąd: katalog stał się centrum pracy handlowej — zamówienia z CRM trafiają prosto do WAPRO, są promocje, studio etykiet, rezerwacje, narzędzia do zdjęć i panel „Status systemów” z alarmami.

## Najważniejsze nowości

### Zamówienia CRM → WAPRO (v1.8)
- Wysyłka zamówienia do WAPRO jednym przyciskiem, bez konsoli: agent na serwerze odbiera je automatycznie.
- Numer zamówienia w formacie `H` + inicjał handlowca + inicjał firmy + 5-cyfrowy numer globalny.
- Transport jako osobna pozycja (KAT00178), podgląd przed wysyłką i osobne uprawnienie do wysyłki.
- Historia pokazuje numer ZO, stan realizacji z WAPRO oraz powiązane dokumenty.
- Klienci w kafelkach i karta klienta z etykietami.

### Promocje (v1.11)
- Centrum promocji: kampanie z datami, ceny ręcznie lub regułą (% obniżki, marża docelowa, stała cena, końcówka ,90).
- Kalkulator marży z ostrzeżeniem o sprzedaży poniżej kosztu.
- Ceny idą do osobnej grupy cenowej w BaseLinkerze; start i koniec wykonują się automatycznie, po końcu wraca cena zwykła.
- Kampanie wewnętrzne (bez BaseLinkera), znaczniki PROMOCJA w katalogu, filtr „W promocji” i etykiety z kampanii.

### Studio etykiet (v1.11)
- Etykiety 65 × 30 mm: nazwa w jednej linii, cena brutto i netto, cena za 1 l / 1 kg / 1 szt., kod kreskowy.
- Wariant wyprzedażowy z ceną wyjściową i marżą, własna nazwa, kolejka wydruku.

### Rezerwacje i stany (v1.10–v1.11)
- Zarezerwowane sztuki (R) i stan realny widoczne w katalogu; filtr „Z rezerwacją”.
- Do BaseLinkera idzie stan dostępny (stan − rezerwacje), bez „wirtualnych” sztuk.

### Zdjęcia (v1.9–v1.10)
- „Przygotuj pod BaseLinker” (min. 500 × 500), sekcja „Zdjęcia do poprawy”, dodatkowe zdjęcia także w sklepie.
- Porównanie i dokładanie zdjęć w BaseLinkerze (bez kasowania), koniec dubli głównego zdjęcia.

### Status systemów, alarmy i dostępność (v1.11)
- Logi → Status systemów: karty integracji, podsumowanie problemów i wspólny strumień zdarzeń z serwera.
- Czerwony pasek alarmów (agent milczy, błędy, utknięte zamówienia, problemy z promocjami) z „Przyjąłem”; opcjonalnie Discord.
- Wykres dostępności agentów (24 h i 7 dni), szybkie akcje i test połączeń (baza, agenci, BaseLinker).
- Aktywność użytkowników przeniesiona do Logów, link do produktu w nowej karcie, deep link `?sku=`.

## Wcześniejsze wydania

| Wersja | Data | Co nowego |
|---|---|---|
| 1.7.0 | 2026-10-06 | Integracja BaseLinker: podgląd, wysyłka stanów i cen, panel zarządzania, import produktów, znaczniki B/W; uprawnienia; motyw szary i ciemny |
| 1.6.0 | 2026-10-05 | Suite jako centrum narzędzi, dziennik aktywności użytkowników |
| 1.5.0 | 2026-10-02 | CRM: historia wygenerowanych ofert |
| 1.4.0 | 2026-09-29 | „Zmiany w czasie”, wspólne wykluczenia Martwego stocku, poprawka syncu sprzedaży |
| 1.3.0 | 2026-09-28 | Szybsze wczytywanie, masowe zatwierdzanie kategorii, tryb „Szybkie zdjęcia”, usprawnienia koszyka CRM |
| 1.2.0 | 2026-09-25 | Zakładka „Nowości” z WAPRO, filtr dat |
| 1.1.0 | 2026-09-24 | Szczegółowe logi zmian cen i stanów |
| 1.0.0 | 2026-09-16 | Pierwsze oznaczone wydanie: poprawki wyszukiwarki i syncu stanów z wielu magazynów |

## Wdrażanie (wymagane kroki po stronie serwera)
- Migracje SQL w Supabase: `migration-system-status.sql`, `migration-system-alerts.sql`, `migration-promotions.sql`, `migration-promotions-channel.sql`, `migration-product-reserved.sql`, `migration-wapro-order-*.sql`.
- Funkcje: `npx supabase functions deploy baselinker` oraz `system-alerts`.
- Agenci na serwerze WAPRO (`C:\katalog-sync\`): `sync-wapro-stock-server.ps1`, `sync-wapro-orders-server.ps1`.

Pełny dziennik zmian: w aplikacji, sekcja „Aktualizacje”.
