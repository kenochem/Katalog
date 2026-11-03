import type { NameStats } from './engineNames';
import type { TreeStats } from './treeAdvisor';

export type EngineTab = 'przeglad' | 'przypisania' | 'drzewo' | 'nazwy' | 'wiedza' | 'opisy' | 'producenci';

/** Dane, z których Przegląd składa wynik gotowości katalogu i listę rzeczy do zrobienia. Brak pola = obszar jeszcze niepoliczony. */
export interface OverviewInput {
  products: number;
  categorized: number;
  /** Wynik analizy przypisań (po uruchomieniu silnika). */
  assign: { wrong: number; review: number; research: number; hide: number; unassignedSure: number } | null;
  tree: { stats: TreeStats; actionable: number } | null;
  names: NameStats;
  descriptions: { missing: number; issues: number } | null;
  /** Średnie pokrycie atrybutów (0–100) albo null, gdy nie ma żadnych zdefiniowanych. */
  attributesPct: number | null;
  manufacturers: { missing: number; suggested: number };
  /** Dostawcy (z WAPRO): ile produktów nie ma wskazanego dostawcy. */
  suppliers?: { without: number };
}

export interface Meter {
  id: EngineTab;
  label: string;
  /** 0–100 albo null, gdy obszar nie został jeszcze policzony. */
  value: number | null;
  detail: string;
}

export interface Task {
  id: string;
  tone: 'bad' | 'warn' | 'info' | 'ok';
  title: string;
  text: string;
  tab: EngineTab;
  /** Ile pozycji dotyczy — do sortowania. */
  count: number;
}

export interface Overview {
  /** Wynik gotowości 0–100 (średnia ważona policzonych obszarów) albo null, gdy nic nie policzono. */
  score: number | null;
  meters: Meter[];
  tasks: Task[];
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.max(0, Math.min(100, Math.round((100 * part) / whole))) : 100);
const pl = (n: number) => n.toLocaleString('pl-PL');

const WEIGHT: Partial<Record<EngineTab, number>> = { przypisania: 30, drzewo: 15, nazwy: 15, opisy: 20, wiedza: 10, producenci: 10 };

export function buildOverview(i: OverviewInput): Overview {
  const meters: Meter[] = [
    {
      id: 'przypisania',
      label: 'Kategorie produktów',
      value: i.assign ? pct(i.categorized - i.assign.wrong, i.products) : null,
      detail: i.assign ? `${pl(i.categorized)} z ${pl(i.products)} przypisanych, ${pl(i.assign.wrong)} błędnie` : 'uruchom analizę',
    },
    {
      id: 'drzewo',
      label: 'Drzewo kategorii',
      value: i.tree ? pct(i.tree.stats.healthy, i.tree.stats.leaves) : null,
      detail: i.tree ? `${pl(i.tree.stats.healthy)} z ${pl(i.tree.stats.leaves)} kategorii w sam raz` : 'uruchom analizę',
    },
    {
      id: 'nazwy',
      label: 'Nazwy rodzin produktów',
      value: i.names.total ? pct(i.names.ok, i.names.total) : null,
      detail: i.names.total ? `${pl(i.names.ok)} z ${pl(i.names.total)} zgodnych ze standardem` : 'brak rodzin technicznych',
    },
    {
      id: 'opisy',
      label: 'Opisy',
      value: i.descriptions ? pct(i.products - i.descriptions.missing - i.descriptions.issues, i.products) : null,
      detail: i.descriptions ? `${pl(i.descriptions.missing)} bez opisu, ${pl(i.descriptions.issues)} z uwagami` : 'uruchom analizę',
    },
    {
      id: 'wiedza',
      label: 'Atrybuty',
      value: i.attributesPct,
      detail: i.attributesPct == null ? 'brak zdefiniowanych atrybutów' : `średnio ${i.attributesPct}% uzupełnienia`,
    },
    {
      id: 'producenci',
      label: 'Producenci',
      value: pct(i.products - i.manufacturers.missing, i.products),
      detail: `${pl(i.manufacturers.missing)} produktów bez producenta`,
    },
  ];

  const counted = meters.filter((m) => m.value != null);
  const totalWeight = counted.reduce((s, m) => s + (WEIGHT[m.id] ?? 10), 0);
  const score = counted.length && i.assign ? Math.round(counted.reduce((s, m) => s + (m.value ?? 0) * (WEIGHT[m.id] ?? 10), 0) / totalWeight) : null;

  const tasks: Task[] = [];
  const add = (t: Task) => t.count > 0 && tasks.push(t);
  if (i.assign) {
    add({ id: 'wrong', tone: 'bad', title: `${pl(i.assign.wrong)} produktów jest przypisanych źle`, text: 'Nazwa, opis albo ten sam produkt w innym opakowaniu jednoznacznie wskazują inną kategorię.', tab: 'przypisania', count: i.assign.wrong });
    add({ id: 'sure', tone: 'ok', title: `${pl(i.assign.unassignedSure)} produktów bez kategorii można przypisać od ręki`, text: 'Silnik ma dla nich dowód w nazwie lub opisie i potwierdzenie z drugiej strony.', tab: 'przypisania', count: i.assign.unassignedSure });
    add({ id: 'review', tone: 'warn', title: `${pl(i.assign.review)} przypisań budzi wątpliwość`, text: 'Sygnały są sprzeczne albo słabe — wymagają Twojej decyzji.', tab: 'przypisania', count: i.assign.review });
    add({ id: 'research', tone: 'info', title: `${pl(i.assign.research)} produktów bez żadnego sygnału`, text: 'Nazwa i opis nic nie mówią. Dołącz kartę charakterystyki albo opis.', tab: 'przypisania', count: i.assign.research });
    add({ id: 'hide', tone: 'info', title: `${pl(i.assign.hide)} pozycji wygląda na niesprzedażowe`, text: 'Usługi, wysyłka, sprzęt biurowy — nie powinny być widoczne w katalogu.', tab: 'przypisania', count: i.assign.hide });
  }
  if (i.tree) add({ id: 'tree', tone: i.tree.stats.dumpShare > 0.05 ? 'bad' : 'warn', title: `${pl(i.tree.actionable)} propozycji porządkujących drzewo`, text: 'Duble w nazwach, drobnica, puste i przeładowane kategorie, szuflady typu „Inne”.', tab: 'drzewo', count: i.tree.actionable });
  add({ id: 'names', tone: 'warn', title: `${pl(i.names.sure)} nazw do ujednolicenia`, text: 'Ten sam gwint, materiał czy wymiar zapisany na kilka sposobów — Silnik składa je w jeden szyk.', tab: 'nazwy', count: i.names.sure });
  add({ id: 'names-check', tone: 'info', title: `${pl(i.names.check)} nazw do sprawdzenia`, text: 'Parser znalazł słowa, których nie umie zaszeregować.', tab: 'nazwy', count: i.names.check });
  add({ id: 'names-dups', tone: 'bad', title: `${pl(i.names.dups)} produktów ma po ujednoliceniu identyczną nazwę`, text: 'To prawdopodobne duble w katalogu (także z odwróconą kolejnością przyłączy).', tab: 'nazwy', count: i.names.dups });
  if (i.descriptions) {
    add({ id: 'desc-missing', tone: 'warn', title: `${pl(i.descriptions.missing)} produktów bez pełnego opisu`, text: 'Opisy powstają poza katalogiem — pobierz teczkę dla autora i wczytaj gotowe.', tab: 'opisy', count: i.descriptions.missing });
    add({ id: 'desc-issues', tone: 'warn', title: `${pl(i.descriptions.issues)} opisów z uwagami spójności`, text: 'Opis przeczy nazwie, kategorii albo danym z karty produktu.', tab: 'opisy', count: i.descriptions.issues });
  }
  if (i.attributesPct != null && i.attributesPct < 80) add({ id: 'attrs', tone: 'info', title: `Atrybuty uzupełnione średnio w ${i.attributesPct}%`, text: 'Silnik wyciągnie pH, formę, pojemność i dozowanie z nazw, opisów i kart produktów.', tab: 'wiedza', count: 100 - i.attributesPct });
  if (i.suppliers) add({ id: 'sup', tone: 'info', title: `${pl(i.suppliers.without)} produktów bez dostawcy`, text: 'Dostawca wynika z WAPRO i jest osobny od producenta. Uzupełnij go z producenta lub ręcznie.', tab: 'producenci', count: i.suppliers.without });
  add({ id: 'mf', tone: 'info', title: `${pl(i.manufacturers.suggested)} produktów bez producenta ma markę w nazwie`, text: 'Producenta można przypisać hurtem.', tab: 'producenci', count: i.manufacturers.suggested });

  const rank = { bad: 0, warn: 1, ok: 2, info: 3 } as const;
  tasks.sort((a, b) => rank[a.tone] - rank[b.tone] || b.count - a.count);
  return { score, meters, tasks };
}
