import { Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Product } from '../../types';
import { formatPricePln } from '../../lib/format';
import { showToast } from '../../lib/toast';
import {
  getLatestSalesSync,
  requestWaproSalesSync,
  waitForSalesSync,
} from '../../lib/salesSync';
import {
  fetchProductWaproSalesStats,
  waproSalesPeriodLabel,
  type WaproSalesResult,
} from '../../lib/waproSales';

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '—';
  if (Math.abs(qty - Math.round(qty)) < 0.001) {
    return String(Math.round(qty));
  }
  return qty.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
}

function formatSyncedAt(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function collectProductSkus(product: Product): string[] {
  const set = new Set<string>();
  const primary = product.sku?.trim();
  if (primary) set.add(primary);
  if (product.variants?.length) {
    for (const v of product.variants) {
      const s = v.sku?.trim();
      if (s) set.add(s);
    }
  }
  return [...set];
}

export function ProductDetailSalesPanel({ detail }: { detail: Product }) {
  const skus = collectProductSkus(detail);
  const skuLabel = skus.join(', ');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WaproSalesResult | null>(
    detail.waproSalesStats ?? null,
  );
  const [syncedLabel, setSyncedLabel] = useState<string | null>(
    formatSyncedAt(detail.waproSalesSyncedAt) || null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { stats, syncedAt } = await fetchProductWaproSalesStats(detail.id);
      if (cancelled) return;
      if (stats) setResult(stats);
      if (syncedAt) setSyncedLabel(formatSyncedAt(syncedAt));
    })();
    return () => {
      cancelled = true;
    };
  }, [detail.id]);

  const refreshFromServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const req = await requestWaproSalesSync();
      if (!req.ok || !req.id) {
        setError(req.error ?? 'Nie udało się zlecić sync sprzedaży.');
        showToast(req.error ?? 'Błąd zlecenia', 'error');
        return;
      }

      showToast('Sync sprzedaży w kolejce — czekam na Mag WAPRO…', 'info');
      const done = await waitForSalesSync(req.id);
      if (!done) {
        setError('Agent Mag nie odpowiedział — spróbuj za kilka minut.');
        return;
      }
      if (done.status === 'error') {
        setError(done.message ?? 'Błąd sync sprzedaży na serwerze Mag.');
        showToast('Błąd sync sprzedaży', 'error');
        return;
      }

      const { stats, syncedAt } = await fetchProductWaproSalesStats(detail.id);
      if (stats) {
        setResult(stats);
        setSyncedLabel(formatSyncedAt(syncedAt ?? stats.fetchedAt));
        showToast('Statystyki sprzedaży zaktualizowane.', 'ok');
      } else {
        const latest = await getLatestSalesSync();
        setError(
          latest?.message ??
            'Sync zakończony, ale brak danych dla tego SKU (brak sprzedaży w okresie).',
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Nieoczekiwany błąd';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [detail.id]);

  const periods = result?.periods ?? [];
  const sortedPeriods = [...periods].sort((a, b) => a.months - b.months);
  const allZero =
    sortedPeriods.length > 0 &&
    sortedPeriods.every((p) => !p.qty || p.qty <= 0) &&
    sortedPeriods.every((p) => !p.netValue || p.netValue <= 0);

  return (
    <div className="catalog-product-sales-panel-wrap space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="catalog-product-sales-panel__intro-title flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            Sprzedaż z Mag WAPRO
          </h3>
          <p className="catalog-product-sales-panel__intro-text mt-1 text-xs leading-relaxed">
            Okresy 1 / 3 / 6 / 12 mies. — dane z cache Mag (sync nocny lub przycisk poniżej).
          </p>
          {skuLabel && (
            <p className="catalog-product-sales-panel__sku mt-2 break-all font-mono text-xs">
              SKU:{' '}
              <span className="catalog-product-sales-panel__sku-value">{skuLabel}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refreshFromServer()}
          disabled={loading}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {loading ? 'Synchronizacja…' : 'Odśwież z Mag'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950/90 dark:text-red-100">
          {error}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="catalog-product-sales-panel__empty rounded-2xl px-4 py-8 text-center text-sm">
          Brak zsynchronizowanych danych sprzedaży.
          {syncedLabel ? (
            <span className="mt-2 block text-xs opacity-80">
              Ostatni sync: {syncedLabel}
            </span>
          ) : (
            <span className="mt-2 block text-xs opacity-80">
              Sync nocny na serwerze Mag — możesz też użyć „Odśwież z Mag”.
            </span>
          )}
        </div>
      )}

      {loading && !result && (
        <div className="catalog-product-sales-panel__empty flex items-center justify-center gap-2 rounded-2xl px-4 py-10 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          Synchronizacja sprzedaży z Mag WAPRO…
        </div>
      )}

      {result && (
        <div className="catalog-product-sales-panel">
          <div className="catalog-product-sales-panel__table-head flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <span className="catalog-product-sales-panel__table-head-label">Podsumowanie</span>
            {syncedLabel && (
              <span className="catalog-product-sales-panel__table-head-meta text-[11px] sm:text-xs">
                Zsynchronizowano: {syncedLabel}
              </span>
            )}
          </div>

          {/* Mobile: karty zamiast tabeli */}
          <div className="catalog-product-sales-panel__cards space-y-2 p-3 sm:hidden">
            {sortedPeriods.map((p) => (
              <div
                key={p.months}
                className="catalog-product-sales-panel__card rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/80"
              >
                <p className="catalog-product-sales-panel__period text-sm font-semibold">
                  {waproSalesPeriodLabel(p.months)}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-slate-500">Sztuki</p>
                    <p className="catalog-product-sales-panel__qty mt-0.5 font-mono text-base font-semibold">
                      {formatQty(p.qty)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">Netto</p>
                    <p className="catalog-product-sales-panel__net mt-0.5 font-mono text-base font-semibold">
                      {p.netValue != null && p.netValue > 0
                        ? formatPricePln(p.netValue)
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[280px] text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] bg-[#fafbfc] dark:border-slate-800 dark:bg-slate-950/40">
                  <th className="catalog-product-sales-panel__th px-4 py-2.5 text-left">
                    Okres
                  </th>
                  <th className="catalog-product-sales-panel__th px-4 py-2.5 text-right">
                    Sztuki
                  </th>
                  <th className="catalog-product-sales-panel__th px-4 py-2.5 text-right">
                    Netto
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPeriods.map((p) => (
                  <tr key={p.months} className="catalog-product-sales-panel__row">
                    <td className="catalog-product-sales-panel__period px-4 py-3">
                      {waproSalesPeriodLabel(p.months)}
                    </td>
                    <td className="catalog-product-sales-panel__qty px-4 py-3 text-right font-mono">
                      {formatQty(p.qty)}
                    </td>
                    <td className="catalog-product-sales-panel__net px-4 py-3 text-right font-mono">
                      {p.netValue != null && p.netValue > 0
                        ? formatPricePln(p.netValue)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.lastSaleDate && (
            <p className="catalog-product-sales-panel__footer px-3 py-2.5 sm:px-4">
              Ostatnia sprzedaż:{' '}
              <span className="catalog-product-sales-panel__footer-date">
                {result.lastSaleDate}
              </span>
            </p>
          )}
          {allZero && (
            <p className="border-t border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100 sm:px-4">
              Brak sprzedaży w ostatnich 12 miesiącach dla tego SKU.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
