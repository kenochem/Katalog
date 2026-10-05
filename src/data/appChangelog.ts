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
