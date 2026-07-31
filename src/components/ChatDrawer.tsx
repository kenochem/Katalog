import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  MessageCircle,
  X,
  Send,
  Users,
  User,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import {
  GENERAL_THREAD_ID,
  listChatPeers,
  getOrCreateDm,
  fetchMessages,
  sendMessage,
  subscribeThread,
  markThreadRead,
  countUnread,
  listMyDmUnread,
  type ChatMessage,
  type ChatPeer,
} from '../lib/chat';
import { isSupabaseConfigured } from '../lib/supabase';

type PanelView = 'list' | 'thread';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ChatDrawer() {
  const { mode, user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>('list');
  const [peers, setPeers] = useState<ChatPeer[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadTitle, setThreadTitle] = useState('Ogólny');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadGeneral, setUnreadGeneral] = useState(0);
  const [unreadDm, setUnreadDm] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const nameCache = useRef(new Map<string, string>());

  const enabled = mode === 'signed_in' && Boolean(user?.id) && isSupabaseConfigured;
  const unreadTotal =
    unreadGeneral + Object.values(unreadDm).reduce((a, b) => a + b, 0);

  const refreshUnread = useCallback(async () => {
    if (!user?.id) return;
    try {
      const g = await countUnread(GENERAL_THREAD_ID, user.id);
      setUnreadGeneral(g);
      const dms = await listMyDmUnread(user.id);
      const next: Record<string, number> = {};
      for (const d of dms) next[d.peerId] = d.unread;
      setUnreadDm(next);
    } catch {
      /* ignore — migracja może jeszcze nie być wdrożona */
    }
  }, [user?.id]);

  useEffect(() => {
    if (!enabled) return;
    void listChatPeers()
      .then(setPeers)
      .catch(() => setPeers([]));
    void refreshUnread();
    const t = window.setInterval(() => void refreshUnread(), 45_000);
    return () => window.clearInterval(t);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !threadId || !user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchMessages(threadId)
      .then((msgs) => {
        if (cancelled) return;
        setMessages(msgs);
        for (const m of msgs) nameCache.current.set(m.userId, m.authorName);
        void markThreadRead(threadId).then(() => void refreshUnread());
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Nie udało się wczytać czatu');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsub = subscribeThread(
      threadId,
      (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        nameCache.current.set(msg.userId, msg.authorName);
        if (msg.userId !== user.id) {
          void markThreadRead(threadId);
        }
      },
      nameCache.current
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [open, threadId, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, view]);

  if (!enabled) return null;

  async function openGeneral() {
    setThreadId(GENERAL_THREAD_ID);
    setThreadTitle('Ogólny');
    setView('thread');
    setMessages([]);
  }

  async function openDm(peer: ChatPeer) {
    setLoading(true);
    setError(null);
    try {
      const tid = await getOrCreateDm(peer.id);
      setThreadId(tid);
      setThreadTitle(peer.displayName);
      setView('thread');
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się otworzyć DM');
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e?: FormEvent) {
    e?.preventDefault();
    if (!threadId || !user?.id || !draft.trim() || sending) return;
    const text = draft;
    setDraft('');
    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage(threadId, user.id, text);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      void markThreadRead(threadId);
    } catch (err) {
      setDraft(text);
      setError(err instanceof Error ? err.message : 'Wysyłanie nieudane');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setView('list');
          void refreshUnread();
        }}
        className={`fixed z-40 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-900/20 transition hover:bg-brand-500 active:scale-95 dark:shadow-black/40 ${
          open ? 'pointer-events-none opacity-0' : 'opacity-100'
        } bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6`}
        aria-label="Otwórz czat"
      >
        <MessageCircle className="h-5 w-5" strokeWidth={2.2} />
        {unreadTotal > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      {/* Backdrop — tylko mobile (pełny sheet) */}
      <div
        className={`fixed inset-0 z-50 bg-slate-950/40 transition-opacity duration-300 md:bg-transparent dark:bg-black/50 md:dark:bg-transparent ${
          open ? 'opacity-100 md:pointer-events-none' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      {/* Panel: mobile = pełny sheet od dołu; desktop = kompaktowy widget prawy-dół */}
      <aside
        className={`fixed z-50 flex flex-col border border-slate-800/80 bg-slate-950 shadow-2xl transition-all duration-300 ease-out dark:border-slate-800 ${
          open
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-8 opacity-0 md:translate-y-6'
        } inset-x-0 bottom-0 h-[min(92dvh,100%)] rounded-t-2xl border-b-0 max-md:max-h-[92dvh] md:inset-auto md:bottom-6 md:right-6 md:h-[min(420px,70vh)] md:w-[360px] md:rounded-2xl md:border`}
        aria-hidden={!open}
        role="dialog"
        aria-label="Czat"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-700 md:hidden" />
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-800/80 px-3 py-3">
          {view === 'thread' ? (
            <button
              type="button"
              onClick={() => {
                setView('list');
                setThreadId(null);
                void refreshUnread();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-900 hover:text-slate-100"
              aria-label="Wróć"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
              <MessageCircle className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-100">
              {view === 'list' ? 'Czat' : threadTitle}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {view === 'list'
                ? 'Ogólny i wiadomości prywatne'
                : threadId === GENERAL_THREAD_ID
                  ? 'Wszyscy zalogowani'
                  : 'Wiadomość prywatna'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-900 hover:text-slate-100"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="shrink-0 border-b border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
            {error}
            {error.toLowerCase().includes('relation') ||
            error.toLowerCase().includes('function') ||
            error.toLowerCase().includes('schema cache') ? (
              <span className="mt-1 block text-rose-400/80">
                Uruchom migrację <code className="font-mono">supabase/migration-chat.sql</code> w
                SQL Editor.
              </span>
            ) : null}
          </div>
        )}

        {view === 'list' ? (
          <div className="flex-1 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => void openGeneral()}
              className="mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-900"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-brand-400">
                <Users className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-slate-100">Ogólny</span>
                <span className="block text-xs text-slate-500">Kanał zespołu</span>
              </span>
              {unreadGeneral > 0 && (
                <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {unreadGeneral}
                </span>
              )}
            </button>

            <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Bezpośrednie
            </p>
            {peers.length === 0 ? (
              <p className="px-3 py-4 text-xs text-slate-500">
                Brak innych aktywnych użytkowników — DM pojawi się, gdy ktoś się zaloguje.
              </p>
            ) : (
              peers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void openDm(p)}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-900"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
                    <User className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {p.displayName}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{p.email}</span>
                  </span>
                  {(unreadDm[p.id] ?? 0) > 0 && (
                    <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      {unreadDm[p.id]}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {loading && messages.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-12 text-center text-xs text-slate-500">
                  Brak wiadomości — napisz pierwszą.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.userId === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                    >
                      {!mine && (
                        <span className="mb-0.5 px-1 text-[10px] font-medium text-slate-500">
                          {m.authorName}
                        </span>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                          mine
                            ? 'rounded-br-md bg-brand-600 text-white'
                            : 'rounded-bl-md bg-slate-900 text-slate-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={`mt-1 text-[10px] ${
                            mine ? 'text-white/60' : 'text-slate-500'
                          }`}
                        >
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <form
              onSubmit={(e) => void handleSend(e)}
              className="shrink-0 border-t border-slate-800/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <div className="flex items-end gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-1.5">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={
                    profile?.displayName
                      ? `Napisz jako ${profile.displayName}…`
                      : 'Napisz wiadomość…'
                  }
                  className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  maxLength={2000}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-500 disabled:opacity-40"
                  aria-label="Wyślij"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </aside>
    </>
  );
}
