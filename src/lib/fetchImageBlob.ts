import { supabase, isSupabaseConfigured } from './supabase';

/** Ścieżka obiektu z publicznego URL Supabase Storage. */
export function parseSupabasePublicObjectUrl(
  url: string,
): { bucket: string; path: string } | null {
  try {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return {
      bucket: match[1]!,
      path: decodeURIComponent(match[2]!),
    };
  } catch {
    return null;
  }
}

async function downloadViaSupabaseStorage(url: string): Promise<Blob | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const parsed = parseSupabasePublicObjectUrl(url);
  if (!parsed) return null;
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .download(parsed.path);
  if (error || !data) return null;
  return data;
}

async function downloadViaImageProxy(url: string): Promise<Blob | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anonKey) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;

  const res = await fetch(`${base.replace(/\/$/, '')}/functions/v1/image-proxy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob.size) return null;
  return blob;
}

/**
 * Pobiera obraz jako Blob do edycji w canvas (omija CORS CDN sklepu / zewn. hostów).
 */
export async function fetchImageBlobForEditing(source: string | Blob): Promise<Blob> {
  if (source instanceof Blob) return source;

  if (source.startsWith('data:') || source.startsWith('blob:')) {
    const res = await fetch(source);
    return res.blob();
  }

  const fromStorage = await downloadViaSupabaseStorage(source);
  if (fromStorage) return fromStorage;

  try {
    const res = await fetch(source, { mode: 'cors', cache: 'no-store' });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) return blob;
    }
  } catch {
    /* brak CORS na hoście źródłowym */
  }

  const proxied = await downloadViaImageProxy(source);
  if (proxied) return proxied;

  throw new Error(
    'Nie udało się pobrać zdjęcia do edycji. Zaloguj się ponownie lub wgraj plik z dysku.',
  );
}
