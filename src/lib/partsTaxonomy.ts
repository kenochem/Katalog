/**
 * Szczegółowy układ kategorii dla części technicznych myjek, odkurzaczy, opryskiwaczy i osprzętu oraz reguły
 * rozpoznawania produktów po nazwie. Działy i 3 poziomy zostają, a kategoria „Części do myjek” jest rozbita na
 * konkretne grupy (węże, złączki, lance, zawory, pompy, uszczelnienia, zbiorniki).
 *
 * Reguły przypisują produkt do kategorii liścia, gdy nazwa jednoznacznie wskazuje część techniczną —
 * także wtedy, gdy produkt wylądował w zupełnie innej kategorii (np. rurka do zbiornika w „Łazienki i sanitariaty”).
 */
import { MANUAL_ASSIGNMENTS } from '../data/manualAssignments';
import { REVIEWED_ASSIGNMENTS } from '../data/reviewedAssignments';
import { fold } from './partsText';

export interface TaxonomyGroup {
  /** Dział (poziom 1). */
  dept: string;
  /** Podkategoria (poziom 2) — istniejąca zostaje, brakująca jest tworzona. */
  group: string;
  /** Kategorie (poziom 3) dodawane do grupy. */
  leaves: string[];
}

const MYJNIA = 'Myjnia samochodowa';
const SPRZET = 'Sprzęt i akcesoria czyszczące';
const PROF = 'Chemia profesjonalna';
const AUTO = 'Chemia samochodowa';
const SPEC = 'Chemia specjalistyczna';
const DOM = 'Dom i ogród';
const ZAPACHY = 'Zapachy i aromamarketing';

/**
 * Grupy i kategorie dodawane do drzewa sklepu (istniejąca grupa zostaje i dostaje brakujące kategorie, brakująca jest tworzona).
 * Każdy dział ma 4–8 podkategorii (2. poziom), a kategorie z 0–4 produktami zostały scalone z sąsiednimi.
 */
export const TAXONOMY_GROUPS: TaxonomyGroup[] = [
  // --- Myjnia samochodowa (8 grup) ---
  { dept: MYJNIA, group: 'Węże i bębny', leaves: ['Węże wysokociśnieniowe', 'Węże do chemii i natrysku', 'Węże kanalizacyjne', 'Bębny i zwijaki'] },
  { dept: MYJNIA, group: 'Złączki i szybkozłącza', leaves: ['Nyple', 'Złącza obrotowe', 'Redukcje i adaptery', 'Szybkozłącza', 'Trójniki, kolanka i złączki'] },
  { dept: MYJNIA, group: 'Lance, pistolety i dysze', leaves: ['Lance', 'Pistolety', 'Dysze', 'Dysze obrotowe', 'Pianownice do myjek'] },
  {
    dept: MYJNIA,
    group: 'Zawory, filtry i armatura',
    leaves: ['Zawory zwrotne', 'Zawory by-pass i bezpieczeństwa', 'Zawory pozostałe', 'Inżektory chemii', 'Filtry i sitka', 'Manometry'],
  },
  { dept: MYJNIA, group: 'Myjki i pompy', leaves: ['Myjki ciśnieniowe', 'Pompy i głowice', 'Silniki i elementy elektryczne'] },
  {
    dept: MYJNIA,
    group: 'Uszczelnienia, zbiorniki i montaż',
    leaves: ['O-ringi', 'Uszczelki i uszczelniacze', 'Komplety naprawcze', 'Obudowy, sprężyny i elementy montażowe', 'Zbiorniki', 'Rurki i ssaki chemii'],
  },
  {
    dept: MYJNIA,
    group: 'Odkurzacze i wyposażenie myjni',
    leaves: ['Akcesoria do odkurzaczy', 'Odkurzacze', 'Części do odkurzaczy', 'Tornadory', 'Szczotki do myjni', 'Pokrowce, folie i uchwyty'],
  },
  // --- Sprzęt i akcesoria czyszczące (7 grup) ---
  { dept: SPRZET, group: 'Opryskiwacze i dozowanie', leaves: ['Części do opryskiwaczy'] },
  { dept: SPRZET, group: 'Ochrona osobista', leaves: ['Maski i okulary ochronne'] },
  { dept: SPRZET, group: 'Mikrofibry, gąbki i pady', leaves: ['Pędzle i aplikatory detailingowe', 'Gąbki i zmywaki'] },
  { dept: SPRZET, group: 'Szczotki, miotły i zmiotki', leaves: ['Miotły i szczotki do podłóg', 'Szczotki przemysłowe i HACCP', 'Zmiotki i szufelki'] },
  { dept: SPRZET, group: 'Opakowania i oznakowanie', leaves: ['Folie, torby i opakowania', 'Znaki i tablice ostrzegawcze'] },
  // --- Chemia profesjonalna (5 grup) ---
  { dept: PROF, group: 'Chemia obiektowa', leaves: ['Pisuary i kostki WC'] },
  { dept: PROF, group: 'Kuchnia i gastronomia', leaves: ['Mycie i odtłuszczanie kuchni'] },
  { dept: PROF, group: 'Pranie, dywany i tekstylia', leaves: ['Płyny, żele i proszki do prania', 'Odplamiacze', 'Pranie dywanów i tapicerki'] },
  // --- Chemia samochodowa (7 grup) ---
  { dept: AUTO, group: 'Elementy zewnętrzne', leaves: ['Plastiki, gumy i chrom'] },
  { dept: AUTO, group: 'Mycie samochodu', leaves: ['APC, pre-wash i TFR', 'Mycie pojazdów ciężarowych'] },
  { dept: AUTO, group: 'Pielęgnacja lakieru', leaves: ['Glinki i przygotowanie lakieru'] },
  { dept: AUTO, group: 'Szyby i szkło', leaves: ['Powłoki do szyb', 'Reflektory i lampy'] },
  // --- Chemia specjalistyczna (6 grup) ---
  {
    dept: SPEC,
    group: 'Chemia warsztatowa i techniczna',
    leaves: ['Oleje i płyny eksploatacyjne', 'Żarówki i drobne części samochodowe', 'Płyny do myjek ultradźwiękowych i DPF'],
  },
  { dept: SPEC, group: 'Rolnictwo i gospodarstwo', leaves: ['Mycie maszyn rolniczych', 'Higiena inwentarska i udojowa'] },
  { dept: SPEC, group: 'Smary i preparaty techniczne', leaves: ['Smary i oleje techniczne'] },
  { dept: SPEC, group: 'Woda i chemia basenowa', leaves: ['Uzdatnianie wody', 'Chemia basenowa'] },
  { dept: SPEC, group: 'Zmywacze, odtłuszczacze i odrdzewiacze', leaves: ['Usuwanie betonu i cementu', 'Kwasy i zasady przemysłowe'] },
  // --- Dom i ogród (4 grupy) ---
  { dept: DOM, group: 'Chemia do domu', leaves: ['Środki uniwersalne i meble'] }, // + „Łazienka i WC” i „Pranie” ze sklepu: tylko marki marketowe
  { dept: DOM, group: 'Akcesoria domowe', leaves: ['Mycie okien', 'Ściereczki i ścierki', 'Worki na śmieci', 'Zmywanie naczyń'] },
  { dept: DOM, group: 'Czyszczenie zewnętrzne', leaves: ['Elewacje, dachy i mech'] },
  { dept: DOM, group: 'Ogród i zima', leaves: ['Narzędzia ogrodowe', 'Odśnieżanie i zima'] },
  // --- Zapachy (4 grupy) ---
  { dept: ZAPACHY, group: 'Aromamarketing', leaves: ['Prezentery i akcesoria zapachowe'] },
];

/**
 * Kategorie i grupy usuwane z drzewa sklepu (po nazwie, wraz z podkategoriami). Część z nich wraca pod nową grupą
 * (np. „Pianownice do myjek”), reszta została scalona — patrz REMAP_REMOVED.
 */
export const TAXONOMY_REMOVED = [
  // części do myjek rozbite na grupy
  'Płyny do szyb do myjni', 'Środki ekologiczne', 'Dywany i tapicerka domowa', 'Podłogi',
  'Części do myjek', 'Akcesoria do myjek', 'Dysze do myjek', 'Filtry, redukcje i zawory', 'Lance i pistolety', 'Szybkozłącza i adaptery',
  'Odkurzacze i tapicerka', 'Wyposażenie stanowisk mycia', 'Pianownice i oprysk',
  // puste lub zbędne działy
  'Osady wapienne', 'Chemia sezonowa', 'Transport i pojazdy specjalne', 'Myjki ultradźwiękowe i DPF', 'Odświeżanie domu', 'Akcesoria domowe',
  'Pranie dywanów i tapicerki', 'Pranie i tekstylia', 'Rolnictwo i gospodarstwo', 'Uzdatnianie wody',
  // akcesoria domowe, które przechodzą do działu Sprzęt (w Dom i ogród zostają mycie okien, ścierki, worki, zmywanie)
  'Miotły i szczotki', 'Mopy i wiadra', 'Mycie podłóg', 'Ściereczki do kurzu',
  // kuchnia
  'Mycie urządzeń gastronomicznych', 'Odtłuszczanie kuchni', 'Płyny nabłyszczające do zmywarek',
  // chemia samochodowa
  'Chrom i metale', 'Dachy cabrio', 'Gumy i uszczelki', 'Plastiki zewnętrzne', 'Krwawa felga', 'Neutralne płyny do felg', 'Kwaśne płyny do felg',
  'APC do samochodu', 'Pre-wash i TFR', 'Preparaty do mocnych zabrudzeń', 'Antypara', 'Niewidzialne wycieraczki', 'Klimatyzacja samochodowa',
  // specjalistyczna
  'Czyściwa warsztatowe', 'Mycie części i narzędzi', 'Dodatki do paliwa', 'Smary ceramiczne, miedziowe i grafitowe', 'Smary do łańcuchów', 'Smary techniczne',
  'Usuwanie kleju i etykiet',
  // dom i ogród
  'Kuchnia i odtłuszczanie', 'Mycie szyb i luster', 'Meble', 'Dachy', 'Elewacje', 'Markizy i zadaszenia', 'Usuwanie mchu i zabrudzeń',
  // myjnia
  'Portalowa', 'Ręczna', 'Samoobsługowa', 'Tunelowa', 'Szampony do myjni', 'Proszki do myjni samochodowych', 'Preparaty do owadów, smoły i asfaltu',
  'Odkurzacze piorące', 'Pistolety piorące', 'Pokrowce i folie na stanowiska mycia', 'Uchwyty do dywaników', 'Ściągaczki do wody na myjni',
  // sprzęt
  'Ręczniki do osuszania', 'Szczotki do podłóg', 'Miotły przemysłowe', 'Szczotki do kostki brukowej', 'Szczotki Vikan', 'Gumowe ściągaczki Vikan',
  'Akcesoria do ściągaczek', 'Ściągaczki do szyb i wody', 'Gąbki i rękawice',
  // zapachy
  'Neutralizatory do pomieszczeń i pojazdów', 'Zapachy do klimatyzacji',
];

/**
 * Gdzie trafia produkt ze zlikwidowanej lub scalonej kategorii, jeśli żadna reguła nazwy go nie rozpoznała.
 * Wartość to kategoria (liść) istniejąca w nowym drzewie.
 */
export const REMAP_REMOVED: Record<string, string> = {
  // duble kategorii (domowe odpowiedniki profesjonalnych) i pusta para „do szyb do myjni”
  'Płyny do szyb do myjni': 'Płyny do szyb samochodowych',
  'Środki ekologiczne': 'Ekologiczne środki czystości',
  'Dywany i tapicerka domowa': 'Pranie dywanów i tapicerki',
  'Podłogi': 'Podłogi i posadzki',
  // części do myjek
  'Akcesoria do myjek': 'Lance',
  'Dysze do myjek': 'Dysze',
  'Filtry, redukcje i zawory': 'Zawory pozostałe',
  'Lance i pistolety': 'Lance',
  'Szybkozłącza i adaptery': 'Redukcje i adaptery',
  'Węże i bębny': 'Węże wysokociśnieniowe',
  'Zlaczki i adaptery': 'Redukcje i adaptery',
  'Weze i zakucia': 'Węże wysokociśnieniowe',
  'Korki i zaślepki': 'Trójniki, kolanka i złączki',
  'Uchwyty, rękojeści i końcówki': 'Lance',
  'Pędzle i szczoteczki detailingowe': 'Pędzle i aplikatory detailingowe',
  'Narzędzia ogrodowe i zimowe': 'Narzędzia ogrodowe',
  // chemia profesjonalna
  'Mycie urządzeń gastronomicznych': 'Mycie i odtłuszczanie kuchni',
  'Odtłuszczanie kuchni': 'Mycie i odtłuszczanie kuchni',
  'Płyny nabłyszczające do zmywarek': 'Chemia do zmywarek',
  'Odplamiacze do tkanin': 'Odplamiacze',
  'Odplamiacze do dywanów i tapicerki': 'Odplamiacze',
  'Płyny do płukania': 'Płyny, żele i proszki do prania',
  'Płyny i żele do prania': 'Płyny, żele i proszki do prania',
  'Proszki do prania': 'Płyny, żele i proszki do prania',
  'Pranie odzieży roboczej': 'Płyny, żele i proszki do prania',
  'Pranie tapicerki': 'Pranie dywanów i tapicerki',
  // chemia samochodowa
  'Chrom i metale': 'Plastiki, gumy i chrom',
  'Dachy cabrio': 'Plastiki, gumy i chrom',
  'Gumy i uszczelki': 'Plastiki, gumy i chrom',
  'Plastiki zewnętrzne': 'Plastiki, gumy i chrom',
  'Krwawa felga': 'Płyny do felg',
  'Neutralne płyny do felg': 'Płyny do felg',
  'Kwaśne płyny do felg': 'Płyny do felg',
  'APC do samochodu': 'APC, pre-wash i TFR',
  'Pre-wash i TFR': 'APC, pre-wash i TFR',
  'Preparaty do mocnych zabrudzeń': 'APC, pre-wash i TFR',
  'Antypara': 'Powłoki do szyb',
  'Niewidzialne wycieraczki': 'Powłoki do szyb',
  'Klimatyzacja samochodowa': 'Zapachy i neutralizatory do samochodu',
  'Czyszczenie wnętrza samochodu': 'Kokpit i plastiki',
  // chemia specjalistyczna
  'Czyściwa warsztatowe': 'Utrzymanie czystości w warsztacie',
  'Mycie części i narzędzi': 'Utrzymanie czystości w warsztacie',
  'Dodatki do paliwa': 'Oleje i płyny eksploatacyjne',
  'Płyny eksploatacyjne': 'Oleje i płyny eksploatacyjne',
  'Czyszczenie DPF/FAP': 'Płyny do myjek ultradźwiękowych i DPF',
  'Płyny do myjek ultradźwiękowych': 'Płyny do myjek ultradźwiękowych i DPF',
  'Chemia do wędzarni': 'Higiena inwentarska i udojowa',
  'Higiena budynków inwentarskich': 'Higiena inwentarska i udojowa',
  'Mycie i dezynfekcja urządzeń udojowych': 'Higiena inwentarska i udojowa',
  'Dezynfekcja pojazdów': 'Dezynfekcja pojazdów specjalistyczna',
  'Smary ceramiczne, miedziowe i grafitowe': 'Smary i oleje techniczne',
  'Smary do łańcuchów': 'Smary i oleje techniczne',
  'Smary techniczne': 'Smary i oleje techniczne',
  'Usuwanie kleju i etykiet': 'Odtłuszczacze przemysłowe',
  // dom i ogród
  'Miotły i szczotki': 'Miotły i szczotki do podłóg',
  'Mopy i wiadra': 'Mopy i stelaże',
  'Mycie podłóg': 'Mopy i stelaże',
  'Ściereczki do kurzu': 'Ściereczki i ścierki',
  'Kuchnia i odtłuszczanie': 'Środki uniwersalne i meble',
  'Mycie szyb i luster': 'Środki uniwersalne i meble',
  'Meble': 'Środki uniwersalne i meble',
  'Dachy': 'Elewacje, dachy i mech',
  'Elewacje': 'Elewacje, dachy i mech',
  'Markizy i zadaszenia': 'Elewacje, dachy i mech',
  'Usuwanie mchu i zabrudzeń': 'Elewacje, dachy i mech',
  'Odświeżacze powietrza': 'Odświeżacze w sprayu',
  'Zapachy do domu': 'Olejki i esencje zapachowe',
  'Neutralizatory zapachów do domu': 'Neutralizatory zapachów',
  // myjnia
  'Portalowa': 'Chemia specjalistyczna do myjni',
  'Ręczna': 'Chemia specjalistyczna do myjni',
  'Samoobsługowa': 'Chemia specjalistyczna do myjni',
  'Tunelowa': 'Chemia specjalistyczna do myjni',
  'Szampony do myjni': 'Aktywne piany do myjni',
  'Proszki do myjni samochodowych': 'Aktywne piany do myjni',
  'Preparaty do owadów, smoły i asfaltu': 'Preparaty do felg do myjni',
  'Odkurzacze piorące': 'Odkurzacze',
  'Pistolety piorące': 'Tornadory',
  'Opryskiwacze pianujące': 'Pianownice do myjek',
  'Pianownice ręczne': 'Pianownice do myjek',
  'Opryskiwacze ciśnieniowe do myjni': 'Opryskiwacze ciśnieniowe uniwersalne',
  'Pokrowce i folie na stanowiska mycia': 'Pokrowce, folie i uchwyty',
  'Uchwyty do dywaników': 'Pokrowce, folie i uchwyty',
  'Ściągaczki do wody na myjni': 'Ściągaczki do podłogi',
  // sprzęt
  'Ręczniki do osuszania': 'Mikrofibry uniwersalne',
  'Szczotki do podłóg': 'Miotły i szczotki do podłóg',
  'Miotły przemysłowe': 'Miotły i szczotki do podłóg',
  'Szczotki do kostki brukowej': 'Miotły i szczotki do podłóg',
  'Szczotki Vikan': 'Szczotki przemysłowe i HACCP',
  'Gumowe ściągaczki Vikan': 'Ściągaczki do podłogi',
  'Akcesoria do ściągaczek': 'Ściągaczki do podłogi',
  'Ściągaczki do szyb i wody': 'Ściągaczki do szyb',
  'Gąbki i rękawice': 'Gąbki i zmywaki',
  // zapachy
  'Neutralizatory do pomieszczeń i pojazdów': 'Neutralizatory zapachów',
  'Zapachy do klimatyzacji': 'Puszki zapachowe',
  'Worki do odkurzacza': 'Akcesoria do odkurzaczy',
};

interface Rule {
  leaf: string;
  /** Wzorzec na znormalizowanej nazwie (małe litery, bez polskich znaków). */
  re: RegExp;
  /** Jednoznaczne słowo (np. „nypel”, „o-ring”) — działa dla każdego indeksu; pozostałe reguły tylko dla indeksów części. */
  any?: boolean;
}

/** Kolejność ma znaczenie: pierwsza pasująca wygrywa. Bardziej szczegółowe reguły są wyżej. */
const RULES: Rule[] = [
  // --- rodzaj produktu ma pierwszeństwo przed zastosowaniem: pokrowiec, ściągaczka, gąbka, ściereczka to akcesoria, nie chemia ---
  { leaf: 'Pokrowce, folie i uchwyty', re: /pokrowc\w* ochronn|pokrowiec ochronny|dywanik foliowy|folia ochronna/, any: true },
  { leaf: 'Skrobaczki do szyb', re: /skrobaczk/, any: true },
  { leaf: 'Odśnieżanie i zima', re: /usuwania sniegu|lopata snieg|zgarniacz do sniegu/, any: true },
  { leaf: 'Mycie okien', re: /myjka.*(szyb|okien|sciagaczk)|myjka ze sciagaczka|uchwyt myjki/, any: true },
  {
    leaf: 'Ściągaczki do podłogi',
    re: /^(?!.*(plyn|\bmop|stojak|szczotk|potykacz|szyb|okien|kij do mopa)).*(sciag\w*.*podlog|podlog\w*.*sciag|zbierak|guma wymienna|105 ?cm|uchwyt mini pasuje|skrobak podlogowy)/,
    any: true,
  },
  { leaf: 'Ściągaczki do szyb', re: /^(?!.*(kij do mopa|plyn|preparat|spray|podlog)).*(sciagacz|sciagaczk)/, any: true },
  { leaf: 'Reflektory i lampy', re: /^(?!.*(szyb|luster)).*(reflektor|lamp doctor|lamp protect|headlight|quixx light)/, any: true },
  { leaf: 'Pady i futra polerskie', re: /^(?!.*(krazek|gumowy)).*(\bpady?\b|futro|\broller\b|polerka (flex|ld)|^polerka|gabk\w* polersk|gabka do polerowania)/, any: true },
  { leaf: 'Gąbki i zmywaki', re: /^(?!.*(naczyn|kuchenn|polersk|polerowania))(?!.*\b(mop|mopa|mopy|trzonek|kij|kija)\b).*(gabk|magic sponge)|^(?!.*\b(mop|mopa|mopy|trzonek|kij|kija)\b).*(rekawic\w*.*(mycia|polerow|chenille|wash mitt|fredz|mikrofib)|rekawica.*(teddy|car set)|wash mitt|\bmitt\b)/, any: true },
  { leaf: 'Zmywanie naczyń', re: /zmywak|druciak|czyscik|gabk\w*.*(naczyn|kuchenn)/, any: true },
  { leaf: 'Ściereczki i ścierki', re: /kuchenn\w*.*scierecz|scierecz\w*.*kuchenn|scierki kuchenne/, any: true },
  {
    leaf: 'Mikrofibry uniwersalne',
    re: /^(?!.*(plak|atas|wosk|wax|szampon|mleczko|plyn|pasta|spray|szczotk|myjka|mop|trzonek|kij|bathroom|kokpit|do tapicerki)).*(mikrofibr|mikrowlokn|szmatk\w* z mikro|ircha|scierecz\w*|recznik\w* (do )?osusz)/,
    any: true,
  },
  { leaf: 'Płyny do spryskiwaczy', re: /plyn\w* (zimowy |letni )?do spryskiwacz|koncentrat letniego plynu do spryskiwacz/, any: true },
  { leaf: 'Powłoki do szyb', re: /antypara|anty-para|antyroszen|rain-x|zapobiega zaparowaniu|przeciw parowaniu/, any: true },
  { leaf: 'Tapicerka materiałowa', re: /pianka\w*.*tapicer|tapicer\w*.*pianka/, any: true },
  { leaf: 'Skóra samochodowa', re: /pianka.*skor|mleczko do czyszczenia skory/, any: true },
  { leaf: 'Dressingi i czernidła do opon', re: /pianka do opon|pianka.*opon|nablyszczani\w* opon|czarna opona|wet look/, any: true },
  { leaf: 'Płyny do szyb samochodowych', re: /pianka do szyb|pianka.*szyb/, any: true },
  { leaf: 'APC, pre-wash i TFR', re: /^(?!.*(elewacj|dach)).*(\bapc\b|smart foam)/, any: true },
  { leaf: 'Mycie pojazdów ciężarowych', re: /^(?!.*(\bnf\b|posadzek|ropopochodn)).*(dostawczych, ciezarowych|ciezarowych, plandek|super green specjal)|truck wash/, any: true },
  { leaf: 'Czyszczenie pieców, grilli i frytkownic', re: /wedzarni, piekarnikow|gran smog/, any: true },
  { leaf: 'Podłogi i posadzki', re: /^(?!.*bruk).*(posadzek|posadzki|tfc coating)/, any: true },
  { leaf: 'Higiena inwentarska i udojowa', re: /kurnik|obory|chlewni|inwentarsk/, any: true },
  { leaf: 'Mycie i odtłuszczanie kuchni', re: /maszyn do lodow|automatow do smietany/, any: true },
  { leaf: 'Odkamienianie urządzeń', re: /^(?!.*(wc|toalet|toilet|lazien|sanit|prysznic|urinex|pisuar)).*(odkamieniacz|derast|destone|entkalker)/, any: true },
  { leaf: 'Deironizery i osady metaliczne', re: /usuwania nalotow rdzy|naloty rdzy/, any: true },
  { leaf: 'Płyny do felg', re: /krwawiaca felga|kolorowa felga|krwawa felga|szczotko ?gabka do felg/, any: true },
  { leaf: 'Quick detailery', re: /quick detailer|speed protect|ultra slick detailer|brilliant shine detailer|interior detailer|carnauba spray|ceramic.*detailer|ppf.*detailer/, any: true },
  { leaf: 'Testery i kleje techniczne', re: /tlumik|wydech|klej cyjano/, any: true },
  { leaf: 'Smary i oleje techniczne', re: /kontakt spray|czyszczenia styk|cynk naprawczy/, any: true },
  { leaf: 'Folie, torby i opakowania', re: /folia spozywcza|folia stretch|^strecz/, any: true },
  { leaf: 'Plastiki, gumy i chrom', re: /polytrol|pasta do chromu|przywraca kolor/, any: true },
  { leaf: 'Kokpit i plastiki', re: /matt max|satina pro|mleczko do plastikow|nablyszczajacy 750/, any: true },
  { leaf: 'Zapachy i neutralizatory do samochodu', re: /klima power cleaner|smoke ex\b|air freshener zapach samochodowy/, any: true },
  { leaf: 'Aktywne piany', re: /^(?!.*(ciezarow|truck)).*(bezdotykowego mycia|diamond wash)/, any: true },
  { leaf: 'Chemia specjalistyczna do myjni', re: /anti-?foam|odpieniacz|de-foam/, any: true },
  { leaf: 'Pasty polerskie', re: /mleczko do usuwania rys|pasta lekkoscierna|^(?!.*(carnauba)).*(politura|perfect finish)/, any: true },
  { leaf: 'Części do odkurzaczy', re: /podstawa uchwytu silnika/, any: true },
  { leaf: 'Wiadra i wyciskarki', re: /^wiadro|wiadro \d+ ?l/, any: true },
  { leaf: 'Tornadory', re: /^(?!.*(recznik|wiadro|separator|detailing|mikrofib)).*(tornador|benbow \d)/, any: true },
  { leaf: 'Komplety naprawcze', re: /(komplet|zestaw|kpl\.?)\s+(naprawcz|napr\.)|naprawczy\s+(zawor|by|pomp|ins|zl)/ },
  { leaf: 'O-ringi', re: /\bo[- ]?ring|\boringi?\b/, any: true },
  { leaf: 'Uszczelki i uszczelniacze', re: /uszczelni|uszczelk|nic uszczelniajaca|gumka uszczelni|podkladka uszcz/ },
  // opryskiwacze Kwazar i ich części
  { leaf: 'Maski i okulary ochronne', re: /polmaska|okulary ochronne|pochlaniacz|maseczka/, any: true },
  { leaf: 'Odśnieżanie i zima', re: /lopata snieg|zgarniacz do sniegu/, any: true },
  { leaf: 'Narzędzia ogrodowe', re: /grabie|chwytak na kiju/, any: true },
  { leaf: 'Części do opryskiwaczy', re: /kwazar.*(pompk|uszczelek|trzpien|serwis|rekojesc|przegub|spieniaj|osloniaherbic|oslona)|pompka (do opryskiwacza|do oprysku)|zes\.kon\. spieniajacej|sprezyna opryskiwacza/, any: true },
  { leaf: 'Opryskiwacze ciśnieniowe uniwersalne', re: /kwazar.*(opryskiwacz|nix|accu)|kwazar stojak/, any: true },
  // pianownice
  { leaf: 'Pianownice do myjek', re: /^(?!.*(zawor|oring|napraw|piana|foam|aktywn|butelka pianuj)).*(pianownic|wytwornica piany|butelka do lancy)/, any: true },
  // chemia i produkty spoza części technicznych, rozpoznawane po jednoznacznych słowach
  { leaf: 'Znaki i tablice ostrzegawcze', re: /tablica uwaga|potykacz|koszulka reklamowa/, any: true },
  { leaf: 'Folie, torby i opakowania', re: /^strecz|folia stretch|fsmini|torebka|torba papierowa|folia aluminiowa/, any: true },
  { leaf: 'Pisuary i kostki WC', re: /pisuar|urinex|kostk\w* (do )?(wc|toalet)|wc kostk/, any: true },
  { leaf: 'Glinki i przygotowanie lakieru', re: /glinka|clay bar/, any: true },
  { leaf: 'Chemia basenowa', re: /bassau|\balgen\b|basenow/, any: true },
  { leaf: 'Usuwanie betonu i cementu', re: /^(?!.*(odplamiacz|plam|bruk|kostk)).*(beton|concrete remover|cement)/, any: true },
  { leaf: 'Kwasy i zasady przemysłowe', re: /kwas solny|podchloryn|kwas fosforowy|soda kaustyczna|lug sodowy/, any: true },
  { leaf: 'Odtłuszczacze przemysłowe', re: /^(aceton|benzyna ekstrakcyjna|rozpuszczalnik|alkohol izopropylowy|ipa )|izopropanol/, any: true },
  { leaf: 'Prezentery i akcesoria zapachowe', re: /prezenter|vaportek/, any: true },
  { leaf: 'Olejki do dyfuzorów', re: /olejek dyfuzora|olejek do dyfuz/, any: true },
  { leaf: 'Mycie pojazdów ciężarowych', re: /\btruck\b/, any: true },
  { leaf: 'Płyny do felg', re: /wheel cleaner|wheel remover|alu remover|alu strong/, any: true },
  { leaf: 'Płyny do szyb samochodowych', re: /glass cleaner|window cleaner|glass polish/, any: true },
  { leaf: 'Szampony samochodowe', re: /shampoo nano|car shampoo|szampon samochod/, any: true },
  { leaf: 'Aktywne piany', re: /active wash|activewash|aktywna piana|snow foam/, any: true },
  { leaf: 'Kokpit i plastiki', re: /cockpit|cocpit|kokpit|dash fresh/, any: true },
  { leaf: 'Pasty BHP', re: /pasta (bhp|do mycia rak|holste)|hand cleaner/, any: true },
  { leaf: 'Łazienka i WC', re: /cilit bang|domestos|ajax zel|toilet cleaner/, any: true },
  { leaf: 'Płyny, żele i proszki do prania', re: /persil|proszek do prania/, any: true },
  { leaf: 'Chemia do zmywarek', re: /sol do zmywarek/, any: true },
  { leaf: 'Zmywanie naczyń', re: /zmywak|druciak|czyscik/, any: true },
  { leaf: 'Ściereczki i ścierki', re: /^(scierka|scierki|scierecz\w* (mikrofaza|lux|york)|miotelka do kurzu)|scierka podlogowa|ściera podlogowa|^ścierka|^ściera /, any: true },
  { leaf: 'Worki na śmieci', re: /worki na smieci/, any: true },
  // oleje, żarówki, woda
  { leaf: 'Żarówki i drobne części samochodowe', re: /^(zestaw )?zarowk|^zarowka/, any: true },
  { leaf: 'Oleje i płyny eksploatacyjne', re: /^(olej\b|plyn do chlodnic|prestone plyn do chlodnic|orlen trawol|wab blue)|^[\w ]*plyn do chlodnic|\bad ?blue\b/, any: true },
  { leaf: 'Uzdatnianie wody', re: /korpus\w* (narurow|\d)|wklad liniowy|woda demineralizowana|tabletki solne|wkladka vrc/, any: true },
  // wyposażenie myjni, odkurzacze, higiena
  { leaf: 'Szczotki do myjni', re: /szczotk\w*\s+(d\/)?myjni|plyta szczotki|szczotka mtm|rekojesc do szczotki/, any: true },
  { leaf: 'Pędzle i aplikatory detailingowe', re: /^(?!.*(pod pedzel|konserwacji|srodek|plyn|preparat)).*(pedz\w*|detailing brush|pedzelek|applicator|aplikator)/, any: true },
  { leaf: 'Akcesoria do odkurzaczy', re: /\bssawk|worki? (do )?odkurzacz|szczotka do odkurzacza/, any: true },
  { leaf: 'Odkurzacze', re: /^(comet )?odkurzacz\b/, any: true },
  { leaf: 'Chusteczki i ściereczki', re: /chusteczk/, any: true },
  { leaf: 'Zmiotki i szufelki', re: /zmiotka|szufelk|leniuch/, any: true },
  { leaf: 'Rękawiczki', re: /^(?!.*(mycia|polerowani|fredz|frez|mikrofib|chenille|wash mitt|kufieta|car set|teddy|fresso|sonax|wielofunkc)).*rekawic/, any: true },
  { leaf: 'Podajniki i dozowniki', re: /^podajnik|\bpodajnik (n\/|na )/, any: true },
  { leaf: 'Ręczniki papierowe', re: /recznik\w*.*(wepa|z-z|zz|katrin|lucard|maxi automat|mini-cel)|z-z recznik/, any: true },
  { leaf: 'Papier toaletowy', re: /pap\.?\s?toaletowy|papier\s+toaletowy/, any: true },
  { leaf: 'Wózki sprzątające', re: /wozek \d|wozek.*chrom|koszyk.*wozka|stojak.*czysciw|wieszak.*czysciw|stojak podlogowy/, any: true },
  { leaf: 'Dozowniki', re: /kranik do|pompka do kanistra|klucz do (kanistra|beczki)/, any: true },
  { leaf: 'Testery i kleje techniczne', re: /tasma (piankowa|teflonowa|montazowa)|pasta montazowa|\bptfe\b/, any: true },
  // zbiorniki i pobór chemii
  { leaf: 'Rurki i ssaki chemii', re: /rurk[aiey]|ssak\b|poboru chemii|wezyk ssacy/ },
  { leaf: 'Zbiorniki', re: /zbiornik|korek zbiornika|mocowanie zbiornika|zakretka do zbiornika/ },
  // odkurzacze (części)
  { leaf: 'Części do odkurzaczy', re: /(odkurzacz\w*.*(wezyk|waz|silnik|filtr|zlacz)|(wezyk|silnik|filtr|zlacz\w*)\s.*odkurzacz|silnik odk|zlaczk\w* d\/weza odkurzacza|zlacze elastyczne d\/odkurzacza|filtr d\/odkurzacza|komplet filtrow poli)/, any: true },
  // węże
  { leaf: 'Bębny i zwijaki', re: /\b(beben|bebny|zwijak|zwijaki)\b|uchwyt obrotowy.*beb/ },
  { leaf: 'Węże kanalizacyjne', re: /\bwaz\b.*kanalizac|kanalizacj\w*.*\bwaz\b|waz kanalizacja/ },
  { leaf: 'Węże do chemii i natrysku', re: /\bwaz\b.*(chemii|natrysk)|waz do natrysku/ },
  { leaf: 'Węże wysokociśnieniowe', re: /\b(waz|weze|wezyk|wezem)\b/ },
  // złączki
  { leaf: 'Nyple', re: /\bnype?l\w*/, any: true },
  { leaf: 'Złącza obrotowe', re: /zlacz\w*\s+obrot|obrotowe\s+zlacz|zlacze obrot|obrot\.\s*(90|prost)/ },
  { leaf: 'Szybkozłącza', re: /szybkozlacz|quick coupler|zlacze szybk/, any: true },
  { leaf: 'Redukcje i adaptery', re: /\b(redukcj\w*|adapter\w*|przejsciowk\w*|k-lock)\b/ },
  { leaf: 'Trójniki, kolanka i złączki', re: /\b(trojnik\w*|kolank\w*|zlaczk\w*|zlacz\w*|lacznik\w*|mufa|krociec|przylacz\w*|rozdzielacz\w*|zakucie|wpust|korek|zaslepk\w*|zatyczka|korki)\b/ },
  // lance, pistolety, dysze
  { leaf: 'Dysze obrotowe', re: /(dysza|dysze|dyszy)\s.*(obrot|rotac|rotjet)|obrotowka|rotjet|dysza obrotowa|glowica rotacyjna/ },
  { leaf: 'Dysze', re: /\b(dysza|dysze|dyszy|dysz|dyszka)\b/ },
  { leaf: 'Lance', re: /\blanc\w*/ },
  { leaf: 'Pistolety', re: /\bpistolet\w*|\bpist\.\s/ },
  // zawory, filtry, manometry
  { leaf: 'Manometry', re: /manometr|rurka do manometru/, any: true },
  { leaf: 'Inżektory chemii', re: /inzektor|injector/, any: true },
  { leaf: 'Zawory by-pass i bezpieczeństwa', re: /by[- ]?pas|bezpieczenstwa|zaw\.? by|regulator zaw/, any: true },
  { leaf: 'Zawory zwrotne', re: /zawor\w*\s+zwrotn|zwrotny\s+ff|zawory zwrotne/, any: true },
  { leaf: 'Zawory pozostałe', re: /\b(zawor|zawory|zaworek|zaworki|zaworu|zaworow)\b|komplet zaworow|regulacja chemii/ },
  { leaf: 'Filtry i sitka', re: /\b(filtr\w*|sitko|sitka)\b/ },
  // pompy i silniki
  { leaf: 'Myjki ciśnieniowe', re: /^(comet\s+)?myjka\s+(km|kf|k\s?\d|cisn|wysokocisn|gor)|myjka cisnieniowa|^myjka\b.*\b(karcher|comet|nilfisk)\b|\bcomet myjka\b/ },
  { leaf: 'Pompy i głowice', re: /\b(pompa|pompy|pompe|pompka paliw\w*|glowica|glowice)\b|tlok\w*|plunger/ },
  {
    leaf: 'Silniki i elementy elektryczne',
    re: /\b(silnik\w*|przezwojenie|kondensator|wylacznik|mikrowylacznik|przelacznik|przewod\w*|szczotki weglowe|wtyczk\w*|stycznik|transformator|sterownik|termostat|regulator temperatury|plyta sterujaca|turbina|wentylator|gniazdo|czujnik)\b/,
  },
  // elementy montażowe
  { leaf: 'Obudowy, sprężyny i elementy montażowe', re: /\b(sprezyn\w*|nakretk\w*|srub\w*|podkladk\w*|tloczek|wkret\w*|opaska|opaski|zaczep\w*|pierscien\w*|tulej\w*|mocowanie|podstawa|obudowa|oslona|pokretlo|talerzyk|element laczacy|klin)\b/ },
];

/** Indeksy części i osprzętu (HYD, INNE, KAT…). Pozostałe indeksy to głównie chemia i akcesoria. */
const TECH_SKU = /^(HYD|INNE|KAT|KAR|KWAZ|CIDL|LIN|YOU|PWR|BL\d)/i;
/** Słowa, które w nazwie oznaczają chemię, szczotki, mopy i narzędzia — nie część techniczną. */
const NOT_A_PART = /\b(plyn|szampon|koncentrat|cleaner|mycia|czyszczenia|mop|mopa|mopy|stelaz\w*|szczotk\w*|butelk\w*|kanister|opryskiwacz\w*|dozownik\w*|detailing\w*|pad|wiadro)\b/;

/**
 * Kategoria (nazwa liścia) wynikająca z nazwy produktu albo null, gdy reguły nie rozpoznają części technicznej.
 * `sku` pozwala odróżnić części (indeksy HYD/INNE/KAT…) od chemii o podobnych słowach w nazwie.
 */
export function classifyByName(name: string, sku = ''): string | null {
  const t = fold(name);
  const technical = TECH_SKU.test(sku.trim());
  const blocked = NOT_A_PART.test(t);
  for (const r of RULES) {
    if (!r.any && (!technical || blocked)) continue;
    if (r.re.test(t)) return r.leaf;
  }
  return null;
}

/** Docelowa kategoria produktu: reguła nazwy, a gdy jej brak — przeniesienie ze starej, wycofanej kategorii. */
export function taxonomyLeafFor(name: string, sku: string, currentCategory: string): string | null {
  return REVIEWED_ASSIGNMENTS[sku.trim().toUpperCase()] ?? MANUAL_ASSIGNMENTS[sku.trim().toUpperCase()] ?? classifyByName(name, sku) ?? REMAP_REMOVED[currentCategory] ?? null;
}
