const FAVORITES_KEY = 'katalog-favorites';

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

export function getFavoriteIds(): string[] {
  return readIds();
}

export function isFavorite(productId: string): boolean {
  return readIds().includes(productId);
}

export function toggleFavorite(productId: string): boolean {
  const ids = readIds();
  const idx = ids.indexOf(productId);
  if (idx >= 0) {
    ids.splice(idx, 1);
    writeIds(ids);
    return false;
  }
  ids.unshift(productId);
  writeIds(ids);
  return true;
}

export function setFavorite(productId: string, on: boolean): void {
  const ids = new Set(readIds());
  if (on) ids.add(productId);
  else ids.delete(productId);
  writeIds([...ids]);
}
