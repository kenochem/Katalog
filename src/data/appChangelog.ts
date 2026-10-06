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
