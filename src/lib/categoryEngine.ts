/**
 * Silnik kategorii: wielowarstwowa decyzja, do której kategorii (liścia drzewa) należy produkt.
 *
 * Warstwy odpowiadają kolejnym pytaniom, które zadałby człowiek, i głosują z wagami:
 *  1. rodzaj    — czym jest produkt (część, akcesorium, pokrowiec, ściągaczka…)                         [reguły partsTaxonomy]
 *  2. funkcja   — do czego służy według nazwy (odplamiacz, odkamieniacz, szampon, wosk…)                   [słownik FUNCTIONS]
 *  3. opis      — do czego służy według opisu, sposobu użycia i składu (te same pojęcia, liczone w tekście)  [słownik FUNCTIONS]
 *  4. linia     — co robią inne produkty z tej samej linii (np. „Draco SPOT-EX” → odplamiacze)               [konsensus linii]
 *  5. podobne   — do jakich kategorii należą produkty o podobnej nazwie                                      [kNN po słowach]
 *  6. obecna    — kategoria, którą produkt ma teraz (bezwładność: zmieniamy tylko na wyraźną przewagę)
 *
 * Wynik ma status: „pewne” (można zastosować hurtem), „do sprawdzenia” (są konkurencyjne propozycje) albo
 * „do wyszukania” (brak sygnału — trzeba sprawdzić w internecie, do czego produkt służy).
 */
import { fold } from './partsText';
import { classifyByName } from './partsTaxonomy';
import { MANUAL_ASSIGNMENTS } from '../data/manualAssignments';
import { REVIEWED_ASSIGNMENTS } from '../data/reviewedAssignments';

export interface EngineProduct {
  sku: string;
  name: string;
  maker?: string;
  /** Opis pełny, krótki, sposób użycia, skład — można podać zlepione albo osobno. */
  desc?: string;
  short?: string;
  usage?: string;
  comp?: string;
  /** Obecna kategoria w katalogu (liść) albo ''/„Do decyzji”. */
  category?: string;
  /** Kategoria tego produktu w sklepie kenochem.com (liść), jeśli sklep ją zna — dodatkowy dowód. */
  shopLeaf?: string;
}

export type LayerId = 'ręczne' | 'rodzaj' | 'funkcja' | 'opis' | 'rodzina' | 'sklep' | 'linia' | 'producent' | 'podobne' | 'obecna';

export interface Vote {
  layer: LayerId;
  leaf: string;
  weight: number;
  why: string;
}

export type DecisionStatus = 'pewne' | 'do sprawdzenia' | 'do wyszukania' | 'do ukrycia';

export interface Decision {
  sku: string;
  from: string;
  to: string | null;
  status: DecisionStatus;
  score: number;
  margin: number;
  votes: Vote[];
  alternatives: { leaf: string; score: number }[];
  reason: string;
  /** Wyniki walidacji: sprzeczność nazwa↔opis, rodzina niespójna, brak dowodu, zmiana kategorii, pozycja niesprzedażowa. */
  flags: string[];
}

/**
 * Pozycje, które nie są towarem do kategoryzowania: usługi, wysyłka, rozliczenia, sprzęt biurowy, środki trwałe.
 * Zwraca powód albo null.
 */
export function nonSalesReason(name: string): string | null {
  const t = fold(name);
  if (/^usluga|usluga\b|wysylka|wyssylka|dostawa\b|transport\b|oplata\b|prowizj/.test(t)) return 'usługa / koszt dostawy';
  if (/rozliczenie|program partnerski|zysk na czysto|faktura|zaliczka/.test(t)) return 'rozliczenie / pozycja księgowa';
  if (/notebook|laptop|komputer|monitor\b/.test(t)) return 'sprzęt biurowy';
  if (/\bpaleta\b|\bprzyczepa\b|\bsegregator\b|koszulka reklamowa|\bteczka\b|regeneracja plyty/.test(t)) return 'pozycja pomocnicza (opakowanie, środek trwały, usługa serwisowa)';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Słownik funkcji: fraza (znormalizowana: małe litery, bez polskich znaków) → kategoria
// ---------------------------------------------------------------------------------------------
interface Fn {
  re: RegExp;
  leaf: string;
  /** Siła sygnału w nazwie (0–1). W opisie liczymy ten sam wzorzec, ale słabiej. */
  w: number;
  /** Wzorzec wykluczający — jeśli pasuje w tekście, funkcja nie głosuje. */
  not?: RegExp;
  /** Dotyczy tylko nazwy produktu (w opisie słowo może paść mimochodem, np. „czyści też pisuary”). */
  nameOnly?: boolean;
}

const ECO_CLEANER = /czyszcz|mycia|mycie|plyn|zel\b|pianka|odtluszcz|preparat|srodek|koncentrat|tabletk|odkamien|glass|floor|sanit|toilet|kitchen|oven|degreaser|dish|\bclean\b/;
const ECO_ACCESSORY = /scierecz|mikrofibr|miotl|zmiotk|worki|folia|szczotk|zestaw|opryskiwacz|inzektor|reklamowk|torb|\bmop\b|stelaz|rekawic|gabk|dyfuzor/;
const ECO_AUTOMOTIVE = /\baut[ao]\b|samochod|pojazd|myjni|opon|felg|hamulc|lakier|kokpit|bezdotykow|\b(easy wash|orion|fraber|atas|kenotek|sjd|soft99|sonax|k2)\b/;

/**
 * Słowa wykluczające dla kategorii: jeśli nazwa produktu zawiera takie słowo, produkt NIE należy do tej kategorii
 * (np. folia, pokrowce czy środek do kurników nie są chemią do łazienek). Walidator sprawdza zarówno propozycje silnika,
 * jak i obecne przypisania.
 */
const LEAF_EXCLUDES: Record<string, RegExp> = {
  'Łazienki i sanitariaty': /folia|pokrowc|fotel|samochod|ciezarow|truck|\bobor|kurnik|chlewni|maszyn do lodow|cement|beton|tapicer|mikrofibr|plandek/,
  'Łazienka i WC': /folia|pokrowc|samochod|ciezarow|truck|cement|beton/,
  'Pisuary i kostki WC': /brukow|posadzk|podlog|samochod/,
  'Płyny do felg': /cement|beton|elewacj|bruk|posadzk|pokrowc|szczotk|gabk/,
  'Aktywne piany': /anti-?foam|odpieniacz|de-?foam|\bobor|kurnik|inwentarsk/,
  'Podłogi i posadzki': /sciagacz|zbierak|\bmop\b|stojak|szczotk|potykacz|bruk/,
  'Tapicerka materiałowa': /szczotk|gabk|\bmop\b|rekawic/,
  'Mikrofibry uniwersalne': /plyn do|wosk|pasta|szampon|spray/,
  'Odświeżacze w sprayu': /dyfuzor|olejek do/,
  'Kokpit i plastiki': /felg|hamulc|szyb/,
  'Chemia do zmywarek': /polerowani|pasta polersk/,
  'Mopy i stelaże': /pokrowc|dywanik|plyn do|kwas/,
  'Szampony samochodowe': /dywan|tapicer|wlos|cial/,
};

/**
 * Wymagania kategorii: aby produkt mógł być w tej kategorii, jego nazwa / krótki opis musi zawierać deklarację.
 * Np. do „Ekologicznych środków czystości” trafia tylko to, co producent opisuje jako ekologiczne (linia ECO).
 */
const LEAF_REQUIRES: Record<string, (name: string, short: string) => boolean> = {
  'Ekologiczne środki czystości': (name, short) => /\beco\b|\beko\b|ekologiczn/.test(name.replace(/eco ?shine|ecochem|eco ego/g, ' ')) || /ekologiczn|biodegradowaln|ecolabel/.test(short),
};

/** Marki chemii gospodarczej z marketów — trafiają do „Dom i ogród › Chemia do domu”, nie do chemii profesjonalnej. */
const CONSUMER_BRANDS = /\b(domestos|cif|cilit|vanish|persil|ajax|pronto|sidolux|pledge|bref|duck|calgon|ariel|lenor|tytan|clin|mr proper)\b/;

const FUNCTIONS: Fn[] = [
  // --- konkretne kategorie wygrywają z ogólnymi (specyficzność): mocna waga ---
  { re: /szczotk\w*.*(tapicer|skor|felg|sierc)|(tapicer|skor|felg)\w*.*szczotk/, leaf: 'Szczotki do mycia samochodu', w: 1.4, nameOnly: true },
  { re: /kostk\w* (do )?(wc|toalet|ubikac)|wc kostk|krazk\w* (zelow\w* )?(do )?wc|krazk\w* zelow|pisuar|urinex/, leaf: 'Pisuary i kostki WC', w: 2.0, nameOnly: true },
  { re: /eco shine eco\b/, leaf: 'Ekologiczne środki czystości', w: 2.0, nameOnly: true },
  // pranie i plamy
  { re: /odplamiacz|usuwanie plam|usuwa plamy|na plamy|plam z /, leaf: 'Odplamiacze', w: 1.3, not: /tapicerk\w* samochod|alcantar|do wnetrza/ },
  { re: /odplamiacz.*(tapicerk|alcantar)|(tapicerk|alcantar).*odplamiacz/, leaf: 'Tapicerka materiałowa', w: 0.6, not: /dywan.*(domow|hotel)/ },
  { re: /proszek do prania|plyn do prania|zel do prania|do prania (tkanin|odziez|bielizn)|plyn do plukania|wybielacz do/, leaf: 'Płyny, żele i proszki do prania', w: 0.85 },
  { re: /pranie (dywan|tapicerk)|czyszczenie dywan|ekstrakcyjn|do maszynowego (prania|czyszczenia) (dywan|tapicerk)/, leaf: 'Pranie dywanów i tapicerki', w: 0.8 },
  // kamień, rdza, kwasy
  { re: /odkamieniacz|usuwanie kamienia|kamien i rdz|odkamieniani/, leaf: 'Odkamienianie urządzeń', w: 0.7, not: /\b(wc|toalet|toilet|lazienk|sanit|prysznic|pisuar|kabin)/ },
  { re: /odrdzewiacz|usuwanie rdzy|odrdzewiani/, leaf: 'Odrdzewiacze', w: 0.8, not: /felg/ },
  { re: /deironiz|iron remover|osady metaliczne|iron terminator/, leaf: 'Deironizery i osady metaliczne', w: 0.8 },
  { re: /kwas solny|podchloryn|kwas fosforowy|lug sodowy/, leaf: 'Kwasy i zasady przemysłowe', w: 0.85 },
  { re: /beton|cement|zaprawa/, leaf: 'Usuwanie betonu i cementu', w: 0.65, not: /odplamiacz|plam|kostk|bruk|posadzk|impregnat/ },
  // samochód — mycie
  { re: /szampon (samochod|do mycia samochod|do aut)|car shampoo|shampoo/, leaf: 'Szampony samochodowe', w: 0.75, not: /wlos|cial|reki|rak/ },
  { re: /aktywna piana|piana aktywna|active foam|snow foam|active wash|bezdotykow/, leaf: 'Aktywne piany', w: 0.8 },
  { re: /\bapc\b|uniwersalny (srodek|preparat|plyn) (czyszcz|do czyszcz)|multi ?cleaner|pre-?wash|\btfr\b/, leaf: 'APC, pre-wash i TFR', w: 0.55 },
  { re: /felg|wheel cleaner|alu cleaner/, leaf: 'Płyny do felg', w: 0.8, not: /pokrowc|szczotk|gabk/ },
  { re: /dressing|czernidl|nablyszczani\w* opon|do opon/, leaf: 'Dressingi i czernidła do opon', w: 0.8 },
  { re: /usuwani\w* owad|insect|owadow/, leaf: 'Usuwanie owadów', w: 0.8 },
  { re: /smol|asfalt|zywic|usuwani\w* klej|sticker remover|tar remover/, leaf: 'Usuwanie smoły, asfaltu, kleju i żywicy', w: 0.75 },
  { re: /mycie silnika|czyszczenie silnika|engine clean|motocleaner|moto cleaner/, leaf: 'Czyszczenie silnika', w: 0.8 },
  // lakier
  { re: /wosk|wax\b/, leaf: 'Woski samochodowe', w: 0.6, not: /pszczel|do podlog|swiec|depilac/ },
  { re: /pasta polersk|politur|polish\b|compound|mleczko polersk|polerowani/, leaf: 'Pasty polerskie', w: 0.7 },
  { re: /ceramic|ceramicz|coating|powloka|sealant|hybrid|quartz|kwarc|glaze/, leaf: 'Powłoki ceramiczne i ochronne', w: 0.6, not: /ceramik\w* (do )?szyb|reflektor|dyfuzor|vaso/ },
  { re: /quick detailer|detailer|szybki detailer/, leaf: 'Quick detailery', w: 0.6 },
  { re: /\bglink|clay/, leaf: 'Glinki i przygotowanie lakieru', w: 0.8 },
  // szyby
  { re: /odmrazacz|odladzacz do szyb/, leaf: 'Odmrażacze do szyb', w: 0.85 },
  { re: /plyn do spryskiwaczy|spryskiwacz\w* (letni|zimow)/, leaf: 'Płyny do spryskiwaczy', w: 0.85 },
  { re: /antypara|antyroszen|niewidzialna wycieraczka|rain-?x|hydrofob/, leaf: 'Powłoki do szyb', w: 0.8 },
  { re: /plyn do (mycia )?szyb|mycie szyb|czyszczenie szyb|glass cleaner|window cleaner/, leaf: 'Płyny do szyb samochodowych', w: 0.6, not: /dom|okien/ },
  { re: /reflektor|headlight|lamp (doctor|protect)/, leaf: 'Reflektory i lampy', w: 0.85 },
  // wnętrze
  { re: /kokpit|cockpit|dashboard|plastik\w* wewn/, leaf: 'Kokpit i plastiki', w: 0.65 },
  { re: /\bskor\w+ (samochod|auta|tapicerk|siedzen)|leather|do skory/, leaf: 'Skóra samochodowa', w: 0.7 },
  { re: /tapicerk/, leaf: 'Tapicerka materiałowa', w: 0.45, not: /dywan.*domow/ },
  { re: /klimatyzac|klima ?(doktor|cleaner)|neutralizator zapach\w* (w )?(samochod|pojazd)/, leaf: 'Zapachy i neutralizatory do samochodu', w: 0.6 },
  { re: /gumy i uszczelk|guma w sprayu|silikon do uszczelek|konserwacji gum|plastik\w* zewn|zderzak|chrom/, leaf: 'Plastiki, gumy i chrom', w: 0.65 },
  // dom, obiekty
  { re: /\bwc\b|toalet|toilet|sanitar|sanit\b|pisuar|kabin\w* prysznic|kamien i rdz/, leaf: 'Łazienki i sanitariaty', w: 0.7, not: /przenosn|turystycz|szczotk/ },
  { re: /plyn do podlog|do mycia podlog|podlog\w* (drewnian|panel)|posadzk|floor|maszynowe mycie podlog/, leaf: 'Podłogi i posadzki', w: 0.7, not: /sciagacz|zbierak|mop\b|stojak/ },
  { re: /plyn do naczyn|do recznego mycia naczyn|dish/, leaf: 'Ręczne mycie naczyń', w: 0.8 },
  { re: /zmywark|do zmywarek|sol do zmywarek|nablyszczacz do zmywarek/, leaf: 'Chemia do zmywarek', w: 0.85 },
  { re: /piekarnik|grill|frytown|przypalen|wedzarni|piec\w* konwekcyjn/, leaf: 'Czyszczenie pieców, grilli i frytkownic', w: 0.8 },
  { re: /mydlo|zel do rak|mycia rak|mycie rak/, leaf: 'Mydła i żele do rąk', w: 0.7, not: /pasta/ },
  { re: /pasta (bhp|do mycia rak)|hand cleaner|pasta.*zabrudzonych rak/, leaf: 'Pasty BHP', w: 0.85 },
  { re: /krem do rak|krem ochronny/, leaf: 'Kremy do rąk', w: 0.85 },
  { re: /dezynfek|bakteriobo|wirusobo|grzybobo|biocyd/, leaf: 'Dezynfekcja powierzchni', w: 0.55, not: /rak\b|rece|dloni/ },
  { re: /dezynfek\w* rak|dezynfekcja skory rak|plyn do dezynfekcji rak/, leaf: 'Dezynfekcja rąk', w: 0.85 },
  { re: /mebl|blat/, leaf: 'Środki uniwersalne i meble', w: 0.5, not: /szczotk/ },
  { re: /kostk\w* brukow|bruk|kamien naturalny|impregnat do (kostki|kamienia)/, leaf: 'Kostka brukowa i kamień', w: 0.75 },
  { re: /fotowoltaicz|panel\w* sloneczn/, leaf: 'Mycie paneli fotowoltaicznych', w: 0.85 },
  // zapachy
  { re: /olejek (do )?dyfuzor|olejek dyfuzor|olejek zapachowy do dyfuzor/, leaf: 'Olejki do dyfuzorów', w: 0.9 },
  { re: /\bdyfuzor\b/, leaf: 'Dyfuzory zapachowe', w: 0.4 },
  { re: /patyczki zapachowe|patyczki/, leaf: 'Patyczki zapachowe', w: 0.8 },
  { re: /saszetk\w* zapachow/, leaf: 'Saszetki zapachowe', w: 0.85 },
  { re: /swiec\w* zapachow|swieca/, leaf: 'Świece zapachowe', w: 0.8 },
  { re: /perfumy samochodowe|perfumy do auta|zapach samochodowy/, leaf: 'Perfumy samochodowe', w: 0.75 },
  { re: /zawieszk/, leaf: 'Zawieszki zapachowe', w: 0.8 },
  { re: /one shot/, leaf: 'One Shot', w: 0.9 },
  { re: /neutralizator|neutralizacj\w* zapach|usuwa zapach/, leaf: 'Neutralizatory zapachów', w: 0.65 },
  { re: /odswiezacz/, leaf: 'Odświeżacze w sprayu', w: 0.6 },
  // specjalistyczna
  { re: /smar\b|smarowanie|wazelin|pasta miedziana|silikon w sprayu|\bwd-?40\b/, leaf: 'Smary i oleje techniczne', w: 0.65 },
  { re: /zmywacz do hamulc|czyszczenie hamulc/, leaf: 'Zmywacze do hamulców', w: 0.9 },
  { re: /odtluszcz/, leaf: 'Odtłuszczacze przemysłowe', w: 0.55 },
  { re: /plyn do chlodnic|olej silnikowy|\bolej\b|adblue/, leaf: 'Oleje i płyny eksploatacyjne', w: 0.8 },
  { re: /wedzarni|obor|kurnik|inwentarsk|udojow/, leaf: 'Higiena inwentarska i udojowa', w: 0.7 },
  { re: /maszyn\w* rolnicz|traktor/, leaf: 'Mycie maszyn rolniczych', w: 0.8 },
  { re: /ciezarowk|ciezarow|naczep|plandek|truck/, leaf: 'Mycie pojazdów ciężarowych', w: 0.7, not: /pokrowc|rekawic|wiadro/ },
  { re: /basen|algen/, leaf: 'Chemia basenowa', w: 0.8 },
  { re: /fluorowodor/, leaf: 'Kwasy i zasady przemysłowe', w: 0.5 },
  { re: /uzdatnian|zmiekcz|demineralizowan|sol (tabletkowana|do zmiekczaczy)/, leaf: 'Uzdatnianie wody', w: 0.7 },
];

/** Wersje globalne wzorców — kompilowane raz, a nie przy każdym produkcie. */
const FUNCTIONS_G = FUNCTIONS.map((f) => ({ ...f, g: new RegExp(f.re.source, 'g') }));

function applyFunctions(text: string, inName = false): { leaf: string; w: number; hits: number }[] {
  const out = new Map<string, { w: number; hits: number }>();
  for (const f of FUNCTIONS_G) {
    if (f.nameOnly && !inName) continue;
    if (f.not && f.not.test(text)) continue;
    const m = text.match(f.g);
    if (!m) continue;
    const cur = out.get(f.leaf);
    if (!cur || f.w > cur.w) out.set(f.leaf, { w: f.w, hits: (cur?.hits ?? 0) + m.length });
    else cur.hits += m.length;
  }
  return [...out.entries()].map(([leaf, v]) => ({ leaf, w: v.w, hits: v.hits }));
}

// ---------------------------------------------------------------------------------------------
// Tokeny, linie produktowe, podobieństwo
// ---------------------------------------------------------------------------------------------
const STOP = new Set(['do', 'na', 'dla', 'oraz', 'szt', 'ml', 'kg', 'nr', 'the', 'and', 'typ', 'set', 'bez', 'ze', 'od', 'po', 'przy']);
const stem = (t: string) => (t.length > 5 ? t.replace(/(ami|ach|owi|ego|emu|ych|ymi|ow|ie|a|y|i|e|u|om|em)$/, '') : t);
const SIZE = /^\d+([.,]\d+)?(ml|l|g|kg|mm|cm|m|szt|sztuk|w|v|bar)?$/;

function tokens(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !STOP.has(t) && !SIZE.test(t))
        .map(stem),
    ),
  ];
}

/** Klucz linii produktowej: marka + pierwsze słowo-nazwa, bez rozmiaru/pojemności (np. „draco spot-ex”). */
function lineKey(name: string): string {
  const t = fold(name)
    .replace(/[^a-z0-9\- ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !SIZE.test(w) && !STOP.has(w));
  if (t.length < 2) return '';
  // marka (1. słowo) + człon nazwy linii (2.–3. słowo, bez cyfr na końcu)
  const parts = t.slice(0, 3).filter((w) => !/^\d+$/.test(w));
  return parts.slice(0, 2).join(' ');
}

/**
 * Klucz modelu: linia + numer modelu (np. „nerta atc 350”, „draco spot-ex 4”). Model to samodzielna liczba w nazwie,
 * niebędąca pojemnością (po niej nie stoi jednostka). Różne modele tej samej linii mogą służyć do czegoś innego.
 */
function modelKey(name: string): string {
  const base = lineKey(name);
  if (!base) return '';
  const words = fold(name).replace(/[^a-z0-9\- ]+/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (/^\d{1,4}$/.test(words[i]) && !/^(ml|l|g|kg|szt|sztuk|m|mm|cm)$/.test(words[i + 1] ?? '') && i > 0) return `${base} ${words[i]}`;
  }
  return '';
}

const VOLUME = /\b\d+([.,]\d+)?\s?(ml|l|litr\w*|g|kg|szt|sztuk|m|mm|cm|mb)\b/g;

/**
 * Największa pojemność / waga opakowania z nazwy w litrach lub kilogramach (np. „20L”, „0,75L”, „240 kg”, „beczka”).
 * Null, gdy nazwa nie podaje objętości — wtedy reguły pojemności nie działają.
 */
export function packageVolume(name: string): number | null {
  const t = fold(name).replace(/(\d),(\d)/g, '$1.$2');
  let max: number | null = null;
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s?(l|litr\w*|kg)\b/g)) {
    const v = Number(m[1]);
    if (Number.isFinite(v) && (max === null || v > max)) max = v;
  }
  if (max === null && /\bbeczk\w*|\bkontener\b|\bibc\b/.test(t)) return 200;
  return max;
}

/**
 * Ta sama chemia bywa w dwóch miejscach drzewa zależnie od opakowania: duże gabaryty (od WASH_MIN_VOLUME) trafiają do
 * „Myjnia samochodowa › Chemia do myjni”, małe (litrówki, 5 L) do „Chemia samochodowa” — dla klienta detalicznego i warsztatu.
 */
export const WASH_MIN_VOLUME = 20;
const WASH_TWINS: { wash: string; retail: string }[] = [
  { wash: 'Aktywne piany do myjni', retail: 'Aktywne piany' },
  { wash: 'Woski osuszające i hydrowoski', retail: 'Woski samochodowe' },
  { wash: 'Preparaty do felg do myjni', retail: 'Płyny do felg' },
];

/** Kategoria właściwa dla pojemności: dla pary „myjnia ↔ detal” wybiera wariant zgodny z wielkością opakowania. */
export function retwin(leaf: string, volume: number | null): string {
  if (volume === null) return leaf;
  for (const t of WASH_TWINS) {
    if (leaf === t.wash || leaf === t.retail) return volume >= WASH_MIN_VOLUME ? t.wash : t.retail;
  }
  return leaf;
}

/** Klucz rodziny: nazwa bez pojemności i liczby sztuk — ten sam produkt w różnych opakowaniach ma ten sam klucz. */
function familyKey(name: string): string {
  return fold(name)
    .replace(VOLUME, ' ')
    .replace(/[^a-z0-9\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Silnik
// ---------------------------------------------------------------------------------------------
const WEIGHTS: Record<LayerId, number> = { ręczne: 3, rodzaj: 1.0, funkcja: 1.0, opis: 0.6, rodzina: 0.8, sklep: 0.6, linia: 0.7, producent: 0.3, podobne: 0.45, obecna: 0.5 };
/** Warstwy, które są dowodem z samego produktu (nazwa, opis, identyczne produkty w innych opakowaniach). */
const EVIDENCE: LayerId[] = ['ręczne', 'rodzaj', 'funkcja', 'opis', 'rodzina', 'sklep'];
const UNDECIDED = 'Do decyzji';

export interface EngineOptions {
  /** Zbiór dozwolonych kategorii (liście drzewa) — decyzje poza nim są odrzucane. */
  leaves: Set<string>;
}

export function buildEngine(products: EngineProduct[], opts: EngineOptions) {
  const leafKey = (s: string) => fold(s).trim();
  const validLeaf = new Map([...opts.leaves].map((l) => [leafKey(l), l]));
  const known = products.filter((p) => p.category && p.category !== UNDECIDED && validLeaf.has(leafKey(p.category)));

  // linie produktowe i modele: klucz → rozkład kategorii znanych produktów
  const lines = new Map<string, Map<string, number>>();
  const models = new Map<string, Map<string, number>>();
  // rodziny: ten sam produkt w różnych opakowaniach → kategorie (z listą SKU, żeby nie liczyć samego siebie)
  const families = new Map<string, { sku: string; cat: string }[]>();
  const bump = (map: Map<string, Map<string, number>>, k: string, c: string) => {
    const m = map.get(k) ?? new Map<string, number>();
    m.set(c, (m.get(c) ?? 0) + 1);
    map.set(k, m);
  };
  for (const p of known) {
    const c = validLeaf.get(leafKey(p.category!))!;
    const k = lineKey(p.name);
    if (k) bump(lines, k, c);
    const mk = modelKey(p.name);
    if (mk) bump(models, mk, c);
    const fk = familyKey(p.name);
    if (fk) (families.get(fk) ?? families.set(fk, []).get(fk)!).push({ sku: p.sku, cat: c });
  }

  // podobieństwo (idf + indeks odwrócony)
  const toks = new Map<string, string[]>();
  const df = new Map<string, number>();
  const inverted = new Map<string, { sku: string; cat: string }[]>();
  for (const p of known) {
    const t = tokens(fold(p.name));
    toks.set(p.sku, t);
    for (const w of t) {
      df.set(w, (df.get(w) ?? 0) + 1);
      (inverted.get(w) ?? inverted.set(w, []).get(w)!).push({ sku: p.sku, cat: validLeaf.get(leafKey(p.category!))! });
    }
  }
  // producent: do jakich kategorii trafiają jego pozostałe produkty (wskazówka dla specjalistów: Vikan, Kwazar, Lavor, Kala…)
  const makerCats = new Map<string, Map<string, number>>();
  for (const p of known) {
    const m = fold(p.maker ?? '').trim();
    if (!m || /^(inni producenci|ogolna|marka niezdefiniowana|akcesoria|hydroflex|-)/.test(m)) continue;
    bump(makerCats, m, validLeaf.get(leafKey(p.category!))!);
  }
  const makerHint = (p: EngineProduct): Vote | null => {
    const m = fold(p.maker ?? '').trim();
    const cats = m ? makerCats.get(m) : undefined;
    if (!cats) return null;
    const total = [...cats.values()].reduce((a, b) => a + b, 0);
    const [leaf, n] = [...cats.entries()].sort((a, b) => b[1] - a[1])[0];
    if (total < 6 || n / total < 0.6) return null;
    return { layer: 'producent', leaf, weight: WEIGHTS.producent * (n / total), why: `producent „${m}”: ${Math.round((100 * n) / total)}% produktów to ${leaf}` };
  };

  const N = Math.max(known.length, 1);
  const idf = (w: string) => Math.log(1 + N / (df.get(w) ?? 0.5));

  function similar(p: EngineProduct): Vote | null {
    const t = tokens(fold(p.name));
    const score = new Map<string, number>();
    let tot = 0;
    for (const w of t) {
      const list = inverted.get(w);
      if (!list) continue;
      const weight = idf(w);
      tot += weight;
      const per = new Map<string, number>();
      let n = 0;
      for (const o of list) {
        if (o.sku === p.sku) continue;
        per.set(o.cat, (per.get(o.cat) ?? 0) + 1);
        n++;
      }
      if (!n) continue;
      for (const [c, k] of per) score.set(c, (score.get(c) ?? 0) + (weight * k) / n);
    }
    if (!tot || !score.size) return null;
    const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]);
    const [leaf, s] = ranked[0];
    const share = s / tot;
    const margin = (s - (ranked[1]?.[1] ?? 0)) / s;
    const conf = Math.max(0, Math.min(1, share * (0.5 + 0.5 * margin)));
    if (conf < 0.35) return null;
    return { layer: 'podobne', leaf, weight: WEIGHTS.podobne * conf * 1.6, why: `podobne nazwy → ${leaf} (${Math.round(conf * 100)}%)` };
  }

  function decide(p: EngineProduct): Decision {
    const from = p.category && validLeaf.has(leafKey(p.category)) ? validLeaf.get(leafKey(p.category))! : '';
    const ns = nonSalesReason(p.name);
    if (ns) return { sku: p.sku, from: from || UNDECIDED, to: null, status: 'do ukrycia', score: 0, margin: 0, votes: [], alternatives: [], reason: ns, flags: ['pozycja niesprzedażowa'] };
    const votes: Vote[] = [];
    const add = (v: Vote | null) => {
      if (v && validLeaf.has(leafKey(v.leaf))) votes.push({ ...v, leaf: validLeaf.get(leafKey(v.leaf))! });
    };
    const name = fold(p.name);
    const detail = fold([p.short, p.usage, p.desc, p.comp].filter(Boolean).join(' '));

    // 0. ręczne
    const manual = REVIEWED_ASSIGNMENTS[p.sku.trim().toUpperCase()] ?? MANUAL_ASSIGNMENTS[p.sku.trim().toUpperCase()];
    if (manual) add({ layer: 'ręczne', leaf: manual, weight: WEIGHTS.ręczne, why: 'przypisane ręcznie po przeglądzie' });

    // 1. rodzaj produktu (reguły części/akcesoriów/chemii o jednoznacznych słowach)
    const byRule = classifyByName(p.name, p.sku);
    if (byRule) add({ layer: 'rodzaj', leaf: byRule, weight: WEIGHTS.rodzaj, why: `reguła nazwy → ${byRule}` });

    // 2. funkcja w nazwie
    for (const f of applyFunctions(name, true)) add({ layer: 'funkcja', leaf: f.leaf, weight: WEIGHTS.funkcja * f.w, why: `w nazwie: ${f.leaf}` });

    // 3. funkcja w opisie (im częściej pada pojęcie, tym mocniej, ale z sufitem)
    if (detail.length > 30) {
      for (const f of applyFunctions(detail)) {
        const boost = Math.min(1, 0.5 + 0.15 * f.hits);
        add({ layer: 'opis', leaf: f.leaf, weight: WEIGHTS.opis * f.w * boost, why: `w opisie (${f.hits}×): ${f.leaf}` });
      }
    }

    let dropLeaf = '';
    // 2b. chemia gospodarcza z marketów (Domestos, Cilit, Persil, Vanish, Pronto…) → Dom i ogród › Chemia do domu
    if (CONSUMER_BRANDS.test(name) && !/kostk|krazk|pisuar/.test(name)) {
      const consumerLeaf = /wc|toalet|toilet|lazien|cilit|domestos|kamien i rdz|plesn|tytan|cif|ajax zel|sanit/.test(name)
        ? 'Łazienka i WC'
        : /proszek|pranie|persil|vanish|odplamiacz|plyn do plukania|lenor|ariel/.test(name)
          ? 'Pranie'
          : /uniwersal|mebl|pledge|pronto|glazur|sidolux|okien|clin|szyb|ajax/.test(name)
            ? 'Środki uniwersalne i meble'
            : null;
      if (consumerLeaf) {
        // to rozstrzygnięcie „kto kupuje”, a nie kolejny głos: głosy na zawodowy odpowiednik tej samej chemii odpadają
        const proTwin = { 'Łazienka i WC': 'Łazienki i sanitariaty', Pranie: 'Płyny, żele i proszki do prania', 'Środki uniwersalne i meble': 'Mycie powierzchni' }[consumerLeaf]!;
        dropLeaf = proTwin;
        add({ layer: 'rodzaj', leaf: consumerLeaf, weight: 2.0, why: 'marka marketowa → chemia do domu' });
      }
    }
    // 2c. szczotki Vikan (HACCP, przemysł spożywczy) — oprócz szczotek do śniegu i samochodów
    if (/vikan/.test(fold(p.maker ?? '') + ' ' + name) && /szczotk/.test(name) && !/snieg|odsniez|samochod|auto|felg/.test(name)) {
      add({ layer: 'rodzaj', leaf: 'Szczotki przemysłowe i HACCP', weight: 1.5, why: 'szczotka Vikan (HACCP / przemysł)' });
    }

    // 2d. deklaracja ekologiczna: linia „ECO” w nazwie środka czyszczącego do obiektów i domu (nie marka Eco Shine, nie akcesoria,
    //     nie chemia samochodowa, nie dezynfekcja). Producent może mieć „eco” w nazwie firmy — liczy się dopisek w nazwie produktu.
    const ecoCore = name.replace(/eco ?shine|ecochem|eco ego|eco natural|eco premium/g, ' ');
    const ecoClaim = /\beco\b|\beko\b|ekologiczn/.test(ecoCore);
    if (
      ecoClaim &&
      (ECO_CLEANER.test(name) || /e(i)?lfix\s+eco\b/.test(name)) &&
      !ECO_ACCESSORY.test(name) &&
      !ECO_AUTOMOTIVE.test(`${name} ${fold(p.maker ?? '')}`) &&
      !/chlor|dezynfek|septal/.test(name)
    ) {
      add({ layer: 'rodzaj', leaf: 'Ekologiczne środki czystości', weight: 2.0, why: 'deklaracja ekologiczna w nazwie (linia ECO)' });
    }

    // 3b. rodzina: ten sam produkt w innych opakowaniach (po usunięciu pojemności nazwa jest identyczna)
    const flags: string[] = [];
    const fk = familyKey(p.name);
    const siblings = (fk ? (families.get(fk) ?? []) : []).filter((s) => s.sku !== p.sku);
    if (siblings.length) {
      const counts = new Map<string, number>();
      for (const s of siblings) counts.set(s.cat, (counts.get(s.cat) ?? 0) + 1);
      const [leaf, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      add({ layer: 'rodzina', leaf, weight: WEIGHTS.rodzina * Math.min(1, 0.6 + 0.2 * n), why: `ten sam produkt w innym opakowaniu (${n}) → ${leaf}` });
      // para „myjnia ↔ detal” różni się wyłącznie pojemnością, więc przy porównaniu rodziny traktujemy ją jako jedną kategorię
      const canon = (l: string) => WASH_TWINS.find((t) => t.wash === l)?.retail ?? l;
      const sibling = new Set([...counts.keys()].map(canon));
      if (from && !sibling.has(canon(from))) flags.push('rodzina niespójna');
    }

    // 3c. sklep: produkt ma już kategorię w sklepie internetowym
    if (p.shopLeaf) add({ layer: 'sklep', leaf: p.shopLeaf, weight: WEIGHTS.sklep, why: `w sklepie: ${p.shopLeaf}` });

    // 4. linia produktowa — najpierw dokładny model (np. „nerta atc 350”), a ogólna linia tylko jako słaba wskazówka
    const mk = modelKey(p.name);
    const lk = lineKey(p.name);
    const fromModel = mk ? models.get(mk) : undefined;
    const fromLine = lk ? lines.get(lk) : undefined;
    const consensus = (line: Map<string, number>) => {
      const total = [...line.values()].reduce((a, b) => a + b, 0);
      const own = from && line.get(from) ? 1 : 0; // nie liczymy samego siebie
      const [leaf, n] = [...line.entries()].sort((a, b) => b[1] - a[1])[0];
      const others = total - own;
      const support = leaf === from ? n - own : n;
      return { leaf, support, others, ok: others >= 2 && support / others >= 0.75 };
    };
    if (fromModel) {
      const c = consensus(fromModel);
      if (c.ok) add({ layer: 'linia', leaf: c.leaf, weight: WEIGHTS.linia * Math.min(1, 0.5 + 0.1 * c.support), why: `model „${mk}” (${c.support}/${c.others}) → ${c.leaf}` });
    } else if (fromLine) {
      const c = consensus(fromLine);
      // bez numeru modelu linia bywa różnorodna — to tylko podpowiedź, nie dowód
      if (c.ok) add({ layer: 'linia', leaf: c.leaf, weight: WEIGHTS.linia * 0.5, why: `linia „${lk}” (${c.support}/${c.others}) → ${c.leaf}` });
    }

    // 5. podobne produkty
    add(similar(p));
    add(makerHint(p));

    // 6. obecna kategoria
    if (from) add({ layer: 'obecna', leaf: from, weight: WEIGHTS.obecna, why: `obecnie: ${from}` });

    // 7. pojemność: ta sama chemia dla myjni (duże gabaryty) i dla detalu/warsztatu (litrówki) leży w innych kategoriach
    const volume = packageVolume(p.name);
    let volumeShift = false;
    for (const v of votes) {
      const fixed = retwin(v.leaf, volume);
      if (fixed !== v.leaf) v.leaf = fixed;
    }
    const fromFixed = from ? retwin(from, volume) : '';
    if (from && fromFixed !== from) {
      volumeShift = true;
      add({ layer: 'rodzaj', leaf: fromFixed, weight: WEIGHTS.rodzaj, why: `reguła pojemności (${volume} l/kg): ${fromFixed === from ? '' : 'opakowanie ' + (volume! >= WASH_MIN_VOLUME ? 'duże → myjnia' : 'małe → chemia samochodowa')}` });
    }
    if (volumeShift) flags.push('reguła pojemności');

    if (dropLeaf) for (let i = votes.length - 1; i >= 0; i--) if (votes[i].leaf === dropLeaf) votes.splice(i, 1);

    // agregacja
    const agg = new Map<string, { score: number; layers: Set<LayerId> }>();
    for (const v of votes) {
      const a = agg.get(v.leaf) ?? { score: 0, layers: new Set<LayerId>() };
      a.score += v.weight;
      a.layers.add(v.layer);
      agg.set(v.leaf, a);
    }
    const ranked = [...agg.entries()].sort((a, b) => b[1].score - a[1].score);
    const alternatives = ranked.slice(0, 3).map(([leaf, a]) => ({ leaf, score: +a.score.toFixed(2) }));

    const base = { sku: p.sku, from: from || UNDECIDED, votes, alternatives, flags };
    // kontekst: czy nazwa i opis wskazują tę samą kategorię? (np. „Czysta Kostka” → opis mówi o kostce brukowej)
    const descVotes = votes.filter((v) => v.layer === 'opis').sort((a, b) => b.weight - a.weight);
    // brak jakiegokolwiek sygnału poza „obecną”
    const signal = votes.filter((v) => v.layer !== 'obecna');
    if (!ranked.length || (!signal.length && !from)) {
      return { ...base, to: null, status: 'do wyszukania', score: 0, margin: 0, reason: 'brak sygnału w nazwie i opisie — sprawdzić w internecie' };
    }
    const [best, bestA] = ranked[0];
    const second = ranked[1]?.[1].score ?? 0;
    const margin = bestA.score - second;
    const independent = [...bestA.layers].filter((l) => l !== 'obecna').length;
    // sprzeczność: opis wcale nie wspiera wybranej kategorii, za to wyraźnie wskazuje inną
    const descTop = descVotes[0];
    const conflict = !!descTop && !bestA.layers.has('ręczne') && descTop.leaf !== best && !descVotes.some((v) => v.leaf === best) && descTop.weight >= 0.5;
    const reason = votes.filter((v) => v.leaf === best).map((v) => v.why).join('; ') + (conflict ? `; SPRZECZNOŚĆ: wybrano ${best}, a opis wskazuje ${descTop!.leaf}` : '');
    const out = { ...base, to: best, score: +bestA.score.toFixed(2), margin: +margin.toFixed(2), reason };
    if (conflict) flags.push('sprzeczność nazwa/opis');

    // walidacja: zmiana lub nowe przypisanie wymaga dowodu z samego produktu (nazwa, opis, identyczny produkt w innym opakowaniu),
    // a nie tylko podobieństwa do innych (np. ogólna linia marki — „Nerta ATC 350” to nie to samo co „Nerta ATC 100”)
    if (best !== from && !votes.some((v) => v.leaf === best && EVIDENCE.includes(v.layer))) {
      flags.push('bez dowodu w nazwie lub opisie');
      return from
        ? { ...out, to: from, status: 'pewne', reason: `bez zmian — brak dowodu za zmianą (${reason})` }
        : { ...out, to: null, status: 'do wyszukania', reason: `brak dowodu w nazwie i opisie; podpowiedź: ${reason}` };
    }
    if (best !== from) flags.push('zmiana kategorii');

    // walidator wymagań: kategoria wymaga deklaracji, której produkt nie ma (np. „ekologiczny” bez ECO w nazwie i opisie)
    const needs = LEAF_REQUIRES[best];
    if (needs && !needs(name, fold(p.short ?? '')) && !bestA.layers.has('ręczne')) {
      flags.push('brak wymaganej deklaracji');
      const alt = ranked.find(([leaf]) => leaf !== best);
      return {
        ...out,
        to: alt ? alt[0] : null,
        score: alt ? +alt[1].score.toFixed(2) : 0,
        reason: `${reason}; BRAK DEKLARACJI: „${best}” wymaga oznaczenia ekologicznego w nazwie lub opisie${alt ? ` → ${alt[0]}` : ''}`,
        status: 'do sprawdzenia',
      };
    }

    // walidator wykluczeń: nazwa zawiera słowo wykluczające wybraną kategorię (np. folia w łazienkach) — dotyczy też obecnego przypisania
    const forbidden = LEAF_EXCLUDES[best];
    if (forbidden && forbidden.test(name) && !bestA.layers.has('ręczne')) {
      flags.push('wykluczone w nazwie');
      const alt = ranked.find(([leaf]) => leaf !== best && !LEAF_EXCLUDES[leaf]?.test(name));
      const altStrong = !!alt && votes.some((v) => v.leaf === alt[0] && EVIDENCE.includes(v.layer) && v.weight >= 0.8);
      const note = `${reason}; WYKLUCZENIE: nazwa nie pasuje do „${best}”`;
      return alt
        ? { ...out, to: alt[0], score: +alt[1].score.toFixed(2), reason: `${note} → ${alt[0]}`, status: altStrong ? 'pewne' : 'do sprawdzenia' }
        : { ...out, to: null, reason: note, status: 'do sprawdzenia' };
    }
    // sama poprawka opakowania (duże → myjnia, małe → chemia samochodowa) jest zawsze pewna
    if (from && fromFixed !== from && best === fromFixed) return { ...out, status: 'pewne' };

    if (best === from && !conflict) return { ...out, status: 'pewne' }; // potwierdzona obecna kategoria
    if (conflict && !bestA.layers.has('ręczne')) return { ...out, status: 'do sprawdzenia' };
    // samo podobieństwo nazw (bez żadnej innej warstwy) nie uzasadnia przypisania ani zmiany
    const onlySimilar = signal.length > 0 && signal.every((v) => v.layer === 'podobne');
    if (onlySimilar) {
      return from ? { ...out, to: from, status: 'pewne', reason: 'bez zmian (brak mocnego sygnału za zmianą)' } : { ...out, to: null, status: 'do wyszukania', reason: 'tylko podobieństwo nazw — sprawdzić w internecie' };
    }
    if (bestA.layers.has('ręczne')) return { ...out, status: 'pewne' };
    if (!signal.length) return { ...out, status: 'do wyszukania' };
    const strong = bestA.score - (agg.get(from)?.score ?? 0) >= 0.9 && margin >= 0.5;
    if (strong && independent >= 2) return { ...out, status: 'pewne' };
    if (strong && independent === 1 && [...bestA.layers][0] !== 'podobne' && bestA.score >= 1.3) return { ...out, status: 'pewne' };
    if (bestA.score >= 0.55 && margin >= 0.2) return { ...out, status: 'do sprawdzenia' };
    return { ...out, to: best, status: 'do sprawdzenia' };
  }

  return { decide };
}
