import { supabase, isSupabaseConfigured, STORAGE_BUCKET } from './supabase';

const LOCAL_PREFIX = 'katalog-avatar:';
const AVATAR_BUCKET = 'user-avatars';

export function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getLocalAvatar(userId: string): string | null {
  try {
    const v = localStorage.getItem(`${LOCAL_PREFIX}${userId}`);
    if (!v) return null;
    if (v.startsWith('data:') || v.startsWith('http')) return v;
    return null;
  } catch {
    return null;
  }
}

function setLocalAvatarCache(userId: string, url: string): void {
  try {
    localStorage.setItem(`${LOCAL_PREFIX}${userId}`, url);
  } catch {
    /* quota */
  }
}

function notifyAvatarChanged(userId: string): void {
  window.dispatchEvent(new CustomEvent('katalog-avatar-changed', { detail: { userId } }));
}

function withCacheBust(url: string): string {
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}v=${Date.now()}`;
}

function extFromType(contentType: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  return 'jpg';
}

async function dataUrlToBlob(dataUrl: string): Promise<{ blob: Blob; contentType: string; ext: string }> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const contentType = blob.type || dataUrl.match(/^data:([^;]+)/)?.[1] || 'image/jpeg';
  return { blob, contentType, ext: extFromType(contentType) };
}

async function uploadAvatarBlob(
  userId: string,
  blob: Blob,
  ext: string,
  contentType: string,
): Promise<string> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase niedostepne');

  const cleanExt = ext === 'jpeg' ? 'jpg' : ext;
  const path = `${userId}/avatar.${cleanExt}`;

  let bucket = AVATAR_BUCKET;
  let uploadPath = path;
  let { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(uploadPath, blob, { upsert: true, contentType });
  if (uploadError && /bucket|not found/i.test(uploadError.message)) {
    bucket = STORAGE_BUCKET;
    uploadPath = `avatars/${userId}.${cleanExt}`;
    uploadError = (
      await supabase.storage
        .from(bucket)
        .upload(uploadPath, blob, { upsert: true, contentType })
    ).error;
  }
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(bucket).getPublicUrl(uploadPath);
  const publicUrl = withCacheBust(data.publicUrl);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);
  if (profileError) throw profileError;

  setLocalAvatarCache(userId, publicUrl);
  notifyAvatarChanged(userId);
  return publicUrl;
}

async function migrateLocalAvatarToCloud(userId: string, dataUrl: string): Promise<void> {
  if (!dataUrl.startsWith('data:')) return;
  const { blob, contentType, ext } = await dataUrlToBlob(dataUrl);
  await uploadAvatarBlob(userId, blob, ext, contentType);
}

async function fetchProfileAvatarUrl(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('avatar_url fetch', error);
    return null;
  }
  const url = data?.avatar_url?.trim();
  return url || null;
}

async function signedAvatarFromStorage(userId: string): Promise<string | null> {
  if (!supabase) return null;
  for (const ext of ['webp', 'jpg', 'jpeg', 'png']) {
    const path = `${userId}/avatar.${ext === 'jpeg' ? 'jpg' : ext}`;
    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  for (const ext of ['webp', 'jpg', 'jpeg', 'png']) {
    const path = `avatars/${userId}.${ext === 'jpeg' ? 'jpg' : ext}`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return null;
}

export async function loadUserAvatar(userId: string): Promise<string | null> {
  const cloud = await fetchProfileAvatarUrl(userId);
  if (cloud) {
    setLocalAvatarCache(userId, cloud);
    return cloud;
  }
  const local = getLocalAvatar(userId);
  if (local) {
    if (local.startsWith('data:') && isSupabaseConfigured && supabase) {
      void migrateLocalAvatarToCloud(userId, local).catch((error) => {
        console.warn('avatar local migration', error);
      });
    }
    return local;
  }
  const signed = await signedAvatarFromStorage(userId);
  if (signed) {
    setLocalAvatarCache(userId, signed);
    return signed;
  }
  return null;
}

/** @deprecated użyj saveUserAvatarFile */
export async function saveLocalAvatar(userId: string, dataUrl: string): Promise<void> {
  setLocalAvatarCache(userId, dataUrl);
  notifyAvatarChanged(userId);
}

function extFromFile(file: File): string {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  if (ext === 'jpeg') return 'jpg';
  if (['jpg', 'png', 'webp', 'gif'].includes(ext)) return ext;
  return 'jpg';
}

export async function saveUserAvatarFile(userId: string, file: File): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Nie udało się odczytać pliku'));
      reader.readAsDataURL(file);
    });
    setLocalAvatarCache(userId, dataUrl);
    notifyAvatarChanged(userId);
    return dataUrl;
  }

  const ext = extFromFile(file);
  const contentType =
    file.type ||
    (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
  return uploadAvatarBlob(userId, file, ext, contentType);
}
