import { supabase } from './supabase';

/**
 * Statystyki pracy użytkownika w katalogu liczone z własnych wpisów dziennika aktywności
 * (audit_log, odczyt własnych wpisów — migration-audit-log-self-read.sql) + odznaki i poziomy.
 */

export interface ActivityRow {
  created_at: string;
  action: string;
  changes: { count?: { to?: unknown } } | null;
}

export type CategoryId =
  | 'edits'
  | 'stock'
  | 'price'
  | 'images'
  | 'created'
  | 'kits'
  | 'baselinker'
  | 'tech'
  | 'imgopt'
  | 'tasks';

export const CATEGORY_LABEL: Record<CategoryId, string> = {
  edits: 'Edycje produktów',
  stock: 'Stany magazynowe',
  price: 'Zmiany cen',
  images: 'Zdjęcia',
  created: 'Nowe produkty',
  kits: 'Zestawy',
  baselinker: 'BaseLinker',
  tech: 'Opisy techniczne',
  imgopt: 'Optymalizacja zdjęć',
  tasks: 'Wykonane zadania',
};

const ACTION_CATEGORY: Record<string, CategoryId> = {
  'product.update': 'edits',
  'product.category': 'edits',
  'product.stock': 'stock',
  'product.price': 'price',
  'product.image': 'images',
  'baselinker.images': 'images',
  'product.create': 'created',
  'kit.save': 'kits',
  'baselinker.push': 'baselinker',
  'baselinker.import': 'baselinker',
  'tech.approve': 'tech',
  'image.optimize': 'imgopt',
  'task.done': 'tasks',
};

export async function fetchMyActivity(userId: string, days = 400): Promise<ActivityRow[]> {
  if (!supabase) return [];
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const out: ActivityRow[] = [];
  for (let from = 0; from < 30_000; from += 1000) {
    const { data, error } = await supabase
      .from('audit_log')
      .select('created_at,action,changes')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as ActivityRow[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function weight(row: ActivityRow): number {
  const n = Number(row.changes?.count?.to);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 1;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Klucz tygodnia: data poniedziałku (czas lokalny). */
export function mondayKey(d: Date): string {
  const m = new Date(d);
  m.setHours(12, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return dayKey(m);
}

export interface ProfileStats {
  counts: Record<CategoryId, number>;
  total: number;
  logins: number;
  last30: number;
  last7: number;
  perDay: Map<string, number>;
  /** Praca w tygodniach (klucz = poniedziałek yyyy-mm-dd). */
  perWeek: Map<string, number>;
  bestWeek: number;
  activeDays: number;
  currentStreak: number;
  bestStreak: number;
  early: number;
  late: number;
  firstAt: string | null;
}

const EMPTY_COUNTS = (): Record<CategoryId, number> => ({
  edits: 0,
  stock: 0,
  price: 0,
  images: 0,
  created: 0,
  kits: 0,
  baselinker: 0,
  tech: 0,
  imgopt: 0,
  tasks: 0,
});

export function computeStats(rows: ActivityRow[]): ProfileStats {
  const counts = EMPTY_COUNTS();
  const perDay = new Map<string, number>();
  const perWeek = new Map<string, number>();
  let logins = 0;
  let early = 0;
  let late = 0;
  let first: string | null = null;
  const now = Date.now();
  let last30 = 0;
  let last7 = 0;

  for (const r of rows) {
    if (!first || r.created_at < first) first = r.created_at;
    if (r.action === 'auth.login') {
      logins++;
      continue;
    }
    const cat = ACTION_CATEGORY[r.action];
    if (!cat) continue;
    const w = weight(r);
    counts[cat] += w;
    const d = new Date(r.created_at);
    const k = dayKey(d);
    perDay.set(k, (perDay.get(k) ?? 0) + w);
    const wk = mondayKey(d);
    perWeek.set(wk, (perWeek.get(wk) ?? 0) + w);
    const age = (now - d.getTime()) / 86_400_000;
    if (age <= 30) last30 += w;
    if (age <= 7) last7 += w;
    const h = d.getHours();
    if (h < 7) early += w;
    if (h >= 20) late += w;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // serie: kolejne dni robocze z aktywnością (weekend nie przerywa serii)
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const days = [...perDay.keys()].sort().filter((k) => !isWeekend(new Date(k + 'T12:00:00')));
  const prevWorkday = (d: Date) => {
    const p = new Date(d);
    do {
      p.setDate(p.getDate() - 1);
    } while (isWeekend(p));
    return p;
  };
  let best = 0;
  let run = 0;
  let prevKey: string | null = null;
  for (const k of days) {
    const d = new Date(k + 'T12:00:00');
    if (prevKey && dayKey(prevWorkday(d)) === prevKey) run++;
    else run = 1;
    best = Math.max(best, run);
    prevKey = k;
  }
  let current = 0;
  let cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  if (isWeekend(cursor)) cursor = prevWorkday(new Date(cursor.getTime() + 86_400_000));
  if (!perDay.has(dayKey(cursor))) cursor = prevWorkday(cursor); // dziś jeszcze nic — liczymy od poprzedniego dnia roboczego
  while (perDay.has(dayKey(cursor))) {
    current++;
    cursor = prevWorkday(cursor);
  }

  return {
    counts,
    total,
    logins,
    last30,
    last7,
    perDay,
    perWeek,
    bestWeek: Math.max(0, ...perWeek.values()),
    activeDays: perDay.size,
    currentStreak: current,
    bestStreak: best,
    early,
    late,
    firstAt: first,
  };
}

// ---------------------------------------------------------------------------------------------
// Poziomy i odznaki
// ---------------------------------------------------------------------------------------------

const TITLES: [number, string][] = [
  [1, 'Nowicjusz'],
  [3, 'Praktykant'],
  [5, 'Katalogowiec'],
  [8, 'Specjalista'],
  [12, 'Ekspert'],
  [18, 'Mistrz katalogu'],
  [25, 'Legenda Kenochem'],
];

export interface LevelInfo {
  level: number;
  title: string;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
}

/** Poziom rośnie coraz wolniej: poziom N wymaga 5·(N−1)² punktów (1 punkt = 1 wykonana praca). */
export function levelFromXp(xp: number): LevelInfo {
  const level = Math.floor(Math.sqrt(xp / 5)) + 1;
  const base = 5 * (level - 1) ** 2;
  const next = 5 * level ** 2;
  const title = [...TITLES].reverse().find(([min]) => level >= min)?.[1] ?? 'Nowicjusz';
  return { level, title, xp, xpIntoLevel: xp - base, xpForNext: next - base };
}
