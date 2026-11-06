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
    date: '2026-11-03',
    title: 'Wydajność: lżejszy start katalogu i płynniejszy ATLAS',
    description:
      'Przy starcie nie ładuje się już cały dziennik zmian (ok. 140 KB) — menu i ekran startowy biorą numer wersji z małego pliku generowanego przy wdrożeniu — ani widoki Etykiety, Promocje, Małe zdjęcia i Braki, które wczytują się dopiero po wejściu. Główna paczka aplikacji zmalała z 391 do 256 KB, a przy starcie nie pobierają się moduły etykiet i kodów kreskowych. Liczba pozycji w „Brakach” do menu liczy się po bezczynności (na całym katalogu to kilkaset milisekund), więc nie blokuje startu ani zapisu zmian w produkcie. Zalogowani nie pobierają już przy każdym wejściu pliku sklepu, którego nie używają. W ATLAS analiza przypisań liczy się porcjami z paskiem postępu i nie zamraża strony (było ok. 2 s jednym ciągiem), a lista nazw po zmianie jednego produktu nie liczy od nowa całego katalogu.',
    tag: 'wydajność',
  },
  {
    date: '2026-11-03',
    title: 'Dokładniejsze atrybuty produktów i czystszy podgląd',
    description:
      'Podgląd produktu pokazuje już tylko uzupełnione parametry — puste pozycje są widoczne wyłącznie w edycji. ATLAS rozdziela teraz pojemność (litry, mililitry) od masy netto (kilogramy, gramy), zamiast zamieniać kilogramy na litry. Płyn sprzedawany na wagę dostaje pojemność, a płyn na litry masę, gdy gęstość znana jest z karty produktu (wartość oznaczona jako wyliczona). Nowe atrybuty do utworzenia jednym kliknięciem w zakładce Wiedza: Masa netto, Liczba sztuk w opakowaniu, Kolor, Materiał, Przyłącza (np. GZ 3/8 × GW 1/4) i Ciśnienie robocze — czytane z nazw produktów technicznych (nyple, węże, lance, zawory), a nie z chemii, gdzie słowo „czarny” nic nie znaczy. Małe gramy (gramatura papieru) nie są traktowane jako masa netto.',
    tag: 'nowość',
  },
  {
    date: '2026-11-03',
    title: 'ATLAS: czytelny układ i dostawcy w katalogu',
    description:
      'ATLAS dostał poprawiony wygląd: w jasnym motywie część tła i ramek była za ciemna, a aktywne zakładki i chipy niewidoczne — teraz wszystko ma poprawny kontrast. Poza Przeglądem nagłówek jest kompaktowy (nazwa, wynik, jeden przycisk analizy), a listy mają wspólny pasek narzędzi: wyszukiwanie, główny przełącznik i przycisk Filtry, pod którym schowane są filtry dodatkowe z licznikiem aktywnych. Nazwy to teraz siatka „obecna nazwa → po ujednoliceniu” z objaśnieniem zwiniętym na żądanie i rodziną jako filtrem. Wiedza podzielona na zakładki (atrybuty, pokrycie, branża, sprawdź produkt). Nowa zakładka Producenci i dostawcy: dostawca to osobne pojęcie od producenta (źródło towaru z WAPRO), z podsumowaniem pokrycia, markami każdego dostawcy, profilem (kontakt, NIP, czas dostawy, minimalne zamówienie) i akcją tworzenia dostawców z obecnych producentów. Profile zapisują się w nowej tabeli catalog_suppliers (migracja supabase/migration-catalog-suppliers.sql), a w karcie produktu pole Dostawca podpowiada nazwy z rejestru.',
    tag: 'nowość',
  },
  {
    date: '2026-11-03',
    title: 'ATLAS: silnik produktowy jako osobne miejsce w Produktach',
    description:
      'Silnik produktowy dostał własny widok w menu Produkty i nową nazwę: ATLAS (Asortyment, Taksonomia, Lista nazw, Atrybuty, Standardy opisów). Z Porządkowania zniknęła zakładka silnika wraz ze starymi, dublującymi się analizami (podpowiedzi przypisań starym modelem, przeładowane i drobne kategorie, duble kategorii) — robi to teraz silnik, lepiej i z możliwością zastosowania. Widok ma nowy układ: Przegląd (wynik gotowości katalogu, sześć obszarów ze wskaźnikami i lista rzeczy do zrobienia od najpoważniejszych), Przypisania (audyt przypisanych i uzupełnianie brakujących w jednej kolejce, bez dwóch osobnych uruchomień), Drzewo, Nazwy, Wiedza, Opisy i Producenci. Jedno uruchomienie analizy zasila wszystkie zakładki, a kliknięcie zadania w Przeglądzie otwiera właściwe narzędzie na właściwej kolejce. Audyt jakości danych z CSV/JSON przeniósł się do Przeglądu, podpowiedzi producenta i różne zapisy tej samej marki do zakładki Producenci. Wszystkie zakładki mają wspólny wygląd.',
    tag: 'nowość',
  },
  {
    date: '2026-11-03',
    title: 'Katalizator: standard nazw dla rodzin produktów',
    description:
      'W panelu Katalizatora jest nowa zakładka „Nazwy”. Produkty o wielu wersjach (nyple, lance, dysze, węże, redukcje, złącza, pistolety, zawory, filtry…) dostają jednolity szyk nazwy: rodzaj, cecha, materiał, do czego, model, przyłącza (A × B), wymiary, kolor, a za myślnikiem opis i kod katalogowy. Katalizator ujednolica zapis gwintów (GZ 3/8, GW 1/4, GZ M22; Ż i M przy rozmiarze rozpoznaje jako gwint wewnętrzny i zewnętrzny), materiały i kolory zgodnie z rodzajem gramatycznym (nypel mosiężny, lanca stalowa), jednostki długości i ciśnienia, rozwija skróty (D/, OBROT., CIŚNIEN.), wynosi kody katalogowe na koniec i wykrywa produkty, które po ujednoliceniu mają identyczną nazwę (także z odwróconą kolejnością końców przyłącza). Pozycje są podzielone na „pewne” i „do sprawdzenia”, każdą nazwę można poprawić przed zapisem, a zmiana idzie jako jedna operacja zbiorcza do cofnięcia w Logi → Operacje masowe. Można też pobrać zestawienie przed/po w CSV.',
    tag: 'nowość',
  },
  {
    date: '2026-11-03',
    title: 'Katalizator ocenia i porządkuje drzewo kategorii',
    description:
      'W panelu Katalizatora jest nowa zakładka „Drzewo”. Silnik ocenia sam układ kategorii pod kątem wygody w sklepie internetowym i proponuje poprawki: scalenie kategorii o prawie identycznych nazwach, scalenie drobnicy (1–2 produkty) z najlepiej pasującą sąsiednią, usunięcie pustych kategorii, podział przeładowanych (45+ produktów) na podkategorie według słów powtarzających się w nazwach, zmianę nazw, które mają usterkę zapisu albo nie oddają zawartości, spłaszczenie grup z jedną podkategorią, pogrupowanie zbyt szerokich działów oraz uwagi o szufladach typu „Inne” i niejasnych granicach między kategoriami. Każdą propozycję można poprawić (kategoria docelowa, nazwy nowych podkategorii, zaznaczenie części), pominąć albo zastosować po potwierdzeniu; produkty przenoszone są zbiorczą edycją, więc przypisania da się cofnąć w Logi → Operacje masowe. Po zmianie Katalizator sam przelicza wynik.',
    tag: 'nowość',
  },
  {
    date: '2026-11-02',
    title: 'Katalizator: odporność na haczyki w opisach i bramka rodzaju produktu',
    description:
      'Silnik produktowy dostał nazwę „Katalizator” (zakładka w Asortymencie). Naprawiono błąd, w którym płyny do prania z dopiskiem „…odzieży roboczej i mopów” (Draco WorkBase, Textil Extra) były traktowane jak mopy. Nowe zabezpieczenia: wzmianka o przedmiocie tuż po czynności („do prania mopów”, „do mycia szczotek”) oznacza, że przedmiot jest celem chemii, a nie produktem; bramka rodzaju produktu rozpoznaje chemię (płyn, proszek, żel, koncentrat…) i odrzuca dla niej głosy na kategorie przedmiotów pochodzące z opisu, linii, modelu i podobnych nazw, o ile przedmiot nie jest nazwany wprost w nazwie; błędne ręczne przypisanie przedmiotu do chemii traci wagę i jest oznaczane flagą „chemia, nie przedmiot”; przypisania zatwierdzone przez Ciebie nadal zawsze wygrywają. Silnik rozpoznaje też mopy po nazwie. Poprawiono ręczne przypisania WorkBase Energy.',
    tag: 'poprawka',
  },
  {
    date: '2026-11-02',
    title: 'Szybsze ładowanie katalogu i wgrywanie zdjęć',
    description:
      'Start katalogu: lista produktów z ostatniej wizyty pojawia się od razu (migawka w przeglądarce), a świeże dane z bazy podmieniają ją zaraz po pobraniu — nic nie jest pomijane. Strony listy produktów pobierają się naraz, bez czekania na licznik z pierwszej, a lista materiałów (filtr „Materiały”) pobiera się dopiero przy pierwszym użyciu filtra. Zdjęcia: wiele plików wgrywa się równolegle z jednym zapisem w bazie (kolejność zostaje taka, jak wybrana), zapis zdjęcia głównego nie pobiera już najpierw całego produktu, a zapis w bazie nie robi dodatkowego pobrania i nie przebudowuje indeksu wyszukiwania, gdy zmieniają się tylko zdjęcia, stany lub ceny. Dopasowanie rozmiaru zdjęć w oknie przygotowania też wysyła pliki po trzy naraz.',
    tag: 'wydajność',
  },
  {
    date: '2026-11-02',
    title: 'Silnik uzupełnia atrybuty produktów',
    description:
      'W zakładce Silnik → Wiedza jest nowa sekcja „Uzupełnianie atrybutów”. Silnik rozumie atrybuty z panelu po nazwie (pH, gęstość, termin trwałości, pojemność, forma produktu, koncentracja, dozowanie, odbiorca, HACCP, EU Ecolabel, zapach) i wpisuje je z kart produktów, opisów i nazw — np. dla Eco Shine Smart Foam pH 10, gęstość 1,05 g/ml, trwałość 24 miesiące, zapach cytrynowy. Uzupełnia tylko puste pola, wartość dopasowuje do typu atrybutu i jego listy opcji (niczego spoza listy nie wymyśla), a wartości już wpisane porównuje z tym, co wie, i pokazuje niespójności bez ich nadpisywania. Każdą propozycję można wykluczyć przed zapisem, zapis da się cofnąć w Logi → Operacje masowe. Atrybuty, które silnik potrafi uzupełniać, a których nie ma w panelu, można utworzyć jednym kliknięciem. Karty produktów dostarczają teraz też gęstość, termin trwałości i zapach.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-11-02',
    title: 'Silnik: zakładka „Wiedza”, kontrola opisów i podpowiedzi branży',
    description:
      'Silnik nie pisze już opisów — opisy powstają poza katalogiem. Zakładka „Opisy” przyjmuje gotowe opisy z pliku CSV i sprawdza je przed zapisem: pusty lub zbyt krótki opis, tekst zastępczy, niedozwolony HTML, inna pojemność niż produkt, wzmianki o cudzych markach, zgodność z kategorią i pH z karty, deklaracje biobójcze bez pokrycia oraz identyczne opisy u różnych produktów. Błędy blokują zapis, ostrzeżenia zostawiają decyzję Tobie; tę samą kontrolę można uruchomić na opisach, które już są w katalogu (raport CSV). Nowa zakładka „Wiedza”: profil produktu pokazuje, co silnik o nim rozumie (pojemność, forma, koncentracja, dozowanie, pH, odbiorca, certyfikaty, przeznaczenie) wraz ze źródłem każdej informacji, luki w wiedzy i sprzeczności między źródłami, a pokrycie wiedzy pokazuje, ile produktów ma poszczególne dane. Silnik uczy się też atrybutu „Branża” z produktów, które już go mają, i podpowiada go pozostałym (z uzasadnieniem i możliwością wykluczenia przed zapisem).',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-11-02',
    title: 'Silnik uczy się z Twoich decyzji i czyta karty produktów',
    description:
      'Pamięć silnika: każde zatwierdzenie, zmiana kategorii i pominięcie propozycji zapisuje się we wspólnym dzienniku. Zatwierdzona kategoria działa jak przypisanie ręczne (audyt nie podważy jej ponownie), a odrzucona propozycja nie wraca dla tego produktu. Panel pokazuje liczbę decyzji i trafność propozycji. Nowa warstwa „karta”: z kart technicznych, ulotek i kart charakterystyki wyciągnięto przeznaczenie, sposób użycia i pH dla 262 produktów (plik public/data/material-facts.json, budowany skryptem scripts/build-material-facts.ts). Silnik używa przeznaczenia z karty jako dowodu przy wyborze kategorii.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-11-02',
    title: 'Silnik produktowy: nowy panel w Asortymencie',
    description:
      'Zakładka „Analiza” zmieniła się w „Silnik” — centrum przypisywania i kontroli produktów, wyjęte z zakładki „Sklep”. Silnik ma animację pracy i dwa tryby: „Sprawdź przypisane” wskazuje źle przypisane produkty z propozycją poprawki, a „Przypisz bez kategorii” dopasowuje te, które jeszcze jej nie mają. Wyniki trafiają do kolejek: pewne, do sprawdzenia, bez sygnału i do ukrycia. Każdą pozycję można rozwinąć („dlaczego”: głosy warstw silnika), zatwierdzić, zmienić na inną kategorię albo pominąć. Panel pokazuje komunikaty z podpowiedziami, co zrobić dalej, i kondycję drzewa kategorii. Zakładka „Opisy” znajduje produkty bez pełnego opisu, składa szkice z danych produktu (opis tego samego produktu w innym opakowaniu, krótki opis, użycie i skład) i przyjmuje gotowe opisy z pliku CSV, a „Asortyment” zawiera dotychczasową analizę (audyt jakości danych, duplikaty, przeładowane kategorie).',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-11-02',
    title: 'Import materiałów: kolejne marki i typy dokumentów',
    description:
      'Import masowy materiałów obsługuje teraz foldery z kartami wielu marek (Draco, Eco Shine, K2, Cartec, Kala, Freshtek, Tenzi, Cid Lines/Kenotek) i różne typy dokumentów: karty charakterystyki, karty produktu, TDS, ulotki, certyfikaty, arkusze składników. Pliki z SKU w nazwie (np. K2000048_…) trafiają dokładnie do tego produktu, pozostałe są dopasowywane po nazwie handlowej, także gdy w pliku jest tylko początek nazwy produktu, a pojemność i kod dokumentu są pomijane. Nazwa wgranego pliku dostaje prefiks typu dokumentu (KCH, Karta produktu, TDS…), więc dwa dokumenty o tej samej nazwie nie nadpisują się. Zdjęcia, archiwa ZIP, pakiety zbiorcze i pliki manifestów są pomijane.',
    tag: 'nowość',
  },
  {
    date: '2026-11-02',
    title: 'Filtr produktów z materiałami i lepsze dopasowanie kart',
    description:
      'W filtrach katalogu jest nowy filtr „Materiały”: z materiałami (karty charakterystyki, specyfikacje) lub bez nich — także na telefonie i jako znacznik aktywnego filtra. Lista aktualizuje się od razu po dodaniu lub usunięciu pliku. Dopasowanie kart przy imporcie masowym rozpoznaje teraz nazwy z opisem po pojemności (np. „Active Foam Cherry 20L - kwaśna piana”), skróty z numerem (AD50 = AD 50), znak plus i literówki w marce, więc dopasowuje więcej plików.',
    tag: 'nowość',
  },
  {
    date: '2026-11-02',
    title: 'Import masowy materiałów produktów',
    description:
      'W Asortyment → Sklep jest nowa karta „Materiały produktów: import masowy”. Wybierasz folder z kartami charakterystyki (podfoldery to marki), aplikacja dopasowuje pliki do produktów po nazwie handlowej zapisanej w nazwie pliku i pokazuje, ile plików i przypisań znalazła. Przycisk „Wgraj dopasowane” dodaje je do zakładki „Materiały” każdego pasującego produktu (wszystkie opakowania tego samego produktu dostają ten sam plik). Dopasowanie jest ostrożne: numer modelu, wariant (S, Plus, Ultra) i marka muszą się zgadzać, a niejednoznaczne pliki trafiają do raportu CSV zamiast do przypadkowego produktu. Powtórny import pomija pliki, które produkt już ma.',
    tag: 'nowość',
  },
  {
    date: '2026-11-02',
    title: 'Materiały produktu: karty charakterystyki i ulotki',
    description:
      'W podglądzie produktu jest nowa zakładka „Materiały”. Można w niej dodać pliki (PDF, dokumenty, arkusze, obrazy) przyciskiem albo przeciągnięciem — karty charakterystyki, specyfikacje i ulotki producentów. Pliki otwierają się w nowej karcie, a osoby z uprawnieniem do zdjęć mogą je usuwać. Pliki zapisują się w tym samym magazynie co zdjęcia, w osobnym katalogu produktu.',
    tag: 'nowość',
  },
  {
    date: '2026-11-02',
    title: 'Silnik kategorii: model statystyczny i warstwa faktów z sieci',
    description:
      'Dodano niezależną płaszczyznę oceny: klasyfikator statystyczny uczony na nazwach, parach słów i opisach wszystkich produktów z kategorią (trafność ok. 90% przy wysokiej pewności, sprawdzona metodą „bez tego produktu”). Głosuje tylko przy dużej pewności i nigdy nie decyduje sam — potrzebny jest dowód z nazwy lub opisu. Dodano też warstwę „sieć”: fakty o produkcie znalezione w internecie (plik src/data/webFacts.ts, źródło obowiązkowe) liczą się jako dowód i będą podstawą szkiców opisów.',
    tag: 'nowość',
  },
  {
    date: '2026-10-30',
    title: 'Silnik kategorii: deklaracja ekologiczna i walidacja wymagań kategorii',
    description:
      'Nowa warstwa „deklaracja ekologiczna”: środki czyszczące do obiektów i domu z linii ECO w nazwie (m.in. Eilfix ECO, Cid Lines ECO CLEAN, Eco Shine Eco Glass/Degreaser/Floor) trafiają do „Ekologicznych środków czystości”, a akcesoria, chemia samochodowa, dezynfekcja i sama marka Eco Shine zostają w swoich kategoriach. Dodano walidatory: kategoria może wymagać deklaracji w nazwie lub opisie (produkty bez niej są oznaczane do sprawdzenia) oraz słowa wykluczające (np. szczotka nie wejdzie do tapicerki materiałowej). Silnik wykorzystuje też producenta jako podpowiedź (nie dowód) i ignoruje ukryte znaki sterujące z importu WAPRO, które rozbijały nazwy.',
    tag: 'nowość',
  },
  {
    date: '2026-10-30',
    title: 'Sens logiczny drzewa: koniec z dublami i pustymi kategoriami',
    description:
      'Usunięto kategorie bez sensu lub dublujące inne: „Płyny do szyb do myjni” (szyby idą do „Płynów do szyb samochodowych”), „Środki ekologiczne”, „Dywany i tapicerka domowa” i „Podłogi” w dziale Dom i ogród. „Chemia do domu” zawiera teraz wyłącznie marki marketowe (Domestos, Cilit, Cif, Ajax, Persil, Vanish, Pronto, Sidolux…) w liściach „Łazienka i WC”, „Pranie” i „Środki uniwersalne i meble”, a chemia profesjonalna zostaje w dziale Chemia profesjonalna. „Ekologiczne środki czystości” to teraz wyłącznie linia Eco Shine ECO (Eco Glass, Eco Sanit, Eco Toilet…). Kostki i krążki WC wszystkie w „Pisuary i kostki WC”, szczotki Vikan w „Szczotki przemysłowe i HACCP”. Silnik dostał zasadę specyficzności (konkretna kategoria wygrywa z ogólną) i sprawdza sens samego drzewa: w audycie przypisań pokazuje kondycję drzewa — kategorie, które po poprawkach byłyby puste, drobnicę (1–2 produkty) do scalenia oraz pary kategorii, między którymi silnik często się waha. Przyspieszono działanie silnika (prekompilacja wzorców).',
    tag: 'poprawka',
  },
  {
    date: '2026-10-30',
    title: 'Silnik kategorii: reguła pojemności (myjnia ↔ detal) i osobny audyt przypisań',
    description:
      'Nowa reguła pojemności: duże opakowania chemii samochodowej (od 20 L/kg, beczki) trafiają do „Myjnia samochodowa › Chemia do myjni”, a litrówki i 5 L do „Chemia samochodowa” (klient detaliczny i warsztat). Dotyczy par: aktywne piany, woski/hydrowoski, płyny do szyb, preparaty do felg — ta sama chemia Orion, Eco Wash czy Easy Wash ląduje w innej kategorii zależnie od opakowania; poprawka opakowania jest zawsze „pewna”. W zakładce Sklep są teraz dwa przyciski: „Uruchom silnik uzupełniania” (produkty bez kategorii) i „Sprawdź poprawność przypisań” (osobny audyt produktów, które już mają kategorię: błędne przypisania, sprzeczności, niespójne rodziny, naruszenia reguły pojemności) z przyciskiem „Popraw błędne przypisania”. Silnik korzysta też z kategorii, jakie produkt ma w sklepie kenochem.com (dodatkowy dowód). Dopisano przypisania wyszukane w internecie: Polchem Focid, Kama, Izosol, Atmomix, Swish Food Service, Royal RO-12 Pers.',
    tag: 'nowość',
  },
  {
    date: '2026-10-30',
    title: 'Silnik kategorii: więcej pytań i walidacji, lista produktów do ukrycia',
    description:
      'Silnik zadaje teraz więcej pytań i sam sprawdza przypisania. Nowe warstwy: rodzina (ten sam produkt w innych opakowaniach musi mieć tę samą kategorię — wykrywa niespójności), model (Nerta ATC 100 i ATC 350 to różne produkty, linia nie przenosi kategorii między numerami modeli), cechy składu (kwas fluorowodorowy). Zasada „bez dowodu nie proponuję”: nowa kategoria wymaga dowodu w nazwie, opisie lub identycznym produkcie w innym opakowaniu — samo podobieństwo do linii marki nie wystarcza. Silnik oznacza też flagami: sprzeczność nazwy i opisu, rodzina niespójna, zmiana kategorii, bez dowodu. Wykrywa pozycje niesprzedażowe (usługi, wysyłka, rozliczenia, sprzęt biurowy) i pokazuje je w osobnej liście „Do ukrycia” z plikiem CSV. Poprawiono Nerta ATC 350 (usuwanie betonu i cementu) i ATC 100 (kwasowy środek przemysłowy) oraz rodziny Textile Cleaner, Top Glass i Super Green NF.',
    tag: 'nowość',
  },
  {
    date: '2026-10-30',
    title: 'Ręczny przegląd produktów: 400 sprawdzonych przypisań kategorii',
    description:
      'Przejrzałem ręcznie 470 produktów, których silnik nie mógł zakwalifikować pewnie (nazwa, opis, producent, a przy braku opisu — wyszukiwanie w internecie). Wynik to 400 zatwierdzonych przypisań, które mają pierwszeństwo przed silnikiem i regułami. Rozpoznano m.in. Nerta ATC 100 (kwasowy środek do felg aluminiowych), Satellite STF 6K (płyn do toalet przenośnych), Karcher RM 770 i RM 746, Kenotek Trans NT+ (podłogi warsztatowe), linie Textil-Ex, Jax 20 i Teppich Shampoo (pranie dywanów i tapicerki), hydrowoski do myjni. Produkty, co do których nie ma pewności (Parbaks, Polchem, część Nerta, Kenotek Force 2 i inne), zostają w „Do decyzji” z linkiem do wyszukania.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-30',
    title: 'Zakładka Sklep uproszczona: porównanie ze sklepem i jeden przycisk silnika',
    description:
      'Zakładka Sklep ma teraz dwie części. Pierwsza porównuje katalog ze sklepem kenochem.com: kategorie, produkty obecne tylko w katalogu, tylko w sklepie oraz różnice w przypisaniu kategorii — z plikami CSV (w tym import do WooCommerce, zmiany drzewa i przekierowania 301). Druga to jeden przycisk „Uruchom silnik uzupełniania”: silnik pobiera opisy, bada nazwę, opis, sposób użycia, linię produktową i podobne produkty, po czym pokazuje pewne zmiany (do zastosowania hurtem, z cofaniem w Logach), produkty do sprawdzenia i produkty do wyszukania w internecie. Stare przyciski (Uzupełnij ze sklepu, Przebuduj, Dopasuj) usunięto. Silnik uwzględnia kontekst: sprzeczność nazwy i opisu (np. „Czysta Kostka” to środek do kostki brukowej, nie do pisuarów) blokuje status „pewne”.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-30',
    title: 'Silnik kategorii: wielowarstwowa decyzja, gdzie ma trafić produkt',
    description:
      'Przypisywanie kategorii działa teraz warstwowo, jak człowiek: najpierw rozpoznaje rodzaj produktu (pokrowiec, ściągaczka, część), potem funkcję z nazwy (odplamiacz, odkamieniacz, szampon…), potem z opisu, sposobu użycia i składu, następnie sprawdza linię produktową (np. cała linia SPOT-EX to odplamiacze) i podobne produkty, a na końcu uwzględnia obecną kategorię. Warstwy głosują z wagami; wynik ma status „pewne”, „do sprawdzenia” albo „do wyszukania w necie”. Podobieństwo nazw samo nie wystarcza do przypisania. Przycisk „Przebuduj kategorie wg nazw” stosuje tylko pewne decyzje i pomija produkty, których kategorię zmieniłeś po analizie. Gotowe listy: propozycje (docs/kategorie-propozycje-2026-10-30.csv) i produkty do sprawdzenia w internecie (docs/do-wyszukania-w-necie-2026-10-30.csv). Naprawiono m.in. odplamiacze Draco SPOT-EX, które trafiały do tapicerki, betonu i smoły.',
    tag: 'nowość',
  },
  {
    date: '2026-10-30',
    title: 'Dokładniejsze przypisywanie kategorii: rodzaj produktu przed zastosowaniem',
    description:
      'Po przeglądzie całego katalogu (4274 produkty, nazwy, opisy i producenci) reguły przypisywania najpierw rozpoznają, czym jest produkt, a dopiero potem do czego służy. Dzięki temu pokrowce na fotele i opony trafiają do wyposażenia myjni, a nie do mopów, łazienek ani dressingów; ściągaczki Vikan i myjki do szyb do ściągaczek, a nie do płynów do szyb; gąbki, rękawice i ściereczki do akcesoriów; odkamieniacze do odkamieniania; środki do ciężarówek i obór do właściwych kategorii, a folia spożywcza, cynk i płyn do maszyn do lodów przestają ladować w „Łazienkach i sanitariatach”. Dodano kategorię „Reflektory i lampy” oraz ręczne przypisania dla ok. 190 produktów z „Do decyzji”. Produkty, których nie da się pewnie zakwalifikować (np. Parbaks, Satellite STF, część Polchem), zostają w „Do decyzji” do ręcznej decyzji. Zastosuj przyciskiem „Przebuduj kategorie wg nazw” w Porządkowaniu → Sklep (do cofnięcia w Logi → Operacje masowe).',
    tag: 'poprawka',
  },
  {
    date: '2026-10-30',
    title: 'Symetryczne menu kategorii: 4–8 podkategorii w każdym dziale i nowe kategorie sprzedażowe',
    description:
      'Każdy z 7 działów ma teraz od 4 do 8 podkategorii o zbliżonej wielkości, żeby menu w sklepie wyglądało równo. Myjnia samochodowa: Chemia do myjni, Węże i bębny, Złączki i szybkozłącza, Lance/pistolety/dysze, Zawory/filtry/armatura, Myjki i pompy, Uszczelnienia/zbiorniki/montaż, Odkurzacze i wyposażenie myjni. Dom i ogród: Chemia do domu, Akcesoria domowe, Czyszczenie zewnętrzne, Ogród i zima. Nowe kategorie dla towarów, które nie miały miejsca: pędzle i aplikatory detailingowe, glinki do lakieru, pisuary i kostki WC, chemia basenowa, usuwanie betonu i cementu, kwasy i zasady przemysłowe, mycie pojazdów ciężarowych, prezentery zapachowe, folie/torby/opakowania oraz znaki ostrzegawcze. Rozszerzone reguły rozpoznawania po nazwie przypisują do nich produkty z „Do decyzji” (przycisk „Przebuduj kategorie wg nazw”).',
    tag: 'nowość',
  },
  {
    date: '2026-10-30',
    title: 'Jedno drzewo kategorii: odchudzony układ i połączenie z Porządkowaniem',
    description:
      'Moduł Kategorie został połączony z Porządkowaniem — drzewo graficzne jest teraz jedynym miejscem, gdzie dodajesz, zmieniasz nazwy, przenosisz i usuwasz kategorie (stare wejście do Kategorii przekierowuje do Porządkowania). Drzewo odchudzono: puste kategorie (Osady wapienne, Chemia sezonowa, Krwawa felga i inne) usunięto, a drobne i powielone scalono, m.in. odkamienianie, felgi, mycie auta, szyby, smary, rolnictwo, kategorie myjni (Portalowa, Ręczna, Tunelowa…), dublujące się akcesoria domowe z działu Dom i ogród oraz kategorie nazwane markami (Vikan). Produkty ze scalonych kategorii przechodzą do kategorii docelowej przy użyciu „Przebuduj kategorie wg nazw”. W drzewie pojawił się przycisk „Przywróć wzorcowy układ”, który usuwa nieznane zmiany zapisane w bazie (z kopią do pliku). Zakładka Sklep nie nadpisuje już układu drzewa.',
    tag: 'nowość',
  },
  {
    date: '2026-10-29',
    title: 'Przebudowa kategorii części technicznych i przepinanie produktów wg nazw',
    description:
      'Kategoria „Części do myjek” (i jej 5 ogólnych podkategorii) została zastąpiona konkretnymi grupami: Węże i bębny, Złączki i szybkozłącza (nyple, złącza obrotowe, redukcje, szybkozłącza, trójniki, korki), Lance, pistolety i dysze, Zawory, filtry i armatura (zwrotne, by-pass, inżektory, filtry, manometry), Pompy i silniki, Uszczelnienia i montaż (o-ringi, uszczelki, komplety naprawcze), Zbiorniki i pobór chemii oraz części do odkurzaczy i opryskiwaczy. Doszły też kategorie dla masek i okularów, pędzli detailingowych, narzędzi ogrodowych i zimowych oraz olejów i żarówek. Nowy przycisk „Przebuduj kategorie wg nazw” w Porządkowaniu → Sklep rozpoznaje części po nazwie niezależnie od obecnej kategorii (np. rurki do zbiorników z kategorii łazienkowej) i przepina je; produkty ze zlikwidowanych kategorii bez dopasowania wracają do „Do decyzji”. Operacja jest do cofnięcia w Logi → Operacje masowe. Katalog jest teraz wzorem — dawne „Odbij sklep 1:1” uzupełnia tylko produkty bez kategorii, a zakładka Sklep pokazuje kategorie do dodania i usunięcia w sklepie oraz przekierowania 301.',
    tag: 'nowość',
  },
  {
    date: '2026-10-29',
    title: 'Porządkowanie: usuwanie produktów z kategorii',
    description: 'Po zaznaczeniu produktów na liście pojawia się przycisk „Usuń z kategorii”: produkty tracą kategorię i wracają do „Do decyzji” zamiast być przenoszone do innej. Operację można cofnąć w Logi → Operacje masowe.',
    tag: 'nowość',
  },
  {
    date: '2026-10-29',
    title: 'Porządkowanie: filtr stanu magazynowego na liście produktów',
    description: 'Nad listą produktów po lewej są przyciski „Wszystkie / Na stanie / Brak na stanie”, które łączą się z wyszukiwarką i pozostałymi filtrami.',
    tag: 'nowość',
  },
  {
    date: '2026-10-29',
    title: 'Porządkowanie: stałe kolory działów podczas wyszukiwania',
    description: 'Po wyszukaniu lub zawężeniu widoku drzewa każdy dział zachowuje swój kolor, zamiast dostawać kolejny kolor od początku palety (wcześniej pierwszy widoczny dział zawsze był niebieski).',
    tag: 'poprawka',
  },
  {
    date: '2026-10-29',
    title: 'Koniec z kategoriami branżowymi i zestawami: branża jako filtr',
    description:
      'Z drzewa katalogu zniknęła gałąź „Dla obiektów i branż” (Biura, Hotele, Szkoły, Placówki medyczne, Firmy sprzątające) oraz kategorie „Zestawy…” — produkt ma jedną kategorię według rodzaju i zastosowania. Branże z tych kategorii zapisują się w atrybucie „Branża” (filtr w sklepie), a zakładka Sklep pokazuje je jako kategorie do usunięcia i generuje pliki: CSV kategorii produktów bez kategorii branżowych, CSV branż oraz listę przekierowań 301. Nowy przycisk „Dopasuj produkty” przypina do właściwych kategorii produkty bez kategorii i te przypisane ewidentnie źle (do cofnięcia w Logach).',
    tag: 'nowość',
  },
  {
    date: '2026-10-29',
    title: 'Lustro sklepu kenochem.com: kategorie 1:1 i porównanie ze sklepem',
    description:
      'Drzewo kategorii zostało pobrane ze sklepu kenochem.com i odpowiada mu 1:1 (7 działów, 3 poziomy; dział „Myjnie i urządzenia” nazywa się w sklepie „Myjnia samochodowa”, doszły „Chemia sezonowa” i „Osady wapienne”). W Porządkowanie → Sklep przycisk „Odbij sklep 1:1” przywraca drzewo ze sklepu (z kopią zapasową zmian) i ustawia produktom kategorie tak jak w sklepie, dopasowując po SKU; przypisanie da się cofnąć w Logi → Operacje masowe. Po naszych poprawkach ta sama zakładka pokazuje, co różni katalog od sklepu, i daje pliki CSV do wdrożenia zmian: kategorie produktów w formacie importu WooCommerce oraz listę zmian drzewa. Dane sklepu odświeża skrypt scripts/fetch-shop-mirror.mjs.',
    tag: 'nowość',
  },
  {
    date: '2026-10-29',
    title: 'Szybsze ładowanie katalogu i płynniejsze Porządkowanie',
    description:
      'Przyspieszono wyliczanie kategorii produktów przy ładowaniu katalogu (reguły są kompilowane raz, normalizacja tekstu pomija zbędne kroki) — start listy produktów jest ok. 2 razy szybszy. Podpowiedzi producentów i analiza asortymentu liczą się szybciej dzięki współdzielonej normalizacji nazw. W Porządkowaniu tacka z produktami przerysowuje tylko zmieniony wiersz zamiast wszystkich naraz, a poza ekranem wiersze nie są renderowane. Unoszenie węzłów drzewa włącza się tylko przy niewielkiej liczbie rozwiniętych węzłów (do 70), żeby nie obciążać słabszych komputerów. Audyt pokazuje stan „Liczenie…” zamiast zawieszać stronę.',
    tag: 'wydajność',
  },
  {
    date: '2026-10-29',
    title: 'Porządkowanie: ikony kategorii, miniatury produktów i animowane drzewo',
    description:
      'Każda kategoria (dział, podkategoria i kategoria najniższego poziomu) ma ikonę dobieraną automatycznie z jej nazwy — po zmianie nazwy ikona dopasowuje się sama, a gdy nazwa nic nie mówi, bierze ikonę z działu nadrzędnego. Węzły rozwijają się i zwijają płynnie, a po rozwinięciu bardzo delikatnie unoszą się jak na wodzie (wyłączone przy przeciąganiu i przy ustawieniu systemu „ogranicz animacje”). Produkty na tacce po lewej mają miniatury zdjęć.',
    tag: 'nowość',
  },
  {
    date: '2026-10-29',
    title: 'Dostawca jako osobne pole: od kogo towar, a nie marka',
    description:
      'Produkt ma teraz dwa osobne pola: producent (marka na opakowaniu) i dostawca (od kogo mamy towar — w WAPRO to grupa produktu). Dostawcę widać i edytuje się w szczegółach produktu, a w Porządkowanie → Producenci jest filtr „Dostawca”, który pokazuje wszystkie produkty danego dostawcy do przeciągnięcia na właściwych producentów. Przycisk „Utwórz dostawców z WAPRO” jednorazowo przepisuje obecne pole producenta do dostawcy (do cofnięcia w Logi → Operacje masowe), bez zmiany producentów. Dzięki temu np. MERSA zostaje dostawcą, a marki towarów można poprawić osobno.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-29',
    title: 'Stała struktura kategorii: 7 działów i 3 poziomy, sprzątanie luźnych',
    description:
      'Kategorie mają teraz stały układ: 7 działów głównych, podkategoria i kategoria najniższego poziomu. Nie da się już dodać dodatkowego działu ani zagnieździć głębiej (dodawanie nowych działów z widoku Kategorie i z karty produktu wyłączono). W Porządkowanie → Drzewo pojawił się przycisk „Usuń luźne kategorie”: usuwa kategorie spoza 7 działów (np. osierocone „Zlaczki i adaptery”, „Worki do odkurzacza”) i przenosi ich produkty do „Do decyzji”, żeby przypisać je ręcznie. Operację można cofnąć w Logi → Operacje masowe.',
    tag: 'nowość',
  },
  {
    date: '2026-10-29',
    title: 'Naprawione usuwanie i zmiana nazwy producenta',
    description:
      'Usunięty producent znikał z listy dopiero po przeładowaniu, a produkty z prefiksem SKU potrafiły wracać pod starą marką. Teraz lista odświeża się od razu, a produkty przeniesione do „bez producenta” zostają bez producenta (oznaczone jawnie, więc podpowiedź z SKU ich nie przywraca). Usunięcie producenta jest zapisane w dzienniku i można je cofnąć w Logi → Operacje masowe. Poprawiono też audyt: model kategorii uczy się tylko na kategoriach z drzewa i wykrywa prefiks „Z-Z” w nazwach.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-29',
    title: 'Pełny audyt asortymentu: producent, kategoria, nazwa i gotowość do sklepu',
    description:
      'W Porządkowanie → Analiza jest nowa sekcja „Pełny audyt asortymentu”. Jednym kliknięciem sprawdza każdy produkt: brak lub niewłaściwy producent (np. „Inni producenci”, nazwa kategorii zamiast marki, inna marka w nazwie), brak lub zbyt ogólna kategoria, kategorię niezgodną z nazwą produktu, ucięte lub techniczne nazwy, brak zdjęcia, opisu, ceny i EAN oraz błędy walidacji. Wynik widać jako zestawienie liczby problemów, a cały raport można pobrać do pliku CSV (do Excela) albo JSON.',
    tag: 'nowość',
  },
  {
    date: '2026-10-28',
    title: 'Porządkowanie asortymentu: graf kategorii, przeciąganie produktów, analiza',
    description:
      'Nowy widok Słowniki → Porządkowanie. Drzewo kategorii jako rozwijany graf z gałęziami: produkty z tacki po lewej przeciągasz na kategorię (pojedynczo lub zaznaczone grupą, Shift = zakres), a całe gałęzie możesz przenosić między działami. Zakładka Producenci działa tak samo — przeciągasz produkty na kafelek producenta, w tym na „Bez producenta”. Zakładka Analiza pokazuje produkty bez kategorii, podpowiedzi przypisań wyliczone z nazw (z pewnością w %), przeładowane i puste kategorie, podpowiedzi producenta z nazwy oraz duplikaty nazw. Każde przeniesienie trafia do dziennika i można je cofnąć w Logi → Operacje masowe.',
    tag: 'nowość',
    size: 'major',
  },
  {
    date: '2026-10-28',
    title: 'Produkty bez producenta: filtr w katalogu i wiersz w Producentach',
    description:
      'W filtrze producentów w katalogu pojawiła się pozycja „Bez producenta” z liczbą produktów, które nie mają przypisanego żadnego producenta. Ta sama pozycja jest na górze listy w widoku Producenci — kliknięcie otwiera te produkty w katalogu.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-28',
    title: 'Statystyki: nowy wygląd i komplet kluczowych wskaźników',
    description:
      'Panel statystyk przebudowany w spokojnym, systemowym stylu: duże liczby, cienkie wykresy i wartości podpisane obok danych — bez dymków i legend nachodzących na wykresy. Nowe zakładki Magazyn (wartość zapasu, rozkład stanów, zapas wg producentów i kategorii, największe zapasy) oraz Ceny i marże (marża średnia i ważona, rozkład marż i cen, najniższe marże). Przegląd zawiera tabelę wszystkich wskaźników: asortyment, magazyn, wartość, zdjęcia i opisy, BaseLinker i błędy jakości.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-28',
    title: 'Strona startowa: spokojniejszy, bardziej profesjonalny wygląd',
    description:
      'Przeprojektowana strona startowa: bez gradientów, rozmyć i cieni. Płaskie karty z cienką ramką, jeden kolor akcentu, wskaźniki jakości jako cienkie paski zamiast kolorowych pierścieni, kafelki skrótów z neutralnymi ikonami oraz czytelniejsza typografia i pasek wskaźników na górze. Zawartość i funkcje bez zmian.',
    tag: 'poprawka',
    size: 'patch',
  },
  {
    date: '2026-10-28',
    title: 'Menu boczne: sekcje z ikonami, pozycje wcięte',
    description:
      'Nazwy sekcji menu (Produkty, Jakość danych, Słowniki, Analizy, System) są większe i mają ikony, a pozycje należące do sekcji są wcięte w prawo z linią prowadzącą — jak w BaseLinkerze. Łatwiej odróżnić grupy i nawigować.',
    tag: 'poprawka',
    size: 'patch',
  },
  {
    date: '2026-10-28',
    title: 'Aktywność: jakie produkty ktoś wysłał do BaseLinkera',
    description:
      'Wpisy w Aktywności o wysyłce stanów i cen, dokładaniu zdjęć i imporcie do BaseLinkera pokazują po rozwinięciu listę produktów: SKU (link do produktu), nazwa i co wysłano. W wierszu widać pierwsze produkty. Dotyczy nowych operacji; starsze wpisy nie mają listy.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-28',
    title: 'Logi: które produkty poszły do BaseLinkera',
    description:
      'Wpisy wysyłek do BaseLinkera (stany, ceny, zdjęcia) mają po rozwinięciu listę produktów: SKU, nazwa i wysłana wartość. Kliknięcie SKU otwiera kartę produktu. Funkcja zapisuje teraz do 100 produktów na wpis (wcześniej 20) — wymaga wdrożenia funkcji baselinker w Supabase.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-27',
    title: 'Pełne nazwy produktów z WAPRO (koniec z uciętymi nazwami)',
    description:
      'Pole nazwy w WAPRO mieści tylko 40 znaków, więc nowe produkty miały nazwy ucięte (np. „Bęben automatyczny kompletny z wężami -”). Synchronizacja pobiera teraz pełną nazwę z pola NAZWA_CALA i uzupełnia już ucięte nazwy w katalogu — tylko tam, gdzie nazwa nie była ręcznie zmieniana. Wymaga wgrania nowego skryptu synchronizacji na serwer WAPRO.',
    tag: 'poprawka',
    size: 'patch',
  },
  {
    date: '2026-10-27',
    title: 'Grupy: powrót do wizytówki, lista produktów grupy i wygodniejszy konfigurator',
    description:
      'W karcie produktu należącego do grupy jest pasek z powrotem do wizytówki grupy, listą wszystkich produktów grupy i przejściami poprzedni/następny (także po wejściu z katalogu). Usunięto zakładkę „Pojemności”. Konfigurator grup otwiera się na całej stronie zamiast w okienku: wyszukiwanie po kilku słowach, zaznaczanie wielu wyników i dodawanie hurtem, podgląd zdjęć i stanów.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-27',
    title: 'Grupy produktów: własne zdjęcie grupy i wybór źródła kopiowania zdjęć',
    description:
      'Żaden produkt w grupie nie jest już „główny”: grupa ma własne zdjęcie, które edycja grupy nie nadpisuje. Przycisk „Zdjęcia dla grupy / wszystkich” pozwala wybrać produkt, z którego skopiować zdjęcia, i zaznaczyć, gdzie je wgrać — do wybranych produktów oraz jako zdjęcie samej grupy.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-27',
    title: 'Warianty grup: kopiowanie zdjęć do pozostałych wariantów, każdy wariant zawsze dostępny',
    description:
      'Przy wariancie w grupie jest przycisk „zdjęcia → inne”: wybierasz, którym wariantom skopiować zdjęcia (domyślnie tym bez zdjęcia). Pliki są kopiowane osobno, więc usunięcie zdjęcia w jednym produkcie nie rusza pozostałych. Warianty, których nie ma na załadowanej liście, są dociągane z bazy po SKU, więc każdy wariant można otworzyć i przeklikać strzałkami.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-27',
    title: 'Grupy produktów: warianty z ceną, zdjęciem i znacznikami W/B oraz przechodzenie między wariantami',
    description:
      'Lista wariantów w grupie pokazuje miniaturę (albo ikonę braku zdjęcia), znaczniki W/B, cenę i stan; kliknięcie wariantu otwiera jego pełny podgląd. W podglądzie wariantu jest pasek „Grupa: …” z powrotem do grupy oraz strzałkami do poprzedniego i następnego wariantu. Podział ekranu: prawy panel nie przelicza się już przy każdym znaku w wyszukiwarce i nie blokuje ładowania katalogu.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-27',
    title: 'Logi: koniec spamu z synchronizacji stanów, lista produktów w szczegółach wpisu',
    description:
      'Automatyczna synchronizacja zapisuje wpis w logach tylko gdy zmieni się obraz (liczba produktów z ręcznym stanem, brakujących w WAPRO, ostrzeżeń) lub raz na 6 godzin. Naprawiono błąd, przez który ok. 27 produktów bez stanu i cen było „aktualizowanych” w każdym przebiegu. Rozwinięty wpis pokazuje listę produktów z ręcznym stanem i brakujących w WAPRO.',
    tag: 'poprawka',
    size: 'minor',
  },
  {
    date: '2026-10-27',
    title: 'Podział ekranu: wybór widoku w każdym panelu i przeciąganie kafelków z menu',
    description:
      'Oba panele podzielonego ekranu mają własną listę wyboru widoku. Kafelek z menu bocznego można chwycić i upuścić na wybrany panel (albo na prawą połowę ekranu, żeby otworzyć widok obok).',
    tag: 'nowość',
    size: 'patch',
  },
  {
    date: '2026-10-26',
    title: 'Podział ekranu: katalog po lewej, konfigurator grup (lub inny widok) po prawej',
    description:
      'Na dużych ekranach przycisk „Podziel ekran” pokazuje obok bieżącego widoku drugi panel z własnym przewijaniem. W prawym panelu wybierasz widok z listy (łączenie w grupy, grupy produktów, uzupełnianie danych, atrybuty, kategorie i inne). Wybór jest zapamiętywany.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-26',
    title: 'Grupy produktów: łączenie dowolnych produktów (dysze, części), nie tylko pojemności',
    description:
      'W sekcji Grupy produktów jest zakładka „Łączenie w grupy”: można złożyć grupę z dowolnych produktów (wyszukiwarka, wybór wariantu głównego dającego zdjęcie i cenę), edytować istniejące grupy oraz skorzystać z propozycji „Części i dysze” wykrywanych po kodzie na końcu nazwy. Osobne pozycje menu „Warianty pojemności” zastąpiono jednym wejściem.',
    tag: 'nowość',
    size: 'minor',
  },
  {
    date: '2026-10-26',
    title: 'Podgląd produktu: zwarta góra, bez szybkiej zmiany stanu; telefon: nic nie ucieka w bok',
    description:
      'W podglądzie produktu góra karty zajmuje teraz mniej miejsca: na telefonie zniknął osobny pasek „Lista produktów” (zamyka krzyżyk), tytuł jest mniejszy, a SKU, EAN, stan i cena siedzą w jednym poziomym rzędzie mniejszych plakietek (z możliwością przewinięcia, gdyby się nie zmieściły; na komputerze bez zmian). Logo producenta na telefonie jest ukryte. Z karty usunięto też stały panel „Stan magazynowy” z przyciskami plus i minus — stan zmienia się teraz wyłącznie w trybie edycji produktu (to rzadka operacja, więc nie wisi na wierzchu). Na telefonach naprawiono elementy wychodzące poza szerokość ekranu: m.in. na stronie głównej karty „Proponowany następny krok” i „Dalej w kolejce” były szersze niż ekran. Przyczyną były siatki bez zdefiniowanej kolumny bazowej; dodano ją w 154 miejscach w całej aplikacji (jedna kolumna o szerokości ekranu), a dodatkowo włączono zabezpieczenie przed poziomym przewijaniem strony i łamanie bardzo długich ciągów znaków.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-26',
    title: 'Nawigacja jak w aplikacji mobilnej: dolny pasek z przyciskiem Menu i boczna szuflada',
    description:
      'Na telefonie katalog ma teraz dolny pasek z pięcioma miejscami: Start, Katalog, duży środkowy przycisk Skan (kody kreskowe), Ulubione (albo Zamówienie, jeśli masz dostęp do CRM) oraz Menu. Przycisk Menu otwiera boczną szufladę wysuwaną z lewej strony, z kontem u góry i pełną nawigacją w tych samych zwijanych grupach co panel boczny na komputerze (Produkty, Jakość danych, Słowniki, Analizy, System — z licznikami i własnym ustawieniem kolejności), a pod nią akcje (dodaj produkt, tryb edycji, administracja, instalacja aplikacji) i ustawienia (motyw, odświeżanie, synchronizacja stanów, wylogowanie). Szufladę zamykasz przyciskiem X, dotknięciem tła, klawiszem Esc albo przesunięciem w lewo; wybór pozycji zamyka ją automatycznie. Aktywna zakładka dolnego paska jest podświetlona, a pozycje mają większe, wygodniejsze pola dotyku. Dotychczasowe okno „Więcej” wysuwane od dołu zastąpiła ta szuflada.',
    tag: 'nowość',
  },
  {
    date: '2026-10-26',
    title: 'Widok telefonu: lista produktów w wierszach, zwięzłe statystyki i szybkie filtry',
    description:
      'Katalog na telefonie ma nowy, czytelny układ. Domyślnie (przy pierwszym wejściu na telefonie) produkty są w wierszach: miniatura po lewej, nazwa do dwóch linii, pod nią SKU (dotknięcie kopiuje), znaczniki B/W i kategoria, a po prawej stan magazynowy w kolorze (zielony, żółty przy niskim, czerwony przy braku), cena i gwiazdka ulubionych. Cały wiersz jest dużym celem dotyku, który otwiera produkt, a wszystkie wiersze mają równą wysokość. Pasek statystyk to teraz jedna linia („4335 z 5597 · na stanie … · brak …”), którą rozwijasz dotknięciem; pod wyszukiwarką jest przewijany rząd szybkich filtrów (Wszystkie, Na stanie, Niski stan, Brak, Bez zdjęcia). Przełącznik widoku ma nową opcję „Lista” (jest też w profilu), a poprzednie kafelki zostają do wyboru. Widok listy działa również na większych ekranach w 2–3 kolumnach; w trybie edycji stanów i w zamówieniach nadal używane są karty.',
    tag: 'nowość',
  },
  {
    date: '2026-10-26',
    title: 'Naprawa: zdublowane zdjęcia dodatkowe w produktach',
    description:
      'Przyczyna: import zdjęć ze sklepu dokładał do produktu nowe zdjęcia (adresy wp-content) i jednocześnie zostawiał stare kopie tych samych plików (adresy /hpeciai/), przez co w galerii pojawiały się po dwa razy. W bazie oczyszczono 2448 produktów (usunięto 7228 zdublowanych adresów, z kopią zapasową poprzednich list w tabeli products_extra_images_backup), galeria w katalogu Akcesoria pomija teraz kopie i powtórzenia tak jak katalog Produkty, a skrypt importu zdjęć ze sklepu nie dokłada już starych kopii. Zdjęcia różniące się plikiem (np. dwie oferty tego samego produktu) zostają.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-23',
    title: 'Wydajność: szybsze wczytywanie listy produktów i odporność na awarię serwera zdjęć',
    description:
      'Lista produktów jest pobierana z bazy równolegle (wcześniej strony po 1000 produktów pobierały się jedna po drugiej), co skraca wczytywanie katalogu po zalogowaniu; gdyby baza nie zwróciła licznika, aplikacja wraca do bezpiecznego pobierania po kolei. Doszedł bezpiecznik hostów zdjęć: gdy zewnętrzny serwer zdjęć (np. sklep) przestaje odpowiadać i kilka różnych zdjęć z niego zawiedzie pod rząd, aplikacja na 5 minut przestaje o nie prosić — przełącza się na kolejne dostępne zdjęcie produktu albo pokazuje zastępnik z podpowiedzią „serwer zdjęć nie odpowiada”, zamiast trzymać setki zawieszonych żądań i puste karty przez kilkadziesiąt sekund. Własny magazyn zdjęć nie podlega temu bezpiecznikowi. Nowo wgrywane zdjęcia dostają długi czas przechowywania w pamięci podręcznej przeglądarki (adresy mają parametr wersji, więc zmiana zdjęcia nadal działa od razu).',
    tag: 'wydajność',
  },
  {
    date: '2026-10-21',
    title: 'Grupowe dopasowanie zdjęć produktu pod BaseLinker; aparat tylko na urządzeniach mobilnych',
    description:
      'W zakładce Zdjęcia produktu jest nowy przycisk „Dopasuj wszystkie zdjęcia pod BaseLinker”. Otwiera okno z miniaturami wszystkich zdjęć produktu (główne i dodatkowe), pokazuje ich wymiary i oznacza za małe (poniżej 500×500 px), które są domyślnie zaznaczone; wybierasz tryb (przeskalowanie lub kwadrat z dopełnieniem) i jednym kliknięciem przetwarzasz zaznaczone, z paskiem postępu. Zdjęcia są podmieniane w tej samej kolejności, a poprzednia wersja zdjęcia głównego zostaje zachowana do przywrócenia. Dotychczasowa opcja dla pojedynczego zdjęcia zostaje jako „Tylko to zdjęcie pod BaseLinker”. Przyciski „Aparat” / „Zrób zdjęcie” (w karcie produktu i przy dodawaniu produktu) pokazują się teraz wyłącznie na telefonach i tabletach — na komputerach ich nie ma.',
    tag: 'nowość',
  },
  {
    date: '2026-10-21',
    title: 'Wgrywanie wielu zdjęć naraz i odświeżona zakładka Zdjęcia w produkcie',
    description:
      'W karcie produktu można teraz wgrać kilka zdjęć jednym ruchem: przeciągnij je na pole wgrywania (albo na podgląd zdjęcia) lub kliknij „Wybierz pliki” i zaznacz wiele plików (Ctrl / Shift). Zdjęcia wgrywają się po kolei z paskiem postępu „Wgrywanie zdjęć 2 / 5”; jeśli produkt nie ma jeszcze zdjęcia głównego, pierwsze zostaje głównym, a pozostałe trafiają do galerii. Zakładka Zdjęcia ma nowy układ: duże pole wgrywania, osobna sekcja „Podmień zdjęcie główne” (z pliku lub z aparatu), „Obróbka wybranego zdjęcia” (wycinanie białego tła, przygotowanie pod BaseLinker, przywracanie) oraz licznik zdjęć. Naprawiono też skakanie do zakładki „Dane” po wgraniu zdjęcia: karta zostaje w zakładce Zdjęcia, a wybrane zdjęcie nie jest resetowane przy aktualizacji produktu.',
    tag: 'nowość',
  },
  {
    date: '2026-10-21',
    title: 'Zdjęcia produktu: zmiana kolejności przeciąganiem miniatur',
    description:
      'W podglądzie produktu miniatury zdjęć można przeciągać myszą w nowe miejsce — kolejność zapisuje się od razu, a pierwsze zdjęcie staje się zdjęciem głównym (widocznym na karcie w katalogu). Dla dotyku i klawiatury doszły przyciski „przesuń w lewo” i „przesuń w prawo” przy wybranym zdjęciu. Ręcznie ustawiona kolejność jest zachowywana także w katalogu Produkty (wcześniej zdjęcia dodatkowe były tam zawsze sortowane według źródła). Wymaga prawa wgrywania zdjęć.',
    tag: 'nowość',
  },
  {
    date: '2026-10-21',
    title: 'Segregacja produktów atrybutami: typ towaru, grupa części i konkretne właściwości z nazwy',
    description:
      'W sekcji Atrybuty doszła zakładka „Auto-uzupełnianie” oraz zestaw atrybutów segregujących (instalowany jednym kliknięciem, istniejących nie nadpisuje): Typ towaru (chemia, część do myjek, pianownica/opryskiwacz, sprzątanie, zapachy, dozowniki i higiena, sprzęt, usługa), Grupa części (dysze, lance i pistolety, węże i bębny, szybkozłącza, nyple i kolanka, zawory, pompy, uszczelnienia, filtry, manometry, obudowy), a także konkretne właściwości odczytywane z nazwy: kąt rozpylania i rozmiar dyszy, gwint/przyłącze, materiał, ciśnienie maksymalne, długość węża, pasuje do (marki myjek), pojemność (ml), masa (g) i forma produktu; dodatkowo Przeznaczenie do ręcznego wyboru. Program klasyfikuje po rzeczowniku głównym nazwy i oznacza propozycje jako „pewne” lub „do sprawdzenia”; można je filtrować po typie, poprawić typ i grupę przy produkcie, a zapis to jedna partia do cofnięcia w Logi → Operacje masowe. Atrybuty mogą teraz być zależne od innych (np. Grupa części pokazuje się tylko dla części, kąt dyszy tylko dla dysz) — ustawisz to w edycji atrybutu w polu „Pokazuj tylko, gdy”. Wymaga migracji migration-catalog-attributes-showwhen.sql (już wgrana).',
    tag: 'nowość',
  },
  {
    date: '2026-10-21',
    title: 'Podgląd zdjęcia: zamknięcie wraca do produktu, a nie do katalogu',
    description:
      'Po otwarciu podglądu zdjęcia w karcie produktu przycisk X, kliknięcie w tło podglądu oraz klawisz Esc zamykają teraz tylko podgląd i zostawiasz otwartą kartę produktu. Wcześniej kliknięcie „przechodziło” również do tła karty produktu i zamykało ją, wracając do listy katalogu. To samo naprawiono w oknach „Przygotuj zdjęcie” i „Usuń tło”.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-21',
    title: 'Porządek w migracjach: usunięto starą migrację poczty CRM',
    description:
      'Plik migration-crm-mailbox.sql (stara skrzynka e-mail w CRM, wyłączona) został usunięty z repozytorium, więc nie jest już sprawdzany w Logi → Migracje bazy i nie może wyświetlać się jako brakujący. Komunikaty w panelu poczty CRM nie odsyłają już do tej migracji, a dokumentacja bazy danych nie wymienia jej wśród migracji do uruchomienia.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-21',
    title: 'Menu boczne: własny podział na sekcje (przeciąganie pozycji między sekcjami)',
    description:
      'W trybie edycji menu (ikona zębatki) każdą pozycję można przeciągnąć do innej sekcji: upuszczenie na inną pozycję wstawia ją w tym miejscu tej sekcji, upuszczenie na nagłówek sekcji dodaje ją na koniec (puste sekcje też pokazują miejsce do upuszczenia). Własny podział zapisuje się razem z kolejnością i ukrytymi pozycjami (w profilu, więc działa na każdym urządzeniu), a przycisk „Przywróć domyślną kolejność” przywraca też domyślne sekcje. Domyślnie „Nowe produkty” trafiły do sekcji „Produkty”.',
    tag: 'nowość',
  },
  {
    date: '2026-10-20',
    title: 'Znacznik „Blokada WAPRO” oraz zwijane filtry i wyjątki w Uzupełnianiu danych',
    description:
      'Produkty ukryte automatycznie, bo są zablokowane w WAPRO, mają mały pomarańczowy znacznik „Blokada WAPRO” na karcie (obok „Ukryty”) i „WAPRO” w sekcji Ukryte, dzięki czemu odróżnisz je od ukryć ręcznych. W panelu bocznym Uzupełniania danych filtry (szybkie filtry braków, kategoria, producent, stan, katalog, sortowanie, liczba na stronie) są schowane pod przyciskiem „Filtry” — wyszukiwarka zostaje zawsze widoczna, a przy aktywnych filtrach pojawia się plakietka „aktywne”. Panel „Wyjątek dla zaznaczonych” też jest zwijany i domyślnie zamknięty.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-20',
    title: 'Artykuły zablokowane w WAPRO są automatycznie ukrywane w katalogu',
    description:
      'Synchronizacja z WAPRO sprawdza teraz blokadę artykułów (kolumna w tabeli ARTYKUL wykrywana automatycznie albo wskazana w pliku .env jako WAPRO_BLOCKED_COLUMN i WAPRO_BLOCKED_VALUE). Zablokowany artykuł dostaje w katalogu ukrycie z powodem „Zablokowany w WAPRO” (widać go w sekcji Ukryte, znika z listy katalogu), a po odblokowaniu w WAPRO sam wraca do katalogu — przywracane są tylko produkty ukryte przez tę funkcję, ręczne ukrycia zostają bez zmian. Zabezpieczenie: gdy wykryta kolumna oznaczałaby podejrzanie dużo artykułów (ponad 30% albo ponad 200 pozycji), nic nie jest ukrywane, a sprawa trafia do logu synchronizacji. Wymaga wgrania nowej wersji skryptu sync-wapro-stock-server.ps1 na serwer WAPRO; można ją wyłączyć wpisem WAPRO_BLOCKED_SYNC=0. Powód „Zablokowany w WAPRO” jest też na liście gotowych powodów ukrycia.',
    tag: 'nowość',
  },
  {
    date: '2026-10-20',
    title: 'Naprawa: produkty ze zdjęciami tylko z kenochem.com/hpeciai nie miały podglądu',
    description:
      'Część produktów (np. HYD000936 — wąż kanalizacyjny, kilka pianownic, dysze inżektora i trzy grupy dysz; łącznie 33 pozycje) miała zdjęcia w karcie, ale ani jednego na liście i w podglądzie. Przyczyną było pomijanie wszystkich adresów kenochem.com/hpeciai (bo galerie sklepu mają te same zdjęcia dwa razy), także gdy był to jedyny adres zdjęć produktu. Teraz takie adresy są używane jako rezerwa, gdy produkt nie ma żadnego innego źródła zdjęcia: pojawia się zdjęcie poglądowe i pełna galeria. Produkty, które mają zdjęcia z lepszych źródeł, działają jak dotąd.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-20',
    title: 'Wydajność: edycja produktu nie przelicza już całego katalogu',
    description:
      'Licznik w menu „Uzupełnianie danych” i lista braków były przeliczane od zera dla wszystkich produktów po każdej zmianie jednego z nich (ok. sekundy na komputerze, więcej na telefonie). Teraz braki niezależne od innych produktów są zapamiętywane per produkt i unieważniane tylko wtedy, gdy zmieni się sam produkt, jego kategoria, lista atrybutów, producenci albo powiązania z BaseLinkerem, więc po edycji liczy się praktycznie tylko ten jeden produkt (duplikaty i walidacje porównujące produkty między sobą nadal liczą się na bieżąco). Pierwsze wejście policzy wszystko od zera, ale w ok. połowie krótszym czasie niż wcześniej. Odświeżanie alertów katalogu (niski stan, brak zdjęć) czeka teraz 2,5 s po ostatniej zmianie zamiast liczyć się przy każdej.',
    tag: 'wydajność',
  },
  {
    date: '2026-10-20',
    title: 'Wydajność: szybszy start, statystyki i ocena kompletności produktów',
    description:
      'Kolejne usprawnienia: ocena kompletności produktu (używana na stronie startowej, w statystykach, filtrach i Uzupełnianiu danych) jest teraz zapamiętywana per produkt, więc po edycji jednego produktu przeliczany jest tylko on, a nie cały katalog. Przyspieszono rozpoznawanie kategorii (zapamiętane normalizacje fraz zamiast powtarzania ich dla każdego produktu: z ok. 1 s do ok. 0,15 s dla całego katalogu) i odczyt lokalnych lokalizacji magazynowych (bez wielokrotnego parsowania tych samych danych). Pasek statystyk nad listą liczy się z niższym priorytetem, żeby lista produktów pojawiała się pierwsza. Zmierzone na działającej stronie: wejście w katalog z ok. 1,4 s do ok. 0,7 s, a wyszukiwanie i czyszczenie wyszukiwarki nie powoduje już zauważalnych zacięć.',
    tag: 'wydajność',
  },
  {
    date: '2026-10-20',
    title: 'Wydajność: sortowanie katalogu kilkanaście razy szybsze',
    description:
      'Znaleziono i usunięto główną przyczynę przycinania katalogu: sortowanie listy (domyślnie po kategorii i nazwie) porównywało polskie napisy tak, że przy ponad 5 tysiącach produktów trwało od 1,5 do 5 sekund przy każdym wejściu do katalogu, wyczyszczeniu wyszukiwarki czy zmianie sortowania. Teraz porównania używają jednego, zapamiętanego mechanizmu (ten sam wynik sortowania), a klucze sortowania są liczone raz na produkt. Sortowanie całej listy trwa ułamek sekundy; poprawka działa też we wszystkich innych widokach z sortowaniem po polskich nazwach.',
    tag: 'wydajność',
  },
  {
    date: '2026-10-20',
    title: 'Kopiowanie nazwy produktu jednym kliknięciem',
    description:
      'Kliknięcie nazwy produktu kopiuje ją do schowka (pojawia się potwierdzenie „Skopiowano nazwę”), bez otwierania produktu. Działa na kartach w katalogu, w Uzupełnianiu danych, Standardzie nazw, Ukrytych, Zdjęciach do poprawy, Promocjach oraz w nagłówku karty produktu. Otwarcie produktu nadal jest pod zdjęciem i resztą karty, a zaznaczanie fragmentu nazwy myszą działa jak dotąd (przy zaznaczonym tekście kliknięcie nic nie kopiuje).',
    tag: 'nowość',
  },
  {
    date: '2026-10-20',
    title: 'Menu boczne w grupach: Produkty, Jakość danych, Słowniki, Analizy, System',
    description:
      'Menu boczne katalogu jest uporządkowane w zwijane grupy, jak w panelach typu BaseLinker. Na górze zostały codzienne pozycje (Start, Katalog, Ulubione, Foldery, Nowe produkty), a niżej: Produkty (Warianty pojemności, Grupy produktów, Zestawy, Promocje, Etykiety, Magazyn, Biblioteka), Jakość danych (Uzupełnianie danych, Standard nazw, Reguły jakości, Zdjęcia do poprawy, Ukryte), Słowniki (Kategorie, Producenci, Atrybuty), Analizy (Statystyki, Zmiany w czasie) i System (Logi, Aktualizacje, Administracja). Kliknięcie nagłówka zwija lub rozwija grupę (zapamiętujemy to w przeglądarce); zwinięta grupa pokazuje sumę liczników wymagających uwagi, a przejście do widoku z zwiniętej grupy rozwija ją. Edycja menu (kolejność i ukrywanie pozycji) działa jak dotąd. W „Wariantach pojemności” doszły: odrzucanie propozycji, które nie są wariantami (z możliwością przywrócenia), ostrzeżenie o różnych kategoriach wariantów i cena wariantu w podpowiedzi.',
    tag: 'nowość',
  },
  {
    date: '2026-10-20',
    title: 'Warianty pojemności: jeden produkt (np. zapach) w kilku pojemnościach jako grupa',
    description:
      'Nowa sekcja „Warianty pojemności” w menu wykrywa produkty, które różnią się tylko pojemnością lub wagą (np. olejek Kala Chanti Cashmere w 100 ml, 250 ml i 500 ml, także 1 kg), i proponuje połączenie ich w jedną grupę: jeden zapach = jedna grupa, a warianty to pojemności. Zdjęcie i cena grupy pochodzą z wariantu 500 ml (albo najbliższego 500 ml); wariant główny można zmienić jednym kliknięciem w pojemność, a nazwę grupy poprawić przed utworzeniem. Dostępne są filtry „Olejki i zapachy” oraz „Bez zdjęcia głównego”, a grupy tworzy się zbiorczo. Zakładka „Utworzone” pozwala odświeżyć zdjęcie grupy, gdy wariant główny dostanie nowe zdjęcie, oraz rozwiązać grupę (produkty zostają osobno). Synchronizacja stanów z WAPRO sumuje stan wariantów, a cenę grupy bierze z wariantu głównego. Na liście katalogu warianty są pokazane tylko wewnątrz grupy.',
    tag: 'nowość',
  },
  {
    date: '2026-10-20',
    title: 'Każdy produkt ma znacznik B lub W; warianty grup nie dublują się na liście',
    description:
      'Znacznik „W” (pomarańczowy) pojawia się teraz przy każdym produkcie z Mag WAPRO, którego nie ma jeszcze w BaseLinkerze, a „B” (niebieski) przy każdym powiązanym z ofertą — dzięki temu każdy produkt ma jeden z dwóch znaczników (wcześniej „W” miały tylko pozycje bez zdjęcia z importu). Grupy mają własny znacznik „Grupa”. Na liście katalogu produkty będące wariantami grupy są chowane, gdy sama grupa jest na liście (np. po wpisaniu „dysza wody 1/4” widać grupę, a jej warianty są w środku); wyszukiwanie po SKU lub EAN konkretnego wariantu nadal go pokazuje.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-20',
    title: 'Standard nazw produktów: kontrola i poprawianie nazw jednym kliknięciem',
    description:
      'Nowa sekcja „Standard nazw” w menu pilnuje wzoru PRODUCENT Nazwa własna Pojemność - krótki opis, do 60 znaków (celujemy w 50). Wykrywa: nazwy dłuższe niż 60 znaków, brak producenta na początku, inny zapis marki niż w pozostałych produktach marki, powtórzoną markę, brak pojemności (tylko tam, gdzie ma sens — akcesoria i części są pomijane), nieprawidłowy zapis pojemności (5L, 750ml, 20kg bez spacji), pojemność w złym miejscu, złe separatory, zbędne spacje, nazwy pisane wersalikami i zbyt krótkie. Dla każdej nazwy powstaje propozycja poprawki, którą można edytować; poprawki „bezpieczne” (sam porządek zapisu) zaznaczysz jednym przyciskiem, a skracanie opisu, dopisywanie producenta i zmiany wielkości liter są oznaczone do przeglądu. Zastosowanie jest jedną partią do cofnięcia w Logi → Operacje masowe. Które marki wymagamy w nazwie, ustawiasz w panelu „Marki w nazwach” (dostawcy i części typu HYDROFLEX są pomijane automatycznie); pojedynczy produkt można pominąć jako celowo nietypowy. Limit długości tytułu w walidacjach jakości zmieniono z 75 na 60 znaków.',
    tag: 'nowość',
  },
  {
    date: '2026-10-20',
    title: 'Zmiany w czasie: przegląd cen całego katalogu, alerty marży i wykres marży',
    description:
      'Zakładka „Zmiany w czasie” ma teraz dwa widoki. „Przegląd zmian cen” pokazuje wszystkie produkty, którym zmieniła się cena w wybranym okresie (24 h, 7 dni, 30 dni, wszystko): cenę zakupu i sprzedaży netto było → jest z procentem zmiany, marżę przed i po oraz kiedy to się stało; liczniki podwyżek i obniżek, filtry kierunku i tekstowy oraz eksport do CSV. Alerty marży wskazują: sprzedaż poniżej zakupu, marżę poniżej ustawionego progu, wzrost ceny zakupu przy niezmienionej sprzedaży i duże skoki cen (możliwe błędy w WAPRO); progi (minimalna marża, skok w %) ustawiasz przyciskiem „Progi alertów”. Kliknięcie produktu otwiera „Historię produktu”, gdzie do wykresów cen i stanu doszedł wykres „Marża w czasie” (w % i w zł).',
    tag: 'nowość',
  },
  {
    date: '2026-10-20',
    title: 'Cienkie paski przewijania bez białego tła',
    description:
      'W całym katalogu paski przewijania są teraz smukłe i przezroczyste: widoczny jest tylko zaokrąglony uchwyt (jak w nowoczesnych przeglądarkach), bez białego tła i strzałek. Uchwyt lekko podświetla się po najechaniu.',
    tag: 'poprawka',
  },
  {
    date: '2026-10-19',
    title: 'Nowa strona startowa: powitanie, wyszukiwarka, zdrowie katalogu i proponowany następny krok',
    description:
      'Ekran startowy katalogu został zaprojektowany od nowa. Na górze duży baner z powitaniem po imieniu, datą, wyszukiwarką produktu (nazwa, SKU, EAN, producent — Enter od razu otwiera katalog z wynikami), przyciskiem „Skanuj EAN” i czterema wskaźnikami: produkty, na stanie, ze zdjęciem i średnia jakość danych. Niżej karta „Proponowany następny krok” wyliczana z danych (co najbardziej podniesie jakość katalogu, z przyciskiem „Zacznij teraz” otwierającym właściwą listę) oraz kolejne zalecenia, a sekcja „Zdrowie katalogu” pokazuje cztery pierścienie postępu: jakość danych, zdjęcia, kody EAN i pokrycie w BaseLinkerze. Dalej są kafle narzędzi i skrótów z liczbami, aktywność (nowości z WAPRO i ostatnie zmiany w produktach wykonane przez zespół), informacja o najnowszej aktualizacji katalogu z numerem wersji oraz biblioteka.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Atrybuty produktów (parametry strukturalne) i reguły jakości',
    description:
      'Dwie nowe sekcje w menu. Atrybuty: definiujesz parametry (pojemność, stężenie, zapach, kolor…) z typem (tekst, liczba, lista wartości, tak/nie), jednostką, listą dozwolonych wartości i kategoriami, w których obowiązują (razem z podkategoriami); atrybut można oznaczyć jako wymagany — brak wartości jest wtedy zgłaszany w Uzupełnianiu danych. W karcie produktu pojawia się panel „Parametry produktu” z polami zależnymi od kategorii (podgląd i edycja), atrybut można ustawić hurtem w Edycji masowej (z cofaniem), kolumny atrybutów są dostępne w eksporcie CSV, a Statystyki pokazują pokrycie atrybutów. Reguły jakości: „jeśli produkt spełnia wszystkie warunki (nazwa, SKU, producent, kategoria, EAN, stan, cena, zdjęcie, tag), to wykonaj akcję” — ustaw kategorię lub producenta, dodaj tag, ukryj albo ustaw wyjątek. Każda reguła pokazuje na żywo, ilu produktów dotyczy, i ma podgląd listy; uruchomienie to jedna partia do cofnięcia w Logi → Operacje masowe. Są gotowe szablony (np. Śmietnik Piotra, części myjek). Wymaga migracji migration-catalog-attributes.sql i migration-catalog-rules.sql oraz uprawnień „Kategorie” (atrybuty) i „Reguły jakości”.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Walidacje jakości danych: błędne EAN, duplikaty, niespójne ceny i tytuły',
    description:
      'Uzupełnianie danych wykrywa teraz błędy jakości, nie tylko braki. Sprawdzamy: poprawność kodu EAN (długość i cyfra kontrolna GS1: EAN-8, UPC-A, EAN-13, GTIN-14), duplikaty EAN i duplikaty nazw (z podaniem, z jakimi SKU się powtarzają; ten sam produkt w dwóch katalogach nie jest duplikatem), sprzedaż netto poniżej ceny zakupu, niespójność ceny brutto z netto i VAT, tytuł dłuższy niż 75 znaków oraz nazwy ze zbędnymi spacjami lub pisane samymi wielkimi literami. Każdy rodzaj błędu ma własny filtr z licznikiem na liście, a w Statystykach pojawił się wykres „Walidacje jakości danych” (kliknięcie otwiera właściwą listę) i podpowiedzi w „Następnym kroku”. Produkty, które mają tak być, można wyłączyć gotowym wyjątkiem „Ignoruj walidacje jakości”.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Etykiety: zmiana ceny brutto na etykiecie i wyrównywanie końcówek (,99 / ,00 …)',
    description:
      'W Studiu etykiet można teraz zmienić cenę brutto, która idzie na etykietę (np. z dziwnej 31,81 zł na 31,90 zł) — zmiana dotyczy tylko etykiety, cena w katalogu zostaje bez zmian. W edycji pozycji (ołówek) jest pole ceny, informacja o cenie z katalogu, przycisk „przywróć z katalogu” oraz przyciski wyrównania z podglądem wyniku dla danej ceny: ,99 w dół / w górę / najbliższa, ,00 w dół / w górę / najbliższa, ,90 i ,50 najbliższa (np. 31,81 → 30,99 / 31,99 / 31,00 / 32,00). Nad listą „Do wydruku” jest wyrównanie dla wszystkich etykiet naraz (z opcją „także ceny promocyjne”) i przywrócenie wszystkich cen z katalogu. Przy pozycji widać aktualną cenę z oznaczeniem „zmieniona”, a cena netto jest przeliczana według VAT produktu.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Edycja masowa i szybka edycja w wierszu w Uzupełnianiu danych',
    description:
      'Nowe narzędzia w Uzupełnianiu danych. Edycja masowa zaznaczonych produktów: producent, kategoria, stawka VAT, jednostka, tagi (dodawanie i usuwanie) oraz ceny — ustaw wartość, zmień o procent albo o kwotę, z zaokrągleniem (do grosza, 10 groszy, złotych, końcówka ,99 lub ,90) i opcjonalnym przeliczeniem drugiej ceny sprzedaży netto ↔ brutto wg VAT. Przed zapisem jest podgląd „stare → nowe” dla każdego produktu i podsumowanie, a cała operacja zapisuje się jako jedna partia, którą można cofnąć (Logi → Operacje masowe). Szybka edycja w wierszu: przycisk „Szybka edycja” rozwija pola EAN (z ostrzeżeniem o nietypowej długości), producent, kategoria i cena sprzedaży brutto — zapis bez otwierania karty. Edycja wymaga uprawnienia edycji produktów, zmiany cen także uprawnienia do cen.',
    tag: 'nowość',
  },
  {
    date: '2026-10-19',
    title: 'Historia zmian produktu z cofaniem oraz operacje masowe do cofnięcia',
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
