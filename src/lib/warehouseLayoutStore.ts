import type { WarehouseLocation } from './warehouseLocation';
import type { RackSection } from './rackSections';
import {
  defaultSectionsForRackType,
  ensureRackSections,
  formatRackSectionLocation,
  rackSectionToWarehouseLocation,
} from './rackSections';
import {
  clampCellDisplayPx,
  clampMetersPerCell,
  resolveMetersPerCell as resolveDefaultMetersPerCell,
} from './warehouseLayoutMetrics';

export type LayoutElementType =
  | 'rack'
  | 'rack_pallet'
  | 'rack_shelf'
  | 'packing'
  | 'receiving'
  | 'shipping'
  | 'aisle'
  | 'wall'
  | 'office'
  | 'social'
  | 'bathroom'
  | 'locker'
  | 'stairs'
  | 'door'
  | 'zone'
  /** @deprecated Stare plany — wyświetlane jako strefa */
  | 'cold';

export interface LayoutElementDef {
  type: LayoutElementType;
  label: string;
  emoji: string;
  defaultW: number;
  defaultH: number;
  color: string;
  description: string;
  /** Paleta „Dodaj” — grupa regałów osobno */
  paletteGroup?: 'racks' | 'facility' | 'logistics' | 'structure';
}

export const LAYOUT_GRID_LIMITS = {
  cols: { min: 12, max: 96, default: 36 },
  rows: { min: 8, max: 64, default: 24 },
} as const;

export const LAYOUT_GRID_PRESETS: { label: string; cols: number; rows: number }[] = [
  { label: 'Kompakt (24×16)', cols: 24, rows: 16 },
  { label: 'Standard (36×24)', cols: 36, rows: 24 },
  { label: 'Szeroki (48×28)', cols: 48, rows: 28 },
  { label: 'Duża hala (60×36)', cols: 60, rows: 36 },
];

export const LAYOUT_ELEMENT_DEFS: LayoutElementDef[] = [
  {
    type: 'rack_pallet',
    label: 'Regał 2-palet.',
    emoji: '🏗️',
    defaultW: 5,
    defaultH: 3,
    color: '#047857',
    description: 'Regał paletowy na 2 palety (EUR)',
    paletteGroup: 'racks',
  },
  {
    type: 'rack_shelf',
    label: 'Regał 4-półk.',
    emoji: '🗄️',
    defaultW: 2,
    defaultH: 4,
    color: '#059669',
    description: 'Niski regał półkowy — ok. 4 poziomy',
    paletteGroup: 'racks',
  },
  {
    type: 'rack',
    label: 'Regał std.',
    emoji: '📦',
    defaultW: 3,
    defaultH: 2,
    color: '#10b981',
    description: 'Regał półkowy uniwersalny — rozmiar edytujesz ręcznie',
    paletteGroup: 'racks',
  },
  {
    type: 'packing',
    label: 'Pakowanie',
    emoji: '📋',
    defaultW: 4,
    defaultH: 2,
    color: '#2563eb',
    description: 'Stanowisko kompletacji i pakowania',
    paletteGroup: 'logistics',
  },
  {
    type: 'receiving',
    label: 'Przyjęcie',
    emoji: '📥',
    defaultW: 5,
    defaultH: 3,
    color: '#d97706',
    description: 'Rampa / strefa przyjęcia towaru',
    paletteGroup: 'logistics',
  },
  {
    type: 'shipping',
    label: 'Wysyłka',
    emoji: '🚚',
    defaultW: 5,
    defaultH: 2,
    color: '#7c3aed',
    description: 'Strefa wydań i kurierów',
    paletteGroup: 'logistics',
  },
  {
    type: 'zone',
    label: 'Strefa',
    emoji: '⬜',
    defaultW: 6,
    defaultH: 4,
    color: '#334155',
    description: 'Ogólna strefa magazynowa (np. picking)',
    paletteGroup: 'logistics',
  },
  {
    type: 'aisle',
    label: 'Alejka',
    emoji: '↔️',
    defaultW: 1,
    defaultH: 6,
    color: '#64748b',
    description: 'Przejście / alejka',
    paletteGroup: 'structure',
  },
  {
    type: 'wall',
    label: 'Ściana',
    emoji: '🧱',
    defaultW: 8,
    defaultH: 1,
    color: '#475569',
    description: 'Ściana lub bariera',
    paletteGroup: 'structure',
  },
  {
    type: 'door',
    label: 'Drzwi / brama',
    emoji: '🚪',
    defaultW: 2,
    defaultH: 1,
    color: '#78716c',
    description: 'Wejście, brama, passage',
    paletteGroup: 'structure',
  },
  {
    type: 'stairs',
    label: 'Schody',
    emoji: '🪜',
    defaultW: 2,
    defaultH: 3,
    color: '#57534e',
    description: 'Schody / pomost',
    paletteGroup: 'structure',
  },
  {
    type: 'office',
    label: 'Biuro',
    emoji: '🏢',
    defaultW: 3,
    defaultH: 2,
    color: '#a855f7',
    description: 'Biuro / administracja magazynu',
    paletteGroup: 'facility',
  },
  {
    type: 'social',
    label: 'Socjal',
    emoji: '☕',
    defaultW: 3,
    defaultH: 2,
    color: '#c026d3',
    description: 'Socjal, kuchnia, jadalnia',
    paletteGroup: 'facility',
  },
  {
    type: 'bathroom',
    label: 'Łazienka',
    emoji: '🚻',
    defaultW: 2,
    defaultH: 2,
    color: '#0ea5e9',
    description: 'Toaleta / łazienka',
    paletteGroup: 'facility',
  },
  {
    type: 'locker',
    label: 'Szatnia',
    emoji: '🧥',
    defaultW: 2,
    defaultH: 2,
    color: '#6366f1',
    description: 'Szafki / szatnia pracownicza',
    paletteGroup: 'facility',
  },
];

const LEGACY_COLD_DEF: LayoutElementDef = {
  type: 'zone',
  label: 'Strefa (dawn. chłodnia)',
  emoji: '⬜',
  defaultW: 4,
  defaultH: 3,
  color: '#334155',
  description: 'Legacy',
};

export interface LayoutElement {
  id: string;
  type: LayoutElementType;
  label: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  sections?: RackSection[];
}

export interface WarehouseLayoutMap {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Metry rzeczywiste na jedną komórkę siatki (domyślnie 1 m). */
  metersPerCell?: number;
  /** Bazowy rozmiar komórki na ekranie w px (zoom mnoży ten). */
  cellDisplayPx?: number;
  elements: LayoutElement[];
  updatedAt: string;
}

export const LAYOUT_CELL_PX = 28;
export const LAYOUT_DEFAULT_COLS = LAYOUT_GRID_LIMITS.cols.default;
export const LAYOUT_DEFAULT_ROWS = LAYOUT_GRID_LIMITS.rows.default;

export { resolveCellDisplayPx, resolveMetersPerCell } from './warehouseLayoutMetrics';

export const WAREHOUSE_LAYOUT_SCOPE = 'kenochem';

const KEY_PREFIX = 'katalog-wh-layout:';
const SEED_PREFIX = 'katalog-wh-layout-seed:';

function layoutKey(scopeId: string) {
  return `${KEY_PREFIX}${scopeId}`;
}

export function isRackElementType(type: LayoutElementType): boolean {
  return type === 'rack' || type === 'rack_pallet' || type === 'rack_shelf';
}

export function elementDef(type: LayoutElementType): LayoutElementDef {
  if (type === 'cold') return LEGACY_COLD_DEF;
  return LAYOUT_ELEMENT_DEFS.find((d) => d.type === type) ?? LAYOUT_ELEMENT_DEFS[0];
}

/** Klasa CSS (legacy `cold` → zone). */
export function layoutCellCssType(type: LayoutElementType): string {
  if (type === 'cold') return 'zone';
  return type.replace(/_/g, '-');
}

export function clampLayoutElement(el: LayoutElement, cols: number, rows: number): LayoutElement {
  const w = Math.min(el.w, cols);
  const h = Math.min(el.h, rows);
  return {
    ...el,
    w,
    h,
    x: Math.max(0, Math.min(cols - w, el.x)),
    y: Math.max(0, Math.min(rows - h, el.y)),
  };
}

export function resizeLayoutGrid(
  layout: WarehouseLayoutMap,
  cols: number,
  rows: number,
): WarehouseLayoutMap {
  const c = Math.max(LAYOUT_GRID_LIMITS.cols.min, Math.min(LAYOUT_GRID_LIMITS.cols.max, cols));
  const r = Math.max(LAYOUT_GRID_LIMITS.rows.min, Math.min(LAYOUT_GRID_LIMITS.rows.max, rows));
  return {
    ...layout,
    cols: c,
    rows: r,
    elements: layout.elements.map((el) => clampLayoutElement(el, c, r)),
  };
}

function applyLayoutScaleDefaults(layout: WarehouseLayoutMap): WarehouseLayoutMap {
  return {
    ...layout,
    metersPerCell: clampMetersPerCell(layout.metersPerCell ?? resolveDefaultMetersPerCell()),
    cellDisplayPx: clampCellDisplayPx(layout.cellDisplayPx ?? LAYOUT_CELL_PX),
  };
}

export function loadWarehouseLayout(scopeId: string = WAREHOUSE_LAYOUT_SCOPE): WarehouseLayoutMap {
  try {
    const raw = localStorage.getItem(layoutKey(scopeId));
    if (raw) {
      const parsed = JSON.parse(raw) as WarehouseLayoutMap;
      return applyLayoutScaleDefaults(
        resizeLayoutGrid(parsed, parsed.cols ?? LAYOUT_DEFAULT_COLS, parsed.rows ?? LAYOUT_DEFAULT_ROWS),
      );
    }
  } catch {
    /* ignore */
  }
  return applyLayoutScaleDefaults({
    id: `map-${scopeId}`,
    name: 'Hala główna',
    cols: LAYOUT_DEFAULT_COLS,
    rows: LAYOUT_DEFAULT_ROWS,
    metersPerCell: 1,
    cellDisplayPx: LAYOUT_CELL_PX,
    elements: [],
    updatedAt: new Date().toISOString(),
  });
}

export function saveWarehouseLayout(scopeId: string, layout: WarehouseLayoutMap) {
  const next = applyLayoutScaleDefaults({ ...layout, updatedAt: new Date().toISOString() });
  localStorage.setItem(layoutKey(scopeId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('katalog-wh-layout-changed', { detail: { scopeId } }));
  return next;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createLayoutElement(
  type: LayoutElementType,
  x: number,
  y: number,
  overrides?: Partial<LayoutElement>,
): LayoutElement {
  const def = elementDef(type);
  const rackDefaults =
    isRackElementType(type) ?
      { zone: 'DRO' as const, aisle: 'A', rack: 'R1' }
    : {};
  return {
    id: uid('el'),
    type,
    label: def.label,
    ...rackDefaults,
    x,
    y,
    w: def.defaultW,
    h: def.defaultH,
    color: def.color,
    ...(isRackElementType(type) && !overrides?.sections ?
      { sections: defaultSectionsForRackType(type) }
    : {}),
    ...overrides,
  };
}

export function seedKenochemWarehouseLayout(scopeId: string = WAREHOUSE_LAYOUT_SCOPE): WarehouseLayoutMap {
  const seedKey = `${SEED_PREFIX}${scopeId}`;
  const existing = loadWarehouseLayout(scopeId);
  if (localStorage.getItem(seedKey) && existing.elements.length > 0) return existing;

  const cols = 40;
  const rows = 26;

  const elements: LayoutElement[] = [
    { ...createLayoutElement('receiving', 1, 1), label: 'Przyjęcie PZ', zone: 'PZ', w: 6, h: 3 },
    { ...createLayoutElement('office', 1, 5), label: 'Biuro magazynu', w: 3, h: 2 },
    { ...createLayoutElement('social', 1, 8), label: 'Socjal', w: 3, h: 2 },
    { ...createLayoutElement('bathroom', 4, 8), label: 'Łazienka', w: 2, h: 2 },
    { ...createLayoutElement('locker', 1, 11), label: 'Szatnia', w: 2, h: 2 },
    { ...createLayoutElement('wall', 0, 0), label: 'Ściana N', w: cols, h: 1, zone: undefined },
    { ...createLayoutElement('wall', 0, rows - 1), label: 'Ściana S', w: cols, h: 1 },
    { ...createLayoutElement('door', 0, 12), label: 'Wejście', w: 2, h: 1 },
    { ...createLayoutElement('aisle', 7, 2), label: 'Alejka 1', w: 1, h: 18 },
    { ...createLayoutElement('aisle', 13, 2), label: 'Alejka 2', w: 1, h: 18 },
    { ...createLayoutElement('aisle', 19, 2), label: 'Alejka 3', w: 1, h: 18 },
    {
      ...createLayoutElement('rack_pallet', 8, 2),
      label: 'Palety A1',
      zone: 'DRO',
      aisle: 'A',
      rack: 'P1',
    },
    {
      ...createLayoutElement('rack_pallet', 8, 6),
      label: 'Palety A2',
      zone: 'DRO',
      aisle: 'A',
      rack: 'P2',
    },
    {
      ...createLayoutElement('rack_shelf', 14, 2),
      label: 'Półki B1',
      zone: 'NAR',
      aisle: 'B',
      rack: 'R1',
    },
    {
      ...createLayoutElement('rack_shelf', 14, 7),
      label: 'Półki B2',
      zone: 'NAR',
      aisle: 'B',
      rack: 'R2',
    },
    {
      ...createLayoutElement('rack_shelf', 20, 2),
      label: 'Półki C1',
      zone: 'CHE',
      aisle: 'C',
      rack: 'R1',
    },
    { ...createLayoutElement('packing', 26, 14), label: 'Pakowanie 1', zone: 'PAK', w: 4, h: 2 },
    { ...createLayoutElement('packing', 26, 17), label: 'Pakowanie 2', zone: 'PAK', w: 4, h: 2 },
    { ...createLayoutElement('shipping', 31, 14), label: 'Wysyłka', zone: 'WYS', w: 6, h: 3 },
    { ...createLayoutElement('zone', 22, 14), label: 'Picking', zone: 'PICK', w: 3, h: 8 },
  ];

  const layout: WarehouseLayoutMap = {
    id: `map-${scopeId}`,
    name: 'Hala główna — Kenochem',
    cols,
    rows,
    metersPerCell: 1,
    cellDisplayPx: LAYOUT_CELL_PX,
    elements,
    updatedAt: new Date().toISOString(),
  };

  saveWarehouseLayout(scopeId, layout);
  localStorage.setItem(seedKey, '1');
  return layout;
}

export function formatElementLocation(el: LayoutElement): string {
  const parts = [el.zone, el.aisle, el.rack].filter(Boolean);
  return parts.join('-') || el.label;
}

export function layoutElementToWarehouseLocation(el: LayoutElement): WarehouseLocation {
  return {
    zone: el.zone,
    aisle: el.aisle,
    rack: el.rack,
  };
}

const PRESET_LOCATION_TYPES: LayoutElementType[] = [
  'rack',
  'rack_pallet',
  'rack_shelf',
  'zone',
  'packing',
  'receiving',
  'shipping',
];

export function listLocationPresetsFromLayout(
  scopeId: string = WAREHOUSE_LAYOUT_SCOPE,
): { id: string; label: string; code: string; location: WarehouseLocation }[] {
  const layout = loadWarehouseLayout(scopeId);
  const out: { id: string; label: string; code: string; location: WarehouseLocation }[] = [];

  for (const el of layout.elements) {
    if (
      !(PRESET_LOCATION_TYPES.includes(el.type) || el.type === 'cold') ||
      !(el.zone || el.aisle || el.rack)
    ) {
      continue;
    }
    if (isRackElementType(el.type) && el.sections?.length) {
      for (const sec of el.sections) {
        out.push({
          id: `${el.id}::${sec.id}`,
          label: `${el.label} · ${sec.label}`,
          code: formatRackSectionLocation(el, sec),
          location: rackSectionToWarehouseLocation(el, sec),
        });
      }
    } else {
      out.push({
        id: el.id,
        label: el.label,
        code: formatElementLocation(el),
        location: layoutElementToWarehouseLocation(el),
      });
    }
  }
  return out;
}

function normLocSegment(v?: string): string {
  return v?.trim().toUpperCase() ?? '';
}

/** Dopasowanie elementu planu do edytowanego adresu SKU (regał / sekcja). */
export function resolveLocationLayoutHighlight(
  location: WarehouseLocation,
  layout: WarehouseLayoutMap,
): { elementId: string; sectionId?: string } | null {
  const z = normLocSegment(location.zone);
  const a = normLocSegment(location.aisle);
  const r = normLocSegment(location.rack);
  const sh = normLocSegment(location.shelf);
  if (!z && !a && !r) return null;

  for (const el of layout.elements) {
    const ez = normLocSegment(el.zone);
    const ea = normLocSegment(el.aisle);
    const er = normLocSegment(el.rack);

    if (z && ez !== z) continue;
    if (a && ea !== a) continue;
    if (r && er !== r) continue;

    if (sh && isRackElementType(el.type)) {
      for (const sec of ensureRackSections(el)) {
        const code = normLocSegment(sec.shelfCode);
        if (code === sh || normLocSegment(sec.label) === sh) {
          return { elementId: el.id, sectionId: sec.id };
        }
      }
    }

    return { elementId: el.id };
  }
  return null;
}

export function applyRackTemplate(
  el: LayoutElement,
  template: 'rack_pallet' | 'rack_shelf' | 'rack',
): Partial<LayoutElement> {
  const def = elementDef(template);
  return {
    type: template,
    w: def.defaultW,
    h: def.defaultH,
    color: def.color,
    label: el.label === elementDef(el.type).label ? def.label : el.label,
    sections: defaultSectionsForRackType(template),
  };
}

export type WarehouseCanvasTheme = 'auto' | 'light' | 'dark';

const CANVAS_THEME_KEY = 'katalog-wh-layout-canvas-theme';

export function loadWarehouseCanvasTheme(): WarehouseCanvasTheme {
  try {
    const v = localStorage.getItem(CANVAS_THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'auto') return v;
  } catch {
    /* ignore */
  }
  return 'auto';
}

export function saveWarehouseCanvasTheme(theme: WarehouseCanvasTheme): void {
  try {
    localStorage.setItem(CANVAS_THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}
