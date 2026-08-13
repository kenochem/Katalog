import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  ExternalLink,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CatalogType } from '../../types';
import { ContextHelp } from '../ContextHelp';
import { BaselinkerTag } from '../BaselinkerTag';
import { formatMarginPercent, formatPricePln } from '../../lib/format';
import { downloadCsv, stampFile } from '../../lib/exportReport';
import { showToast } from '../../lib/toast';
import { useAuth } from '../../lib/auth';
import { roleCan } from '../../lib/roles';
import { getProductImage } from '../../lib/products';
import { requestWaproSalesSync, waitForSalesSync } from '../../lib/salesSync';
import { waproSalesPeriodLabel } from '../../lib/waproSales';
import {
  aggregateSalesSummary,
  buildProductSalesMetrics,
  CATALOG_PRODUCT_URL,
  fetchProductsForSalesAnalytics,
  isSalesExcludedService,
  normalizeSkuToken,
  parseSkuSearchTokens,
  resolveSkusFromTokens,
  type ProductSalesMetrics,
  type SalesAnalyticsPreset,
  type SalesPeriodMonths,
} from '../../lib/waproSalesAnalytics';
import {
  collectMonthKeys,
  compareEnrichedMetrics,
  enrichSalesRows,
  formatChangePct,
  formatTurnoverDays,
  monthlyExportHeaders,
  monthlyExportRow,
} from '../../lib/waproSalesInsights';
import {
  OpsProductSalesInsights,
  type AbcFilter,
  type XyzFilter,
} from './OpsProductSalesInsights';
import {
  isSalesDecorativeLine,
  isSalesExcludedFromSum,
  loadSalesExcludedSkus,
  saveSalesExcludedSkus,
} from '../../lib/salesExclusions';

type SortKey =
  | 'qty'
  | 'netValue'
  | 'avgNetPerUnit'
  | 'grossProfit'
  | 'realizedMarginPct'
  | 'purchaseNet'
  | 'stock'
  | 'lastSaleDate'
  | 'name'
  | 'sku'
  | 'turnoverDays'
  | 'qtyChangePct';

type SalesFilter = 'all' | 'with-sales' | 'without-sales' | 'synced-only' | 'never-synced';

type SalesChartKind = 'bar-h' | 'bar-v' | 'pie';

const CHART_KINDS: { id: SalesChartKind; label: string }[] = [
  { id: 'bar-h', label: 'Słupki poziome' },
  { id: 'bar-v', label: 'Słupki pionowe' },
  { id: 'pie', label: 'Koło (udziały)' },
];

const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];

const PRESETS: { id: SalesAnalyticsPreset; label: string; hint: string }[] = [
  { id: 'top-qty', label: 'Najwięcej sztuk', hint: 'Ranking po liczbie sprzedanych sztuk' },
  { id: 'top-net', label: 'Największa suma netto', hint: 'Ranking po łącznej wartości netto ze sprzedaży' },
  { id: 'top-profit', label: 'Najbardziej opłacalne', hint: 'Zysk = suma netto − (zakup × szt.)' },
  { id: 'bottom-qty', label: 'Najmniej sztuk', hint: 'Produkty z najmniejszą sprzedażą' },
  { id: 'bottom-net', label: 'Najmniejsza suma netto', hint: 'Najniższy obrót netto' },
  { id: 'dead-stock', label: 'Martwy stock', hint: 'Stan > 0, zero sprzedaży w okresie' },
  { id: 'recent', label: 'Ostatnia sprzedaż', hint: 'Najświeższe transakcje' },
  { id: 'top-stock', label: 'Największy stan', hint: 'Sortowanie po stanie magazynowym' },
  { id: 'growth', label: 'Najszybszy wzrost', hint: 'Δ szt. vs poprzednie 12 m (wymaga okresu 12 m)' },
  { id: 'turnover', label: 'Szybka rotacja', hint: 'Najmniej dni zapasu przy obecnym stanie' },
  { id: 'slow-turnover', label: 'Wolna rotacja', hint: 'Dużo dni zapasu — ryzyko martwego stocku' },
];

const PERIOD_HINT: Record<SalesPeriodMonths, string> = {
  1: 'ostatni miesiąc',
  3: 'ostatnie 3 miesiące',
  6: 'ostatnie 6 miesięcy',
  12: 'ostatnie 12 miesięcy',
};

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '—';
  if (Math.abs(qty - Math.round(qty)) < 0.001) return String(Math.round(qty));
  return qty.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pl-PL');
  } catch {
    return iso;
  }
}

function formatSyncedAt(iso?: string | null): string {
  if (!iso) return '—';
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

function applyPreset(preset: SalesAnalyticsPreset): {
  sortKey: SortKey;
  sortDesc: boolean;
  salesFilter: SalesFilter;
  minStock?: number;
} {
  switch (preset) {
    case 'top-qty':
      return { sortKey: 'qty', sortDesc: true, salesFilter: 'with-sales' };
    case 'bottom-qty':
      return { sortKey: 'qty', sortDesc: false, salesFilter: 'with-sales' };
    case 'top-net':
      return { sortKey: 'netValue', sortDesc: true, salesFilter: 'with-sales' };
    case 'bottom-net':
      return { sortKey: 'netValue', sortDesc: false, salesFilter: 'with-sales' };
    case 'top-profit':
      return { sortKey: 'grossProfit', sortDesc: true, salesFilter: 'with-sales' };
    case 'top-stock':
      return { sortKey: 'stock', sortDesc: true, salesFilter: 'all' };
    case 'dead-stock':
      return { sortKey: 'stock', sortDesc: true, salesFilter: 'without-sales', minStock: 1 };
    case 'recent':
      return { sortKey: 'lastSaleDate', sortDesc: true, salesFilter: 'with-sales' };
    case 'growth':
      return { sortKey: 'qtyChangePct', sortDesc: true, salesFilter: 'with-sales' };
    case 'turnover':
      return { sortKey: 'turnoverDays', sortDesc: false, salesFilter: 'with-sales' };
    case 'slow-turnover':
      return { sortKey: 'turnoverDays', sortDesc: true, salesFilter: 'with-sales', minStock: 1 };
    default:
      return { sortKey: 'qty', sortDesc: true, salesFilter: 'with-sales' };
  }
}

function activeViewLabel(preset: SalesAnalyticsPreset, period: SalesPeriodMonths, sortKey: SortKey, sortDesc: boolean): string {
  const p = PRESETS.find((x) => x.id === preset);
  if (p && preset !== 'custom') return `${p.label} · ${PERIOD_HINT[period]}`;
  const sortLabels: Record<SortKey, string> = {
    qty: 'sztuki',
    netValue: 'suma netto',
    avgNetPerUnit: 'średnia cena',
    grossProfit: 'zysk',
    realizedMarginPct: 'marża ze sprzedaży',
    purchaseNet: 'cena zakupu',
    stock: 'stan mag.',
    lastSaleDate: 'data sprzedaży',
    turnoverDays: 'rotacja',
    qtyChangePct: 'wzrost Δ',
    name: 'nazwa',
    sku: 'SKU',
  };
  return `Sort: ${sortLabels[sortKey]} (${sortDesc ? 'malejąco' : 'rosnąco'}) · ${PERIOD_HINT[period]}`;
}

export function OpsProductSalesAnalytics({ onBack }: { onBack: () => void }) {
  const { role } = useAuth();
  const showPrices = roleCan(role, 'viewPrices');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<ProductSalesMetrics[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [period, setPeriod] = useState<SalesPeriodMonths>(12);
  const [catalog, setCatalog] = useState<'all' | CatalogType>('all');
  const [preset, setPreset] = useState<SalesAnalyticsPreset>('top-net');
  const [sortKey, setSortKey] = useState<SortKey>('netValue');
  const [sortDesc, setSortDesc] = useState(true);
  const [salesFilter, setSalesFilter] = useState<SalesFilter>('with-sales');
  const [excludeServices, setExcludeServices] = useState(true);
  const [search, setSearch] = useState('');
  const [skuBasket, setSkuBasket] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [minQty, setMinQty] = useState('');
  const [maxQty, setMaxQty] = useState('');
  const [minNet, setMinNet] = useState('');
  const [maxNet, setMaxNet] = useState('');
  const [minStock, setMinStock] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [excludeSkuBasket, setExcludeSkuBasket] = useState<string[]>(() => loadSalesExcludedSkus());
  const [hideExcludedFromTable, setHideExcludedFromTable] = useState(false);
  const [excludeDecorative, setExcludeDecorative] = useState(true);
  const [chartMetric, setChartMetric] = useState<'qty' | 'netValue'>('netValue');
  const [chartKind, setChartKind] = useState<SalesChartKind>('bar-h');
  const [abcFilter, setAbcFilter] = useState<AbcFilter>('all');
  const [xyzFilter, setXyzFilter] = useState<XyzFilter>('all');
  const [insightsOpen, setInsightsOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const catalogFilter = catalog === 'all' ? undefined : catalog;
      const list = await fetchProductsForSalesAnalytics(catalogFilter, period);
      setProducts(list.map((p) => buildProductSalesMetrics(p, period)));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Błąd ładowania produktów');
    }
  }, [catalog, period]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    setProducts((prev) => prev.map((row) => buildProductSalesMetrics(row.product, period)));
  }, [period]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const row of products) {
      if (row.product.category) set.add(row.product.category);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pl'));
  }, [products]);

  const manufacturers = useMemo(() => {
    const set = new Set<string>();
    for (const row of products) {
      if (row.product.manufacturer) set.add(row.product.manufacturer);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pl'));
  }, [products]);

  const basketSkuSet = useMemo(() => new Set(skuBasket.map(normalizeSkuToken)), [skuBasket]);
  const excludeSkuSet = useMemo(
    () => new Set(excludeSkuBasket.map(normalizeSkuToken)),
    [excludeSkuBasket],
  );

  const isExcludedFromSum = useCallback(
    (row: ProductSalesMetrics) => {
      const p = row.product;
      if (excludeDecorative && isSalesDecorativeLine(p)) return true;
      return isSalesExcludedFromSum(p, excludeSkuSet);
    },
    [excludeSkuSet, excludeDecorative],
  );

  const enriched = useMemo(() => enrichSalesRows(products, period), [products, period]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minQ = minQty !== '' ? Number(minQty) : null;
    const maxQ = maxQty !== '' ? Number(maxQty) : null;
    const minN = minNet !== '' ? Number(minNet) : null;
    const maxN = maxNet !== '' ? Number(maxNet) : null;
    const minS = minStock !== '' ? Number(minStock) : null;

    return enriched.filter((row) => {
      const p = row.product;
      if (excludeServices && isSalesExcludedService(p)) return false;
      if (hideExcludedFromTable && isExcludedFromSum(row)) return false;
      if (skuBasket.length) {
        if (!basketSkuSet.has(normalizeSkuToken(p.sku))) return false;
      } else if (q) {
        const hay = `${p.sku} ${p.name} ${p.displayName} ${p.ean}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category && p.category !== category) return false;
      if (manufacturer && p.manufacturer !== manufacturer) return false;
      if (!skuBasket.length) {
        if (salesFilter === 'with-sales' && row.qty <= 0) return false;
        if (salesFilter === 'without-sales' && row.qty > 0) return false;
      }
      if (salesFilter === 'synced-only' && !row.syncedAt) return false;
      if (salesFilter === 'never-synced' && row.syncedAt) return false;
      if (minQ != null && Number.isFinite(minQ) && row.qty < minQ) return false;
      if (maxQ != null && Number.isFinite(maxQ) && row.qty > maxQ) return false;
      if (minN != null && Number.isFinite(minN) && (row.netValue ?? 0) < minN) return false;
      if (maxN != null && Number.isFinite(maxN) && (row.netValue ?? 0) > maxN) return false;
      const stock = p.stock ?? 0;
      if (minS != null && Number.isFinite(minS) && stock < minS) return false;
      if (abcFilter !== 'all' && row.abcClass !== abcFilter) return false;
      if (xyzFilter !== 'all' && row.xyzClass !== xyzFilter) return false;
      return true;
    });
  }, [
    enriched,
    excludeServices,
    search,
    skuBasket,
    basketSkuSet,
    category,
    manufacturer,
    salesFilter,
    minQty,
    maxQty,
    minNet,
    maxNet,
    minStock,
    abcFilter,
    xyzFilter,
    hideExcludedFromTable,
    isExcludedFromSum,
  ]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => compareEnrichedMetrics(a, b, sortKey, sortDesc));
    return copy;
  }, [filtered, sortKey, sortDesc]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sorted.length / pageSize)),
    [sorted.length, pageSize],
  );

  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [
    period,
    catalog,
    preset,
    salesFilter,
    excludeServices,
    search,
    skuBasket,
    excludeSkuBasket,
    category,
    manufacturer,
    minQty,
    maxQty,
    minNet,
    maxNet,
    minStock,
    abcFilter,
    xyzFilter,
    hideExcludedFromTable,
    excludeDecorative,
    sortKey,
    sortDesc,
  ]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  /** Cały widok po filtrach — do eksportu CSV (bez limitu wierszy tabeli). */
  const exportRows = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => compareEnrichedMetrics(a, b, sortKey, sortDesc));
    return copy;
  }, [filtered, sortKey, sortDesc]);

  const summary = useMemo(
    () => aggregateSalesSummary(filtered, { exclude: isExcludedFromSum }),
    [filtered, isExcludedFromSum],
  );

  const summableFiltered = useMemo(
    () => filtered.filter((row) => !isExcludedFromSum(row)),
    [filtered, isExcludedFromSum],
  );

  const chartData = useMemo(() => {
    const metricKey = chartMetric;
    const sortedForChart = [...summableFiltered].sort((a, b) =>
      compareEnrichedMetrics(a, b, metricKey, true),
    );
    const limitN = skuBasket.length ? Math.min(30, sortedForChart.length) : 10;
    const items = sortedForChart.slice(0, limitN).map((row) => {
      const value = metricKey === 'qty' ? row.qty : row.netValue ?? 0;
      return {
        sku: row.product.sku,
        name: (row.product.displayName || row.product.name || row.product.sku).slice(0, 32),
        qty: row.qty,
        net: row.netValue ?? 0,
        value: Number.isFinite(value) ? value : 0,
        isTotal: false,
      };
    });
    if (skuBasket.length > 1 && summableFiltered.length > 0) {
      const sum = aggregateSalesSummary(summableFiltered);
      const totalValue = metricKey === 'qty' ? sum.totalQty : sum.totalNet;
      items.push({
        sku: 'Σ',
        name: `Suma koszyka (${summableFiltered.length} SKU)`,
        qty: sum.totalQty,
        net: sum.totalNet,
        value: Number.isFinite(totalValue) ? totalValue : 0,
        isTotal: true,
      });
    }
    return items;
  }, [summableFiltered, chartMetric, skuBasket.length]);

  function selectPreset(id: SalesAnalyticsPreset) {
    setPreset(id);
    const next = applyPreset(id);
    setSortKey(next.sortKey);
    setSortDesc(next.sortDesc);
    setSalesFilter(next.salesFilter);
    setMinStock(next.minStock != null ? String(next.minStock) : '');
    setMinQty('');
    setMaxQty('');
    setMinNet('');
    setMaxNet('');
    if (id === 'top-net' || id === 'bottom-net') setChartMetric('netValue');
    else if (id === 'top-qty' || id === 'bottom-qty') setChartMetric('qty');
    else if (id === 'top-profit') setChartMetric('netValue');
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(key !== 'name' && key !== 'sku');
    }
    setPreset('custom');
  }

  function resetFilters() {
    selectPreset('top-net');
    setExcludeServices(true);
    setSearch('');
    setSkuBasket([]);
    setExcludeSkuBasket([]);
    saveSalesExcludedSkus([]);
    setHideExcludedFromTable(false);
    setExcludeDecorative(true);
    setAbcFilter('all');
    setXyzFilter('all');
    setCategory('');
    setManufacturer('');
    setPageSize(50);
    setPage(1);
  }

  function addSearchToExcludeBasket() {
    const tokens = parseSkuSearchTokens(search);
    if (!tokens.length) return;
    const { skus, ambiguous, unmatched } = resolveSkusFromTokens(tokens, products);
    if (ambiguous.length) {
      showToast(`Niejednoznaczne: ${ambiguous.join(', ')} — podaj dokładne SKU`, 'info');
    }
    if (unmatched.length && !skus.length) {
      showToast(`Brak dopasowań: ${unmatched.join(', ')}`, 'error');
      return;
    }
    if (!skus.length) return;
    setExcludeSkuBasket((prev) => {
      const seen = new Set(prev.map(normalizeSkuToken));
      const next = [...prev];
      for (const sku of skus) {
        const key = normalizeSkuToken(sku);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(sku);
        }
      }
      saveSalesExcludedSkus(next);
      return next;
    });
    setSearch('');
    setPreset('custom');
    showToast(`Wykluczono z sumy: ${skus.length} SKU`, 'ok');
  }

  function removeFromExcludeBasket(sku: string) {
    const key = normalizeSkuToken(sku);
    setExcludeSkuBasket((prev) => {
      const next = prev.filter((s) => normalizeSkuToken(s) !== key);
      saveSalesExcludedSkus(next);
      return next;
    });
  }

  function excludeSkuFromRow(sku: string) {
    const key = normalizeSkuToken(sku);
    if (!key) return;
    setExcludeSkuBasket((prev) => {
      if (prev.some((s) => normalizeSkuToken(s) === key)) return prev;
      const next = [...prev, sku];
      saveSalesExcludedSkus(next);
      showToast(`Wykluczono ${sku} z sum`, 'ok');
      return next;
    });
  }

  function addSearchToBasket() {
    const tokens = parseSkuSearchTokens(search);
    if (!tokens.length) return;
    const { skus, ambiguous, unmatched } = resolveSkusFromTokens(tokens, products);
    if (ambiguous.length) {
      showToast(`Niejednoznaczne: ${ambiguous.join(', ')} — podaj dokładne SKU`, 'info');
    }
    if (unmatched.length && !skus.length) {
      showToast(`Brak dopasowań: ${unmatched.join(', ')}`, 'error');
      return;
    }
    if (!skus.length) return;
    setSkuBasket((prev) => {
      const seen = new Set(prev.map(normalizeSkuToken));
      const next = [...prev];
      for (const sku of skus) {
        const key = normalizeSkuToken(sku);
        if (!seen.has(key)) {
          seen.add(key);
          next.push(sku);
        }
      }
      return next;
    });
    setSearch('');
    setPreset('custom');
    showToast(`Dodano ${skus.length} SKU do koszyka`, 'ok');
  }

  function removeFromBasket(sku: string) {
    const key = normalizeSkuToken(sku);
    setSkuBasket((prev) => prev.filter((s) => normalizeSkuToken(s) !== key));
  }

  async function refreshFromMag() {
    setRefreshing(true);
    try {
      const req = await requestWaproSalesSync();
      if (!req.ok || !req.id) {
        showToast(req.error ?? 'Nie udało się zlecić sync sprzedaży.', 'error');
        return;
      }
      showToast('Sync sprzedaży w kolejce — czekam na Mag WAPRO…', 'info');
      const done = await waitForSalesSync(req.id);
      if (!done || done.status === 'error') {
        showToast(done?.message ?? 'Błąd sync na serwerze Mag.', 'error');
        return;
      }
      await loadData();
      showToast('Dane sprzedaży zaktualizowane.', 'ok');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Błąd odświeżania', 'error');
    } finally {
      setRefreshing(false);
    }
  }

  function exportCsv() {
    const periodLabel = waproSalesPeriodLabel(period);
    const headers = [
      'SKU',
      'Nazwa',
      'Kategoria',
      'Producent',
      'Stan mag.',
      `Szt. (${periodLabel})`,
      ...(period === 12 ? ['Δ szt. %', 'Szt. poprzednie 12 m'] : []),
      'Rotacja (dni zap.)',
      'ABC',
      'XYZ',
      ...(showPrices
        ? [
            `Suma netto (${periodLabel})`,
            'Śr. netto / szt.',
            'Zakup netto / szt.',
            'Zysk w okresie',
            'Marża ze sprzedaży %',
          ]
        : []),
      'Ostatnia sprzedaż',
    ];
    const rows = exportRows.map((row) => [
      row.product.sku,
      row.product.displayName || row.product.name,
      row.product.category,
      row.product.manufacturer,
      row.product.stock ?? 0,
      row.qty,
      ...(period === 12
        ? [formatChangePct(row.qtyChangePct), row.qtyPrev12m]
        : []),
      formatTurnoverDays(row.turnoverDays),
      row.abcClass,
      row.xyzClass,
      ...(showPrices
        ? [
            row.netValue ?? '',
            row.avgNetPerUnit != null ? row.avgNetPerUnit.toFixed(2) : '',
            row.purchaseNet != null ? row.purchaseNet.toFixed(2) : '',
            row.grossProfit != null ? row.grossProfit.toFixed(2) : '',
            row.realizedMarginPct != null ? row.realizedMarginPct.toFixed(1) : '',
          ]
        : []),
      row.lastSaleDate ?? '',
    ]);
    downloadCsv(stampFile(`sprzedaz_produkty_${period}m`), headers, rows);
    showToast(`Eksport CSV: ${rows.length} wierszy (cały widok po filtrach).`, 'ok');
  }

  function exportMonthlyCsv() {
    const months = collectMonthKeys(exportRows);
    if (!months.length) {
      showToast('Brak danych miesięcznych — uruchom sync Mag (schema v2).', 'error');
      return;
    }
    const headers = [
      'SKU',
      'Nazwa',
      'Kategoria',
      'Producent',
      ...monthlyExportHeaders(months),
      'ABC',
      'XYZ',
    ];
    const rows = exportRows.map((row) => [
      row.product.sku,
      row.product.displayName || row.product.name,
      row.product.category,
      row.product.manufacturer,
      ...monthlyExportRow(row, months),
      row.abcClass,
      row.xyzClass,
    ]);
    downloadCsv(stampFile(`sprzedaz_miesieczna_${period}m`), headers, rows);
    showToast(`Eksport miesięczny: ${rows.length} wierszy × ${months.length} mies.`, 'ok');
  }

  const periodLabel = waproSalesPeriodLabel(period);

  return (
    <div className="ops-sales-analytics mx-auto w-full max-w-[1680px] space-y-4 px-1 pb-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Operacje
      </button>

      <header className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        <div className="grid gap-0 lg:grid-cols-[1.35fr_1fr]">
          <div className="p-5 sm:p-6">
            <div className="flex items-center gap-2 text-brand-400">
              <TrendingUp className="h-5 w-5" />
              <p className="text-xs font-semibold uppercase tracking-wide">Analiza sprzedaży produktów</p>
            </div>
            <h2 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-slate-50">
              Rankingi Mag WAPRO
              <ContextHelp id="opsProductSales" />
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void refreshFromMag()}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-60"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Odśwież z Mag
              </button>
              <ContextHelp id="opsProductSalesMagSync" />
              <button
                type="button"
                onClick={exportMonthlyCsv}
                disabled={!exportRows.length}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                CSV miesięczny
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={!exportRows.length}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Eksport CSV ({exportRows.length})
              </button>
              <ContextHelp id="opsProductSalesExport" />
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
              >
                Reset filtrów
              </button>
            </div>
          </div>
          <div className="border-t border-slate-800 bg-slate-900/50 p-5 lg:border-l lg:border-t-0">
            <SectionHeading title={`Podsumowanie · ${periodLabel}`} helpId="opsProductSalesSummary" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <KpiMini label="Pozycji" value={String(summary.productCount)} />
              <KpiMini label="Ze sprzedażą" value={String(summary.withSales)} />
              <KpiMini label="Sztuk łącznie" value={formatQty(summary.totalQty)} />
              {showPrices ? (
                <>
                  <KpiMini label="Obrót netto" value={formatPricePln(summary.totalNet)} />
                  <KpiMini label="Zysk szac." value={formatPricePln(summary.totalProfit)} />
                </>
              ) : null}
              <KpiMini label="Sync Mag" value={formatSyncedAt(summary.lastSyncedAt)} />
            </div>
          </div>
        </div>
      </header>

      <div className="ops-sales-view-bar rounded-xl border border-brand-500/40 bg-brand-50 px-4 py-3 text-sm dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-slate-200">
        <span className="font-semibold text-brand-800 dark:text-brand-200">Widok:</span>{' '}
        {activeViewLabel(preset, period, sortKey, sortDesc)}
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <SectionHeading title="Presety rankingu" helpId="opsProductSalesPresets" />
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              onClick={() => selectPreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                preset === p.id
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionHeading title="Filtry" helpId="opsProductSalesFilters" />
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={excludeServices}
              onChange={(e) => setExcludeServices(e.target.checked)}
              className="rounded border-slate-600 bg-slate-950 text-brand-500"
            />
            Ukryj usługi (wysyłka KAT00178, KAT00159…)
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={excludeDecorative}
              onChange={(e) => setExcludeDecorative(e.target.checked)}
              className="rounded border-slate-600 bg-slate-950 text-brand-500"
            />
            Wyklucz kwiatki / rozpis z sum
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={hideExcludedFromTable}
              onChange={(e) => setHideExcludedFromTable(e.target.checked)}
              className="rounded border-slate-600 bg-slate-950 text-brand-500"
            />
            Ukryj wykluczone w tabeli
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <FilterSelect
            label="Okres analizy"
            value={String(period)}
            onChange={(v) => setPeriod(Number(v) as SalesPeriodMonths)}
            options={[
              { value: '1', label: '1 miesiąc' },
              { value: '3', label: '3 miesiące' },
              { value: '6', label: '6 miesięcy' },
              { value: '12', label: '12 miesięcy' },
            ]}
          />
          <FilterSelect
            label="Katalog"
            value={catalog}
            onChange={(v) => setCatalog(v as typeof catalog)}
            options={[
              { value: 'all', label: 'Oba' },
              { value: 'accessories', label: 'Akcesoria WAPRO' },
              { value: 'shop', label: 'Sklep' },
            ]}
          />
          <FilterSelect
            label="Sprzedaż"
            value={salesFilter}
            onChange={(v) => {
              setSalesFilter(v as SalesFilter);
              setPreset('custom');
            }}
            options={[
              { value: 'with-sales', label: 'Tylko ze sprzedażą' },
              { value: 'all', label: 'Wszystkie' },
              { value: 'without-sales', label: 'Bez sprzedaży' },
            ]}
          />
          <FilterSelect
            label="Kategoria"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPreset('custom');
            }}
            options={[{ value: '', label: 'Wszystkie' }, ...categories.map((c) => ({ value: c, label: c }))]}
          />
          <FilterSelect
            label="Producent"
            value={manufacturer}
            onChange={(v) => {
              setManufacturer(v);
              setPreset('custom');
            }}
            options={[{ value: '', label: 'Wszyscy' }, ...manufacturers.map((m) => ({ value: m, label: m }))]}
          />
          <FilterSelect
            label="Na stronę"
            value={String(pageSize)}
            onChange={(v) => {
              setPageSize(Number(v) || 50);
              setPage(1);
            }}
            options={[
              { value: '25', label: '25 pozycji' },
              { value: '50', label: '50 pozycji' },
              { value: '100', label: '100 pozycji' },
            ]}
          />
          <FilterInput label="Min. szt." value={minQty} onChange={setMinQty} type="number" />
          <FilterInput label="Max. szt." value={maxQty} onChange={setMaxQty} type="number" />
          {showPrices ? (
            <>
              <FilterInput label="Min. netto" value={minNet} onChange={setMinNet} type="number" />
              <FilterInput label="Max. netto" value={maxNet} onChange={setMaxNet} type="number" />
            </>
          ) : null}
          <FilterInput label="Min. stan" value={minStock} onChange={setMinStock} type="number" />
          <label className="sm:col-span-2 lg:col-span-3">
            <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Szukaj / koszyk SKU
              <ContextHelp id="opsProductSalesBasket" />
            </span>
            <span className="flex gap-2">
              <span className="relative block min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPreset('custom');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSearchToBasket();
                    }
                  }}
                  placeholder="SKU1, SKU2 lub nazwa — Enter lub Dodaj"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100"
                />
              </span>
              <button
                type="button"
                onClick={addSearchToBasket}
                disabled={!search.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-brand-600/50 bg-brand-600/15 px-3 py-2 text-sm font-semibold text-brand-200 hover:bg-brand-600/25 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                Dodaj
              </button>
              <button
                type="button"
                onClick={addSearchToExcludeBasket}
                disabled={!search.trim()}
                title="Wyklucz SKU z sum KPI (pozostaje w tabeli, chyba że ukryjesz)"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
              >
                <X className="h-4 w-4" />
                Wyklucz
              </button>
            </span>
          </label>
          {skuBasket.length > 0 ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-700/40 bg-brand-950/30 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-300">
                  Koszyk ({skuBasket.length})
                </span>
                {skuBasket.map((sku) => (
                  <span
                    key={sku}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs font-medium text-slate-200"
                  >
                    {sku}
                    <button
                      type="button"
                      onClick={() => removeFromBasket(sku)}
                      className="rounded p-0.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                      aria-label={`Usuń ${sku} z koszyka`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setSkuBasket([])}
                  className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-300"
                >
                  Wyczyść koszyk
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Łącznie w koszyku (bez wykluczonych): {formatQty(summary.totalQty)} szt.
                {showPrices ? ` · ${formatPricePln(summary.totalNet)} netto` : ''}
                {showPrices && summary.totalProfit !== 0 ? ` · zysk ${formatPricePln(summary.totalProfit)}` : ''}
              </p>
            </div>
          ) : null}
          {excludeSkuBasket.length > 0 ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-700/40 bg-amber-950/20 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                  Wykluczone z sum ({excludeSkuBasket.length})
                </span>
                {excludeSkuBasket.map((sku) => (
                  <span
                    key={sku}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-800/50 bg-slate-900 px-2 py-0.5 text-xs font-medium text-amber-100"
                  >
                    {sku}
                    <button
                      type="button"
                      onClick={() => removeFromExcludeBasket(sku)}
                      className="rounded p-0.5 text-amber-500 hover:bg-slate-800 hover:text-amber-200"
                      aria-label={`Przywróć ${sku} do sum`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setExcludeSkuBasket([]);
                    saveSalesExcludedSkus([]);
                  }}
                  className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-300"
                >
                  Wyczyść wykluczenia
                </button>
              </div>
            </div>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Tabela: strona {safePage}/{totalPages} · {sorted.length} wierszy (filtr: {filtered.length}, baza:{' '}
          {products.length})
          {excludeServices ? ' · bez usług' : ''}
          {excludeSkuBasket.length ? ` · ${excludeSkuBasket.length} wykl. z sum` : ''}
          {skuBasket.length ? ` · koszyk ${skuBasket.length} SKU` : ''}
          {' · '}
          KPI i wykres = suma bez wykluczonych pozycji
        </p>
      </section>

      {chartData.length > 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-100">
                {skuBasket.length ? `Koszyk · ${skuBasket.length} SKU` : 'Top 10'} · {periodLabel}
              </p>
              <ContextHelp id="opsProductSalesChart" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                <ChartToggle active={chartMetric === 'netValue'} onClick={() => setChartMetric('netValue')} label="Suma netto" />
                <ChartToggle active={chartMetric === 'qty'} onClick={() => setChartMetric('qty')} label="Sztuki" />
              </div>
              <div className="flex gap-1">
                {CHART_KINDS.map((k) => (
                  <ChartToggle
                    key={k.id}
                    active={chartKind === k.id}
                    onClick={() => setChartKind(k.id)}
                    label={k.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="ops-sales-chart mt-3 h-80 min-h-[320px] w-full">
            <ResponsiveContainer width="100%" height={320} debounce={50}>
              {renderSalesTopChart({ data: chartData, metric: chartMetric, kind: chartKind })}
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <button
          type="button"
          onClick={() => setInsightsOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-100">Analiza zaawansowana</p>
            <ContextHelp id="opsProductSalesInsights" />
          </div>
          <span className="text-xs text-slate-500">{insightsOpen ? 'Zwiń' : 'Rozwiń'}</span>
        </button>
        {insightsOpen ? (
          <div className="mt-4">
            <OpsProductSalesInsights
              rows={filtered}
              showPrices={showPrices}
              periodMonths={period}
              chartMetric={chartMetric}
              skuBasketCount={skuBasket.length}
              abcFilter={abcFilter}
              xyzFilter={xyzFilter}
              onAbcFilterChange={setAbcFilter}
              onXyzFilterChange={setXyzFilter}
            />
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-semibold text-slate-100">Tabela produktów</p>
          <ContextHelp id="opsProductSalesTable" />
          <span className="ml-auto text-xs text-slate-500">
            {sorted.length} wierszy · str. {safePage}/{totalPages}
          </span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Ładowanie…
          </div>
        ) : loadError ? (
          <div className="p-6 text-sm text-red-300">{loadError}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="ops-sales-table min-w-[1100px] w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/90 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-2.5 font-medium">#</th>
                  <th className="min-w-[220px] px-3 py-2.5 font-medium">Produkt</th>
                  <SortTh label="SKU" active={sortKey === 'sku'} desc={sortDesc} onClick={() => toggleSort('sku')} />
                  <th className="px-3 py-2.5 font-medium">Kategoria</th>
                  <SortTh label="Stan" active={sortKey === 'stock'} desc={sortDesc} onClick={() => toggleSort('stock')} nowrap />
                  <SortTh
                    label={`Szt. ${period}m`}
                    title="Netto ze znakiem — korekty faktur odejmują sztuki"
                    active={sortKey === 'qty'}
                    desc={sortDesc}
                    onClick={() => toggleSort('qty')}
                    nowrap
                  />
                  {period === 12 ? (
                    <SortTh
                      label="Δ 12m"
                      title="Zmiana szt. vs poprzednie 12 miesięcy"
                      active={sortKey === 'qtyChangePct'}
                      desc={sortDesc}
                      onClick={() => toggleSort('qtyChangePct')}
                      nowrap
                    />
                  ) : null}
                  <SortTh
                    label="Rotacja"
                    title="Szac. dni zapasu przy tempie sprzedaży z wybranego okresu"
                    active={sortKey === 'turnoverDays'}
                    desc={sortDesc}
                    onClick={() => toggleSort('turnoverDays')}
                    nowrap
                  />
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-[11px] uppercase tracking-wide text-slate-500">
                    ABC
                  </th>
                  <th className="whitespace-nowrap px-3 py-2.5 font-medium text-[11px] uppercase tracking-wide text-slate-500">
                    XYZ
                  </th>
                  {showPrices ? (
                    <>
                      <SortTh
                        label={`Netto ${period}m`}
                        active={sortKey === 'netValue'}
                        desc={sortDesc}
                        onClick={() => toggleSort('netValue')}
                        nowrap
                      />
                      <SortTh
                        label="Zakup"
                        active={sortKey === 'purchaseNet'}
                        desc={sortDesc}
                        onClick={() => toggleSort('purchaseNet')}
                        nowrap
                      />
                      <SortTh
                        label="Zysk"
                        active={sortKey === 'grossProfit'}
                        desc={sortDesc}
                        onClick={() => toggleSort('grossProfit')}
                        nowrap
                      />
                      <SortTh
                        label="Marża"
                        active={sortKey === 'realizedMarginPct'}
                        desc={sortDesc}
                        onClick={() => toggleSort('realizedMarginPct')}
                        nowrap
                      />
                    </>
                  ) : null}
                  <SortTh
                    label="Ostatnia sprz."
                    active={sortKey === 'lastSaleDate'}
                    desc={sortDesc}
                    onClick={() => toggleSort('lastSaleDate')}
                    nowrap
                  />
                  <th className="px-3 py-2.5 font-medium text-right">Link</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => {
                  const img = getProductImage(row.product);
                  const label = row.product.displayName || row.product.name;
                  const hot = row.qty >= 10;
                  const dead = row.qty === 0 && (row.product.stock ?? 0) > 0;
                  const excludedSum = isExcludedFromSum(row);
                  const rowNum = (safePage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={row.product.id}
                      className={`border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 ${
                        excludedSum ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 tabular-nums text-slate-500">{rowNum}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-slate-950">
                            {img ? (
                              <img src={img} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-3.5 w-3.5 text-slate-600" />
                            )}
                          </span>
                          <div className="min-w-0 max-w-[280px]">
                            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-slate-100" title={label}>
                              <span className="truncate">{label}</span>
                              <BaselinkerTag product={row.product} />
                            </p>
                          </div>
                          {hot ? (
                            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          ) : dead ? (
                            <TrendingDown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-300">
                        <span className="inline-flex items-center gap-1.5">
                          {row.product.sku}
                          {excludedSum ? (
                            <span
                              className="rounded bg-amber-950/80 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-300"
                              title="Wykluczone z sum KPI"
                            >
                              wykl.
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2.5 text-slate-400" title={row.product.category}>
                        {row.product.category || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-300">{row.product.stock ?? 0}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-base font-semibold text-slate-50">
                        {formatQty(row.qty)}
                      </td>
                      {period === 12 ? (
                        <td
                          className={`whitespace-nowrap px-3 py-2.5 tabular-nums text-sm font-medium ${
                            (row.qtyChangePct ?? 0) > 0
                              ? 'text-emerald-400'
                              : (row.qtyChangePct ?? 0) < 0
                                ? 'text-red-400'
                                : 'text-slate-400'
                          }`}
                        >
                          {formatChangePct(row.qtyChangePct)}
                        </td>
                      ) : null}
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-300">
                        {formatTurnoverDays(row.turnoverDays)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <AbcBadge cls={row.abcClass} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <XyzBadge cls={row.xyzClass} />
                      </td>
                      {showPrices ? (
                        <>
                          <td className="money-cell whitespace-nowrap px-3 py-2.5 tabular-nums font-medium text-slate-100">
                            {row.netValue != null ? formatPricePln(row.netValue) : '—'}
                          </td>
                          <td className="money-cell whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-400">
                            {row.purchaseNet != null ? formatPricePln(row.purchaseNet) : '—'}
                          </td>
                          <td
                            className={`money-cell whitespace-nowrap px-3 py-2.5 tabular-nums font-medium ${
                              (row.grossProfit ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'
                            }`}
                          >
                            {row.grossProfit != null ? formatPricePln(row.grossProfit) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-300">
                            {formatMarginPercent(row.realizedMarginPct)}
                          </td>
                        </>
                      ) : null}
                      <td className="whitespace-nowrap px-3 py-2.5 text-slate-400">{formatDate(row.lastSaleDate)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-2">
                          {!excludedSum && row.product.sku ? (
                            <button
                              type="button"
                              onClick={() => excludeSkuFromRow(row.product.sku)}
                              className="text-[10px] font-medium text-amber-500 hover:text-amber-300"
                              title="Wyklucz z sum"
                            >
                              Wykl.
                            </button>
                          ) : null}
                          <a
                            href={CATALOG_PRODUCT_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:text-brand-300"
                          >
                            Katalog
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!pageRows.length ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Brak wyników dla filtrów.</p>
            ) : null}
          </div>
        )}
        {!loading && !loadError && sorted.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500">
              Pozycje {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sorted.length)} z{' '}
              {sorted.length}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              >
                Poprzednia
              </button>
              <span className="text-xs tabular-nums text-slate-400">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
              >
                Następna
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AbcBadge({ cls }: { cls: 'A' | 'B' | 'C' }) {
  const tone =
    cls === 'A' ? 'ops-sales-badge--abc-a' : cls === 'B' ? 'ops-sales-badge--abc-b' : 'ops-sales-badge--abc-c';
  const colors =
    cls === 'A'
      ? 'border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-500/20 dark:text-emerald-300'
      : cls === 'B'
        ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-600/40 dark:bg-amber-500/20 dark:text-amber-300'
        : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-400';
  return (
    <span className={`ops-sales-badge ${tone} inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${colors}`}>
      {cls}
    </span>
  );
}

function XyzBadge({ cls }: { cls: 'X' | 'Y' | 'Z' | '—' }) {
  const tone =
    cls === 'X'
      ? 'ops-sales-badge--xyz-x'
      : cls === 'Y'
        ? 'ops-sales-badge--xyz-y'
        : cls === 'Z'
          ? 'ops-sales-badge--xyz-z'
          : 'ops-sales-badge--xyz-none';
  const colors =
    cls === 'X'
      ? 'border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-600/40 dark:bg-sky-500/20 dark:text-sky-300'
      : cls === 'Y'
        ? 'border-violet-400 bg-violet-50 text-violet-900 dark:border-violet-600/40 dark:bg-violet-500/20 dark:text-violet-300'
        : cls === 'Z'
          ? 'border-orange-400 bg-orange-50 text-orange-950 dark:border-orange-600/40 dark:bg-orange-500/20 dark:text-orange-300'
          : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500';
  return (
    <span className={`ops-sales-badge ${tone} inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${colors}`}>
      {cls}
    </span>
  );
}

function SectionHeading({ title, helpId }: { title: string; helpId: string }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <ContextHelp id={helpId} />
    </div>
  );
}

/** Zwraca PieChart/BarChart jako bezpośrednie dziecko ResponsiveContainer (musi dostać width/height). */
function renderSalesTopChart({
  data,
  metric,
  kind,
}: {
  data: Array<{ sku: string; name: string; qty: number; net: number; value: number; isTotal?: boolean }>;
  metric: 'qty' | 'netValue';
  kind: SalesChartKind;
}) {
  const fill = metric === 'qty' ? '#6366f1' : '#10b981';
  const axisFill = '#334155';
  const gridStroke = '#cbd5e1';

  if (kind === 'pie') {
    return (
      <PieChart margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="sku"
          cx="50%"
          cy="50%"
          outerRadius="78%"
          label={({ sku, percent }) =>
            `${sku} (${((percent ?? 0) * 100).toFixed(0)}%)`
          }
          labelLine={{ stroke: axisFill, strokeWidth: 1 }}
        >
          {data.map((row, i) => (
            <Cell key={row.sku} fill={row.isTotal ? '#f59e0b' : PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={(props) => <SalesChartTooltip {...props} chartMetric={metric} />} />
        <Legend
          formatter={(sku) => {
            const row = data.find((d) => d.sku === sku);
            return row ? `${sku} — ${row.name.slice(0, 24)}` : sku;
          }}
          wrapperStyle={{ fontSize: 11, color: axisFill }}
        />
      </PieChart>
    );
  }

  if (kind === 'bar-v') {
    return (
      <BarChart data={data} margin={{ left: 8, right: 12, top: 8, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis
          type="category"
          dataKey="sku"
          stroke={axisFill}
          fontSize={10}
          tick={{ fill: axisFill, fontWeight: 600 }}
          angle={-35}
          textAnchor="end"
          height={56}
        />
        <YAxis
          type="number"
          stroke={axisFill}
          fontSize={11}
          tick={{ fill: axisFill }}
          tickFormatter={(v) => (metric === 'qty' ? String(v) : `${Math.round(v / 1000)}k`)}
        />
        <Tooltip content={(props) => <SalesChartTooltip {...props} chartMetric={metric} />} />
        <Bar dataKey="value" fill={fill} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    );
  }

  return (
    <BarChart data={data} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
      <XAxis
        type="number"
        stroke={axisFill}
        fontSize={11}
        tick={{ fill: axisFill }}
        tickFormatter={(v) => (metric === 'qty' ? String(v) : `${Math.round(v / 1000)}k zł`)}
      />
      <YAxis
        type="category"
        dataKey="sku"
        width={92}
        stroke={axisFill}
        fontSize={11}
        tick={{ fill: axisFill, fontWeight: 600 }}
      />
      <Tooltip content={(props) => <SalesChartTooltip {...props} chartMetric={metric} />} />
      <Bar dataKey="value" fill={fill} radius={[0, 4, 4, 0]} isAnimationActive={false} />
    </BarChart>
  );
}

function SalesChartTooltip({
  active,
  payload,
  chartMetric,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: { name?: string; sku?: string; qty?: number; net?: number; value?: number };
  }>;
  chartMetric: 'qty' | 'netValue';
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const metricLabel =
    chartMetric === 'qty'
      ? `${formatQty(row.qty ?? row.value ?? 0)} szt.`
      : formatPricePln(row.net ?? row.value ?? 0);
  return (
    <div className="ops-sales-chart-tooltip max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-300 bg-white px-3 py-2.5 shadow-xl dark:border-slate-600 dark:bg-slate-900">
      <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50">{row.name}</p>
      <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{row.sku}</p>
      <p className="mt-2 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
        {metricLabel}
      </p>
    </div>
  );
}

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}

function ChartToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
        active ? 'bg-brand-600 text-white' : 'border border-slate-700 text-slate-400 hover:text-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      >
        {options.map((o) => (
          <option key={o.value || '__all'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
      />
    </label>
  );
}

function SortTh({
  label,
  active,
  desc,
  onClick,
  nowrap,
  title,
}: {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
  nowrap?: boolean;
  title?: string;
}) {
  return (
    <th className={`px-3 py-2.5 font-medium ${nowrap ? 'whitespace-nowrap' : ''}`} title={title}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${
          active ? 'text-brand-300' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        {label}
        {active ? (desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : null}
      </button>
    </th>
  );
}
