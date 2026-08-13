import type { LayoutElement, LayoutElementType } from './warehouseLayoutStore';

function isRackType(type: LayoutElementType): boolean {
  return type === 'rack' || type === 'rack_pallet' || type === 'rack_shelf';
}
import type { WarehouseLocation } from './warehouseLocation';
import { formatLocationCode } from './warehouseLocation';

export interface RackSection {
  id: string;
  /** Nazwa widoczna na planie, np. „Półka 3” */
  label: string;
  /** Kod półki w adresie (P01, P04…) */
  shelfCode?: string;
  /** Kuwety / pojemniki w rzędzie */
  bins: number;
  note?: string;
}

export type RackSectionTemplateId =
  | 'pallet_2'
  | 'shelf_4'
  | 'shelf_5'
  | 'shelf_3'
  | 'dense_bins';

export const RACK_SECTION_TEMPLATES: {
  id: RackSectionTemplateId;
  label: string;
  description: string;
  build: () => RackSection[];
}[] = [
  {
    id: 'pallet_2',
    label: '2 palety',
    description: 'Dół + góra EUR',
    build: () => [
      sectionDraft('Paleta dół', 'PD', 1),
      sectionDraft('Paleta góra', 'PG', 1),
    ],
  },
  {
    id: 'shelf_4',
    label: '4 półki',
    description: 'Klasyczny półkowy',
    build: () => [1, 2, 3, 4].map((n) => sectionDraft(`Półka ${n}`, `P0${n}`, 4)),
  },
  {
    id: 'shelf_5',
    label: '5 półek',
    description: 'Wysoki regał',
    build: () => [1, 2, 3, 4, 5].map((n) => sectionDraft(`Półka ${n}`, `P0${n}`, 3)),
  },
  {
    id: 'shelf_3',
    label: '3 półki',
    description: 'Kompakt',
    build: () => [1, 2, 3].map((n) => sectionDraft(`Półka ${n}`, `P0${n}`, 6)),
  },
  {
    id: 'dense_bins',
    label: 'Drobnica',
    description: '6 poziomów × 8 kuwet',
    build: () => [1, 2, 3, 4, 5, 6].map((n) => sectionDraft(`Rząd ${n}`, `R${n}`, 8)),
  },
];

function sectionId() {
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

export function sectionDraft(label: string, shelfCode: string, bins: number): RackSection {
  return { id: sectionId(), label, shelfCode, bins: Math.max(1, bins) };
}

export function defaultSectionsForRackType(type: LayoutElementType): RackSection[] {
  if (type === 'rack_pallet') return RACK_SECTION_TEMPLATES.find((t) => t.id === 'pallet_2')!.build();
  if (type === 'rack_shelf') return RACK_SECTION_TEMPLATES.find((t) => t.id === 'shelf_4')!.build();
  return RACK_SECTION_TEMPLATES.find((t) => t.id === 'shelf_3')!.build();
}

export function ensureRackSections(el: LayoutElement): RackSection[] {
  if (!isRackType(el.type)) return [];
  if (el.sections?.length) return el.sections;
  return defaultSectionsForRackType(el.type);
}

export function formatRackSectionLocation(el: LayoutElement, section: RackSection): string {
  const loc: WarehouseLocation = {
    zone: el.zone,
    aisle: el.aisle,
    rack: el.rack,
    shelf: section.shelfCode || section.label.replace(/\s+/g, '').slice(0, 8),
  };
  return formatLocationCode(loc);
}

export function rackSectionToWarehouseLocation(
  el: LayoutElement,
  section: RackSection,
): WarehouseLocation {
  return {
    zone: el.zone,
    aisle: el.aisle,
    rack: el.rack,
    shelf: section.shelfCode || undefined,
  };
}

export function moveSection(sections: RackSection[], id: string, dir: -1 | 1): RackSection[] {
  const idx = sections.findIndex((s) => s.id === id);
  if (idx < 0) return sections;
  const next = idx + dir;
  if (next < 0 || next >= sections.length) return sections;
  const copy = [...sections];
  const [item] = copy.splice(idx, 1);
  copy.splice(next, 0, item);
  return copy;
}
