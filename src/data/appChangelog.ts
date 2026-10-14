export interface AppChangelogEntry {
  /** ISO data (YYYY-MM-DD) — sortujemy malejąco. */
  date: string;
  title: string;
  description: string;
  tag?: 'nowość' | 'poprawka' | 'wydajność';
}

/**
 * Dziennik zmian w katalogu — wpisy dodawane ręcznie przy każdej wysłanej
 * funkcji/poprawce. Najnowszy na górze listy w UI (sortowane po `date`).
 */
export const APP_CHANGELOG: AppChangelogEntry[] = [
  {
    date: '2026-10-14',
    title: 'Wyszukiwarka: pełne wyniki (bez ucinania do 100), wiele słów w dowolnej kolejności, polskie znaki i odmiana',
    description:
      'Naprawa wyszukiwarki katalogu. Główna przyczyna: lista trafień była ucinana do 100 pozycji po kolejności alfabetycznej, więc przy popularnych frazach (np. „olejek zapach” — 176 trafień) produkty z końca alfabetu, jak olejek zapachowy Denim, w ogóle się nie pokazywały. Teraz wyniki tekstowe są zwracane w całości. Dodatkowo: wyszukiwanie wielowyrazowe działa w dowolnej kolejności słów (każde słowo musi wystąpić w nazwie, np. „zapach denim”), nie trzeba wpisywać polskich znaków („zel do rak” znajdzie „żel do rąk”), nazwy wariantów grupy też są przeszukiwane, a odmienione formy („olejku zapachowego”) są odnajdywane przez dopasowanie rdzenia słowa, gdy dokładne trafienia nie istnieją. Wyszukiwarka poleceń (Ctrl+K) zachowuje własny limit wyników.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-14',
    title: 'Zdjęcia: optymalizacja wagi i formatu (JPG / PNG, limit KB, maks. bok)',
    description:
      'W „Zdjęcia do poprawy” jest nowa zakładka „Waga i format”. Skan sprawdza rozmiar i format zdjęć we własnym magazynie (lekko, bez pobierania plików) i pokazuje listę od najcięższych: ponad limit wagi albo w złym formacie (WebP/GIF). Zaznaczone zdjęcia można zoptymalizować hurtowo: zapisują się wyłącznie jako JPG (jakość dobierana tak, żeby plik zmieścił się w limicie) albo PNG dla zdjęć z przezroczystym tłem (opcjonalnie JPG na białym tle — lżejsze), z ograniczonym dłuższym bokiem; gdy limit jest za ciasny, zmniejszamy wymiary, ale nigdy poniżej 500 px krótszego boku. Limit (60–300 KB) i maks. bok (800–2000 px) ustawia się w panelu. Włączona domyślnie opcja automatyczna optymalizuje także każde nowo wgrane zdjęcie. Dla każdej zmienionej fotografii powstaje kopia do przywrócenia na karcie produktu. Zdjęcia, które są już w BaseLinkerze, zmienią się tam dopiero po ponownym wysłaniu.',
    tag: 'nowość',
  },
  {
    date: '2026-10-14',
    title: 'Grupy produktów: własne ikony dla każdego typu (nypel, trójnik, dysza, zawór…)',
    description:
      'Każdy typ elementu technicznego ma teraz własną, rysowaną ikonę: nypel z gwintowanymi końcami, trójnik, kolanko, redukcja, dysza ze strumieniami, szybkozłącze (wtyk i gniazdo), adapter, zawór, o-ring, zaślepka, manometr, gniazdo, lanca, pistolet, wąż, filtr, sitko, pianownica, zbiornik i zestaw naprawczy. Ikony widać na liście typów w Grupach produktów, przy liczniku pozycji, w panelu „Grupa produktu” na karcie produktu, a także zamiast szarej ikonki „brak zdjęcia” przy pozycjach bez zdjęcia — od razu widać, co to za element.',
    tag: 'nowość',
  },
  {
    date: '2026-10-14',
    title: 'Grupy produktów: lance, pistolety, węże, filtry, sitka, pianownice, zbiorniki i zestawy naprawcze',
    description:
      'Etap 3 porządkowania: do Grup produktów doszły kolejne typy niezależne od kategorii w WAPRO (np. sitka lancy leżały w „Lance”, a szybkozłącza w „Lancach” i „Dyszach” — teraz każdy element trafia do grupy swojego typu). Węże mają podtypy (wysokociśnieniowy, zbrojony, kanalizacyjny, ogrodowy, do natrysku chemii, do odkurzacza, do bębna) oraz rozpoznawaną długość, wymiar (np. 6×1, DN8, Ø38) i ciśnienie; lance — długość (mm, zakres w cm), podtyp pianowa / zwykła; pistolety — myjki, suszące, pianowe; filtry — wody, chemii, odkurzacza, pyłowe; pianownice i zbiorniki — pojemność w litrach. Pozycje o ubogiej nazwie trafiają do „Do sprawdzenia” zamiast być zatwierdzane automatycznie. Nazwy WAPRO bez zmian.',
    tag: 'nowość',
  },
  {
    date: '2026-10-14',
    title: 'Grupy produktów: szybkozłącza, adaptery, zawory, o-ringi, zaślepki, manometry i gniazda',
    description:
      'Etap 1 porządkowania elementów technicznych: do nyple, trójników, kolanek, redukcji i dysz doszły szybkozłącza (wodne, do lancy, na wąż, z systemem KEW / K-Lock / Karcher), adaptery (w tym K-Lock TR22 / TR18 i ssawki odkurzaczy), zawory (zwrotne, kulowe, by-pass, bezpieczeństwa, ciśnieniowe, pływakowe i inne), uszczelki i o-ringi (wymiary w mm), zaślepki i korki, manometry (średnica tarczy, zakres, gwint) oraz gniazda. Parser rozpoznaje też płeć złącza z nazw „męskie / damskie”, system lub markę oraz gwinty TR (K-Lock) i pokazuje ostrzeżenie, gdy płeć w nazwie nie zgadza się z oznaczeniem gwintu. W grupach jest nowy filtr „system / marka”, a edytor opisu technicznego ma pola systemu, płci, wymiarów o-ringu i średnicy manometru. Nazwy WAPRO bez zmian.',
    tag: 'nowość',
  },
  {
    date: '2026-10-14',
    title: 'Karta produktu: panel „Grupa produktu” — przypisanie do grupy technicznej bez wychodzenia z produktu',
    description:
      'Na karcie produktu (zakładka z informacjami) jest nowy panel „Grupa produktu”: pokazuje, do jakiej grupy należy element (np. Nyple › Zwykły), nazwę katalogową złożoną z parametrów i nazwę z WAPRO. Osoby z prawem edycji produktu mogą tu zatwierdzić propozycję z nazwy, zmienić grupę i parametry (typ, podtyp, gwinty, materiał, kod i otwór dyszy), przypisać do grupy produkt, którego parser nie rozpoznał (np. „Turbo dysza”), cofnąć do propozycji albo wyłączyć produkt z grup. Ten sam edytor jest używany na liście w „Grupy produktach”.',
    tag: 'nowość',
  },
  {
    date: '2026-10-14',
    title: 'Grupy produktów: elementy techniczne (nyple, trójniki, kolanka, redukcje, dysze) uporządkowane po parametrach',
    description:
      'Nowa sekcja „Grupy produktów” w menu (obok Katalogu). Elementy techniczne są pogrupowane po typie (nyple, trójniki, kolanka, redukcje, dysze — w tym dysze wody z gwintem i bez gwintu) i mają parametry: gwinty na obu końcach (zewnętrzny M / wewnętrzny Ż, rozmiar 1/4″, 3/8″, M22…), materiał, podtyp, kod i rozmiar otworu dyszy, ciśnienie. Filtry „Końcówka 1” i „Końcówka 2” znajdują element łączący dwa gwinty w dowolnej kolejności, jest też filtr „Bez zdjęcia” i licznik braków zdjęć przy każdej grupie. Nazwy z WAPRO nie są zmieniane — przy każdej pozycji widać „WAPRO: …”, a wyszukiwarka katalogu znajduje produkt zarówno po nazwie waprowej, jak i po nazwie katalogowej i aliasach (np. „gz 3/8”, „1/4 żeński”). Parametry są rozpoznawane automatycznie z nazw (ok. 350 pozycji rozpoznanych pewnie, ok. 40 do sprawdzenia) i widoczne jako „propozycja”; zakładka „Do zatwierdzenia” pozwala zatwierdzić je hurtowo („Zatwierdź wszystkie pewne”), poprawić pojedynczo albo wyłączyć pozycję, która nie jest elementem technicznym. Wymaga migracji migration-product-tech.sql.',
    tag: 'nowość',
  },
  {
    date: '2026-10-14',
    title: 'Wydajność: lżejsze wdrożenie, krótki cache plików danych, jedno sprawdzanie alarmów',
    description:
      'Audyt wydajności katalogu. Z wdrożenia usunięto nieużywany w aplikacji plik wektorów zdjęć (ok. 12 MB), więc publikacja jest szybsza i lżejsza. Pliki danych z listą produktów mają krótki (2-minutowy) cache w przeglądarce, dzięki czemu kolejne wejścia i odświeżenia są szybsze, a zmiany widać prawie od razu. Baner alarmów i strona Status systemów korzystają teraz z jednego wspólnego sprawdzania zamiast dwóch równoległych. Funkcje katalogu bez zmian.',
    tag: 'wydajność',
  },
  {
    date: '2026-10-13',
    title: 'Alarmy systemowe, historia dostępności agentów i szybkie akcje w Logach',
    description:
      'Czerwony pasek u góry aplikacji (dla administratorów) pojawia się, gdy agent na serwerze WAPRO milczy dłużej niż 30 min, wystąpiły błędy w ostatniej godzinie, synchronizacja z BaseLinkerem się nie udała, zamówienie do WAPRO utknęło ponad 15 min albo kończy się/psuje promocja — z przyciskami „Szczegóły” i „Przyjąłem” (zapisuje kto przyjął). Ostrzeżenia i informacje widać w Logi → Status systemów, w sekcji „Aktywne alarmy”; alarm sam znika, gdy problem ustąpi. Opcjonalnie powiadomienia na Discord (sekret DISCORD_ALERTS_WEBHOOK). Nowy wykres „Dostępność agentów”: pasek ostatnich 24 h (każdy kwadrat = 15 min, zielony = agent działał, czerwony = cisza) oraz ostatnie 7 dni i procent dostępności. Nowa sekcja „Szybkie akcje”: synchronizacja stanów i cen teraz, odświeżenie sprzedaży, sprawdzenie promocji, odświeżenie powiązań BaseLinker oraz „Test połączeń” (baza, agenci, API BaseLinker z czasem odpowiedzi). Wymaga migracji migration-system-alerts.sql, wdrożenia funkcji system-alerts i baselinker oraz nowych wersji obu agentów.',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Logi: „Status systemów” — karty z alarmami i wspólny strumień zdarzeń z serwera',
    description:
      'Sekcja Logi ma nową, domyślną zakładkę „Status systemów”. U góry karty integracji (stany i ceny, sprzedaż, zamówienia → WAPRO, rezerwacje, BaseLinker, promocje) z kolorem, informacją „ostatnio X min temu” i alarmem, gdy agent na serwerze WAPRO milczy dłużej niż 10 min (ostrzeżenie) lub 30 min (problem); nad kartami podsumowanie „Wszystko działa” albo lista tego, co wymaga uwagi. Niżej strumień zdarzeń z serwera z filtrami (źródło, tylko błędy i ostrzeżenia, okres, szukanie) i szczegółami po rozwinięciu. Wcześniej strona pokazywała głównie lokalne wpisy po ręcznych synchronizacjach, bo automatyczne przebiegi agenta nie zapisywały nic w bazie — teraz każdy przebieg (także automatyczny), odczyt rezerwacji, zamówienia, wysyłki do BaseLinkera i promocje trafiają do jednego strumienia. Dotychczasowa strona to zakładka „Zmiany produktów i raporty”. Wymaga migracji migration-system-status.sql i nowych wersji obu agentów.',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Aktywność użytkowników przeniesiona do Logów; link do edytowanego produktu',
    description:
      'Dziennik aktywności (kto, co i kiedy zmienił, IP i urządzenie przy logowaniu) jest teraz w sekcji „Logi” jako zakładka „Aktywność użytkowników” — zniknął z Administracji, bo tam nie pasował. Widoczny nadal tylko dla osób z uprawnieniem zarządzania kontami. Przy każdym wpisie dotyczącym produktu (edycja, zmiana ceny, stanu, zdjęć, kategorii) jest przycisk „Produkt”, który otwiera ten produkt w nowej karcie. Działa też zwykły link z adresem ?sku=KOD — po zalogowaniu i załadowaniu katalogu otwiera kartę produktu (dla usuniętego produktu pokaże komunikat).',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Promocje: kampanie wewnętrzne (bez BaseLinkera) i czytelniejsza tabela cen',
    description:
      'Przy tworzeniu kampanii wybierasz rodzaj: „Promocja do sklepu internetowego” (ceny idą do BaseLinkera, osobna grupa cenowa) albo „Kampania wewnętrzna” (np. wyprzedaż na półce — tylko katalog i etykiety, bez łączenia z BaseLinkerem; start i koniec wg dat działają tak samo). Na liście kampanii widać rodzaj przy każdej. Tabela cen jest przebudowana: pole ceny promocyjnej nie nachodzi już na inne kolumny (z oznaczeniem zł i komunikatem „musi być niższa od zwykłej”), obniżka jest czerwoną plakietką z procentem, a marża po promocji plakietką w kolorze (zielona / żółta „niska marża” / czerwona „poniżej kosztu”) z zyskiem na sztuce; podsumowanie pod tabelą to czytelne plakietki. Wymaga migracji migration-promotions-channel.sql i ponownego wdrożenia funkcji baselinker.',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Centrum promocji: kampanie cenowe z datami i wysyłką do BaseLinkera',
    description:
      'Nowa sekcja „Promocje” (menu, „Więcej” na telefonie, wyszukiwarka poleceń). Tworzysz kampanię (nazwa, start i koniec albo bezterminowo), dobierasz produkty wyszukiwarką i filtrami (kategoria, tylko z BaseLinkera), ustawiasz ceny promocyjne ręcznie albo regułą dla wielu naraz: obniżka o %, marża docelowa, stała cena, końcówka ,90. Kalkulator pokazuje obniżkę i marżę po promocji, ostrzega o sprzedaży poniżej kosztu i poniżej minimalnej marży. „Zatwierdź i uruchom” wysyła ceny do osobnej grupy cenowej w BaseLinkerze; start i koniec według dat wykonuje się automatycznie (agent sprawdza co kilka minut), a po końcu w grupie promocyjnej wraca cena zwykła. W katalogu aktywne promocje mają czerwony znacznik PROMOCJA z procentem, cenę promocyjną z przekreśloną zwykłą i filtr „W promocji”; z kampanii można jednym kliknięciem wydrukować etykiety promocyjne. Kampanie można duplikować i kończyć ręcznie. Nowe uprawnienie „Promocje: kampanie i ceny promocyjne”. Wymaga migracji migration-promotions.sql, wyboru grupy cenowej dla promocji w Administracja → BaseLinker → ustawienia, wdrożenia funkcji baselinker i nowej wersji agenta zamówień.',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Etykiety: wyraźna promocja, czytelny kalkulator marży, mniejsza cena za 1 l',
    description:
      'Etykieta promocyjna jest teraz mocno wyróżniona: czerwona ramka i pasek, jasnoczerwone tło ceny, duży znaczek PROMOCJA, czarna naklejka z procentem obniżki (np. −23%), stara cena przekreślona grubą czerwoną linią i nowa cena na czerwono. Pole ceny promocyjnej ma czytelną ramkę z cenami wyjściowymi (sprzedaż brutto i netto, zakup netto, marża obecna), progami opłacalności (cena bez straty i przy marży 10%), przyciskami szybkiej obniżki (−10% do −30%) oraz bieżącym wyliczeniem po wpisaniu ceny: cena netto, obniżka, marża po promocji, zysk na sztuce i ostrzeżenia (niska marża / sprzedaż poniżej kosztu). Cena za 1 l / 1 kg na etykiecie ma mniejszą czcionkę.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-13',
    title: 'Etykiety: ceny wyjściowe i marża przy cenie promocyjnej; kod kreskowy dalej od ceny',
    description:
      'Przy ustalaniu ceny promocyjnej (ołówek przy produkcie na liście „Do wydruku”) widać teraz cenę sprzedaży brutto i netto, a dla osób z uprawnieniem „Ceny i marża” także cenę zakupu netto i obecną marżę. Po wpisaniu ceny promocyjnej brutto pokazuje się: cena netto po promocji, procent obniżki, marża po promocji i zysk na sztuce — z ostrzeżeniem „niska marża” (poniżej 10%) i „sprzedaż poniżej kosztu”. Na etykiecie kod kreskowy jest węższy i przesunięty w lewo, a cena z większą liczbą cyfr (np. 129,00 zł) zmniejsza się automatycznie, żeby nie wchodzić na kod.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-13',
    title: 'Etykiety: nazwa ucinana od myślnika; domyślny rozmiar 65 × 30 mm',
    description:
      'Na etykiecie liczy się tylko nazwa główna: wszystko od myślnika (razem z myślnikiem) jest ucinane, np. „Aroma Patyczki zapachowe 50ml - Drewno Cedrowe” → „Aroma Patyczki zapachowe 50ml”. Myślnik wewnątrz słowa (np. CAR-WASH) zostaje. Własna nazwa wpisana ręcznie ołówkiem jest używana bez zmian. Domyślny rozmiar etykiety to teraz 65 × 30 mm (65 × 25 nadal na liście); ustawienia etykiet zaczynają od nowych domyślnych.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-13',
    title: 'Etykiety 65 × 25 mm: nazwa na górze w jednej linii, cena pod spodem',
    description:
      'Nowy domyślny rozmiar etykiety 65 × 25 mm (pod listwy cenowe) i przebudowany układ: bez napisu KENOCHEM u góry, nazwa produktu od samej góry zawsze w jednej linii (czcionka dobiera się automatycznie do szerokości etykiety), pod nią kod kreskowy po lewej i cena po prawej (netto pod brutto, wariant promocyjny na czerwono, cena za 1 l / 1 kg pod spodem), na dole SKU, lokalizacja i pojemność. Gdy nazwa jest za długa na jedną linię, lista „Do wydruku” pokazuje ostrzeżenie „nazwa ucięta — skróć” (nazwę skracasz ołówkiem tylko na etykiecie). Logo KENOCHEM można nadal włączyć w konfiguracji. Uwaga: ustawienia etykiet zaczynają od nowych domyślnych.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-13',
    title: 'Etykiety: cena jednostkowa (1 l / 1 kg / 1 szt.), netto, wariant wyprzedażowy i własna nazwa',
    description:
      'Konfigurator etykiet ma teraz: cenę jednostkową (obowiązek na półce) — pojemność lub wagę opakowania rozpoznaje z nazwy (np. 500 ml, 5 l, 750 g), można ją poprawić ręcznie, a etykieta pokazuje cenę za 1 l / 1 kg / 1 szt.; cenę netto pod brutto; wariant wyprzedażowy (przy produkcie wpisujesz cenę promocyjną: stara cena jest przekreślona, nowa na czerwono ze znaczkiem PROMOCJA, cena jednostkowa liczy się od ceny promocyjnej); oraz edycję nazwy produktu tylko na etykiecie (gdy oryginalna się nie mieści). Edycja nazwy, pojemności i ceny promocyjnej jest pod ikoną ołówka przy produkcie na liście „Do wydruku”.',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Studio etykiet: wybór produktów, konfiguracja i jasna etykieta do druku',
    description:
      'Sekcja „Etykiety” w menu to teraz pełne narzędzie: wyszukiwanie i zaznaczanie wielu produktów naraz (także „dodaj wszystkie wyniki”), ilość kopii przy każdym, podgląd na żywo i druk. Ustawiasz rozmiar (100×50, 100×70, 70×40, 60×40, 50×30 lub własny), papier (arkusz A4 albo drukarka etykiet), co ma być na etykiecie (logo, nazwa, SKU, kod kreskowy EAN/SKU, producent, kategoria, cena brutto, lokalizacja, stan), wielkość czcionki i ramkę — ustawienia są pamiętane. Etykieta to jasny prostokąt z zielonym akcentem i najważniejszymi danymi produktu.',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Aktualizacje: oznaczony początek historii (7 lipca 2026 — utworzenie katalogu)',
    description:
      'Na końcu dziennika zmian, za kropkowanym przeskokiem, widać kamień milowy: 7 lipca 2026 — utworzenie katalogu (data powstania systemu). Pierwszy szczegółowy wpis w dzienniku pochodzi z 16 września 2026.',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Przycisk weryfikacji BaseLinker (znaczniki B i W) obok odświeżania',
    description:
      'W nagłówku, na lewo od strzałek odświeżania, jest nowy przycisk z logo niebieskiego „B” i pomarańczowego „W”. Odświeża powiązania produktów z BaseLinkerem (administrator z uprawnieniem BaseLinker pobiera przy tym aktualną listę z BL, pozostali — aktualne powiązania z bazy) i pokazuje podsumowanie: ile produktów ma znacznik B (wystawione w BL) i ile W (z Mag, do uzupełnienia, bez oferty w BL).',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Menu: osobne sekcje „Nowe produkty” i „Aktualizacje”',
    description:
      'Dotychczasowe „Nowości” zostały rozdzielone w menu bocznym (i w „Więcej” na telefonie) na dwie osobne sekcje: „Nowe produkty” (produkty dopisane z WAPRO) oraz „Aktualizacje” (dziennik zmian aplikacji z numerami wersji). Numer wersji obok napisu „Menu” otwiera teraz od razu Aktualizacje. Dostępne też w wyszukiwarce poleceń.',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'Filtry: usunięty podział Akcesoria / Produkty; poprawiony kontrast zaznaczonych pozycji',
    description:
      'Z paska filtrów zniknął przełącznik Wszystkie / Akcesoria / Produkty (nikt z niego nie korzystał, a zajmował miejsce) — lista zawsze pokazuje wszystkie produkty. Poprawiony kontrast w ciemnych motywach: zaznaczone pozycje w menu filtrów (np. „Z rezerwacją (R)”), filtry, czat i mapa tras miały ciemnozielony tekst na ciemnym tle — teraz są jasne i czytelne.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-13',
    title: 'Katalog: stan realny (dostępny) i filtr „Z rezerwacją (R)”',
    description:
      'Na kafelku i w szczegółach produktu główną liczbą jest teraz stan realny: stan WAPRO minus zarezerwowane w otwartych zamówieniach (jak „Ilość dost.” w WAPRO), a obok pomarańczowe „R n” z liczbą zarezerwowanych; pełny stan WAPRO widać w podpowiedzi. Filtry stanu („Na stanie”, „Niski stan”, „Brak na stanie”) i sortowanie po stanie liczą stan realny. Nowy filtr stanu „Z rezerwacją (R)” pokazuje tylko produkty z rezerwacjami. Tryb edycji stanu nadal pokazuje pełny stan WAPRO.',
    tag: 'nowość',
  },
  {
    date: '2026-10-13',
    title: 'BaseLinker: do BL idzie stan dostępny (stan − rezerwacje), bez wirtualnych sztuk',
    description:
      'BaseLinker liczy swoje rezerwacje osobno (np. „23 (+3)”), a my wysyłaliśmy pełny stan z WAPRO (26), przez co przy rezerwacjach w BL pojawiały się dodatkowe, wirtualne sztuki. Teraz porównanie, ręczna i automatyczna wysyłka stanów oraz import nowych produktów używają stanu dostępnego: stan WAPRO minus zarezerwowane (to samo co „Ilość dost. w mag.” w WAPRO). Panel BaseLinker na karcie produktu porównuje stan dostępny z BL; zmiana rezerwacji w WAPRO wysyła nową wartość do BL (jeśli automat stanów jest włączony). Wymaga wdrożenia funkcji baselinker w Supabase i nowej wersji agenta zamówień.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-12',
    title: 'Zarezerwowane sztuki (R) przy stanie produktu',
    description:
      'Obok stanu na kafelku produktu i w szczegółach pojawia się pomarańczowy znacznik „R 3” — liczba sztuk zarezerwowanych w otwartych zamówieniach w WAPRO (w tym zamówieniach z BaseLinkera). W szczegółach widać też, ile zostaje dostępne. Dane odczytuje co ok. 5 minut agent zamówień na serwerze, jednym lekkim zapytaniem tylko do odczytu, więc WAPRO nie jest obciążane. Wymaga migracji migration-product-reserved.sql i nowej wersji agenta.',
    tag: 'nowość',
  },
  {
    date: '2026-10-12',
    title: 'Numeracja wersji aplikacji (v1.x.y) i statystyki dziennika zmian',
    description:
      'Każdy dzień zmian ma teraz numer wersji liczony automatycznie z dziennika: dzień z nowością podbija środkową cyfrę (1.9.0), dzień z samymi poprawkami ostatnią (1.9.1); duże przebudowy można oznaczyć jako nową główną wersję. Aktualna wersja jest przy napisie „Menu” w menu bocznym (kliknięcie otwiera dziennik zmian), a w dzienniku zmian widać numer przy każdym dniu oraz podsumowanie: liczbę wydań i zmian z podziałem na nowości, poprawki i wydajność.',
    tag: 'nowość',
  },
  {
    date: '2026-10-12',
    title: 'Zdjęcia: koniec dubli głównego zdjęcia w galerii i w porównaniu z BaseLinkerem',
    description:
      'Gdy produkt ma własne zdjęcie główne (np. po wycięciu tła), oryginał ze sklepu nie jest już pokazywany w galerii ani liczony jako osobne zdjęcie przy porównaniu z BaseLinkerem. Wcześniej ten sam obraz widać było dwa razy, a jedno z nich oznaczało się jako „brak w BL” (dotyczyło ok. 1000 produktów ze Sklepu). Wymaga ponownego wdrożenia funkcji baselinker w Supabase.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-08',
    title: 'BaseLinker: sprawdzanie i dokładanie zdjęć (pojedynczo i hurtowo)',
    description:
      'Na karcie produktu w panelu BaseLinker widać teraz, ile zdjęć jest w BL i w katalogu oraz ile brakuje; przycisk „Dołóż zdjęcia” dokłada brakujące na koniec galerii BL. Hurtowo: Zdjęcia do poprawy → „Zdjęcia → BaseLinker” (sprawdź wszystkie powiązane produkty, zaznacz i dołóż). Zdjęcia, które już są w BaseLinkerze, nigdy nie są usuwane ani podmieniane — po zapisie sprawdzamy, czy żadne nie zniknęło. Zdjęcia brakujące w BL są wyróżnione w galerii produktu (pomarańczowa ramka „brak w BL”). Produkty ze „Sklepu” pokazują teraz w galerii wszystkie unikalne zdjęcia z importu (kopie hpeciai i duplikaty są pomijane), a liczniki zdjęć nie liczą już podwójnie. Wymaga wdrożenia funkcji baselinker w Supabase.',
    tag: 'nowość',
  },
  {
    date: '2026-10-08',
    title: 'Katalog: sekcja „Zdjęcia do poprawy” i dodatkowe zdjęcia także w sklepie',
    description:
      'Nowa sekcja (menu boczne, „Więcej” na telefonie, zakładka „Do poprawy”) wylicza produkty, których zdjęcie główne jest mniejsze niż 500×500 px. Przycisk „Skanuj zdjęcia” mierzy zdjęcia i zapamiętuje wymiary w przeglądarce; z listy można zaznaczyć wiele produktów i poprawić je hurtowo (powiększenie albo kwadrat), z kopią do przywrócenia na karcie produktu. Dodatkowe (nie główne) zdjęcia można teraz wgrywać do każdego produktu — wcześniej produkty ze „Sklepu” pozwalały tylko na zdjęcie główne.',
    tag: 'nowość',
  },
  {
    date: '2026-10-08',
    title: 'Katalog: „Przygotuj pod BaseLinker (min. 500×500)” przy zdjęciu produktu',
    description:
      'Na karcie produktu, pod „Wytnij białe tło”, jest nowy przycisk. Pokazuje rozmiar obecnego zdjęcia i podgląd przed/po: zdjęcie mniejsze niż 500×500 px jest powiększane z zachowaniem proporcji albo (tryb „Kwadrat”) dopełniane tłem do kwadratu; większe zostaje bez zmian. Przezroczystość (wycięte tło) zostaje zachowana. Wynik zapisuje się jako zdjęcie główne, z kopią do przywrócenia.',
    tag: 'nowość',
  },
  {
    date: '2026-10-08',
    title: 'Wyszukiwarka: edycja w środku frazy i przycisk „Szukaj”',
    description:
      'Naprawiony błąd, przez który na telefonie nie dało się normalnie dopisać znaku między już wpisanymi słowami (pole nadpisywało się starszą wartością i kursor skakał na koniec). Gdy coś wpisano, obok „X” jest teraz stały przycisk „Szukaj”, który od razu zatwierdza frazę i chowa klawiaturę (to samo robi Enter / „Szukaj” na klawiaturze telefonu).',
    tag: 'poprawka',
  },
  {
    date: '2026-10-07',
    title: 'CRM: stan realizacji zamówienia z WAPRO w historii',
    description:
      'Agent na serwerze co ok. 10 minut sprawdza w WAPRO, co się stało z utworzonymi zamówieniami ZO. W historii CRM przy numerze ZO widać teraz: czeka na realizację, zrealizowane w X% (częściowo), zrealizowane albo usunięte w WAPRO. Po realizacji w szczegółach zamówienia pojawiają się też numery powiązanych dokumentów (WZ, faktura). Wymaga migracji migration-wapro-order-state.sql, migration-wapro-order-docs.sql i nowej wersji agenta.',
    tag: 'nowość',
  },
  {
    date: '2026-10-07',
    title: 'CRM: uprawnienie do wysyłki do WAPRO i podgląd przed wysyłką',
    description:
      'Przycisk „Do WAPRO” nie jest już tylko dla admina — to osobne uprawnienie „CRM: wysyłka zamówień do WAPRO” w macierzy ról (domyślnie tylko admin, resztę włączasz w panelu uprawnień). Przed wysłaniem pojawia się podgląd: klient, NIP, liczba pozycji, transport, sumy netto/brutto i handlowiec; brak NIP jest wyraźnie zaznaczony.',
    tag: 'nowość',
  },
  {
    date: '2026-10-07',
    title: 'CRM: karta klienta, klienci w kafelkach, historia z numerem ZO',
    description:
      'Lista klientów to teraz kafelki, a kliknięcie klienta otwiera jego kartę (dane, etykiety do przypisywania i dodawania własnych, historia zamówień, notatki, oś czasu) z przyciskiem „Utwórz zamówienie” — zamiast od razu przenosić do koszyka. W historii zamówienia wysłane do WAPRO mają etykietę z numerem ZO (albo „w kolejce” / „błąd”), a „Discord” pojawia się tylko przy zamówieniach naprawdę wysłanych na Discord. Zamówienia zapamiętują też kwotę transportu.',
    tag: 'nowość',
  },
  {
    date: '2026-10-07',
    title: 'CRM: transport w zamówieniu (KAT00178)',
    description:
      'W koszyku zamówienia można zaznaczyć „Doliczyć transport” i ustawić cenę netto/brutto. Kwota wlicza się do sum koszyka, trafia do wiadomości na Discord, a w zamówieniu do WAPRO jest dodawana jako pozycja KAT00178 (usługa transportu) w ustalonej cenie.',
    tag: 'nowość',
  },
  {
    date: '2026-10-07',
    title: 'Numer zamówienia w WAPRO: H + handlowiec + firma + numer',
    description:
      'Numer zamówienia klienta w ZO ma teraz 8 znaków: „H”, pierwsza litera imienia handlowca, pierwsza litera nazwy firmy i globalny numer zlecenia od 00001 (np. HLA00007). Wymaga migracji migration-wapro-order-seq.sql i nowej wersji agenta na serwerze.',
    tag: 'nowość',
  },
  {
    date: '2026-10-07',
    title: 'CRM: zamówienie wysłane do WAPRO trafia też do historii',
    description:
      'Po kliknięciu „Do WAPRO” zamówienie zapisuje się od razu w Historii CRM (z adnotacją „Wysłano do WAPRO”), niezależnie od tego, kiedy agent na serwerze utworzy ZO. Numer ZO pokazuje się w komunikacie po przetworzeniu.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-07',
    title: 'Przyciski „Dodaj” i „Edycja” przeniesione do paska filtrów katalogu',
    description:
      'Przyciski „Dodaj” (nowy produkt) i „Edycja” (tryb edycji stanów) zniknęły z górnego paska aplikacji. Są teraz w pasku filtrów sekcji Katalog, obok sortowania i rozmiaru kafelków, czyli tam, gdzie mają sens. Tryb edycji wyłącza się automatycznie po wyjściu z katalogu. Menu „Więcej” na telefonie pokazuje te akcje tylko w katalogu.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-07',
    title: 'Nowa strona startowa katalogu',
    description:
      'Strona startowa ma teraz jeden duży przycisk „Przejdź do katalogu” (zamiast trzech osobnych: cały katalog, akcesoria, produkty sklepu) oraz skaner EAN. Poniżej: statystyki stanów, nowa sekcja BaseLinker (ile produktów jest w BaseLinkerze, ile poza nim i ile jest gotowych do dodania, ze skrótem do listy produktów spoza BaseLinkera), zadania porządkowe, okno „Nowości z WAPRO” (nowe produkty dziś i w 7 dni, zmiany stanów i cen z ostatniej doby, ostatnia zmiana danych) oraz skrót do Biblioteki zamiast biblioteki wiedzy AI.',
    tag: 'nowość',
  },
  {
    date: '2026-10-07',
    title: 'Ukryte produkty nie pojawiają się w Decyzjach i Postępie',
    description:
      'Widok Decyzje (oraz statystyki w Postępie) liczył także produkty ukryte w katalogu, np. usługi. Teraz pokazuje wyłącznie widoczne produkty, tak jak widok Bez zdjęć. Ukryte pozycje nadal są dostępne w filtrze Status → Ukryte.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-07',
    title: 'Usługi (kody USŁ…) ukryte w katalogu',
    description:
      'Pozycje, których kod zaczyna się od „USŁ” (naprawy, transport, serwis), są usługami, a nie produktami — zostały ukryte w katalogu (można je zobaczyć w filtrze Status → Ukryte) i nie będą już dopisywane jako nowe produkty przy syncu WAPRO.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Nowe produkty: kolejność i dokładna data z godziną',
    description:
      'Lista Nowych produktów jest teraz posortowana od najnowszych i podzielona na dni (Dzisiaj, Wczoraj, kolejne daty), a przy każdym produkcie widać dokładny moment dopisania: „Dopisano 29.09.2026, 08:30”. Dodano też wyjaśnienie, że data oznacza chwilę wykrycia nowego indeksu w Mag przez sync WAPRO, a nie datę założenia artykułu w WAPRO.',
    tag: 'nowość',
  },
  {
    date: '2026-10-06',
    title: 'Bez zdjęć: nowe filtry jak w głównym katalogu',
    description:
      'Widok „Bez zdjęć” ma teraz ten sam pasek filtrów co katalog: rozwijane listy Kategoria (pogrupowana jak w sklepie) i Producent z licznikami, filtr stanu, sortowanie, rozmiar kafelków oraz aktywne filtry z możliwością szybkiego usunięcia i przyciskiem „Wyczyść”. Filtry są lokalne dla tego widoku (nie mieszają się z katalogiem), a link „Najwięcej braków wg marki” od razu filtruje po marce.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Sprzedaż: rozbicie miesięczne i porównanie z poprzednimi 12 miesiącami',
    description:
      'Naprawiono zapytanie do WAPRO, które zawsze kończyło się błędem składni i spadało do uproszczonej wersji (tylko sumy). Po skopiowaniu nowego skryptu na serwer sprzedaż w karcie produktu i w Operacjach wraca z pełnym rozbiciem na miesiące. Agent nie robi też już pełnego syncu co 2 minuty bez potrzeby — automat działa co 10 minut lub na zlecenie z aplikacji.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Sprzedaż produktów odświeża się razem z syncem WAPRO',
    description:
      'Dane w zakładce Sprzedaż na karcie produktu (oraz w Operacjach) były aktualizowane tylko ręcznie i od 29.09 nie ruszyły. Teraz agent odświeża sprzedaż po dziennym syncu stanów oraz na zlecenie z aplikacji (nie częściej niż co 20 minut). Wymaga skopiowania nowego skryptu na serwer WAPRO.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Uprawnienie BaseLinker widoczne w macierzy uprawnień',
    description:
      'W Administracja → Uprawnienia pojawiło się brakujące uprawnienie „BaseLinker: synchronizacja i import” (grupa Administracja), które można nadać dowolnej roli, np. operatorowi.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Ładne okna potwierdzeń zamiast komunikatów przeglądarki',
    description:
      'Pytania typu „Usunąć zdjęcie?”, „Usunąć folder?”, „Dodać do BaseLinkera?” oraz okna z pytaniem o nazwę (np. nowy folder, przypisanie leada, nowe hasło) mają teraz własny, spójny wygląd: wyśrodkowane okno z ikoną ostrzeżenia, tytułem i opisem. Przy usuwaniu domyślnie zaznaczone jest „Anuluj”, a Esc zamyka okno bez wykonywania akcji.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Uprawnienie „BaseLinker: synchronizacja i import” dla ról',
    description:
      'W Administracja → Uprawnienia pojawiło się nowe uprawnienie „BaseLinker: synchronizacja i import”. Rola, która je ma (np. operator), widzi zakładkę BaseLinker w panelu administracji oraz przyciski synchronizacji i dodawania do BaseLinkera na karcie produktu. Domyślnie ma je tylko administrator; uprawnienie jest też sprawdzane po stronie serwera.',
    tag: 'nowość',
  },
  {
    date: '2026-10-06',
    title: 'Karta produktu: zwarty układ bez przewijania',
    description:
      'Panel BaseLinker przeniesiony do prawej kolumny i skompresowany (stan, cena i EAN w jednym rzędzie, przyciski synchronizacji i pomijania w jednej linii). Pola danych produktu są gęstsze: jedna sekcja „Magazyn · media · logistyka”, bez zbędnych powtórzeń (ID rekordu równego SKU, tytułu oferty identycznego z nazwą). Zdjęcie po lewej jest nieco niższe, żeby całość mieściła się na ekranie.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Zdjęcia z wyciętym tłem zostają przezroczyste',
    description:
      'Wgrywane zdjęcia PNG/WebP z przezroczystym tłem (wycięty produkt) trafiały do katalogu z czarnym tłem, bo były zapisywane jako JPEG. Teraz zdjęcia z przezroczystością są zapisywane w formacie WebP i zachowują przezroczyste tło, więc produkt stoi bez tła na kafelku, w każdym motywie. Zdjęcia bez przezroczystości nadal trafiają jako JPEG. Zdjęcia wgrane wcześniej z czarnym tłem trzeba wgrać ponownie.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Znaczniki „B” i „W” na bieżąco',
    description:
      'Niebieskie „B” (produkt jest w BaseLinkerze) nie opiera się już na dawnym eksporcie CSV, tylko na aktualnej liście z BaseLinkera. Lista odświeża się po dodaniu produktu do BaseLinkera, przy otwarciu karty produktu, po porównaniu w panelu admina i cyklicznie przez agenta WAPRO. Gdy produkt trafi do BaseLinkera, pomarańczowe „W” zmienia się na niebieskie „B”.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Import produktów z katalogu do BaseLinkera',
    description:
      'Administrator może dodawać do głównego katalogu BaseLinkera produkty z naszego katalogu: pojedynczo (przycisk „Dodaj do BaseLinkera” w panelu BaseLinker na karcie produktu) lub masowo (Administracja → BaseLinker → Import do BaseLinkera, z listą gotowości). Przenoszone są nazwa, opis, cena sprzedaży brutto, cena zakupu netto, stan, EAN, waga i wymiary, VAT, tagi, lokalizacja, zdjęcia, kategoria i producent. Gdy SKU już istnieje w BaseLinkerze, import jest blokowany; braki są pokazywane jako ostrzeżenia.',
    tag: 'nowość',
  },
  {
    date: '2026-10-06',
    title: 'BaseLinker: synchronizacja pojedynczego produktu i pomijanie stanów własnych',
    description:
      'Na karcie produktu administrator ma stałe przyciski „Synchronizuj stan” i „Synchronizuj cenę” (do małych korekt bez porównywania całego katalogu) oraz pola wyboru „Pomijaj w synchronizacji grupowej” dla stanu i ceny — np. dla towarów ze stanem własnym typu 999999. Dodatkowo w ustawieniach BaseLinker można ustawić próg: stany równe lub większe są pomijane automatycznie.',
    tag: 'nowość',
  },
  {
    date: '2026-10-06',
    title: 'BaseLinker: panel zarządzania synchronizacją',
    description:
      'Administracja → BaseLinker ma teraz trzy części: Ustawienia (osobny automat dla stanów i cen, wybór grupy cenowej, pomijanie produktów z ręcznym stanem, limit zmian na przebieg, wykluczenia po prefiksie lub SKU, tolerancja ceny), Porównanie i korekta (rozjazdy stanów i cen z zaznaczaniem i wysyłką, braki po obu stronach, CSV) oraz Historię wysyłek. Na karcie produktu administrator może jednym kliknięciem ustawić w BaseLinkerze stan lub cenę z katalogu.',
    tag: 'nowość',
  },
  {
    date: '2026-10-06',
    title: 'BaseLinker: podgląd na karcie produktu i wysyłka stanów',
    description:
      'Na karcie produktu (po lewej, pod cenami) pojawił się panel BaseLinker: czy produkt jest w BL, jego stan, cena brutto i EAN w porównaniu z katalogiem (WAPRO), liczba zdjęć i długość opisu. Admin ma nową zakładkę Administracja → BaseLinker: porównanie stanów całego katalogu z BaseLinkerem (różnice, braki po obu stronach, eksport CSV), ręczną wysyłkę zaznaczonych stanów oraz opcję automatycznego wysyłania stanów po każdym syncu WAPRO.',
    tag: 'nowość',
  },
  {
    date: '2026-10-06',
    title: 'Motyw szary i ciemny: czytelne panele informacyjne',
    description:
      'Panele informacyjne (np. „Opis w katalogu / dla AI” na karcie produktu) były w ciemnych motywach jasnobiałe. Teraz mają tło dopasowane do motywu, z czytelnym jasnym tekstem.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-06',
    title: 'Karta produktu: cena zakupu brutto',
    description:
      'W panelu cen produktu, obok ceny zakupu netto, pokazujemy też cenę zakupu brutto (netto + VAT produktu, domyślnie 23%).',
    tag: 'nowość',
  },
  {
    date: '2026-10-06',
    title: 'Dziennik aktywności: adres IP i dane urządzenia',
    description:
      'W Administracja → Aktywność przy każdym wpisie widać adres IP (ustalany po stronie serwera), a przy logowaniach także przeglądarkę, system, typ urządzenia (komputer/telefon/tablet), rozdzielczość ekranu, strefę czasową i czy aplikacja działa jako zainstalowana PWA. Dane są też w eksporcie CSV.',
    tag: 'nowość',
  },
  {
    date: '2026-10-05',
    title: 'Dziennik aktywności użytkowników (dla admina)',
    description:
      'Nowa zakładka Administracja → Aktywność pokazuje, kto, co i kiedy zmienił: edycje produktów (stan, ceny, kategoria, zdjęcia, opisy), dodawanie i usuwanie produktów i zestawów, zmiany kont i uprawnień oraz logowania. Przy każdej zmianie widać wartość przed i po. Filtry po osobie, akcji, okresie i SKU oraz eksport CSV. Dziennik zapisuje zmiany od momentu wdrożenia.',
    tag: 'nowość',
  },
  {
    date: '2026-10-05',
    title: 'Suite przebudowany na centrum narzędzi',
    description:
      'Suite (kenochem-f4a5b.web.app) jest teraz lekkim launcherem: kafelki aplikacji widoczne wg roli, zbiorcze powiadomienia z narzędzi (błędy syncu WAPRO, nowe produkty, zaległe zadania CRM), stan syncu WAPRO, własne oferty i zamówienia z bieżącego miesiąca oraz przewodnik. Katalog, foldery i CRM działają wyłącznie we własnych aplikacjach.',
    tag: 'nowość',
  },
  {
    date: '2026-10-05',
    title: 'Foldery: poprawione usuwanie produktów i folderów',
    description:
      'Usunięty produkt lub folder potrafił wracać po odświeżeniu (scalanie z kopią z konta). Teraz usunięcie jest trwałe, a jeśli nie dojdzie od razu do konta, dokończy się samo przy następnym wczytaniu. Dodano przycisk usuwania folderu na liście, powiadomienia po usunięciu i większy przycisk „Usuń z folderu” na telefonie.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-02',
    title: 'CRM: historia wygenerowanych ofert',
    description:
      'Każda oferta PDF zapisuje się teraz w Historii CRM (osobno dla każdego użytkownika): numer oferty, klient, kwota netto, data. Można ją otworzyć lub pobrać ponownie w niezmienionej formie, wczytać do edycji („Ponów”) oraz filtrować listę: Wszystko / Zamówienia / Oferty.',
    tag: 'nowość',
  },
  {
    date: '2026-09-29',
    title: 'Nowa zakładka „Zmiany w czasie”',
    description:
      'Wykres i tabela historii dla wybranego produktu — ceny (zakup netto, sprzedaż netto/brutto) i stan magazynowy w czasie, na podstawie logu zmian z każdego syncu WAPRO. Wzrost stanu = dostawa, spadek = sprzedaż/korekta.',
    tag: 'nowość',
  },
  {
    date: '2026-09-29',
    title: 'Wykluczenia w Martwym stocku — teraz wspólne dla wszystkich',
    description:
      'Ręczne „Wyklucz”/„Cofnij” zapisywało się wcześniej tylko lokalnie w przeglądarce osoby, która kliknęła — inni tego nie widzieli i nie mogli cofnąć. Teraz zapisuje się na produkcie w bazie, więc jest widoczne i odwracalne dla każdego z dostępem do Ops.',
    tag: 'poprawka',
  },
  {
    date: '2026-09-29',
    title: 'Naprawiony sync sprzedaży WAPRO — błąd „Argument types do not match”',
    description:
      'Rzadki błąd PowerShell 5.1 przy budowaniu miesięcznej rozpiski sprzedaży powodował pomijanie prawie połowy produktów przy każdym sync sprzedaży z Mag. Naprawione u źródła.',
    tag: 'poprawka',
  },
  {
    date: '2026-09-28',
    title: 'Komunikat ładowania dopasowany do produktu',
    description:
      'Ekran startowy pokazywał „Ładowanie katalogu” nawet na Handlu czy w Operacjach — teraz pokazuje właściwą nazwę produktu, na którym jesteś.',
    tag: 'poprawka',
  },
  {
    date: '2026-09-28',
    title: 'CRM: mniej powtórzeń w koszyku',
    description:
      'Usunięty zdublowany żółty pasek „X szt. w koszyku” na desktopie — ta informacja i tak jest już w koszyku po prawej stronie. Na telefonie pasek został, bo tam nie ma stałego koszyka z boku.',
    tag: 'poprawka',
  },
  {
    date: '2026-09-28',
    title: 'CRM: usprawnienia koszyka i oferty',
    description:
      'Wybór klienta jest teraz mocniej wyróżniony wizualnie, ceny netto/brutto (pozycje i transport) mają dwa zsynchronizowane pola do edycji, naprawiony „skok” przycisku +/- przy dodawaniu do koszyka, i nowa opcja edycji imienia widocznego na ofercie PDF.',
    tag: 'nowość',
  },
  {
    date: '2026-09-28',
    title: 'Tryb „Szybkie zdjęcia” w Bez zdjęć',
    description:
      'Pełnoekranowy tryb do seryjnego fotografowania produktów bez zdjęcia — aparat gotowy od razu, automatyczne przejście do następnego po zapisaniu.',
    tag: 'nowość',
  },
  {
    date: '2026-09-28',
    title: 'Masowe zatwierdzanie kategorii w Decyzjach',
    description:
      'Można zaznaczyć wiele produktów z gotową sugerowaną kategorią naraz i zatwierdzić je jednym kliknięciem zamiast pojedynczo.',
    tag: 'nowość',
  },
  {
    date: '2026-09-28',
    title: 'Filtr pustych szkiców z WAPRO',
    description:
      'Puste, nigdy nieuzupełnione artykuły zakładane w WAPRO Mag (np. „nowy artykuł (12345)”) nie trafiają już automatycznie do katalogu.',
    tag: 'poprawka',
  },
  {
    date: '2026-09-28',
    title: 'Naprawione wyszukiwanie — fałszywe wyniki dla „sonax”',
    description:
      'Błędny administracyjny tag „Sonax” na produktach innych marek (ADBL, Cif, Clinex...) powodował, że wyskakiwały w wynikach zamiast prawdziwych produktów SONAX.',
    tag: 'poprawka',
  },
  {
    date: '2026-09-28',
    title: 'Szybsze wczytywanie katalogu',
    description:
      'Dane katalogu potrafiły pobierać się i parsować kilka razy naraz przy starcie aplikacji — teraz robią to tylko raz, niezależnie ile miejsc w kodzie o nie poprosi.',
    tag: 'wydajność',
  },
  {
    date: '2026-09-28',
    title: 'Spokojniejsze menu boczne',
    description:
      'Pomarańczowe podświetlenie całych przycisków w menu (Decyzje, Bez zdjęć itd.) zastąpione małą plakietką z liczbą — mniej wizualnego szumu, łatwiej dostrzec co faktycznie wymaga uwagi.',
    tag: 'poprawka',
  },
  {
    date: '2026-09-25',
    title: 'Szybsze ładowanie katalogu',
    description:
      'Rzadziej używane widoki (Logi, Nowości, Ukryte, Biblioteka) ładują się teraz dopiero po wejściu w nie, zamiast od razu przy starcie aplikacji.',
    tag: 'wydajność',
  },
  {
    date: '2026-09-25',
    title: 'Filtr dat w „Nowe produkty”',
    description:
      'W zakładce Nowości można teraz zawęzić listę do ostatniego dnia, tygodnia, 30 dni albo wybrać własny zakres dat.',
    tag: 'nowość',
  },
  {
    date: '2026-09-25',
    title: 'Zakładka „Nowości” — nowe produkty z WAPRO',
    description:
      'Nowa zakładka pokazuje produkty, które sync WAPRO automatycznie dopisał do katalogu (nowe indeksy z Mag) — bez przeszukiwania całego katalogu.',
    tag: 'nowość',
  },
  {
    date: '2026-09-24',
    title: 'Szczegółowe logi zmian cen i stanów',
    description:
      'Zakładka Logi pokazuje teraz dokładnie, w których produktach zmienił się stan lub cena po każdym syncu WAPRO, pogrupowane po przebiegu syncu.',
    tag: 'nowość',
  },
  {
    date: '2026-09-16',
    title: 'Naprawiona wyszukiwarka katalogu',
    description:
      'Wyszukiwanie przestało się zacinać i zawieszać na telefonie przy szybkim wpisywaniu tekstu.',
    tag: 'poprawka',
  },
  {
    date: '2026-09-16',
    title: 'Poprawiony sync WAPRO — stany z wielu magazynów',
    description:
      'Stany produktów liczyły się błędnie z sumy trzech magazynów WAPRO zamiast tylko z magazynu głównego — naprawione.',
    tag: 'poprawka',
  },
];
