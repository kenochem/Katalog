/** Konfiguracja etykiet produktowych (zapamiętywana w przeglądarce). */

export interface LabelSizePreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

export const LABEL_SIZE_PRESETS: LabelSizePreset[] = [
  { id: '100x50', label: '100 × 50 mm', w: 100, h: 50 },
  { id: '100x70', label: '100 × 70 mm', w: 100, h: 70 },
  { id: '70x40', label: '70 × 40 mm', w: 70, h: 40 },
  { id: '60x40', label: '60 × 40 mm', w: 60, h: 40 },
  { id: '50x30', label: '50 × 30 mm', w: 50, h: 30 },
  { id: 'custom', label: 'Własny rozmiar', w: 70, h: 40 },
];

export interface LabelFields {
  brand: boolean;
  name: boolean;
  sku: boolean;
  barcode: boolean;
  manufacturer: boolean;
  category: boolean;
  price: boolean;
  location: boolean;
  stock: boolean;
}

export const LABEL_FIELD_LABELS: Record<keyof LabelFields, string> = {
  brand: 'Logo KENOCHEM',
  name: 'Nazwa produktu',
  sku: 'SKU',
  barcode: 'Kod kreskowy (EAN / SKU)',
  manufacturer: 'Producent',
  category: 'Kategoria',
  price: 'Cena brutto',
  location: 'Lokalizacja (regał)',
  stock: 'Stan',
};

export type LabelPageMode = 'sheet' | 'roll';

export interface LabelConfig {
  sizeId: string;
  w: number;
  h: number;
  /** sheet = arkusz A4 (wiele etykiet na stronie), roll = jedna etykieta na stronie (drukarka etykiet). */
  mode: LabelPageMode;
  fields: LabelFields;
  /** Skala czcionek: 0.85 / 1 / 1.2 */
  fontScale: number;
  border: boolean;
}

export const DEFAULT_LABEL_CONFIG: LabelConfig = {
  sizeId: '70x40',
  w: 70,
  h: 40,
  mode: 'sheet',
  fields: {
    brand: true,
    name: true,
    sku: true,
    barcode: true,
    manufacturer: false,
    category: false,
    price: false,
    location: true,
    stock: false,
  },
  fontScale: 1,
  border: true,
};

const KEY = 'katalog-label-config-v1';

export function loadLabelConfig(): LabelConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LABEL_CONFIG;
    const p = JSON.parse(raw) as Partial<LabelConfig>;
    const w = Number(p.w);
    const h = Number(p.h);
    return {
      ...DEFAULT_LABEL_CONFIG,
      ...p,
      w: Number.isFinite(w) && w >= 20 && w <= 210 ? w : DEFAULT_LABEL_CONFIG.w,
      h: Number.isFinite(h) && h >= 15 && h <= 297 ? h : DEFAULT_LABEL_CONFIG.h,
      mode: p.mode === 'roll' ? 'roll' : 'sheet',
      fields: { ...DEFAULT_LABEL_CONFIG.fields, ...(p.fields ?? {}) },
      fontScale: [0.85, 1, 1.2].includes(Number(p.fontScale)) ? Number(p.fontScale) : 1,
      border: p.border !== false,
    };
  } catch {
    return DEFAULT_LABEL_CONFIG;
  }
}

export function saveLabelConfig(cfg: LabelConfig): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {
    /* brak localStorage */
  }
}
