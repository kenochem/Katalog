import { useEffect, useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { Search, TrendingUp, Package, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import type { Product } from '../types';
import { getProductImage } from '../lib/products';
import { formatPricePln, formatStock } from '../lib/format';
import {
  getProductSyncChangesForSku,
  type ProductSyncChange,
} from '../lib/productSyncChanges';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

interface PricePoint {
  changed_at: string;
  label: string;
  price_purchase_net?: number;
  price_sale_net?: number;
  price_sale_gross?: number;
}

const PRICE_SERIES: { key: keyof Omit<PricePoint, 'changed_at' | 'label'>; label: string; color: string }[] = [
  { key: 'price_purchase_net', label: 'Zakup netto', color: '#f59e0b' },
  { key: 'price_sale_net', label: 'Sprzedaż netto', color: '#10b981' },
  { key: 'price_sale_gross', label: 'Sprzedaż brutto', color: '#6366f1' },
];

function buildPriceSeries(changes: ProductSyncChange[]): PricePoint[] {
  const priceChanges = changes.filter((c) => c.field !== 'stock' && c.new_value != null);
  if (priceChanges.length === 0) return [];
  // Punkty tylko tam, gdzie faktycznie coś się zmieniło — wypełniamy resztę pól
  // poprzednią znaną wartością, żeby linie na wykresie nie urywały się do zera.
  const points: PricePoint[] = [];
  const last: Record<string, number> = {};
  for (const c of priceChanges) {
    last[c.field] = c.new_value as number;
    points.push({
      changed_at: c.changed_at,
      label: formatDateShort(c.changed_at),
      price_purchase_net: last.price_purchase_net,
      price_sale_net: last.price_sale_net,
      price_sale_gross: last.price_sale_gross,
    });
  }
  return points;
}

interface StockEvent {
  changed_at: string;
  old: number;
  new: number;
  delta: number;
}

function buildStockEvents(changes: ProductSyncChange[]): StockEvent[] {
  return changes
    .filter((c) => c.field === 'stock' && c.new_value != null)
    .map((c) => ({
      changed_at: c.changed_at,
      old: c.old_value ?? 0,
      new: c.new_value as number,
      delta: (c.new_value as number) - (c.old_value ?? 0),
    }));
}

export function CatalogHistoryView({ products }: { products: Product[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [changes, setChanges] = useState<ProductSyncChange[] | null>(null);
  const [loading, setLoading] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q) ||
          (p.ean || '').includes(q),
      )
      .slice(0, 20);
  }, [products, query]);

  useEffect(() => {
    if (!selected) {
      setChanges(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getProductSyncChangesForSku(selected.sku).then((data) => {
      if (!cancelled) {
        setChanges(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const priceSeries = useMemo(() => (changes ? buildPriceSeries(changes) : []), [changes]);
  const stockEvents = useMemo(() => (changes ? buildStockEvents(changes) : []), [changes]);
  const activePriceSeries = useMemo(
    () => PRICE_SERIES.filter((s) => priceSeries.some((p) => p[s.key] != null)),
    [priceSeries],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-10">
      <div>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50 sm:text-xl">
          Zmiany w czasie
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Historia cen (zakup i sprzedaż) oraz stanu magazynowego dla wybranego produktu — na
          podstawie logu zmian z każdego syncu WAPRO.
        </p>
      </div>

      <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-800 dark:text-sky-300">
        Log zmian działa od <strong>24 września 2026</strong> — starszej historii po prostu nie ma
        (nic wcześniej nie było zapisywane). Im dłużej to działa, tym dłuższą historię zobaczysz.
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          placeholder="Szukaj produktu: SKU, nazwa, EAN…"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {results.length > 0 && !selected && (
          <ul className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 max-h-72 overflow-y-auto rounded-xl border border-slate-300 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {results.map((p) => {
              const img = getProductImage(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(p);
                      setQuery(p.displayName);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {img ? (
                      <img src={img} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-500 dark:bg-slate-800">
                        <Package className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                        {p.displayName}
                      </p>
                      <p className="font-mono text-xs text-slate-500">{p.sku}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!selected ? (
        <div className="py-16 text-center text-slate-500">
          <TrendingUp className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3">Znajdź produkt powyżej, żeby zobaczyć jego historię</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Wczytuję historię…
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
            {getProductImage(selected) ? (
              <img
                src={getProductImage(selected) ?? ''}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-500 dark:bg-slate-800">
                <Package className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-950 dark:text-slate-50">
                {selected.displayName}
              </p>
              <p className="font-mono text-xs text-slate-500">{selected.sku}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Ceny w czasie</h3>
            {priceSeries.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Brak zarejestrowanych zmian cen dla tego produktu.</p>
            ) : (
              <>
                <div className="mt-3 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceSeries} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickFormatter={(v) => `${v} zł`}
                        width={60}
                      />
                      <Tooltip
                        formatter={(v: number) => formatPricePln(v)}
                        labelFormatter={(label, payload) => {
                          const p = payload?.[0]?.payload as PricePoint | undefined;
                          return p ? formatDateTime(p.changed_at) : label;
                        }}
                        contentStyle={{
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: 12,
                          color: '#f1f5f9',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {activePriceSeries.map((s) => (
                        <Line
                          key={s.key}
                          type="stepAfter"
                          dataKey={s.key}
                          name={s.label}
                          stroke={s.color}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: s.color }}
                          connectNulls
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2">Pole</th>
                        <th className="px-3 py-2 text-right">Było</th>
                        <th className="px-3 py-2 text-right">Jest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {[...changes!]
                        .filter((c) => c.field !== 'stock')
                        .reverse()
                        .map((c) => (
                          <tr key={c.id}>
                            <td className="px-3 py-1.5 text-slate-500">{formatDateTime(c.changed_at)}</td>
                            <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                              {c.field === 'price_purchase_net'
                                ? 'Zakup netto'
                                : c.field === 'price_sale_net'
                                  ? 'Sprzedaż netto'
                                  : 'Sprzedaż brutto'}
                            </td>
                            <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">
                              {formatPricePln(c.old_value)}
                            </td>
                            <td className="px-3 py-1.5 text-right font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                              {formatPricePln(c.new_value)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Stan w czasie</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Wzrost stanu = dostawa/zakup, spadek = sprzedaż lub korekta.
            </p>
            {stockEvents.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Brak zarejestrowanych zmian stanu dla tego produktu.</p>
            ) : (
              <>
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={stockEvents.map((e) => ({ ...e, label: formatDateShort(e.changed_at) }))}
                      margin={{ left: 4, right: 12, top: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} width={50} />
                      <Tooltip
                        formatter={(v: number) => formatStock(v)}
                        labelFormatter={(label, payload) => {
                          const p = payload?.[0]?.payload as StockEvent | undefined;
                          return p ? formatDateTime(p.changed_at) : label;
                        }}
                        contentStyle={{
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: 12,
                          color: '#f1f5f9',
                        }}
                      />
                      <Line
                        type="stepAfter"
                        dataKey="new"
                        name="Stan"
                        stroke="#0ea5e9"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#0ea5e9' }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Data</th>
                        <th className="px-3 py-2 text-right">Było</th>
                        <th className="px-3 py-2 text-right">Jest</th>
                        <th className="px-3 py-2 text-right">Zmiana</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {[...stockEvents].reverse().map((e, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-slate-500">{formatDateTime(e.changed_at)}</td>
                          <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">
                            {formatStock(e.old)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatStock(e.new)}
                          </td>
                          <td
                            className={`px-3 py-1.5 text-right font-semibold tabular-nums ${
                              e.delta > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : e.delta < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-500'
                            }`}
                          >
                            {e.delta !== 0 && (
                              <span className="inline-flex items-center gap-0.5">
                                {e.delta > 0 ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                {e.delta > 0 ? 'dostawa' : 'sprzedaż'}
                              </span>
                            )}
                            {' '}
                            {e.delta > 0 ? `+${formatStock(e.delta)}` : formatStock(e.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
