import { useCallback, useEffect, useMemo, useState } from 'react';
import { Inbox, Loader2, Mail, Send } from 'lucide-react';
import type { CrmInboxThread, InboxCategoryId } from '../../lib/crmInbox';
import {
  fetchCrmInboxFromCloud,
  fetchCrmMailBody,
  formatCrmMailError,
  isCloudCrmMailThread,
  patchCrmInboxThread,
  sendCrmMailReply,
} from '../../lib/crmMail';
import { showToast } from '../../lib/toast';
import {
  InboxCategoryBadge,
  InboxRepliedIcon,
  formatInboxDate,
} from './InboxMailUi';
import { CrmMailMessageBody } from './CrmMailMessageBody';
import {
  InboxCategoryPicker,
  InboxFilterBar,
  type InboxFilterId,
} from './InboxCategoryPicker';
import { CrmMailboxPanel } from './CrmMailboxPanel';

function matchesFilter(t: CrmInboxThread, filter: InboxFilterId): boolean {
  if (filter === 'all') return true;
  if (filter === 'unreplied') return !t.replied;
  return t.category === filter;
}

interface CrmCustomerInboxViewProps {
  cloudEnabled?: boolean;
  onOpenClient?: (clientName: string) => void;
  onOpenOrderSku?: (sku: string) => void;
  onInboxChange?: () => void;
}

export function CrmCustomerInboxView({
  cloudEnabled = false,
  onOpenClient,
  onOpenOrderSku,
  onInboxChange,
}: CrmCustomerInboxViewProps) {
  const [inbox, setInbox] = useState<CrmInboxThread[]>([]);
  const [activeThread, setActiveThread] = useState<CrmInboxThread | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [filter, setFilter] = useState<InboxFilterId>('all');
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [loadingBody, setLoadingBody] = useState(false);
  const [sending, setSending] = useState(false);

  const reloadAll = useCallback(async () => {
    if (!cloudEnabled) {
      setInbox([]);
      return;
    }
    setLoadingCloud(true);
    try {
      const cloud = await fetchCrmInboxFromCloud();
      setInbox(cloud);
    } catch (err) {
      showToast(
        formatCrmMailError(err instanceof Error ? err.message : 'Błąd wczytywania poczty'),
        'warn',
        8000,
      );
    } finally {
      setLoadingCloud(false);
    }
  }, [cloudEnabled]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  useEffect(() => {
    if (!activeThread) return;
    const updated = inbox.find((t) => t.id === activeThread.id);
    if (updated) setActiveThread(updated);
  }, [inbox, activeThread?.id]);

  const filtered = useMemo(
    () => inbox.filter((t) => matchesFilter(t, filter)),
    [inbox, filter],
  );

  const counts = useMemo(() => {
    const byCategory: Partial<Record<InboxCategoryId, number>> = {};
    for (const t of inbox) {
      if (t.category) byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    }
    return {
      all: inbox.length,
      unreplied: inbox.filter((t) => !t.replied).length,
      byCategory,
    };
  }, [inbox]);

  const unread = inbox.filter((t) => t.unread).length;

  function needsBodyLoad(t: CrmInboxThread): boolean {
    if (!isCloudCrmMailThread(t.id)) return false;
    if (t.meta?.bodyFetched && (t.bodyHtml || t.body?.trim())) return false;
    return Boolean(t.meta?.imapUid);
  }

  useEffect(() => {
    if (!cloudEnabled) return;
    const tick = window.setInterval(() => {
      void reloadAll();
    }, 60_000);
    return () => window.clearInterval(tick);
  }, [cloudEnabled, reloadAll]);

  async function openThread(t: CrmInboxThread) {
    setActiveThread({ ...t, unread: false });
    if (!isCloudCrmMailThread(t.id)) return;

    await patchCrmInboxThread(t.id, { unread: false });

    if (needsBodyLoad(t)) {
      setLoadingBody(true);
      try {
        await fetchCrmMailBody(t.id);
      } catch (err) {
        showToast(
          formatCrmMailError(err instanceof Error ? err.message : 'Brak treści'),
          'error',
          8000,
        );
      } finally {
        setLoadingBody(false);
      }
    }

    await reloadAll();
  }

  async function handleSendReply() {
    if (!activeThread || !replyDraft.trim()) return;
    setSending(true);
    try {
      if (!isCloudCrmMailThread(activeThread.id)) {
        showToast('Tylko wiadomości z podłączonej skrzynki', 'warn');
        return;
      }
      await sendCrmMailReply(activeThread.id, replyDraft.trim());
      showToast('Wysłano e-mail', 'ok');
      setReplyDraft('');
      await reloadAll();
      onInboxChange?.();
    } catch (err) {
      showToast(formatCrmMailError(err instanceof Error ? err.message : 'Wysyłka nieudana'), 'error', 9000);
    } finally {
      setSending(false);
    }
  }

  if (!cloudEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
        Zaloguj się, żeby podłączyć skrzynkę e-mail.
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 pb-10">
      <CrmMailboxPanel
        onSynced={() => {
          void reloadAll().then(() => onInboxChange?.());
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-50 sm:text-xl">Skrzynka</h1>
          <p className="text-xs text-slate-500 sm:text-sm">
            Lista odświeża się co minutę. Nowe maile wpadają przez sync serwera (Harmonogram co
            5 min) — jak w Outlook, treść w HTML gdy dostępna.
          </p>
        </div>
        {loadingCloud && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
        {unread > 0 && (
          <span className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-300">
            {unread} nieprzeczytanych
          </span>
        )}
      </div>

      <InboxFilterBar active={filter} onChange={setFilter} counts={counts} />

      <div className="grid min-h-[calc(100dvh-14rem)] gap-3 lg:grid-cols-5 lg:gap-4">
        <ul className="space-y-1 lg:col-span-2">
          {filtered.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-500">
              Brak wiadomości — u góry kliknij „Połącz i pobierz pocztę” lub „Odśwież”.
            </li>
          ) : (
            filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => void openThread(t)}
                  className={`flex w-full gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    activeThread?.id === t.id
                      ? 'border-brand-500/40 bg-brand-500/10'
                      : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                  }`}
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800">
                    <Mail className="h-4 w-4 text-sky-400" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {t.unread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      )}
                      {t.replied && <InboxRepliedIcon />}
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${t.unread ? 'font-semibold text-slate-50' : 'font-medium text-slate-200'}`}
                      >
                        {t.from}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-600">
                        {formatInboxDate(t.createdAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400">
                      {t.subject}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-600">
                      {t.preview}
                    </span>
                    {t.category && (
                      <span className="mt-1.5 inline-block">
                        <InboxCategoryBadge category={t.category} />
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex min-h-[calc(100dvh-14rem)] flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-3">
          {!activeThread ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-500">Wybierz wiadomość</p>
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-slate-800 pb-3">
                <p className="text-sm font-semibold text-slate-100">{activeThread.subject}</p>
                <p className="mt-0.5 text-xs text-slate-500">{activeThread.from}</p>
                {activeThread.clientName && onOpenClient && (
                  <button
                    type="button"
                    onClick={() => onOpenClient(activeThread.clientName!)}
                    className="mt-2 rounded-lg border border-brand-500/40 px-2 py-1 text-xs text-brand-200"
                  >
                    Otwórz w CRM
                  </button>
                )}
                {activeThread.sku && onOpenOrderSku && (
                  <button
                    type="button"
                    onClick={() => onOpenOrderSku(activeThread.sku!)}
                    className="mt-2 block font-mono text-xs text-brand-400 hover:underline"
                  >
                    SKU {activeThread.sku}
                  </button>
                )}
              </div>

              <div className="mt-3 min-h-[min(62vh,720px)] shrink-0 overflow-y-auto rounded-lg border border-slate-800/80 bg-slate-950/30 p-2">
                {loadingBody ? (
                  <span className="inline-flex items-center gap-2 text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Pobieram treść…
                  </span>
                ) : (
                  <CrmMailMessageBody
                    body={activeThread.body}
                    bodyHtml={activeThread.bodyHtml}
                  />
                )}
                {!loadingBody &&
                  !activeThread.bodyHtml &&
                  !activeThread.body?.trim() && (
                    <span className="text-sm text-slate-500">
                      Brak treści — odśwież skrzynkę lub poczekaj na sync serwera.
                    </span>
                  )}
              </div>

              <div className="mt-3 shrink-0 space-y-2 border-t border-slate-800 pt-3">
                <label className="block text-xs font-medium text-slate-400">Odpowiedź</label>
                <div className="flex gap-2">
                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    rows={4}
                    placeholder="Odpowiedź e-mail…"
                    className="input-field min-h-[5.5rem] flex-1 resize-y text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendReply()}
                    disabled={!replyDraft.trim() || sending}
                    className="inline-flex shrink-0 items-center gap-1 self-start rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Wyślij
                  </button>
                </div>
              </div>

              <div className="mt-3 shrink-0 border-t border-slate-800 pt-3">
                <InboxCategoryPicker
                  value={activeThread.category}
                  onChange={(cat) => {
                    void patchCrmInboxThread(activeThread.id, {
                      category: cat ?? undefined,
                    }).then(() => reloadAll());
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
