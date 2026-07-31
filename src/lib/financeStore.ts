import { financeKosztyData as financeKosztyDataRaw } from '../data/financeKosztyData';
import type {
  FinanceChannel,
  FinanceKosztyData,
  FinanceMonth,
  FinanceSource,
} from './financeTypes';

const financeKosztyData: FinanceKosztyData = financeKosztyDataRaw;
const STORAGE_KEY = 'katalog-finance-overlay-v1';

export type FinanceCostArea = 'Marketplace' | 'Dostawa' | 'Operacyjne';

export type FinanceSourceRow = FinanceSource & {
  id: string;
  area?: FinanceCostArea;
};

type FinanceOverlay = {
  months: Record<string, FinanceMonth>;
  sourcesByMonth: Record<string, FinanceSourceRow[]>;
  customSourceNames: string[];
};

function emptyOverlay(): FinanceOverlay {
  return { months: {}, sourcesByMonth: {}, customSourceNames: [] };
}

function loadOverlay(): FinanceOverlay {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as Partial<FinanceOverlay>;
    return {
      months: parsed.months ?? {},
      sourcesByMonth: parsed.sourcesByMonth ?? {},
      customSourceNames: parsed.customSourceNames ?? [],
    };
  } catch {
    return emptyOverlay();
  }
}

function saveOverlay(overlay: FinanceOverlay): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
}

export function finalizeMonth(input: {
  month: string;
  sprzedaz: number;
  kosztTowaru: number;
  marketplace: number;
  dostawa: number;
  operacyjne: number;
}): FinanceMonth {
  const sprzedaz = Math.max(0, input.sprzedaz);
  const kosztTowaru = Math.max(0, input.kosztTowaru);
  const marketplace = Math.max(0, input.marketplace);
  const dostawa = Math.max(0, input.dostawa);
  const operacyjne = Math.max(0, input.operacyjne);
  const marzaNetto = sprzedaz - kosztTowaru;
  const kosztyRazem = kosztTowaru + marketplace + dostawa + operacyjne;
  const wynikNetto = sprzedaz - kosztyRazem;
  return {
    month: input.month,
    sprzedaz,
    kosztTowaru,
    marzaNetto,
    marketplace,
    dostawa,
    operacyjne,
    kosztyRazem,
    marzaPct: sprzedaz > 0 ? marzaNetto / sprzedaz : 0,
    wynikDoSprzedazy: sprzedaz > 0 ? wynikNetto / sprzedaz : 0,
    kosztDoSprzedazy: sprzedaz > 0 ? kosztyRazem / sprzedaz : 0,
    wynikNetto,
  };
}

function seedSources(month: string): FinanceSourceRow[] {
  const seed = financeKosztyData.sourcesByMonth[month] ?? [];
  return seed.map((s, i) => ({
    id: `seed-${month}-${i}-${s.name}`,
    name: s.name,
    amount: s.amount,
  }));
}

export function getMergedFinanceData(): FinanceKosztyData {
  const overlay = loadOverlay();
  const monthMap = new Map<string, FinanceMonth>();
  for (const m of financeKosztyData.months) {
    monthMap.set(m.month, m);
  }
  for (const [k, v] of Object.entries(overlay.months)) {
    monthMap.set(k, v);
  }
  const months = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month),
  );

  const sourcesByMonth: Record<string, FinanceSource[]> = {
    ...financeKosztyData.sourcesByMonth,
  };
  for (const [k, rows] of Object.entries(overlay.sourcesByMonth)) {
    sourcesByMonth[k] = rows.map(({ name, amount }) => ({ name, amount }));
  }

  const defaultMonth =
    months.find((m) => m.month === financeKosztyData.meta.defaultMonth)?.month ??
    months[months.length - 1]?.month ??
    financeKosztyData.meta.defaultMonth;

  return {
    ...financeKosztyData,
    meta: { ...financeKosztyData.meta, defaultMonth },
    months,
    sourcesByMonth,
  };
}

export function getMonthSources(month: string): FinanceSourceRow[] {
  const overlay = loadOverlay();
  if (overlay.sourcesByMonth[month]) {
    return [...overlay.sourcesByMonth[month]].sort((a, b) => b.amount - a.amount);
  }
  return seedSources(month).sort((a, b) => b.amount - a.amount);
}

export function listKnownSourceNames(): string[] {
  const overlay = loadOverlay();
  const names = new Set<string>(overlay.customSourceNames);
  for (const list of Object.values(financeKosztyData.sourcesByMonth)) {
    for (const s of list) names.add(s.name);
  }
  for (const list of Object.values(overlay.sourcesByMonth)) {
    for (const s of list) names.add(s.name);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'pl'));
}

export function upsertFinanceMonth(input: {
  month: string;
  sprzedaz: number;
  kosztTowaru: number;
  marketplace: number;
  dostawa: number;
  operacyjne: number;
}): FinanceMonth {
  const overlay = loadOverlay();
  const month = finalizeMonth(input);
  overlay.months[month.month] = month;
  if (!overlay.sourcesByMonth[month.month]) {
    // start from seed (or empty) so later edits stick
    overlay.sourcesByMonth[month.month] = seedSources(month.month);
  }
  saveOverlay(overlay);
  return month;
}

export function addFinanceExpense(input: {
  month: string;
  name: string;
  amount: number;
  area: FinanceCostArea;
}): void {
  const name = input.name.trim();
  const amount = Math.max(0, input.amount);
  if (!name || amount <= 0) return;

  const overlay = loadOverlay();
  const rows = overlay.sourcesByMonth[input.month]
    ? [...overlay.sourcesByMonth[input.month]]
    : seedSources(input.month);

  const existing = rows.find(
    (r) => r.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    existing.amount = Math.round((existing.amount + amount) * 100) / 100;
    existing.area = input.area;
  } else {
    rows.push({
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      amount,
      area: input.area,
    });
  }
  overlay.sourcesByMonth[input.month] = rows;

  if (!overlay.customSourceNames.includes(name)) {
    overlay.customSourceNames.push(name);
  }

  // Podbij kategorię w miesiącu (seed lub overlay)
  const base =
    overlay.months[input.month] ??
    financeKosztyData.months.find((m) => m.month === input.month);
  if (base) {
    const next = {
      month: base.month,
      sprzedaz: base.sprzedaz,
      kosztTowaru: base.kosztTowaru,
      marketplace: base.marketplace,
      dostawa: base.dostawa,
      operacyjne: base.operacyjne,
    };
    if (input.area === 'Marketplace') next.marketplace += amount;
    if (input.area === 'Dostawa') next.dostawa += amount;
    if (input.area === 'Operacyjne') next.operacyjne += amount;
    overlay.months[input.month] = finalizeMonth(next);
  }

  saveOverlay(overlay);
}

export function removeFinanceExpense(month: string, id: string): void {
  const overlay = loadOverlay();
  const rows = overlay.sourcesByMonth[month]
    ? [...overlay.sourcesByMonth[month]]
    : seedSources(month);
  const removed = rows.find((r) => r.id === id);
  overlay.sourcesByMonth[month] = rows.filter((r) => r.id !== id);

  if (removed?.area && removed.amount) {
    const base =
      overlay.months[month] ??
      financeKosztyData.months.find((m) => m.month === month);
    if (base) {
      const next = {
        month: base.month,
        sprzedaz: base.sprzedaz,
        kosztTowaru: base.kosztTowaru,
        marketplace: base.marketplace,
        dostawa: base.dostawa,
        operacyjne: base.operacyjne,
      };
      if (removed.area === 'Marketplace')
        next.marketplace = Math.max(0, next.marketplace - removed.amount);
      if (removed.area === 'Dostawa')
        next.dostawa = Math.max(0, next.dostawa - removed.amount);
      if (removed.area === 'Operacyjne')
        next.operacyjne = Math.max(0, next.operacyjne - removed.amount);
      overlay.months[month] = finalizeMonth(next);
    }
  }

  saveOverlay(overlay);
}

export function getChannels(month: string): FinanceChannel[] {
  return financeKosztyData.channelsByMonth[month] ?? [];
}

export function suggestNextMonth(existing: string[]): string {
  if (!existing.length) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const last = [...existing].sort().at(-1)!;
  const [y, m] = last.split('-').map(Number);
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `${nextY}-${String(nextM).padStart(2, '0')}`;
}
