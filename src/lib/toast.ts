export type ToastTone = 'ok' | 'info' | 'warn' | 'error';

export interface ToastPayload {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
}

type Listener = (t: ToastPayload) => void;

const listeners = new Set<Listener>();

export function showToast(message: string, tone: ToastTone = 'ok', durationMs = 2800) {
  const payload: ToastPayload = { message, tone, durationMs };
  listeners.forEach((fn) => fn(payload));
}

export function subscribeToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
