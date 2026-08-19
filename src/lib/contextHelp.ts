export interface ContextHelpItem {
  id: string;
  title: string;
  body: string;
  guideArticleId?: string;
}

export const CONTEXT_HELP: Record<string, ContextHelpItem> = {
  suite: {
    id: 'suite',
    title: 'Kenochem Suite',
    body: 'Glowny pulpit pracy. Zbiera aplikacje Kenochem w jednym miejscu i pozwala przechodzic miedzy nimi bez ponownego logowania.',
    guideArticleId: 'suite-purpose',
  },
  guide: {
    id: 'guide',
    title: 'Baza wiedzy',
    body: 'Instrukcje, definicje i standardy pracy. Ma tlumaczyc nie tylko co robi przycisk, ale kiedy warto go uzyc i na jakie dane uwazac.',
    guideArticleId: 'help-context',
  },
  catalog: {
    id: 'catalog',
    title: 'Katalog',
    body: 'Baza produktow, SKU, EAN, zdjec, stanow i opisow. W CRM katalog powinien byc uzywany glownie przy tworzeniu oferty lub zamowienia.',
    guideArticleId: 'catalog-purpose',
  },
  refreshCatalog: {
    id: 'refreshCatalog',
    title: 'Odswiez katalog',
    body: 'Przeladowuje aktualna liste produktow z Supabase. Uzywaj po zmianach danych lub gdy widzisz stare stany w aplikacji.',
    guideArticleId: 'catalog-sync',
  },
  waproSync: {
    id: 'waproSync',
    title: 'Sync WAPRO',
    body: 'Zleca pobranie stanow i cen z WAPRO. To nie jest zwykle odswiezenie widoku, tylko proces synchronizacji danych z systemu magazynowo-ksiegowego.',
    guideArticleId: 'catalog-sync',
  },
  catalogSearch: {
    id: 'catalogSearch',
    title: 'Wyszukiwarka',
    body: 'Szukaj po SKU, EAN, nazwie, producencie i tagach (min. 2 znaki). Na desktopie wyniki od razu w siatce; na telefonie waski dropdown po prawej. Szary X czysci zapytanie. Ctrl+K fokusuje pole.',
    guideArticleId: 'catalog-search',
  },
  catalogFilters: {
    id: 'catalogFilters',
    title: 'Filtry katalogu',
    body: 'Katalog (Akcesoria/Produkty), kategoria, producent, stan, zdjecie, jakosc opisu, BaseLinker, braki WAPRO Mag. Sort domyslny: kategoria+nazwa; przy wyszukiwaniu — trafnosc.',
    guideArticleId: 'catalog-filters',
  },
  catalogBaselinkerTag: {
    id: 'catalogBaselinkerTag',
    title: 'Znacznik B',
    body: 'Niebieski B = SKU znalezione w aktualnym eksporcie BaseLinker. Sam katalog shop albo stare reczne pole nie wystarcza, zeby nie oznaczac produktow blednie.',
    guideArticleId: 'catalog-dual',
  },
  catalogGrid: {
    id: 'catalogGrid',
    title: 'Siatka produktow',
    body: 'Kafelki z SKU, stanem, zdjeciem i znacznikami. Gestosc (male/srednie/duze) zapisuje sie w profilu. Tryb edycji pozwala szybko zmieniac stany +/-.',
    guideArticleId: 'catalog-badges-actions',
  },
  crm: {
    id: 'crm',
    title: 'CRM',
    body: 'Centrum pracy handlowca: klient, lejek, oferta, zamowienie, trasa i historia kontaktu. Dane z CRM pozniej zasilaja operacje i rozliczenia.',
    guideArticleId: 'crm-purpose',
  },
  crmOrder: {
    id: 'crmOrder',
    title: 'Zamowienie CRM',
    body: 'Wybierz klienta, dodaj produkty z katalogu i zapisz oferte lub zamowienie. Docelowo status ma wracac z WAPRO/BaseLinker.',
    guideArticleId: 'crm-orders',
  },
  crmPipeline: {
    id: 'crmPipeline',
    title: 'Lejek sprzedazy',
    body: 'Porzadkuje szanse sprzedazy od pierwszego kontaktu do wygranej albo przegranej. Pomaga widziec, co wymaga reakcji handlowca.',
    guideArticleId: 'crm-purpose',
  },
  crmRoutes: {
    id: 'crmRoutes',
    title: 'Trasy i wizyty',
    body: 'Plan pracy handlowca w terenie: klienci w rejonie, wizyty, notatki i zamowienia tworzone na miejscu.',
    guideArticleId: 'crm-visits',
  },
  ops: {
    id: 'ops',
    title: 'Operacje',
    body: 'Centrum finansow i danych: marze, koszty, cashflow, faktury, raporty, marketplace i rozliczenia handlowcow.',
    guideArticleId: 'ops-purpose',
  },
  statBuilder: {
    id: 'statBuilder',
    title: 'Kreator statystyk',
    body: 'Pozwala budowac wlasne wykresy i KPI z danych firmy. Ma zastepowac reczne arkusze, ale z lepsza kontrola i zapisem widokow.',
    guideArticleId: 'ops-data-boards',
  },
  dataInbox: {
    id: 'dataInbox',
    title: 'Dostawa danych',
    body: 'Miejsce na raporty CSV/XLSX z banku, WAPRO, marketplace, handlowcow i ecommerce. Kazdy import powinien miec zrodlo, date i status.',
    guideArticleId: 'ops-data-boards',
  },
  analyticsLab: {
    id: 'analyticsLab',
    title: 'Laboratorium danych',
    body: 'Zaawansowane wykresy i obliczenia: korelacje, trendy, tabela analityczna i kontrola jakosci danych przed decyzja.',
    guideArticleId: 'ops-data-boards',
  },
  opsProductSales: {
    id: 'opsProductSales',
    title: 'Rankingi Mag WAPRO',
    body: 'Dane z cache synchronizowanego zbiorczo z Mag. Szt. i suma netto = suma ze znakiem (korekty faktur ze ujemna iloscia odejmuja od wyniku). Zysk = suma netto minus (cena zakupu x szt.). Koszyk SKU pozwala porownac kilka produktow i zobaczyc laczna sume grupy.',
    guideArticleId: 'ops-product-sales',
  },
  opsProductSalesSummary: {
    id: 'opsProductSalesSummary',
    title: 'Podsumowanie okresu',
    body: 'Liczby dla aktualnych filtrow: ile pozycji, ile ze sprzedaza, laczna liczba sztuk, obrót netto i szacowany zysk. Sync Mag pokazuje date ostatniej synchronizacji z serwera WAPRO.',
  },
  opsProductSalesPresets: {
    id: 'opsProductSalesPresets',
    title: 'Presety rankingu',
    body: 'Szybkie sortowanie i filtry jednym klikiem. Np. najwieksza suma netto sortuje po obrocie PLN, najbardziej oplacalne po zysku (netto minus koszt zakupu x szt.).',
  },
  opsProductSalesFilters: {
    id: 'opsProductSalesFilters',
    title: 'Filtry',
    body: 'Zawężaj ranking po okresie, katalogu, kategorii, producencie i progach sztuk/netto/stanu. Checkbox ukrywa usługi (wysyłka). Wykluczenia z sum: koszyk SKU (przycisk Wyklucz), kwiatki/rozpis w nazwie, tag sales-exclude-sum lub meta w katalogu — nie wchodzą w KPI ani wykres, ale mogą zostać w tabeli.',
  },
  opsProductSalesChart: {
    id: 'opsProductSalesChart',
    title: 'Wykres',
    body: 'Top 10 z filtrow albo wszystkie pozycje z koszyka SKU. Przy koszyku 2+ SKU pojawia sie slupek Σ z laczna suma. Metryka: suma netto (ze znakami) lub sztuki. Typ: poziome / pionowe slupki albo kolko udzialow.',
  },
  opsProductSalesBasket: {
    id: 'opsProductSalesBasket',
    title: 'Koszyk SKU',
    body: 'Wpisz kilka SKU oddzielonych przecinkiem, spacją lub Enter — przycisk Dodaj zbiera je do koszyka. Tabela i wykres pokażą tylko te produkty oraz łączną sumę sztuk i netto. Przydatne do grup produktów bez etykiet (np. ten sam typ, różne SKU) albo porównań zależności.',
  },
  opsProductSalesInsights: {
    id: 'opsProductSalesInsights',
    title: 'Analiza zaawansowana',
    body: 'Trend miesięczny, porównanie z poprzednimi 12 m, ranking kategorii/producentów, klasy ABC/XYZ i filtry. Wymaga rozszerzonego sync Mag (schema v2).',
  },
  opsProductSalesTrend: {
    id: 'opsProductSalesTrend',
    title: 'Trend miesięczny',
    body: 'Wykres linii: suma sztuk lub netto w każdym z 12 ostatnich miesięcy kalendarzowych. Bez koszyka — wszystkie produkty po filtrach. Z koszykiem — tylko wybrane SKU (suma grupy). Wymaga sync Mag schema v2 (pole monthly w cache). Metrykę (szt./netto) ustawiasz przyciskami nad wykresem Top 10.',
  },
  opsProductSalesYoY: {
    id: 'opsProductSalesYoY',
    title: 'Porównanie okresów',
    body: 'Ostatnie 12 m vs poprzednie 12 m (rolling). Dostępne gdy okres analizy = 12 miesięcy.',
  },
  opsProductSalesDimension: {
    id: 'opsProductSalesDimension',
    title: 'Ranking kategorii / producentów',
    body: 'Agregacja sprzedaży z aktualnych filtrów — widok całej linii produktowej.',
  },
  opsProductSalesAbcXyz: {
    id: 'opsProductSalesAbcXyz',
    title: 'ABC / XYZ',
    body: 'ABC: udział w obrocie (A ≈ pierwsze 80% sumy). XYZ: stabilność popytu (X = regularny, Z = skokowy). Filtry wpływają na tabelę i eksport.',
  },
  opsProductSalesTable: {
    id: 'opsProductSalesTable',
    title: 'Tabela produktow',
    body: 'Pelny ranking z sortowaniem po kolumnach — wszystkie wiersze po filtrach, stronicowanie (domyslnie 50 na strone). Szt. i netto uwzgledniaja korekty faktur. Wykluczone z sum maja etykiete wykl. i nie wchodza w podsumowanie. Eksport CSV — caly przefiltrowany widok.',
  },
  opsProductSalesExport: {
    id: 'opsProductSalesExport',
    title: 'Eksport CSV',
    body: 'Pobiera plik CSV z calego aktualnego widoku: wszystkie wiersze po filtrach i sortowaniu, nie tylko widoczne na ekranie. Odswiez z Mag tylko synchronizuje dane z WAPRO — nie eksportuje pliku.',
  },
  opsProductSalesMagSync: {
    id: 'opsProductSalesMagSync',
    title: 'Odswiez z Mag',
    body: 'Zleca zbiorczy sync sprzedazy na serwerze Mag WAPRO (kilka minut). Aktualizuje cache w Supabase. To nie jest eksport — uzyj CSV, zeby pobrac tabelę.',
  },
  opsSonax: {
    id: 'opsSonax',
    title: 'Raport Sonax',
    body: 'Pokazuje, ile obrotu od marca 2026 pochodzi od klientow, ktorzy kupowali wczesniej u Sonax (Subiekt), a nie mieli faktur u Kenochem przed przejeciem. To KPI przejecia marki — nie cala sprzedaz firmy.',
  },
  opsSonaxViewMode: {
    id: 'opsSonaxViewMode',
    title: 'Tryb widoku sumy',
    body: 'Standard — tylko „czysty Sonax” (bez overlap). Z mieszanymi — dodaje wszystkich, ktorzy handlowali i z Kenochem, i z Sonax. Wlasny wybor — zaznaczasz pojedynczych klientow z listy wykluczonych; zapis jest w tej przegladarce.',
  },
  opsSonaxKpiNet: {
    id: 'opsSonaxKpiNet',
    title: 'Obrot netto',
    body: 'Suma netto z faktur WAPRO Kenochem od 01.03.2026 dla klientow wlaczonych w aktualny tryb widoku. Korekty i zwroty sa juz w danych z Mag.',
  },
  opsSonaxKpiClients: {
    id: 'opsSonaxKpiClients',
    title: 'Liczba klientow',
    body: 'Ilosc kontrahentow z historia Sonax (Subiekt), ktorzy maja u nas faktury od marca — plus ewentualnie zaznaczeni mieszani, jesli zmieniles tryb widoku.',
  },
  opsSonaxKpiOverlap: {
    id: 'opsSonaxKpiOverlap',
    title: 'Wykluczeni (overlap)',
    body: 'Klienci z historia Sonax, ktorzy mieli juz faktury u Kenochem przed marcem 2026 (np. kupowali u obu firm). Domyslnie nie wchodza w KPI przejecia — mozesz ich dodac w trybie widoku.',
  },
  opsSonaxKpiContext: {
    id: 'opsSonaxKpiContext',
    title: 'Cale WAPRO',
    body: 'Laczny obrot netto wszystkich klientow Kenochem od marca — punkt odniesienia, ile procent calej sprzedazy stanowi wybrany widok Sonax.',
  },
  opsSonaxExcluded: {
    id: 'opsSonaxExcluded',
    title: 'Lista wykluczonych',
    body: 'Kontrahenci rozpoznani po NIP/nazwie: mieli Subiekt Sonax i WAPRO od marca, ale tez FV Kenochem przed przejeciem. Zaznacz checkbox „w sumie”, zeby dolaczyc ich w trybie wlasnym.',
  },
  opsSonaxInvoices: {
    id: 'opsSonaxInvoices',
    title: 'Faktury',
    body: 'Wszystkie dokumenty WAPRO od marca dla klientow z aktualnego widoku. Kliknij klienta na liscie, aby przefiltrowac. Eksport CSV pobiera caly przefiltrowany widok.',
  },
  opsSonaxChart: {
    id: 'opsSonaxChart',
    title: 'Wykres miesieczny',
    body: 'Slupki = suma netto faktur w danym miesiacu dla klientow wlaczonych w tryb widoku. Zmiana trybu przelicza wykres od razu.',
  },
  opsSonaxMethodology: {
    id: 'opsSonaxMethodology',
    title: 'Porownanie metod liczenia',
    body: 'Standard (~104 tys.) to czysty Sonax bez overlap. Dodanie 2 najwiekszych mieszanych (MPO + Studio Piel.) daje ~197 tys. — blisko recznego liczenia z biura (~200 tys.). Caly overlap to ~561 tys. Historia Subiekt (przed marcem) to inna metryka — nie sumuj z WAPRO. Faza 2 (tylko towary Sonax na pozycjach FV) nie jest jeszcze wdrozona.',
  },
  cashflow: {
    id: 'cashflow',
    title: 'Cashflow',
    body: 'Pokazuje przeplywy pieniezne: co wplywa, co wychodzi, co jest po terminie i czy firma ma bezpieczna plynnosc.',
    guideArticleId: 'ops-sales-channels',
  },
  warehouse: {
    id: 'warehouse',
    title: 'Magazyn',
    body: 'Stany, etykiety, lokalizacje SKU, kompletacja i porzadek na hali. Ten modul ma byc osobny od zwyklego katalogu.',
    guideArticleId: 'warehouse-purpose',
  },
  warehouseMap: {
    id: 'warehouseMap',
    title: 'Mapa magazynu',
    body: 'Plan regalu, alejek i stref. Docelowo po wybraniu produktu aplikacja pokaze, gdzie fizycznie go szukac.',
    guideArticleId: 'warehouse-locations',
  },
  warehouseIso: {
    id: 'warehouseIso',
    title: 'Mapa 2.5D',
    body: 'Izometryczny podglad hali. Pomaga szybko zrozumiec uklad magazynu, ale zrodlem prawdy pozostaje edytor planu i przypisane lokalizacje.',
    guideArticleId: 'warehouse-locations',
  },
  labels: {
    id: 'labels',
    title: 'Etykiety polkowe',
    body: 'Kolejka etykiet do druku. Etykieta powinna pomagac magazynowi znalezc produkt po SKU, EAN i adresie lokalizacji.',
    guideArticleId: 'warehouse-labels',
  },
  calendar: {
    id: 'calendar',
    title: 'Kalendarz',
    body: 'Plan wizyt, dostaw, raportow i zadan. Na teraz lokalny plan pracy, docelowo wspolny kalendarz z Supabase i integracja Google/Outlook.',
    guideArticleId: 'calendar-purpose',
  },
  calendarGrid: {
    id: 'calendarGrid',
    title: 'Siatka kalendarza',
    body: 'Kliknij dzien, zeby zobaczyc wpisy. Dodawanie i edycja odbywa sie w panelu szczegolow, podobnie jak w klasycznym kalendarzu.',
    guideArticleId: 'calendar-events',
  },
  talk: {
    id: 'talk',
    title: 'Talk',
    body: 'Firmowy komunikator. Ma dzialac jak normalny czat: lista rozmow, pliki, reakcje, odczyty, pisanie i powiadomienia push.',
    guideArticleId: 'talk-purpose',
  },
  push: {
    id: 'push',
    title: 'Powiadomienia push',
    body: 'Wymagaja zgody w przegladarce, subskrypcji urzadzenia i dzialajacej funkcji wysylki. Test push sprawdza kanal, wiadomosci sprawdzaja caly przeplyw czatu.',
    guideArticleId: 'talk-push',
  },
  admin: {
    id: 'admin',
    title: 'Panel admina',
    body: 'Zarzadzanie uzytkownikami, rolami i dostepem. Zwykly pracownik nie powinien widziec narzedzi admina.',
    guideArticleId: 'admin-users',
  },
};

const LABEL_TO_HELP: Array<[RegExp, string]> = [
  [/wyszuk|szukaj produkt|ctrl\+k/i, 'catalogSearch'],
  [/filtr.*katalog|katalog.*filtr/i, 'catalogFilters'],
  [/znacznik b|baselinker.*tag|tag b/i, 'catalogBaselinkerTag'],
  [/katalog|produkt/i, 'catalog'],
  [/crm|klient|zamow/i, 'crm'],
  [/lejek/i, 'crmPipeline'],
  [/trasa|wizy/i, 'crmRoutes'],
  [/ranking.*mag|analiza sprzed/i, 'opsProductSales'],
  [/sonax|przejec/i, 'opsSonax'],
  [/kreator statystyk|statystyk/i, 'statBuilder'],
  [/laboratorium|duckdb|perspective|echarts|tanstack/i, 'analyticsLab'],
  [/dostawa danych|import/i, 'dataInbox'],
  [/magazyn|rega|lokalizac/i, 'warehouse'],
  [/2\.5d|izometr/i, 'warehouseIso'],
  [/etykiet/i, 'labels'],
  [/kalendarz|zdarzen|wydarzen/i, 'calendar'],
  [/talk|czat|push|powiadom/i, 'talk'],
  [/admin|uzytkownik|rola|uprawn/i, 'admin'],
  [/baza wiedzy|instrukc/i, 'guide'],
];

export function getContextHelp(id?: string) {
  if (!id) return null;
  return CONTEXT_HELP[id] ?? null;
}

export function inferContextHelpId(label?: string) {
  if (!label) return undefined;
  const hit = LABEL_TO_HELP.find(([pattern]) => pattern.test(label));
  return hit?.[1];
}
