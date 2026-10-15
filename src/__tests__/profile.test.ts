import { describe, expect, it } from 'vitest';
import {
  MAX_LEVEL,
  XP_EVENT_CAP,
  computeStats,
  levelFromXp,
  rankForLevel,
  xpForLevel,
  type ActivityRow,
} from '../lib/profileStats';
import { ACHIEVEMENTS, computeEarnedDates, computeTeamGoals, evaluateAchievements } from '../lib/achievements';
import { computeWeeklySummary } from '../lib/weeklySummary';
import { isUnlocked, unlockedByLevelUp, type Cosmetic } from '../lib/profileCosmetics';

function row(daysAgo: number, action = 'product.update', count?: number, hour = 10): ActivityRow {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return { created_at: d.toISOString(), action, changes: count ? { count: { to: count } } : null };
}

describe('poziomy i rangi', () => {
  it('poziom rośnie monotonicznie z punktami', () => {
    let prev = 0;
    for (const xp of [0, 10, 25, 100, 1000, 5000, 20000, 60000, 120000, 500000]) {
      const l = levelFromXp(xp).level;
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });

  it('progi poziomów są zgodne z krzywą', () => {
    expect(xpForLevel(1)).toBe(0);
    for (const level of [2, 10, 20, 40, 60, 100, 120]) {
      expect(levelFromXp(xpForLevel(level)).level).toBe(level);
      expect(levelFromXp(xpForLevel(level) - 1).level).toBe(level - 1);
    }
  });

  it('rangi obejmują po 20 poziomów, Legenda 101–120', () => {
    expect(rankForLevel(1).name).toBe('Świeżak');
    expect(rankForLevel(20).name).toBe('Świeżak');
    expect(rankForLevel(21).name).toBe('Stażysta');
    expect(rankForLevel(100).name).toBe('Mistrz katalogu');
    expect(rankForLevel(101).name).toBe('Legenda Kenochem');
    expect(rankForLevel(9999).name).toBe('Legenda Kenochem');
  });

  it('poziom nie przekracza maksimum', () => {
    const l = levelFromXp(10_000_000);
    expect(l.level).toBe(MAX_LEVEL);
    expect(l.maxed).toBe(true);
  });

  it('awans nie jest zbyt szybki: miesiąc intensywnej pracy to wciąż niski poziom', () => {
    expect(levelFromXp(8 * 30 * 5).level).toBeLessThan(12);
  });
});

describe('statystyki pracy', () => {
  it('liczy punkty z limitem na operację zbiorczą', () => {
    const s = computeStats([row(0, 'tech.approve', 300), row(0, 'product.update')]);
    expect(s.xp).toBe(XP_EVENT_CAP + 1);
    expect(s.counts.tech).toBe(300); // do odznak liczy się pełna liczba
  });

  it('logowania nie dają punktów', () => {
    const s = computeStats([row(0, 'auth.login'), row(0, 'auth.login')]);
    expect(s.xp).toBe(0);
    expect(s.logins).toBe(2);
  });

  it('seria dni roboczych: weekend jej nie przerywa', () => {
    const rows: ActivityRow[] = [];
    let d = 0;
    let found = 0;
    while (found < 5) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        rows.push(row(d));
        found++;
      }
      d++;
    }
    expect(computeStats(rows).bestStreak).toBe(5);
  });

  it('przerwa w dniu roboczym przerywa serię', () => {
    const s = computeStats([row(20), row(19), row(1)]);
    expect(s.bestStreak).toBeLessThanOrEqual(2);
  });
});

describe('osiągnięcia', () => {
  it('stopnie odblokowują się na progach', () => {
    const rows = Array.from({ length: 10 }, () => row(0, 'product.image'));
    const st = evaluateAchievements(computeStats(rows)).find((s) => s.def.id === 'fotograf')!;
    expect(st.value).toBe(10);
    expect(st.tier).toBe(1);
    expect(st.next).toBe(50);
  });

  it('każda odznaka ma 4 rosnące progi', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.tiers).toHaveLength(4);
      expect([...a.tiers].sort((x, y) => x - y)).toEqual([...a.tiers]);
    }
  });

  it('daty zdobycia stopni wskazują pierwszy dzień osiągnięcia progu', () => {
    const rows = [...Array.from({ length: 10 }, () => row(5, 'product.image')), row(1, 'product.image')];
    const dates = computeEarnedDates(rows)['fotograf'];
    expect(dates[0]).not.toBeNull();
    expect(dates[1]).toBeNull();
  });

  it('podsumowanie tygodnia zawiera nazwę użytkownika i liczby', () => {
    const rows = [row(0), row(0), row(7), row(8), row(9)];
    const stats = computeStats(rows);
    const sum = computeWeeklySummary(stats, rows, computeEarnedDates(rows), 'Test');
    expect(sum.text).toContain('Test');
    expect(sum.thisWeek + sum.lastWeek).toBeGreaterThan(0);
  });

  it('cele zespołu: 100% zdjęć daje diament', () => {
    const products = [
      { id: '1', sku: 'A', hasImage: true },
      { id: '2', sku: 'B', hasImage: true },
    ] as never[];
    const goal = computeTeamGoals(products, []).find((g) => g.id === 'all-photos')!;
    expect(goal.pct).toBe(100);
    expect(goal.tier).toBe(4);
  });
});

describe('kosmetyka profilu', () => {
  it('nagrody za poziom odblokowują się na progach', () => {
    const frame: Cosmetic = { id: 'gold', kind: 'frame', name: 'Złoto', desc: '', req: { type: 'level', level: 50 } };
    expect(isUnlocked(frame, 49, [])).toBe(false);
    expect(isUnlocked(frame, 50, [])).toBe(true);
  });

  it('awans z 9 na 12 odblokowuje nagrody z tego zakresu', () => {
    const names = unlockedByLevelUp(9, 12).map((c) => c.name);
    expect(names).toContain('Zmierzch');
    expect(names).toContain('Iskierki');
    expect(names).not.toContain('Siatka techniczna');
  });
});
