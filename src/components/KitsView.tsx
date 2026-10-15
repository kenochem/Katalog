import {
  Camera,
  Check,
  Copy,
  ImageOff,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';
import { confirmDialog } from '../lib/dialog';
import { useMemo, useRef, useState } from 'react';
import type { Kit, KitItem, Product } from '../types';
import {
  deleteKit,
  getProductImage,
  saveKit,
  setKitCode,
  uploadKitImage,
} from '../lib/products';
import {
  isBaselinkerKit,
  isOwnKit,
  KIT_SEGMENT_LABELS,
  OWN_KIT_DEFAULT_CATEGORY,
  type KitSegment,
} from '../lib/kitSource';
import { addKitToOrderDraft } from '../lib/orderDraft';
import { SearchBar } from './SearchBar';
import { BarcodeScanner } from './BarcodeScanner';
import { filterProducts } from '../lib/search';
import { getAvailableQty } from '../lib/reservedStock';
import { kitAvailability } from '../lib/kitSync';
import { kitCoverImages, kitMatches, kitValue, nextKitCode, planKitCodes } from '../lib/kitMeta';
import { exportKitToBaselinker } from '../lib/baselinkerApi';
import { formatPricePln } from '../lib/format';
import { showToast } from '../lib/toast';
import { KitSyncModal } from './KitSyncModal';
import {
  buildProductLookup,
  kitLinkedCount,
  resolveKitItemProduct,
} from '../lib/kitResolve';

type SortKey = 'name' | 'code' | 'new' | 'avail';

interface KitsViewProps {
  kits: Kit[];
  products: Product[];
  onKitsChange: () => void;
  canAddToOrder?: boolean;
  onOrderDraftChange?: () => void;
  /** Uprawnienie do porównania składu zestawów z BaseLinkerem i eksportu zestawu do BL. */
  canSyncBl?: boolean;
  /** Edycja zestawów: zdjęcie, kody, własne zestawy. */
  canEdit?: boolean;
  showPrices?: boolean;
}

/** Plakietka BaseLinkera: niebieska = zestaw aktywny w BL, szara = już go tam nie ma. */
function BlBadge({ kit }: { kit: Kit }) {
  const active = kit.blActive !== false;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        active
          ? 'bg-sky-500/20 text-sky-600 ring-1 ring-sky-500/40 dark:text-sky-300'
          : 'bg-stone-200 text-stone-500 ring-1 ring-stone-300 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
      }`}
      title={active ? 'Zestaw aktywny w BaseLinkerze' : 'Zestawu nie ma już w BaseLinkerze'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-sky-500' : 'bg-stone-400'}`} />
      Base{active ? ' · aktywny' : ' · nieaktywny'}
    </span>
  );
}

function KitCover({ kit, lookup, className = '' }: { kit: Kit; lookup: ReturnType<typeof buildProductLookup>; className?: string }) {
  if (kit.imageUrl) {
    return (
      <div className={`overflow-hidden bg-white ${className}`}>
        <img src={kit.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
      </div>
    );
  }
  const imgs = kitCoverImages(kit, lookup, 4);
  if (imgs.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-stone-100 text-stone-400 dark:bg-slate-800 dark:text-slate-600 ${className}`}>
        <Package className="h-10 w-10" />
      </div>
    );
  }
  return (
    <div className={`grid gap-px overflow-hidden bg-stone-200 dark:bg-slate-700 ${imgs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${className}`}>
      {imgs.map((src) => (
        <div key={src} className="flex items-center justify-center bg-white">
          <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
        </div>
      ))}
    </div>
  );
}

export function KitsView({
  kits,
  products,
  onKitsChange,
  canAddToOrder,
  onOrderDraftChange,
  canSyncBl,
  canEdit,
  showPrices = true,
}: KitsViewProps) {
  const [segment, setSegment] = useState<KitSegment>(() =>
    kits.some(isBaselinkerKit) ? 'baselinker' : 'own',
  );
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingKit, setEditingKit] = useState<Kit | null>(null);
  const [showSync, setShowSync] = useState(false);
  const [codingBusy, setCodingBusy] = useState(false);

  const baselinkerKits = useMemo(() => kits.filter(isBaselinkerKit), [kits]);
  const ownKits = useMemo(() => kits.filter(isOwnKit), [kits]);
  const productLookup = useMemo(() => buildProductLookup(products), [products]);
  const segmentKits = segment === 'baselinker' ? baselinkerKits : ownKits;
  const missingCodes = useMemo(() => kits.filter((k) => !k.code).length, [kits]);

  const visibleKits = useMemo(() => {
    const filtered = segmentKits.filter((k) => kitMatches(k, query, productLookup));
    const availOf = (k: Kit) => kitAvailability(k.items, productLookup, getAvailableQty)?.count ?? -1;
    return [...filtered].sort((a, b) => {
      if (sort === 'code') return (a.code ?? 'ZZZ').localeCompare(b.code ?? 'ZZZ', 'pl', { numeric: true });
      if (sort === 'new') return b.createdAt - a.createdAt;
      if (sort === 'avail') return availOf(b) - availOf(a) || a.name.localeCompare(b.name, 'pl');
      return a.name.localeCompare(b.name, 'pl', { numeric: true, sensitivity: 'base' });
    });
  }, [segmentKits, query, sort, productLookup]);

  const openKit = openId ? (kits.find((k) => k.id === openId) ?? null) : null;

  async function assignCodes() {
    const plan = planKitCodes(kits);
    if (plan.length === 0) return;
    if (
      !(await confirmDialog({
        title: `Nadać kody ${plan.length} zestawom?`,
        confirmLabel: 'Nadaj kody',
        message: `Zestawy bez kodu dostaną kolejne kody katalogowe (${plan[0].code} … ${plan[plan.length - 1].code}) od najstarszego. Kod służy do wyszukiwania, wskazywania zestawów w promocjach i jest SKU zestawu w BaseLinkerze.`,
      }))
    )
      return;
    setCodingBusy(true);
    try {
      for (const p of plan) await setKitCode(p.kit.id, p.code);
      showToast(`Nadano ${plan.length} kodów katalogowych`, 'ok');
      onKitsChange();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się nadać kodów (czy wykonano migrację migration-kits-code-meta.sql?)', 'error', 8000);
    } finally {
      setCodingBusy(false);
    }
  }

  return (
    <div className="kits-view space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Zestawy</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {segment === 'baselinker'
              ? 'Zestawy z BaseLinkera — skład, dostępność i dodawanie do zamówienia.'
              : 'Zestawy własne i techniczne tworzone w katalogu (można wysłać je do BaseLinkera).'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && missingCodes > 0 && (
            <button
              type="button"
              disabled={codingBusy}
              onClick={() => void assignCodes()}
              className="flex items-center gap-2 rounded-xl border border-amber-500/50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-500/10 disabled:opacity-50 dark:text-amber-300"
            >
              {codingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Nadaj kody ({missingCodes})
            </button>
          )}
          {segment === 'baselinker' && canSyncBl && (
            <button
              type="button"
              onClick={() => setShowSync(true)}
              className="flex items-center gap-2 rounded-xl border border-sky-500/50 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
            >
              <RefreshCw className="h-4 w-4" />
              Porównaj skład z BaseLinkerem
            </button>
          )}
          {segment === 'own' && (
            <button
              type="button"
              onClick={() => {
                setEditingKit(null);
                setShowEditor(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" />
              Nowy zestaw
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj zestawu: nazwa, kod (ZST-0001), SKU lub nazwa składnika…"
            className="input-field w-full !pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="input-field sm:w-52"
          aria-label="Sortowanie"
        >
          <option value="name">Sortuj: nazwa A–Z</option>
          <option value="code">Sortuj: kod katalogowy</option>
          <option value="new">Sortuj: najnowsze</option>
          <option value="avail">Sortuj: dostępność</option>
        </select>
      </div>

      <div
        className="flex gap-1 rounded-xl border border-stone-200/90 bg-stone-100/90 p-1 dark:border-slate-800 dark:bg-slate-900/60"
        role="tablist"
        aria-label="Rodzaj zestawów"
      >
        {(['baselinker', 'own'] as const).map((key) => {
          const count = key === 'baselinker' ? baselinkerKits.length : ownKits.length;
          const active = segment === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSegment(key)}
              className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-none sm:px-4 ${
                active
                  ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
                  : 'text-stone-600 hover:text-stone-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {KIT_SEGMENT_LABELS[key]}
              <span className={`ml-1.5 tabular-nums ${active ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {visibleKits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 py-16 text-center dark:border-slate-700 dark:bg-transparent">
          <Package className="mx-auto h-12 w-12 text-stone-400 dark:text-slate-600" />
          <p className="mt-3 text-stone-700 dark:text-slate-400">
            {query ? 'Brak zestawów pasujących do wyszukiwania' : segment === 'baselinker' ? 'Brak zestawów BaseLinker' : 'Brak własnych zestawów'}
          </p>
          {!query && (
            <p className="mt-1 text-sm text-slate-500">
              {segment === 'baselinker'
                ? 'Użyj „Porównaj skład z BaseLinkerem”, żeby pobrać zestawy z BL.'
                : 'Dodaj pierwszy zestaw, np. „Lanca do myjni Karcher HD".'}
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-500">
            {visibleKits.length === segmentKits.length ? `${visibleKits.length} zestawów` : `${visibleKits.length} z ${segmentKits.length} zestawów`}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleKits.map((kit) => {
              const avail = kitAvailability(kit.items, productLookup, getAvailableQty);
              const linked = kitLinkedCount(kit.items, productLookup);
              const value = showPrices ? kitValue(kit, productLookup) : null;
              return (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() => setOpenId(kit.id)}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-400/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-sky-500/50"
                >
                  <div className="relative">
                    <KitCover kit={kit} lookup={productLookup} className="aspect-[4/3] w-full" />
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      {kit.code && (
                        <span className="rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur">{kit.code}</span>
                      )}
                    </div>
                    {(isBaselinkerKit(kit) || kit.blId != null) && (
                      <div className="absolute right-2 top-2">
                        <BlBadge kit={kit} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <h3 className="line-clamp-2 text-sm font-semibold text-stone-900 dark:text-slate-100">{kit.name}</h3>
                    <p className="text-xs text-stone-500 dark:text-slate-400">
                      {kit.items.length} składników · {kit.category}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                      {avail && (
                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                            avail.count > 0
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                          }`}
                        >
                          {avail.count > 0 ? `do złożenia: ${avail.count}` : 'brak składnika'}
                        </span>
                      )}
                      {linked < kit.items.length && (
                        <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          {linked}/{kit.items.length} w katalogu
                        </span>
                      )}
                      {value && value.gross > 0 && (
                        <span className="ml-auto text-xs font-semibold text-stone-700 dark:text-slate-300">{formatPricePln(value.gross)}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {openKit && (
        <KitDetailModal
          kit={openKit}
          kits={kits}
          products={products}
          lookup={productLookup}
          canEdit={!!canEdit}
          canExportBl={!!canSyncBl}
          showPrices={showPrices}
          onClose={() => setOpenId(null)}
          onChanged={onKitsChange}
          onEdit={() => {
            setEditingKit(openKit);
            setShowEditor(true);
            setOpenId(null);
          }}
          onAddToOrder={
            canAddToOrder
              ? () => {
                  addKitToOrderDraft(openKit, 1, (id, sku) => {
                    const p = productLookup.byId.get(id) || (sku ? productLookup.bySku.get(sku.toUpperCase()) : undefined);
                    return p ? getProductImage(p) || undefined : undefined;
                  });
                  onOrderDraftChange?.();
                  showToast(`Zestaw „${openKit.name}” dodany do zamówienia`, 'ok');
                }
              : undefined
          }
        />
      )}

      {showSync && <KitSyncModal kits={kits} products={products} onClose={() => setShowSync(false)} onApplied={onKitsChange} />}

      {showEditor && (
        <KitEditor
          kit={editingKit}
          kits={kits}
          products={products}
          productLookup={productLookup}
          onClose={() => {
            setShowEditor(false);
            setEditingKit(null);
          }}
          onSaved={() => {
            setShowEditor(false);
            setEditingKit(null);
            onKitsChange();
          }}
        />
      )}
    </div>
  );
}

function KitDetailModal({
  kit,
  kits,
  lookup,
  canEdit,
  canExportBl,
  showPrices,
  onClose,
  onChanged,
  onEdit,
  onAddToOrder,
}: {
  kit: Kit;
  kits: Kit[];
  products: Product[];
  lookup: ReturnType<typeof buildProductLookup>;
  canEdit: boolean;
  canExportBl: boolean;
  showPrices: boolean;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
  onAddToOrder?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const own = isOwnKit(kit);
  const avail = kitAvailability(kit.items, lookup, getAvailableQty);
  const value = kitValue(kit, lookup);

  async function changeImage(file: File) {
    setBusy('image');
    try {
      await uploadKitImage(kit.id, file);
      showToast('Zdjęcie zestawu zmienione', 'ok');
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się zmienić zdjęcia', 'error', 7000);
    } finally {
      setBusy(null);
    }
  }

  async function duplicate() {
    setBusy('copy');
    try {
      await saveKit({
        name: `${kit.name} (kopia)`,
        description: kit.description,
        category: OWN_KIT_DEFAULT_CATEGORY,
        items: kit.items,
        imageUrl: kit.imageUrl,
        createdAt: Date.now(),
        code: nextKitCode(kits),
      });
      showToast('Utworzono własny zestaw na podstawie tego — znajdziesz go w „Własne / techniczne”', 'ok', 6000);
      onChanged();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się powielić zestawu', 'error', 7000);
    } finally {
      setBusy(null);
    }
  }

  async function exportToBl() {
    const code = kit.code ?? nextKitCode(kits);
    if (
      !(await confirmDialog({
        title: 'Wysłać zestaw do BaseLinkera?',
        confirmLabel: 'Wyślij',
        message: `Zestaw „${kit.name}” zostanie utworzony w BaseLinkerze jako zestaw (bundle) z ${kit.items.length} składnikami, SKU: ${code}. Składniki muszą być powiązane z BaseLinkerem. Cena = suma cen składników brutto (${formatPricePln(value.gross)}), którą możesz potem zmienić w BL.`,
      }))
    )
      return;
    setBusy('export');
    try {
      const res = await exportKitToBaselinker({
        code,
        name: kit.name,
        description: kit.description,
        imageUrl: kit.imageUrl,
        priceGross: value.gross > 0 ? value.gross : undefined,
        items: kit.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      });
      await saveKit({ ...kit, code, blId: res.blId, blActive: true });
      showToast(`Zestaw wysłany do BaseLinkera (SKU ${res.sku}, ${res.components} składników)`, 'ok', 7000);
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Eksport do BaseLinkera nie powiódł się', 'error', 9000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-stone-200 bg-white sm:rounded-3xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-slate-800">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {kit.code && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(kit.code ?? '');
                  showToast('Skopiowano kod ' + kit.code, 'ok');
                }}
                className="inline-flex items-center gap-1 rounded-md bg-stone-900 px-2 py-0.5 font-mono text-xs font-bold text-white hover:bg-stone-700"
                title="Kopiuj kod katalogowy"
              >
                {kit.code}
                <Copy className="h-3 w-3" />
              </button>
            )}
            {(isBaselinkerKit(kit) || kit.blId != null) && <BlBadge kit={kit} />}
            <span className="text-xs text-stone-500 dark:text-slate-400">{kit.category}</span>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[18rem_1fr]">
          <div className="space-y-2 border-b border-stone-200 p-4 md:border-b-0 md:border-r dark:border-slate-800">
            <KitCover kit={kit} lookup={lookup} className="aspect-square w-full rounded-2xl" />
            {canEdit && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void changeImage(f);
                  }}
                />
                <button
                  type="button"
                  disabled={busy === 'image'}
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {busy === 'image' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {kit.imageUrl ? 'Zmień zdjęcie główne' : 'Dodaj zdjęcie główne'}
                </button>
                {!kit.imageUrl && (
                  <p className="text-[11px] text-stone-500 dark:text-slate-500">Bez własnego zdjęcia pokazujemy mozaikę zdjęć składników.</p>
                )}
              </>
            )}
          </div>

          <div className="min-w-0 space-y-3 p-4">
            <div>
              <h3 className="text-xl font-bold text-stone-900 dark:text-slate-50">{kit.name}</h3>
              {kit.description && <p className="mt-1 text-sm text-stone-600 dark:text-slate-400">{kit.description}</p>}
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {avail && (
                <span
                  className={`rounded-lg px-2.5 py-1 font-semibold ${
                    avail.count > 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'
                  }`}
                >
                  {avail.count > 0 ? `Do złożenia: ${avail.count} kompletów` : `Brak: ${avail.limiting}`}
                  {avail.count > 0 && <span className="font-normal opacity-80"> (ogranicza: {avail.limiting})</span>}
                </span>
              )}
              {showPrices && value.gross > 0 && (
                <span className="rounded-lg bg-stone-100 px-2.5 py-1 font-semibold text-stone-800 dark:bg-slate-800 dark:text-slate-200">
                  Wartość składników: {formatPricePln(value.gross)}
                  {value.priced < value.total && <span className="font-normal opacity-70"> ({value.priced}/{value.total} z ceną)</span>}
                </span>
              )}
            </div>

            <ul className="space-y-2">
              {kit.items.map((item: KitItem, i: number) => {
                const prod = resolveKitItemProduct(item, lookup);
                const img = prod ? getProductImage(prod) : null;
                const have = prod ? getAvailableQty(prod) : null;
                return (
                  <li
                    key={`${item.productId}-${item.sku}-${i}`}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                      prod
                        ? 'border border-stone-200/80 bg-stone-50 dark:border-slate-700/50 dark:bg-slate-800/50'
                        : 'border border-dashed border-amber-300/80 bg-amber-50/90 dark:border-amber-800/50 dark:bg-amber-950/20'
                    }`}
                  >
                    {img ? (
                      <img src={img} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-400 dark:bg-slate-900 dark:text-slate-600">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    )}
                    <span className="w-9 shrink-0 text-center font-mono text-sm font-bold text-emerald-700 dark:text-brand-400">{item.quantity}×</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-stone-900 dark:text-slate-200">{prod?.displayName || item.name}</p>
                      <p className="font-mono text-[11px] text-stone-500 dark:text-slate-500">{item.sku || '—'}</p>
                    </div>
                    {have != null && (
                      <span
                        className={`shrink-0 text-[11px] font-semibold ${
                          have >= item.quantity ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        stan: {have}
                      </span>
                    )}
                    {!prod && <span className="shrink-0 text-[10px] font-medium text-amber-700 dark:text-amber-400">brak w katalogu</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-stone-200 bg-stone-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
          {onAddToOrder && (
            <button
              type="button"
              onClick={onAddToOrder}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
            >
              <ShoppingCart className="h-4 w-4" />
              Do zamówienia
            </button>
          )}
          {own && canEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Edytuj
            </button>
          )}
          {!own && canEdit && (
            <button
              type="button"
              disabled={busy === 'copy'}
              onClick={() => void duplicate()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Tworzy własny zestaw z tym samym składem, który można dowolnie zmieniać"
            >
              <Copy className="h-4 w-4" />
              Powiel jako własny
            </button>
          )}
          {own && canExportBl && kit.blId == null && (
            <button
              type="button"
              disabled={busy === 'export'}
              onClick={() => void exportToBl()}
              className="flex items-center gap-1.5 rounded-lg border border-sky-500/60 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-500/10 disabled:opacity-50 dark:text-sky-300"
            >
              {busy === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Wyślij do BaseLinkera
            </button>
          )}
          {own && canEdit && (
            <button
              type="button"
              onClick={async () => {
                if (
                  await confirmDialog({
                    title: 'Usunąć zestaw?',
                    tone: 'danger',
                    message: `Zestaw „${kit.name}” zostanie usunięty z katalogu${kit.blId != null ? ' (w BaseLinkerze zostanie bez zmian)' : ''}.`,
                  })
                ) {
                  await deleteKit(kit.id);
                  onChanged();
                  onClose();
                }
              }}
              className="ml-auto rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              <Trash2 className="mr-1 inline h-4 w-4" />
              Usuń
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function KitEditor({
  kit,
  kits,
  products,
  productLookup,
  onClose,
  onSaved,
}: {
  kit: Kit | null;
  kits: Kit[];
  products: Product[];
  productLookup: ReturnType<typeof buildProductLookup>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(kit?.name ?? '');
  const [description, setDescription] = useState(kit?.description ?? '');
  const [category, setCategory] = useState(
    kit?.category ?? OWN_KIT_DEFAULT_CATEGORY,
  );
  const [items, setItems] = useState<KitItem[]>(kit?.items ?? []);
  const [imageUrl, setImageUrl] = useState(kit?.imageUrl ?? '');
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(kit?.imageUrl ?? '');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim().length >= 2
    ? filterProducts(products, search, 'Wszystkie').slice(0, 8)
    : [];

  function addItem(product: Product) {
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        ),
      );
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          sku: product.sku,
          name: product.displayName,
          quantity: 1,
        },
      ]);
    }
    setSearch('');
  }

  function pickImage(file: File) {
    setPendingImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!name.trim() || items.length === 0) {
      showToast('Podaj nazwę i dodaj co najmniej 1 element', 'warn');
      return;
    }
    setSaving(true);
    try {
      const id = await saveKit({
        id: kit?.id,
        name: name.trim(),
        description: description.trim(),
        category,
        items,
        imageUrl: imageUrl || undefined,
        createdAt: kit?.createdAt ?? Date.now(),
        code: kit?.code ?? nextKitCode(kits),
        blId: kit?.blId,
        blActive: kit?.blActive,
      });
      if (pendingImage) {
        const url = await uploadKitImage(id, pendingImage);
        setImageUrl(url);
      }
      showToast('Zestaw zapisany', 'ok');
      onSaved();
    } catch (err) {
      console.error(err);
      showToast('Błąd zapisu zestawu', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-fade-in max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-stone-200 bg-white sm:rounded-3xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <h3 className="font-semibold text-stone-900 dark:text-slate-100">
            {kit ? 'Edytuj zestaw' : 'Nowy zestaw'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <Field label="Zdjęcie zestawu">
            <div className="flex items-center gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-stone-100 dark:bg-slate-800">
                {previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-8 w-8 text-slate-600" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickImage(f);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickImage(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2 text-xs font-medium text-white"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Zdjęcie
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-300"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Plik
                </button>
              </div>
            </div>
          </Field>

          <Field label="Nazwa zestawu">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Lanca kompletna — myjnia Karcher HD"
              className="input-field"
            />
          </Field>

          <Field label="Opis (opcjonalnie)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Do czego służy, na jaką myjnię..."
              rows={2}
              className="input-field resize-none"
            />
          </Field>

          <Field label="Kategoria">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="np. Lance, Myjnia samochodowa"
              className="input-field"
            />
          </Field>

          <Field label="Dodaj elementy">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Szukaj produktu po SKU, nazwie lub EAN..."
              onScanClick={() => setShowScanner(true)}
            />
            {filtered.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-stone-200 dark:border-slate-700">
                {filtered.map((p) => {
                  const img = getProductImage(p);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addItem(p)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-slate-800"
                      >
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-md object-contain bg-stone-100 dark:bg-slate-900"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-stone-100 text-stone-400 dark:bg-slate-900 dark:text-slate-600">
                            <ImageOff className="h-4 w-4" />
                          </div>
                        )}
                        <span className="font-mono text-xs text-emerald-700 dark:text-brand-400">
                          {p.sku}
                        </span>
                        <span className="truncate text-stone-800 dark:text-slate-300">
                          {p.displayName}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Field>

          {items.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Elementy ({items.length})
              </p>
              <ul className="space-y-1">
                {items.map((item, i) => {
                  const prod = resolveKitItemProduct(item, productLookup);
                  const img = prod ? getProductImage(prod) : null;
                  return (
                    <li
                      key={`${item.productId}-${item.sku}-${i}`}
                      className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
                    >
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-md object-contain bg-white dark:bg-slate-900"
                        />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded-md bg-stone-200 dark:bg-slate-900" />
                      )}
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 1;
                          setItems(
                            items.map((it, idx) =>
                              idx === i ? { ...it, quantity: qty } : it,
                            ),
                          );
                        }}
                        className="w-12 rounded border border-stone-300 bg-white px-1 py-0.5 text-center text-sm dark:border-slate-600 dark:bg-slate-900"
                      />
                      <span className="font-mono text-xs text-emerald-700 dark:text-brand-400">
                        {item.sku}
                      </span>
                      <span className="flex-1 truncate text-sm text-stone-800 dark:text-slate-300">
                        {prod?.displayName || item.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-medium text-white transition hover:bg-brand-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? 'Zapisywanie...' : 'Zapisz zestaw'}
          </button>
        </div>
      </div>

      {showScanner && (
        <BarcodeScanner
          onScan={(code) => {
            setSearch(code);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
