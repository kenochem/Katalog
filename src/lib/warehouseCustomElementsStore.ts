/** Własne elementy planu (magazyn / sklep) — użytkownik sam dodaje typ z nazwą,
 * emoji, kolorem i domyślnym rozmiarem. Wspólna lista dla wszystkich planów
 * (magazyn, sklep, kolejne w przyszłości) — raz stworzony mebel/strefa jest
 * dostępny wszędzie w palecie "Własne". */

const STORAGE_KEY = 'katalog-wh-custom-elements-v1';
export const WAREHOUSE_CUSTOM_ELEMENTS_CHANGED = 'katalog-wh-custom-elements-changed';

export interface CustomElementDef {
  id: string;
  label: string;
  emoji: string;
  color: string;
  defaultW: number;
  defaultH: number;
  createdAt: string;
}

function uid(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function loadCustomElementDefs(): CustomElementDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is CustomElementDef =>
        d && typeof d.id === 'string' && typeof d.label === 'string',
    );
  } catch {
    return [];
  }
}

function saveCustomElementDefs(defs: CustomElementDef[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defs));
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WAREHOUSE_CUSTOM_ELEMENTS_CHANGED));
  }
}

export function addCustomElementDef(input: {
  label: string;
  emoji: string;
  color: string;
  defaultW: number;
  defaultH: number;
}): CustomElementDef {
  const defs = loadCustomElementDefs();
  const next: CustomElementDef = {
    id: uid(),
    label: input.label.trim() || 'Własny element',
    emoji: input.emoji.trim() || '🔲',
    color: input.color || '#64748b',
    defaultW: Math.max(1, Math.round(input.defaultW) || 2),
    defaultH: Math.max(1, Math.round(input.defaultH) || 2),
    createdAt: new Date().toISOString(),
  };
  saveCustomElementDefs([...defs, next]);
  return next;
}

export function updateCustomElementDef(id: string, patch: Partial<CustomElementDef>): void {
  const defs = loadCustomElementDefs();
  saveCustomElementDefs(defs.map((d) => (d.id === id ? { ...d, ...patch, id: d.id } : d)));
}

export function deleteCustomElementDef(id: string): void {
  const defs = loadCustomElementDefs();
  saveCustomElementDefs(defs.filter((d) => d.id !== id));
}

export function getCustomElementDef(id: string): CustomElementDef | null {
  return loadCustomElementDefs().find((d) => d.id === id) ?? null;
}
