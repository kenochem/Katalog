import { fold } from './partsText';

/**
 * Doradca drzewa kategorii: ocenia sam układ (nie pojedyncze produkty) i proponuje poprawki —
 * scalenie dubli i drobnicy, usunięcie pustych gałęzi, podział przeładowanych kategorii,
 * zmianę nazw oraz uporządkowanie poziomów. Czysta funkcja: niczego nie zapisuje.
 */
export interface AdvisorNode {
  name: string;
  parent: string | null;
  isLeaf: boolean;
  depth: number;
  path: string;
  fromShop: boolean;
}

export interface AdvisorRow {
  id: string;
  name: string;
  maker: string;
  /** Kategoria produktu teraz. */
  from: string;
  /** Kategoria proponowana przez silnik (gdy pewna). */
  to: string | null;
  status: string;
  alternatives: { leaf: string; score: number }[];
}

export interface AdvisorInput {
  nodes: AdvisorNode[];
  rows: AdvisorRow[];
  /** Id wszystkich produktów (także grup wariantów) w kategorii, kluczem jest nazwa kategorii. */
  currentIds: Map<string, string[]>;
}

export type TreeAction =
  | { kind: 'remove'; name: string }
  | { kind: 'merge'; name: string; into: string }
  | { kind: 'rename'; name: string; to: string }
  | { kind: 'split'; name: string; parent: string; parts: { label: string; name: string; ids: string[]; samples: string[] }[] }
  | { kind: 'flatten'; group: string; child: string; dept: string }
  | { kind: 'regroup'; dept: string; group: string; leaves: string[] }
  /** Uwaga bez automatycznej poprawki. */
  | { kind: 'note' };

export interface TreeProposal {
  id: string;
  action: TreeAction;
  tone: 'bad' | 'warn' | 'info';
  title: string;
  reason: string;
  /** Ile produktów dotyka zmiana. */
  products: number;
}

export interface TreeStats {
  leaves: number;
  /** Kategorie z 3–60 produktami — wygodne do przeglądania w sklepie. */
  healthy: number;
  overloaded: number;
  tiny: number;
  empty: number;
  /** Udział produktów w kategoriach-szufladach („Inne”, „Pozostałe”…). */
  dumpShare: number;
}

export interface TreeReport {
  proposals: TreeProposal[];
  stats: TreeStats;
}

export const OVERLOADED = 45;
export const TINY = 2;
const GROUP_TOO_WIDE = 14;

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const NAME_STOP = new Set(['do', 'na', 'dla', 'oraz', 'ze', 'przy', 'pod', 'bez', 'lub', 'po', 'od', 'the', 'and']);
const stem = (t: string) => {
  const s = t.length > 5 ? t.replace(/(ami|ach|owi|ego|emu|ych|ymi|ow|ie|om|em|a|y|i|e|u|o)$/, '') : t;
  return s.length === 5 && /[aeiouy]$/.test(s) ? s.slice(0, -1) : s;
};
/** Ten sam rdzeń: identyczny albo jeden jest początkiem drugiego („kanalizacj” ~ „kanalizacyjn”). */
const sameStem = (a: string, b: string) => {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 4 && l.startsWith(s)) return true;
  let k = 0;
  while (k < s.length && s[k] === l[k]) k++;
  return k >= 6;
};
const hasStem = (set: Set<string>, s: string) => {
  for (const t of set) if (sameStem(t, s)) return true;
  return false;
};
/** Słowa zbyt ogólne, by nazwać nimi podkategorię albo uznać je za treść nazwy kategorii. */
const GENERIC = new Set(['plyn', 'preparat', 'srodek', 'zestaw', 'mycia', 'mycie', 'czyszcz', 'czyszczenia', 'uniwersaln', 'zapachow', 'profesjonaln', 'premium', 'professional', 'classic', 'standard', 'basic', 'extra', 'koncentrat', 'pojemnik', 'butelk', 'komplet', 'opakowan', 'produkt', 'nowy', 'nowa', 'nowe']);
const isGeneric = (f: string) => GENERIC.has(f) || GENERIC.has(stem(f));
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Rdzenie słów z nazwy (bez przyimków, liczb i pojemności). */
function stems(text: string, min = 3): Set<string> {
  const out = new Set<string>();
  for (const w of words(text)) {
    const f = fold(w);
    if (f.length < min || /\d/.test(f) || NAME_STOP.has(f)) continue;
    out.add(stem(f));
  }
  return out;
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const DUMP = /^(inne|pozostal\w*|rozn\w*|ogoln\w*|reszta|diverse)\b/;
const isDump = (name: string) => DUMP.test(fold(name).trim());

/** Relacja nazw kategorii: dubel (prawie takie same) albo ogólna ⊂ szczegółowa („Dysze” i „Dysze obrotowe” — to nie to samo, ale klient może się pogubić). */
function nameRelation(a: Set<string>, b: Set<string>): 'dubel' | 'ogólna' | null {
  if (!a.size || !b.size) return null;
  const inter = [...a].filter((t) => hasStem(b, t)).length;
  if (inter === 0) return null;
  const union = a.size + b.size - inter;
  if (inter === a.size && inter === b.size) return 'dubel';
  if (a.size >= 2 && b.size >= 2 && inter / union >= 0.67) return 'dubel';
  if (inter === a.size || inter === b.size) return 'ogólna';
  return null;
}

interface Cluster {
  stem: string;
  word: string;
  ids: string[];
}

/** Słowa wyróżniające podzbiory produktów (poza nazwą kategorii, marką i słowem otwierającym nazwę). */
function clusterByName(members: AdvisorRow[], leafName: string): Cluster[] {
  const own = stems(leafName);
  const per = members.map((m) => {
    const makerStems = stems(m.maker);
    const lead = words(m.name)[0];
    const leadStem = lead ? stem(fold(lead)) : '';
    const found = new Map<string, string>();
    for (const w of words(m.name)) {
      const f = fold(w);
      if (f.length < 4 || /\d/.test(f) || NAME_STOP.has(f) || isGeneric(f)) continue;
      const s = stem(f);
      if (hasStem(own, s) || hasStem(makerStems, s) || sameStem(s, leadStem)) continue;
      if (!found.has(s)) found.set(s, w);
    }
    return found;
  });
  const n = members.length;
  const minSize = Math.max(5, Math.ceil(n * 0.07));
  const maxSize = Math.floor(n * 0.7);
  const assigned = new Set<number>();
  const out: Cluster[] = [];
  for (let round = 0; round < 6; round++) {
    const count = new Map<string, { idx: number[]; forms: Map<string, number> }>();
    per.forEach((found, i) => {
      if (assigned.has(i)) return;
      for (const [s, w] of found) {
        const e = count.get(s) ?? { idx: [] as number[], forms: new Map<string, number>() };
        e.idx.push(i);
        e.forms.set(w, (e.forms.get(w) ?? 0) + 1);
        count.set(s, e);
      }
    });
    let best: { s: string; idx: number[]; forms: Map<string, number> } | null = null;
    for (const [s, e] of count) {
      if (e.idx.length < minSize || e.idx.length > maxSize) continue;
      if (!best || e.idx.length > best.idx.length || (e.idx.length === best.idx.length && s.length > best.s.length)) best = { s, ...e };
    }
    if (!best) break;
    const word = [...best.forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
    best.idx.forEach((i) => assigned.add(i));
    out.push({ stem: best.s, word, ids: best.idx.map((i) => members[i].id) });
  }
  return out;
}

/** Słowo, które ma niemal każdy produkt kategorii, a samej nazwie kategorii go brakuje. */
function dominantWord(members: AdvisorRow[], leafName: string): { word: string; share: number } | null {
  const own = stems(leafName);
  const count = new Map<string, { n: number; forms: Map<string, number> }>();
  for (const m of members) {
    const makerStems = stems(m.maker);
    const lead = words(m.name)[0];
    const leadStem = lead ? stem(fold(lead)) : '';
    const seen = new Set<string>();
    for (const w of words(m.name)) {
      const f = fold(w);
      if (f.length < 4 || /\d/.test(f) || NAME_STOP.has(f) || isGeneric(f)) continue;
      const s = stem(f);
      if (hasStem(own, s) || hasStem(makerStems, s) || sameStem(s, leadStem) || seen.has(s)) continue;
      seen.add(s);
      const e = count.get(s) ?? { n: 0, forms: new Map() };
      e.n++;
      e.forms.set(w, (e.forms.get(w) ?? 0) + 1);
      count.set(s, e);
    }
  }
  let best: { word: string; share: number } | null = null;
  for (const e of count.values()) {
    const share = e.n / members.length;
    if (share >= 0.8 && (!best || share > best.share)) best = { word: [...e.forms.entries()].sort((a, b) => b[1] - a[1])[0][0], share };
  }
  return best;
}

export function adviseTree(input: AdvisorInput): TreeReport {
  const { nodes, rows } = input;
  const byKey = new Map(nodes.map((n) => [key(n.name), n]));
  const leaves = nodes.filter((n) => n.isLeaf && n.depth > 0);
  const childrenOf = new Map<string, AdvisorNode[]>();
  for (const n of nodes) if (n.parent) childrenOf.set(key(n.parent), [...(childrenOf.get(key(n.parent)) ?? []), n]);
  const rootOf = (n: AdvisorNode) => key(n.path.split(' › ')[0]);

  const currentCount = (n: AdvisorNode) => input.currentIds.get(key(n.name))?.length ?? 0;
  const projected = new Map<string, number>();
  const members = new Map<string, AdvisorRow[]>();
  for (const r of rows) {
    const cat = key(r.status === 'pewne' && r.to ? r.to : r.from);
    projected.set(cat, (projected.get(cat) ?? 0) + 1);
    const cur = key(r.from);
    members.set(cur, [...(members.get(cur) ?? []), r]);
  }
  const proj = (n: AdvisorNode) => projected.get(key(n.name)) ?? 0;

  const proposals: TreeProposal[] = [];
  const mergedAway = new Set<string>();
  const sizeOf = (n: AdvisorNode) => currentCount(n);

  const proposeMerge = (from: AdvisorNode, into: AdvisorNode, tone: TreeProposal['tone'], title: string, reason: string) => {
    if (mergedAway.has(key(from.name)) || mergedAway.has(key(into.name)) || key(from.name) === key(into.name)) return;
    mergedAway.add(key(from.name));
    proposals.push({ id: `merge:${from.name}`, action: { kind: 'merge', name: from.name, into: into.name }, tone, title, reason, products: sizeOf(from) });
  };

  // 1. dubel w nazwach: „Dysze” i „Dysze do myjek”, „Lance” i „Lance i pistolety”
  const stemsOf = new Map(leaves.map((n) => [key(n.name), stems(n.name)]));
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i];
      const b = leaves[j];
      if (rootOf(a) !== rootOf(b) || isDump(a.name) || isDump(b.name)) continue;
      const rel = nameRelation(stemsOf.get(key(a.name))!, stemsOf.get(key(b.name))!);
      if (!rel) continue;
      const [small, big] = sizeOf(a) <= sizeOf(b) ? [a, b] : [b, a];
      if (rel === 'dubel') {
        proposeMerge(small, big, 'warn', `„${small.name}” i „${big.name}” mogą być jedną kategorią`, `Nazwy niemal się pokrywają, więc klient nie wie, gdzie szukać. Mniejsza (${sizeOf(small)} szt.) może wejść do większej (${sizeOf(big)} szt.) — zdecyduj, czy to rzeczywiście to samo.`);
      } else {
        const [gen, spec] = stemsOf.get(key(a.name))!.size <= stemsOf.get(key(b.name))!.size ? [a, b] : [b, a];
        proposals.push({ id: `note:rel:${gen.name}:${spec.name}`, action: { kind: 'note' }, tone: 'info', title: `„${gen.name}” obok „${spec.name}”`, reason: `Ogólna kategoria leży obok swojej szczegółowej odmiany (${sizeOf(gen)} i ${sizeOf(spec)} szt.), a z nazw nie wynika, czym się różnią. Doprecyzuj ogólną (np. „Pozostałe …”) albo połącz.`, products: sizeOf(gen) + sizeOf(spec) });
      }
    }
  }

  // 2. kategorie, między którymi silnik się waha
  const pairs = new Map<string, number>();
  for (const r of rows) {
    const [f, s] = r.alternatives;
    if (f && s && s.score >= 0.5 && f.score - s.score < 0.6) {
      const k = [key(f.leaf), key(s.leaf)].sort().join(' <> ');
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  }
  for (const [k, n] of [...pairs.entries()].sort((a, b) => b[1] - a[1])) {
    const [ka, kb] = k.split(' <> ');
    const a = byKey.get(ka);
    const b = byKey.get(kb);
    if (!a || !b || !a.isLeaf || !b.isLeaf || isDump(a.name) || isDump(b.name)) continue;
    const [small, big] = sizeOf(a) <= sizeOf(b) ? [a, b] : [b, a];
    if (n < 4 || n < sizeOf(small) * 0.25) continue;
    if (key(a.parent ?? '') === key(b.parent ?? '')) {
      proposeMerge(small, big, 'info', `Granica „${small.name}” ⇄ „${big.name}” jest nieostra`, `Silnik waha się między nimi w ${n} produktach. Jeśli nie umiesz ich rozdzielić zasadą, lepiej połączyć je w jedną kategorię.`);
    } else if (!mergedAway.has(`note:${k}`)) {
      mergedAway.add(`note:${k}`);
      proposals.push({ id: `note:${k}`, action: { kind: 'note' }, tone: 'info', title: `Granica „${a.name}” ⇄ „${b.name}” jest nieostra`, reason: `Silnik waha się między nimi w ${n} produktach, a leżą w różnych działach (${a.path} / ${b.path}). Warto ustalić jedną regułę, co gdzie trafia.`, products: n });
    }
  }

  // 3. drobnica i puste gałęzie
  for (const n of leaves) {
    const cur = currentCount(n);
    if (cur === 0 && proj(n) === 0) {
      proposals.push({ id: `remove:${n.name}`, action: { kind: 'remove', name: n.name }, tone: 'info', title: `„${n.name}” jest pusta`, reason: `Nie ma w niej żadnego produktu, a silnik też nikogo do niej nie kieruje (${n.path}). Puste kategorie w sklepie wyglądają na niedokończone.`, products: 0 });
    } else if (cur > 0 && cur <= TINY && proj(n) <= TINY && !mergedAway.has(key(n.name)) && !isDump(n.name)) {
      const own = members.get(key(n.name)) ?? [];
      const score = new Map<string, number>();
      for (const r of own)
        for (const a of r.alternatives) {
          const t = byKey.get(key(a.leaf));
          if (!t || !t.isLeaf || key(a.leaf) === key(n.name)) continue;
          score.set(key(a.leaf), (score.get(key(a.leaf)) ?? 0) + a.score * (key(t.parent ?? '') === key(n.parent ?? '') ? 1.5 : 1));
        }
      const best = [...score.entries()].sort((a, b) => b[1] - a[1])[0];
      const sibling = (childrenOf.get(key(n.parent ?? '')) ?? []).filter((s) => s.isLeaf && key(s.name) !== key(n.name)).sort((a, b) => sizeOf(b) - sizeOf(a))[0];
      const target = (best && byKey.get(best[0])) || sibling;
      if (!target) continue;
      proposeMerge(n, target, 'info', `„${n.name}” ma ${cur} ${cur === 1 ? 'produkt' : 'produkty'}`, `Kategoria z ${cur === 1 ? 'jednym produktem' : 'dwoma produktami'} to w sklepie ślepa uliczka. ${best ? 'Najlepiej pasuje' : 'Najbliższa sąsiednia to'} „${target.name}”.`);
    }
  }

  // 4. przeładowane kategorie → podział na podkategorie
  for (const n of leaves) {
    const mem = members.get(key(n.name)) ?? [];
    if (isDump(n.name) || mem.length < OVERLOADED || !n.parent) continue;
    const clusters = clusterByName(mem, n.name);
    const covered = clusters.reduce((s, c) => s + c.ids.length, 0);
    if (clusters.length >= 2 && covered >= mem.length * 0.4) {
      const taken = new Set(nodes.map((x) => key(x.name)));
      const nameOf = new Map(mem.map((m) => [m.id, m.name]));
      const parts = clusters
        .map((c) => ({ label: cap(c.word), name: `${n.name} — ${c.word}`, ids: c.ids, samples: c.ids.slice(0, 3).map((id) => nameOf.get(id) ?? '') }))
        .filter((p) => !taken.has(key(p.name)));
      if (parts.length >= 2)
        proposals.push({
          id: `split:${n.name}`,
          action: { kind: 'split', name: n.name, parent: n.parent, parts },
          tone: mem.length >= 80 ? 'warn' : 'info',
          title: `„${n.name}” ma ${mem.length} produktów — kandydat do podziału`,
          reason: `Tak długiej listy nikt w sklepie nie przegląda. W nazwach powtarzają się: ${parts.map((p) => `${p.label} (${p.ids.length})`).join(', ')}. To tylko podpowiedź z nazw — odznacz części, które nie mają sensu, i popraw nazwy. Reszta (${mem.length - parts.reduce((s, p) => s + p.ids.length, 0)}) zostaje w „${n.name}”.`,
          products: parts.reduce((s, p) => s + p.ids.length, 0),
        });
    } else {
      proposals.push({ id: `note:big:${n.name}`, action: { kind: 'note' }, tone: 'info', title: `„${n.name}” ma ${mem.length} produktów`, reason: 'Nazwy nie układają się w oczywisty podział. Rozważ ręczny podział wg zastosowania albo typu produktu.', products: mem.length });
    }
  }

  // 5. szuflady („Inne”, „Pozostałe”)
  for (const n of leaves) {
    if (!isDump(n.name)) continue;
    const mem = members.get(key(n.name)) ?? [];
    if (mem.length < 15) continue;
    const movable = mem.filter((r) => r.status === 'pewne' && r.to && key(r.to) !== key(r.from)).length;
    const hinted = mem.filter((r) => r.status === 'do sprawdzenia' && r.to && key(r.to) !== key(r.from)).length;
    proposals.push({
      id: `note:dump:${n.name}`,
      action: { kind: 'note' },
      tone: 'bad',
      title: `„${n.name}” to szuflada: ${mem.length} produktów`,
      reason: `Kategoria bez znaczenia nie pomaga klientowi. Silnik umie już przenieść ${movable} z nich na pewno i ${hinted} z nadzieją (zakładka Przypisania → Sprawdź przypisane). Reszta wymaga nowej kategorii albo materiałów od producenta.`,
      products: mem.length,
    });
  }

  // 6. za wąski i za szeroki układ
  for (const g of nodes.filter((x) => !x.isLeaf && x.depth === 1)) {
    const kids = childrenOf.get(key(g.name)) ?? [];
    if (kids.length === 1 && kids[0].isLeaf && g.parent)
      proposals.push({ id: `flatten:${g.name}`, action: { kind: 'flatten', group: g.name, child: kids[0].name, dept: g.parent }, tone: 'info', title: `Grupa „${g.name}” ma jedną podkategorię`, reason: `Dodatkowy poziom z jedną pozycją („${kids[0].name}”) tylko wydłuża drogę do produktu. Można ją przenieść wyżej i usunąć grupę.`, products: sizeOf(kids[0]) });
  }
  const taken = new Set(nodes.map((x) => key(x.name)));
  for (const d of nodes.filter((x) => x.depth === 0)) {
    const kids = (childrenOf.get(key(d.name)) ?? []).filter((x) => x.isLeaf);
    if (kids.length < GROUP_TOO_WIDE) continue;
    const left = new Set(kids.map((k) => key(k.name)));
    for (let g = 0; g < 4; g++) {
      const count = new Map<string, { names: string[]; forms: Map<string, number> }>();
      for (const k of kids) {
        if (!left.has(key(k.name))) continue;
        const seen = new Set<string>();
        for (const w of words(k.name)) {
          const f = fold(w);
          if (f.length < 4 || /\d/.test(f) || NAME_STOP.has(f)) continue;
          const s = stem(f);
          if (seen.has(s)) continue;
          seen.add(s);
          const e = count.get(s) ?? { names: [] as string[], forms: new Map<string, number>() };
          e.names.push(k.name);
          e.forms.set(w, (e.forms.get(w) ?? 0) + 1);
          count.set(s, e);
        }
      }
      const best = [...count.values()].filter((e) => e.names.length >= 3).sort((a, b) => b.names.length - a.names.length)[0];
      if (!best) break;
      const word = [...best.forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const name = `${cap(word)} — grupa`;
      best.names.forEach((nm) => left.delete(key(nm)));
      if (taken.has(key(name))) continue;
      taken.add(key(name));
      proposals.push({ id: `regroup:${d.name}:${name}`, action: { kind: 'regroup', dept: d.name, group: name, leaves: best.names }, tone: 'info', title: `Dział „${d.name}” ma ${kids.length} kategorii bez grup`, reason: `Za długa lista na jednym poziomie. ${best.names.length} z nich łączy słowo „${word}” (${best.names.join(', ')}) — mogłyby trafić do wspólnej grupy.`, products: best.names.reduce((s, nm) => s + sizeOf(byKey.get(key(nm))!), 0) });
    }
  }

  // 7. nazwy
  for (const n of nodes) {
    if (n.depth === 0) continue;
    const canRename = n.isLeaf || !n.fromShop;
    let fixed = n.name.trim().replace(/\s+/g, ' ').replace(/[\s.,;:\-–]+$/, '');
    if (fixed && fixed[0] !== fixed[0].toUpperCase()) fixed = cap(fixed);
    if (canRename && fixed !== n.name && !taken.has(key(fixed)))
      proposals.push({ id: `rename:${n.name}`, action: { kind: 'rename', name: n.name, to: fixed }, tone: 'info', title: `Nazwa „${n.name}” ma usterkę zapisu`, reason: 'Zbędne spacje, znak na końcu albo mała litera na początku. W sklepie taka nazwa wygląda niedbale i trafia do adresu strony.', products: sizeOf(n) });
    else if (n.name.length > 48)
      proposals.push({ id: `note:long:${n.name}`, action: { kind: 'note' }, tone: 'info', title: `Nazwa „${n.name}” jest bardzo długa`, reason: `${n.name.length} znaków nie zmieści się w menu sklepu. Skróć do jednej myśli (np. rdzeń kategorii bez wyliczanki).`, products: sizeOf(n) });
    if (n.isLeaf && !isDump(n.name)) {
      const mem = members.get(key(n.name)) ?? [];
      if (mem.length >= 8) {
        const dom = dominantWord(mem, n.name);
        if (dom && canRename)
          proposals.push({ id: `rename:hint:${n.name}`, action: { kind: 'rename', name: n.name, to: n.name }, tone: 'info', title: `Nazwa „${n.name}” nie oddaje zawartości`, reason: `${Math.round(dom.share * 100)}% produktów (${Math.round(dom.share * mem.length)} z ${mem.length}) ma w nazwie „${dom.word}”, a nazwa kategorii tego nie mówi. Wpisz nazwę, która to uwzględnia.`, products: mem.length });
      }
    }
  }

  const order = { bad: 0, warn: 1, info: 2 } as const;
  proposals.sort((a, b) => order[a.tone] - order[b.tone] || b.products - a.products || a.id.localeCompare(b.id, 'pl'));

  const counts = leaves.map(currentCount);
  const total = counts.reduce((s, c) => s + c, 0);
  const dumpTotal = leaves.filter((n) => isDump(n.name)).reduce((s, n) => s + currentCount(n), 0);
  return {
    proposals,
    stats: {
      leaves: leaves.length,
      healthy: counts.filter((c) => c >= 3 && c <= 60).length,
      overloaded: counts.filter((c) => c >= OVERLOADED).length,
      tiny: counts.filter((c) => c > 0 && c <= TINY).length,
      empty: counts.filter((c) => c === 0).length,
      dumpShare: total ? dumpTotal / total : 0,
    },
  };
}
