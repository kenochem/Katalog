import { supabase } from './supabase';

export const CHAT_FILE_MAX_BYTES = 2 * 1024 * 1024;

const SAFE_NAME_RE = /[^a-zA-Z0-9._-]+/g;

function safeFileName(name: string): string {
  const cleaned = name.trim().replace(SAFE_NAME_RE, '-').replace(/-+/g, '-');
  return cleaned.slice(0, 90) || 'plik';
}

export async function uploadChatFile(
  userId: string,
  threadId: string,
  file: File,
): Promise<string> {
  if (!supabase) {
    throw new Error('Pliki wymagają Supabase Storage (bucket chat-files).');
  }
  if (file.size > CHAT_FILE_MAX_BYTES) {
    throw new Error('Plik za duży — maksymalnie 2 MB.');
  }

  const path = `${userId}/${threadId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from('chat-files').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
    cacheControl: '3600',
  });

  if (error) {
    if (/bucket|not found/i.test(error.message)) {
      throw new Error(
        'Bucket chat-files nie istnieje — uruchom supabase/migration-chat-files-read-receipts.sql w SQL Editor.',
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from('chat-files').getPublicUrl(path);
  return data.publicUrl;
}
