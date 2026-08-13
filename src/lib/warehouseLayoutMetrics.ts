/** Metry rzeczywiste przypisane do jednej komórki siatki planu. */
export const LAYOUT_METER_LIMITS = {
  min: 0.25,
  max: 5,
  default: 1,
} as const;

export const LAYOUT_CELL_DISPLAY_PX_LIMITS = {
  min: 16,
  max: 56,
  default: 28,
} as const;

export const LAYOUT_METER_PRESETS: { label: string; value: number }[] = [
  { label: '25 cm', value: 0.25 },
  { label: '50 cm', value: 0.5 },
  { label: '1 m', value: 1 },
  { label: '1,5 m', value: 1.5 },
  { label: '2 m', value: 2 },
];

export function clampMetersPerCell(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return LAYOUT_METER_LIMITS.default;
  const clamped = Math.max(LAYOUT_METER_LIMITS.min, Math.min(LAYOUT_METER_LIMITS.max, n));
  return Math.round(clamped * 100) / 100;
}

export function clampCellDisplayPx(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return LAYOUT_CELL_DISPLAY_PX_LIMITS.default;
  return Math.round(
    Math.max(LAYOUT_CELL_DISPLAY_PX_LIMITS.min, Math.min(LAYOUT_CELL_DISPLAY_PX_LIMITS.max, n)),
  );
}

export function resolveMetersPerCell(metersPerCell?: number): number {
  return clampMetersPerCell(metersPerCell ?? LAYOUT_METER_LIMITS.default);
}

export function resolveCellDisplayPx(cellDisplayPx?: number, fallback = LAYOUT_CELL_DISPLAY_PX_LIMITS.default): number {
  return clampCellDisplayPx(cellDisplayPx ?? fallback);
}

export function cellsToMeters(cells: number, metersPerCell: number): number {
  return cells * metersPerCell;
}

/** Czytelny zapis metrażu po polsku (przecinek dziesiętny). */
export function formatMeters(meters: number): string {
  const m = Math.round(meters * 100) / 100;
  if (Math.abs(m - Math.round(m)) < 0.001) return `${Math.round(m)} m`;
  return `${String(m).replace('.', ',')} m`;
}

export function formatFootprintMeters(
  widthCells: number,
  heightCells: number,
  metersPerCell: number,
): string {
  return `${formatMeters(cellsToMeters(widthCells, metersPerCell))} × ${formatMeters(
    cellsToMeters(heightCells, metersPerCell),
  )}`;
}

export function formatElementFootprintMeters(
  w: number,
  h: number,
  metersPerCell: number,
): string {
  return formatFootprintMeters(w, h, metersPerCell);
}

/** Odstęp podpisu na linijce metrażowej (min. ~56 px między etykietami). */
export function rulerStepMeters(metersPerCell: number, cellPx: number): number {
  const pxPerMeter = metersPerCell > 0 ? cellPx / metersPerCell : cellPx;
  const candidates = [0.5, 1, 2, 5, 10, 20, 50];
  for (const step of candidates) {
    if (step * pxPerMeter >= 48) return step;
  }
  return 50;
}

export function rulerTicksAlongMeters(
  lengthMeters: number,
  stepMeters: number,
): number[] {
  const ticks: number[] = [0];
  if (stepMeters <= 0) return ticks;
  for (let m = stepMeters; m < lengthMeters - 0.001; m += stepMeters) {
    ticks.push(Math.round(m * 100) / 100);
  }
  if (lengthMeters > 0.001) ticks.push(Math.round(lengthMeters * 100) / 100);
  return [...new Set(ticks)];
}
