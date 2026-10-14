/**
 * Pomiar wagi i formatu zdjęć produktów (do narzędzia „Waga i format”).
 * Mierzymy lekko — zapytaniem HEAD (Content-Length / Content-Type), bez pobierania zdjęcia.
 * Wynik zapamiętujemy lokalnie; po ponownym wgraniu URL się zmienia (cache-bust), więc zdjęcie
 * jest mierzone od nowa.
 */

const KEY = 'katalog-image-weights-v1';
const MAX_ENTRIES = 8000;

/** [bajty, typ MIME] */
export type ImageWeight = [number, string];

let memory: Record<string, ImageWeight> | null = null;

function load(): Record<string, ImageWeight> {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    memory = raw ? (JSON.parse(raw) as Record<string, ImageWeight>) : {};
  } catch {
    memory = {};
  }
  return memory;
}

function persist(): void {
  if (!memory) return;
  try {
    const keys = Object.keys(memory);
    if (keys.length > MAX_ENTRIES) for (const k of keys.slice(0, keys.length - MAX_ENTRIES)) delete memory[k];
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* brak miejsca / tryb prywatny */
  }
}

export function getCachedWeight(url: string): ImageWeight | null {
  return load()[url] ?? null;
}

export function setCachedWeight(url: string, w: ImageWeight): void {
  load()[url] = w;
  persist();
}

/** Czy zdjęcie leży w naszym magazynie (tylko takie możemy podmienić). */
export function isOwnImageUrl(url: string): boolean {
  return url.includes('/storage/v1/object/public/');
}

export function formatFromMime(mime: string): 'JPG' | 'PNG' | 'WebP' | 'GIF' | 'AVIF' | '?' {
  const m = mime.toLowerCase();
  if (m.includes('jpeg') || m.includes('jpg')) return 'JPG';
  if (m.includes('png')) return 'PNG';
  if (m.includes('webp')) return 'WebP';
  if (m.includes('gif')) return 'GIF';
  if (m.includes('avif')) return 'AVIF';
  return '?';
}

async function measureOne(url: string): Promise<ImageWeight | null> {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (head.ok) {
      const len = Number(head.headers.get('content-length'));
      const type = head.headers.get('content-type') ?? '';
      if (len > 0) return [len, type];
    }
  } catch {
    /* spróbuj pełnego pobrania */
  }
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? [blob.size, blob.type || res.headers.get('content-type') || ''] : null;
  } catch {
    return null;
  }
}

export async function scanImageWeights(
  urls: string[],
  opts: {
    concurrency?: number;
    onProgress?: (p: { done: number; total: number }) => void;
    onMeasured?: () => void;
    shouldStop?: () => boolean;
  } = {},
): Promise<number> {
  const todo = urls.filter((u) => !getCachedWeight(u));
  const total = todo.length;
  const concurrency = Math.max(1, opts.concurrency ?? 8);
  let index = 0;
  let done = 0;
  let measured = 0;
  let sinceSave = 0;

  async function worker() {
    while (!opts.shouldStop?.()) {
      const i = index++;
      if (i >= todo.length) return;
      const url = todo[i];
      const w = await measureOne(url);
      done++;
      if (w) {
        load()[url] = w;
        measured++;
        sinceSave++;
        opts.onMeasured?.();
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
