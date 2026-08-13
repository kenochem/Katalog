import { Bell } from 'lucide-react';
import { useState } from 'react';
import {
  isWebPushSupported,
  requestNotificationPermission,
  subscribeTalkWebPush,
  talkPushStatus,
} from '../../lib/push/talkWebPush';
import { isTalkVapidConfigured } from '../../lib/push/talkPushSync';
import { saveTalkChatAppearance, loadTalkChatAppearance } from '../../lib/talkChatAppearance';
import { ContextHelp } from '../ContextHelp';

const DISMISS_KEY = 'katalog-talk-push-banner-dismiss:v2';

export function TalkPushOptInBanner({ userId }: { userId: string }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  const status = talkPushStatus();

  if (dismissed) return null;
  if (!isWebPushSupported()) return null;
  if (!isTalkVapidConfigured()) return null;
  if (status === 'granted') return null;
  if (!loadTalkChatAppearance().pushEnabled) return null;

  async function enable() {
    if (status === 'denied') {
      window.alert(
        'Powiadomienia sa zablokowane. Odblokuj Kenochem Talk w ustawieniach telefonu albo przegladarki.',
      );
      return;
    }

    setBusy(true);
    try {
      saveTalkChatAppearance({ pushEnabled: true });
      const perm = await requestNotificationPermission();
      if (perm === 'granted') await subscribeTalkWebPush(userId);
      if (perm === 'denied') {
        window.alert(
          'Powiadomienia sa zablokowane. Odblokuj Kenochem Talk w ustawieniach telefonu albo przegladarki.',
        );
      }
    } finally {
      setBusy(false);
      try {
        localStorage.setItem(DISMISS_KEY, '1');
      } catch {
        /* ignore */
      }
      setDismissed(true);
    }
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
            Powiadomienia Talk
            <ContextHelp id="push" side="left" />
          </p>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            {status === 'denied'
              ? 'Powiadomienia sa zablokowane w systemie. Odblokuj Kenochem Talk w ustawieniach telefonu.'
              : 'Pozwol aplikacji na powiadomienia, zeby widziec nowe wiadomosci tak jak w komunikatorze.'}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void enable()}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? '...' : status === 'denied' ? 'Jak odblokowac' : 'Pozwol'}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Pozniej
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
