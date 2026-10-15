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

/** Limit punktów za jedną operację (zatwierdzenie 300 opisów jednym kliknięciem nie daje 300 pkt). */
export const XP_EVENT_CAP = 25;

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
  /** Punkty pracy (XP): każda czynność 1 pkt, akcje zbiorcze max 25 pkt za jedną operację. */
  xp: number;
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
  let xp = 0;
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
    xp += Math.min(w, XP_EVENT_CAP);
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
    xp,
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

export const MAX_LEVEL = 120;

export interface RankDef {
  id: string;
  name: string;
  from: number;
  to: number;
  color: string;
  tagline: string;
}

/** Rangi (etapy): każda obejmuje 20 poziomów; Legenda to poziomy 101–120. */
export const RANKS: RankDef[] = [
  { id: 'swiezak', name: 'Świeżak', from: 1, to: 20, color: '#94a3b8', tagline: 'Poznajesz katalog i pierwsze narzędzia' },
  { id: 'stazysta', name: 'Stażysta', from: 21, to: 40, color: '#4ade80', tagline: 'Pracujesz coraz pewniej i samodzielnie' },
  { id: 'specjalista', name: 'Specjalista', from: 41, to: 60, color: '#38bdf8', tagline: 'Znasz katalog i dbasz o jakość danych' },
  { id: 'ekspert', name: 'Ekspert', from: 61, to: 80, color: '#a78bfa', tagline: 'Prowadzisz innych i porządkujesz całe grupy' },
  { id: 'mistrz', name: 'Mistrz katalogu', from: 81, to: 100, color: '#fbbf24', tagline: 'Twoja praca widoczna jest w całym sklepie' },
  { id: 'legenda', name: 'Legenda Kenochem', from: 101, to: 120, color: '#f472b6', tagline: 'Absolutny szczyt — nielicznym się udaje' },
];

export function rankForLevel(level: number): RankDef {
  return RANKS.find((r) => level >= r.from && level <= r.to) ?? RANKS[RANKS.length - 1];
}

/** Łączna liczba punktów potrzebna do osiągnięcia poziomu L (poziom 1 = 0 pkt). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(25 * (level - 1) ** 1.75);
}

export interface LevelInfo {
  level: number;
  rank: RankDef;
  /** Pozycja w obrębie rangi (1–20). */
  levelInRank: number;
  title: string;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  maxed: boolean;
}

/**
 * Poziomy 1–120 w sześciu rangach. Krzywa jest celowo łagodna na początku i coraz stroma:
 * poziom 20 to ok. 4,3 tys. punktów, 40 → ok. 15 tys., 60 → 32 tys., 80 → 52 tys., 100 → 77 tys.
 */
export function levelFromXp(xp: number): LevelInfo {
  let level = Math.min(MAX_LEVEL, Math.floor((Math.max(0, xp) / 25) ** (1 / 1.75)) + 1);
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  while (level > 1 && xp < xpForLevel(level)) level--;
  const base = xpForLevel(level);
  const next = level >= MAX_LEVEL ? base : xpForLevel(level + 1);
  const rank = rankForLevel(level);
  return {
    level,
    rank,
    levelInRank: level - rank.from + 1,
    title: rank.name,
    xp,
    xpIntoLevel: xp - base,
    xpForNext: Math.max(1, next - base),
    maxed: level >= MAX_LEVEL,
  };
}
