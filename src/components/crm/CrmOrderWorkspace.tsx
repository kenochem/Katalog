import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../../types';
import type { CrmClient } from '../../lib/crm';
import { crmErrorMessage, nextQuoteNumber, saveCrmOrder, upsertCrmClient } from '../../lib/crm';
import {
  addToOrderDraft,
  clearOrderDraft,
  formatOrderDraftMessage,
  formatOrderDraftSkuList,
  getOrderDraft,
  printOrderDraftPdf,
  removeDraftItem,
  saveOrderDraft,
  sendOrderDraftToDiscord,
  setDraftItemQty,
  type OrderDraft,
} from '../../lib/orderDraft';
import { buildQuoteHtml, openQuoteDocument } from '../../lib/quotePdf';
import { getProductImage } from '../../lib/products';
import { formatPricePln } from '../../lib/format';
import { showToast } from '../../lib/toast';
import { ActiveClientBar } from './ActiveClientBar';
import {
  CrmOrderCartMobileBar,
  CrmOrderCartPanel,
} from './CrmOrderCartPanel';
import { CrmCatalogEmbed } from './CrmCatalogEmbed';
import { CrmQuoteEditor } from './CrmQuoteEditor';
import { CrmClientEditModal } from './CrmClientEditModal';

type OrderPhase = 'browse' | 'quote';

interface CrmOrderWorkspaceProps {
  authorLabel: string;
  products: Product[];
  clients: CrmClient[];
  cloudEnabled: boolean;
  onChanged?: () => void;
  onClientsChange: (clients: CrmClient[]) => void;
  onOpenCatalog?: () => void;
  clientPickerSignal?: number;
  onRefreshClients?: () => Promise<void> | void;
  refreshingClients?: boolean;
}

export function CrmOrderWorkspace({
  authorLabel,
  products,
  clients,
  cloudEnabled,
  onChanged,
  onClientsChange,
  onOpenCatalog,
  clientPickerSignal = 0,
  onRefreshClients,
  refreshingClients,
}: CrmOrderWorkspaceProps) {
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [draft, setDraft] = useState<OrderDraft>(() => getOrderDraft());
  const [phase, setPhase] = useState<OrderPhase>(() =>
    getOrderDraft().kind === 'quote' && getOrderDraft().items.length > 0 ? 'quote' : 'browse',
  );
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<{ html: string; number: string } | null>(
    null,
  );
  const hasWebhook = Boolean(import.meta.env.VITE_DISCORD_ORDERS_WEBHOOK);

  useEffect(() => {
    setDraft(getOrderDraft());
  }, []);

  const productBySku = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) {
      m.set(p.sku.toUpperCase(), p);
      m.set(p.id, p);
    }
    return m;
  }, [products]);

  const catalogNetBySku = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      if (p.priceSaleNet != null) m.set(p.sku.toUpperCase(), p.priceSaleNet);
    }
    return m;
  }, [products]);

  const activeClient = useMemo(() => {
    if (draft.clientId) return clients.find((c) => c.id === draft.clientId) ?? null;
    const name = draft.clientName.trim().toLowerCase();
    if (!name) return null;
    return clients.find((c) => c.displayName.toLowerCase() === name) ?? null;
  }, [clients, draft.clientId, draft.clientName]);

  const draftTotal = useMemo(() => {
    let sum = 0;
    for (const item of draft.items) {
      const p = productBySku.get(item.sku.toUpperCase());
      const price = item.unitPriceNet ?? p?.priceSaleNet ?? 0;
      sum += price * item.quantity;
    }
    return sum;
  }, [draft.items, productBySku]);

  const draftQty = useMemo(
    () => draft.items.reduce((s, d) => s + d.quantity, 0),
    [draft.items],
  );

  const orderQtys = useMemo(
    () => Object.fromEntries(draft.items.map((i) => [i.productId, i.quantity])),
    [draft.items],
  );

  function sync(next: OrderDraft) {
    saveOrderDraft(next);
    setDraft(getOrderDraft());
    onChanged?.();
  }

  function selectClient(c: CrmClient) {
    sync({
      ...getOrderDraft(),
      clientName: c.displayName,
      clientId: c.id,
    });
    showToast(`Wybrano klienta: ${c.displayName}`, 'ok');
  }

  function clearClient() {
    sync({
      ...getOrderDraft(),
      clientName: '',
      clientId: undefined,
    });
    showToast('Usunięto przypisanie klienta', 'info');
  }

  function handleOrderDelta(product: Product, delta: number) {
    if (delta > 0) {
      addToOrderDraft(
        {
          ...product,
          imageUrl: getProductImage(product) || undefined,
        },
        delta,
      );
    } else {
      const current = getOrderDraft().items.find((i) => i.productId === product.id);
      if (!current) return;
      const next = current.quantity + delta;
      if (next <= 0) removeDraftItem(product.id);
      else setDraftItemQty(product.id, next);
    }
    sync(getOrderDraft());
  }

  function goToQuote() {
    if (!draft.items.length) {
      showToast('Dodaj produkty do koszyka', 'warn');
      return;
    }
    sync({
      ...getOrderDraft(),
      kind: 'quote',
      discountPct: getOrderDraft().discountPct ?? 0,
      quoteValidDays: getOrderDraft().quoteValidDays ?? 14,
    });
    setPhase('quote');
    setMobileCartOpen(false);
  }

  function goToBrowse() {
    setPhase('browse');
    setGeneratedQuote(null);
  }

  async function ensureClientId(): Promise<string | undefined> {
    const current = getOrderDraft();
    if (current.clientId) return current.clientId;
    const name = current.clientName.trim();
    if (!cloudEnabled || !name) return undefined;
    const existing = clients.find(
      (c) => c.displayName.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.id;
    try {
      const created = await upsertCrmClient({ displayName: name });
      onClientsChange(
        [...clients, created].sort((a, b) =>
          a.displayName.localeCompare(b.displayName, 'pl'),
        ),
      );
      sync({ ...getOrderDraft(), clientId: created.id });
      return created.id;
    } catch {
      return undefined;
    }
  }

  /** Historia CRM tylko dla zamówień — oferty PDF nie zapisujemy. */
  async function persistOrderHistory(status: 'sent' | 'saved'): Promise<boolean> {
    if (!cloudEnabled || !draft.items.length || draft.kind === 'quote') return false;
    try {
      const clientId = await ensureClientId();
      const current = getOrderDraft();
      const items = current.items.map((i) => {
        const p = productBySku.get(i.sku.toUpperCase());
        return {
          ...i,
          unitPriceNet: i.unitPriceNet ?? p?.priceSaleNet ?? null,
          unitPriceGross: i.unitPriceGross ?? p?.priceSaleGross ?? null,
        };
      });
      await saveCrmOrder({
        draft: { ...current, items, kind: 'order' },
        clientId,
        status,
      });
      return true;
    } catch (err) {
      showToast(crmErrorMessage(err), 'warn', 5000);
      return false;
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(formatOrderDraftMessage(draft, authorLabel));
      showToast('Skopiowano', 'ok');
    } catch {
      showToast('Nie udało się skopiować', 'error');
    }
  }

  async function copySku() {
    if (!draft.items.length) return;
    try {
      await navigator.clipboard.writeText(formatOrderDraftSkuList(draft));
      showToast('Skopiowano SKU', 'ok');
    } catch {
      showToast('Błąd kopiowania', 'error');
    }
  }

  function openOrderPdf() {
    printOrderDraftPdf(
      {
        ...draft,
        kind: 'order',
        items: draft.items.map((i) => {
          const p = productBySku.get(i.sku.toUpperCase());
          return {
            ...i,
            imageUrl: i.imageUrl ?? (p ? getProductImage(p) : undefined) ?? undefined,
          };
        }),
      },
      authorLabel,
    );
    showToast('Podgląd PDF / druku', 'info');
  }

  async function generateQuotePdf() {
    if (!draft.clientName.trim() && !activeClient) {
      showToast('Uzupełnij nazwę klienta przed PDF', 'warn');
      return;
    }
    setGeneratingQuote(true);
    try {
      const number = await nextQuoteNumber();
      const html = buildQuoteHtml(
        {
          ...draft,
          kind: 'quote',
          items: draft.items.map((i) => {
            const p = productBySku.get(i.sku.toUpperCase());
            return {
              ...i,
              imageUrl: i.imageUrl ?? (p ? getProductImage(p) : undefined) ?? undefined,
            };
          }),
        },
        authorLabel,
        catalogNetBySku,
        number,
        activeClient ? { address: activeClient.address, nip: activeClient.nip } : undefined,
      );
      setGeneratedQuote({ html, number });
      openQuoteDocument(html);
      showToast(`Oferta ${number} wygenerowana`, 'ok');
    } finally {
      setGeneratingQuote(false);
    }
  }

  async function saveHistoryOnly() {
    if (!draft.items.length) {
      showToast('Koszyk pusty', 'warn');
      return;
    }
    setSaving(true);
    try {
      if (await persistOrderHistory('saved')) showToast('Zapisano zamówienie w historii', 'ok');
    } finally {
      setSaving(false);
    }
  }

  async function sendDiscord() {
    if (!draft.items.length) {
      showToast('Koszyk pusty', 'warn');
      return;
    }
    const orderDraft = { ...draft, kind: 'order' as const };
    if (!hasWebhook) {
      await copyText();
      await persistOrderHistory('saved');
      showToast('Brak Discord — skopiowano', 'warn', 4000);
      return;
    }
    setSending(true);
    try {
      const enriched = {
        ...orderDraft,
        items: orderDraft.items.map((i) => {
          const p = productBySku.get(i.sku.toUpperCase());
          return {
            ...i,
            imageUrl: i.imageUrl ?? (p ? getProductImage(p) : undefined) ?? undefined,
          };
        }),
      };
      const res = await sendOrderDraftToDiscord(enriched, authorLabel);
      if (!res.ok) {
        showToast(res.error || 'Wysyłka nieudana', 'error');
        return;
      }
      await persistOrderHistory('sent');
      clearOrderDraft();
      sync(getOrderDraft());
      setPhase('browse');
      showToast('Wysłano zamówienie na Discord', 'ok');
    } finally {
      setSending(false);
    }
  }

  function clearAll() {
    clearOrderDraft();
    sync(getOrderDraft());
    setPhase('browse');
    setGeneratedQuote(null);
    showToast('Wyczyszczono koszyk', 'info');
  }

  useEffect(() => {
    if (draft.items.length === 0) {
      setMobileCartOpen(false);
      setPhase('browse');
    }
  }, [draft.items.length]);

  if (phase === 'quote') {
    return (
      <div className="space-y-4">
        {cloudEnabled && (
          <ActiveClientBar
            clients={clients}
            activeClient={activeClient}
            onSelect={selectClient}
            onClear={clearClient}
            openSignal={clientPickerSignal}
            onAddClient={() => setAddClientOpen(true)}
            onRefresh={onRefreshClients}
            refreshing={refreshingClients}
          />
        )}
        <CrmQuoteEditor
          draft={draft}
          productBySku={productBySku}
          activeClient={activeClient}
          authorLabel={authorLabel}
          onSync={sync}
          onBack={goToBrowse}
          onGeneratePdf={() => void generateQuotePdf()}
          generatingQuote={generatingQuote}
          generatedQuote={generatedQuote}
          onPreviewQuote={() => generatedQuote && openQuoteDocument(generatedQuote.html)}
          onDownloadQuote={() => generatedQuote && openQuoteDocument(generatedQuote.html, true)}
          onClear={clearAll}
        />
        <CrmClientEditModal
          initial={addClientOpen ? { tags: [] } : null}
          onClose={() => setAddClientOpen(false)}
          onSaved={(saved) => {
            onClientsChange([...clients, saved]);
            selectClient(saved);
            setAddClientOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">Katalog i koszyk</h2>
        <p className="mt-1 text-sm text-slate-400">
          Dodaj produkty, potem przygotuj ofertę PDF albo wyślij zamówienie na Discord.
        </p>
      </div>

      {cloudEnabled && (
        <ActiveClientBar
          clients={clients}
          activeClient={activeClient}
          onSelect={selectClient}
          onClear={clearClient}
          openSignal={clientPickerSignal}
          onAddClient={() => setAddClientOpen(true)}
          onRefresh={onRefreshClients}
          refreshing={refreshingClients}
        />
      )}

      {draftQty > 0 && (
        <div className="crm-alert-banner flex flex-wrap items-center gap-2 px-4 py-3">
          <p className="flex-1 text-sm font-medium">
            <span className="font-semibold">{draftQty} szt.</span> w koszyku ·{' '}
            {formatPricePln(draftTotal)} netto
          </p>
          <button
            type="button"
            onClick={goToQuote}
            className="crm-btn-offer px-4 py-2"
          >
            Przygotuj ofertę PDF →
          </button>
        </div>
      )}

      <div
        className={`crm-order-shell ${draftQty > 0 ? 'pb-[calc(8.5rem+env(safe-area-inset-bottom))] lg:pb-4' : 'pb-4'}`}
      >
        <div className="crm-order-grid lg:grid lg:grid-cols-[minmax(0,1fr)_min(22rem,32%)] lg:items-start lg:gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-3">
            <CrmCatalogEmbed
              products={products}
              orderQtys={orderQtys}
              onOrderDelta={handleOrderDelta}
              onOrderDraftChange={() => sync(getOrderDraft())}
              className="lg:max-h-[calc(100dvh-10rem)]"
            />
            {onOpenCatalog && (
              <button
                type="button"
                onClick={onOpenCatalog}
                className="w-full rounded-xl border border-dashed border-slate-700 py-2 text-xs text-slate-500 hover:border-slate-600 hover:text-slate-300"
              >
                Otwórz katalog na pełnym ekranie
              </button>
            )}
          </div>

          <aside className="crm-order-cart-aside mt-4 hidden lg:sticky lg:top-3 lg:mt-0 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:min-h-[420px] lg:flex-col">
            <CrmOrderCartPanel
              draft={draft}
              draftTotal={draftTotal}
              productBySku={productBySku}
              activeClient={activeClient}
              onSync={sync}
              onCopy={() => void copyText()}
              onCopySku={() => void copySku()}
              onPdf={openOrderPdf}
              onSaveHistory={() => void saveHistoryOnly()}
              onSendDiscord={() => void sendDiscord()}
              onGoToQuote={goToQuote}
              saving={saving}
              sending={sending}
              className="h-full max-h-[calc(100dvh-7rem)]"
            />
          </aside>
        </div>

        {mobileCartOpen && draftQty > 0 && (
          <div
            className="fixed inset-0 z-[60] bg-black/50 lg:hidden"
            onClick={() => setMobileCartOpen(false)}
            aria-hidden
          />
        )}

        <div
          className={`fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[65] flex max-h-[min(68vh,30rem)] flex-col px-2 transition-transform duration-300 lg:hidden ${
            mobileCartOpen ? 'translate-y-0' : 'pointer-events-none translate-y-full'
          }`}
        >
          <CrmOrderCartPanel
            draft={draft}
            draftTotal={draftTotal}
            productBySku={productBySku}
            activeClient={activeClient}
            onSync={sync}
            onCopy={() => void copyText()}
            onCopySku={() => void copySku()}
            onPdf={openOrderPdf}
            onSaveHistory={() => void saveHistoryOnly()}
            onSendDiscord={() => void sendDiscord()}
            onGoToQuote={goToQuote}
            saving={saving}
            sending={sending}
            onClose={() => setMobileCartOpen(false)}
            className="max-h-[min(72vh,32rem)] shadow-2xl"
          />
        </div>

        <CrmOrderCartMobileBar
          qty={draftQty}
          total={draftTotal}
          open={mobileCartOpen}
          onToggle={() => setMobileCartOpen((v) => !v)}
        />
      </div>
      <CrmClientEditModal
        initial={addClientOpen ? { tags: [] } : null}
        onClose={() => setAddClientOpen(false)}
        onSaved={(saved) => {
          onClientsChange([...clients, saved]);
          selectClient(saved);
          setAddClientOpen(false);
        }}
      />
    </div>
  );
}
