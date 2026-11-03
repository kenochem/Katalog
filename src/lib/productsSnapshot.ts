import type { Product } from '../types';

/**
 * Migawka listy produktów z ostatniej wizyty (IndexedDB). Katalog pokazuje ją od razu po otwarciu,
 * a świeże dane z bazy podmieniają ją po chwili — start nie czeka na pobranie kilku tysięcy produktów.
 * Migawka nigdy nie zastępuje danych z bazy: służy tylko do pierwszego obrazu.
 */
const DB_NAME = 'katalog-snapshot';
const STORE = 'lists';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Brak IndexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSnapshot(key: string): Promise<Product[] | null> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => {
        const v = req.result as { at: number; data: Product[] } | undefined;
        resolve(v?.data?.length ? v.data : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function saveSnapshot(key: string, data: Product[]): void {
  if (!data.length) return;
  const run = () => {
    void open()
      .then((db) => {
        db.transaction(STORE, 'readwrite').objectStore(STORE).put({ at: Date.now(), data }, key);
      })
      .catch(() => undefined);
  };
  // zapis (kopiowanie kilku MB) nie może konkurować z rysowaniem listy
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500);
}

export async function clearSnapshots(): Promise<void> {
  try {
    const db = await open();
    db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
  } catch {
    /* nic do czyszczenia */
  }
}
