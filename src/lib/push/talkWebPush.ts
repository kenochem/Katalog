import { isSupabaseConfigured, supabase } from '../supabase';
import { isTalkChatPushEnabled } from '../talkChatAppearance';

const LOCAL_KEY = 'katalog-talk-push-sub';

export interface TalkPushDiagnostics {
  supported: boolean;
  vapidConfigured: boolean;
  permission: NotificationPermission | 'missing';
  displayMode: 'standalone' | 'browser';
  serviceWorkerReady: boolean;
  serviceWorkerController: boolean;
  hasBrowserSubscription: boolean;
  appServerKeyMatches: boolean | null;
  dbSubscriptionCount: number | null;
  currentEndpointSaved: boolean | null;
  latestSavedAt: string | null;
}

export interface TalkPushSendResult {
  ok: boolean;
  mode?: 'message' | 'self-test';
  recipients?: number;
  subscriptions?: number;
  attempted?: number;
  sent?: number;
  failed?: number;
  stale?: number;
  failures?: Array<{ status?: number; name?: string; message: string }>;
  error?: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sameApplicationServerKey(subscription: PushSubscription, vapidKey: string): boolean {
  return arrayBufferToBase64Url(subscription.options.applicationServerKey) === vapidKey.trim();
}

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export function isDisplayModeStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export async function showTalkWebNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (!isTalkChatPushEnabled()) return;

  const icon = '/icons/talk-icon-192.png';
  const payload = {
    body,
    icon,
    badge: icon,
    tag: `talk-${String(data?.threadId ?? title)}`,
    data: { url: '/', ...data },
  };

  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    if (reg?.showNotification) {
      await reg.showNotification(title, payload);
      return;
    }
  }

  new Notification(title, payload);
}

export async function savePushSubscription(userId: string, subscription: PushSubscription): Promise<boolean> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys) return false;

  try {
    localStorage.setItem(LOCAL_KEY, json.endpoint);
  } catch {
    /* ignore */
  }

  if (!isSupabaseConfigured || !supabase) return true;

  const { error } = await supabase.from('chat_push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      keys: json.keys,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' },
  );
  return !error;
}

export async function subscribeTalkWebPush(userId: string): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;
  if (!isTalkChatPushEnabled()) return null;

  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return null;

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey?.trim()) {
    console.warn('Talk push: brak VITE_VAPID_PUBLIC_KEY w buildzie Talk');
    return null;
  }
  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameApplicationServerKey(sub, vapidKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey.trim()),
    });
  }

  if (sub) await savePushSubscription(userId, sub);
  return sub;
}

export async function getTalkPushDiagnostics(userId?: string): Promise<TalkPushDiagnostics> {
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  const base: TalkPushDiagnostics = {
    supported: isWebPushSupported(),
    vapidConfigured: Boolean(vapidKey?.trim()),
    permission: typeof Notification === 'undefined' ? 'missing' : Notification.permission,
    displayMode: isDisplayModeStandalone() ? 'standalone' : 'browser',
    serviceWorkerReady: false,
    serviceWorkerController: false,
    hasBrowserSubscription: false,
    appServerKeyMatches: null,
    dbSubscriptionCount: null,
    currentEndpointSaved: null,
    latestSavedAt: null,
  };

  let sub: PushSubscription | null = null;
  if (base.supported) {
    const reg = await navigator.serviceWorker.ready.catch(() => null);
    base.serviceWorkerReady = Boolean(reg);
    base.serviceWorkerController = Boolean(navigator.serviceWorker.controller);
    sub = (await reg?.pushManager.getSubscription()) ?? null;
    base.hasBrowserSubscription = Boolean(sub);
    if (sub && vapidKey?.trim()) {
      base.appServerKeyMatches = sameApplicationServerKey(sub, vapidKey);
    }
  }

  if (userId && supabase) {
    const { data } = await supabase
      .from('chat_push_subscriptions')
      .select('endpoint, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    const rows = data ?? [];
    base.dbSubscriptionCount = rows.length;
    base.latestSavedAt = rows[0]?.updated_at ?? null;
    base.currentEndpointSaved = sub
      ? rows.some((row) => row.endpoint === sub?.endpoint)
      : rows.length > 0
        ? false
        : null;
  }

  return base;
}

export async function sendTalkPushSelfTest(userId: string): Promise<TalkPushSendResult> {
  if (!supabase) return { ok: false, error: 'Brak Supabase' };
  const sub = await subscribeTalkWebPush(userId);
  if (!sub) {
    return {
      ok: false,
      error: 'Ten telefon nie ma aktywnej subskrypcji push.',
    };
  }

  const { data: sessData } = await supabase.auth.getSession();
  const token = sessData.session?.access_token;
  if (!token) return { ok: false, error: 'Brak aktywnej sesji. Zaloguj sie ponownie.' };

  const { data, error } = await supabase.functions.invoke('chat-push', {
    body: { action: 'self-test' },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    let detail = error.message || 'Blad funkcji chat-push';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const payload = (await ctx.json()) as { error?: string; message?: string };
        detail = payload.error || payload.message || detail;
      }
    } catch {
      /* ignore */
    }
    return { ok: false, error: detail };
  }

  const result = data as TalkPushSendResult;
  if (result && typeof result === 'object') return result;
  return { ok: false, error: 'Nieczytelna odpowiedz funkcji push.' };
}

export async function sendTalkPushForMessage(messageId: string): Promise<TalkPushSendResult> {
  if (!supabase) return { ok: false, error: 'Brak Supabase' };
  const { data: sessData } = await supabase.auth.getSession();
  const token = sessData.session?.access_token;
  if (!token) return { ok: false, error: 'Brak aktywnej sesji. Zaloguj sie ponownie.' };

  const { data, error } = await supabase.functions.invoke('chat-push', {
    body: { action: 'message', messageId },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    let detail = error.message || 'Blad funkcji chat-push';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const payload = (await ctx.json()) as { error?: string; message?: string };
        detail = payload.error || payload.message || detail;
      }
    } catch {
      /* ignore */
    }
    return { ok: false, error: detail };
  }

  const result = data as TalkPushSendResult;
  if (result && typeof result === 'object') return result;
  return { ok: false, error: 'Nieczytelna odpowiedz funkcji push.' };
}

export async function unsubscribeTalkWebPush(userId: string): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    if (supabase) {
      await supabase
        .from('chat_push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint);
    }
  }
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

export function talkPushStatus(): 'unsupported' | 'denied' | 'prompt' | 'granted' {
  if (!isWebPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') return 'prompt';
  return 'granted';
}
