import type { Product } from '../types';
import {
  computeStats,
  dayKey,
  type ActivityRow,
  type ProfileStats,
} from './profileStats';
import { TECH_TYPES, type TechType } from './techParser';
import type { TechEntry } from './techStore';

/**
 * Model osiągnięć: 15 odznak osobistych w czterech stopniach (brąz, srebro, złoto, diament)
 * liczonych z własnej pracy + cele zespołu (kompletność katalogu) liczone ze stanu danych.
 */

export type AchCategory = 'foto' | 'dane' | 'techniczne' | 'magazyn' | 'integracje' | 'rytm' | 'zadania';

export const ACH_CATEGORY_LABEL: Record<AchCategory, string> = {
  foto: 'Zdjęcia',
  dane: 'Dane produktów',
  techniczne: 'Porządek techniczny',
  magazyn: 'Magazyn i ceny',
  integracje: 'Integracje',
  rytm: 'Rytm pracy',
  zadania: 'Zadania',
};

export const ACH_CATEGORY_ORDER: AchCategory[] = ['foto', 'dane', 'techniczne', 'magazyn', 'integracje', 'rytm', 'zadania'];

export type AchIcon =
  | 'pencil'
  | 'camera'
  | 'boxes'
  | 'tag'
  | 'wrench'
  | 'feather'
  | 'plug'
  | 'layers'
  | 'flame'
  | 'calendar'
  | 'sunrise'
  | 'moon'
  | 'rocket'
  | 'check'
  | 'sparkles';

export type Tier = 0 | 1 | 2 | 3 | 4;
export const TIER_NAMES = ['Nie zdobyta', 'Brąz', 'Srebro', 'Złoto', 'Diament'] as const;

export interface AchievementDef {
  id: string;
  name: string;
  /** Opis z miejscem na liczbę, np. „Zoptymalizuj {n} zdjęć”. */
  desc: string;
  category: AchCategory;
  icon: AchIcon;
  tiers: [number, number, number, number];
  value: (s: ProfileStats) => number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'fotograf', name: 'Fotograf', desc: 'Dodaj lub popraw {n} zdjęć', category: 'foto', icon: 'camera', tiers: [10, 50, 250, 1000], value: (s) => s.counts.images },
  { id: 'lekka-waga', name: 'Lekka waga', desc: 'Zoptymalizuj {n} zdjęć (JPG/PNG, mała waga)', category: 'foto', icon: 'feather', tiers: [10, 50, 300, 1000], value: (s) => s.counts.imgopt },
  { id: 'redaktor', name: 'Redaktor katalogu', desc: 'Edytuj lub dodaj {n} produktów', category: 'dane', icon: 'pencil', tiers: [25, 100, 500, 2000], value: (s) => s.counts.edits + s.counts.created },
  { id: 'nowy-asortyment', name: 'Nowy asortyment', desc: 'Dodaj {n} nowych produktów', category: 'dane', icon: 'rocket', tiers: [3, 15, 60, 200], value: (s) => s.counts.created },
  { id: 'zestawowicz', name: 'Zestawowicz', desc: 'Zapisz {n} zestawów', category: 'dane', icon: 'layers', tiers: [3, 10, 40, 100], value: (s) => s.counts.kits },
  { id: 'porzadkowicz', name: 'Porządkowicz grup', desc: 'Zatwierdź {n} opisów technicznych', category: 'techniczne', icon: 'wrench', tiers: [20, 100, 500, 2000], value: (s) => s.counts.tech },
  { id: 'magazynier', name: 'Magazynier', desc: 'Zaktualizuj {n} stanów magazynowych', category: 'magazyn', icon: 'boxes', tiers: [20, 100, 500, 2000], value: (s) => s.counts.stock },
  { id: 'cennik', name: 'Cennik pod kontrolą', desc: 'Zmień {n} cen', category: 'magazyn', icon: 'tag', tiers: [10, 50, 200, 800], value: (s) => s.counts.price },
  { id: 'integrator', name: 'Łącznik z BaseLinkerem', desc: 'Wykonaj {n} operacji BaseLinkera', category: 'integracje', icon: 'plug', tiers: [5, 25, 100, 400], value: (s) => s.counts.baselinker },
  { id: 'wytrwaly', name: 'Wytrwały', desc: 'Pracuj w katalogu {n} dni roboczych z rzędu', category: 'rytm', icon: 'flame', tiers: [3, 7, 20, 60], value: (s) => s.bestStreak },
  { id: 'bywalec', name: 'Stały bywalec', desc: 'Pracuj w katalogu w {n} różnych dniach', category: 'rytm', icon: 'calendar', tiers: [10, 50, 150, 300], value: (s) => s.activeDays },
  { id: 'maraton', name: 'Tygodniowy maraton', desc: 'Wykonaj {n} działań w jednym tygodniu', category: 'rytm', icon: 'sparkles', tiers: [30, 100, 300, 800], value: (s) => s.bestWeek },
  { id: 'ranny', name: 'Ranny ptaszek', desc: 'Wykonaj {n} działań przed 7:00', category: 'rytm', icon: 'sunrise', tiers: [10, 50, 200, 600], value: (s) => s.early },
  { id: 'nocny', name: 'Nocny marek', desc: 'Wykonaj {n} działań po 20:00', category: 'rytm', icon: 'moon', tiers: [10, 50, 200, 600], value: (s) => s.late },
  { id: 'solidny', name: 'Solidny wykonawca', desc: 'Wykonaj {n} zadań z kolejki', category: 'zadania', icon: 'check', tiers: [3, 10, 40, 120], value: (s) => s.counts.tasks },
];

export interface AchievementState {
  def: AchievementDef;
  value: number;
  tier: Tier;
  /** Próg następnego stopnia (null = maksimum). */
  next: number | null;
  /** Postęp 0–1 w obrębie bieżącego stopnia (do paska / pierścienia). */
  progress: number;
}

function tierOf(value: number, tiers: AchievementDef['tiers']): Tier {
  let t: Tier = 0;
  tiers.forEach((n, i) => {
    if (value >= n) t = (i + 1) as Tier;
  });
  return t;
}

export function evaluateAchievements(stats: ProfileStats): AchievementState[] {
  return ACHIEVEMENTS.map((def) => {
    const value = def.value(stats);
    const tier = tierOf(value, def.tiers);
    const next: number | null = tier >= 4 ? null : def.tiers[tier as 0 | 1 | 2 | 3];
    const prev = tier === 0 ? 0 : def.tiers[(tier - 1) as 0 | 1 | 2 | 3];
    const progress = next == null ? 1 : Math.max(0, Math.min(1, (value - prev) / (next - prev)));
    return { def, value, tier, next, progress };
  });
}

/** Kiedy po raz pierwszy osiągnięto dany stopień: id → [data brązu, srebra, złota, diamentu]. */
export function computeEarnedDates(rows: ActivityRow[]): Record<string, (string | null)[]> {
  const out: Record<string, (string | null)[]> = {};
  for (const a of ACHIEVEMENTS) out[a.id] = [null, null, null, null];
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (sorted.length === 0) return out;

  // koniec każdego dnia z aktywnością = punkt kontrolny
  const boundaries: { key: string; end: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const k = dayKey(new Date(sorted[i].created_at));
    const nextKey = i + 1 < sorted.length ? dayKey(new Date(sorted[i + 1].created_at)) : null;
    if (k !== nextKey) boundaries.push({ key: k, end: i + 1 });
  }
  const pending = new Set(ACHIEVEMENTS.map((a) => a.id));
  for (const b of boundaries) {
    if (pending.size === 0) break;
    const stats = computeStats(sorted.slice(0, b.end));
    for (const def of ACHIEVEMENTS) {
      if (!pending.has(def.id)) continue;
      const v = def.value(stats);
      const dates = out[def.id];
      def.tiers.forEach((n, i) => {
        if (dates[i] == null && v >= n) dates[i] = b.key;
      });
      if (dates[3] != null) pending.delete(def.id);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Cele zespołu (kompletność katalogu)
// ---------------------------------------------------------------------------------------------

export interface TeamGoal {
  id: string;
  name: string;
  desc: string;
  /** Ikona typu technicznego albo null (wtedy ikona „sparkles”/„check”). */
  techType: TechType | null;
  icon: AchIcon;
  done: number;
  total: number;
  pct: number;
  tier: Tier;
  /** Produkty, których jeszcze brakuje do 100%. */
  missing: Product[];
}

export const GOAL_TIERS = [50, 75, 90, 100] as const;

function goalTier(pct: number, done: number, total: number): Tier {
  if (total > 0 && done >= total) return 4;
  let t: Tier = 0;
  GOAL_TIERS.forEach((n, i) => {
    if (pct >= n) t = (i + 1) as Tier;
  });
  return t;
}

function makeGoal(
  id: string,
  name: string,
  desc: string,
  techType: TechType | null,
  icon: AchIcon,
  all: Product[],
  ok: (p: Product) => boolean,
): TeamGoal {
  const done = all.filter(ok).length;
  const total = all.length;
  const pct = total ? Math.floor((done / total) * 100) : 0;
  return {
    id,
    name,
    desc,
    techType,
    icon,
    done,
    total,
    pct,
    tier: goalTier(pct, done, total),
    missing: all.filter((p) => !ok(p)),
  };
}

export function computeTeamGoals(products: Product[], entries: TechEntry[]): TeamGoal[] {
  const real = products.filter((p) => !p.isGroup && p.sku);
  const goals: TeamGoal[] = [];
  goals.push(makeGoal('all-photos', 'Katalog ze zdjęciami', 'Każdy produkt ma zdjęcie', null, 'camera', real, (p) => p.hasImage));

  const approved = entries.filter((e) => e.state === 'approved').length;
  if (entries.length > 0) {
    const missing = entries.filter((e) => e.state !== 'approved').map((e) => e.product);
    const pct = Math.floor((approved / entries.length) * 100);
    goals.push({
      id: 'tech-approved',
      name: 'Opisy techniczne zatwierdzone',
      desc: 'Wszystkie elementy techniczne mają zatwierdzony opis',
      techType: null,
      icon: 'wrench',
      done: approved,
      total: entries.length,
      pct,
      tier: goalTier(pct, approved, entries.length),
      missing,
    });
  }

  for (const t of TECH_TYPES) {
    const ofType = entries.filter((e) => e.type === t.id);
    if (ofType.length < 8) continue;
    const products = ofType.map((e) => e.product);
    goals.push(
      makeGoal(
        'photos-' + t.id,
        t.labelPlural + ' ze zdjęciem',
        'Każdy element z grupy „' + t.labelPlural + '” ma zdjęcie',
        t.id,
        'camera',
        products,
        (p) => p.hasImage,
      ),
    );
  }
  return goals;
}
