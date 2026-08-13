/** Adres magazynowy: strefa → alejka → regał → półka → pojemnik (z hub module-catalog). */

export interface WarehouseLocation {
  zone?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
}

const SEGMENT = /^[A-Za-z0-9]+$/;

export function formatLocationCode(loc?: WarehouseLocation | null): string {
  if (!loc) return '';
  return [loc.zone, loc.aisle, loc.rack, loc.shelf, loc.bin]
    .filter(Boolean)
    .join('-');
}

export function parseLocationCode(code: string): WarehouseLocation {
  const parts = code
    .trim()
    .split(/[-/.]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    zone: parts[0],
    aisle: parts[1],
    rack: parts[2],
    shelf: parts[3],
    bin: parts[4],
  };
}

export function isValidLocationSegment(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && t.length <= 8 && SEGMENT.test(t);
}

export const LOCATION_LEVEL_LABELS: {
  key: keyof WarehouseLocation;
  label: string;
  hint: string;
}[] = [
  { key: 'zone', label: 'Strefa', hint: 'np. DRO, NAR' },
  { key: 'aisle', label: 'Alejka', hint: 'np. A03' },
  { key: 'rack', label: 'Regał', hint: 'np. R2' },
  { key: 'shelf', label: 'Półka', hint: 'np. P04' },
  { key: 'bin', label: 'Pojemnik', hint: 'np. B12' },
];
