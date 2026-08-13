import { supabase } from './supabase';

export const CHAT_VOICE_MAX_SECONDS = 60;
export const CHAT_VOICE_MAX_BYTES = 1024 * 1024;
export const CHAT_VOICE_MIN_MS = 400;

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm';
}

function storageContentType(mime: string): string {
  const base = (mime || 'audio/webm').split(';')[0]?.trim();
  if (base === 'audio/mp4' || base === 'audio/x-m4a') return 'audio/mp4';
  if (base === 'audio/ogg') return 'audio/ogg';
  return 'audio/webm';
}

function extForMime(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

export interface VoiceRecordingSession {
  stop: () => Promise<{ blob: Blob; durationMs: number }>;
  cancel: () => void;
}

export async function startVoiceRecording(): Promise<VoiceRecordingSession> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Nagrywanie niedostępne w tej przeglądarce.');
  }
  if (
    typeof window !== 'undefined' &&
    window.location.protocol !== 'https:' &&
    window.location.hostname !== 'localhost'
  ) {
    throw new Error('Mikrofon wymaga połączenia HTTPS.');
  }
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Nagrywanie audio niedostępne — zaktualizuj przeglądarkę.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  let maxTimer: number | undefined;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(200);

  maxTimer = window.setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop();
  }, CHAT_VOICE_MAX_SECONDS * 1000);

  const cleanup = () => {
    if (maxTimer) window.clearTimeout(maxTimer);
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    cancel: () => {
      cleanup();
      if (recorder.state !== 'inactive') recorder.stop();
    },
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.onstop = () => {
          cleanup();
          const durationMs = Date.now() - startedAt;
          const blob = new Blob(chunks, { type: mimeType });
          if (durationMs < CHAT_VOICE_MIN_MS || blob.size < 100) {
            reject(new Error('Nagranie za krótkie.'));
            return;
          }
          if (blob.size > CHAT_VOICE_MAX_BYTES) {
            reject(new Error('Głosówka za długa — max 60 s / 1 MB.'));
            return;
          }
          resolve({ blob, durationMs });
        };
        recorder.onerror = () => {
          cleanup();
          reject(new Error('Błąd nagrywania.'));
        };
        if (recorder.state === 'recording') recorder.stop();
        else recorder.onstop?.(new Event('stop'));
      }),
  };
}

export async function uploadChatVoice(
  userId: string,
  threadId: string,
  blob: Blob,
): Promise<string> {
  if (!supabase) {
    throw new Error('Głosówki wymagają Supabase Storage (bucket chat-voice).');
  }
  if (blob.size > CHAT_VOICE_MAX_BYTES) {
    throw new Error('Plik audio za duży — max 1 MB.');
  }

  const contentType = storageContentType(blob.type);
  const ext = extForMime(contentType);
  const path = `${userId}/${threadId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('chat-voice').upload(path, blob, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });

  if (error) {
    if (/bucket|not found/i.test(error.message)) {
      throw new Error(
        'Bucket chat-voice nie istnieje — uruchom supabase/migration-chat-voice-push.sql w SQL Editor.',
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from('chat-voice').getPublicUrl(path);
  return data.publicUrl;
}

export function formatVoiceDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
