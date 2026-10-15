import type { AchievementState } from './achievements';

/**
 * Kosmetyka profilu odblokowywana poziomami i osiągnięciami: ramki avatara, tła nagłówka
 * (część animowana) i nakładki (efekty cząsteczkowe).
 */

export type CosmeticKind = 'frame' | 'bg' | 'overlay';

export type Requirement =
  | { type: 'level'; level: number }
  | { type: 'ach'; id: string; tier: 1 | 2 | 3 | 4; label: string };

export interface Cosmetic {
  id: string;
  kind: CosmeticKind;
  name: string;
  desc: string;
  req: Requirement;
  animated?: boolean;
}

export const FRAMES: Cosmetic[] = [
  { id: 'classic', kind: 'frame', name: 'Klasyczna', desc: 'Pierścień w kolorze akcentu', req: { type: 'level', level: 1 } },
  { id: 'double', kind: 'frame', name: 'Podwójny pierścień', desc: 'Dwie obwódki w kolorze akcentu', req: { type: 'level', level: 8 } },
  { id: 'dash', kind: 'frame', name: 'Kreskowana', desc: 'Przerywana obwódka', req: { type: 'level', level: 16 } },
  { id: 'bronze', kind: 'frame', name: 'Brąz', desc: 'Metaliczny brąz', req: { type: 'level', level: 25 } },
  { id: 'silver', kind: 'frame', name: 'Srebro', desc: 'Polerowane srebro', req: { type: 'level', level: 38 } },
  { id: 'gold', kind: 'frame', name: 'Złoto', desc: 'Blask złota', req: { type: 'level', level: 50 } },
  { id: 'neon', kind: 'frame', name: 'Neon', desc: 'Pulsująca poświata w kolorze akcentu', req: { type: 'level', level: 62 }, animated: true },
  { id: 'rainbow', kind: 'frame', name: 'Tęcza', desc: 'Obracający się tęczowy pierścień', req: { type: 'level', level: 75 }, animated: true },
  { id: 'flame', kind: 'frame', name: 'Płomień', desc: 'Żywy ogień wokół avatara', req: { type: 'level', level: 88 }, animated: true },
  { id: 'diamond', kind: 'frame', name: 'Diament', desc: 'Lśniący, diamentowy pierścień', req: { type: 'level', level: 100 }, animated: true },
  { id: 'photo', kind: 'frame', name: 'Klisza', desc: 'Perforacja taśmy filmowej', req: { type: 'ach', id: 'fotograf', tier: 2, label: 'Fotograf — srebro' } },
  { id: 'tech', kind: 'frame', name: 'Zębatka', desc: 'Obracający się trybik techniczny', req: { type: 'ach', id: 'porzadkowicz', tier: 2, label: 'Porządkowicz grup — srebro' }, animated: true },
  { id: 'ember', kind: 'frame', name: 'Żar', desc: 'Rozżarzony pierścień wytrwałości', req: { type: 'ach', id: 'wytrwaly', tier: 3, label: 'Wytrwały — złoto' }, animated: true },
];

export const BACKGROUNDS: Cosmetic[] = [
  { id: 'default', kind: 'bg', name: 'Domyślne', desc: 'Gradient w kolorze akcentu', req: { type: 'level', level: 1 } },
  { id: 'graphite', kind: 'bg', name: 'Grafit', desc: 'Spokojna, ciemna szarość', req: { type: 'level', level: 4 } },
  { id: 'dusk', kind: 'bg', name: 'Zmierzch', desc: 'Granat przechodzący w bursztyn', req: { type: 'level', level: 10 } },
  { id: 'grid', kind: 'bg', name: 'Siatka techniczna', desc: 'Rysunek techniczny w kolorze akcentu', req: { type: 'level', level: 18 } },
  { id: 'film', kind: 'bg', name: 'Taśma filmowa', desc: 'Kadry i perforacja', req: { type: 'ach', id: 'fotograf', tier: 1, label: 'Fotograf — brąz' } },
  { id: 'circuit', kind: 'bg', name: 'Układ scalony', desc: 'Ścieżki z biegnącym impulsem', req: { type: 'ach', id: 'porzadkowicz', tier: 1, label: 'Porządkowicz grup — brąz' }, animated: true },
  { id: 'waves', kind: 'bg', name: 'Fale', desc: 'Płynące, animowane fale', req: { type: 'level', level: 28 }, animated: true },
  { id: 'aurora', kind: 'bg', name: 'Zorza', desc: 'Przesuwające się zorzowe plamy', req: { type: 'level', level: 42 }, animated: true },
  { id: 'space', kind: 'bg', name: 'Kosmos', desc: 'Migoczące gwiazdy', req: { type: 'level', level: 55 }, animated: true },
  { id: 'neoncity', kind: 'bg', name: 'Neonowe miasto', desc: 'Falujące neonowe kolory', req: { type: 'level', level: 70 }, animated: true },
  { id: 'goldshine', kind: 'bg', name: 'Złoty blask', desc: 'Złoto z przesuwającym się połyskiem', req: { type: 'level', level: 85 }, animated: true },
  { id: 'legend', kind: 'bg', name: 'Legenda', desc: 'Zorza z iskrami — tylko dla Legend', req: { type: 'level', level: 101 }, animated: true },
];

export const OVERLAYS: Cosmetic[] = [
  { id: 'none', kind: 'overlay', name: 'Brak', desc: 'Bez nakładki', req: { type: 'level', level: 1 } },
  { id: 'sparkles', kind: 'overlay', name: 'Iskierki', desc: 'Migoczące punkty', req: { type: 'level', level: 12 }, animated: true },
  { id: 'bubbles', kind: 'overlay', name: 'Bąbelki', desc: 'Unoszące się bąbelki', req: { type: 'level', level: 22 }, animated: true },
  { id: 'snow', kind: 'overlay', name: 'Śnieg', desc: 'Delikatnie opadający śnieg', req: { type: 'level', level: 32 }, animated: true },
  { id: 'confetti', kind: 'overlay', name: 'Konfetti', desc: 'Kolorowe konfetti', req: { type: 'level', level: 45 }, animated: true },
  { id: 'embers', kind: 'overlay', name: 'Żar', desc: 'Unoszące się iskry ognia', req: { type: 'level', level: 58 }, animated: true },
  { id: 'fireflies', kind: 'overlay', name: 'Świetliki', desc: 'Łagodnie pulsujące świetliki', req: { type: 'level', level: 72 }, animated: true },
];

export const ALL_COSMETICS: Cosmetic[] = [...FRAMES, ...BACKGROUNDS, ...OVERLAYS];

export function isUnlocked(c: Cosmetic, level: number, states: AchievementState[]): boolean {
  if (c.req.type === 'level') return level >= c.req.level;
  const req = c.req;
  const st = states.find((s) => s.def.id === req.id);
  return !!st && st.tier >= req.tier;
}

export function requirementText(c: Cosmetic): string {
  return c.req.type === 'level' ? `Poziom ${c.req.level}` : c.req.label;
}

/** Odblokowane zaraz po przejściu z poziomu `from` na `to` (tylko nagrody za poziom). */
export function unlockedByLevelUp(from: number, to: number): Cosmetic[] {
  return ALL_COSMETICS.filter((c) => c.req.type === 'level' && c.req.level > from && c.req.level <= to);
}

export function cosmeticName(kind: CosmeticKind, id: string | undefined): string {
  const list = kind === 'frame' ? FRAMES : kind === 'bg' ? BACKGROUNDS : OVERLAYS;
  return list.find((c) => c.id === id)?.name ?? '';
}
