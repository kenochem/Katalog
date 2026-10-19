export interface AppChangelogEntry {
  /** ISO data (YYYY-MM-DD) — sortujemy malejąco. */
  date: string;
  title: string;
  description: string;
  tag?: 'nowość' | 'poprawka' | 'wydajność';
  /**
   * Wielkość zmiany do numeru wersji (domyślnie z tagu: nowość → minor, reszta → patch).
   * `major` — duża przebudowa; `minor` — nowa funkcja lub większa zmiana; `patch` — mała poprawka.
   */
  size?: 'patch' | 'minor' | 'major';
}

/**
 * Dziennik zmian w katalogu — wpisy dodawane ręcznie przy każdej wysłanej
 * funkcji/poprawce. Najnowszy na górze listy w UI (sortowane po `date`).
 */
export const APP_CHANGELOG: AppChangelogEntry[] = [
  {
    date: '2026-10-19',
    title: 'Etykiety: zmiana ceny brutto na etykiecie i wyrównywanie końcówek (,99 / ,00 …)',
    description:
      'W Studiu etykiet można teraz zmienić cenę brutto, która idzie na etykietę (np. z dziwnej 31,81 zł na 31,90 zł) — zmiana dotyczy tylko etykiety, cena w katalogu zostaje bez zmian. W edycji pozycji (ołówek) jest pole ceny, informacja o cenie z katalogu, przycisk „przywróć z katalogu” oraz przyciski wyrównania z podglądem wyniku dla danej ceny: ,99 w dół / w górę / najbliższa, ,00 w dół / w górę / najbliższa, ,90 i ,50 najbliższa (np. 31,81 → 30,99 / 31,99 / 31,00 / 32,00). Nad listą „Do wydruku” jest wyrównanie dla wszystkich etykiet naraz (z opcją „także ceny promocyjne”) i przywrócenie wszystkich cen z katalogu. Przy pozycji widać aktualną cenę z oznaczeniem „zmieniona”, a cena netto jest przeliczana według VAT produktu.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Edycja masowa i szybka edycja w wierszu w Uzupełnianiu danych (Etap 2)',
    description:
      'Nowe narzędzia w Uzupełnianiu danych. Edycja masowa zaznaczonych produktów: producent, kategoria, stawka VAT, jednostka, tagi (dodawanie i usuwanie) oraz ceny — ustaw wartość, zmień o procent albo o kwotę, z zaokrągleniem (do grosza, 10 groszy, złotych, końcówka ,99 lub ,90) i opcjonalnym przeliczeniem drugiej ceny sprzedaży netto ↔ brutto wg VAT. Przed zapisem jest podgląd „stare → nowe” dla każdego produktu i podsumowanie, a cała operacja zapisuje się jako jedna partia, którą można cofnąć (Logi → Operacje masowe). Szybka edycja w wierszu: przycisk „Szybka edycja” rozwija pola EAN (z ostrzeżeniem o nietypowej długości), producent, kategoria i cena sprzedaży brutto — zapis bez otwierania karty. Edycja wymaga uprawnienia edycji produktów, zmiany cen także uprawnienia do cen.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Historia zmian produktu z cofaniem oraz operacje masowe do cofnięcia (Etap 1)',
    description:
      'W karcie produktu jest nowa zakładka „Historia”: oś czasu zmian z informacją, kto i kiedy zmienił pole oraz jaka była wartość przed i po (nazwa, opis, EAN, producent, kategoria, ceny, stan, zdjęcia, tagi i pola dodatkowe). Przy każdej zmianie jest przycisk „Przywróć” — stara wartość wraca do produktu, a samo przywrócenie też zostaje w historii. Operacje na wielu produktach naraz (ukrywanie, przywracanie, wyjątki, edycja masowa) dostają wspólny identyfikator partii; w Logi → „Operacje masowe” widać je z ostatnich 30 dni, z rozwijanym podglądem zmian i przyciskiem „Cofnij całość”, który przywraca wartości sprzed operacji (cofnięta partia jest oznaczona). Dziennik zapisuje teraz pełne wartości do 20 000 znaków (wcześniej obcinał do 300), więc cofnąć można także długie opisy; starsze, skrócone wpisy są oznaczone jako niemożliwe do automatycznego cofnięcia. Wymaga migracji migration-audit-log-product-history.sql (historia produktów widoczna dla wszystkich zalogowanych, pozostałe wpisy dziennika bez zmian).',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Profesjonalny, konfigurowalny eksport CSV',
    description:
      'Eksport do CSV ma teraz okno konfiguracji (przycisk „Eksportuj widok (CSV)” nad listą katalogu oraz „Eksport CSV” w Uzupełnianiu danych i w Ukrytych). Wybierasz dokładnie, co trafi do pliku: ponad 40 kolumn w grupach — identyfikacja (SKU, EAN, nazwy, producent, kategoria, typ), ceny i marża (sprzedaż brutto i netto, zakup netto i brutto, VAT, marża %, zysk, wartość zapasu), magazyn i logistyka (stan, lokalizacja, jednostka, waga, wymiary), opisy i kompletność (opis pełny, krótki, użycie, skład, bezpieczeństwo, % kompletności, czego brakuje), zdjęcia (czy ma, adresy URL), BaseLinker, status (ukryty, wyjątki, notatka) i sprzedaż z WAPRO. Kolejność kolumn zmieniasz strzałkami, a nagłówek każdej możesz nazwać po swojemu. Gotowe zestawy: Podstawowy, Cennik, Magazyn, Braki danych, Opisy i zdjęcia, Pełny — plus własne profile zapisywane pod nazwą w przeglądarce (ostatnie ustawienia pamiętane automatycznie). Format: separator (średnik, przecinek, tabulator), separator dziesiętny i liczba miejsc po przecinku, Tak/Nie lub 1/0, opisy jako zwykły tekst lub HTML, nagłówki czytelne lub techniczne, BOM dla Excela, cudzysłowy. Jest podgląd pierwszych wierszy, wybór zakresu (wszystkie lub zaznaczone) i zabezpieczenie przed „formułami” w Excelu. Opisy pełne są doczytywane z bazy tylko wtedy, gdy wybierzesz tę kolumnę. Eksport wymaga uprawnienia „Eksport danych”.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Kategorie: nowy wygląd drzewa, przeciąganie kategorii i porządek z „dzikimi” kategoriami',
    description:
      'Zakładka Kategorie została przebudowana wizualnie. Drzewo ma czytelne gałęzie z liniami prowadzącymi, ikony folderów (grupy) i etykiet (kategorie z produktami), pasek udziału i liczbę produktów przy każdej pozycji oraz oznaczenia „nowa” i „pusta”. Kategorie można przeciągać myszą na inną grupę (albo do kategorii głównych), żeby je przenosić. Na górze są liczniki: kategorie, własne, puste i „Do decyzji”. Doszły sortowanie drzewa (ze sklepu, A–Z, wg liczby produktów), filtr „Tylko puste” oraz Rozwiń / Zwiń. „Dzikie” kategorie wpisane w produktach, których nie ma w drzewie, są teraz w wyraźnym banerze na górze jako przyciski-pigułki: kliknięcie nazwy od razu dodaje ją do drzewa, a „Dodaj wszystkie” robi to hurtem. Usunięte kategorie ze sklepu można przywrócić jednym kliknięciem.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Zdjęcia z BaseLinkera: walidacja wizualna — zdjęcia po obróbce nie są już „brakujące”',
    description:
      'Zdjęcie poprawione w katalogu (zmiana rozmiaru, wycięcie tła, margines, inny format) miało inny adres i nazwę pliku niż oryginał w BaseLinkerze, więc było uznawane za „inne”, a oryginał z BL za brakujący w katalogu. Teraz zdjęcia z BL są porównywane wizualnie (hash percepcyjny z przycięciem białych marginesów i traktowaniem przezroczystości jak bieli): jeśli wyglądają jak któreś zdjęcie z katalogu, są pomijane i oznaczone jako „te same po obróbce”, a do zaciągnięcia trafiają tylko naprawdę nowe zdjęcia (z miniaturami). Walidacja działa w karcie produktu oraz przy zaciąganiu hurtowym (opcja „sprawdź martwe linki i duplikaty”). Dodatkowo serwer traktuje oryginał zdjęcia głównego sprzed obróbki (image_url) jako obecny w katalogu. Zdjęć, których nie da się wczytać do porównania, nie pomijamy. Część serwerowa wymaga wdrożenia funkcji baselinker.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-19',
    title: 'Karta produktu: przebudowane sekcje „Identyfikacja” i „Magazyn · media · logistyka”',
    description:
      'Dane identyfikacyjne produktu zostały uporządkowane w dwie czytelne karty. W Identyfikacji SKU i EAN są dużymi, klikalnymi polami (kliknięcie kopiuje kod; brak EAN jest wyraźnie zaznaczony), poniżej siatka z producentem, typem, kategorią docelową, ścieżką kategorii w sklepie jako okruszki, powiązaniem z BaseLinkerem (znacznik z ID), nazwą WAPRO / tytułem oferty i identyfikatorem rekordu do skopiowania. Magazyn, media i logistyka to teraz kafelki z ikonami: stan (kolor zależny od dostępności), lokalizacja, liczba zdjęć, waga, wymiary, jednostka, VAT i warianty, a tagi są chipami. Znaczniki źródła danych (W — WAPRO, BL — BaseLinker) zostały, ale są dyskretne.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-19',
    title: 'Zaciąganie zdjęć z BaseLinkera: naprawa fałszywego „katalog ma już wszystkie zdjęcia”',
    description:
      'Przycisk „Zaciągnij zdjęcia z BaseLinkera do katalogu” przy produktach, w których BL miał inne zdjęcia o tej samej nazwie pliku (np. image.jpg w różnych folderach), uznawał je za już obecne i nic nie dodawał, choć panel pokazywał „brak w katalogu”. Teraz do katalogu trafiają dokładnie te zdjęcia, które panel wskazuje jako brakujące (z miniaturami), a dodatkowo zdjęcia z BL będące odpowiednikiem martwego linku (ta sama nazwa pliku, np. po zmianie png → jpg).',
    tag: 'poprawka',
  },
  {
    date: '2026-10-19',
    title: 'Zdjęcia: zaciąganie z BaseLinkera do katalogu i wykrywanie martwych linków',
    description:
      'Synchronizacja zdjęć działa teraz w obie strony. W karcie produktu (panel BaseLinker) widać, ile zdjęć jest w BL, a nie ma ich w katalogu, oraz ile zdjęć w katalogu się nie ładuje (martwe linki, np. po zmianie adresów lub formatu png → jpg na serwerze zdjęć). Przycisk „Zaciągnij zdjęcia z BaseLinkera do katalogu” dokłada brakujące zdjęcia, zastępuje martwe linki zdjęciami z BL i ustawia pierwsze zdjęcie z BL jako główne, gdy produkt nie ma działającego głównego; działających zdjęć nie rusza (przed zapisem jest podsumowanie do potwierdzenia). Dopasowanie po nazwie pliku bez rozszerzenia nie dubluje tego samego zdjęcia z innego serwera czy w innym formacie. W Zdjęcia do poprawy → BaseLinker pojawił się przełącznik kierunku: „BaseLinker → katalog” pokazuje produkty (także te bez żadnego zdjęcia w katalogu) i zaciąga zdjęcia hurtem, z opcjonalnym sprawdzaniem martwych linków. Wymaga wdrożenia funkcji baselinker (lista zdjęć brakujących w katalogu).',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Uzupełnianie danych: wyjątki (produkt znika z listy braków, gdy czegoś nie potrzebuje)',
    description:
      'Nowa funkcja wyjątków. Dla produktu można wskazać, że konkretnego braku nie trzeba uzupełniać: „Nie idzie do BaseLinkera”, „Tylko do użytku wewnętrznego”, „Zdjęcie niepotrzebne”, „Brak kodu EAN”, „Bez producenta”, „Bez ceny sprzedaży” albo „Cały produkt — nic nie trzeba”. Wyjątek ustawisz przyciskiem „Wyjątek” przy produkcie albo hurtem dla zaznaczonych (z własną notatką). Produkt bez pozostałych braków znika z listy, a pozostałe jego braki nadal są widoczne. W nowej zakładce „Wyjątki” widać wszystkie takie produkty z powodem i można je cofnąć jednym kliknięciem. Wyjątki są zapisane w danych produktu (wspólne dla wszystkich), uwzględniane w licznikach oraz w Statystykach i w podpowiedzi „Następny krok”, a zmiany trafiają do dziennika aktywności, ale nie dają punktów.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Nowa sekcja „Kategorie”: drzewo kategorii zapisane na stałe w bazie; naprawa dodawania kategorii w produktach',
    description:
      'Zgłoszony błąd: kategoria dodana w jednym produkcie („+ Nowa kategoria…”) nie była widoczna w innych, bo istniała tylko w tym produkcie. Teraz nowa kategoria zapisuje się na stałe we wspólnej bazie i od razu jest na liście wyboru w każdym produkcie, przy dodawaniu produktu oraz w filtrach katalogu. W menu jest nowa sekcja „Kategorie” z drzewem: rozwijanie i szukanie, liczba produktów w każdej gałęzi, dodawanie kategorii głównych i podkategorii, zmiana nazwy (poprawia nazwę we wszystkich produktach), przenoszenie w drzewie i usuwanie z wyborem kategorii, do której trafią produkty. Kategorie ze sklepu też można przenosić, przemianowywać i usuwać (z możliwością przywrócenia), a kategorie wpisane wcześniej w produktach, których nie było w drzewie, można jednym kliknięciem dodać do drzewa. Nowe uprawnienie „Kategorie” w macierzy ról (operator i admin domyślnie). Wymaga migracji migration-catalog-categories.sql.',
    tag: 'nowość',
  },
  {
    date: '2026-10-16',
    title: 'Producenci: większe loga na liście, bez etykiety „ręczny”',
    description:
      'Loga producentów na liście są większe (64 px zamiast 40 px, w profilu 96 px), dzięki czemu łatwiej rozpoznać markę. Usunięto etykietę „ręczny” przy producentach dodanych ręcznie — zostały tylko oznaczenia WAPRO i BaseLinker oraz braki logo i opisu.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-16',
    title: 'Statystyki (dawne Postępy), nowy widok „Ukryte”, nowoczesny panel administracyjny i nowe uprawnienia',
    description:
      'Postępy mają teraz nazwę „Statystyki” we wszystkich menu, wyszukiwarce poleceń, opisach uprawnień i podpowiedziach. Poprawiono kontrast wykresów na ciemnym motywie (tekst w dymkach i legendach). Widok „Ukryte” został przebudowany: lista na całą szerokość ze stronicowaniem, panel boczny z wyszukiwarką (naprawiona nachodząca lupa), filtrami powodów z licznikami, sortowaniem, zaznaczaniem i akcjami masowymi (przywróć zaznaczone, zmień powód ukrycia), a w wierszach widać producenta, kategorię, stan, powód i datę ukrycia. Ten sam błąd lupy naprawiono w wyszukiwarkach dziennika aktywności, CRM i lokalizacji magazynowych. Panel administracyjny ma nowy wygląd i nową zakładkę „Przegląd” (konta i role, aktywność zespołu z ostatnich 14 dni, najaktywniejsi, ostatnie logowania z urządzeniem i adresem IP, kontrola migracji) oraz zakładki, które do tej pory były tylko w Logach: Aktywność, Migracje bazy i Status systemów. Doszły trzy nowe uprawnienia w macierzy ról: Producenci (edycja, logo, synchronizacja z BL), Ukrywanie produktów i Eksport danych do CSV — operator ma je domyślnie, handlowiec tylko eksport; bez uprawnienia przyciski są ukryte lub wyłączone. W dzienniku aktywności są teraz czytelne nazwy dla akcji producentów, opisów i zdjęć wysyłanych do BaseLinkera.',
    tag: 'nowość',
  },

  {
    date: '2026-10-16',
    title: 'Postępy przebudowane na panel statystyk z wykresami; „Decyzje” → „Uzupełnianie danych”; usunięto „Bez zdjęć”',
    description:
      'Sekcja „Bez zdjęć” została usunięta z menu — brakujące zdjęcia są filtrem „Brak zdjęcia” w Uzupełnianiu danych (dawne Decyzje), gdzie można je sortować i hurtowo obrabiać; stare skróty prowadzą tam z gotowym filtrem. Dodano filtr kategorii na liście. Postępy zbudowano od nowa jako nowoczesny panel statystyk z wykresami kołowymi, słupkowymi i liniowymi, w pięciu zakładkach: Przegląd (kafle: produkty, średnia kompletność, zdjęcia, EAN, producenci, ceny; poziomy i rozkład kompletności; producenci z najsłabszą kompletnością), Zdjęcia i opisy (zdjęcia, stany, katalogi, pokrycie każdego składnika oceny, kategorie z najmniejszym odsetkiem zdjęć), Producenci i Kategorie (udział, rankingi i tabele z miernikami kompletności, zdjęć i EAN; kliknięcie otwiera Uzupełnianie danych z gotowym filtrem) oraz Zmiany pracowników (aktywność z ostatnich 30 dni, uzupełnione pola, kto pracuje i lista najnowszych zmian produktów — administrator widzi wszystkich, pozostali własne). Na górze zawsze jest karta „Następny krok”: system wylicza, które uzupełnienie podniesie średnią kompletność katalogu najbardziej, i jednym kliknięciem otwiera właściwą listę.',
    tag: 'nowość',
  },

  {
    date: '2026-10-16',
    title: 'Logi → Migracje bazy: kontrola, które migracje są wgrane; naprawa komunikatu w „Mojej kolejce”',
    description:
      'W Logach (dla administratorów) jest nowa zakładka „Migracje bazy”. Aplikacja sama sprawdza próbnymi zapytaniami, czy tabele i kolumny z każdej migracji (supabase/migration-*.sql, 67 plików) istnieją w bazie, i pokazuje stan: wgrana, do wgrania, częściowo, brak dostępu albo nie do sprawdzenia (migracje bez tabel i kolumn, np. funkcje). Domyślnie widać tylko rzeczy do zrobienia, z nazwą brakującego obiektu i przyciskiem kopiowania nazwy pliku. Wyjaśniono też błąd z profilu „Brak tabeli zadań”: komunikat pojawiał się przy każdym błędzie bazy, także gdy tabela istniała, a baza odmawiała dostępu (brak uprawnień GRANT dla zalogowanych). Teraz pokazujemy prawdziwą przyczynę, a nowa migracja migration-grants-fix.sql nadaje brakujące uprawnienia do tabel zadań, producentów, opisów technicznych, promocji i alertów (bezpiecznie pomija tabele, których nie ma).',
    tag: 'nowość',
  },

  {
    date: '2026-10-16',
    title: 'Opisy produktów: edytor z formatowaniem, nowe pola i synchronizacja z BaseLinkerem',
    description:
      'Zakładka Opisy została przebudowana. Zamiast jednego pola tekstowego jest pięć sekcji: Opis pełny (tradycyjny), Opis krótki (do 300 znaków), Sposób użycia / dawkowanie, Skład / dane techniczne oraz Bezpieczeństwo i ostrzeżenia. Pola z formatowaniem mają edytor (pogrubienie, kursywa, nagłówek, listy punktowane i numerowane, linki, czyszczenie formatowania, podgląd kodu HTML), licznik znaków i ocenę (brak / za krótki / OK). Wklejany tekst jest automatycznie czyszczony ze zbędnych stylów. Pola odpowiadają polom tekstowym BaseLinkera (opis oraz dodatkowe opisy 1–4): przycisk „Pobierz z BaseLinkera” wczytuje opisy z produktu w BL do edytora (zapis dopiero po sprawdzeniu), a „Wyślij do BaseLinkera” wysyła niepuste opisy do produktu w BL, zachowując pozostałe jego pola. Opisy liczą się do kompletności produktu (krótki opis oraz sposób użycia / skład / bezpieczeństwo) w statystykach i Decyzjach. Naprawiono też poważny błąd: edycja produktu zapisywała opis uproszczony do zwykłego tekstu i obcięty do 500 znaków — teraz opis jest zapisywany tylko po zmianie i w całości z formatowaniem. Wymaga wdrożenia funkcji baselinker; wysyłka i pobieranie wymagają uprawnienia do zarządzania BaseLinkerem.',
    tag: 'nowość',
  },

  {
    date: '2026-10-16',
    title: 'Logo producenta także w głównym widoku produktu (nagłówek z zakładkami)',
    description:
      'Logo producenta było dodane tylko w starszym układzie podglądu, więc w głównym widoku produktu (nagłówek z SKU, stanem i zakładkami Dane / Sprzedaż / Zdjęcia) go nie było. Teraz logo jest w prawym górnym rogu nagłówka, obok przycisku edycji, a po kliknięciu otwiera stronę producenta, jeśli adres WWW jest podany w profilu.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-16',
    title: 'Podgląd produktu: logo producenta w prawym górnym rogu, klikalne do strony marki',
    description:
      'Jeśli producent produktu ma wgrane logo w sekcji Producenci, pojawia się ono w podglądzie produktu po prawej stronie nagłówka (obok nazwy). Gdy w profilu producenta podano adres strony WWW, logo jest klikalne i otwiera tę stronę w nowej karcie; bez adresu logo jest tylko widoczne.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-16',
    title: 'Producenci: naprawa zapisu profilu i usuwania logo oraz usuwanie producenta z przeniesieniem produktów',
    description:
      'Naprawiono błąd, przez który zapis profilu producenta (usunięcie lub zmiana logo, opis, kontakt) kończył się niepowodzeniem, gdy producent miał już wpis w rejestrze — baza odrzucała zapis z powodu brakującej nazwy. Dodatkowo producenta można teraz usunąć także wtedy, gdy ma produkty: przy usuwaniu wybierasz, do którego producenta mają trafić jego produkty (albo „bez producenta”), a stara marka znika z listy wyboru.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-16',
    title: 'Nowa sekcja „Producenci” w menu: profile marek z logo, opisem i zmianą nazwy',
    description:
      'W menu (Katalog → Producenci, także w menu mobilnym i zakładkach) jest osobny widok do pracy z markami. Po lewej lista wszystkich producentów z logo, liczbą produktów i oznaczeniami (WAPRO / ręczny / BaseLinker, brak logo lub opisu), wyszukiwarka i sortowanie (nazwa, liczba produktów, najmniej uzupełnieni). Po prawej profil wybranego producenta: wgrywanie i zmiana logo, opis marki, strona WWW, e-mail, telefon, notatki wewnętrzne, statystyki (produkty, odsetek zdjęć, brak EAN, stan magazynowy), przycisk „Pokaż produkty w katalogu” oraz zmiana nazwy, która poprawia producenta we wszystkich jego produktach (np. niedokładne nazwy z WAPRO). Można też dodać nowego producenta, usunąć nieużywanego, pobrać listę z BaseLinkera i wysłać tam brakujących. Przycisk „Producenci” w Decyzjach prowadzi teraz do tego widoku. Wymaga uruchomienia (ponownie) migracji migration-catalog-manufacturers.sql.',
    tag: 'nowość',
  },

  {
    date: '2026-10-16',
    title: 'Producenci: dodawanie nowych, lista wspólna i synchronizacja z BaseLinkerem',
    description:
      'Lista producentów nie jest już ograniczona do nazw z WAPRO. W edycji produktu i przy dodawaniu produktu na końcu listy producentów jest „+ Nowy producent…”, a nowa marka trafia do wspólnej listy dla wszystkich użytkowników. W Decyzjach jest nowy przycisk „Producenci”: lista wszystkich marek z liczbą produktów i oznaczeniem źródła (WAPRO / ręczny / BaseLinker), dodawanie nowych, „Pobierz z BaseLinkera” (import listy producentów z BL) oraz „Wyślij do BaseLinkera” (zaznaczonych albo wszystkich brakujących — brakujące marki są tworzone w BL, istniejących nie dublujemy). Dzięki temu produkty wysyłane do BaseLinkera dostają właściwego producenta. Wymaga migracji bazy migration-catalog-manufacturers.sql i wdrożenia funkcji baselinker; wysyłka i pobieranie z BL wymagają uprawnienia do zarządzania BaseLinkerem.',
    tag: 'nowość',
  },

  {
    date: '2026-10-16',
    title: 'Ukrywanie produktów: bezpieczny zapis w bazie dla wszystkich i automatyczne odświeżanie listy',
    description:
      'Ukrycie produktu (także masowe z Decyzji) zawsze zapisywało się w bazie, więc działa dla wszystkich użytkowników — ale inny komputer widział zmianę dopiero po przeładowaniu strony. Teraz katalog po powrocie do karty (po ponad 3 minutach) cicho pobiera aktualne dane z bazy. Dodatkowo ukrywanie i przywracanie zapisuje flagę do aktualnych danych produktu z bazy, a nie do skróconej wersji z listy, żeby przy masowym ukrywaniu nie zgubić innych pól meta produktu. Ukrycia i przywrócenia trafiają do dziennika aktywności.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-16',
    title: 'Edycja produktu: kategoria wybierana z pełnej listy',
    description:
      'Pole „Kategoria” w edycji produktu było polem z podpowiedziami, które pokazywało tylko pozycje pasujące do aktualnie wpisanej wartości (np. przy „Inne” nie dało się wybrać niczego innego). Teraz to normalna lista rozwijana ze wszystkimi kategoriami, a nową kategorię można dodać opcją „+ Nowa kategoria…”.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-16',
    title: 'Profil: naprawa danych liczy się do statystyk, XP i nowych odznak „Jakość danych”',
    description:
      'Do statystyk profilu dochodzą „Naprawione dane”: system rozpoznaje w dzienniku zmian, kiedy puste pole produktu zostało uzupełnione — EAN, opis, producent, cena sprzedaży, zdjęcie, a także ustawienie kategorii oraz schowanie zbędnych pozycji (porządki w Decyzjach). Za każde uzupełnienie jest bonus punktów (max 3 pkt na jeden zapis), a ukrywanie liczy się do statystyk i odznaki, ale nie daje bonusu XP. Siedem nowych odznak w czterech stopniach w grupie „Jakość danych”: Naprawiacz danych, Łowca EAN-ów, Autor opisów, Kategoryzator, Znawca producentów, Uzupełniacz cen i Sprzątacz katalogu. Liczone jest też wstecz z istniejącego dziennika. Operacje BaseLinkera nadal liczą się w odznace „Łącznik z BaseLinkerem”.',
    tag: 'nowość',
  },

  {
    date: '2026-10-16',
    title: 'Decyzje: nowy układ — lista na całą szerokość, panel filtrów i akcji z boku, stronicowanie',
    description:
      'Przebudowa sekcji Decyzje. Lista produktów zajmuje całą szerokość strony i pokazuje wszystkie pozycje (koniec limitu 200) ze stronicowaniem po 25/50/100/200. Z boku jest panel (przewija się razem ze stroną): wyszukiwarka (nazwa, SKU, EAN, producent), filtry rodzajów problemów z licznikami (zdjęcie, kategoria, producent, EAN, cena, kompletność, typ, BaseLinker), filtr producenta, stanu magazynowego i katalogu, sortowanie (pilność, nazwa, SKU, kompletność, stan), zaznaczanie strony lub wszystkich wyników, masowe ukrywanie z gotowymi powodami (np. Śmietnik Piotra, Część myjki) oraz masowe ustawianie kategorii. Przy każdym wierszu jest przycisk szybkiego „Ukryj”, a u góry eksport przefiltrowanej listy do CSV. Wiersze pokazują teraz producenta, stan, kompletność i wszystkie problemy.',
    tag: 'nowość',
  },

  {
    date: '2026-10-16',
    title: 'Decyzje: masowe ukrywanie „śmietnika” z gotowymi powodami (np. Śmietnik Piotra)',
    description:
      'W sekcji Decyzje można teraz zaznaczyć dowolne produkty z listy (pojedynczo albo „Zaznacz wszystko na liście”) i ukryć je jednym kliknięciem z opisem powodu. Gotowe powody: Śmietnik Piotra, Część myjki, Obudowa, Koło wentylatora, Element maszyny, Uszczelka/o-ring, Śruba/złączka, Stara marka, Produkt przestarzały, Nie sprzedajemy, Duplikat — albo własny opis. Dodano też wyszukiwarkę na liście (np. „myjka”, „obudowa”), żeby szybko wyłuskać całe grupy części. Ukryte pozycje zostają w bazie i synchronizacji, widać je w „Ukryte” i można przywrócić. Te same gotowe powody są podpowiedziane w karcie produktu przy opcji „Ukryj w katalogu”.',
    tag: 'nowość',
  },

  {
    date: '2026-10-16',
    title: 'Numeracja wersji wg wielkości zmiany (poprawka → patch, nowość → minor, przebudowa → major)',
    description:
      'Zmiana zasady numeracji: wersja nie rośnie już automatycznie z każdym dniem, tylko zależy od wielkości zmiany. Mała poprawka lub drobna zmiana podnosi ostatnią liczbę (PATCH), nowa funkcja lub większa zmiana — środkową (MINOR, a ostatnia wraca do 0), a duża przebudowa — pierwszą (MAJOR). Domyślny rozmiar wynika z tagu wpisu (poprawka i wydajność → patch, nowość → minor), a w dzienniku można go nadpisać polem rozmiaru (np. duża przebudowa → major). Dotychczasowe wersje zostają bez zmian, a nowa numeracja startuje od ostatniej z nich (1.13.20). Każdy wpis w Aktualizacjach ma swój numer wersji.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-15',
    title: 'Numeracja wersji: numer wpisu w ciągu dnia jako PATCH (np. 1.13.20)',
    description:
      'Zmiana numeracji aktualizacji. Dotąd ostatnia liczba wersji prawie zawsze wynosiła 0, a każdy dzień podnosił środkową. Teraz każdy nowy dzień zmian to kolejna wersja 1.x (jak dotąd), a ostatnia liczba to numer wpisu w tym dniu: najstarszy wpis dnia ma .1, kolejne .2, .3 itd. Wersja aplikacji w menu to najnowszy wpis (np. 1.13.20), nagłówek dnia pokazuje wersję jego ostatniego wpisu, a każdy wpis w Aktualizacjach ma własny numer, więc można się do niego odwołać (np. „poprawione w 1.13.7”). Numer liczy się sam z dziennika zmian, bez ręcznego wpisywania.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-15',
    title: 'Suite: nowa aplikacja „Marketing” (szablon, w budowie)',
    description:
      'Do Suite doszła nowa aplikacja Kenochem Marketing pod adresem kenochem-marketing.web.app — osobna aplikacja (PWA) jak Katalog, Handel czy Magazyn, z własną ikoną (megafon z falami dźwięku i iskrą), manifestem, kafelkiem w launcherze Suite i tym samym logowaniem. Na razie widoczna tylko dla administratorów i jest szablonem: ekran powitalny z planem modułów (asystent AI na stronie, leady i zgody, wiadomości i remarketing, popupy i widżety, wtyczka do sklepu, analityka) w etapach oraz listą zasad zgodności (zgody, informowanie, że to AI, wypisanie, limity kosztów). Kolejne etapy dopiszemy po ustaleniu priorytetów.',
    tag: 'nowość',
  },

  {
    date: '2026-10-15',
    title: 'Kontrast w jasnym motywie: czytelny kolorowy tekst w całym katalogu',
    description:
      'Naprawa nieczytelnego tekstu w jasnym i ciasteczkowym motywie. Klasy kolorów pisane pod ciemne tło (jasne żółcie, bursztyny, zielenie, błękity, czerwienie, fiolety — odcienie 100–400) były na jasnym tle prawie niewidoczne; teraz w jasnych motywach automatycznie dostają ciemniejsze odpowiedniki w całej aplikacji, a w ciemnych niczego nie zmieniają. Dotyczy m.in. linii „Nowe w tym tygodniu” w profilu, ostrzeżeń, komunikatów statusu i plakietek. W profilu nazwy stopni odznak (brąz/srebro/złoto/diament) i rang mają osobne ciemniejsze kolory na jasnym tle, a na ciemnych tłach nagłówka (zmierzch, zorza, kosmos itd.) tekst jest zawsze jasny — wcześniej nazwa użytkownika była ciemna na ciemnym. Tekst na kolorowych plakietkach (poziom, ranga, „TY”) jest stale ciemny, niezależnie od motywu.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-15',
    title: 'Zestawy: synchronizacja z BaseLinkerem nie liczy się jako praca do punktów i odznak',
    description:
      'Zapisy zestawów wykonywane przez „Porównaj skład z BaseLinkerem” są teraz oznaczane osobno („Synchronizacja zestawu z BaseLinkerem”) i nie dają punktów pracy ani postępu w odznace Zestawowicz — tak jak ręczne tworzenie zestawów. Wcześniej jedna synchronizacja potrafiła zdobyć kilkaset punktów i wszystkie stopnie odznaki. Wcześniejsze wpisy w dzienniku aktywności są niezmienne i nadal się liczą.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-15',
    title: 'Zestawy: konfigurator zestawu (wybór produktów po lewej, zestaw na żywo po prawej)',
    description:
      'Nowy konfigurator zestawu zastępuje stary formularz. Po lewej przeglądarka produktów: wyszukiwanie (nazwa, SKU, EAN, gwint, skaner kodów), filtr kategorii, „Tylko dostępne” i „Tylko z BaseLinkera”; bez wpisanej frazy pokazuje najlepiej sprzedające się produkty. Każdy produkt ma zdjęcie, cenę (zieloną), stan i ostrzeżenie „brak w BaseLinkerze”; klik dodaje produkt, a potem pojawia się stepper ilości. Po prawej zestaw na żywo: zdjęcie (aparat lub plik), nazwa, kategoria, opis, lista składników ze zdjęciami, ceną za sztukę i zmianą ilości, a na dole wartość składników brutto, ile kompletów da się złożyć teraz oraz informacja, czy wszystkie składniki są w BaseLinkerze (wtedy zestaw można wysłać do BL). Na telefonie dwie zakładki: Produkty i Zestaw. Kod katalogowy zestawu jest widoczny od razu.',
    tag: 'nowość',
  },
  {
    date: '2026-10-15',
    title: 'Zestawy: wyszukiwarka widoczna, zmiana widoku siatki, zielone ceny i cena jednostkowa składnika',
    description:
      'Poprawki widoku Zestawy: pole wyszukiwania było ściśnięte przez listę sortowania i nic nie było widać — teraz zajmuje całą szerokość. Dodany przełącznik widoku jak w głównym katalogu: duże kafelki, średnie, małe oraz lista (zapamiętywany w przeglądarce). Ceny są zielone, a w szczegółach zestawu przy każdym składniku widać cenę jednostkową (za sztukę). Zestaw wysłany do BaseLinkera pojawia się na obu listach: w „BaseLinker” jako aktywny i w „Własne” z niebieską etykietą „Także w Base”.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-15',
    title: 'Zestawy: własne zestawy z eksportem do BaseLinkera (bundle)',
    description:
      'Własny zestaw (Zestawy → „Własne / techniczne” → „Nowy zestaw”) można teraz wysłać do BaseLinkera: w szczegółach zestawu przycisk „Wyślij do BaseLinkera” tworzy w BL produkt-zestaw (bundle) ze składnikami i ilościami, z SKU równym kodowi katalogowemu zestawu, nazwą, opisem, zdjęciem i ceną (suma cen składników brutto, do zmiany w BL). Składniki muszą być powiązane z BaseLinkerem (znaczniki B/W), a SKU nie może już istnieć w BL — w przeciwnym razie eksport jest blokowany z czytelnym komunikatem. Po eksporcie zestaw dostaje niebieską plakietkę „Base · aktywny” i zapamiętane id z BaseLinkera (wtedy porównanie składu obejmuje też takie zestawy). Dla zestawów z BaseLinkera jest przycisk „Powiel jako własny”, który robi edytowalną kopię. Wymaga wdrożenia funkcji baselinker.',
    tag: 'nowość',
  },
  {
    date: '2026-10-15',
    title: 'Zestawy: kody katalogowe (ZST-0001…)',
    description:
      'Każdy zestaw ma kod katalogowy w formacie ZST-0001, widoczny na kafelku i w szczegółach (kliknięcie kopiuje kod). Nowe zestawy dostają kolejny kod automatycznie, a dla istniejących jest przycisk „Nadaj kody (N)”, który numeruje je od najstarszego. Kod jest szukalny, służy do wskazywania zestawów (np. w promocjach) i jest SKU zestawu po wysłaniu do BaseLinkera. Zestawy zaimportowane z BL zapamiętują też id produktu w BL. Wymaga migracji migration-kits-code-meta.sql (bez niej zestawy zapisują się jak dotąd, tylko bez kodu).',
    tag: 'nowość',
  },
  {
    date: '2026-10-15',
    title: 'Zestawy: nowy wygląd, wyszukiwarka, zmiana zdjęcia głównego i niebieska etykieta Base',
    description:
      'Widok Zestawy przebudowany: siatka kafelków z dużym zdjęciem (gdy zestaw nie ma własnego, pokazujemy mozaikę zdjęć składników), kodem, nazwą, liczbą składników, dostępnością („do złożenia: N” albo „brak składnika”) i wartością składników. Na górze wyszukiwarka zestawów po nazwie, kodzie, kategorii, SKU i nazwach składników (z polskimi znakami i dowolną kolejnością słów) oraz sortowanie: nazwa, kod, najnowsze, dostępność. Kliknięcie kafelka otwiera szczegóły: duże zdjęcie z przyciskiem „Zmień zdjęcie główne” (także dla zestawów z BaseLinkera), pełna lista składników ze zdjęciami, ilościami, cenami i stanem każdego składnika oraz akcje (do zamówienia, edycja, powielenie, eksport, usunięcie). Etykieta „Base” jest teraz niebieska i oznacza zestaw aktywny w BaseLinkerze („Base · aktywny”); szara „nieaktywny” pojawia się, gdy porównanie wykaże, że zestawu nie ma już w BL.',
    tag: 'nowość',
  },

  {
    date: '2026-10-15',
    title: 'Zestawy: prawdziwy skład z BaseLinkera i dostępność zestawu',
    description:
      'Zestawy z BaseLinkera były dotąd importowane z pliku CSV, a ich skład zgadywany z opisów i zapachów — stąd pomieszane pozycje. Teraz w „Zestawy → BaseLinker” jest przycisk „Porównaj skład z BaseLinkerem”: katalog pobiera z API BaseLinkera zestawy (bundle) razem z rzeczywistym składem (SKU i ilości), mapuje składniki na produkty katalogu i pokazuje, co jest nowe, co się różni (dodać / usunąć / zmienić ilość), co jest zgodne oraz co jest problemem (zestaw bez składu w BL, zestaw usunięty z BL, składnik spoza katalogu). Zaznaczone pozycje można zapisać jednym kliknięciem — zmienia się tylko skład, nazwy, opisy i zdjęcia zestawów zostają. Dodatkowo każdy zestaw pokazuje „do złożenia: N” (ile kompletów da się złożyć z dostępnych sztuk składników po odjęciu rezerwacji) albo który składnik jest niedostępny. Wymaga wdrożenia funkcji baselinker.',
    tag: 'nowość',
  },

  {
    date: '2026-10-15',
    title: 'Testy automatyczne (61) i poprawka wyszukiwarki znaleziona przez testy',
    description:
      'W projekcie są pierwsze testy automatyczne (Vitest): 61 testów kluczowej logiki — parser nazw technicznych na prawdziwych nazwach z WAPRO (gwinty, nypel/trójnik/dysza/zawór/o-ring, ostrzeżenia o literówkach), wyszukiwarka (pełne wyniki, wiele słów, polskie znaki, warianty, odmiana), poziomy, rangi, punkty, serie i odznaki, cele zespołu, kosmetyka profilu, marże i ceny, etykiety (opakowanie, cena za 1 l / 1 kg, skracanie nazwy) oraz budowa zamówienia do WAPRO. Uruchamiane poleceniem npm test (npm run check = typy + testy), automatycznie przed każdym wdrożeniem katalogu, magazynu i CRM oraz na GitHubie po każdym wypchnięciu zmian. Już pierwszy przebieg wykrył błąd w nowej wyszukiwarce: wiele słów było dzielonych po literze „s” zamiast po spacji, przez co niektóre frazy wielowyrazowe (np. „woskiem szampon”) nie znajdowały produktów — poprawione i zabezpieczone testem.',
    tag: 'poprawka',
  },

  {
    date: '2026-10-15',
    title: 'Wydajność: lżejsze odświeżanie opisów technicznych i szybsze otwieranie profilu',
    description:
      'Odświeżanie opisów technicznych w tle (co 5 minut) nie przebudowuje już indeksu wyszukiwarki, gdy nic się nie zmieniło — wcześniej każde sondowanie unieważniało indeks i następne wyszukiwanie liczyło go od nowa. W „Mój profil” cięższe obliczenia (daty zdobycia odznak) wykonują się po wyświetleniu strony, więc profil otwiera się płynnie nawet przy dużej historii aktywności.',
    tag: 'wydajność',
  },

  {
    date: '2026-10-15',
    title: 'Ranking pracowników w profilu',
    description:
      'Nowa zakładka „Ranking” w „Mój profil”: tabela zespołu z punktami pracy w katalogu za wybrany okres (ten tydzień od poniedziałku, ten miesiąc, cały czas) — miejsce z medalami dla pierwszej trójki, avatar z ramką, nazwa, poziom i ranga, motto, pasek względem lidera, liczba punktów i działań; Twój wiersz jest wyróżniony i widać Twoje miejsce. Punkty liczone są z dziennika aktywności po stronie serwera, a w Ustawieniach można włączyć „Ukryj mnie w rankingu zespołu”. Wymaga migracji migration-catalog-leaderboard.sql.',
    tag: 'nowość',
  },
  {
    date: '2026-10-15',
    title: 'Poziomy 1–120 w rangach i nagrody: ramki, animowane tła i nakładki profilu',
    description:
      'Nowy system poziomów: 120 poziomów w sześciu rangach po 20 poziomów — Świeżak (1–20), Stażysta (21–40), Specjalista (41–60), Ekspert (61–80), Mistrz katalogu (81–100) i Legenda Kenochem (101–120). Awans jest rozłożony w czasie: poziom 20 to ok. 4,3 tys. punktów pracy, 40 — 15 tys., 60 — 31 tys., 100 — 78 tys.; za operacje zbiorcze (np. zatwierdzenie wielu opisów jednym kliknięciem) liczy się maks. 25 punktów, żeby awansować mogła tylko regularna praca. Poziomy odblokowują kosmetykę profilu: 13 ramek avatara (od klasycznej, przez brąz, srebro i złoto, po neon, tęczę, płomień i diament — część animowana), 12 teł nagłówka (grafit, zmierzch, siatka techniczna, fale, zorza, kosmos, neonowe miasto, złoty blask i tło Legendy) oraz 7 nakładek (iskierki, bąbelki, śnieg, konfetti, żar, świetliki). Część nagród odblokowują osiągnięcia, np. ramka „Klisza” i tło „Taśma filmowa” za Fotografa, „Zębatka” i „Układ scalony” za Porządkowicza grup, „Żar” za Wytrwałego. Nowa zakładka „Poziomy i nagrody” pokazuje poziom, rangi i podgląd wszystkich nagród z wymaganiami; wybrany wygląd widać w nagłówku profilu i w rankingu. Za awans na kolejny poziom przychodzi powiadomienie z informacją o nowych nagrodach. Animacje wyłączają się przy ustawieniu systemu „ogranicz ruch”.',
    tag: 'nowość',
  },

  {
    date: '2026-10-15',
    title: 'Mój profil: podsumowanie tygodnia i powiadomienia (zadania, odznaki, tydzień)',
    description:
      'W zakładce „Statystyki” jest karta „Podsumowanie tygodnia”: liczba działań w tym tygodniu na tle poprzedniego, dni aktywności, najintensywniejsza kategoria pracy, wykonane zadania i nowe odznaki zdobyte w tym tygodniu — z przyciskiem „Kopiuj”, żeby wkleić podsumowanie np. w czacie. W centrum powiadomień (dzwonek) pojawiają się teraz: nowe zadanie przydzielone Tobie przez kogoś innego (sprawdzane co 5 minut), zdobyta odznaka lub nowy stopień oraz podsumowanie poprzedniego tygodnia.',
    tag: 'nowość',
  },
  {
    date: '2026-10-15',
    title: 'Mój profil: „Moja kolejka” — zadania przydzielane osobom',
    description:
      'Nowa zakładka „Moja kolejka”. Lista zadań przydzielonych Tobie (uzupełnij zdjęcie, zatwierdź opis techniczny, sprawdź dane, inne) z przyciskiem „Zrobione”, przejściem do produktu i informacją, od kogo jest zadanie. Zadania można przydzielać innym osobom albo sobie (rodzaj, dla kogo, kod produktu z podpowiedzią nazwy, notatka); osoba, której przydzielono zadanie, dostaje powiadomienie. Zadania „uzupełnij zdjęcie” i „zatwierdź opis” zamykają się same, gdy zdjęcie zostanie dodane albo opis zatwierdzony. Sekcja „Podpowiedzi” pokazuje produkty bez zdjęcia od najlepiej sprzedających się z przyciskiem „Biorę to” oraz liczbę pewnych propozycji opisów technicznych do zatwierdzenia. Wykonane zadania liczą się do punktów i odznaki „Solidny wykonawca”. Wymaga migracji migration-catalog-tasks.sql.',
    tag: 'nowość',
  },
  {
    date: '2026-10-15',
    title: 'Odznaki i osiągnięcia: nowy model i wygląd (4 stopnie, medale, cele zespołu)',
    description:
      'Przebudowany system osiągnięć. 15 odznak w 7 kategoriach (zdjęcia, dane produktów, porządek techniczny, magazyn i ceny, integracje, rytm pracy, zadania) w czterech stopniach: brąz, srebro, złoto i diament. Każda odznaka to medal z sześciokątną tarczą, ikoną i gwiazdkami stopnia (złoto i diament lśnią), w kolorze stopnia; nie zdobyte są przygaszone. Kliknięcie otwiera szczegóły: opis, progi wszystkich stopni z datami zdobycia i postęp; odznaki można przypinać do „gabloty” w nagłówku profilu (do 3). Za zdobycie nowego stopnia pojawia się okno gratulacji z konfetti. Nowe odznaki: Nowy asortyment, Tygodniowy maraton i Solidny wykonawca. Dodatkowo „Cele zespołu” — wspólne osiągnięcia za kompletność katalogu: Katalog ze zdjęciami, Opisy techniczne zatwierdzone oraz osobne cele dla każdej grupy technicznej („Nyple ze zdjęciem”, „Zawory ze zdjęciem” itd.) z progami 50 / 75 / 90 / 100% (brąz, srebro, złoto, diament) i listą brakujących produktów po kliknięciu.',
    tag: 'nowość',
  },
  {
    date: '2026-10-15',
    title: 'Menu profilu: przycisk „Mój profil”',
    description: 'W menu profilu przycisk prowadzący do statystyk, odznak i ustawień nazywa się teraz po prostu „Mój profil”.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-15',
    title: 'Mój profil: statystyki pracy, odznaki, poziomy i personalizacja',
    description:
      'Nowy widok „Mój profil” (menu profilu w prawym górnym rogu → „Mój profil, statystyki i odznaki”, także w Ctrl+K). Nagłówek z avatarem, nazwą, własnym mottem, kolorem akcentu i poziomem: za każdą wykonaną pracę w katalogu (edycje produktów, stany, ceny, zdjęcia, zestawy, BaseLinker, zatwierdzone opisy techniczne, zoptymalizowane zdjęcia) dostajesz punkty i awansujesz od Nowicjusza do Legendy Kenochem. Zakładka „Statystyki”: praca z ostatnich 7 i 30 dni, dni aktywności, bieżąca i najdłuższa seria dni roboczych (weekend jej nie przerywa), siatka aktywności z 16 tygodni i podział pracy na kategorie. Zakładka „Odznaki”: 12 odznak w trzech stopniach (brąz, srebro, złoto) z paskiem postępu, m.in. Redaktor katalogu, Fotograf, Magazynier, Porządkowicz grup, Lekka waga, Wytrwały, Ranny ptaszek i Nocny marek. Zakładka „Ustawienia”: motto, kolor akcentu, widok otwierany po wejściu, gęstość siatki produktów, motyw i przywrócenie układu menu. Statystyki liczone są z dziennika aktywności — każdy widzi tylko własne wpisy. Wymaga migracji migration-audit-log-self-read.sql.',
    tag: 'nowość',
  },
  {
    date: '2026-10-15',
    title: 'Grupy produktów: gwinty bez znaczka cali (3/8 M, 1/4 Ż)',
    description:
      'Nazwy katalogowe i filtry gwintów w Grupach produktów nie używają już znaczka cali — zamiast „3/8″ M × 1/4″ Ż” jest „3/8 M × 1/4 Ż”, krócej i czytelniej. Dotyczy też już zatwierdzonych opisów (wyświetlane są w nowej postaci) oraz filtrów „Końcówka 1/2” i edytora.',
    tag: 'poprawka',
  },
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
