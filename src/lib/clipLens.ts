/**
 * Lokalny CLIP (Xenova) vs indeks shop-embeddings.json.
 * Porównuje przód produktu ze zdjęciami katalogowymi.
 */
import type { Product } from '../types';

const MODEL = 'Xenova/clip-vit-base-patch32';
const EMBEDDINGS_URL = '/data/shop-embeddings.json';
const MAX_RESULTS = 3;
/** Minimalna cosine similarity — poniżej odrzuć. */
const MIN_SIM = 0.18;
/** CLIP native ~224; lekko więcej przed modelem. */
const PREP_SIZE = 336;

export type ClipPick = {
  id: string;
  sku: string;
  score: number; // 0–100
  reason: string;
};

type EmbeddingsPack = {
  model?: string;
  dim?: number;
  vectors: Record<string, number[]>;
  colors?: Record<string, number[]>;
};

let packPromise: Promise<EmbeddingsPack | null> | null = null;
let extractorPromise: Promise<
  (img: unknown, opts: { pooling: string; normalize: boolean }) => Promise<{
    data: Float32Array | number[];
  }>
> | null = null;

function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!;
  return dot;
}

function l2normalize(vec: number[]): number[] {
  let s = 0;
  for (const v of vec) s += v * v;
  const n = Math.sqrt(s) || 1;
  return vec.map((v) => v / n);
}

async function loadPack(): Promise<EmbeddingsPack | null> {
  if (!packPromise) {
    packPromise = (async () => {
      try {
        const res = await fetch(EMBEDDINGS_URL);
        if (!res.ok) return null;
        const data = (await res.json()) as EmbeddingsPack;
        if (!data?.vectors || typeof data.vectors !== 'object') return null;
        return data;
      } catch {
        return null;
      }
    })();
  }
  return packPromise;
}

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      return pipeline('image-feature-extraction', MODEL, {
        quantized: true,
      }) as Promise<
        (img: unknown, opts: { pooling: string; normalize: boolean }) => Promise<{
          data: Float32Array | number[];
        }>
      >;
    })();
  }
  return extractorPromise;
}

/**
 * Kwadrat jak typowe zdjęcie katalogowe: produkt na środku, białe tło wokół.
 */
async function prepareCatalogLikeSquare(file: Blob, size = PREP_SIZE): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Nie można odczytać zdjęcia.');
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas niedostępny');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const scale = Math.min(size / bitmap.width, size / bitmap.height);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const x = Math.floor((size - w) / 2);
    const y = Math.floor((size - h) / 2);
    ctx.drawImage(bitmap, x, y, w, h);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Przygotowanie zdjęcia nieudane'))),
        'image/jpeg',
        0.92,
      );
    });
  } finally {
    bitmap.close();
  }
}

function resolveProduct(
  embId: string,
  byId: Map<string, Product>,
  bySku: Map<string, Product>,
): Product | undefined {
  const direct = byId.get(embId);
  if (direct) return direct;
  const stripped = embId.replace(/^shop-/i, '').toUpperCase();
  return bySku.get(stripped) || bySku.get(embId.toUpperCase());
}

export async function isClipIndexAvailable(): Promise<boolean> {
  const pack = await loadPack();
  return !!(pack && Object.keys(pack.vectors).length > 0);
}

/**
 * Porównaj zdjęcie z indeksem CLIP — top N (score 0–100).
 */
export async function matchByClip(
  file: Blob,
  products: Product[],
  onStatus?: (detail: string) => void,
  limit = MAX_RESULTS,
): Promise<ClipPick[]> {
  onStatus?.('Ładuję indeks zdjęć katalogu…');
  const pack = await loadPack();
  if (!pack) {
    throw new Error('Brak indeksu zdjęć katalogu (shop-embeddings).');
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));

  const entries: { id: string; product: Product; vec: number[] }[] = [];
  for (const [id, vec] of Object.entries(pack.vectors)) {
    const product = resolveProduct(id, byId, bySku);
    if (!product || !vec?.length) continue;
    entries.push({ id: product.id, product, vec });
  }
  if (!entries.length) {
    throw new Error('Indeks CLIP nie pasuje do produktów w katalogu.');
  }

  onStatus?.('Ładuję model rozpoznawania (raz, lokalnie)…');
  const extractor = await getExtractor();

  onStatus?.('Przygotowuję kadr jak w katalogu…');
  const prepared = await prepareCatalogLikeSquare(file);

  onStatus?.('Porównuję ze zdjęciami katalogu…');
  const { RawImage } = await import('@xenova/transformers');
  const bitmapUrl = URL.createObjectURL(prepared);
  try {
    const image = await RawImage.read(bitmapUrl);
    const out = await extractor(image, { pooling: 'mean', normalize: true });
    const raw = Array.from(out.data as ArrayLike<number>);
    const dim = pack.dim || 512;
    const sliced = raw.length === dim ? raw : raw.slice(0, dim);
    if (sliced.length < dim) {
      throw new Error('Model zwrócił niepełny wektor — spróbuj ponownie.');
    }
    const queryVec = l2normalize(sliced);

    const scored: { product: Product; sim: number }[] = [];
    for (const e of entries) {
      const sim = cosine(queryVec, e.vec);
      if (sim < MIN_SIM) continue;
      scored.push({ product: e.product, sim });
    }
    scored.sort((a, b) => b.sim - a.sim);

    const top = scored.slice(0, limit);
    if (!top.length) return [];

    // Skala względem najlepszego wyniku — czytelniejsza na UI
    const best = top[0]!.sim;
    return top.map((row) => {
      const relative = best > 0 ? row.sim / best : 0;
      const score = Math.round(
        Math.min(99, Math.max(1, row.sim * 85 + relative * 12)),
      );
      return {
        id: row.product.id,
        sku: row.product.sku,
        score,
        reason: 'podobieństwo do zdjęcia katalogowego',
      };
    });
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}
