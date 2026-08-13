import { useEffect, useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import type { View } from '../types';
import {
  listAppNotifications,
  markAllAppNotificationsRead,
  markAppNotificationRead,
  unreadAppNotificationCount,
  type AppNotification,
  type AppNotificationScope,
} from '../lib/appNotifications';

interface AppNotificationCenterProps {
  onNavigate?: (view: View) => void;
  scope?: AppNotificationScope;
  subtitle?: string;
}

export function AppNotificationCenter({
  onNavigate,
  scope = 'catalog',
  subtitle,
}: AppNotificationCenterProps) {
  const { mode, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const userId = profile?.id;

  useEffect(() => {
    if (!userId) return;
    const refresh = () => setItems(listAppNotifications(userId, scope));
    refresh();
    window.addEventListener('katalog-notifications-changed', refresh);
    return () => window.removeEventListener('katalog-notifications-changed', refresh);
  }, [scope, userId]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (mode !== 'signed_in' || !userId) return null;

  const unread = unreadAppNotificationCount(userId, scope);

  function handleClick(n: AppNotification) {
    if (!userId) return;
    markAppNotificationRead(n.id);
    setItems(listAppNotifications(userId, scope));
    if (n.actionView && onNavigate) {
      onNavigate(n.actionView);
    }
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`hub-header-btn hub-header-btn--icon relative inline-flex items-center justify-center ${
          open
            ? 'border-brand-500/40 bg-brand-500/10 text-brand-600 dark:text-brand-300'
            : 'hub-header-btn--ghost'
        }`}
        title="Powiadomienia"
        aria-label="Powiadomienia"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="pointer-events-none absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-slate-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[90] flex max-h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40"
          role="dialog"
          aria-label="Powiadomienia"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-100">Powiadomienia</p>
              <p className="text-[10px] text-slate-500">
                {subtitle ?? 'Stany, zdjecia, system'}
              </p>
            </div>
            <div className="flex gap-0.5">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    markAllAppNotificationsRead(userId, scope);
                    setItems(listAppNotifications(userId, scope));
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
                  title="Oznacz wszystkie"
                >
                  <Check className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
                aria-label="Zamknij"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto py-1">
            {items.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">Brak alertow</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`flex w-full flex-col gap-0.5 border-b border-slate-800/60 px-3 py-2.5 text-left transition hover:bg-slate-800/80 ${
                      n.read ? 'opacity-70' : ''
                    }`}
                  >
                    <span className="text-sm font-medium text-slate-100">{n.title}</span>
                    <span className="text-xs text-slate-400">{n.body}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
