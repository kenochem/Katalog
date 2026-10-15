import { supabase } from './supabase';
import type { ProfilePreferences } from './userPreferences';

export type BoardPeriod = 'week' | 'month' | 'all';

export interface BoardRow {
  userId: string;
  name: string;
  role: string;
  xpPeriod: number;
  xpTotal: number;
  actionsPeriod: number;
  lastAt: string | null;
  profile: ProfilePreferences;
}

function periodStart(period: BoardPeriod): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // od poniedziałku
  else if (period === 'month') d.setDate(1);
  else return new Date(Date.now() - 800 * 86_400_000);
  return d;
}

export async function fetchLeaderboard(period: BoardPeriod): Promise<{ rows: BoardRow[]; missing: boolean }> {
  if (!supabase) return { rows: [], missing: false };
  const { data, error } = await supabase.rpc('catalog_leaderboard', { p_since: periodStart(period).toISOString() });
  if (error) {
    return { rows: [], missing: /catalog_leaderboard|function|schema cache|does not exist/i.test(error.message) };
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    userId: String(r.user_id),
    name: String(r.display_name ?? ''),
    role: String(r.role ?? ''),
    xpPeriod: Number(r.xp_period ?? 0),
    xpTotal: Number(r.xp_total ?? 0),
    actionsPeriod: Number(r.actions_period ?? 0),
    lastAt: r.last_at ? String(r.last_at) : null,
    profile: (r.profile && typeof r.profile === 'object' ? r.profile : {}) as ProfilePreferences,
  }));
  return { rows, missing: false };
}
