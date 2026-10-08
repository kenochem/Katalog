import { useEffect, useState } from 'react';
import { confirmDialog } from '../../lib/dialog';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import type { Product } from '../../types';
import {
  fetchBaselinkerProduct,
  fetchImageStatus,
  invalidateBaselinkerProduct,
  pushImagesToBaselinker,
  pushToBaselinker,
  importToBaselinker,
  type BaselinkerField,
  type BaselinkerProduct,
  type ImageStatusRow,
} from '../../lib/baselinkerApi';
import { useAuth } from '../../lib/auth';
import { roleCan } from '../../lib/roles';
import { markBaselinkerLinked, markBaselinkerUnlinked } from '../../lib/baselinkerLive';
import { updateProduct } from '../../lib/products';
import { mergeProductMeta } from '../../lib/productMeta';
import { showToast } from '../../lib/toast';
import { formatPricePln } from '../../lib/format';

function Cell({
  label,
  ours,
  bl,
  same,
}: {
  label: string;
  ours: string;
  bl: string;
  same: boolean | null;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-800/80 bg-slate-950/40 px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 flex items-baseline justify-between gap-2 text-sm tabular-nums">
        <span className="truncate text-slate-300" title="Katalog (WAPRO)">
          {ours}
        </span>
        <span
          className={`truncate font-semibold ${
            same === null ? 'text-slate-400' : same ? 'text-emerald-400' : 'text-amber-400'
          }`}
          title="BaseLinker"
        >
          {bl}
        </span>
      </p>
    </div>
  );
}

/** Podgląd produktu w BaseLinkerze + porównanie ze stanem/ceną z WAPRO. */
export function BaselinkerProductPanel({ product }: { product: Product }) {
  const [data, setData] = useState<BaselinkerProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState<BaselinkerField | null>(null);
  const [skipStock, setSkipStock] = useState(Boolean(product.meta?.baselinkerSkipStock));
  const [skipPrice, setSkipPrice] = useState(Boolean(product.meta?.baselinkerSkipPrice));
  const [savingFlag, setSavingFlag] = useState(false);

  useEffect(() => {
    setSkipStock(Boolean(product.meta?.baselinkerSkipStock));
    setSkipPrice(Boolean(product.meta?.baselinkerSkipPrice));
  }, [product.id, product.meta?.baselinkerSkipStock, product.meta?.baselinkerSkipPrice]);

  async function saveSkipFlag(key: 'baselinkerSkipStock' | 'baselinkerSkipPrice', value: boolean) {
    const setter = key === 'baselinkerSkipStock' ? setSkipStock : setSkipPrice;
    setter(value);
    setSavingFlag(true);
    try {
      await updateProduct(product.id, { meta: mergeProductMeta(product.meta, { [key]: value }) });
      showToast(value ? 'Produkt będzie pomijany w synchronizacji grupowej' : 'Produkt wraca do synchronizacji grupowej', 'ok');
    } catch (err) {
      setter(!value);
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 6000);
    } finally {
      setSavingFlag(false);
    }
  }
  const { role } = useAuth();
  const isAdmin = roleCan(role, 'manageBaselinker');

  const [importing, setImporting] = useState(false);
  const [img, setImg] = useState<ImageStatusRow | null>(null);
  const [imgBusy, setImgBusy] = useState(false);

  async function loadImages() {
    try {
      const [row] = await fetchImageStatus([product.sku]);
      setImg(row ?? null);
    } catch {
      setImg(null);
    }
  }

  async function pushImages() {
    if (!img || img.missingCount === 0) return;
    if (
      !(await confirmDialog({
        title: 'Dołożyć zdjęcia do BaseLinkera?',
        tone: 'warn',
        confirmLabel: 'Dołóż zdjęcia',
        message: `Do produktu ${product.sku} w BaseLinkerze zostanie dołożonych ${img.missingCount} zdjęć z katalogu.\n\nObecne zdjęcia w BaseLinkerze (${img.blCount}) zostają bez zmian — nic nie jest usuwane, nowe trafiają na koniec.`,
      }))
    )
      return;
    setImgBusy(true);
    try {
      const r = await pushImagesToBaselinker([product.sku]);
      const row = r.results[0];
      if (row?.status === 'ok') showToast(`Dołożono ${row.added} zdjęć do BaseLinkera`, 'ok', 5000);
      else if (row?.status === 'warning') showToast(row.reason || 'Sprawdź produkt w BaseLinkerze', 'warn', 9000);
      else showToast(row?.reason || 'Nic nie dołożono', row?.status === 'error' ? 'error' : 'warn', 7000);
      invalidateBaselinkerProduct(product.sku);
      await load(true);
      await loadImages();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd wysyłki zdjęć', 'error', 6000);
    } finally {
      setImgBusy(false);
    }
  }

  async function importThis() {
    if (
      !(await confirmDialog({
        title: 'Dodać produkt do BaseLinkera?',
        tone: 'warn',
        confirmLabel: 'Dodaj do BaseLinkera',
        message: `Produkt ${product.sku} trafi do głównego katalogu BaseLinkera.\n\nZostaną przesłane: nazwa, opis, ceny (sprzedaż brutto i zakup netto), stan, EAN, waga, wymiary, zdjęcia, kategoria i producent (jeśli istnieją w BL).`,
      }))
    )
      return;
    setImporting(true);
    try {
      const [r] = await importToBaselinker([product.sku]);
      if (r.status === 'created') {
        showToast(
          r.warnings?.length ? `Dodano do BaseLinkera. Ostrzeżenia: ${r.warnings.join('; ')}` : 'Dodano do BaseLinkera',
          r.warnings?.length ? 'warn' : 'ok',
          9000,
        );
        markBaselinkerLinked(product.sku, r.blId ?? 0);
        invalidateBaselinkerProduct(product.sku);
        await load(true);
      } else {
        showToast(r.message || 'Import zablokowany', r.status === 'blocked' ? 'warn' : 'error', 8000);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd importu', 'error', 6000);
    } finally {
      setImporting(false);
    }
  }

  async function pushField(field: BaselinkerField) {
    setPushing(field);
    try {
      const r = await pushToBaselinker([product.sku], [field]);
      const res = r.results[field];
      if (res?.error) throw new Error(res.error);
      if (r.noLinkCount > 0) {
        showToast('Brak powiązania z BaseLinkerem — uruchom najpierw Porównanie w Administracja → BaseLinker', 'warn', 6000);
      } else {
        showToast(field === 'stock' ? 'Stan wysłany do BaseLinkera' : 'Cena wysłana do BaseLinkera', 'ok');
      }
      invalidateBaselinkerProduct(product.sku);
      await load(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd wysyłki', 'error', 6000);
    } finally {
      setPushing(null);
    }
  }

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const fresh = await fetchBaselinkerProduct(product.sku, force);
      setData(fresh);
      if (fresh.found) {
        markBaselinkerLinked(product.sku, fresh.id ?? 0);
        void loadImages();
      } else {
        markBaselinkerUnlinked(product.sku);
        setImg(null);
      }
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.sku]);

  const ourGross = product.priceSaleGross;
  const stockSame = data?.found ? Number(data.stock ?? 0) === Math.max(0, Math.floor(product.stock ?? 0)) : null;
  const priceSame =
    data?.found && data.priceGross != null && ourGross != null
      ? Math.abs(Number(data.priceGross) - Number(ourGross)) < 0.01
      : null;
  const eanSame =
    data?.found && data.ean && product.ean ? data.ean.trim() === String(product.ean).trim() : null;

  return (
    <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-sky-400">
          BaseLinker
          {data?.found && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium normal-case tracking-normal text-emerald-400" title={data.name}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              w BL · ID {data.id}
              {data.isBundle ? ' · zestaw' : ''}
            </span>
          )}
          {loading && !data && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
        </p>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          title="Pobierz ponownie z BaseLinkera"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {data && !data.found && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex min-w-0 flex-1 items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Brak SKU {product.sku} w BaseLinkerze — produkt nie jest tam wystawiony albo ma inne SKU.
          </p>
          {isAdmin && (
            <button
              type="button"
              disabled={importing}
              onClick={() => void importThis()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {importing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Dodaj do BaseLinkera
            </button>
          )}
        </div>
      )}

      {data?.found && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Cell
              label="Stan (kat. → BL)"
              ours={String(Math.max(0, Math.floor(product.stock ?? 0)))}
              bl={String(data.stock ?? 0)}
              same={stockSame}
            />
            <Cell
              label="Cena brutto"
              ours={ourGross != null ? formatPricePln(ourGross) : '—'}
              bl={data.priceGross != null ? formatPricePln(data.priceGross) : '—'}
              same={priceSame}
            />
            <Cell label="EAN" ours={product.ean || '—'} bl={data.ean || '—'} same={eanSame} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">
              Zdjęć w BL: {data.imageCount ?? 0}
              {img ? ` · w katalogu: ${img.oursCount}` : ''}
            </span>
            {img && img.state === 'synced' && (
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-emerald-300">zdjęcia w BL aktualne</span>
            )}
            {img && (img.state === 'none' || img.state === 'partial') && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-amber-300">
                brak w BL: {img.missingCount}
                {img.blOnly > 0 ? ` · inne w BL: ${img.blOnly}` : ''}
              </span>
            )}
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">
              Opis: {data.descriptionLength ? `${data.descriptionLength} zn.` : 'brak'}
            </span>
            {data.taxRate != null && (
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">VAT {data.taxRate}%</span>
            )}
            {data.weight != null && Number(data.weight) > 0 && (
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">{data.weight} kg</span>
            )}
            {(stockSame === false || priceSame === false) && (
              <span className="text-amber-400">
                Różnice względem katalogu{!isAdmin ? ' — korektę robi administrator' : ''}
              </span>
            )}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-800/70 pt-2">
              <button
                type="button"
                disabled={pushing !== null}
                onClick={() => void pushField('stock')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50 ${
                  stockSame === false ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title="Ustawia stan w BaseLinkerze na wartość z katalogu (WAPRO)"
              >
                {pushing === 'stock' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Synchronizuj stan
              </button>
              <button
                type="button"
                disabled={pushing !== null || ourGross == null}
                onClick={() => void pushField('price')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50 ${
                  priceSame === false ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
                }`}
                title="Ustawia cenę brutto w BaseLinkerze na wartość z katalogu (WAPRO)"
              >
                {pushing === 'price' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Synchronizuj cenę
              </button>
              {img && img.missingCount > 0 && (
                <button
                  type="button"
                  disabled={imgBusy || pushing !== null}
                  onClick={() => void pushImages()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                  title="Dokłada brakujące zdjęcia z katalogu do BaseLinkera. Istniejących zdjęć w BL nie usuwa."
                >
                  {imgBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Dołóż zdjęcia ({img.missingCount})
                </button>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pomijaj w grupowej:</span>
              <label
                className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400"
                title="Np. stan własny typu 999999. Przyciski obok działają zawsze."
              >
                <input
                  type="checkbox"
                  checked={skipStock}
                  disabled={savingFlag}
                  onChange={(e) => void saveSkipFlag('baselinkerSkipStock', e.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-500"
                />
                stan
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={skipPrice}
                  disabled={savingFlag}
                  onChange={(e) => void saveSkipFlag('baselinkerSkipPrice', e.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-500"
                />
                cenę
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}
