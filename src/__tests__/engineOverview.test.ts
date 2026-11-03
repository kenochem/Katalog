import { describe, expect, it } from 'vitest';
import { buildOverview, type OverviewInput } from '../lib/engineOverview';

const base: OverviewInput = {
  products: 1000,
  categorized: 950,
  assign: null,
  tree: null,
  names: { total: 0, ok: 0, sure: 0, check: 0, dups: 0 },
  descriptions: null,
  attributesPct: null,
  manufacturers: { missing: 0, suggested: 0 },
};

describe('przegląd silnika', () => {
  it('bez analizy nie podaje wyniku, ale pokazuje obszary policzone od razu', () => {
    const o = buildOverview({ ...base, manufacturers: { missing: 100, suggested: 40 } });
    expect(o.score).toBeNull();
    expect(o.meters.find((m) => m.id === 'producenci')?.value).toBe(90);
    expect(o.meters.find((m) => m.id === 'przypisania')?.value).toBeNull();
    expect(o.tasks.map((t) => t.id)).toEqual(['mf']);
  });

  it('wynik to średnia ważona policzonych obszarów', () => {
    const o = buildOverview({
      ...base,
      assign: { wrong: 50, review: 0, research: 0, hide: 0, unassignedSure: 0 },
      tree: { stats: { leaves: 100, healthy: 80, overloaded: 5, tiny: 3, empty: 2, dumpShare: 0 }, actionable: 0 },
      names: { total: 100, ok: 50, sure: 40, check: 10, dups: 0 },
      descriptions: { missing: 100, issues: 100 },
      attributesPct: 60,
    });
    // kategorie 90, drzewo 80, nazwy 50, opisy 80, atrybuty 60, producenci 100
    expect(o.meters.map((m) => m.value)).toEqual([90, 80, 50, 80, 60, 100]);
    expect(o.score).toBe(Math.round((90 * 30 + 80 * 15 + 50 * 15 + 80 * 20 + 60 * 10 + 100 * 10) / 100));
  });

  it('zadania są posortowane: błędy przed uwagami, a w obrębie wagi wg liczby', () => {
    const o = buildOverview({
      ...base,
      assign: { wrong: 12, review: 300, research: 80, hide: 0, unassignedSure: 40 },
      names: { total: 100, ok: 20, sure: 60, check: 5, dups: 7 },
      manufacturers: { missing: 10, suggested: 4 },
    });
    const ids = o.tasks.map((t) => t.id);
    expect(ids.slice(0, 2)).toEqual(['wrong', 'names-dups']);
    expect(ids.indexOf('review')).toBeLessThan(ids.indexOf('names-check'));
    expect(ids).not.toContain('hide');
    expect(o.tasks.find((t) => t.id === 'wrong')?.tab).toBe('przypisania');
    expect(o.tasks.find((t) => t.id === 'names')?.tab).toBe('nazwy');
  });

  it('wysoka szuflada w drzewie podnosi zadanie do poważnego', () => {
    const o = buildOverview({ ...base, tree: { stats: { leaves: 10, healthy: 5, overloaded: 0, tiny: 0, empty: 0, dumpShare: 0.1 }, actionable: 3 } });
    expect(o.tasks.find((t) => t.id === 'tree')?.tone).toBe('bad');
  });
});
