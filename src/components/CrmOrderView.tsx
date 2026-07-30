import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCopy,
  FileDown,
  History,
  Loader2,
  Minus,
  Plus,
  Save,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Users,
} from 'lucide-react';
import {
  clearOrderDraft,
  formatOrderDraftMessage,
  formatOrderDraftSkuList,
  getOrderDraft,
  printOrderDraftPdf,
  removeDraftItem,
  saveOrderDraft,
  sendOrderDraftToDiscord,
  type OrderDraft,
} from '../lib/orderDraft';
import {
  crmErrorMessage,
  fetchCrmClients,
  isValidNip,
  lookupNip,
  normalizeNip,
  saveCrmOrder,
  upsertCrmClient,
  type CrmClient,
} from '../lib/crm';
import { getProductImage } from '../lib/products';
import { showToast } from '../lib/toast';
import type { Product } from '../types';
import { CrmClientsPanel } from './CrmClientsPanel';
import { CrmHistoryPanel } from './CrmHistoryPanel';

type CrmTab = 'current' | 'clients' | 'history';

interface CrmOrderViewProps {
  authorLabel: string;
  products?: Product[];
  cloudEnabled?: boolean;
  onChanged?: () => void;
}

export function CrmOrderView({
  authorLabel,
  products = [],
  cloudEnabled = false,
  onChanged,
}: CrmOrderViewProps) {
  const [tab, setTab] = useState<CrmTab>('current');
  const [draft, setDraft] = useState<OrderDraft>(() => getOrderDraft());
  const [sending, setSending] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [clientSuggestOpen, setClientSuggestOpen] = useState(false);
  const [nipOpen, setNipOpen] = useState(false);
  const [nipValue, setNipValue] = useState('');
  const [nipBusy, setNipBusy] = useState(false);
  const [nipForm, setNipForm] = useState<{
    nip: string;
    legalName: string;
    address: string;
    displayName: string;
  } | null>(null);
  const hasWebhook = Boolean(import.meta.env.VITE_DISCORD_ORDERS_WEBHOOK);

  useEffect(() => {
    setDraft(getOrderDraft());
  }, []);

  useEffect(() => {
    if (!cloudEnabled) {
      setClients([]);
      return;
    }
    void fetchCrmClients()
      .then(setClients)
      .catch(() => setClients([]));
  }, [cloudEnabled, tab]);

  const clientSuggestions = useMemo(() => {
    const s = draft.clientName.trim().toLowerCase();
    if (s.length < 1) return clients.slice(0, 8);
    return clients
      .filter(
        (c) =>
          c.displayName.toLowerCase().includes(s) ||
          (c.legalName || '').toLowerCase().includes(s) ||
          (c.nip || '').includes(s.replace(/\D/g, '')),
      )
      .slice(0, 8);
  }, [clients, draft.clientName]);

  function itemImage(item: OrderDraft['items'][number]): string | undefined {
    if (item.imageUrl) return item.imageUrl;
    const p =
      products.find((x) => x.id === item.productId) ||
      products.find((x) => x.sku === item.sku);
    return p ? getProductImage(p) || undefined : undefined;
  }

  /** Preferuj konkretne SKU wariantów zamiast GROUP-… */
  function resolveSku(item: OrderDraft['items'][number]): string {
    const p =
      products.find((x) => x.id === item.productId) ||
      products.find((x) => x.sku === item.sku);
    if (p?.isGroup && p.variants?.length) {
      return p.variants.map((v) => v.sku).filter(Boolean).join(', ') || item.sku;
    }
    return item.sku;
  }

  function apply(next: OrderDraft) {
    saveOrderDraft(next);
    setDraft(getOrderDraft());
    onChanged?.();
  }

  function updateMeta(
    patch: Partial<Pick<OrderDraft, 'clientName' | 'note' | 'clientId' | 'kind'>>,
  ) {
    apply({ ...draft, ...patch });
  }

  function pickClient(c: CrmClient) {
    apply({
      ...draft,
      clientName: c.displayName,
      clientId: c.id,
    });
    setClientSuggestOpen(false);
    setTab('current');
    showToast(`Klient: ${c.displayName}`, 'ok', 1400);
  }

  function bumpQty(productId: string, delta: number) {
    const items = draft.items
      .map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.max(0, i.quantity + delta) }
          : i,
      )
      .filter((i) => i.quantity > 0);
    apply({ ...draft, items });
  }

  function setQty(productId: string, raw: string) {
    const n = Math.max(0, Math.round(Number(raw) || 0));
    const items = draft.items
      .map((i) => (i.productId === productId ? { ...i, quantity: n } : i))
      .filter((i) => i.quantity > 0);
    apply({ ...draft, items });
  }

  async function ensureClientId(): Promise<string | undefined> {
    if (draft.clientId) return draft.clientId;
    const name = draft.clientName.trim();
    if (!cloudEnabled || !name) return undefined;
    const existing = clients.find(
      (c) => c.displayName.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.id;
    try {
      const created = await upsertCrmClient({ displayName: name });
      setClients((prev) =>
        [...prev, created].sort((a, b) =>
          a.displayName.localeCompare(b.displayName, 'pl'),
        ),
      );
      apply({ ...getOrderDraft(), clientId: created.id });
      return created.id;
    } catch {
      return undefined;
    }
  }

  async function persistHistory(status: 'sent' | 'saved'): Promise<boolean> {
    if (!cloudEnabled) return false;
    if (!draft.items.length) return false;
    try {
      const clientId = await ensureClientId();
      await saveCrmOrder({
        draft: getOrderDraft(),
        clientId,
        status,
      });
      return true;
    } catch (err) {
      showToast(
        crmErrorMessage(err),
        'warn',
        5000,
      );
      return false;
    }
  }

  async function copyText() {
    const text = formatOrderDraftMessage(draft, authorLabel);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Skopiowano zamówienie', 'ok');
    } catch {
      showToast('Nie udało się skopiować', 'error');
    }
  }

  async function copySkuList() {
    if (!draft.items.length) {
      showToast('Brak pozycji', 'warn');
      return;
    }
    try {
      await navigator.clipboard.writeText(formatOrderDraftSkuList(draft));
      showToast('Skopiowano listę SKU (sku;ilość)', 'ok');
    } catch {
      showToast('Nie udało się skopiować', 'error');
    }
  }

  async function saveToHistoryOnly() {
    if (!draft.items.length) {
      showToast('Dodaj produkty do zamówienia', 'warn');
      return;
    }
    if (!cloudEnabled) {
      showToast('Zaloguj się, żeby zapisać historię', 'warn');
      return;
    }
    setSavingHistory(true);
    try {
      const ok = await persistHistory('saved');
      if (ok) showToast('Zapisano w historii', 'ok');
    } finally {
      setSavingHistory(false);
    }
  }

  async function sendDiscord() {
    if (!draft.items.length) {
      showToast('Dodaj produkty do zamówienia', 'warn');
      return;
    }
    if (!hasWebhook) {
      await copyText();
      if (cloudEnabled) await persistHistory('saved');
      showToast('Brak Discord — skopiowano (i zapisano jeśli zalogowany)', 'warn', 4000);
      return;
    }
    setSending(true);
    try {
      const enriched = {
        ...draft,
        items: draft.items.map((i) => ({
          ...i,
          sku: resolveSku(i),
          imageUrl: itemImage(i),
        })),
      };
      const res = await sendOrderDraftToDiscord(enriched, authorLabel);
      if (!res.ok) {
        showToast(res.error || 'Wysyłka nieudana', 'error');
        return;
      }
      await persistHistory('sent');
      clearOrderDraft();
      setDraft(getOrderDraft());
      onChanged?.();
      showToast('Wysłano na Discord i zapisano w historii', 'ok');
    } finally {
      setSending(false);
    }
  }

  async function runNipLookup() {
    const nip = normalizeNip(nipValue);
    if (!isValidNip(nip)) {
      showToast('Wpisz poprawny NIP (10 cyfr)', 'warn');
      return;
    }
    setNipBusy(true);
    try {
      const res = await lookupNip(nip);
      setNipForm({
        nip: res.nip,
        legalName: res.legalName,
        address: res.address,
        displayName: res.legalName,
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd NIP', 'error');
    } finally {
      setNipBusy(false);
    }
  }

  async function saveNipClient() {
    if (!nipForm?.displayName.trim()) {
      showToast('Podaj nazwę klienta', 'warn');
      return;
    }
    if (!cloudEnabled) {
      apply({
        ...draft,
        clientName: nipForm.displayName.trim(),
        clientId: undefined,
      });
      setNipOpen(false);
      setNipForm(null);
      setNipValue('');
      showToast('Ustawiono klienta (bez zapisu w chmurze)', 'ok');
      return;
    }
    try {
      const saved = await upsertCrmClient({
        displayName: nipForm.displayName,
        legalName: nipForm.legalName,
        nip: nipForm.nip,
        address: nipForm.address,
      });
      setClients((prev) => {
        const without = prev.filter((c) => c.id !== saved.id);
        return [...without, saved].sort((a, b) =>
          a.displayName.localeCompare(b.displayName, 'pl'),
        );
      });
      pickClient(saved);
      setNipOpen(false);
      setNipForm(null);
      setNipValue('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd zapisu klienta', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
        <ShoppingCart className="h-5 w-5 text-brand-400" />
        Zamówienie
      </h2>

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1 ring-1 ring-slate-800">
        <TabBtn active={tab === 'current'} onClick={() => setTab('current')} icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Aktualne" />
        <TabBtn active={tab === 'clients'} onClick={() => setTab('clients')} icon={<Users className="h-3.5 w-3.5" />} label="Klienci" />
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={<History className="h-3.5 w-3.5" />} label="Historia" />
      </div>

      {tab === 'clients' && (
        <CrmClientsPanel cloudEnabled={cloudEnabled} onPickClient={pickClient} />
      )}

      {tab === 'history' && (
        <CrmHistoryPanel
          cloudEnabled={cloudEnabled}
          authorLabel={authorLabel}
          onReuse={(next) => {
            apply(next);
            setTab('current');
          }}
        />
      )}

      {tab === 'current' && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900 p-1 ring-1 ring-slate-800">
            <button
              type="button"
              onClick={() => updateMeta({ kind: 'order' })}
              className={`rounded-lg py-2 text-xs font-medium transition ${
                draft.kind !== 'quote'
                  ? 'bg-brand-500/20 text-brand-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Zamówienie
            </button>
            <button
              type="button"
              onClick={() => updateMeta({ kind: 'quote' })}
              className={`rounded-lg py-2 text-xs font-medium transition ${
                draft.kind === 'quote'
                  ? 'bg-amber-500/20 text-amber-200'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Prośba o ofertę
            </button>
          </div>

          <div className="relative">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">Klient</span>
              {cloudEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    setNipOpen(true);
                    setNipForm(null);
                    setNipValue('');
                  }}
                  className="text-xs font-medium text-brand-400 hover:text-brand-300"
                >
                  Po NIP
                </button>
              )}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={draft.clientName}
                onChange={(e) => {
                  updateMeta({ clientName: e.target.value, clientId: undefined });
                  setClientSuggestOpen(true);
                }}
                onFocus={() => setClientSuggestOpen(true)}
                onBlur={() => setTimeout(() => setClientSuggestOpen(false), 150)}
                placeholder="Nazwa firmy / kontakt"
                className="input-field with-icon"
              />
            </div>
            {clientSuggestOpen && cloudEnabled && clientSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                {clientSuggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-800"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickClient(c)}
                    >
                      <span className="text-sm text-slate-100">{c.displayName}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {c.nip || 'bez NIP'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="block">
            <span className="mb-1 text-xs text-slate-500">Notatka</span>
            <textarea
              value={draft.note}
              onChange={(e) => updateMeta({ note: e.target.value })}
              rows={2}
              placeholder="Termin, uwagi, adres…"
              className="input-field resize-none"
            />
          </label>

          {!draft.items.length ? (
            <div className="rounded-2xl border border-dashed border-slate-700 py-12 text-center">
              <ShoppingCart className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-slate-400">Brak pozycji</p>
              <p className="mt-1 text-sm text-slate-500">
                Użyj zielonego + na karcie albo „Do zamówienia” w produkcie
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {draft.items.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-2"
                >
                  {itemImage(item) ? (
                    <img
                      src={itemImage(item)}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg object-contain bg-slate-800"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] text-slate-500">
                      —
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {item.displayName}
                    </p>
                    <p className="font-mono text-xs text-brand-400">{item.sku}</p>
                    {item.fromKit && (
                      <p className="truncate text-[10px] text-slate-500">
                        zestaw: {item.fromKit}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-700 p-1.5 text-slate-300"
                      onClick={() => bumpQty(item.productId, -1)}
                      aria-label="Mniej"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      defaultValue={item.quantity}
                      key={`${item.productId}-${item.quantity}`}
                      onBlur={(e) => setQty(item.productId, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      className="w-10 rounded-md border border-slate-700 bg-slate-950 py-1 text-center text-sm font-semibold text-slate-100"
                    />
                    <button
                      type="button"
                      className="rounded-lg border border-slate-700 p-1.5 text-slate-300"
                      onClick={() => bumpQty(item.productId, 1)}
                      aria-label="Więcej"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-slate-500 hover:text-red-400"
                      onClick={() => {
                        removeDraftItem(item.productId);
                        setDraft(getOrderDraft());
                        onChanged?.();
                      }}
                      aria-label="Usuń"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void copyText()}
              disabled={!draft.items.length}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-200 disabled:opacity-50"
            >
              <ClipboardCopy className="h-4 w-4" />
              Kopiuj
            </button>
            <button
              type="button"
              onClick={() => void copySkuList()}
              disabled={!draft.items.length}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-200 disabled:opacity-50"
              title="Format pod WAPRO: SKU;ilość"
            >
              <ClipboardCopy className="h-4 w-4" />
              SKU
            </button>
            <button
              type="button"
              onClick={() => {
                printOrderDraftPdf(
                  {
                    ...draft,
                    items: draft.items.map((i) => ({
                      ...i,
                      imageUrl: itemImage(i),
                    })),
                  },
                  authorLabel,
                );
                showToast('Otwarto podgląd PDF / druku', 'info');
              }}
              disabled={!draft.items.length}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-200 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" />
              PDF / druk
            </button>
            {cloudEnabled && (
              <button
                type="button"
                onClick={() => void saveToHistoryOnly()}
                disabled={!draft.items.length || savingHistory}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-200 disabled:opacity-50"
              >
                {savingHistory ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Zapisz
              </button>
            )}
            <button
              type="button"
              onClick={() => void sendDiscord()}
              disabled={!draft.items.length || sending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Wysyłam…' : 'Discord'}
            </button>
          </div>

          {draft.items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                clearOrderDraft();
                setDraft(getOrderDraft());
                onChanged?.();
                showToast('Wyczyszczono zamówienie', 'info');
              }}
              className="w-full text-center text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
            >
              Wyczyść zamówienie
            </button>
          )}
        </>
      )}

      {nipOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setNipOpen(false)}
        >
          <div
            className="animate-fade-in w-full max-w-lg rounded-t-3xl border border-slate-700 bg-slate-900 p-4 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 font-semibold text-slate-100">Klient po NIP</h3>
            {!nipForm ? (
              <div className="space-y-3">
                <input
                  value={nipValue}
                  onChange={(e) => setNipValue(e.target.value)}
                  placeholder="NIP (10 cyfr)"
                  className="input-field font-mono"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  disabled={nipBusy}
                  onClick={() => void runNipLookup()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {nipBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Szukaj w białej liście VAT
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  NIP {nipForm.nip} — możesz zmienić nazwę u siebie
                </p>
                <label className="block">
                  <span className="mb-1 text-xs text-slate-500">Nazwa u Ciebie</span>
                  <input
                    value={nipForm.displayName}
                    onChange={(e) =>
                      setNipForm((p) => (p ? { ...p, displayName: e.target.value } : p))
                    }
                    className="input-field"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 text-xs text-slate-500">Nazwa formalna</span>
                  <input
                    value={nipForm.legalName}
                    onChange={(e) =>
                      setNipForm((p) => (p ? { ...p, legalName: e.target.value } : p))
                    }
                    className="input-field"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 text-xs text-slate-500">Adres</span>
                  <input
                    value={nipForm.address}
                    onChange={(e) =>
                      setNipForm((p) => (p ? { ...p, address: e.target.value } : p))
                    }
                    className="input-field"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveNipClient()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white"
                >
                  Zapisz i wybierz
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium transition ${
        active
          ? 'bg-brand-500/20 text-brand-200'
          : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
