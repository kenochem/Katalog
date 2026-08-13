import { useEffect, useMemo, useState } from 'react';
import type { Product } from '../../types';
import type { CrmClient } from '../../lib/crm';
import {
  crmErrorMessage,
  saveCrmOrder,
  upsertCrmClient,
} from '../../lib/crm';
import {
  addToOrderDraft,
  clearOrderDraft,
  formatOrderDraftMessage,
  formatOrderDraftSkuList,
  getOrderDraft,
  printOrderDraftPdf,
  saveOrderDraft,
  sendOrderDraftToDiscord,
  type OrderDraft,
} from '../../lib/orderDraft';
import { getProductImage } from '../../lib/products';
import { formatPricePln } from '../../lib/format';
import { showToast } from '../../lib/toast';
import { appendClientTimeline } from '../../lib/crmClientTimeline';
import { ActiveClientBar } from './ActiveClientBar';
import { CrmTaskHeader } from './CrmTaskHeader';
import {
  CrmOrderCartMobileBar,
  CrmOrderCartPanel,
} from './CrmOrderCartPanel';
import { OrderProductPicker } from './OrderProductPicker';

interface CrmOrderWorkspaceProps {
  authorLabel: string;
  products: Product[];
  clients: CrmClient[];
  cloudEnabled: boolean;
  onChanged?: () => void;
  onClientsChange: (clients: CrmClient[]) => void;
  onBack: () => void;
  onOpenCatalog?: () => void;
  clientPickerSignal?: number;
}

export function CrmOrderWorkspace({
  authorLabel,
  products,
  clients,
  cloudEnabled,
  onChanged,
  onClientsChange,
  onBack,
  onOpenCatalog,
  clientPickerSignal = 0,
}: CrmOrderWorkspaceProps) {
  const [draft, setDraft] = useState<OrderDraft>(() => getOrderDraft());
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
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
  }

  function clearClient() {
    sync({
      ...getOrderDraft(),
      clientName: '',
      clientId: undefined,
    });
  }

  function addProduct(p: Product) {
    addToOrderDraft({
      id: p.id,
      sku: p.sku,
      displayName: p.displayName ?? p.name,
      catalog: p.catalog,
      imageUrl: getProductImage(p) || undefined,
    });
    sync(getOrderDraft());
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

  async function persistHistory(status: 'sent' | 'saved'): Promise<boolean> {
    if (!cloudEnabled || !draft.items.length) return false;
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
        draft: { ...current, items },
        clientId,
        status,
      });
      if (clientId) {
        appendClientTimeline({
          clientId,
          kind: 'order',
          title: status === 'sent' ? 'Wysłano zamówienie' : 'Zapisano ofertę',
          body: `${items.length} poz. · ${formatPricePln(draftTotal)} netto`,
          actorName: authorLabel,
        });
      }
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

  function openPdf() {
    printOrderDraftPdf(
      {
        ...draft,
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

  async function saveHistoryOnly() {
    if (!draft.items.length) {
      showToast('Koszyk pusty', 'warn');
      return;
    }
    setSaving(true);
    try {
      if (await persistHistory('saved')) showToast('Zapisano w historii', 'ok');
    } finally {
      setSaving(false);
    }
  }

  async function sendDiscord() {
    if (!draft.items.length) {
      showToast('Koszyk pusty', 'warn');
      return;
    }
    if (!hasWebhook) {
      await copyText();
      if (cloudEnabled) await persistHistory('saved');
      showToast('Brak Discord — skopiowano', 'warn', 4000);
      return;
    }
    setSending(true);
    try {
      const enriched = {
        ...draft,
        items: draft.items.map((i) => {
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
      await persistHistory('sent');
      clearOrderDraft();
      sync(getOrderDraft());
      showToast('Wysłano na Discord', 'ok');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (draft.items.length === 0) setMobileCartOpen(false);
  }, [draft.items.length]);

  return (
    <div className="space-y-4 pb-24">
      <CrmTaskHeader
        title="Składam zamówienie"
        subtitle="Wybierz firmę, dodaj produkty — koszyk po prawej (desktop) lub u dołu (telefon)."
        onBack={onBack}
      />

      {cloudEnabled && (
        <ActiveClientBar
          clients={clients}
          activeClient={activeClient}
          onSelect={selectClient}
          onClear={clearClient}
          openSignal={clientPickerSignal}
        />
      )}

      {!activeClient && cloudEnabled && (
        <div className="rounded-2xl border border-brand-500/30 bg-brand-500/10 px-4 py-3 text-sm text-brand-100">
          Krok 1 — wybierz klienta u góry, zanim wyślesz ofertę.
        </div>
      )}

      <div
        className={`crm-order-shell ${draftQty > 0 ? 'pb-[calc(8.5rem+env(safe-area-inset-bottom))] lg:pb-4' : 'pb-4'}`}
      >
        <div className="crm-order-grid lg:grid lg:grid-cols-[minmax(0,1fr)_min(22rem,34%)] lg:items-start lg:gap-4">
          <div className="min-w-0 space-y-3">
            <OrderProductPicker products={products} draft={draft.items} onAdd={addProduct} />
            {onOpenCatalog && (
              <button
                type="button"
                onClick={onOpenCatalog}
                className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Otwórz pełny katalog (siatka + filtry)
              </button>
            )}
            <p className="text-xs text-slate-500">
              Możesz też dodawać z kart produktów zielonym „+” w katalogu.
            </p>
          </div>

          <aside className="crm-order-cart-aside mt-4 hidden lg:sticky lg:top-3 lg:mt-0 lg:flex lg:max-h-[calc(100dvh-7rem)] lg:min-h-[320px] lg:flex-col">
            <CrmOrderCartPanel
              draft={draft}
              draftTotal={draftTotal}
              productBySku={productBySku}
              activeClient={activeClient}
              onSync={sync}
              onCopy={() => void copyText()}
              onCopySku={() => void copySku()}
              onPdf={openPdf}
              onSaveHistory={() => void saveHistoryOnly()}
              onSendDiscord={() => void sendDiscord()}
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
            onPdf={openPdf}
            onSaveHistory={() => void saveHistoryOnly()}
            onSendDiscord={() => void sendDiscord()}
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
    </div>
  );
}
