/**
 * Pomiar wymiarow zdjec produktow (do listy "Zdjecia do poprawy").
 * Wymiary nie sa trzymane w bazie, wiec mierzymy zdjecia w przegladarce i zapamietujemy
 * wynik lokalnie (klucz = pelny URL; po ponownym wgraniu URL sie zmienia - cache-bust -
 * wiec zdjecie jest mierzone od nowa).
 */

const KEY = 'katalog-image-dims-v1';
const MAX_ENTRIES = 8000;

export type ImageDims = [number, number];

let memory: Record<string, ImageDims> | null = null;

function load(): Record<string, ImageDims> {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as Record<string, ImageDims>) : {};
  } catch {
    memory = {};
  }
  return memory;
}

function persist(): void {
  if (!memory) return;
  try {
    const keys = Object.keys(memory);
    if (keys.length > MAX_ENTRIES) {
      for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete memory[k];
    }
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* brak miejsca / tryb prywatny - zostaje cache w pamieci */
  }
}

export function getCachedDims(url: string): ImageDims | null {
  return load()[url] ?? null;
}

export function setCachedDims(url: string, dims: ImageDims): void {
  load()[url] = dims;
  persist();
}

function measureOne(url: string, timeoutMs = 20000): Promise<ImageDims | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;
    const finish = (v: ImageDims | null) => {
      if (done) return;
      done = true;
      img.onload = null;
      img.onerror = null;
      img.src = '';
      resolve(v);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    img.onload = () => {
      window.clearTimeout(timer);
      finish(img.naturalWidth > 0 ? [img.naturalWidth, img.naturalHeight] : null);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    img.src = url;
  });
}

export interface ScanProgress {
  done: number;
  total: number;
}

/**
 * Mierzy wszystkie URL-e, ktorych nie ma w cache. Zwraca liczbe zmierzonych.
 * `shouldStop` pozwala przerwac (przycisk "Zatrzymaj").
 */
export async function scanImageDims(
  urls: string[],
  opts: {
    concurrency?: number;
    onProgress?: (p: ScanProgress) => void;
    onMeasured?: (url: string, dims: ImageDims) => void;
    shouldStop?: () => boolean;
  } = {},
): Promise<number> {
  const todo = urls.filter((u) => !getCachedDims(u));
  const total = todo.length;
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  let index = 0;
  let done = 0;
  let measured = 0;
  let sinceSave = 0;

  async function worker() {
    while (!opts.shouldStop?.()) {
      const i = index++;
      if (i >= todo.length) return;
      const url = todo[i];
      const dims = await measureOne(url);
      done++;
      if (dims) {
        load()[url] = dims;
        measured++;
        sinceSave++;
        opts.onMeasured?.(url, dims);
        if (sinceSave >= 25) {
          persist();
          sinceSave = 0;
        }
      }
      opts.onProgress?.({ done, total });
    }
  }

  opts.onProgress?.({ done: 0, total });
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  persist();
  return measured;
}
