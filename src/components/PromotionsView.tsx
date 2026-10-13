import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Loader2,
  Percent,
  Plus,
  Printer,
  Search,
  Send,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { Product } from '../types';
import { applyCatalogFilters } from '../lib/search';
import { customerGrossPrice, formatMarginPercent, formatPricePln, marginPercent } from '../lib/format';
import { getProductDisplayCategory } from '../lib/catalogCategory';
import { hasBaselinkerLink } from '../lib/baselinkerLink';
import { promoApplyBaselinker, promoEndBaselinker } from '../lib/baselinkerApi';
import { addProductsToLabelQueue, updateLabelItem } from '../lib/labelQueue';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';
import {
  PROMO_STATUS_LABEL,
  createPromoCampaign,
  deletePromoCampaign,
  duplicatePromoCampaign,
  fetchPromoCampaigns,
  fetchPromoItems,
  refreshLivePromos,
  savePromoItems,
  setInternalPromoState,
  updatePromoCampaign,
  type PromoCampaign,
  type PromoChannel,
  type PromoItem,
  type PromoStatus,
} from '../lib/promotions';

interface Props {
  /** Produkty widoczne w katalogu (bez ukrytych). */
  products: Product[];
  /** Uprawnienie „Promocje” — bez niego tylko podgląd kampanii. */
  canEdit: boolean;
  /** Uprawnienie „Ceny i marża” — pokazuje cenę zakupu i marże. */
  canSeeMargins: boolean;
  onOpenLabels: () => void;
}

const STATUS_STYLE: Record<PromoStatus, string> = {
  draft: 'bg-slate-700 text-slate-200',
  scheduled: 'bg-sky-500/20 text-sky-300',
  active: 'bg-red-600 text-white',
  ended: 'bg-slate-800 text-slate-400',
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

interface RunResult {
  errors: number;
  done: number;
  skipped: number;
  message: string;
}

/** Start kampanii: sklep internetowy → ceny do BaseLinkera; wewnętrzna → tylko status (bez BL). */
async function runStart(c: { id: string; channel: PromoChannel }): Promise<RunResult> {
  if (c.channel === 'internal') {
    await setInternalPromoState(c.id, 'active');
    return { errors: 0, done: 0, skipped: 0, message: 'wewnętrzna' };
  }
  return promoApplyBaselinker(c.id);
}

async function runEnd(c: { id: string; channel: PromoChannel }): Promise<RunResult> {
  if (c.channel === 'internal') {
    await setInternalPromoState(c.id, 'ended');
    return { errors: 0, done: 0, skipped: 0, message: 'wewnętrzna' };
  }
  return promoEndBaselinker(c.id);
}

/** Zaokrągla cenę do końcówki ,90 (najbliższej), ale tylko jeśli nadal jest niższa od ceny zwykłej. */
function endingNinety(price: number, regular: number | null): number {
  const lo = Math.floor(price) - 0.1;
  const hi = Math.floor(price) + 0.9;
  const best = Math.abs(price - lo) <= Math.abs(price - hi) ? lo : hi;
  const rounded = round2(best);
  if (rounded <= 0 || (regular != null && rounded >= regular)) return round2(price);
  return rounded;
}

function itemMargin(it: PromoItem): number | null {
  return marginPercent(it.purchaseNet, it.promoGross / (1 + it.vat / 100));
}

/** Główny widok „Promocje”: lista kampanii i edytor. */
export function PromotionsView({ products, canEdit, canSeeMargins, onOpenLabels }: Props) {
  const [campaigns, setCampaigns] = useState<PromoCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<PromoCampaign | 'new' | null>(null);
  const [filter, setFilter] = useState<PromoStatus | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCampaigns(await fetchPromoCampaigns());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania kampanii');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const shown = campaigns.filter((c) => filter === 'all' || c.status === filter);
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: campaigns.length };
    for (const c of campaigns) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [campaigns]);

  async function endNow(c: PromoCampaign) {
    if (
      !(await confirmDialog({
        title: 'Zakończyć promocję teraz?',
        tone: 'warn',
        confirmLabel: 'Zakończ',
        message:
          c.channel === 'internal'
            ? `„${c.name}” zostanie zakończona: znaczniki PROMOCJA znikną z katalogu.`
            : `„${c.name}” zostanie zakończona: w BaseLinkerze w grupie promocyjnej wróci cena zwykła, a znaczniki PROMOCJA znikną z katalogu.`,
      }))
    )
      return;
    setBusy(c.id);
    try {
      const r = await runEnd(c);
      showToast(
        r.errors
          ? `Błąd: ${r.message}`
          : c.channel === 'internal'
            ? 'Promocja wewnętrzna zakończona'
            : `Promocja zakończona (${r.done} pozycji przywróconych w BaseLinkerze)`,
        r.errors ? 'error' : 'ok',
        6000,
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się zakończyć promocji', 'error', 7000);
    } finally {
      setBusy(null);
      await reload();
      void refreshLivePromos(true);
    }
  }

  async function startNow(c: PromoCampaign) {
    setBusy(c.id);
    try {
      const r = await runStart(c);
      showToast(
        r.errors
          ? `Błąd: ${r.message}`
          : c.channel === 'internal'
            ? 'Promocja wewnętrzna uruchomiona'
            : `Promocja uruchomiona: ${r.done} cen wysłanych do BaseLinkera${r.skipped ? `, pominięto ${r.skipped} (brak w BL)` : ''}`,
        r.errors ? 'error' : 'ok',
        7000,
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się uruchomić promocji', 'error', 8000);
    } finally {
      setBusy(null);
      await reload();
      void refreshLivePromos(true);
    }
  }

  async function duplicate(c: PromoCampaign) {
    setBusy(c.id);
    try {
      await duplicatePromoCampaign(c.id);
      showToast('Skopiowano kampanię jako szkic', 'ok');
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd kopiowania', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: PromoCampaign) {
    if (c.status === 'active') {
      showToast('Najpierw zakończ aktywną promocję', 'warn');
      return;
    }
    if (
      !(await confirmDialog({
        title: 'Usunąć kampanię?',
        tone: 'danger',
        confirmLabel: 'Usuń',
        message: `„${c.name}” (${c.itemCount} pozycji) zostanie trwale usunięta.`,
      }))
    )
      return;
    try {
      await deletePromoCampaign(c.id);
      await reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd usuwania', 'error');
    }
  }

  if (editing) {
    return (
      <PromoEditor
        campaign={editing === 'new' ? null : editing}
        products={products}
        canEdit={canEdit}
        canSeeMargins={canSeeMargins}
        onOpenLabels={onOpenLabels}
        onClose={() => {
          setEditing(null);
          void reload();
          void refreshLivePromos(true);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Tag className="h-5 w-5 text-red-400" />
            Centrum promocji
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Kampanie cenowe: wybierz produkty, ustaw ceny promocyjne na okres czasu (albo bezterminowo) i wyślij do
            BaseLinkera. Po zakończeniu cena zwykła wraca sama.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
          >
            <Plus className="h-4 w-4" />
            Nowa kampania
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', 'Wszystkie'],
            ['active', 'Aktywne'],
            ['scheduled', 'Zatwierdzone'],
            ['draft', 'Szkice'],
            ['ended', 'Zakończone'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === key ? 'bg-brand-600 text-white' : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {label} {counts[key] ? `(${counts[key]})` : ''}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-14 text-center">
          <Tag className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-slate-400">Brak kampanii</p>
          {canEdit && <p className="mt-1 text-sm text-slate-500">Kliknij „Nowa kampania”, żeby zacząć.</p>}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((c) => (
            <li key={c.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setEditing(c)} className="min-w-0 text-left">
                  <p className="truncate text-base font-semibold text-slate-100">{c.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatWhen(c.startsAt)} → {c.endsAt ? formatWhen(c.endsAt) : 'bezterminowo'}
                  </p>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[c.status]}`}>
                    {PROMO_STATUS_LABEL[c.status]}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      c.channel === 'internal' ? 'bg-slate-800 text-slate-300' : 'bg-blue-600/20 text-blue-300'
                    }`}
                  >
                    {c.channel === 'internal' ? 'wewnętrzna' : 'sklep (BaseLinker)'}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                {c.itemCount} {c.itemCount === 1 ? 'produkt' : 'produktów'}
                {c.createdByLabel ? <span className="text-slate-500"> · {c.createdByLabel}</span> : null}
              </p>
              {c.lastError && (
                <p className="mt-1 rounded-lg bg-red-500/10 px-2 py-1 text-xs text-red-300">Błąd: {c.lastError}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                >
                  {canEdit && c.status !== 'active' && c.status !== 'ended' ? 'Edytuj' : 'Podgląd'}
                </button>
                {canEdit && (c.status === 'scheduled' || c.status === 'draft') && (
                  <button
                    type="button"
                    disabled={busy === c.id || c.itemCount === 0}
                    onClick={() => void startNow(c)}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Uruchom teraz
                  </button>
                )}
                {canEdit && c.status === 'active' && (
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => void endNow(c)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-600 disabled:opacity-50"
                  >
                    {busy === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                    Zakończ teraz
                  </button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy === c.id}
                    onClick={() => void duplicate(c)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplikuj
                  </button>
                )}
                {canEdit && c.status !== 'active' && (
                  <button
                    type="button"
                    onClick={() => void remove(c)}
                    className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                    aria-label="Usuń kampanię"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// =============================================================================================
// Edytor kampanii
// =============================================================================================

type RuleMode = 'percent' | 'margin' | 'fixed';

function PromoEditor({
  campaign,
  products,
  canEdit,
  canSeeMargins,
  onOpenLabels,
  onClose,
}: {
  campaign: PromoCampaign | null;
  products: Product[];
  canEdit: boolean;
  canSeeMargins: boolean;
  onOpenLabels: () => void;
  onClose: () => void;
}) {
  const [id, setId] = useState<string | null>(campaign?.id ?? null);
  const [status, setStatus] = useState<PromoStatus>(campaign?.status ?? 'draft');
  const [channel, setChannel] = useState<PromoChannel>(campaign?.channel ?? 'baselinker');
  const [name, setName] = useState(campaign?.name ?? '');
  const [note, setNote] = useState(campaign?.note ?? '');
  const [startsAt, setStartsAt] = useState(toLocalInput(campaign?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(campaign?.endsAt ?? null));
  const [minMargin, setMinMargin] = useState(campaign?.minMargin != null ? String(campaign.minMargin) : '');
  const [items, setItems] = useState<PromoItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(Boolean(campaign));
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // wybór produktów
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Wszystkie');
  const [onlyBl, setOnlyBl] = useState(false);
  const [defaultDiscount, setDefaultDiscount] = useState('10');
  const [pickSel, setPickSel] = useState<Set<string>>(new Set());

  // reguła masowa
  const [ruleMode, setRuleMode] = useState<RuleMode>('percent');
  const [ruleValue, setRuleValue] = useState('15');
  const [ending90, setEnding90] = useState(true);

  const locked = !canEdit || status === 'active' || status === 'ended';

  useEffect(() => {
    if (!campaign) return;
    let alive = true;
    fetchPromoItems(campaign.id)
      .then((list) => alive && setItems(list))
      .catch((e) => showToast(e instanceof Error ? e.message : 'Błąd ładowania pozycji', 'error', 6000))
      .finally(() => alive && setLoadingItems(false));
    return () => {
      alive = false;
    };
  }, [campaign]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(getProductDisplayCategory(p));
    return ['Wszystkie', ...[...set].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pl'))];
  }, [products]);

  const inCampaign = useMemo(() => new Set(items.map((i) => i.sku.toUpperCase())), [items]);

  const results = useMemo(() => {
    let list = applyCatalogFilters(products, { search, category, sort: 'name-asc' });
    if (onlyBl) list = list.filter((p) => hasBaselinkerLink(p));
    return list.filter((p) => !p.isGroup && p.sku && !inCampaign.has(p.sku.toUpperCase()));
  }, [products, search, category, onlyBl, inCampaign]);

  const minMarginNum = minMargin.trim() === '' ? null : Number(minMargin.replace(',', '.'));

  function addProducts(list: Product[]) {
    const disc = Math.max(0, Math.min(90, Number(defaultDiscount.replace(',', '.')) || 0));
    const added: PromoItem[] = [];
    for (const p of list) {
      const vatRaw = Number(p.meta?.vatRate);
      const vat = Number.isFinite(vatRaw) && vatRaw >= 0 ? vatRaw : 23;
      const regular = customerGrossPrice(p.priceSaleGross, p.priceSaleNet, p.meta?.vatRate);
      if (regular == null || regular <= 0) continue;
      added.push({
        sku: p.sku.toUpperCase(),
        productName: p.displayName,
        vat,
        regularGross: regular,
        purchaseNet: p.pricePurchaseNet != null && Number.isFinite(Number(p.pricePurchaseNet)) ? Number(p.pricePurchaseNet) : null,
        promoGross: round2(regular * (1 - disc / 100)),
      });
    }
    if (added.length < list.length) {
      showToast(`Pominięto ${list.length - added.length} produktów bez ceny sprzedaży`, 'warn', 4000);
    }
    setItems((prev) => [...prev, ...added]);
    setPickSel(new Set());
  }

  function setPrice(sku: string, value: number) {
    setItems((prev) => prev.map((i) => (i.sku === sku ? { ...i, promoGross: value } : i)));
  }

  function applyRule() {
    const v = Number(ruleValue.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) {
      showToast('Wpisz wartość reguły', 'warn');
      return;
    }
    const target = sel.size ? sel : null;
    let skippedNoCost = 0;
    setItems((prev) =>
      prev.map((it) => {
        if (target && !target.has(it.sku)) return it;
        const regular = it.regularGross ?? 0;
        let price: number | null = null;
        if (ruleMode === 'percent') price = regular * (1 - v / 100);
        else if (ruleMode === 'fixed') price = v;
        else if (ruleMode === 'margin') {
          if (it.purchaseNet == null || v >= 100) {
            skippedNoCost++;
            return it;
          }
          price = (it.purchaseNet / (1 - v / 100)) * (1 + it.vat / 100);
        }
        if (price == null || !Number.isFinite(price) || price <= 0) return it;
        const final = ending90 ? endingNinety(price, it.regularGross) : round2(price);
        return { ...it, promoGross: final };
      }),
    );
    if (skippedNoCost) showToast(`Pominięto ${skippedNoCost} pozycji bez ceny zakupu`, 'warn', 4000);
  }

  // podsumowanie / ostrzeżenia
  const stats = useMemo(() => {
    let invalid = 0;
    let belowCost = 0;
    let belowMin = 0;
    let marginSum = 0;
    let marginN = 0;
    let discSum = 0;
    for (const it of items) {
      const reg = it.regularGross ?? 0;
      if (!(it.promoGross > 0) || (reg > 0 && it.promoGross >= reg)) invalid++;
      if (reg > 0) discSum += (1 - it.promoGross / reg) * 100;
      const m = itemMargin(it);
      if (m != null) {
        marginSum += m;
        marginN++;
        if (m <= 0) belowCost++;
        else if (minMarginNum != null && m < minMarginNum) belowMin++;
      }
    }
    return {
      invalid,
      belowCost,
      belowMin,
      avgMargin: marginN ? marginSum / marginN : null,
      avgDiscount: items.length ? discSum / items.length : null,
    };
  }, [items, minMarginNum]);

  async function persist(): Promise<string | null> {
    const input = {
      channel,
      name: name.trim() || 'Nowa promocja',
      note,
      startsAt: fromLocalInput(startsAt),
      endsAt: fromLocalInput(endsAt),
      minMargin: minMarginNum != null && Number.isFinite(minMarginNum) ? minMarginNum : null,
    };
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      showToast('Data końca musi być po dacie startu', 'warn');
      return null;
    }
    let cid = id;
    if (!cid) {
      const created = await createPromoCampaign(input);
      cid = created.id;
      setId(cid);
    } else {
      await updatePromoCampaign(cid, input);
    }
    await savePromoItems(cid, items);
    return cid;
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const cid = await persist();
      if (cid) showToast('Zapisano szkic kampanii', 'ok');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd zapisu', 'error', 7000);
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!items.length) {
      showToast('Dodaj produkty do kampanii', 'warn');
      return;
    }
    if (stats.invalid > 0) {
      showToast(`${stats.invalid} pozycji ma błędną cenę (musi być niższa od zwykłej)`, 'warn', 6000);
      return;
    }
    if (stats.belowCost > 0) {
      if (
        !(await confirmDialog({
          title: 'Sprzedaż poniżej kosztu',
          tone: 'danger',
          confirmLabel: 'Zatwierdź mimo to',
          message: `${stats.belowCost} pozycji ma marżę po promocji ≤ 0%. Czy na pewno zatwierdzić kampanię?`,
        }))
      )
        return;
    }
    const start = fromLocalInput(startsAt);
    const startsNow = !start || new Date(start) <= new Date();
    setSaving(true);
    try {
      const cid = await persist();
      if (!cid) return;
      await updatePromoCampaign(cid, { status: 'scheduled' });
      setStatus('scheduled');
      if (startsNow) {
        const r = await runStart({ id: cid, channel });
        if (r.errors) {
          showToast(`Zatwierdzono, ale wysyłka do BaseLinkera nie udała się: ${r.message}`, 'error', 9000);
        } else {
          setStatus('active');
          showToast(
            channel === 'internal'
              ? 'Promocja wewnętrzna uruchomiona — znaczniki widać już w katalogu'
              : `Promocja uruchomiona: ${r.done} cen wysłanych do BaseLinkera${r.skipped ? `, pominięto ${r.skipped} (brak w BL)` : ''}`,
            'ok',
            7000,
          );
        }
      } else {
        showToast('Kampania zatwierdzona — ruszy automatycznie w dniu startu', 'ok', 6000);
      }
      await refreshLivePromos(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się zatwierdzić', 'error', 8000);
    } finally {
      setSaving(false);
    }
  }

  function printLabels() {
    const byKey = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
    const list: Product[] = [];
    for (const it of items) {
      const p = byKey.get(it.sku.toUpperCase());
      if (p) list.push(p);
    }
    if (!list.length) {
      showToast('Brak produktów do etykiet', 'warn');
      return;
    }
    addProductsToLabelQueue(list);
    for (const it of items) {
      const p = byKey.get(it.sku.toUpperCase());
      if (p) updateLabelItem(p.id, { salePrice: it.promoGross });
    }
    showToast(`Dodano ${list.length} etykiet promocyjnych do wydruku`, 'ok', 3500);
    onOpenLabels();
  }

  const allSelected = items.length > 0 && items.every((i) => sel.has(i.sku));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
          Zamknij
        </button>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[status]}`}>
          {PROMO_STATUS_LABEL[status]}
        </span>
      </div>

      {locked && canEdit && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {status === 'active'
            ? 'Kampania jest aktywna — ceny są w BaseLinkerze. Zakończ ją na liście, żeby edytować (albo zduplikuj).'
            : 'Kampania zakończona — tylko podgląd. Możesz ją zduplikować na liście.'}
        </p>
      )}

      {/* dane kampanii */}
      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-4">
        <div className="md:col-span-4">
          <span className="mb-1 block text-xs text-slate-400">Rodzaj kampanii</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['baselinker', 'Promocja do sklepu internetowego', 'Ceny promocyjne trafiają do BaseLinkera (osobna grupa cenowa), po końcu wraca cena zwykła.'],
                ['internal', 'Kampania wewnętrzna', 'Tylko katalog i etykiety (np. wyprzedaż na półce). Bez łączenia z BaseLinkerem.'],
              ] as const
            ).map(([key, title, hint]) => (
              <button
                key={key}
                type="button"
                disabled={locked}
                onClick={() => setChannel(key)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  channel === key
                    ? 'border-red-500 bg-red-500/10'
                    : 'border-slate-700 bg-slate-950/40 hover:border-slate-600'
                } disabled:cursor-default disabled:opacity-80`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
                      channel === key ? 'border-red-400 bg-red-500' : 'border-slate-500'
                    }`}
                  />
                  {title}
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs text-slate-400">Nazwa kampanii</span>
          <input
            value={name}
            disabled={locked}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Wyprzedaż jesień"
            className="input-field text-sm"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-400">Start (puste = od razu)</span>
          <input
            type="datetime-local"
            value={startsAt}
            disabled={locked}
            onChange={(e) => setStartsAt(e.target.value)}
            className="input-field text-sm"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-400">Koniec (puste = bezterminowo)</span>
          <input
            type="datetime-local"
            value={endsAt}
            disabled={locked}
            onChange={(e) => setEndsAt(e.target.value)}
            className="input-field text-sm"
          />
        </label>
        <label className="md:col-span-3">
          <span className="mb-1 block text-xs text-slate-400">Notatka</span>
          <input
            value={note}
            disabled={locked}
            onChange={(e) => setNote(e.target.value)}
            placeholder="opcjonalnie"
            className="input-field text-sm"
          />
        </label>
        {canSeeMargins && (
          <label>
            <span className="mb-1 block text-xs text-slate-400">Minimalna marża % (ostrzeżenie)</span>
            <input
              type="number"
              min={0}
              max={99}
              value={minMargin}
              disabled={locked}
              onChange={(e) => setMinMargin(e.target.value)}
              placeholder="np. 10"
              className="input-field text-sm"
            />
          </label>
        )}
      </section>

      {/* dobór produktów */}
      {!locked && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-100">Dodaj produkty do kampanii</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj: nazwa, SKU, EAN…"
                className="input-field with-icon text-sm"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input-field w-52 text-sm"
              aria-label="Kategoria"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={onlyBl}
                onChange={(e) => setOnlyBl(e.target.checked)}
                className="h-4 w-4 accent-brand-500"
              />
              tylko z BaseLinkera (B)
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-300">
              Obniżka przy dodawaniu
              <input
                type="number"
                min={0}
                max={90}
                value={defaultDiscount}
                onChange={(e) => setDefaultDiscount(e.target.value)}
                className="input-field w-16 text-sm"
              />
              %
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Wyników: {results.length}</span>
            <button
              type="button"
              onClick={() =>
                setPickSel(
                  pickSel.size === Math.min(results.length, 60)
                    ? new Set()
                    : new Set(results.slice(0, 60).map((p) => p.id)),
                )
              }
              className="rounded-md border border-slate-700 px-2 py-1 hover:bg-slate-800"
            >
              Zaznacz widoczne
            </button>
            <button
              type="button"
              disabled={pickSel.size === 0}
              onClick={() => addProducts(results.filter((p) => pickSel.has(p.id)))}
              className="rounded-md bg-brand-600 px-2.5 py-1 font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              Dodaj zaznaczone ({pickSel.size})
            </button>
            {(search.trim() || category !== 'Wszystkie' || onlyBl) && results.length > 0 && results.length <= 500 && (
              <button
                type="button"
                onClick={() => addProducts(results)}
                className="rounded-md border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 font-medium text-brand-300 hover:bg-brand-500/20"
              >
                Dodaj wszystkie wyniki ({results.length})
              </button>
            )}
          </div>

          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
            {results.slice(0, 60).map((p) => {
              const reg = customerGrossPrice(p.priceSaleGross, p.priceSaleNet, p.meta?.vatRate);
              return (
                <li key={p.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${
                      pickSel.has(p.id) ? 'border-brand-500/50 bg-brand-500/10' : 'border-slate-800 bg-slate-950/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={pickSel.has(p.id)}
                      onChange={() =>
                        setPickSel((prev) => {
                          const n = new Set(prev);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        })
                      }
                      className="h-4 w-4 accent-brand-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-100">{p.displayName}</span>
                      <span className="block font-mono text-[11px] text-brand-400">{p.sku}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-300">
                      {reg != null ? formatPricePln(reg) : 'brak ceny'}
                    </span>
                  </label>
                </li>
              );
            })}
            {results.length === 0 && (
              <li className="py-4 text-center text-sm text-slate-500">Brak produktów do dodania dla tych filtrów.</li>
            )}
          </ul>
        </section>
      )}

      {/* pozycje kampanii */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Produkty w kampanii ({items.length})</h3>
          {!locked && items.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-400">Reguła dla {sel.size ? `zaznaczonych (${sel.size})` : 'wszystkich'}:</span>
              <select
                value={ruleMode}
                onChange={(e) => setRuleMode(e.target.value as RuleMode)}
                className="input-field w-40 text-xs"
              >
                <option value="percent">obniżka o %</option>
                {canSeeMargins && <option value="margin">marża docelowa %</option>}
                <option value="fixed">stała cena brutto</option>
              </select>
              <input
                type="number"
                min={0}
                step="any"
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                className="input-field w-20 text-xs"
              />
              <label className="flex cursor-pointer items-center gap-1 text-slate-300">
                <input
                  type="checkbox"
                  checked={ending90}
                  onChange={(e) => setEnding90(e.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-500"
                />
                końcówka ,90
              </label>
              <button
                type="button"
                onClick={applyRule}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 font-semibold text-white hover:bg-red-500"
              >
                <Percent className="h-3.5 w-3.5" />
                Zastosuj
              </button>
            </div>
          )}
        </div>

        {loadingItems ? (
          <div className="flex justify-center py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Dodaj produkty powyżej.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  {!locked && (
                    <th className="w-8 pb-2">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSel(allSelected ? new Set() : new Set(items.map((i) => i.sku)))}
                        className="h-4 w-4 accent-brand-500"
                        aria-label="Zaznacz wszystkie"
                      />
                    </th>
                  )}
                  <th className="pb-2">Produkt</th>
                  <th className="w-28 pb-2 pr-3 text-right">Zwykła brutto</th>
                  {canSeeMargins && <th className="w-24 pb-2 pr-3 text-right">Zakup netto</th>}
                  <th className="w-36 pb-2 pr-3 text-right">Cena promo brutto</th>
                  <th className="w-24 pb-2 pr-2 text-center">Obniżka</th>
                  {canSeeMargins && <th className="w-32 pb-2 pr-2 text-center">Marża po promocji</th>}
                  <th className="w-8 pb-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const reg = it.regularGross ?? 0;
                  const bad = !(it.promoGross > 0) || (reg > 0 && it.promoGross >= reg);
                  const disc = reg > 0 ? (1 - it.promoGross / reg) * 100 : null;
                  const m = itemMargin(it);
                  const profit = it.purchaseNet != null ? it.promoGross / (1 + it.vat / 100) - it.purchaseNet : null;
                  const mState: 'none' | 'loss' | 'low' | 'ok' =
                    m == null ? 'none' : m <= 0 ? 'loss' : minMarginNum != null && m < minMarginNum ? 'low' : 'ok';
                  const mPill = {
                    none: 'bg-slate-800 text-slate-400',
                    loss: 'bg-red-600 text-white',
                    low: 'bg-amber-500/25 text-amber-200',
                    ok: 'bg-emerald-500/20 text-emerald-300',
                  }[mState];
                  const mHint = { none: '', loss: 'poniżej kosztu', low: 'niska marża', ok: '' }[mState];
                  return (
                    <tr key={it.sku} className={`border-t border-slate-800/70 align-middle ${bad ? 'bg-red-500/5' : ''}`}>
                      {!locked && (
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={sel.has(it.sku)}
                            onChange={() =>
                              setSel((prev) => {
                                const n = new Set(prev);
                                if (n.has(it.sku)) n.delete(it.sku);
                                else n.add(it.sku);
                                return n;
                              })
                            }
                            className="h-4 w-4 accent-brand-500"
                          />
                        </td>
                      )}
                      <td className="py-2 pr-3">
                        <span className="block max-w-[20rem] truncate text-slate-100">{it.productName}</span>
                        <span className="font-mono text-[11px] text-brand-400">{it.sku}</span>
                        {channel === 'baselinker' && it.blState === 'skipped' && (
                          <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">
                            {it.blError || 'pominięto'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-300">
                        {it.regularGross != null ? formatPricePln(it.regularGross) : '—'}
                      </td>
                      {canSeeMargins && (
                        <td className="py-2 pr-3 text-right tabular-nums text-slate-400">
                          {it.purchaseNet != null ? formatPricePln(it.purchaseNet) : 'brak'}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-right">
                        {locked ? (
                          <span className="font-bold tabular-nums text-red-300">{formatPricePln(it.promoGross)}</span>
                        ) : (
                          <div className="ml-auto" style={{ width: '8.5rem' }}>
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={Number.isFinite(it.promoGross) ? it.promoGross : ''}
                                onChange={(e) => setPrice(it.sku, Number(e.target.value))}
                                style={{ width: '100%', paddingRight: '2rem' }}
                                className={`input-field text-right text-sm font-bold tabular-nums ${
                                  bad ? '!border-red-500' : ''
                                }`}
                              />
                              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                                zł
                              </span>
                            </div>
                            {bad && (
                              <span className="mt-0.5 block text-[10px] font-semibold text-red-400">
                                musi być niższa od zwykłej
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-center">
                        {disc != null && !bad ? (
                          <span className="rounded-full bg-red-600/90 px-2 py-0.5 text-xs font-bold tabular-nums text-white">
                            −{disc.toFixed(1).replace('.', ',')}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      {canSeeMargins && (
                        <td className="py-2 pr-2 text-center">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${mPill}`}>
                            {formatMarginPercent(m)}
                          </span>
                          {(mHint || profit != null) && (
                            <span
                              className={`mt-0.5 block text-[10px] ${
                                mState === 'loss' ? 'font-bold text-red-400' : mState === 'low' ? 'text-amber-300' : 'text-slate-500'
                              }`}
                            >
                              {mHint || (profit != null ? `zysk ${formatPricePln(round2(profit))}/szt.` : '')}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="py-2 text-right">
                        {!locked && (
                          <button
                            type="button"
                            onClick={() => setItems((prev) => prev.filter((x) => x.sku !== it.sku))}
                            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                            aria-label="Usuń z kampanii"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-950/60 px-3 py-2.5 text-sm">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
              Średnia obniżka:{' '}
              <b className="tabular-nums text-white">
                {stats.avgDiscount != null ? `${stats.avgDiscount.toFixed(1).replace('.', ',')}%` : '—'}
              </b>
            </span>
            {canSeeMargins && (
              <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                Średnia marża po promocji:{' '}
                <b className="tabular-nums text-white">{formatMarginPercent(stats.avgMargin)}</b>
              </span>
            )}
            {stats.invalid > 0 && (
              <span className="rounded-full bg-red-600 px-3 py-1 font-bold text-white">
                Błędna cena: {stats.invalid} (musi być niższa od zwykłej)
              </span>
            )}
            {canSeeMargins && stats.belowCost > 0 && (
              <span className="rounded-full bg-red-600 px-3 py-1 font-bold text-white">
                Sprzedaż poniżej kosztu: {stats.belowCost}
              </span>
            )}
            {canSeeMargins && stats.belowMin > 0 && (
              <span className="rounded-full bg-amber-500/25 px-3 py-1 font-semibold text-amber-200">
                Poniżej minimalnej marży: {stats.belowMin}
              </span>
            )}
            {stats.invalid === 0 && stats.belowCost === 0 && stats.belowMin === 0 && (
              <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-300">
                Ceny w porządku
              </span>
            )}
          </div>
        )}
      </section>

      {/* akcje */}
      <div className="flex flex-wrap items-center gap-2">
        {!locked && (
          <>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDraft()}
              className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Zapisuję…' : 'Zapisz szkic'}
            </button>
            <button
              type="button"
              disabled={saving || items.length === 0}
              onClick={() => void approve()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Zatwierdź i uruchom
            </button>
          </>
        )}
        <button
          type="button"
          disabled={items.length === 0}
          onClick={printLabels}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          <Printer className="h-4 w-4" />
          Etykiety promocyjne
        </button>
        <p className="text-xs text-slate-500">
          {channel === 'internal'
            ? 'Kampania wewnętrzna: start i koniec wg dat uruchamia się automatycznie (agent sprawdza co kilka minut). Nic nie jest wysyłane do BaseLinkera — promocja widoczna w katalogu i na etykietach.'
            : 'Start i koniec wg dat uruchamia się automatycznie (agent sprawdza co kilka minut). Ceny trafiają do osobnej grupy cenowej w BaseLinkerze.'}
        </p>
      </div>
    </div>
  );
}
