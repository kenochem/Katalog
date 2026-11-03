import { describe, expect, it } from 'vitest';
import { buildEngine, packageVolume, type EngineProduct } from '../lib/categoryEngine';
import { flattenCategories } from '../lib/categoryRegistry';

const leaves = new Set(flattenCategories().filter((c) => c.isLeaf).map((c) => c.name));
const mk = (sku: string, name: string, category = '', extra: Partial<EngineProduct> = {}): EngineProduct => ({ sku, name, category, ...extra });

describe('silnik kategorii', () => {
  const base: EngineProduct[] = [
    mk('A1', 'Draco SPOT-EX 1 odplamiacz 750ml - na wino sok kawa krew', 'Tapicerka materiałowa', { desc: 'Odplamiacz do tkanin i odzieży. Usuwa plamy z wina, soku i kawy.' }),
    mk('A2', 'Draco SPOT-EX 2 Odplamiacz 750ml - na lakier do paznokci', 'Odplamiacze'),
    mk('A3', 'Draco SPOT-EX 3 odplamiacz 750ml - na lody czekolada', 'Odplamiacze'),
    mk('A4', 'Draco SPOT-EX 4 Odplamiacz 750ml - do ubrań na rdzę cement', 'Usuwanie betonu i cementu'),
    mk('B1', 'Pokrowce ochronne FOTEL PREMIUM 100szt', 'Łazienki i sanitariaty'),
    mk('C1', 'Folia spożywcza PE 300/200 A4', 'Łazienki i sanitariaty'),
    mk('D1', 'Tajemniczy preparat XZ-9 5L', ''),
    mk('D2', 'Apple Notebook 12"-14.5"', ''),
    mk('E1', 'Środek do czyszczenia WC kamień i rdza 750 ml', 'Łazienki i sanitariaty'),
  ];
  const engine = buildEngine(base, { leaves });
  const get = (sku: string) => engine.decide(base.find((p) => p.sku === sku)!);

  it('odplamiacz w nazwie wygrywa z tapicerką i betonem (linia SPOT-EX)', () => {
    for (const sku of ['A1', 'A4']) {
      const d = get(sku);
      expect(d.to, sku).toBe('Odplamiacze');
    }
  });

  it('pokrowce na fotele i folia spożywcza nie zostają w łazienkach', () => {
    expect(get('B1').to).toBe('Pokrowce, folie i uchwyty');
    expect(get('C1').to).toBe('Folie, torby i opakowania');
  });

  it('notebook to pozycja niesprzedażowa (do ukrycia)', () => {
    expect(get('D2').status).toBe('do ukrycia');
  });

  it('produkt bez sygnału trafia na listę do wyszukania, a nie do przypadkowej kategorii', () => {
    const d = get('D1');
    expect(d.status).toBe('do wyszukania');
    expect(d.to).toBeNull();
  });

  it('poprawną kategorię potwierdza', () => {
    const d = get('E1');
    expect(d.to).toBe('Łazienki i sanitariaty');
    expect(d.status).toBe('pewne');
  });
});

describe('kontekst produktu', () => {
  const list: EngineProduct[] = [
    mk('K1', 'Draco Czysta Kostka 5L - Mycie Odtłuszczanie Kostki Brukowej', 'Pisuary i kostki WC', { desc: 'Preparat do mycia kostki brukowej, płyt i kamienia. Usuwa tłuste zabrudzenia z kostki brukowej.' }),
    mk('K2', 'Kostka WC z koszyczkiem Bref 3x50g', 'Pisuary i kostki WC'),
  ];
  const e = buildEngine(list, { leaves });

  it('„kostka” w nazwie nie oznacza pisuarów, jeśli opis mówi o kostce brukowej', () => {
    expect(e.decide(list[0]).to).toBe('Kostka brukowa i kamień');
  });

  it('kostka WC zostaje w pisuarach', () => {
    expect(e.decide(list[1]).to).toBe('Pisuary i kostki WC');
  });
});

describe('walidacje silnika', () => {
  const list: EngineProduct[] = [
    mk('N1', 'NERTA ATC 100 5L', 'Kwasy i zasady przemysłowe', { desc: 'Środek na bazie kwasu fluorowodorowego do elewacji i aluminium.' }),
    mk('N2', 'NERTA ATC 100 20L', 'Kwasy i zasady przemysłowe'),
    mk('N3', 'NERTA ATC 350 25L', ''),
    mk('U1', 'USŁUGA - WYSYŁKA', ''),
    mk('F1', 'Test Produkt Alfa 1L', 'Podłogi i posadzki'),
    mk('F2', 'Test Produkt Alfa 5L', 'Odkamienianie urządzeń'),
    mk('F3', 'Test Produkt Alfa 10L', 'Odkamienianie urządzeń'),
  ];
  const e = buildEngine(list, { leaves });
  const get = (sku: string) => e.decide(list.find((p) => p.sku === sku)!);

  it('inny model tej samej linii nie dziedziczy kategorii po numerze (ATC 350 ≠ ATC 100)', () => {
    const d = get('N3');
    expect(d.to).toBeNull();
    expect(d.status).toBe('do wyszukania');
    expect(d.flags).toContain('bez dowodu w nazwie lub opisie');
  });

  it('pozycje niesprzedażowe trafiają do ukrycia', () => {
    const d = get('U1');
    expect(d.status).toBe('do ukrycia');
    expect(d.to).toBeNull();
  });

  it('ten sam produkt w różnych opakowaniach musi mieć tę samą kategorię (rodzina)', () => {
    const d = get('F1');
    expect(d.flags).toContain('rodzina niespójna');
  });
});

describe('reguła pojemności (myjnia ↔ detal)', () => {
  it('odczytuje pojemność z nazwy', () => {
    expect(packageVolume('Orion Eco Self Foam Cherry 1kg')).toBe(1);
    expect(packageVolume('Fraber QUICK WAX 25L - hydrowosk')).toBe(25);
    expect(packageVolume('Płyn 0,75L')).toBe(0.75);
    expect(packageVolume('KENOTEK GLOBO 3600 210L beczka')).toBe(210);
    expect(packageVolume('Pasta 250ml')).toBeNull();
  });

  const list: EngineProduct[] = [
    mk('V1', 'Kenotek Aktywna piana do mycia samochodów 5L', 'Aktywne piany do myjni'),
    mk('V2', 'Kenotek Aktywna piana do mycia samochodów 25L', 'Aktywne piany'),
    mk('V3', 'Kenotek Aktywna piana do mycia samochodów 1L', 'Aktywne piany'),
  ];
  const e = buildEngine(list, { leaves });
  const get = (sku: string) => e.decide(list.find((p) => p.sku === sku)!);

  it('litrówka z myjni wraca do chemii samochodowej', () => {
    const d = get('V1');
    expect(d.to).toBe('Aktywne piany');
    expect(d.status).toBe('pewne');
    expect(d.flags).toContain('reguła pojemności');
  });

  it('duży gabaryt z chemii samochodowej trafia do myjni', () => {
    const d = get('V2');
    expect(d.to).toBe('Aktywne piany do myjni');
    expect(d.status).toBe('pewne');
  });

  it('poprawne przypisanie zostaje', () => {
    const d = get('V3');
    expect(d.to).toBe('Aktywne piany');
    expect(d.flags).not.toContain('reguła pojemności');
  });
});

describe('logika drzewa: specyficzność i duble', () => {
  const list: EngineProduct[] = [
    mk('E1', 'Eco Shine ECO GLASS 1L - płyn do mycia szyb z alkoholem', 'Płyny do szyb samochodowych'),
    mk('K1', 'Domestos kostka WC z koszyczkiem', 'Łazienki i sanitariaty'),
    mk('C1', 'Domestos 1L - płyn do WC pine fresh', 'Łazienki i sanitariaty'),
    mk('P1', 'Proszek Persil 3,96kg biały', 'Płyny, żele i proszki do prania'),
    mk('V1', 'Vikan szczotka 70479 - przemysłowa do szorowania podłogi', 'Szczotki do mycia samochodu', { maker: 'VIKAN' }),
    mk('W1', 'Draco Czysta Kostka 5L - mycie kostki brukowej', 'Pisuary i kostki WC', { desc: 'Do mycia kostki brukowej i płyt chodnikowych.' }),
  ];
  const e = buildEngine(list, { leaves });
  const get = (sku: string) => e.decide(list.find((p) => p.sku === sku)!);

  it('linia Eco Shine ECO trafia wyłącznie do ekologicznych środków czystości', () => {
    expect(get('E1').to).toBe('Ekologiczne środki czystości');
  });

  it('kostki WC idą do pisuarów i kostek, a płyn do WC marki marketowej do chemii do domu', () => {
    expect(get('K1').to).toBe('Pisuary i kostki WC');
    expect(get('C1').to).toBe('Łazienka i WC');
  });

  it('Persil to chemia do domu (pranie), a szczotka Vikan to HACCP', () => {
    expect(get('P1').to).toBe('Pranie');
    expect(get('V1').to).toBe('Szczotki przemysłowe i HACCP');
  });

  it('„Czysta Kostka” nie jest produktem do pisuarów', () => {
    expect(get('W1').to).toBe('Kostka brukowa i kamień');
  });

  it('drzewo nie zawiera dubli ani pustej kategorii „do szyb do myjni”', () => {
    for (const gone of ['Płyny do szyb do myjni', 'Środki ekologiczne', 'Dywany i tapicerka domowa']) expect(leaves.has(gone), gone).toBe(false);
    for (const kept of ['Łazienka i WC', 'Pranie', 'Środki uniwersalne i meble', 'Ekologiczne środki czystości']) expect(leaves.has(kept), kept).toBe(true);
  });
});

describe('deklaracja ekologiczna, wykluczenia i producent', () => {
  const list: EngineProduct[] = [
    mk('G1', 'ECO SHINE Eco Glass 5 L', ''),
    mk('G2', 'Eilfix ECO 5004 S 10L', ''),
    mk('G3', 'Easy Wash ECO WASH 20L. Piana aktywna do mycia pojazdów.', 'Aktywne piany'),
    mk('G4', 'Miotła ECO EGO 0,72m - teleskopowa', 'Miotły i szczotki do podłóg'),
    mk('G5', 'Eco Shine DESTONE SHINE 1L - odkamieniacz do ekspresów', 'Odkamienianie urządzeń'),
    mk('X1', 'Folia spożywcza PE 300/200 A4', 'Łazienki i sanitariaty'),
    mk('X2', 'Cid Lines BIOGEL 25kg - żel do mycia kurnika obory chlewni', 'Łazienki i sanitariaty'),
    mk('B1', 'BORYGO ECO 1L zielony', ''),
    mk('X4', 'Folia szczelna 5x5 czyszcząca', 'Łazienki i sanitariaty'),
  ];
  const e = buildEngine(list, { leaves });
  const get = (sku: string) => e.decide(list.find((p) => p.sku === sku)!);

  it('linia ECO środków czyszczących trafia do ekologicznych (także Eilfix ECO), ale nie akcesoria i chemia samochodowa', () => {
    expect(get('G1').to).toBe('Ekologiczne środki czystości');
    expect(get('G2').to).toBe('Ekologiczne środki czystości');
    expect(get('G3').to).toBe('Aktywne piany do myjni'); // 20 L → myjnia, a nie ekologiczne (chemia samochodowa)
    expect(get('G4').to).toBe('Miotły i szczotki do podłóg');
  });

  it('sama marka Eco Shine nie jest deklaracją ekologiczną', () => {
    expect(get('G5').to).toBe('Odkamienianie urządzeń');
  });

  it('nieznany produkt z „ECO” w nazwie, ale bez cech środka czyszczącego, nie ląduje w ekologicznych', () => {
    expect(get('B1').to).not.toBe('Ekologiczne środki czystości');
  });

  it('walidator wykluczeń: folia i środek do kurników nie mogą zostać w łazienkach', () => {
    expect(get('X1').to).toBe('Folie, torby i opakowania');
    expect(get('X2').to).not.toBe('Łazienki i sanitariaty');
    // przypisanie bez żadnego dowodu poza „obecną” kategorią też jest wyłapywane przez wykluczenie
    const f = get('X4');
    expect(f.flags).toContain('wykluczone w nazwie');
    expect(f.status).toBe('do sprawdzenia');
  });
});

describe('znaki niewidoczne w nazwie', () => {
  it('Eilfix ECO z ukrytym znakiem sterującym trafia do ekologicznych', () => {
    const leaves = new Set(flattenCategories().filter((c) => c.isLeaf).map((c) => c.name));
    const p = { sku: 'X1', name: 'EILFIX \u0081ECO 5004 S 10L', maker: 'EILFIX', desc: '', short: '', usage: '', comp: '', category: '' };
    expect(buildEngine([p], { leaves }).decide(p).to).toBe('Ekologiczne środki czystości');
  });
});

describe('warstwa modelu statystycznego', () => {
  it('uczy się z nazw i opisów i głosuje przy dużej pewności', () => {
    const leaves = new Set(['Odkamienianie urządzeń', 'Pasty BHP']);
    const mk = (i: number, name: string, cat: string, desc: string): EngineProduct => ({ sku: `M${i}`, name, maker: 'X', desc, short: '', usage: '', comp: '', category: cat });
    const train: EngineProduct[] = [];
    for (let i = 0; i < 30; i++) train.push(mk(i, `Preparat zmiękczający kamień ${i}`, 'Odkamienianie urządzeń', 'usuwa kamień z ekspresów'));
    for (let i = 30; i < 60; i++) train.push(mk(i, `Preparat myjący ręce ${i}`, 'Pasty BHP', 'do brudnych rąk warsztat'));
    const target = mk(100, 'Preparat zmiękczający kamień nowy', '', 'usuwa kamień z ekspresów');
    const d = buildEngine([...train, target], { leaves }).decide(target);
    expect(d.votes.some((v) => v.layer === 'model' && v.leaf === 'Odkamienianie urządzeń')).toBe(true);
    // sam model nie wystarcza do przypisania — potrzebny dowód z nazwy lub opisu
    expect(d.to === null || d.status !== 'pewne' || d.votes.some((v) => v.layer === 'funkcja' || v.layer === 'opis')).toBe(true);
  });
});

describe('odporność na haczyki w opisie (np. „do prania odzieży i mopów”)', () => {
  const fl = flattenCategories().filter((c) => c.isLeaf);
  const leaves = new Set(fl.map((c) => c.name));
  const itemLeaves = new Set(fl.filter((c) => /^sprz[eę]t i akcesoria/i.test(c.path)).map((c) => c.name));
  const mk = (sku: string, name: string, desc: string, category = ''): EngineProduct => ({ sku, name, maker: 'DRACO', desc, short: '', usage: '', comp: '', category });
  const WASH = 'Profesjonalny płyn do prania odzieży roboczej i mopów. Płyn do pralni w hotelu, restauracji. Rozpuszcza tłuszcz i olej.';

  it('chemia wspominająca mopy w opisie nie trafia do kategorii mopów', () => {
    const p = mk('ZW1', 'Draco WorkBase ENERGY 5L - pranie odzieży roboczej mopów', WASH, 'Mopy i stelaże');
    const d = buildEngine([p], { leaves, itemLeaves }).decide(p);
    expect(d.to).toBe('Płyny, żele i proszki do prania');
    expect(d.flags).toContain('chemia, nie przedmiot');
  });
  it('linia i model sąsiadów z błędną kategorią nie przenoszą jej na chemię', () => {
    const bad = [1, 2, 3].map((i) => mk(`ZL${i}`, `Draco WorkBase ENERGY ${i}L - pranie odzieży`, WASH, 'Mopy i stelaże'));
    const p = mk('ZL9', 'Draco WorkBase PROFESSIONAL 5kg - proszek do prania odzieży', 'Proszek do prania odzieży roboczej i mopów.');
    const d = buildEngine([...bad, p], { leaves, itemLeaves }).decide(p);
    expect(d.to).toBe('Płyny, żele i proszki do prania');
    expect(d.votes.some((v) => v.leaf === 'Mopy i stelaże' && v.layer !== 'obecna')).toBe(false);
  });
  it('prawdziwy mop pozostaje mopem, także gdy opis mówi o praniu', () => {
    const p = mk('ZM1', 'Mop płaski z mikrofibry 40 cm', 'Mop do mycia podłóg. Można prać w pralce w 60 stopniach. Po praniu wysuszyć.');
    const d = buildEngine([p], { leaves, itemLeaves }).decide(p);
    expect(d.to).toBe('Mopy i stelaże');
    expect(d.flags).not.toContain('chemia, nie przedmiot');
  });
  it('przypisanie zatwierdzone przez użytkownika wygrywa z bramką rodzaju', () => {
    const p = mk('ZU1', 'Draco WorkBase ENERGY 5L - pranie odzieży roboczej mopów', WASH, 'Mopy i stelaże');
    const d = buildEngine([p], { leaves, itemLeaves, learned: { ZU1: 'Mopy i stelaże' } }).decide(p);
    expect(d.to).toBe('Mopy i stelaże');
  });
});
