import { ACHIEVEMENTS, TIER_NAMES, type Tier } from './achievements';
import { CATEGORY_LABEL, dayKey, mondayKey, type ActivityRow, type CategoryId, type ProfileStats } from './profileStats';

/** Podsumowanie tygodnia pracy: bieżący tydzień (od poniedziałku) i porównanie z poprzednim. */

export interface WeeklySummary {
  weekStart: string;
  prevWeekStart: string;
  thisWeek: number;
  lastWeek: number;
  delta: number;
  activeDays: number;
  topCategory: { id: CategoryId; label: string; count: number } | null;
  tasksDone: number;
  newAchievements: { name: string; tier: Tier }[];
  streak: number;
  text: string;
}

const CATEGORY_BY_ACTION: Record<string, CategoryId> = {
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

function weightOf(r: ActivityRow): number {
  const n = Number(r.changes?.count?.to);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : 1;
}

export function computeWeeklySummary(
  stats: ProfileStats,
  rows: ActivityRow[],
  earnedDates: Record<string, (string | null)[]>,
  who: string,
): WeeklySummary {
  const now = new Date();
  const weekStart = mondayKey(now);
  const prev = new Date(now);
  prev.setDate(prev.getDate() - 7);
  const prevWeekStart = mondayKey(prev);

  const byCat = new Map<CategoryId, number>();
  const days = new Set<string>();
  let tasksDone = 0;
  for (const r of rows) {
    const d = new Date(r.created_at);
    if (mondayKey(d) !== weekStart) continue;
    const cat = CATEGORY_BY_ACTION[r.action];
    if (!cat) continue;
    const w = weightOf(r);
    byCat.set(cat, (byCat.get(cat) ?? 0) + w);
    days.add(dayKey(d));
    if (cat === 'tasks') tasksDone += w;
  }
  let top: WeeklySummary['topCategory'] = null;
  for (const [id, count] of byCat) {
    if (id === 'tasks') continue;
    if (!top || count > top.count) top = { id, label: CATEGORY_LABEL[id], count };
  }

  const newAchievements: { name: string; tier: Tier }[] = [];
  for (const def of ACHIEVEMENTS) {
    (earnedDates[def.id] ?? []).forEach((date, i) => {
      if (date && date >= weekStart) newAchievements.push({ name: def.name, tier: (i + 1) as Tier });
    });
  }

  const thisWeek = stats.perWeek.get(weekStart) ?? 0;
  const lastWeek = stats.perWeek.get(prevWeekStart) ?? 0;
  const delta = thisWeek - lastWeek;

  const lines = [
    `Podsumowanie tygodnia — ${who}`,
    `Ten tydzień: ${thisWeek} działań (${delta >= 0 ? '+' : ''}${delta} względem poprzedniego, który miał ${lastWeek}).`,
    `Dni aktywności: ${days.size}. Seria dni roboczych: ${stats.currentStreak}.`,
  ];
  if (top) lines.push(`Najwięcej pracy: ${top.label} (${top.count}).`);
  if (tasksDone) lines.push(`Wykonane zadania z kolejki: ${tasksDone}.`);
  if (newAchievements.length) {
    lines.push('Nowe odznaki: ' + newAchievements.map((a) => `${a.name} (${TIER_NAMES[a.tier]})`).join(', ') + '.');
  }

  return {
    weekStart,
    prevWeekStart,
    thisWeek,
    lastWeek,
    delta,
    activeDays: days.size,
    topCategory: top,
    tasksDone,
    newAchievements,
    streak: stats.currentStreak,
    text: lines.join('\n'),
  };
}
