export interface RemoveWhiteBackgroundOptions {
  /** Min. jasność kanału RGB (0–255) — wyżej = tylko bielsze tło. */
  minLightness: number;
  /** Max różnica R/G/B — szare tło ma mały spread. */
  maxSpread: number;
  /** Miękkie przejście przy krawędzi (px). */
  edgeSoftness: number;
}

export const REMOVE_BG_PRESETS = {
  white: {
    minLightness: 248,
    maxSpread: 20,
    edgeSoftness: 1,
  },
  lightGray: {
    minLightness: 220,
    maxSpread: 34,
    edgeSoftness: 1,
  },
} satisfies Record<string, RemoveWhiteBackgroundOptions>;

import { fetchImageBlobForEditing } from './fetchImageBlob';

const DEFAULT_OPTIONS = REMOVE_BG_PRESETS.white;

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function gradientAt(data: Uint8ClampedArray, x: number, y: number, width: number, height: number): number {
  if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return 0;
  const L = (px: number, py: number) => {
    const o = (py * width + px) * 4;
    return luminance(data[o]!, data[o + 1]!, data[o + 2]!);
  };
  const gx = L(x + 1, y) - L(x - 1, y);
  const gy = L(x, y + 1) - L(x, y - 1);
  return Math.sqrt(gx * gx + gy * gy);
}

function isBackgroundPixel(
  r: number,
  g: number,
  b: number,
  opts: RemoveWhiteBackgroundOptions,
): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;
  return max >= opts.minLightness && spread <= opts.maxSpread;
}

/** Tło od krawędzi; gradient na obrysie zatrzymuje flood na białym opakowaniu. */
function alphaFromEdgeFloodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opts: RemoveWhiteBackgroundOptions,
): Uint8Array {
  const alpha = new Uint8Array(width * height).fill(255);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const pixelIndex = (x: number, y: number) => y * width + x;

  const matchesBgAt = (x: number, y: number) => {
    const i = pixelIndex(x, y);
    const o = i * 4;
    if (!isBackgroundPixel(data[o]!, data[o + 1]!, data[o + 2]!, opts)) return false;
    if (gradientAt(data, x, y, width, height) > 14) return false;
    return true;
  };

  const enqueue = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = pixelIndex(x, y);
    if (visited[i]) return;
    if (!matchesBgAt(x, y)) return;
    visited[i] = 1;
    queue[tail++] = i;
  };

  for (let x = 0; x < width; x++) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  while (head < tail) {
    const i = queue[head++]!;
    alpha[i] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  return alpha;
}

/** Jednopikselowe wygładzenie krawędzi — bez rozmycia całej maski. */
function softenOuterEdgeRing(alpha: Uint8Array, width: number, height: number): void {
  const src = new Uint8Array(alpha);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (src[i]! === 0) continue;
      let touchesBg = false;
      if (x > 0 && src[i - 1]! === 0) touchesBg = true;
      else if (x < width - 1 && src[i + 1]! === 0) touchesBg = true;
      else if (y > 0 && src[i - width]! === 0) touchesBg = true;
      else if (y < height - 1 && src[i + width]! === 0) touchesBg = true;
      if (touchesBg) alpha[i] = 250;
    }
  }
}

async function drawBlobToCanvas(
  blob: Blob,
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas niedostępny');

  try {
    const bitmap = await createImageBitmap(blob);
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    return { canvas, ctx };
  } catch {
    await new Promise<void>((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Nie udało się zdekodować obrazu'));
      };
      img.src = url;
    });
    return { canvas, ctx };
  }
}

/**
 * Usuwa jasne / białe / jasnoszare tło → PNG z alfą (w przeglądarce).
 */
export async function removeWhiteBackground(
  source: string | Blob,
  options: Partial<RemoveWhiteBackgroundOptions> = {},
): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const blob = await fetchImageBlobForEditing(source);
  const { canvas, ctx } = await drawBlobToCanvas(blob);

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    throw new Error(
      'Przeglądarka nie może odczytać pikseli (CORS) — wgraj plik z dysku w oknie wycinania tła.',
    );
  }

  const { data, width, height } = imageData;
  const alpha = alphaFromEdgeFloodFill(data, width, height, opts);
  if (opts.edgeSoftness > 0) {
    softenOuterEdgeRing(alpha, width, height);
  }

  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 3] = alpha[i]!;
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Eksport PNG nie powiódł się'))),
      'image/png',
      1,
    );
  });
}

export async function removeWhiteBackgroundToFile(
  source: string | Blob,
  filenameBase: string,
  options?: Partial<RemoveWhiteBackgroundOptions>,
): Promise<File> {
  const png = await removeWhiteBackground(source, options);
  const safe = filenameBase.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'product';
  return new File([png], `${safe}-nobg.png`, { type: 'image/png' });
}
