import { STORAGE_BUCKET, isSupabaseConfigured, supabase } from './supabase';

export interface ProductDoc {
  /** Nazwa pliku w magazynie (bez polskich znaków) — służy też jako klucz. */
  name: string;
  url: string;
  size: number;
  createdAt: string;
}

/** Materiały produktu (karty charakterystyki, specyfikacje, ulotki) leżą w tym samym magazynie co zdjęcia, w osobnym katalogu. */
const dir = (productId: string) => `docs/${productId}`;

/** Klucz w magazynie nie może zawierać polskich liter ani spacji. */
export function safeDocName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const clean = base
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return `${clean || 'plik'}${ext ? `.${ext}` : ''}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function listProductDocs(productId: string): Promise<ProductDoc[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const { data, error } = await bucket.list(dir(productId), { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((f) => f.name && !f.name.startsWith('.') && f.id)
    .map((f) => ({
      name: f.name,
      url: bucket.getPublicUrl(`${dir(productId)}/${f.name}`).data.publicUrl,
      size: Number((f.metadata as { size?: number } | null)?.size ?? 0),
      createdAt: f.created_at ?? '',
    }));
}

export async function uploadProductDoc(productId: string, file: File, fileName?: string): Promise<string> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Brak połączenia z bazą');
  const name = safeDocName(fileName ?? file.name);
  const contentType = file.type || (name.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(`${dir(productId)}/${name}`, file, { upsert: true, contentType, cacheControl: '3600' });
  if (error) throw new Error(error.message);
  return name;
}

export async function removeProductDoc(productId: string, name: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([`${dir(productId)}/${name}`]);
  if (error) throw new Error(error.message);
}
