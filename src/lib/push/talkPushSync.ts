import { isTalkChatPushEnabled } from '../talkChatAppearance';
import { isWebPushSupported, subscribeTalkWebPush, unsubscribeTalkWebPush } from './talkWebPush';

export function isTalkVapidConfigured(): boolean {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  return Boolean(key?.trim());
}

/** Po zalogowaniu — odśwież subskrypcję bez ponownego pytania o zgodę. */
export async function syncTalkPushSubscription(userId: string): Promise<void> {
  if (!isWebPushSupported()) return;
  if (!isTalkChatPushEnabled()) return;
  if (!isTalkVapidConfigured()) return;
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  await subscribeTalkWebPush(userId);
}

export async function disableTalkPush(userId: string): Promise<void> {
  await unsubscribeTalkWebPush(userId);
}
