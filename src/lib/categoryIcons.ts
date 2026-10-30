import {
  Armchair,
  Bath,
  Beaker,
  Brush,
  Bug,
  Cable,
  Car,
  CircleDot,
  Cloud,
  Cog,
  Crosshair,
  Disc3,
  Droplets,
  FileText,
  Filter,
  FlaskConical,
  Flower2,
  Fuel,
  Gauge,
  Gem,
  Hand,
  House,
  Layers,
  Link2,
  Package,
  Pipette,
  Scroll,
  Shield,
  ShieldCheck,
  Shirt,
  Snowflake,
  Sparkles,
  SprayCan,
  Sprout,
  Sun,
  Target,
  Trees,
  UtensilsCrossed,
  Waves,
  Wheat,
  Wind,
  Wrench,
  AppWindow,
  type LucideIcon,
} from 'lucide-react';

/**
 * Ikona kategorii wyliczana z jej NAZWY (słowa kluczowe), a nie przypisana na sztywno —
 * po zmianie nazwy kategorii ikona dopasuje się sama. Gdy nazwa nic nie mówi, bierze ikonę z nadrzędnej.
 * Kolejność reguł ma znaczenie: pierwsza pasująca wygrywa, więc bardziej szczegółowe są wyżej.
 */
const RULES: [RegExp, LucideIcon][] = [
  // główne działy
  [/^chemia profesjonalna/, FlaskConical],
  [/^chemia samochodowa/, Car],
  [/^chemia specjalistyczna/, Beaker],
  [/^dom i ogrod/, House],
  [/^(myjnie i urzadzenia|myjnia samochodowa)/, Waves],
  [/^sprzet i akcesoria czyszczace/, Brush],
  [/^zapachy i aromamarketing/, Flower2],
  // części do myjek
  [/lance|pistolet/, Target],
  [/dysz/, Crosshair],
  [/weze|bebn|wez\b/, Cable],
  [/szybkozlacz|adapter|zlacz|redukcj/, Link2],
  [/filtr|zawor/, Filter],
  [/pianownic|oprysk|spryskiwacz.*(pojemnik|butel)|butelk/, SprayCan],
  [/pomp|manometr|cisnien/, Gauge],
  // zapachy
  [/olejk|esencj|dyfuz|patyczk|perfum|zawieszk|aromamarket|swiec|saszetk|zapach|neutralizator|odswiezacz/, Flower2],
  // samochód
  [/felg|opon|dressing|czernid/, CircleDot],
  [/szyb|szklo|antypar|lusterk|lustr/, AppWindow],
  [/wosk|lakier|polerski|polerowan|politur|cleaner|aio|powlok|ceramicz|sealant|detailing/, Sparkles],
  [/pady|futra|tarcz/, Disc3],
  [/skora|tapicer|kokpit|plastik|wnetrz|dywan|klimatyzac/, Armchair],
  [/owad|smola|asfalt|klej|zywic/, Bug],
  [/silnik|smar|olej\b|oleje|techniczn|warsztat|odrdzew|zmywacz|odtluszcz/, Cog],
  [/paliw|diesel|adblue/, Fuel],
  [/zima|odmraz|mroz|snieg|lod/, Snowflake],
  [/piana|pian\b|szampon|mycie|myjni|prewash|pre-wash|tfr|samoobslug|portal/, Droplets],
  // higiena i dom
  [/dezynf|antybakter|higien|inwentarsk|udoj/, ShieldCheck],
  [/lazien|sanitar|wc\b|toalet|prysznic/, Bath],
  [/kuchni|piec|grill|frytkown|gastronom/, UtensilsCrossed],
  [/mydl|zele do rak|rekawic|rekawicz|ochrona osobista/, Hand],
  [/pranie|tekstyl|plukan|plyny do prania|odplamiacz/, Shirt],
  [/papier|czysciw|recznik|podajnik|dozownik|folie|worki|torby/, Scroll],
  [/dozowan|butelk|opakowan|pojemnik|kanist/, Pipette],
  [/mikrofib|gabk|sciereczk|scierk|szmat|pad\b/, Layers],
  [/szczotk|miotl|zmiotk|sciagacz|skrobacz|kije|draz|mop|wiader|wyciskark|wozki|podlog|posadzk|powierzchni/, Brush],
  [/ogrod|kostk|elewacj|dach|markiz|taras|zewnetrzn|czyszczenie zewnetrzne/, Trees],
  [/rolnic|gospodar|maszyn rolnicz/, Wheat],
  [/fotowolt|panel/, Sun],
  [/transport|ciezarow|pojazd|autokar/, Car],
  [/roslin|trawnik|kwiat/, Sprout],
  [/odkurzacz|odkurzac/, Wind],
  [/ultradzwiek|dpf|fap/, Cloud],
  [/ochron|zabezpiecz|konserwac|impregnac|hydrofob/, Shield],
  [/premium|luksus/, Gem],
  [/serwis|naprawcz|czesci|akcesoria do myjek|wyposazenie/, Wrench],
  [/zestaw|inne|pozostale|bez kategorii|do decyzji/, Package],
  [/opis|instrukcj|dokument/, FileText],
];

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase();

const cache = new Map<string, LucideIcon>();

/** Ikona dla kategorii; `path` to „Dział › Podkategoria › Kategoria” — pusta nazwa bierze ikonę z wyższego poziomu. */
export function iconForCategory(name: string, path?: string): LucideIcon {
  const key = `${name}|${path ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const segments = (path ? path.split('›') : [name]).map((s) => norm(s.trim())).filter(Boolean);
  if (!segments.length) segments.push(norm(name));
  // zaczynamy od najgłębszego poziomu (sama kategoria), potem rodzice
  let icon: LucideIcon = Package;
  outer: for (let i = segments.length - 1; i >= 0; i--) {
    for (const [re, ic] of RULES) {
      if (re.test(segments[i])) {
        icon = ic;
        break outer;
      }
    }
  }
  cache.set(key, icon);
  return icon;
}
