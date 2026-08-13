import { lazy, Suspense, useEffect, useState } from 'react';
import { Loader2, MessageCircle, X } from 'lucide-react';
import { useChatPanel } from './useChatPanel';
import { HUB_OPEN_CHAT_EVENT } from '../../lib/hubChatEvents';

const TalkChatPage = lazy(() =>
  import('./TalkChatPage').then((m) => ({ default: m.TalkChatPage })),
);

type TalkChatDrawerProps = {
  fabBottomClass?: string;
  zIndexClass?: string;
  listenHubOpenEvent?: boolean;
  suiteMode?: boolean;
};

/** Bańka czatu — ten sam Talk co na hub-platform i kenochem-talk. */
export function TalkChatDrawer({
  fabBottomClass = 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6',
  zIndexClass = 'z-[55]',
  listenHubOpenEvent = false,
  suiteMode = false,
}: TalkChatDrawerProps) {
  const [open, setOpen] = useState(false);
  const { enabled, unreadGeneral, unreadDm } = useChatPanel(false);
  const unreadTotal =
    unreadGeneral + Object.values(unreadDm).reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!listenHubOpenEvent) return;
    const onOpen = () => setOpen(true);
    window.addEventListener(HUB_OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(HUB_OPEN_CHAT_EVENT, onOpen);
  }, [listenHubOpenEvent]);

  useEffect(() => {
    if (!listenHubOpenEvent) return;
    window.dispatchEvent(
      new CustomEvent('hub-chat-open-change', { detail: { open } }),
    );
  }, [listenHubOpenEvent, open]);

  if (!enabled) return null;

  const overlayZ = zIndexClass.replace(/\d+/, (n) => String(Number(n) + 1));
  const panelZ = zIndexClass.replace(/\d+/, (n) => String(Number(n) + 2));
  const panelSizeClass = suiteMode
    ? 'inset-x-0 bottom-0 h-[100dvh] rounded-none border-b-0 max-md:pb-[env(safe-area-inset-bottom)] md:inset-auto md:bottom-4 md:right-4 md:h-[min(820px,calc(100dvh-2rem))] md:w-[min(980px,calc(100vw-2rem))] md:rounded-3xl'
    : 'inset-x-0 bottom-0 h-[min(92dvh,720px)] rounded-t-2xl border-b-0 max-md:pb-[env(safe-area-inset-bottom)] md:inset-auto md:bottom-6 md:right-6 md:h-[min(560px,calc(100dvh-5rem))] md:w-[min(420px,calc(100vw-2rem))] md:rounded-2xl';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed ${zIndexClass} flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/25 transition hover:bg-brand-500 active:scale-95 ${
          open ? 'pointer-events-none scale-90 opacity-0' : 'opacity-100'
        } ${fabBottomClass}`}
        aria-label="Otwórz czat"
      >
        <MessageCircle className="h-[1.35rem] w-[1.35rem]" strokeWidth={2.1} />
        {unreadTotal > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      <div
        className={`fixed inset-0 ${overlayZ} bg-slate-950/50 transition-opacity md:pointer-events-none md:bg-transparent ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        className={`fixed ${panelZ} flex flex-col border border-slate-800 bg-slate-950 shadow-2xl transition-all duration-300 ease-out ${
          open
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-6 opacity-0'
        } ${panelSizeClass}`}
        role="dialog"
        aria-modal={open}
        aria-label="Talk — czat"
        aria-hidden={!open}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-700 md:hidden" />
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/talk-logo-dark.svg?v=3" alt="Talk" className="talk-app-logo" />
            {suiteMode && (
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold text-slate-100">Kenochem Talk</p>
                <p className="truncate text-[11px] text-slate-500">
                  Czat zespolu w Suite
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-900 hover:text-slate-100"
            aria-label="Zamknij czat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {open && (
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                </div>
              }
            >
              <TalkChatPage variant={suiteMode ? 'page' : 'drawer'} />
            </Suspense>
          )}
        </div>
      </aside>
    </>
  );
}
