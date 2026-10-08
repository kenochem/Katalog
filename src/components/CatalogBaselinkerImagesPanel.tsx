import { useMemo, useRef, useState } from 'react';
import { CheckSquare, Loader2, RefreshCw, Send, Square } from 'lucide-react';
import type { Product } from '../types';
import { getProductImages } from '../lib/products';
import { getLiveLinkId, useBaselinkerLinksVersion } from '../lib/baselinkerLive';
import {
  fetchImageStatus,
  pushImagesToBaselinker,
  type ImagePushRow,
  type ImageStatusRow,
} from '../lib/baselinkerApi';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';

const STATUS_CHUNK = 100;
const PUSH_CHUNK = 20;

interface Props {
  products: Product[];
  onProductClick: (p: Product) => void;
  /** Uprawnienie „manageBaselinker” — bez niego tylko podgląd różnic. */
  canPush: boolean;
}

/**
 * Hurtowe porównanie zdjęć katalog ↔ BaseLinker i DOKŁADANIE brakujących.
 * Zdjęcia, które już są w BaseLinkerze, nigdy nie są usuwane ani podmieniane — nowe trafiają na koniec.
 */
export function CatalogBaselinkerImagesPanel({ products, onProductClick, canPush }: Props) {
  const linksVersion = useBaselinkerLinksVersion();
  const [rows, setRows] = useState<Map<string, ImageStatusRow>>(new Map());
  const [checking, setChecking] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState<{ done: number; total: number } | null>(null);
  const [problems, setProblems] = useState<ImagePushRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'none' | 'partial'>('all');

  const candidates = useMemo(() => {
    void linksVersion;
    return products.filter(
      (p) => p.sku && getProductImages(p).length > 0 && getLiveLinkId(p.sku) !== undefined,
    );
  }, [products, linksVersion]);

  const bySku = useMemo(() => new Map(products.map((p) => [p.sku.toUpperCase(), p])), [products]);

  const needing = useMemo(
    () =>
      [...rows.values()].filter(
        (r) => (r.state === 'none' || r.state === 'partial') && (filter === 'all' || r.state === filter),
      ),
    [rows, filter],
  );
  const counts = useMemo(() => {
    let synced = 0;
    let none = 0;
    let partial = 0;
    for (const r of rows.values()) {
      if (r.state === 'synced') synced++;
      else if (r.state === 'none') none++;
      else if (r.state === 'partial') partial++;
    }
    return { synced, none, partial };
  }, [rows]);

  async function check() {
    stopRef.current = false;
    const skus = candidates.map((p) => p.sku.toUpperCase());
    setChecking({ done: 0, total: skus.length });
    const next = new Map<string, ImageStatusRow>();
    try {
      for (let i = 0; i < skus.length; i += STATUS_CHUNK) {
        if (stopRef.current) break;
        const items = await fetchImageStatus(skus.slice(i, i + STATUS_CHUNK));
        for (const it of items) next.set(it.sku.toUpperCase(), it);
        setRows(new Map(next));
        setChecking({ done: Math.min(skus.length, i + STATUS_CHUNK), total: skus.length });
      }
      showToast(stopRef.current ? 'Zatrzymano sprawdzanie' : 'Sprawdzono zdjęcia w BaseLinkerze', 'ok', 4000);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd sprawdzania zdjęć', 'error', 7000);
    } finally {
      setChecking(null);
    }
  }

  function toggle(sku: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(sku)) n.delete(sku);
      else n.add(sku);
      return n;
    });
  }

  async function pushSelected() {
    const skus = needing.filter((r) => selected.has(r.sku)).map((r) => r.sku);
    if (!skus.length) return;
    const totalMissing = needing.filter((r) => selected.has(r.sku)).reduce((s, r) => s + r.missingCount, 0);
    if (
      !(await confirmDialog({
        title: `Dołożyć zdjęcia do BaseLinkera (${skus.length} produktów)?`,
        tone: 'warn',
        confirmLabel: 'Dołóż zdjęcia',
        message: `Do BaseLinkera trafi ${totalMissing} brakujących zdjęć z katalogu.\n\nZdjęcia, które już są w BaseLinkerze, zostają bez zmian — nic nie jest usuwane ani podmieniane, nowe są dokładane na koniec (limit 16 na produkt). Po zapisie sprawdzamy, czy żadne dotychczasowe zdjęcie nie zniknęło.`,
      }))
    )
      return;

    setProblems([]);
    setPushing({ done: 0, total: skus.length });
    let ok = 0;
    let added = 0;
    const bad: ImagePushRow[] = [];
    try {
      for (let i = 0; i < skus.length; i += PUSH_CHUNK) {
        const chunk = skus.slice(i, i + PUSH_CHUNK);
        const res = await pushImagesToBaselinker(chunk);
        ok += res.ok;
        added += res.added;
        for (const r of res.results) if (r.status === 'error' || r.status === 'warning') bad.push(r);
        // odśwież status tych produktów
        const fresh = await fetchImageStatus(chunk);
        setRows((prev) => {
          const n = new Map(prev);
          for (const it of fresh) n.set(it.sku.toUpperCase(), it);
          return n;
        });
        setPushing({ done: Math.min(skus.length, i + PUSH_CHUNK), total: skus.length });
      }
      setSelected(new Set());
      setProblems(bad);
      showToast(
        bad.length
          ? `Dołożono ${added} zdjęć (${ok} produktów), problemy: ${bad.length}`
          : `Dołożono ${added} zdjęć w ${ok} produktach`,
        bad.length ? 'warn' : 'ok',
        8000,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Błąd wysyłki zdjęć', 'error', 8000);
      setProblems(bad);
    } finally {
      setPushing(null);
    }
  }

  const busy = !!checking || !!pushing;
  const allSelected = needing.length > 0 && needing.every((r) => selected.has(r.sku));
  const checked = rows.size;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Zdjęcia: katalog ↔ BaseLinker</h2>
            <p className="mt-1 text-xs text-slate-400">
              Produkty powiązane z BaseLinkerem i ze zdjęciem w katalogu: {candidates.length}
              {checked > 0 && (
                <>
                  {' '}
                  · sprawdzono {checked} · aktualne: <span className="text-emerald-300">{counts.synced}</span> ·
                  do dołożenia: <span className="font-semibold text-amber-300">{counts.none + counts.partial}</span>
                </>
              )}
            </p>
          </div>
          {checking ? (
            <button
              type="button"
              onClick={() => {
                stopRef.current = true;
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Zatrzymaj ({checking.done}/{checking.total})
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || candidates.length === 0}
              onClick={() => void check()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              {checked ? 'Sprawdź ponownie' : 'Sprawdź zdjęcia w BaseLinkerze'}
            </button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Porównanie jest tylko do odczytu. Dokładanie nigdy nie usuwa ani nie podmienia zdjęć, które już są w
          BaseLinkerze — brakujące trafiają na koniec galerii (max 16). Zdjęcia dopasowujemy po adresie / nazwie
          pliku, więc zdjęcia wgrane do BL w inny sposób mogą być widziane jako „inne”.
        </p>
      </div>

      {checked > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex gap-1 rounded-lg border border-slate-800 p-0.5">
            {(
              [
                ['all', `Wszystkie (${counts.none + counts.partial})`],
                ['none', `Żadne z katalogu nie ma w BL (${counts.none})`],
                ['partial', `Częściowo (${counts.partial})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  filter === key ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {canPush && needing.length > 0 && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSelected(allSelected ? new Set() : new Set(needing.map((r) => r.sku)))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allSelected ? 'Odznacz' : 'Zaznacz wszystkie'}
              </button>
              <button
                type="button"
                disabled={busy || selected.size === 0}
                onClick={() => void pushSelected()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {pushing
                  ? `Dokładam ${pushing.done}/${pushing.total}…`
                  : `Dołóż zdjęcia do BaseLinkera (${selected.size})`}
              </button>
            </>
          )}
        </div>
      )}

      {problems.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="mb-1 font-semibold">Wymagają sprawdzenia w BaseLinkerze ({problems.length}):</p>
          <ul className="space-y-0.5">
            {problems.slice(0, 20).map((p, i) => (
              <li key={`${p.sku}-${i}`}>
                <span className="font-mono">{p.sku}</span> — {p.reason || p.status}
              </li>
            ))}
          </ul>
        </div>
      )}

      {checked > 0 && needing.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-10 text-center text-sm text-slate-500">
          Wszystkie sprawdzone produkty mają zdjęcia z katalogu w BaseLinkerze.
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {needing.slice(0, 300).map((r) => {
            const p = bySku.get(r.sku);
            return (
              <li
                key={r.sku}
                className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                  selected.has(r.sku) ? 'border-sky-500/50 bg-sky-500/10' : 'border-slate-800 bg-slate-900/80'
                }`}
              >
                {canPush && (
                  <input
                    type="checkbox"
                    checked={selected.has(r.sku)}
                    disabled={busy}
                    onChange={() => toggle(r.sku)}
                    className="h-4 w-4 shrink-0 accent-sky-500"
                    aria-label={`Zaznacz ${r.sku}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => p && onProductClick(p)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  {r.ours[0] ? (
                    <img src={r.ours[0]} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-slate-800 object-contain" />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-800" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[11px] text-sky-400">{r.sku}</span>
                    <span className="line-clamp-2 text-xs text-slate-200">{p?.displayName ?? ''}</span>
                    <span className="mt-0.5 flex flex-wrap gap-1 text-[10px] font-semibold">
                      <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-slate-300">katalog {r.oursCount}</span>
                      <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-slate-300">BL {r.blCount}</span>
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                        brak w BL {r.missingCount}
                      </span>
                      {r.blOnly > 0 && (
                        <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
                          inne w BL {r.blOnly}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {needing.length > 300 && (
        <p className="text-center text-xs text-slate-500">Pokazano 300 z {needing.length} — po wysyłce zostałe pojawią się wyżej.</p>
      )}
    </div>
  );
}
