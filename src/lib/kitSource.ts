import type { Kit } from '../types';

/** Import z BaseLinker (skrypt / ID `bl-…`). */
export function isBaselinkerKit(kit: Kit): boolean {
  return kit.id.startsWith('bl-');
}

/** Zestaw istnieje w BaseLinkerze: zaimportowany stamtąd albo wysłany z katalogu (ma id produktu BL). */
export function isInBaselinker(kit: Kit): boolean {
  return isBaselinkerKit(kit) || kit.blId != null;
}

export function isOwnKit(kit: Kit): boolean {
  return !isBaselinkerKit(kit);
}

export const KIT_SEGMENT_LABELS = {
  baselinker: 'BaseLinker',
  own: 'Własne / techniczne',
} as const;

export type KitSegment = keyof typeof KIT_SEGMENT_LABELS;

export const OWN_KIT_DEFAULT_CATEGORY = 'Własne / techniczne';
