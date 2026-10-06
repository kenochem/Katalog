import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import type { Product } from '../../types';
import {
  fetchBaselinkerProduct,
  invalidateBaselinkerProduct,
  pushToBaselinker,
  type BaselinkerField,
  type BaselinkerProduct,
} from '../../lib/baselinkerApi';
import { useAuth } from '../../lib/auth';
import { showToast } from '../../lib/toast';
import { formatPricePln } from '../../lib/format';

function Row({
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
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-t border-slate-800/70 py-1.5 text-sm first:border-t-0">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="tabular-nums text-slate-300" title="Katalog (WAPRO)">
        {ours}
      </span>
      <span
        className={`min-w-[5.5rem] text-right font-semibold tabular-nums ${
          same === null ? 'text-slate-400' : same ? 'text-emerald-400' : 'text-amber-400'
        }`}
        title="BaseLinker"
      >
        {bl}
      </span>
    </div>
  );
}

/** Podgląd produktu w BaseLinkerze + porównanie ze stanem/ceną z WAPRO. */
export function BaselinkerProductPanel({ product }: { product: Product }) {
  const [data, setData] = useState<BaselinkerProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState<BaselinkerField | null>(null);
  const { role } = useAuth();
  const isAdmin = role === 'admin';

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
      setData(await fetchBaselinkerProduct(product.sku, force));
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-sky-400">BaseLinker</p>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          title="Pobierz ponownie z BaseLinkera"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </button>
      </div>

      {loading && !data && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Pobieram z BaseLinkera…
        </p>
      )}

      {error && (
        <p className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-300">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {data && !data.found && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Nie znaleziono SKU {product.sku} w BaseLinkerze — produkt nie jest tam wystawiony albo ma inne SKU.
        </p>
      )}

      {data?.found && (
        <>
          <p className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            W BaseLinkerze · ID {data.id}
            {data.isBundle ? ' · zestaw' : ''}
          </p>
          <p className="truncate text-xs text-slate-400" title={data.name}>
            {data.name}
          </p>

          <div>
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              <span />
              <span>Katalog</span>
              <span className="min-w-[5.5rem] text-right">BaseLinker</span>
            </div>
            <Row
              label="Stan"
              ours={String(Math.max(0, Math.floor(product.stock ?? 0)))}
              bl={String(data.stock ?? 0)}
              same={stockSame}
            />
            <Row
              label="Cena brutto"
              ours={ourGross != null ? formatPricePln(ourGross) : '—'}
              bl={data.priceGross != null ? formatPricePln(data.priceGross) : '—'}
              same={priceSame}
            />
            <Row
              label="EAN"
              ours={product.ean || '—'}
              bl={data.ean || '—'}
              same={eanSame}
            />
          </div>

          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">
              Zdjęć: {data.imageCount ?? 0}
            </span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">
              Opis: {data.descriptionLength ? `${data.descriptionLength} zn.` : 'brak'}
            </span>
            {data.taxRate != null && (
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">VAT {data.taxRate}%</span>
            )}
            {data.weight != null && Number(data.weight) > 0 && (
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-300">{data.weight} kg</span>
            )}
          </div>

          {!!data.images?.length && (
            <div className="flex gap-1.5 overflow-x-auto">
              {data.images.slice(0, 5).map((u) => (
                <img key={u} src={u} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" />
              ))}
            </div>
          )}

          {(stockSame === false || priceSame === false) && (
            <p className="text-[11px] text-amber-400">
              Wartości w BaseLinkerze różnią się od katalogu (WAPRO).
              {!isAdmin && ' Korektę robi administrator.'}
            </p>
          )}
          {isAdmin && (stockSame === false || priceSame === false) && (
            <div className="flex flex-wrap gap-2">
              {stockSame === false && (
                <button
                  type="button"
                  disabled={pushing !== null}
                  onClick={() => void pushField('stock')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {pushing === 'stock' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Ustaw stan w BL = {Math.max(0, Math.floor(product.stock ?? 0))}
                </button>
              )}
              {priceSame === false && (
                <button
                  type="button"
                  disabled={pushing !== null}
                  onClick={() => void pushField('price')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {pushing === 'price' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Ustaw cenę w BL = {ourGross != null ? formatPricePln(ourGross) : '—'}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
