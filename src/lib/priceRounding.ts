/**
 * Wyrównywanie cen do „ładnych” końcówek (jak w BaseLinkerze): ,99 / ,00 / ,90 / ,50 —
 * w dół, w górę albo do najbliższej.
 */
export type PriceRoundMode = '99-down' | '99-up' | '99-near' | '00-down' | '00-up' | '00-near' | '90-near' | '50-near';

export interface PriceRoundOption {
  mode: PriceRoundMode;
  label: string;
  hint: string;
}

export const PRICE_ROUND_OPTIONS: PriceRoundOption[] = [
  { mode: '99-down', label: ',99 w dół', hint: '31,81 → 30,99' },
  { mode: '99-up', label: ',99 w górę', hint: '31,81 → 31,99' },
  { mode: '99-near', label: ',99 najbliższa', hint: '31,81 → 31,99' },
  { mode: '00-down', label: ',00 w dół', hint: '31,81 → 31,00' },
  { mode: '00-up', label: ',00 w górę', hint: '31,81 → 32,00' },
  { mode: '00-near', label: ',00 najbliższa', hint: '31,81 → 32,00' },
  { mode: '90-near', label: ',90 najbliższa', hint: '31,81 → 31,90' },
  { mode: '50-near', label: ',50 najbliższa', hint: '31,81 → 31,50' },
];

const ENDING: Record<PriceRoundMode, number> = {
  '99-down': 0.99,
  '99-up': 0.99,
  '99-near': 0.99,
  '00-down': 0,
  '00-up': 0,
  '00-near': 0,
  '90-near': 0.9,
  '50-near': 0.5,
};

const EPS = 1e-9;

/** Zaokrągla cenę do wybranej końcówki. Wynik zawsze dodatni (min. 0,01) z dokładnością do grosza. */
export function roundToEnding(value: number, mode: PriceRoundMode): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  const e = ENDING[mode];
  const down = Math.floor(value - e + EPS) + e; // największa wartość k + e ≤ value
  const up = Math.ceil(value - e - EPS) + e; // najmniejsza wartość k + e ≥ value
  let picked: number;
  if (mode.endsWith('-down')) picked = down;
  else if (mode.endsWith('-up')) picked = up;
  else picked = value - down < up - value ? down : up; // remis → w górę
  const out = Math.round(picked * 100) / 100;
  return out > 0 ? out : Math.round(up * 100) / 100 || 0.01;
}
