export type KenochemCategoryGroup = {
  root: string;
  categories: string[];
};

import { getShopCategoryTree, walkShopLeaves } from './shopCategoryTree';

export const KENOCHEM_CATEGORY_GROUPS: KenochemCategoryGroup[] = [
  {
    root: 'Samochód wnętrze',
    categories: [
      'Kokpit',
      'Tapicerka',
      'Skóra',
      'Elementy gumowe',
      'Neutralizatory / odświeżacze',
      'Klimatyzacja',
      'Środki przeciw parowaniu szyb',
    ],
  },
  {
    root: 'Samochód na zewnątrz',
    categories: [
      'Mycie',
      'Szampony',
      'Piany aktywne',
      'Szyby',
      'Felgi',
      'Opony',
      'Plastiki',
      'Chromy / metale',
      'Silnik',
      'Zabezpieczenie lakieru',
      'Polerowanie',
      'Usuwanie smoły, kleju',
      'Glinkowanie',
    ],
  },
  {
    root: 'Profesjonalna chemia do myjni',
    categories: [
      'Aktywne piany',
      'Anty insekt',
      'Szampony',
      'Woski',
      'Oprysk felg',
      'Proszek',
      'Płyn do prania tapicerki samochodowej',
      'Płyn do szyb',
      'Zapach do myjni',
      'Usuwanie smoły, asfaltu',
    ],
  },
  {
    root: 'Chemia warsztatowa',
    categories: [
      'Smary',
      'Zmywacze',
      'Chemia techniczna',
      'Czyściwa',
      'Utrzymanie czystości',
      'Płyny do myjek ultradźwiękowych',
      'Czyszczenie DPF',
    ],
  },
  {
    root: 'Maszyny / urządzenia',
    categories: [
      'Części do myjni / myjek',
      'Adaptery',
      'Dysze',
      'Dysze wody',
      'Dysza paliwa',
      'Inżektor',
      'Lance',
      'Manometry',
      'Odkurzacze',
      'Pianownice',
      'Pistolety',
      'Szczotki',
      'Szybkozłącza',
      'Węże',
      'Wąż do czyszczenia rur',
      'Zawory By-Pass',
      'Złącza obrotowe',
      'Filtry',
      'Redukcje',
      'Uchwyty dywaników',
      'Bęben do węża',
      'Myjki',
      'Tornadory',
      'Akcesoria do myjni',
    ],
  },
  {
    root: 'Akcesoria',
    categories: [
      'Aplikatory',
      'Opakowania',
      'Gąbki',
      'Dozowniki do mydła',
      'Filtry wody',
      'Kije',
      'Mikrowłókna',
      'Miotły',
      'Mopy',
      'Opryskiwacze',
      'Opryskiwacze ciśnieniowe',
      'Opryskiwacze pneumatyczne',
      'Pędzelki',
      'Pianownice',
      'Pokrowce',
      'Rękawiczki',
      'Skrobaczki',
      'Stelaże do mopów',
      'Szczotki przemysłowe',
      'Ściągacze do wody',
      'Ściągaczki do szyb',
      'Wiadra',
      'Worki',
      'Wózki sprzątające',
      'Pistolety piorące / tornadory',
      'Podajniki na ręczniki',
      'Przepychacz do rur',
    ],
  },
  {
    root: 'Chemia obiektowa / HoReCa / ogród',
    categories: [
      'Chemia obiektowa / dom',
      'Powierzchnie ponadpodłogowe',
      'Kuchnia',
      'Pranie i odplamianie dywanów',
      'Podłogi',
      'Okna, szyby, lustra',
      'Toaleta i łazienka',
      'Chemia profesjonalna HoReCa',
      'Chemia rolnicza',
      'Ogród',
      'Basen',
      'Kostka brukowa i kamień',
      'Panele fotowoltaiczne',
      'Elewacja',
      'Dach',
      'Dezynfekcja',
    ],
  },
];

function normalizeCategory(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pl')
    .replace(/\s+/g, ' ')
    .replace(/[–—-]/g, '-');
}

export function getKenochemCategoryGroupsFor(
  categories: string[],
): { root: string; leaves: string[] }[] {
  const available = new Map<string, string>();
  for (const category of categories) {
    if (!category || category === 'Wszystkie') continue;
    available.set(normalizeCategory(category), category);
  }

  const used = new Set<string>();
  const groups: { root: string; leaves: string[] }[] = [];

  for (const root of getShopCategoryTree().roots) {
    const leaves = walkShopLeaves(root.children.length ? root.children : [root])
      .map((leaf) => available.get(normalizeCategory(leaf.label)))
      .filter((leaf): leaf is string => Boolean(leaf))
      .filter((leaf) => !used.has(leaf));
    if (leaves.length) {
      for (const leaf of leaves) used.add(leaf);
      groups.push({ root: root.name, leaves });
    }
  }

  for (const group of KENOCHEM_CATEGORY_GROUPS) {
    const leaves: string[] = [];
    for (const candidate of group.categories) {
      const exact = available.get(normalizeCategory(candidate));
      if (exact && !used.has(exact)) {
        leaves.push(exact);
        used.add(exact);
      }
    }
    if (leaves.length) groups.push({ root: group.root, leaves });
  }

  const rest = categories
    .filter((category) => category !== 'Wszystkie' && !used.has(category))
    .sort((a, b) => a.localeCompare(b, 'pl'));
  if (rest.length) groups.push({ root: 'Inne / do decyzji', leaves: rest });

  return groups;
}
