import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Gauge, Loader2, ScanSearch, Square, Wand2 } from 'lucide-react';
import type { Product } from '../types';
import { getProductImage, updateProductImage } from '../lib/products';
import { backupPrimaryImageForRevert } from '../lib/productImageRevert';
import { setCachedDims } from '../lib/imageDims';
import {
  formatFromMime,
  getCachedWeight,
  isOwnImageUrl,
  scanImageWeights,
  setCachedWeight,
} from '../lib/imageWeights';
import {
  formatBytes,
  getImagePolicy,
  optimizeImage,
  setImagePolicy,
  type OptimizePolicy,
} from '../lib/imageOptimize';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';

const PAGE = 100;

interface Props {
  products: Product[];
  onProductClick: (p: Product) => void;
  onImageUpdated: (productId: string, url: string) => void;
  canEdit: boolean;
}

interface Row {
  product: Product;
  url: string;
  bytes: number;
  mime: string;
}

type Filter = 'need' | 'heavy' | 'format' | 'all';

/** Waga i format zdjęć: skan, lista najcięższych i hurtowa optymalizacja (JPG/PNG, limit KB, max bok). */
export function CatalogImageWeightPanel({ products, onProductClick, onImageUpdated, canEdit }: Props) {
  const [policy, setPolicy] = useState<OptimizePolicy>(() => getImagePolicy());
  const [version, setVersion] = useState(0);
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('need');
  const [work, setWork] = useState<{ done: number; total: number; current: string } | null>(null);
  const [limit, setLimit] = useState(PAGE);

  function updatePolicy(patch: Partial<OptimizePolicy>) {
    const next = { ...policy, ...patch };
    setPolicy(next);
    setImagePolicy(next);
  }

  const { own, external } = useMemo(() => {
    const own: { product: Product; url: string }[] = [];
    let external = 0;
    for (const product of products) {
      const url = getProductImage(product);
      if (!url) continue;
      if (isOwnImageUrl(url)) own.push({ product, url });
      else external++;
    }
    return { own, external };
  }, [products]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const { product, url } of own) {
      const w = getCachedWeight(url);
      if (w) out.push({ product, url, bytes: w[0], mime: w[1] });
    }
    return out.sort((a, b) => b.bytes - a.bytes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own, version]);

  const targetBytes = policy.targetKB * 1024;
  const isBadFormat = (r: Row) => /webp|avif|gif/i.test(r.mime);
  const needs = (r: Row) => r.bytes > targetBytes || isBadFormat(r);

  const stats = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.bytes, 0);
    const over = rows.filter((r) => r.bytes > targetBytes);
    const bad = rows.filter(isBadFormat);
    const needN = rows.filter(needs).length;
    const overBytes = over.reduce((s, r) => s + r.bytes, 0);
    return { total, over: over.length, bad: bad.length, needN, overBytes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, targetBytes]);

  const list = useMemo(() => {
    switch (filter) {
      case 'need':
        return rows.filter(needs);
      case 'heavy':
        return rows.filter((r) => r.bytes > targetBytes);
      case 'format':
        return rows.filter(isBadFormat);
      default:
        return rows;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, targetBytes]);

  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(list.map((r) => r.product.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [list]);

  const measured = own.filter((x) => getCachedWeight(x.url)).length;

  const startScan = useCallback(async () => {
    stopRef.current = false;
    setScan({ done: 0, total: 0 });
    try {
      let tick = 0;
      const n = await scanImageWeights(
        own.map((x) => x.url),
        {
          onProgress: setScan,
          shouldStop: () => stopRef.current,
          onMeasured: () => {
            tick++;
            if (tick % 40 === 0) setVersion((v) => v + 1);
          },
        },
      );
      setVersion((v) => v + 1);
      showToast(stopRef.current ? `Zatrzymano — zmierzono ${n}` : `Zmierzono wagę ${n} zdjęć`, 'ok', 4000);
    } finally {
      setScan(null);
    }
  }, [own]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function optimizeSelected() {
    const targets = list.filter((r) => selected.has(r.product.id));
    if (targets.length === 0) return;
    if (
      !(await confirmDialog({
        title: `Zoptymalizować ${targets.length} zdjęć?`,
        tone: 'warn',
        confirmLabel: 'Optymalizuj',
        message: `Zdjęcia zostaną zapisane jako JPG${policy.alpha === 'png' ? ' (z przezroczystością jako PNG)' : ' na białym tle'}, do ${policy.maxSide} px dłuższego boku i ok. ${policy.targetKB} KB. Dla każdego produktu powstanie kopia, którą można przywrócić na karcie produktu. Zdjęcia w BaseLinkerze zmienią się dopiero po ich ponownym wysłaniu.`,
      }))
    )
      return;

    let ok = 0;
    let skipped = 0;
    let saved = 0;
    const failed: string[] = [];
    setWork({ done: 0, total: targets.length, current: '' });
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      setWork({ done: i, total: targets.length, current: r.product.sku || r.product.displayName });
      try {
        const res = await optimizeImage(r.url, policy);
        const lighter = res.bytes < r.bytes * 0.95;
        if (res.tooSmall || (!lighter && !isBadFormat(r))) {
          skipped++;
          continue;
        }
        await backupPrimaryImageForRevert(r.product.id, r.url);
        const file = new File([res.blob], `${r.product.sku || r.product.id}.${res.format}`, {
          type: res.format === 'png' ? 'image/png' : 'image/jpeg',
        });
        const newUrl = await updateProductImage(r.product.id, file, { skipCompress: true });
        setCachedWeight(newUrl, [res.bytes, file.type]);
        setCachedDims(newUrl, [res.width, res.height]);
        onImageUpdated(r.product.id, newUrl);
        saved += Math.max(0, r.bytes - res.bytes);
        ok++;
      } catch (err) {
        console.error('Optymalizacja zdjęcia', r.product.sku, err);
        failed.push(r.product.sku || r.product.displayName);
      }
    }
    setWork(null);
    setSelected(new Set());
    setVersion((v) => v + 1);
    const msg = `Zoptymalizowano ${ok} (oszczędność ${formatBytes(saved)})${skipped ? `, pominięto ${skipped} (już lekkie lub za małe)` : ''}`;
    if (failed.length === 0) showToast(msg, 'ok', 7000);
    else showToast(`${msg}; błąd: ${failed.length} (${failed.slice(0, 5).join(', ')})`, 'warn', 9000);
  }

  const visible = list.slice(0, limit);
  const allSelected = list.length > 0 && selected.size === list.length;
  const busy = !!work || !!scan;
  const sel = 'rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <Gauge className="h-4 w-4 text-brand-400" />
              Waga i format zdjęć
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Zmierzono {measured} z {own.length} zdjęć we własnym magazynie
              {external > 0 ? ` (pominięto ${external} zdjęć zewnętrznych, np. z BaseLinkera)` : ''}
              {measured > 0 && (
                <>
                  {' '}
                  · razem <b className="text-slate-200">{formatBytes(stats.total)}</b> · ponad limit:{' '}
                  <b className="text-amber-300">{stats.over}</b> · WebP/GIF: <b className="text-amber-300">{stats.bad}</b>
                </>
              )}
            </p>
          </div>
          {scan ? (
            <button
              type="button"
              onClick={() => {
                stopRef.current = true;
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              <Square className="h-4 w-4" />
              Zatrzymaj ({scan.done}/{scan.total})
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || measured >= own.length}
              onClick={() => void startScan()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              <ScanSearch className="h-4 w-4" />
              {measured === 0 ? 'Skanuj wagę zdjęć' : 'Skanuj pozostałe'}
            </button>
          )}
        </div>
        {scan && scan.total > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${Math.round((scan.done / scan.total) * 100)}%` }}
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-800 pt-3">
          <label className="text-[11px] text-slate-400">
            Limit wagi
            <select
              className={`${sel} mt-0.5 block`}
              value={policy.targetKB}
              onChange={(e) => updatePolicy({ targetKB: Number(e.target.value) })}
            >
              {[60, 80, 100, 120, 150, 200, 300].map((n) => (
                <option key={n} value={n}>
                  do {n} KB
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-slate-400">
            Maks. dłuższy bok
            <select
              className={`${sel} mt-0.5 block`}
              value={policy.maxSide}
              onChange={(e) => updatePolicy({ maxSide: Number(e.target.value) })}
            >
              {[800, 1000, 1200, 1600, 2000].map((n) => (
                <option key={n} value={n}>
                  {n} px
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-slate-400">
            Zdjęcia z przezroczystością
            <select
              className={`${sel} mt-0.5 block`}
              value={policy.alpha}
              onChange={(e) => updatePolicy({ alpha: e.target.value === 'jpg' ? 'jpg' : 'png' })}
            >
              <option value="png">Zostaw PNG (przezroczyste tło)</option>
              <option value="jpg">JPG na białym tle (lżejsze)</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 pb-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={policy.autoOnUpload}
              onChange={(e) => updatePolicy({ autoOnUpload: e.target.checked })}
            />
            Optymalizuj automatycznie każde nowo wgrane zdjęcie
          </label>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Format wyjściowy to zawsze JPG albo PNG. Jakość JPG jest dobierana tak, żeby plik zmieścił się w limicie; gdy to
          za mało, zmniejszamy wymiary (nigdy poniżej 500 px krótszego boku). Ustawienia dotyczą tej przeglądarki.
        </p>
      </div>

      {measured > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <select className={sel} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="need">Do optymalizacji ({stats.needN})</option>
            <option value="heavy">Ponad limit wagi ({stats.over})</option>
            <option value="format">Zły format — WebP/GIF ({stats.bad})</option>
            <option value="all">Wszystkie zmierzone ({rows.length})</option>
          </select>
          {canEdit && list.length > 0 && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSelected(allSelected ? new Set() : new Set(list.map((r) => r.product.id)))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allSelected ? 'Odznacz wszystkie' : `Zaznacz wszystkie (${list.length})`}
              </button>
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={() => void optimizeSelected()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {work ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {work
                  ? `Optymalizuję ${work.done + 1}/${work.total}… ${work.current}`
                  : `Optymalizuj zaznaczone (${selected.size})`}
              </button>
            </>
          )}
        </div>
      )}

      {measured === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">
          Kliknij „Skanuj wagę zdjęć” — skan jest lekki (sprawdza rozmiar plików, nie pobiera ich).
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">
          Brak zdjęć w tym widoku — wszystko mieści się w limicie.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => {
            const fmt = formatFromMime(r.mime);
            const heavy = r.bytes > targetBytes;
            return (
              <li
                key={r.product.id}
                className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                  selected.has(r.product.id) ? 'border-amber-500/50 bg-amber-500/10' : 'border-slate-800 bg-slate-900/80'
                }`}
              >
                {canEdit && (
                  <input
                    type="checkbox"
                    checked={selected.has(r.product.id)}
                    disabled={busy}
                    onChange={() => toggle(r.product.id)}
                    className="h-4 w-4 shrink-0 accent-amber-500"
                    aria-label={`Zaznacz ${r.product.sku}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => onProductClick(r.product)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <img src={r.url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-100">
                      {r.product.displayName || r.product.name}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-slate-500">{r.product.sku}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className={`block text-sm font-semibold tabular-nums ${heavy ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {formatBytes(r.bytes)}
                    </span>
                    <span
                      className={`block text-[11px] ${/webp|gif|avif/i.test(r.mime) ? 'font-semibold text-red-300' : 'text-slate-500'}`}
                    >
                      {fmt}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > visible.length && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Pokaż więcej ({list.length - visible.length})
        </button>
      )}
    </div>
  );
}
