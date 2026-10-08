import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, Loader2, Maximize2, Play, ScanSearch, Square, Wand2 } from 'lucide-react';
import type { Product } from '../types';
import { getProductImage, updateProductImage } from '../lib/products';
import { backupPrimaryImageForRevert } from '../lib/productImageRevert';
import { prepareImage, BASELINKER_MIN_SIDE, type PrepareMode } from '../lib/imagePrepare';
import { getCachedDims, scanImageDims, setCachedDims } from '../lib/imageDims';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';

const PAGE = 100;

interface Row {
  product: Product;
  url: string;
  w: number;
  h: number;
}

interface Props {
  /** Produkty widoczne w katalogu (bez ukrytych). */
  products: Product[];
  onProductClick: (p: Product) => void;
  onImageUpdated: (productId: string, url: string) => void;
  canEdit: boolean;
}

/** Lista produktow, ktorych zdjecie glowne jest mniejsze niz 500x500 + hurtowa poprawa. */
export function CatalogSmallImagesView({ products, onProductClick, onImageUpdated, canEdit }: Props) {
  const [version, setVersion] = useState(0);
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<PrepareMode>('scale');
  const [fixing, setFixing] = useState<{ done: number; total: number; current: string } | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const withImage = useMemo(() => {
    const out: { product: Product; url: string }[] = [];
    for (const product of products) {
      const url = getProductImage(product);
      if (url) out.push({ product, url });
    }
    return out;
  }, [products]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const measured = useMemo(() => withImage.filter((x) => getCachedDims(x.url)).length, [withImage, version]);

  const small = useMemo<Row[]>(() => {
    const rows: Row[] = [];
    for (const { product, url } of withImage) {
      const d = getCachedDims(url);
      if (d && Math.min(d[0], d[1]) < BASELINKER_MIN_SIDE) rows.push({ product, url, w: d[0], h: d[1] });
    }
    return rows.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withImage, version]);

  const startScan = useCallback(async () => {
    stopRef.current = false;
    setScan({ done: 0, total: 0 });
    try {
      let tick = 0;
      const n = await scanImageDims(
        withImage.map((x) => x.url),
        {
          concurrency: 6,
          shouldStop: () => stopRef.current,
          onProgress: (p) => setScan(p),
          onMeasured: () => {
            tick++;
            if (tick % 20 === 0) setVersion((v) => v + 1);
          },
        },
      );
      setVersion((v) => v + 1);
      showToast(
        stopRef.current ? `Zatrzymano — zmierzono ${n} zdjęć` : `Zmierzono ${n} zdjęć`,
        'ok',
        4000,
      );
    } finally {
      setScan(null);
    }
  }, [withImage]);

  // zaznaczenia nie moga wskazywac wierszy, ktore zniknely z listy
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(small.map((r) => r.product.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [small]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function fixSelected() {
    const rows = small.filter((r) => selected.has(r.product.id));
    if (rows.length === 0) return;
    if (
      !(await confirmDialog({
        title: `Poprawić ${rows.length} zdjęć?`,
        tone: 'warn',
        confirmLabel: 'Popraw',
        message:
          mode === 'square'
            ? 'Zdjęcia zostaną powiększone do min. 500 px i dopełnione do kwadratu. Dla każdego produktu powstanie kopia, którą można przywrócić na karcie produktu.'
            : 'Zdjęcia zostaną powiększone do min. 500 px (proporcje bez zmian). Dla każdego produktu powstanie kopia, którą można przywrócić na karcie produktu.',
      }))
    )
      return;

    let ok = 0;
    const failed: string[] = [];
    setFixing({ done: 0, total: rows.length, current: '' });
    for (let i = 0; i < rows.length; i++) {
      const { product, url } = rows[i];
      setFixing({ done: i, total: rows.length, current: product.sku || product.displayName });
      try {
        await backupPrimaryImageForRevert(product.id, url);
        const res = await prepareImage(url, mode);
        const ext = res.blob.type === 'image/png' ? 'png' : res.blob.type === 'image/webp' ? 'webp' : 'jpg';
        const file = new File([res.blob], `${product.sku || product.id}.${ext}`, {
          type: res.blob.type || 'image/jpeg',
        });
        const newUrl = await updateProductImage(product.id, file);
        setCachedDims(newUrl, [res.width, res.height]);
        onImageUpdated(product.id, newUrl);
        ok++;
      } catch (err) {
        console.error('Popraw zdjęcie', product.sku, err);
        failed.push(product.sku || product.displayName);
      }
    }
    setFixing(null);
    setSelected(new Set());
    setVersion((v) => v + 1);
    if (failed.length === 0) showToast(`Poprawiono ${ok} zdjęć`, 'ok', 5000);
    else
      showToast(
        `Poprawiono ${ok}, błąd: ${failed.length} (${failed.slice(0, 5).join(', ')}${failed.length > 5 ? '…' : ''})`,
        'warn',
        9000,
      );
  }

  const visible = small.slice(0, limit);
  const allSelected = small.length > 0 && selected.size === small.length;
  const busy = !!fixing || !!scan;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <Maximize2 className="h-4 w-4 text-brand-400" />
              Zdjęcia do poprawy (poniżej {BASELINKER_MIN_SIDE}×{BASELINKER_MIN_SIDE})
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Zmierzono {measured} z {withImage.length} zdjęć głównych · do poprawy:{' '}
              <span className="font-semibold text-amber-300">{small.length}</span>
              {measured < withImage.length ? ' · uruchom skan, żeby zmierzyć pozostałe' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
                disabled={busy || measured >= withImage.length}
                onClick={() => void startScan()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                <ScanSearch className="h-4 w-4" />
                {measured === 0 ? 'Skanuj zdjęcia' : 'Skanuj pozostałe'}
              </button>
            )}
          </div>
        </div>
        {scan && scan.total > 0 && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${Math.round((scan.done / scan.total) * 100)}%` }}
            />
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          Wymiary są mierzone w tej przeglądarce i zapamiętywane lokalnie (pierwszy skan pobiera zdjęcia,
          kolejne tylko nowe). Po poprawie zdjęcie znika z listy.
        </p>
      </div>

      {canEdit && small.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => setSelected(allSelected ? new Set() : new Set(small.map((r) => r.product.id)))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            {allSelected ? 'Odznacz wszystkie' : `Zaznacz wszystkie (${small.length})`}
          </button>
          <div className="flex gap-1 rounded-lg border border-slate-800 p-0.5">
            {(
              [
                ['scale', 'Przeskaluj'],
                ['square', 'Kwadrat'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                disabled={busy}
                onClick={() => setMode(key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  mode === key ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void fixSelected()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
          >
            {fixing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {fixing
              ? `Poprawiam ${fixing.done + 1}/${fixing.total}… ${fixing.current}`
              : `Popraw zaznaczone (${selected.size})`}
          </button>
        </div>
      )}

      {small.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">
          {measured === 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Play className="h-4 w-4" />
              Kliknij „Skanuj zdjęcia”, żeby znaleźć zdjęcia poniżej {BASELINKER_MIN_SIDE}×{BASELINKER_MIN_SIDE}.
            </span>
          ) : (
            'Brak zdjęć poniżej minimum wśród zmierzonych.'
          )}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((r) => (
            <li
              key={r.product.id}
              className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                selected.has(r.product.id)
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-slate-800 bg-slate-900/80'
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
                <img
                  src={r.url}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-lg bg-slate-800 object-contain"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[11px] text-brand-400">{r.product.sku}</span>
                  <span className="line-clamp-2 text-xs text-slate-200">{r.product.displayName}</span>
                  <span className="mt-0.5 inline-block rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                    {r.w}×{r.h} px
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {small.length > visible.length && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + PAGE)}
          className="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Pokaż więcej ({small.length - visible.length})
        </button>
      )}
    </div>
  );
}
