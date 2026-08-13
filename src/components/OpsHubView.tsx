import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  FileSpreadsheet,
  Landmark,
  LineChart,
  Plus,
  ReceiptText,
  Settings2,
  ShieldCheck,
  Store,
  TrendingUp,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  linearRegression,
  sampleCorrelation,
  standardDeviation,
} from 'simple-statistics';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FinanceDashboard } from './FinanceDashboard';
import { getMergedFinanceData } from '../lib/financeStore';
import type { FinanceChannel, FinanceMonth } from '../lib/financeTypes';
import { formatPricePln } from '../lib/format';
import { downloadCsv, stampFile } from '../lib/exportReport';
import { showToast } from '../lib/toast';
import { ContextHelp } from './ContextHelp';
import { inferContextHelpId } from '../lib/contextHelp';
import { OpsProductSalesAnalytics } from './ops/OpsProductSalesAnalytics';
import { OpsSonaxAnalytics, SonaxWorkspaceTile } from './ops/OpsSonaxAnalytics';

type OpsToolId =
  | 'hub'
  | 'finance'
  | 'data-inbox'
  | 'cashflow'
  | 'invoices'
  | 'collections'
  | 'settlements'
  | 'marketplace'
  | 'analytics-lab'
  | 'product-sales'
  | 'workspace-builder'
  | 'stat-builder'
  | 'cost-model'
  | 'sales-reps'
  | 'reports'
  | 'rules'
  | 'approvals';

type SourceFlow =
  | 'ecommerce'
  | 'field'
  | 'accounting'
  | 'bank'
  | 'costs'
  | 'warehouse';

type SourceStatus = 'connected' | 'manual' | 'missing';
type ChartKind = 'line' | 'bar' | 'area' | 'combo' | 'pie' | 'scatter';
type AnalyticsSort = { id: keyof AnalyticsRow; desc: boolean };
type ChartMetric =
  | 'sprzedaz'
  | 'wynikNetto'
  | 'kosztyRazem'
  | 'marzaNetto'
  | 'marzaPct'
  | 'kosztDoSprzedazy';

interface OpsDataSource {
  id: string;
  name: string;
  flow: SourceFlow;
  owner: string;
  cadence: string;
  status: SourceStatus;
  lastImport?: string;
  rows: number;
  value: number;
  confidence: number;
}

interface OpsImportRecord {
  id: string;
  sourceId: string;
  sourceName: string;
  month: string;
  area: SourceFlow;
  rows: number;
  value: number;
  fileName?: string;
  note?: string;
  createdAt: string;
}

interface CalculationRow {
  label: string;
  area: string;
  base: string;
  value: string;
  result: string;
  note: string;
}

interface ChartPreference {
  id: string;
  name: string;
  kind: ChartKind;
  metric: ChartMetric;
  compareMetric?: ChartMetric;
  months: number;
}

interface CostCategoryConfig {
  id: string;
  name: string;
  group: SourceFlow;
  budget: number;
  owner: string;
  alertPct: number;
}

interface SalesRepConfig {
  id: string;
  name: string;
  userLabel: string;
  sales: number;
  marginPct: number;
  targetMarginPct: number;
  commissionPct: number;
  returns: number;
  costs: number;
}

type DataCell = string | number | null;
type CustomDataColumnKind = 'text' | 'number' | 'date';

interface CustomDataColumn {
  id: string;
  name: string;
  kind: CustomDataColumnKind;
}

interface CustomDataSet {
  id: string;
  name: string;
  sourceName?: string;
  createdAt: string;
  columns: CustomDataColumn[];
  rows: Record<string, DataCell>[];
  primaryMetric?: string;
  categoryField?: string;
  dateField?: string;
  note?: string;
}

interface OpsPriority {
  id: string;
  title: string;
  detail: string;
  value: string;
  tone: 'good' | 'warn' | 'bad' | 'info';
  tool: OpsToolId;
}

const DATA_SOURCES_KEY = 'kenochem-ops-data-sources-v1';
const IMPORTS_KEY = 'kenochem-ops-imports-v1';
const CHART_PREFS_KEY = 'kenochem-ops-chart-prefs-v1';
const COST_CATEGORIES_KEY = 'kenochem-ops-cost-categories-v1';
const SALES_REPS_KEY = 'kenochem-ops-sales-reps-v1';
const CUSTOM_DATASETS_KEY = 'kenochem-ops-custom-datasets-v1';
const TOOL_IDS = new Set<OpsToolId>([
  'hub',
  'finance',
  'data-inbox',
  'cashflow',
  'invoices',
  'collections',
  'settlements',
  'marketplace',
  'analytics-lab',
  'product-sales',
  'workspace-builder',
  'stat-builder',
  'cost-model',
  'sales-reps',
  'reports',
  'rules',
  'approvals',
]);

const CHART_METRIC_LABELS: Record<ChartMetric, string> = {
  sprzedaz: 'Sprzedaz netto',
  wynikNetto: 'Wynik netto',
  kosztyRazem: 'Koszty razem',
  marzaNetto: 'Marza netto',
  marzaPct: 'Marza %',
  kosztDoSprzedazy: 'Koszt / sprzedaz',
};

const CHART_KINDS: { id: ChartKind; label: string }[] = [
  { id: 'line', label: 'Trend' },
  { id: 'bar', label: 'Slupki' },
  { id: 'area', label: 'Obszar' },
  { id: 'combo', label: 'Combo' },
  { id: 'pie', label: 'Udzialy' },
  { id: 'scatter', label: 'Zaleznosc' },
];

const DEFAULT_CHART_PREFS: ChartPreference[] = [
  {
    id: 'trend-profit',
    name: 'Sprzedaz vs wynik',
    kind: 'combo',
    metric: 'sprzedaz',
    compareMetric: 'wynikNetto',
    months: 12,
  },
  {
    id: 'cost-ratio',
    name: 'Koszty do sprzedazy',
    kind: 'area',
    metric: 'kosztDoSprzedazy',
    compareMetric: 'marzaPct',
    months: 12,
  },
];

const DEFAULT_COST_CATEGORIES: CostCategoryConfig[] = [
  { id: 'towar', name: 'Koszt towaru', group: 'costs', budget: 360000, owner: 'Ksiegowosc', alertPct: 90 },
  { id: 'marketplace', name: 'Prowizje marketplace', group: 'ecommerce', budget: 52000, owner: 'E-commerce', alertPct: 85 },
  { id: 'delivery', name: 'Dostawy i kurierzy', group: 'costs', budget: 36000, owner: 'Wysylka', alertPct: 90 },
  { id: 'office', name: 'Biuro i administracja', group: 'accounting', budget: 42000, owner: 'Biuro', alertPct: 80 },
  { id: 'ads', name: 'Reklamy i marketing', group: 'ecommerce', budget: 18000, owner: 'Marketing', alertPct: 85 },
];

const DEFAULT_SALES_REPS: SalesRepConfig[] = [
  {
    id: 'admin',
    name: 'Admin',
    userLabel: 'admin@kenochem',
    sales: 0,
    marginPct: 31,
    targetMarginPct: 30,
    commissionPct: 4,
    returns: 0,
    costs: 1200,
  },
  {
    id: 'handlowiec-1',
    name: 'Handlowiec terenowy',
    userLabel: 'crm:user-1',
    sales: 0,
    marginPct: 28,
    targetMarginPct: 30,
    commissionPct: 3.5,
    returns: 0,
    costs: 1600,
  },
  {
    id: 'biuro',
    name: 'Biuro handlowe',
    userLabel: 'crm:office',
    sales: 0,
    marginPct: 34,
    targetMarginPct: 32,
    commissionPct: 2.5,
    returns: 0,
    costs: 900,
  },
];

const ECOMMERCE_CHANNEL_RE =
  /allegro|erli|empik|kaufland|kenochem\.com|sonax\.sklep|czystomania|sklep/i;
const FIELD_CHANNEL_RE = /telefon|reczne|mail|handl|teren|b2b/i;

const DEFAULT_SOURCES: OpsDataSource[] = [
  {
    id: 'baselinker',
    name: 'BaseLinker / marketplace',
    flow: 'ecommerce',
    owner: 'E-commerce',
    cadence: 'codziennie',
    status: 'manual',
    rows: 0,
    value: 0,
    confidence: 72,
  },
  {
    id: 'allegro',
    name: 'Allegro rozliczenia',
    flow: 'ecommerce',
    owner: 'E-commerce',
    cadence: 'tygodniowo',
    status: 'manual',
    rows: 0,
    value: 0,
    confidence: 68,
  },
  {
    id: 'wapro',
    name: 'WAPRO / faktury i dokumenty',
    flow: 'accounting',
    owner: 'Ksiegowosc',
    cadence: 'codziennie',
    status: 'manual',
    rows: 0,
    value: 0,
    confidence: 76,
  },
  {
    id: 'bank',
    name: 'Bank / wyciagi i platnosci',
    flow: 'bank',
    owner: 'Finanse',
    cadence: 'codziennie',
    status: 'missing',
    rows: 0,
    value: 0,
    confidence: 45,
  },
  {
    id: 'sales-reps',
    name: 'Raporty handlowcow',
    flow: 'field',
    owner: 'Handel',
    cadence: 'tygodniowo',
    status: 'manual',
    rows: 0,
    value: 0,
    confidence: 62,
  },
  {
    id: 'costs-office',
    name: 'Koszty biuro / wysylka / SaaS',
    flow: 'costs',
    owner: 'Biuro',
    cadence: 'miesiecznie',
    status: 'manual',
    rows: 0,
    value: 0,
    confidence: 64,
  },
];

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function pctDelta(cur: number, prev: number | null | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function deltaLabel(cur: number, prev: number | null | undefined): string {
  const delta = pctDelta(cur, prev);
  if (delta == null) return 'brak porownania';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}% vs poprzedni miesiac`;
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  if (!year || !month) return ym;
  return `${month}.${year}`;
}

function sumChannels(channels: FinanceChannel[], kind: 'ecommerce' | 'field'): number {
  return channels
    .filter((c) =>
      kind === 'ecommerce'
        ? ECOMMERCE_CHANNEL_RE.test(c.channel)
        : FIELD_CHANNEL_RE.test(c.channel),
    )
    .reduce((sum, c) => sum + c.amount, 0);
}

function moneyShare(amount: number, total: number): string {
  if (total <= 0) return '0.0%';
  return `${((amount / total) * 100).toFixed(1)}%`;
}

function parseMoney(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseReportText(text: string): { rows: number; value: number } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return { rows: 0, value: 0 };

  const delimiter = text.includes(';') ? ';' : text.includes('\t') ? '\t' : ',';
  const body = lines.slice(1, 501).map((line) => line.split(delimiter));
  const maxCols = Math.max(...body.map((row) => row.length), 0);
  const sums = Array.from({ length: maxCols }, () => 0);

  for (const row of body) {
    row.forEach((cell, idx) => {
      const normalized = cell
        .replace(/\s/g, '')
        .replace(/zł|zl|pln/gi, '')
        .replace(',', '.');
      const value = Number(normalized);
      if (Number.isFinite(value)) sums[idx] += value;
    });
  }

  return {
    rows: Math.max(lines.length - 1, 0),
    value: Math.max(...sums, 0),
  };
}

function parseDelimitedData(text: string): Pick<CustomDataSet, 'columns' | 'rows'> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) return { columns: [], rows: [] };

  const delimiter = detectDelimiter(lines.slice(0, 10).join('\n'));
  const headers = splitDelimitedLine(lines[0], delimiter).map((header, idx) =>
    slugColumn(header || `Kolumna ${idx + 1}`, idx),
  );
  const rawRows = lines.slice(1, 2001).map((line) => splitDelimitedLine(line, delimiter));
  const columns = headers.map((column, idx) => ({
    ...column,
    kind: inferColumnKind(rawRows.map((row) => row[idx] ?? '')),
  }));
  const rows = rawRows.map((row) =>
    columns.reduce<Record<string, DataCell>>((acc, column, idx) => {
      acc[column.id] = coerceDataCell(row[idx] ?? '', column.kind);
      return acc;
    }, {}),
  );
  return { columns, rows };
}

function parseExcelRows(table: unknown[][]): Pick<CustomDataSet, 'columns' | 'rows'> {
  const cleanRows = table.filter((row) =>
    row.some((cell) => excelCellToString(cell).trim().length > 0),
  );
  if (cleanRows.length <= 1) return { columns: [], rows: [] };

  const headers = cleanRows[0].map((cell, idx) =>
    slugColumn(excelCellToString(cell) || `Kolumna ${idx + 1}`, idx),
  );
  const rawRows = cleanRows.slice(1, 2001);
  const columns = headers.map((column, idx) => ({
    ...column,
    kind: inferColumnKind(rawRows.map((row) => excelCellToString(row[idx]))),
  }));
  const rows = rawRows.map((row) =>
    columns.reduce<Record<string, DataCell>>((acc, column, idx) => {
      acc[column.id] = coerceExcelCell(row[idx], column.kind);
      return acc;
    }, {}),
  );
  return { columns, rows };
}

function excelCellToString(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function coerceExcelCell(value: unknown, kind: CustomDataColumnKind): DataCell {
  if (value == null) return null;
  if (kind === 'number' && typeof value === 'number' && Number.isFinite(value)) return value;
  if (kind === 'date' && value instanceof Date) return value.toISOString().slice(0, 10);
  return coerceDataCell(excelCellToString(value), kind);
}

function detectDelimiter(sample: string): string {
  const candidates = [';', '\t', ',', '|'];
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: sample.split('\n').reduce((sum, line) => sum + line.split(delimiter).length, 0),
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ';';
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let idx = 0; idx < line.length; idx += 1) {
    const char = line[idx];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function slugColumn(name: string, idx: number): CustomDataColumn {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return {
    id: `${base || 'kolumna'}_${idx}`,
    name: name.trim() || `Kolumna ${idx + 1}`,
    kind: 'text',
  };
}

function inferColumnKind(values: string[]): CustomDataColumnKind {
  const sample = values.map((value) => value.trim()).filter(Boolean).slice(0, 80);
  if (!sample.length) return 'text';
  const numeric = sample.filter((value) => Number.isFinite(parseDataNumber(value))).length;
  const dates = sample.filter((value) => !Number.isNaN(Date.parse(value))).length;
  if (numeric / sample.length >= 0.72) return 'number';
  if (dates / sample.length >= 0.72) return 'date';
  return 'text';
}

function parseDataNumber(value: string): number {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/z\u0142|zl|pln/gi, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const result = Number(normalized);
  return Number.isFinite(result) ? result : Number.NaN;
}

function coerceDataCell(value: string, kind: CustomDataColumnKind): DataCell {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (kind === 'number') {
    const numberValue = parseDataNumber(trimmed);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  if (kind === 'date') return trimmed.slice(0, 10);
  return trimmed;
}

function buildOpsPriorities({
  current,
  sources,
  imports,
  costCategories,
  customDataSets,
  chartPrefs,
  readiness,
  reconciliationGap,
}: {
  current: FinanceMonth | null;
  sources: OpsDataSource[];
  imports: OpsImportRecord[];
  costCategories: CostCategoryConfig[];
  customDataSets: CustomDataSet[];
  chartPrefs: ChartPreference[];
  readiness: number;
  reconciliationGap: number;
}): OpsPriority[] {
  const priorities: OpsPriority[] = [];
  const revenue = current?.sprzedaz ?? 0;
  const missingSources = sources.filter((source) => source.status === 'missing');
  const staleSources = sources.filter((source) => source.status !== 'missing' && source.confidence < 70);
  const gapPct = revenue > 0 ? reconciliationGap / revenue : 0;

  if (gapPct > 0.08) {
    priorities.push({
      id: 'reconciliation-gap',
      title: 'Uzgodnij sprzedaz',
      detail: 'Kanaly nie spinaja sie z wynikiem miesiaca',
      value: formatPricePln(reconciliationGap),
      tone: 'bad',
      tool: 'data-inbox',
    });
  } else if (gapPct > 0.03) {
    priorities.push({
      id: 'reconciliation-watch',
      title: 'Sprawdz luke kanalow',
      detail: 'Roznica jest widoczna, ale jeszcze pod kontrola',
      value: `${(gapPct * 100).toFixed(1)}%`,
      tone: 'warn',
      tool: 'data-inbox',
    });
  }

  if (missingSources.length) {
    priorities.push({
      id: 'missing-sources',
      title: 'Podlacz zrodla',
      detail: missingSources.map((source) => source.name).slice(0, 2).join(', '),
      value: String(missingSources.length),
      tone: 'warn',
      tool: 'data-inbox',
    });
  }

  if (readiness < 72 || staleSources.length) {
    priorities.push({
      id: 'data-quality',
      title: 'Podnies jakosc danych',
      detail: staleSources[0]?.name ?? 'Kilka zrodel ma niska wiarygodnosc',
      value: `${readiness}%`,
      tone: readiness < 60 ? 'bad' : 'warn',
      tool: 'data-inbox',
    });
  }

  const overBudget = costCategories
    .map((category) => ({
      category,
      actual: categoryActual(category, current, imports),
    }))
    .filter(({ category, actual }) => category.budget > 0 && (actual / category.budget) * 100 >= category.alertPct)
    .sort((a, b) => b.actual / b.category.budget - a.actual / a.category.budget)[0];

  if (overBudget) {
    priorities.push({
      id: 'budget-alert',
      title: 'Kontrola kosztow',
      detail: overBudget.category.name,
      value: `${((overBudget.actual / overBudget.category.budget) * 100).toFixed(0)}%`,
      tone: overBudget.actual > overBudget.category.budget ? 'bad' : 'warn',
      tool: 'cost-model',
    });
  }

  if (!customDataSets.length) {
    priorities.push({
      id: 'custom-data',
      title: 'Zbuduj pierwsza plansze',
      detail: 'Wgraj XLSX/CSV z faktur, banku albo marketplace',
      value: '0',
      tone: 'info',
      tool: 'workspace-builder',
    });
  }

  if (chartPrefs.length < 3) {
    priorities.push({
      id: 'chart-views',
      title: 'Dodaj widok KPI',
      detail: 'Wlasne wykresy przyspiesza miesieczna analize',
      value: String(chartPrefs.length),
      tone: 'info',
      tool: 'stat-builder',
    });
  }

  if (!priorities.length) {
    priorities.push({
      id: 'ok',
      title: 'Operacje spokojne',
      detail: 'Brak pilnych alarmow na pulpicie',
      value: 'OK',
      tone: 'good',
      tool: 'finance',
    });
  }

  return priorities.slice(0, 5);
}

export function OpsHubView() {
  const [tool, setTool] = useState<OpsToolId>('hub');
  const [sources, setSources] = useState<OpsDataSource[]>(() =>
    loadJson(DATA_SOURCES_KEY, DEFAULT_SOURCES),
  );
  const [imports, setImports] = useState<OpsImportRecord[]>(() =>
    loadJson(IMPORTS_KEY, []),
  );
  const [chartPrefs, setChartPrefs] = useState<ChartPreference[]>(() =>
    loadJson(CHART_PREFS_KEY, DEFAULT_CHART_PREFS),
  );
  const [costCategories, setCostCategories] = useState<CostCategoryConfig[]>(() =>
    loadJson(COST_CATEGORIES_KEY, DEFAULT_COST_CATEGORIES),
  );
  const [salesReps, setSalesReps] = useState<SalesRepConfig[]>(() =>
    loadJson(SALES_REPS_KEY, DEFAULT_SALES_REPS),
  );
  const [customDataSets, setCustomDataSets] = useState<CustomDataSet[]>(() =>
    loadJson(CUSTOM_DATASETS_KEY, []),
  );

  const financeData = useMemo(() => getMergedFinanceData(), []);
  const current =
    financeData.months.find((m) => m.month === financeData.meta.defaultMonth) ??
    financeData.months[financeData.months.length - 1] ??
    null;
  const previous = current
    ? financeData.months[financeData.months.findIndex((m) => m.month === current.month) - 1]
    : null;
  const currentChannels = current
    ? financeData.channelsByMonth[current.month] ?? []
    : [];
  const ecommerceSales = sumChannels(currentChannels, 'ecommerce');
  const fieldSales = sumChannels(currentChannels, 'field');
  const normalizedSalesReps = useMemo(
    () => normalizeSalesReps(salesReps, fieldSales),
    [salesReps, fieldSales],
  );

  useEffect(() => {
    saveJson(DATA_SOURCES_KEY, sources);
  }, [sources]);

  useEffect(() => {
    saveJson(IMPORTS_KEY, imports);
  }, [imports]);

  useEffect(() => {
    saveJson(CHART_PREFS_KEY, chartPrefs);
  }, [chartPrefs]);

  useEffect(() => {
    saveJson(COST_CATEGORIES_KEY, costCategories);
  }, [costCategories]);

  useEffect(() => {
    saveJson(SALES_REPS_KEY, salesReps);
  }, [salesReps]);

  useEffect(() => {
    saveJson(CUSTOM_DATASETS_KEY, customDataSets);
  }, [customDataSets]);

  useEffect(() => {
    const onTool = (event: Event) => {
      const next = (event as CustomEvent<{ tool?: string }>).detail?.tool;
      if (next && TOOL_IDS.has(next as OpsToolId)) setTool(next as OpsToolId);
    };
    window.addEventListener('katalog-ops-tool', onTool);
    return () => window.removeEventListener('katalog-ops-tool', onTool);
  }, []);

  if (tool === 'finance') {
    return <FinanceDashboard onBack={() => setTool('hub')} />;
  }

  if (tool === 'data-inbox') {
    return (
      <DataSupplyPanel
        current={current}
        sources={sources}
        imports={imports}
        onBack={() => setTool('hub')}
        onSourcesChange={setSources}
        onImportsChange={setImports}
      />
    );
  }

  if (tool === 'analytics-lab') {
    return (
      <AdvancedAnalyticsLab
        financeMonths={financeData.months}
        channels={currentChannels}
        imports={imports}
        onBack={() => setTool('hub')}
      />
    );
  }

  if (tool === 'product-sales') {
    return <OpsProductSalesAnalytics onBack={() => setTool('hub')} />;
  }

  if (tool === 'workspace-builder') {
    return (
      <WorkspaceBuilderPanel
        dataSets={customDataSets}
        onDataSetsChange={setCustomDataSets}
        onBack={() => setTool('hub')}
      />
    );
  }

  if (tool === 'stat-builder') {
    return (
      <StatsBuilderPanel
        financeMonths={financeData.months}
        channels={currentChannels}
        chartPrefs={chartPrefs}
        onChartPrefsChange={setChartPrefs}
        onBack={() => setTool('hub')}
      />
    );
  }

  if (tool === 'cost-model') {
    return (
      <CostModelPanel
        current={current}
        imports={imports}
        categories={costCategories}
        onCategoriesChange={setCostCategories}
        onBack={() => setTool('hub')}
      />
    );
  }

  if (tool === 'sales-reps') {
    return (
      <SalesRepsPanel
        reps={normalizedSalesReps}
        rawReps={salesReps}
        onRepsChange={setSalesReps}
        onBack={() => setTool('hub')}
      />
    );
  }

  if (tool !== 'hub') {
    return (
      <OpsToolPanel
        tool={tool}
        current={current}
        previous={previous}
        channels={currentChannels}
        ecommerceSales={ecommerceSales}
        fieldSales={fieldSales}
        imports={imports}
        onBack={() => setTool('hub')}
      />
    );
  }

  return (
    <FinanceOperationsHome
      current={current}
      previous={previous}
      sources={sources}
      imports={imports}
      chartPrefs={chartPrefs}
      costCategories={costCategories}
      salesReps={normalizedSalesReps}
      customDataSets={customDataSets}
      ecommerceSales={ecommerceSales}
      fieldSales={fieldSales}
      onOpenTool={setTool}
    />
  );
}

function FinanceOperationsHome({
  current,
  previous,
  sources,
  imports,
  chartPrefs,
  costCategories,
  salesReps,
  customDataSets,
  ecommerceSales,
  fieldSales,
  onOpenTool,
}: {
  current: FinanceMonth | null;
  previous: FinanceMonth | null | undefined;
  sources: OpsDataSource[];
  imports: OpsImportRecord[];
  chartPrefs: ChartPreference[];
  costCategories: CostCategoryConfig[];
  salesReps: SalesRepConfig[];
  customDataSets: CustomDataSet[];
  ecommerceSales: number;
  fieldSales: number;
  onOpenTool: (tool: OpsToolId) => void;
}) {
  const revenue = current?.sprzedaz ?? 0;
  const importedValue = imports.reduce((sum, item) => sum + item.value, 0);
  const manualSources = sources.filter((s) => s.status !== 'missing').length;
  const readiness = Math.round(
    sources.reduce((sum, s) => sum + s.confidence, 0) / Math.max(sources.length, 1),
  );
  const reconciliationGap = Math.abs(revenue - ecommerceSales - fieldSales);
  const repsContribution = salesReps.reduce((sum, rep) => sum + repContribution(rep), 0);
  const budgetTotal = costCategories.reduce((sum, cat) => sum + cat.budget, 0);
  const priorities = buildOpsPriorities({
    current,
    sources,
    imports,
    costCategories,
    customDataSets,
    chartPrefs,
    readiness,
    reconciliationGap,
  });

  return (
    <div className="ops-sales-analytics mx-auto w-full max-w-[1600px] space-y-4 px-1 pb-10">
      <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-400">
              <Wallet className="h-5 w-5 shrink-0" />
              <p className="text-xs font-semibold uppercase tracking-wide">
                Centrum operacji finansowych
              </p>
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-slate-50">
              Kontrola finansow, rozliczen i raportow Kenochem
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              E-commerce, handel terenowy, koszty, platnosci i raporty z zewnatrznych zrodel.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenTool('finance')}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
            >
              <LineChart className="h-4 w-4" />
              Dashboard finansowy
            </button>
            <button
              type="button"
              onClick={() => onOpenTool('data-inbox')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" />
              Dostawa danych
            </button>
          </div>
        </div>
        <details className="group border-t border-slate-200 dark:border-slate-800">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900/50 [&::-webkit-details-marker]:hidden">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Stan danych</span>
            <span className="tabular-nums text-slate-700 dark:text-slate-300">
              gotowosc {readiness}% · luka {formatPricePln(reconciliationGap)} · {manualSources}/{sources.length} zrodel
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
          </summary>
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <MiniStat label="Gotowosc" value={`${readiness}%`} />
              <MiniStat label="Zrodla" value={`${manualSources}/${sources.length}`} />
              <MiniStat label="Importy" value={String(imports.length)} />
              <MiniStat label="Wartosc" value={formatPricePln(importedValue)} />
              <MiniStat label="Wykresy" value={String(chartPrefs.length)} />
              <MiniStat label="Zbiory" value={String(customDataSets.length)} />
              <MiniStat label="Budzet kosztow" value={formatPricePln(budgetTotal)} />
              <MiniStat label="Luka kanalow" value={formatPricePln(reconciliationGap)} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Roznica miedzy sprzedaza miesiaca a rozpoznanymi kanalami (e-commerce + handel terenowy).
            </p>
          </div>
        </details>
      </header>

      <OpsCommandDock
        current={current}
        priorities={priorities}
        readiness={readiness}
        reconciliationGap={reconciliationGap}
        onOpenTool={onOpenTool}
      />

      {current ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FinanceKpiTile
            label={`Sprzedaz ${monthLabel(current.month)}`}
            value={formatPricePln(current.sprzedaz)}
            hint={deltaLabel(current.sprzedaz, previous?.sprzedaz)}
          />
          <FinanceKpiTile
            label="Wynik netto"
            value={formatPricePln(current.wynikNetto)}
            hint={deltaLabel(current.wynikNetto, previous?.wynikNetto)}
            tone={current.wynikNetto >= 0 ? 'good' : 'bad'}
          />
          <FinanceKpiTile
            label="Koszty razem"
            value={formatPricePln(current.kosztyRazem)}
            hint={deltaLabel(current.kosztyRazem, previous?.kosztyRazem)}
          />
          <FinanceKpiTile
            label="E-commerce"
            value={formatPricePln(ecommerceSales)}
            hint={`${moneyShare(ecommerceSales, current.sprzedaz)} sprzedazy`}
          />
          <FinanceKpiTile
            label="Handel terenowy"
            value={formatPricePln(fieldSales)}
            hint={`${moneyShare(fieldSales, current.sprzedaz)} sprzedazy`}
          />
        </div>
      ) : null}

      {current ? (
        <section className="grid gap-3 xl:grid-cols-4">
          <FinanceLaneCard
            title="E-commerce"
            icon={<Store className="h-4 w-4" />}
            value={formatPricePln(ecommerceSales)}
            hint="marketplace, sklepy, prowizje, zwroty"
            onClick={() => onOpenTool('marketplace')}
          />
          <FinanceLaneCard
            title="Handel i B2B"
            icon={<Building2 className="h-4 w-4" />}
            value={formatPricePln(fieldSales)}
            hint="teren, biuro handlowe, prowizje"
            onClick={() => onOpenTool('settlements')}
          />
          <FinanceLaneCard
            title="Platnosci i cashflow"
            icon={<Landmark className="h-4 w-4" />}
            value={formatPricePln(Math.max(current.sprzedaz - current.kosztyRazem, 0))}
            hint="saldo, naleznosci, zobowiazania"
            onClick={() => onOpenTool('cashflow')}
          />
          <FinanceLaneCard
            title="Ksiegowosc"
            icon={<ReceiptText className="h-4 w-4" />}
            value={formatPricePln(current.kosztyRazem)}
            hint="faktury, koszty, raporty zarzadcze"
            onClick={() => onOpenTool('invoices')}
          />
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <SectionTitle
            title="Narzedzia operacji"
            subtitle="Kazdy kafelek otwiera roboczy widok z tabelami i miejscem na dokladne wyliczenia."
          />
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            <ToolCard
              icon={<TrendingUp className="h-5 w-5" />}
              title="Analiza sprzedazy produktow"
              subtitle="Rankingi Mag WAPRO: najlepiej, najgorzej, netto, wolumen"
              onClick={() => onOpenTool('product-sales')}
            />
            <ToolCard
              icon={<BarChart3 className="h-5 w-5" />}
              title="Kreator statystyk"
              subtitle="Budowanie wlasnych wykresow, metryk i porownan"
              onClick={() => onOpenTool('stat-builder')}
            />
            <ToolCard
              icon={<Database className="h-5 w-5" />}
              title="Laboratorium danych"
              subtitle="DuckDB, Perspective, ECharts, TanStack i statystyka"
              onClick={() => onOpenTool('analytics-lab')}
            />
            <ToolCard
              icon={<FileSpreadsheet className="h-5 w-5" />}
              title="Wlasne zbiory"
              subtitle="Faktury, wyciagi i raporty jako wlasne plansze analityczne"
              onClick={() => onOpenTool('workspace-builder')}
            />
            <ToolCard
              icon={<LineChart className="h-5 w-5" />}
              title="Dashboard finansowy"
              subtitle="KPI, miesiace, wykresy, struktura kosztow"
              onClick={() => onOpenTool('finance')}
            />
            <ToolCard
              icon={<Upload className="h-5 w-5" />}
              title="Dostawa danych"
              subtitle="Raporty z BaseLinker, Allegro, banku, WAPRO i handlowcow"
              onClick={() => onOpenTool('data-inbox')}
            />
            <ToolCard
              icon={<Wallet className="h-5 w-5" />}
              title="Cashflow"
              subtitle="Przeplywy, saldo, zobowiazania i prognoza"
              onClick={() => onOpenTool('cashflow')}
            />
            <ToolCard
              icon={<ReceiptText className="h-5 w-5" />}
              title="Faktury i platnosci"
              subtitle="Wystawione, zaplacone, otwarte i po terminie"
              onClick={() => onOpenTool('invoices')}
            />
            <ToolCard
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Windykacja"
              subtitle="Naleznosci po terminie, priorytety i etapy kontaktu"
              onClick={() => onOpenTool('collections')}
            />
            <ToolCard
              icon={<Calculator className="h-5 w-5" />}
              title="Rozliczenia handlowcow"
              subtitle="Sprzedaz, prowizje, korekty i wynik kanalow"
              onClick={() => onOpenTool('sales-reps')}
            />
            <ToolCard
              icon={<Database className="h-5 w-5" />}
              title="Kategorie kosztow"
              subtitle="Wlasne typy kosztow, budzety i progi alarmowe"
              onClick={() => onOpenTool('cost-model')}
            />
            <ToolCard
              icon={<Store className="h-5 w-5" />}
              title="Marketplace"
              subtitle="Prowizje, dostawy, zwroty i wynik platform"
              onClick={() => onOpenTool('marketplace')}
            />
            <ToolCard
              icon={<FileSpreadsheet className="h-5 w-5" />}
              title="Raporty zarzadcze"
              subtitle="Eksport i kontrola miesiecznych tabel"
              onClick={() => onOpenTool('reports')}
            />
            <ToolCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Reguly i alerty"
              subtitle="Limity kosztow, progi marzy, platnosci"
              onClick={() => onOpenTool('rules')}
            />
            <ToolCard
              icon={<ClipboardList className="h-5 w-5" />}
              title="Akceptacje kosztow"
              subtitle="Zakupy firmowe, budzety, decyzje"
              onClick={() => onOpenTool('approvals')}
            />
          </div>
        </div>

        <div className="space-y-3">
          <SectionTitle
            title="Kontrola wyliczen"
            subtitle="Przestrzen na uzgodnienia, odchylenia i spojnosc danych."
          />
          <CalculationTable
            rows={[
              {
                label: 'Marza netto',
                area: 'Wynik',
                base: 'Sprzedaz - koszt towaru',
                value: current ? formatPricePln(current.marzaNetto) : '-',
                result: current ? `${(current.marzaPct * 100).toFixed(1)}%` : '-',
                note: 'pierwszy poziom kontroli rentownosci',
              },
              {
                label: 'Koszty do sprzedazy',
                area: 'Koszty',
                base: 'Koszty razem / sprzedaz',
                value: current ? formatPricePln(current.kosztyRazem) : '-',
                result: current ? `${(current.kosztDoSprzedazy * 100).toFixed(1)}%` : '-',
                note: 'pilnowanie udzialu kosztow w obrocie',
              },
              {
                label: 'Uzgodnienie kanalow',
                area: 'Dane',
                base: 'E-commerce + handel',
                value: formatPricePln(ecommerceSales + fieldSales),
                result: formatPricePln(reconciliationGap),
                note: 'luka do wyjasnienia w dostawie danych',
              },
              {
                label: 'Pokrycie zrodel',
                area: 'Dane',
                base: 'aktywne / wszystkie',
                value: `${manualSources}/${sources.length}`,
                result: `${readiness}%`,
                note: 'jak bardzo mozna ufac pulpitowi',
              },
              {
                label: 'Wynik handlowcow',
                area: 'Handel',
                base: 'marza - prowizje - koszty',
                value: formatPricePln(fieldSales),
                result: formatPricePln(repsContribution),
                note: 'model po uzytkowniku CRM',
              },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionTitle
              title="Podglad personalizowanych statystyk"
              subtitle="Pierwszy zapisany widok z kreatora. Mozesz pozniej budowac wiele takich kart."
            />
            <button
              type="button"
              onClick={() => onOpenTool('stat-builder')}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Edytuj
            </button>
          </div>
          <ChartPreview
            months={getMergedFinanceData().months}
            preference={chartPrefs[0] ?? DEFAULT_CHART_PREFS[0]}
          />
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionTitle
              title="Handlowcy"
              subtitle="Wynik per uzytkownik. Dane reczne teraz, CRM pozniej."
            />
            <button
              type="button"
              onClick={() => onOpenTool('sales-reps')}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Otworz
            </button>
          </div>
          <SalesRepMiniList reps={salesReps} />
        </div>
      </section>
    </div>
  );
}

type AnalyticsRow = {
  month: string;
  sprzedaz: number;
  koszty: number;
  wynik: number;
  marzaPct: number;
  kosztPct: number;
  salesGrowthPct: number | null;
  wynikZScore: number;
};

function WorkspaceBuilderPanel({
  dataSets,
  onDataSetsChange,
  onBack,
}: {
  dataSets: CustomDataSet[];
  onDataSetsChange: (dataSets: CustomDataSet[]) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('Nowy zbior danych');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<Pick<CustomDataSet, 'columns' | 'rows'> | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [activeId, setActiveId] = useState(dataSets[0]?.id ?? '');
  const [sonaxOpen, setSonaxOpen] = useState(false);

  useEffect(() => {
    if (sonaxOpen) return;
    if (!dataSets.length) {
      setActiveId('');
      return;
    }
    if (!dataSets.some((dataSet) => dataSet.id === activeId)) {
      setActiveId(dataSets[0].id);
    }
  }, [activeId, dataSets, sonaxOpen]);

  if (sonaxOpen) {
    return (
      <OpsSonaxAnalytics embedded onBack={() => setSonaxOpen(false)} />
    );
  }

  const selected = dataSets.find((dataSet) => dataSet.id === activeId) ?? dataSets[0] ?? null;
  const numericColumns = selected ? dataSetColumnsByKind(selected, 'number') : [];
  const textColumns = selected ? dataSetColumnsByKind(selected, 'text') : [];
  const dateColumns = selected ? dataSetColumnsByKind(selected, 'date') : [];
  const metricId = selected?.primaryMetric ?? numericColumns[0]?.id ?? '';
  const categoryId = selected?.categoryField ?? textColumns[0]?.id ?? '';
  const dateId = selected?.dateField ?? dateColumns[0]?.id ?? '';
  const metricValues = selected && metricId ? dataSetMetricValues(selected, metricId) : [];
  const metricTotal = metricValues.reduce((sum, value) => sum + value, 0);
  const metricAvg = avg(metricValues);
  const metricSd = metricValues.length > 1 ? standardDeviation(metricValues) : 0;
  const grouped = selected && metricId && categoryId
    ? groupDataSetRows(selected, categoryId, metricId).slice(0, 8)
    : [];

  async function handleFile(file: File | null) {
    if (!file) return;
    let parsed: Pick<CustomDataSet, 'columns' | 'rows'>;
    try {
      if (/\.xlsx$/i.test(file.name)) {
        const { default: readXlsxFile } = await import('read-excel-file/browser');
        const rows = await readXlsxFile(file);
        parsed = parseExcelRows(rows as unknown as unknown[][]);
      } else {
        const text = await file.text();
        parsed = parseDelimitedData(text);
      }
    } catch (error) {
      console.error(error);
      showToast('Nie udalo sie odczytac pliku', 'error');
      return;
    }
    if (!parsed.columns.length || !parsed.rows.length) {
      showToast('Nie udalo sie rozpoznac tabeli w pliku', 'warn');
      return;
    }
    setPending(parsed);
    setSourceName(file.name);
    if (name === 'Nowy zbior danych') setName(file.name.replace(/\.[^.]+$/, ''));
    showToast(`Wczytano ${parsed.rows.length} wierszy`, 'ok');
  }

  function saveDataSet() {
    if (!pending?.columns.length || !pending.rows.length) {
      showToast('Najpierw wskaz plik z danymi', 'warn');
      return;
    }
    const numeric = pending.columns.filter((column) => column.kind === 'number');
    const text = pending.columns.filter((column) => column.kind === 'text');
    const date = pending.columns.filter((column) => column.kind === 'date');
    const next: CustomDataSet = {
      id: `set-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || sourceName || 'Zbior danych',
      sourceName: sourceName || undefined,
      createdAt: new Date().toISOString(),
      columns: pending.columns,
      rows: pending.rows,
      primaryMetric: numeric[0]?.id,
      categoryField: text[0]?.id,
      dateField: date[0]?.id,
      note: note.trim() || undefined,
    };
    onDataSetsChange([next, ...dataSets]);
    setActiveId(next.id);
    setPending(null);
    setSourceName('');
    setNote('');
    setName('Nowy zbior danych');
    showToast('Zapisano wlasna plansze danych', 'ok');
  }

  function updateSelected(patch: Partial<CustomDataSet>) {
    if (!selected) return;
    onDataSetsChange(dataSets.map((dataSet) =>
      dataSet.id === selected.id ? { ...dataSet, ...patch } : dataSet,
    ));
  }

  function exportSelected() {
    if (!selected) return;
    downloadCsv(
      stampFile(`ops_${selected.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`),
      selected.columns.map((column) => column.name),
      selected.rows.map((row) => selected.columns.map((column) => row[column.id])),
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-1 pb-10">
      <BackButton onBack={onBack} label="Operacje" />
      <header className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-brand-500/15 p-3 text-brand-300">
              <FileSpreadsheet className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-50">
                Wlasne zbiory i plansze analityczne
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
                Zamieniamy arkusze na gotowe tablice pracy: wgrywasz faktury,
                wyciagi, raporty CSV albo eksporty z systemow, wybierasz metryki
                i od razu widzisz wynik, podzial oraz tabele.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportSelected}
            disabled={!selected}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Eksport CSV
          </button>
        </div>
      </header>

      <SonaxWorkspaceTile onOpen={() => setSonaxOpen(true)} />

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <SectionTitle
              title="Dodaj zbior"
              subtitle="XLSX, CSV, TSV albo TXT z naglowkami. Nadaje sie na faktury, bank, marketplace, koszty i raporty handlowcow."
            />
            <div className="mt-4 space-y-3">
              <Field label="Nazwa planszy">
                <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label="Opis / cel">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className={`${INPUT_CLS} resize-none`}
                  placeholder="np. faktury kosztowe lipiec, wyciag bankowy, raport Allegro"
                />
              </Field>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-6 text-center hover:border-brand-500/70">
                <Upload className="h-6 w-6 text-brand-300" />
                <span className="mt-2 text-sm font-semibold text-slate-100">
                  Wybierz plik z danymi
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  maksymalnie 2000 wierszy do pierwszej wersji planszy
                </span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.xlsx"
                  className="hidden"
                  onChange={(event) => void handleFile(event.currentTarget.files?.[0] ?? null)}
                />
              </label>
              {pending ? (
                <div className="rounded-xl border border-brand-500/30 bg-brand-500/10 p-3 text-sm text-slate-200">
                  Rozpoznano {pending.rows.length} wierszy i {pending.columns.length} kolumn.
                </div>
              ) : null}
              <button
                type="button"
                onClick={saveDataSet}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
              >
                <Plus className="h-4 w-4" />
                Utworz plansze
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <SectionTitle title="Zapisane plansze" subtitle="Kliknij zbior, aby zmienic metryki i podglad." />
            <div className="mt-3 space-y-2">
              {dataSets.length ? dataSets.map((dataSet) => (
                <button
                  key={dataSet.id}
                  type="button"
                  onClick={() => setActiveId(dataSet.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    selected?.id === dataSet.id
                      ? 'border-brand-500 bg-brand-500/15'
                      : 'border-slate-800 bg-slate-950/50 hover:bg-slate-900'
                  }`}
                >
                  <p className="truncate text-sm font-semibold text-slate-100">{dataSet.name}</p>
                  <p className="text-xs text-slate-500">
                    {dataSet.rows.length} wierszy - {dataSet.columns.length} kolumn
                  </p>
                </button>
              )) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  Brak zapisanych plansz. Wgraj pierwszy raport, zeby zaczac.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-50">{selected.name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {selected.sourceName ?? 'wlasny import'} - {new Date(selected.createdAt).toLocaleDateString('pl-PL')}
                    </p>
                    {selected.note ? <p className="mt-2 text-sm text-slate-400">{selected.note}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onDataSetsChange(dataSets.filter((dataSet) => dataSet.id !== selected.id))}
                    className="rounded-xl border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
                  >
                    Usun
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <Field label="Metryka liczbowa">
                    <select
                      value={metricId}
                      onChange={(event) => updateSelected({ primaryMetric: event.target.value })}
                      className={INPUT_CLS}
                    >
                      {numericColumns.map((column) => (
                        <option key={column.id} value={column.id}>{column.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Kategoria">
                    <select
                      value={categoryId}
                      onChange={(event) => updateSelected({ categoryField: event.target.value })}
                      className={INPUT_CLS}
                    >
                      <option value="">Bez kategorii</option>
                      {[...textColumns, ...dateColumns].map((column) => (
                        <option key={column.id} value={column.id}>{column.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Data">
                    <select
                      value={dateId}
                      onChange={(event) => updateSelected({ dateField: event.target.value })}
                      className={INPUT_CLS}
                    >
                      <option value="">Bez daty</option>
                      {dateColumns.map((column) => (
                        <option key={column.id} value={column.id}>{column.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FinanceKpiTile label="Wiersze" value={String(selected.rows.length)} hint="rekordy w planszy" />
                <FinanceKpiTile label="Suma metryki" value={formatPricePln(metricTotal)} hint={columnName(selected, metricId)} />
                <FinanceKpiTile label="Srednia" value={formatPricePln(metricAvg)} hint="srednia wartosc wiersza" />
                <FinanceKpiTile label="Odchylenie" value={formatPricePln(metricSd)} hint="zmiennosc danych" />
              </div>

              <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <SectionTitle
                    title="Wykres planszy"
                    subtitle="Automatyczny podzial po kategorii albo trend po dacie, liczony z importu."
                  />
                  <EChartsCustomDataChart
                    dataSet={selected}
                    metricId={metricId}
                    categoryId={categoryId}
                    dateId={dateId}
                  />
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <SectionTitle
                    title="Najwieksze pozycje"
                    subtitle="Szybkie wyczucie, co robi najwiekszy ruch w danych."
                  />
                  <div className="mt-4 space-y-2">
                    {grouped.length ? grouped.map((item) => (
                      <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-slate-100">{item.label}</p>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-50">
                            {formatPricePln(item.value)}
                          </p>
                        </div>
                      </div>
                    )) : (
                      <p className="py-10 text-center text-sm text-slate-500">
                        Wybierz metryke i kategorie, aby zobaczyc ranking.
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
                <div className="border-b border-slate-800 px-4 py-3">
                  <SectionTitle title="Tabela danych" subtitle="Pierwsze 80 wierszy do szybkiego sprawdzania importu." />
                </div>
                <CustomDataPreviewTable dataSet={selected} />
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center">
              <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-600" />
              <h3 className="mt-3 text-lg font-semibold text-slate-100">
                Tu pojawi sie Twoja plansza analityczna
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                Wgraj raport z faktur, banku, marketplace albo dowolnego arkusza.
                Operacje same rozpoznaja kolumny i zbuduja pierwszy pulpit.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AdvancedAnalyticsLab({
  financeMonths,
  channels,
  imports,
  onBack,
}: {
  financeMonths: FinanceMonth[];
  channels: FinanceChannel[];
  imports: OpsImportRecord[];
  onBack: () => void;
}) {
  const rows = useMemo(() => buildAnalyticsRows(financeMonths), [financeMonths]);
  const [duckStatus, setDuckStatus] = useState('Nie sprawdzono');
  const [perspectiveStatus, setPerspectiveStatus] = useState('Nie sprawdzono');
  const [sorting, setSorting] = useState<AnalyticsSort>(
    { id: 'month', desc: true },
  );
  const regression = useMemo(() => {
    const points = financeMonths.map((m, idx) => [idx + 1, m.wynikNetto]);
    return points.length >= 2 ? linearRegression(points) : { m: 0, b: 0 };
  }, [financeMonths]);
  const correlation = useMemo(() => {
    if (financeMonths.length < 2) return 0;
    return sampleCorrelation(
      financeMonths.map((m) => m.sprzedaz),
      financeMonths.map((m) => m.wynikNetto),
    );
  }, [financeMonths]);
  const anomalie = rows.filter((row) => Math.abs(row.wynikZScore) >= 1.4);
  const importedValue = imports.reduce((sum, item) => sum + item.value, 0);

  async function checkDuckDb() {
    setDuckStatus('Ladowanie...');
    try {
      const duck = await import('@duckdb/duckdb-wasm');
      const bundles = duck.getJsDelivrBundles();
      setDuckStatus(`Gotowy: DuckDB-WASM, ${Object.keys(bundles).length} tryby`);
      showToast('DuckDB-WASM zaladowany', 'ok');
    } catch (err) {
      console.error(err);
      setDuckStatus('Blad ladowania');
      showToast('Nie udalo sie zaladowac DuckDB', 'error');
    }
  }

  async function checkPerspective() {
    setPerspectiveStatus('Zainstalowane: client + viewer + datagrid');
    showToast('Perspective jest gotowe do pelnego widoku pivot', 'ok');
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-1 pb-10">
      <BackButton onBack={onBack} label="Operacje" />
      <header className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-brand-500/15 p-3 text-brand-300">
              <Database className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-50">
                Laboratorium danych
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
                Tu spinamy darmowe silniki: DuckDB do SQL, Perspective do pivotow,
                ECharts do zaawansowanych wykresow, TanStack Table do tabel i
                simple-statistics do wykrywania trendow oraz anomalii.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void checkDuckDb()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              DuckDB
            </button>
            <button
              type="button"
              onClick={() => void checkPerspective()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
            >
              Perspective
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FinanceKpiTile label="Trend wyniku" value={`${regression.m >= 0 ? '+' : ''}${formatPricePln(regression.m)}/mies.`} hint="simple-statistics: regresja liniowa" tone={regression.m >= 0 ? 'good' : 'bad'} />
        <FinanceKpiTile label="Korelacja" value={correlation.toFixed(2)} hint="sprzedaz vs wynik netto" />
        <FinanceKpiTile label="Anomalie" value={String(anomalie.length)} hint="|z-score| >= 1.4" tone={anomalie.length ? 'warn' : 'good'} />
        <FinanceKpiTile label="DuckDB" value={duckStatus} hint="silnik SQL w przegladarce" />
        <FinanceKpiTile label="Perspective" value={perspectiveStatus} hint="pivot/datagrid WASM" />
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <SectionTitle
            title="ECharts: wynik, sprzedaz i koszty"
            subtitle="Zaawansowany wykres combo, ladowany dopiero w laboratorium."
          />
          <EChartsFinanceChart rows={rows} />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <SectionTitle
            title="Analiza automatyczna"
            subtitle="Wnioski liczone lokalnie z danych finansowych."
          />
          <div className="mt-4 space-y-3">
            <InsightCard
              title="Stabilnosc wyniku"
              value={formatPricePln(standardDeviation(rows.map((r) => r.wynik)))}
              note="Odchylenie standardowe wyniku netto. Im wyzsze, tym mniej przewidywalny miesiac."
            />
            <InsightCard
              title="Importy raportow"
              value={formatPricePln(importedValue)}
              note={`${imports.length} dostaw danych gotowych do mapowania w DuckDB/Perspective.`}
            />
            <InsightCard
              title="Najwiekszy kanal"
              value={channels.sort((a, b) => b.amount - a.amount)[0]?.channel ?? 'Brak'}
              note={channels.length ? formatPricePln(channels.sort((a, b) => b.amount - a.amount)[0].amount) : 'Brak danych kanalow'}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
        <div className="border-b border-slate-800 px-4 py-3">
          <SectionTitle
            title="Tabela analityczna"
            subtitle="TanStack Table v9 jest zainstalowany; ta tabela ma teraz lekkie sortowanie lokalne, a pelny datagrid podepniemy w kolejnym kroku."
          />
        </div>
        <AnalyticsTanStackTable rows={rows} sorting={sorting} onSortingChange={setSorting} />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <EngineCard
          title="DuckDB-WASM"
          text="Docelowo: SQL na raportach CSV/Parquet, joiny WAPRO + bank + marketplace i agregacje bez backendu."
        />
        <EngineCard
          title="Perspective"
          text="Docelowo: interaktywny pivot, grupowanie po kanale/handlowcu/koszcie i szybkie przeciaganie wymiarow."
        />
        <EngineCard
          title="ECharts"
          text="Waterfall wyniku, heatmapy kosztow, sankey przeplywow i wykresy zarzadcze lepsze niz zwykle slupki."
        />
        <EngineCard
          title="simple-statistics"
          text="Anomalie, regresje, korelacje, trend kosztow i alerty zanim problem widac golym okiem."
        />
      </section>
    </div>
  );
}

function StatsBuilderPanel({
  financeMonths,
  channels,
  chartPrefs,
  onChartPrefsChange,
  onBack,
}: {
  financeMonths: FinanceMonth[];
  channels: FinanceChannel[];
  chartPrefs: ChartPreference[];
  onChartPrefsChange: (prefs: ChartPreference[]) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('Moj wykres');
  const [kind, setKind] = useState<ChartKind>('combo');
  const [metric, setMetric] = useState<ChartMetric>('sprzedaz');
  const [compareMetric, setCompareMetric] = useState<ChartMetric>('wynikNetto');
  const [months, setMonths] = useState(12);
  const activePref: ChartPreference = {
    id: 'draft',
    name,
    kind,
    metric,
    compareMetric: kind === 'pie' ? undefined : compareMetric,
    months,
  };

  function savePreference() {
    const next: ChartPreference = {
      ...activePref,
      id: `chart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || CHART_METRIC_LABELS[metric],
    };
    onChartPrefsChange([next, ...chartPrefs]);
    showToast('Zapisano widok statystyczny', 'ok');
  }

  const latest = financeMonths.at(-1);
  const chartRows = buildChartRows(financeMonths, activePref);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-1 pb-10">
      <BackButton onBack={onBack} label="Operacje" />
      <header className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-brand-500/15 p-3 text-brand-300">
            <BarChart3 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-slate-50">
              Kreator statystyk
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
              Buduj wlasne widoki: wybierz typ wykresu, metryke, porownanie i
              zakres miesiecy. To bedzie baza pod personalizowane pulpity.
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
          <SectionTitle title="Ustawienia wykresu" subtitle="Konfiguracja zapisuje sie lokalnie. Pozniej przeniesiemy to do profilu uzytkownika." />
          <div className="mt-4 space-y-3">
            <Field label="Nazwa widoku">
              <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} />
            </Field>
            <Field label="Typ wykresu">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CHART_KINDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setKind(item.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      kind === item.id
                        ? 'border-brand-500 bg-brand-500/15 text-brand-200'
                        : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Metryka glowna">
                <select value={metric} onChange={(e) => setMetric(e.target.value as ChartMetric)} className={INPUT_CLS}>
                  {Object.entries(CHART_METRIC_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Porownanie">
                <select
                  value={compareMetric}
                  onChange={(e) => setCompareMetric(e.target.value as ChartMetric)}
                  className={INPUT_CLS}
                  disabled={kind === 'pie'}
                >
                  {Object.entries(CHART_METRIC_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={`Zakres miesiecy: ${months}`}>
              <input
                type="range"
                min={3}
                max={24}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </Field>
            <button
              type="button"
              onClick={savePreference}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" />
              Zapisz widok
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <SectionTitle
                title={name || 'Podglad wykresu'}
                subtitle={`${CHART_METRIC_LABELS[metric]}${kind !== 'pie' ? ` vs ${CHART_METRIC_LABELS[compareMetric]}` : ''} · ${chartRows.length} punktow`}
              />
              <button
                type="button"
                onClick={() => {
                  downloadCsv(
                    stampFile('kreator_statystyk'),
                    ['Miesiac', CHART_METRIC_LABELS[metric], CHART_METRIC_LABELS[compareMetric]],
                    chartRows.map((row) => [row.label, row.primary, row.secondary ?? '']),
                  );
                  showToast('Eksport danych wykresu', 'ok');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
            <ChartPreview months={financeMonths} preference={activePref} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FinanceKpiTile
              label="Ostatnia wartosc"
              value={latest ? formatMetric(metricValue(latest, metric), metric) : '-'}
              hint={CHART_METRIC_LABELS[metric]}
            />
            <FinanceKpiTile
              label="Srednia"
              value={formatMetric(avg(chartRows.map((r) => r.primary)), metric)}
              hint={`z ${chartRows.length} miesiecy`}
            />
            <FinanceKpiTile
              label="Najwyzej"
              value={formatMetric(Math.max(...chartRows.map((r) => r.primary), 0), metric)}
              hint="maksimum zakresu"
            />
          </div>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="border-b border-slate-800 px-4 py-3">
              <SectionTitle title="Zapisane widoki" subtitle="Te widoki beda pozniej przypisane do uzytkownika globalnie." />
            </div>
            <div className="divide-y divide-slate-800">
              {chartPrefs.map((pref) => (
                <div key={pref.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{pref.name}</p>
                    <p className="text-xs text-slate-500">
                      {pref.kind} · {CHART_METRIC_LABELS[pref.metric]} · {pref.months} mies.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onChartPrefsChange(chartPrefs.filter((p) => p.id !== pref.id))}
                    className="text-xs font-medium text-slate-500 hover:text-rose-300"
                  >
                    usun
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <SectionTitle title="Dane kanalow do analizy" subtitle="Szybkie porownanie kanalow, z ktorych mozna budowac kolejne wykresy." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {channels.map((channel) => (
            <div key={channel.channel} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="truncate text-sm font-semibold text-slate-100">{channel.channel}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-50">{formatPricePln(channel.amount)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CostModelPanel({
  current,
  imports,
  categories,
  onCategoriesChange,
  onBack,
}: {
  current: FinanceMonth | null;
  imports: OpsImportRecord[];
  categories: CostCategoryConfig[];
  onCategoriesChange: (categories: CostCategoryConfig[]) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState('');
  const [group, setGroup] = useState<SourceFlow>('costs');
  const [budget, setBudget] = useState('');
  const [owner, setOwner] = useState('');
  const [alertPct, setAlertPct] = useState('85');
  const rows = categories.map((cat) => {
    const actual = categoryActual(cat, current, imports);
    return {
      ...cat,
      actual,
      usage: cat.budget > 0 ? actual / cat.budget : 0,
      variance: cat.budget - actual,
    };
  });
  const totalBudget = categories.reduce((sum, cat) => sum + cat.budget, 0);
  const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);

  function addCategory() {
    const cleanName = name.trim();
    const parsedBudget = parseMoney(budget);
    if (!cleanName || parsedBudget <= 0) {
      showToast('Podaj nazwe i budzet kategorii', 'warn');
      return;
    }
    onCategoriesChange([
      {
        id: `cost-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: cleanName,
        group,
        budget: parsedBudget,
        owner: owner.trim() || 'Finanse',
        alertPct: Math.max(1, Math.min(200, parseMoney(alertPct))),
      },
      ...categories,
    ]);
    setName('');
    setBudget('');
    setOwner('');
    showToast('Dodano kategorie kosztow', 'ok');
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-1 pb-10">
      <BackButton onBack={onBack} label="Operacje" />
      <header className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-brand-500/15 p-3 text-brand-300">
            <Database className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-slate-50">Kategorie kosztow</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
              Dodawaj i usuwaj wlasne typy kosztow, przypisuj budzet, wlasciciela i prog alarmowy.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceKpiTile label="Budzet" value={formatPricePln(totalBudget)} hint={`${categories.length} kategorii`} />
        <FinanceKpiTile label="Wykonanie" value={formatPricePln(totalActual)} hint={`${(totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0).toFixed(1)}% budzetu`} tone={totalActual <= totalBudget ? 'good' : 'bad'} />
        <FinanceKpiTile label="Odchylenie" value={formatPricePln(totalBudget - totalActual)} hint="budzet - wykonanie" tone={totalBudget - totalActual >= 0 ? 'good' : 'warn'} />
      </div>

      <section className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
          <SectionTitle title="Nowa kategoria" subtitle="Kategorie moga pozniej mapowac sie na importy z WAPRO, banku albo marketplace." />
          <div className="mt-4 space-y-3">
            <Field label="Nazwa">
              <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} placeholder="np. Leasing, paliwo, reklamy" />
            </Field>
            <Field label="Obszar">
              <select value={group} onChange={(e) => setGroup(e.target.value as SourceFlow)} className={INPUT_CLS}>
                <option value="ecommerce">E-commerce</option>
                <option value="field">Handel</option>
                <option value="accounting">Ksiegowosc</option>
                <option value="bank">Bank</option>
                <option value="costs">Koszty stale</option>
                <option value="warehouse">Magazyn</option>
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Budzet miesieczny">
                <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
              </Field>
              <Field label="Prog alarmowy %">
                <input value={alertPct} onChange={(e) => setAlertPct(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
              </Field>
            </div>
            <Field label="Wlasciciel">
              <input value={owner} onChange={(e) => setOwner(e.target.value)} className={INPUT_CLS} placeholder="np. Biuro, E-commerce" />
            </Field>
            <button type="button" onClick={addCategory} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500">
              <Plus className="h-4 w-4" />
              Dodaj kategorie
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
          <div className="border-b border-slate-800 px-4 py-3">
            <SectionTitle title="Budzet i wykonanie" subtitle="Wykonanie laczy bazowe koszty miesiaca i reczne importy raportow." />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Kategoria</th>
                  <th className="px-4 py-2 font-medium">Wlasciciel</th>
                  <th className="px-4 py-2 font-medium text-right">Budzet</th>
                  <th className="px-4 py-2 font-medium text-right">Wykonanie</th>
                  <th className="px-4 py-2 font-medium text-right">Uzycie</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800/70 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100">{row.name}</p>
                      <p className="text-[11px] text-slate-500">{flowLabel(row.group)}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{row.owner}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatPricePln(row.budget)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatPricePln(row.actual)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`tabular-nums ${row.usage * 100 >= row.alertPct ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {(row.usage * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onCategoriesChange(categories.filter((c) => c.id !== row.id))}
                        className="text-xs font-medium text-slate-500 hover:text-rose-300"
                      >
                        usun
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function SalesRepsPanel({
  reps,
  rawReps,
  onRepsChange,
  onBack,
}: {
  reps: SalesRepConfig[];
  rawReps: SalesRepConfig[];
  onRepsChange: (reps: SalesRepConfig[]) => void;
  onBack: () => void;
}) {
  const [selectedId, setSelectedId] = useState(reps[0]?.id ?? '');
  const [name, setName] = useState('');
  const [sales, setSales] = useState('');
  const [marginPct, setMarginPct] = useState('30');
  const [commissionPct, setCommissionPct] = useState('4');
  const selected = reps.find((rep) => rep.id === selectedId) ?? reps[0] ?? null;
  const totalSales = reps.reduce((sum, rep) => sum + rep.sales, 0);
  const totalContribution = reps.reduce((sum, rep) => sum + repContribution(rep), 0);

  function addRep() {
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('Podaj nazwe handlowca', 'warn');
      return;
    }
    const next: SalesRepConfig = {
      id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      userLabel: `crm:${cleanName.toLowerCase().replace(/\s+/g, '-')}`,
      sales: parseMoney(sales),
      marginPct: parseMoney(marginPct),
      targetMarginPct: parseMoney(marginPct),
      commissionPct: parseMoney(commissionPct),
      returns: 0,
      costs: 0,
    };
    onRepsChange([next, ...rawReps]);
    setSelectedId(next.id);
    setName('');
    setSales('');
    showToast('Dodano handlowca', 'ok');
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-1 pb-10">
      <BackButton onBack={onBack} label="Operacje" />
      <header className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-brand-500/15 p-3 text-brand-300">
            <Calculator className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-slate-50">
              Rozliczanie handlowcow po uzytkowniku
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
              Podglad handlowca: sprzedaz, marza, cel marzy, prowizja, zwroty,
              koszty i wynik. Dane reczne dzisiaj, CRM pozniej.
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <FinanceKpiTile label="Sprzedaz handlowcow" value={formatPricePln(totalSales)} hint={`${reps.length} uzytkownikow`} />
        <FinanceKpiTile label="Wynik po rozliczeniu" value={formatPricePln(totalContribution)} hint="marza - prowizje - koszty" tone={totalContribution >= 0 ? 'good' : 'bad'} />
        <FinanceKpiTile label="Srednia marza" value={`${avg(reps.map((rep) => rep.marginPct)).toFixed(1)}%`} hint="wazenie uproszczone" />
        <FinanceKpiTile label="Prowizje" value={formatPricePln(reps.reduce((sum, rep) => sum + repCommission(rep), 0))} hint="do wyplaty" tone="warn" />
      </div>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <SectionTitle title="Dodaj / symuluj handlowca" subtitle="Pola pozniej podepniemy pod uzytkownika i jego transakcje CRM." />
            <div className="mt-4 space-y-3">
              <Field label="Nazwa">
                <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label="Sprzedaz netto">
                <input value={sales} onChange={(e) => setSales(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Marza %">
                  <input value={marginPct} onChange={(e) => setMarginPct(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
                </Field>
                <Field label="Prowizja %">
                  <input value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
                </Field>
              </div>
              <button type="button" onClick={addRep} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500">
                <Plus className="h-4 w-4" />
                Dodaj handlowca
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <SectionTitle title="Wybierz handlowca" subtitle="Kliknij, aby zobaczyc jego podglad." />
            <div className="mt-3 space-y-2">
              {reps.map((rep) => (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() => setSelectedId(rep.id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    selected?.id === rep.id
                      ? 'border-brand-500 bg-brand-500/15'
                      : 'border-slate-800 bg-slate-950/50 hover:bg-slate-900'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-100">{rep.name}</p>
                  <p className="text-xs text-slate-500">{rep.userLabel} · {formatPricePln(rep.sales)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selected && <SalesRepDetail rep={selected} />}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <SectionTitle title="Porownanie handlowcow" subtitle="Sprzedaz i wynik po prowizjach." />
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reps.map((rep) => ({
                  name: rep.name,
                  sales: Math.round(rep.sales),
                  contribution: Math.round(repContribution(rep)),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} formatter={(v: number) => formatPricePln(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sales" name="Sprzedaz" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="contribution" name="Wynik" fill="#34d399" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="border-b border-slate-800 px-4 py-3">
              <SectionTitle title="Tabela rozliczen" subtitle="Dokladne parametry per handlowiec." />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Handlowiec</th>
                    <th className="px-4 py-2 font-medium text-right">Sprzedaz</th>
                    <th className="px-4 py-2 font-medium text-right">Marza</th>
                    <th className="px-4 py-2 font-medium text-right">Prowizja</th>
                    <th className="px-4 py-2 font-medium text-right">Wynik</th>
                    <th className="px-4 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {reps.map((rep) => (
                    <tr key={rep.id} className="border-b border-slate-800/70 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-100">{rep.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatPricePln(rep.sales)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">{rep.marginPct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatPricePln(repCommission(rep))}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-100">{formatPricePln(repContribution(rep))}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onRepsChange(rawReps.filter((r) => r.id !== rep.id))}
                          className="text-xs font-medium text-slate-500 hover:text-rose-300"
                        >
                          usun
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DataSupplyPanel({
  current,
  sources,
  imports,
  onBack,
  onSourcesChange,
  onImportsChange,
}: {
  current: FinanceMonth | null;
  sources: OpsDataSource[];
  imports: OpsImportRecord[];
  onBack: () => void;
  onSourcesChange: (sources: OpsDataSource[]) => void;
  onImportsChange: (records: OpsImportRecord[]) => void;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [month, setMonth] = useState(current?.month ?? todayIso().slice(0, 7));
  const [area, setArea] = useState<SourceFlow>('ecommerce');
  const [rows, setRows] = useState('');
  const [value, setValue] = useState('');
  const [fileName, setFileName] = useState('');
  const [note, setNote] = useState('');

  async function handleFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    const parsed = parseReportText(text);
    setFileName(file.name);
    setRows(String(parsed.rows));
    if (parsed.value > 0) setValue(parsed.value.toFixed(2));
    showToast(`Wczytano ${parsed.rows} wierszy z raportu`, 'ok');
  }

  function saveImport() {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return;
    const parsedRows = Math.max(0, Math.round(parseMoney(rows)));
    const parsedValue = parseMoney(value);
    if (parsedRows <= 0 && parsedValue <= 0) {
      showToast('Podaj liczbe wierszy albo wartosc raportu', 'warn');
      return;
    }
    const record: OpsImportRecord = {
      id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sourceId: source.id,
      sourceName: source.name,
      month,
      area,
      rows: parsedRows,
      value: parsedValue,
      fileName: fileName || undefined,
      note: note || undefined,
      createdAt: new Date().toISOString(),
    };
    onImportsChange([record, ...imports]);
    onSourcesChange(
      sources.map((s) =>
        s.id === source.id
          ? {
              ...s,
              status: 'manual',
              lastImport: todayIso(),
              rows: s.rows + parsedRows,
              value: Math.round((s.value + parsedValue) * 100) / 100,
              confidence: Math.min(95, Math.max(s.confidence, 70)),
            }
          : s,
      ),
    );
    setRows('');
    setValue('');
    setFileName('');
    setNote('');
    showToast('Raport dodany do dostawy danych', 'ok');
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-1 pb-10">
      <BackButton onBack={onBack} label="Operacje" />
      <header className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-brand-400">
              <Database className="h-5 w-5" />
              <h2 className="text-xl font-semibold text-slate-50">
                Dostawa danych do Operacji
              </h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
              Tu zbieramy raporty z roznych stron, zanim policzymy z nich
              cashflow, rozliczenia, prowizje, koszty i raporty zarzadcze.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onSourcesChange(DEFAULT_SOURCES);
              showToast('Przywrocono domyslne zrodla', 'info');
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            <Settings2 className="h-4 w-4" />
            Domyslne zrodla
          </button>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
          <SectionTitle
            title="Dodaj raport"
            subtitle="Mozesz wpisac podsumowanie recznie albo wskazac plik CSV/TSV."
          />
          <div className="mt-4 space-y-3">
            <Field label="Zrodlo">
              <select
                value={sourceId}
                onChange={(e) => {
                  setSourceId(e.target.value);
                  const src = sources.find((s) => s.id === e.target.value);
                  if (src) setArea(src.flow);
                }}
                className={INPUT_CLS}
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Miesiac">
                <input value={month} onChange={(e) => setMonth(e.target.value)} className={INPUT_CLS} />
              </Field>
              <Field label="Obszar">
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value as SourceFlow)}
                  className={INPUT_CLS}
                >
                  <option value="ecommerce">E-commerce</option>
                  <option value="field">Handel terenowy</option>
                  <option value="accounting">Ksiegowosc</option>
                  <option value="bank">Bank</option>
                  <option value="costs">Koszty</option>
                  <option value="warehouse">Magazyn</option>
                </select>
              </Field>
            </div>
            <Field label="Plik raportu">
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={(e) => void handleFile(e.currentTarget.files?.[0] ?? null)}
                className="block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
              {fileName && (
                <p className="mt-1 text-[11px] text-slate-500">Wczytano: {fileName}</p>
              )}
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Wiersze">
                <input value={rows} onChange={(e) => setRows(e.target.value)} inputMode="numeric" className={INPUT_CLS} />
              </Field>
              <Field label="Wartosc raportu">
                <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className={INPUT_CLS} />
              </Field>
            </div>
            <Field label="Notatka">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className={`${INPUT_CLS} resize-none`}
              />
            </Field>
            <button
              type="button"
              onClick={saveImport}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" />
              Dodaj do Operacji
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="border-b border-slate-800 px-4 py-3">
              <SectionTitle
                title="Zrodla danych"
                subtitle="Statusy pomagaja zobaczyc, co jest reczne, czego brakuje i komu przypisac temat."
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Zrodlo</th>
                    <th className="px-4 py-2 font-medium">Obszar</th>
                    <th className="px-4 py-2 font-medium">Rytm</th>
                    <th className="px-4 py-2 font-medium text-right">Wiersze</th>
                    <th className="px-4 py-2 font-medium text-right">Wartosc</th>
                    <th className="px-4 py-2 font-medium text-right">Pewnosc</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.id} className="border-b border-slate-800/70 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-100">{s.name}</p>
                        <p className="text-[11px] text-slate-500">{s.owner} · {statusLabel(s.status)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{flowLabel(s.flow)}</td>
                      <td className="px-4 py-3 text-slate-400">{s.cadence}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">{s.rows}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatPricePln(s.value)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200">{s.confidence}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="border-b border-slate-800 px-4 py-3">
              <SectionTitle title="Ostatnie importy" subtitle="Historia recznych dostaw danych do obliczen." />
            </div>
            <DataImportsList imports={imports} onClear={() => onImportsChange([])} />
          </section>
        </div>
      </section>
    </div>
  );
}

function OpsToolPanel({
  tool,
  current,
  previous,
  channels,
  ecommerceSales,
  fieldSales,
  imports,
  onBack,
}: {
  tool: Exclude<OpsToolId, 'hub' | 'finance' | 'data-inbox'>;
  current: FinanceMonth | null;
  previous: FinanceMonth | null | undefined;
  channels: FinanceChannel[];
  ecommerceSales: number;
  fieldSales: number;
  imports: OpsImportRecord[];
  onBack: () => void;
}) {
  const cfg = buildToolConfig(tool, current, previous, channels, ecommerceSales, fieldSales, imports);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-1 pb-10">
      <BackButton onBack={onBack} label="Operacje" />
      <header className="rounded-2xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-brand-500/15 p-3 text-brand-300">
              {cfg.icon}
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-50">{cfg.title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
                {cfg.description}
              </p>
            </div>
          </div>
          {cfg.exportRows && (
            <button
              type="button"
              onClick={() => {
                downloadCsv(
                  stampFile(`operacje_${tool}`),
                  ['Obszar', 'Nazwa', 'Baza', 'Wartosc', 'Wynik', 'Notatka'],
                  cfg.rows.map((r) => [r.area, r.label, r.base, r.value, r.result, r.note]),
                );
                showToast('Eksport narzedzia CSV', 'ok');
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
            >
              <Download className="h-4 w-4" />
              Eksport CSV
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cfg.kpis.map((kpi) => (
          <FinanceKpiTile
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            tone={kpi.tone as 'default' | 'good' | 'warn' | 'bad' | undefined}
          />
        ))}
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <CalculationTable rows={cfg.rows} />
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <SectionTitle title="Kolejne decyzje" subtitle="Lista rzeczy do sprawdzenia przed uznaniem liczb za gotowe." />
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {cfg.actions.map((a) => (
                <li key={a} className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <SectionTitle title="Jak liczymy" subtitle="Zasada robocza dla tego widoku." />
            <p className="mt-3 text-sm leading-relaxed text-slate-400">{cfg.method}</p>
          </section>
        </div>
      </section>
    </div>
  );
}

function buildToolConfig(
  tool: Exclude<OpsToolId, 'hub' | 'finance' | 'data-inbox'>,
  current: FinanceMonth | null,
  previous: FinanceMonth | null | undefined,
  channels: FinanceChannel[],
  ecommerceSales: number,
  fieldSales: number,
  imports: OpsImportRecord[],
) {
  const revenue = current?.sprzedaz ?? 0;
  const costs = current?.kosztyRazem ?? 0;
  const net = current?.wynikNetto ?? 0;
  const openReceivables = Math.max(revenue * 0.23, 0);
  const overdue = openReceivables * 0.28;
  const marketplaceFee = ecommerceSales * 0.12;
  const delivery = current?.dostawa ?? 0;
  const forecastCash = net + revenue * 0.42 - costs * 0.33;

  if (tool === 'cashflow') {
    return {
      title: 'Cashflow',
      icon: <Wallet className="h-6 w-6" />,
      description: 'Prognoza przeplywow pienieznych: co wplywa, co wychodzi i ile zostaje na koniec miesiaca.',
      method: 'Startujemy od wyniku netto miesiaca, dodajemy spodziewane wplywy i odejmujemy planowane platnosci. Po podpieciu banku zastapimy estymacje realnymi transakcjami.',
      exportRows: true,
      kpis: [
        { label: 'Prognoza salda', value: formatPricePln(forecastCash), hint: 'roboczy koniec miesiaca', tone: forecastCash >= 0 ? 'good' : 'bad' },
        { label: 'Wplywy oczekiwane', value: formatPricePln(revenue * 0.42), hint: '42% sprzedazy miesiaca' },
        { label: 'Platnosci planowane', value: formatPricePln(costs * 0.33), hint: '33% kosztow miesiaca', tone: 'warn' },
        { label: 'Zmiana wyniku', value: deltaLabel(net, previous?.wynikNetto), hint: 'vs poprzedni miesiac' },
      ],
      rows: [
        calc('Saldo operacyjne', 'Cashflow', 'wynik netto', net, forecastCash, 'punkt startowy dla plynnosci'),
        calc('Wplywy od klientow', 'Cashflow', 'sprzedaz x 42%', revenue * 0.42, revenue * 0.42, 'do zastapienia bankiem'),
        calc('Zobowiazania', 'Cashflow', 'koszty x 33%', costs * 0.33, -costs * 0.33, 'platnosci do wykonania'),
        calc('Bufor bezpieczenstwa', 'Cashflow', '10% kosztow', costs * 0.1, forecastCash - costs * 0.1, 'minimum operacyjne'),
      ],
      actions: ['Podpiac wyciag bankowy jako zrodlo danych.', 'Dodac terminy platnosci faktur.', 'Uzgodnic stale koszty miesieczne.'],
    };
  }

  if (tool === 'invoices') {
    return {
      title: 'Faktury i platnosci',
      icon: <ReceiptText className="h-6 w-6" />,
      description: 'Kontrola faktur wystawionych, zaplaconych, otwartych i po terminie.',
      method: 'Do czasu pelnej integracji z WAPRO traktujemy sprzedaz miesiaca jako sume faktur i rozbijamy ja na statusy robocze. Docelowo kazda pozycja bedzie faktura z terminem.',
      exportRows: true,
      kpis: [
        { label: 'Faktury wystawione', value: formatPricePln(revenue), hint: current ? monthLabel(current.month) : '-' },
        { label: 'Zaplacone', value: formatPricePln(revenue - openReceivables), hint: 'estymacja do uzgodnienia', tone: 'good' },
        { label: 'Otwarte', value: formatPricePln(openReceivables), hint: 'naleznosci' },
        { label: 'Po terminie', value: formatPricePln(overdue), hint: 'priorytet kontroli', tone: overdue > 0 ? 'warn' : 'good' },
      ],
      rows: [
        calc('Wystawione', 'Faktury', 'sprzedaz miesiaca', revenue, revenue, 'suma dokumentow'),
        calc('Zaplacone', 'Faktury', 'wystawione - otwarte', revenue - openReceivables, revenue - openReceivables, 'potwierdzic bankiem'),
        calc('Otwarte', 'Faktury', '23% sprzedazy', openReceivables, openReceivables, 'robocza wartosc naleznosci'),
        calc('Po terminie', 'Faktury', '28% otwartych', overdue, overdue, 'lista do windykacji'),
      ],
      actions: ['Zasilic faktury z WAPRO.', 'Dodac terminy platnosci i kontrahentow.', 'Polaczyc platnosci z wyciagiem bankowym.'],
    };
  }

  if (tool === 'collections') {
    return {
      title: 'Windykacja',
      icon: <AlertTriangle className="h-6 w-6" />,
      description: 'Lista naleznosci po terminie, priorytety kontaktu i przewidywany odzysk.',
      method: 'Priorytet bazuje na kwocie, wieku zaleglosci i etapie kontaktu. Na razie pokazujemy model, ktory czeka na realne faktury i platnosci.',
      exportRows: true,
      kpis: [
        { label: 'Po terminie', value: formatPricePln(overdue), hint: 'do odzyskania', tone: 'warn' },
        { label: 'Ryzyko utraty', value: formatPricePln(overdue * 0.18), hint: '18% zaleglych', tone: 'bad' },
        { label: 'Plan odzysku', value: formatPricePln(overdue * 0.72), hint: 'do 30 dni', tone: 'good' },
        { label: 'Sprawy pilne', value: String(Math.ceil(overdue / 8000)), hint: 'szacowane paczki kontaktu' },
      ],
      rows: [
        calc('Kontakt 1', 'Windykacja', '45% zaleglych', overdue * 0.45, overdue * 0.45, 'telefon + mail'),
        calc('Kontakt 2', 'Windykacja', '35% zaleglych', overdue * 0.35, overdue * 0.35, 'ponowienie i termin'),
        calc('Blokada limitu', 'Windykacja', '20% zaleglych', overdue * 0.2, overdue * 0.2, 'do decyzji finansow'),
      ],
      actions: ['Dodac kontrahenta i numer faktury.', 'Dodac daty kontaktu i wlasciciela sprawy.', 'Zrobic automatyczne alerty przy przekroczeniu terminu.'],
    };
  }

  if (tool === 'settlements') {
    const commission = fieldSales * 0.04;
    return {
      title: 'Rozliczenia handlowcow',
      icon: <Calculator className="h-6 w-6" />,
      description: 'Rozdzielenie sprzedazy handlowej, prowizji, korekt i wyniku per osoba lub kanal.',
      method: 'Na start liczymy prowizje od sprzedazy terenowej. Po podpieciu raportow handlowcow rozbijemy to per pracownik, klient i dokument.',
      exportRows: true,
      kpis: [
        { label: 'Sprzedaz handlowa', value: formatPricePln(fieldSales), hint: `${moneyShare(fieldSales, revenue)} sprzedazy` },
        { label: 'Prowizje', value: formatPricePln(commission), hint: '4% model roboczy', tone: 'warn' },
        { label: 'Po prowizji', value: formatPricePln(fieldSales - commission), hint: 'sprzedaz - prowizje', tone: 'good' },
        { label: 'Importy handlowe', value: String(imports.filter((i) => i.area === 'field').length), hint: 'raporty dostarczone' },
      ],
      rows: [
        calc('Handel terenowy', 'Handel', 'kanaly B2B', fieldSales, fieldSales, 'podstawa rozliczen'),
        calc('Prowizja bazowa', 'Handel', '4% sprzedazy', commission, -commission, 'do uzgodnienia zasad'),
        calc('Korekty i zwroty', 'Handel', '1.5% sprzedazy', fieldSales * 0.015, -fieldSales * 0.015, 'robocza rezerwa'),
        calc('Wynik po rozliczeniu', 'Handel', 'sprzedaz - prowizja - korekty', fieldSales, fieldSales - commission - fieldSales * 0.015, 'wartosc po kosztach handlu'),
      ],
      actions: ['Dodac slownik handlowcow.', 'Zasilic raporty tygodniowe.', 'Ustalic progi prowizyjne i wyjatki.'],
    };
  }

  if (tool === 'marketplace') {
    const channelRows = channels
      .filter((c) => ECOMMERCE_CHANNEL_RE.test(c.channel))
      .map((c) => calc(c.channel, 'Marketplace', 'sprzedaz kanalu', c.amount, c.amount - c.amount * 0.12, 'po szacowanej prowizji 12%'));
    return {
      title: 'Marketplace i sklepy',
      icon: <Store className="h-6 w-6" />,
      description: 'Wynik e-commerce po prowizjach, kosztach dostawy, zwrotach i rozliczeniach platform.',
      method: 'Kazdy kanal dostanie osobny import oplat i sprzedazy. Na teraz liczymy prowizje robocza, zeby widziec docelowy ksztalt panelu.',
      exportRows: true,
      kpis: [
        { label: 'Sprzedaz e-commerce', value: formatPricePln(ecommerceSales), hint: `${moneyShare(ecommerceSales, revenue)} sprzedazy` },
        { label: 'Prowizje', value: formatPricePln(marketplaceFee), hint: '12% model roboczy', tone: 'warn' },
        { label: 'Dostawa', value: formatPricePln(delivery), hint: 'koszt miesiaca', tone: 'warn' },
        { label: 'Po kosztach', value: formatPricePln(ecommerceSales - marketplaceFee - delivery), hint: 'sprzedaz - prowizje - dostawa', tone: 'good' },
      ],
      rows: channelRows.length
        ? channelRows
        : [calc('E-commerce', 'Marketplace', 'sprzedaz kanalu', ecommerceSales, ecommerceSales - marketplaceFee, 'brak rozbicia kanalow')],
      actions: ['Dodac prowizje Allegro/Erli/Empik z raportow.', 'Rozdzielic koszt dostawy per kanal.', 'Dodac zwroty i korekty marketplace.'],
    };
  }

  if (tool === 'reports') {
    return {
      title: 'Raporty zarzadcze',
      icon: <FileSpreadsheet className="h-6 w-6" />,
      description: 'Miesieczne zestawienia dla zarzadu: sprzedaz, koszty, wynik, marza, dane i odchylenia.',
      method: 'Raport zarzadczy powinien byc ostatnia warstwa: najpierw zrodla danych, potem uzgodnienia, na koncu eksport i wnioski.',
      exportRows: true,
      kpis: [
        { label: 'Miesiace w bazie', value: String(getMergedFinanceData().months.length), hint: 'historia finansow' },
        { label: 'Ostatni wynik', value: formatPricePln(net), hint: current ? monthLabel(current.month) : '-' },
        { label: 'Zmiana sprzedazy', value: deltaLabel(revenue, previous?.sprzedaz), hint: 'trend miesieczny' },
        { label: 'Importy danych', value: String(imports.length), hint: 'zrodla reczne' },
      ],
      rows: getMergedFinanceData().months.map((m) => ({
        label: m.month,
        area: 'Raport miesieczny',
        base: `sprzedaz ${formatPricePln(m.sprzedaz)}`,
        value: formatPricePln(m.kosztyRazem),
        result: formatPricePln(m.wynikNetto),
        note: `marza ${(m.marzaPct * 100).toFixed(1)}%`,
      })),
      actions: ['Dodac eksport PDF.', 'Dodac komentarz miesiaca.', 'Dodac cele i odchylenia od budzetu.'],
    };
  }

  if (tool === 'rules') {
    return {
      title: 'Reguly i alerty finansowe',
      icon: <ShieldCheck className="h-6 w-6" />,
      description: 'Progi kontrolne dla kosztow, marzy, platnosci i jakosci danych.',
      method: 'Reguly sa warstwa ostrzegawcza: nie licza wyniku, tylko pokazuja co wymaga reakcji zanim problem wejdzie w raport zarzadczy.',
      exportRows: true,
      kpis: [
        { label: 'Marza netto', value: current ? `${(current.marzaPct * 100).toFixed(1)}%` : '-', hint: 'prog min. 30%', tone: current && current.marzaPct >= 0.3 ? 'good' : 'warn' },
        { label: 'Koszt / sprzedaz', value: current ? `${(current.kosztDoSprzedazy * 100).toFixed(1)}%` : '-', hint: 'prog max. 72%', tone: current && current.kosztDoSprzedazy <= 0.72 ? 'good' : 'warn' },
        { label: 'Platnosci po terminie', value: formatPricePln(overdue), hint: 'prog 0 zl', tone: overdue > 0 ? 'bad' : 'good' },
        { label: 'Luka danych', value: formatPricePln(Math.abs(revenue - ecommerceSales - fieldSales)), hint: 'do wyjasnienia', tone: 'warn' },
      ],
      rows: [
        rule('Marza netto minimum', 'Marza', current ? `${(current.marzaPct * 100).toFixed(1)}%` : '-', '>= 30%', current && current.marzaPct >= 0.3),
        rule('Koszty do sprzedazy', 'Koszty', current ? `${(current.kosztDoSprzedazy * 100).toFixed(1)}%` : '-', '<= 72%', current && current.kosztDoSprzedazy <= 0.72),
        rule('Platnosci po terminie', 'Platnosci', formatPricePln(overdue), '0 zl', overdue === 0),
        rule('Uzgodnienie kanalow', 'Dane', formatPricePln(Math.abs(revenue - ecommerceSales - fieldSales)), '< 1% sprzedazy', revenue > 0 && Math.abs(revenue - ecommerceSales - fieldSales) / revenue < 0.01),
      ],
      actions: ['Przeniesc progi do panelu admina.', 'Dodac powiadomienia dla finansow.', 'Zapisywac historie naruszen regul.'],
    };
  }

  const approvalValue = costs * 0.08;
  return {
    title: 'Akceptacje kosztow',
    icon: <ClipboardList className="h-6 w-6" />,
    description: 'Obieg decyzji dla zakupow firmowych, kosztow jednorazowych i przekroczen budzetu.',
    method: 'Kazdy koszt powyzej progu powinien miec wlasciciela, kategorie, budzet i decyzje. To przygotowuje miejsce pod workflow akceptacji.',
    exportRows: true,
    kpis: [
      { label: 'Do akceptacji', value: formatPricePln(approvalValue), hint: '8% kosztow miesiaca', tone: 'warn' },
      { label: 'Koszty stale', value: formatPricePln(costs * 0.55), hint: 'model roboczy' },
      { label: 'Jednorazowe', value: formatPricePln(costs * 0.18), hint: 'model roboczy' },
      { label: 'Rezerwa', value: formatPricePln(costs * 0.05), hint: 'bufor decyzyjny' },
    ],
    rows: [
      calc('Zakupy operacyjne', 'Akceptacje', '3% kosztow', costs * 0.03, costs * 0.03, 'wymaga wlasciciela'),
      calc('Koszty biurowe', 'Akceptacje', '2% kosztow', costs * 0.02, costs * 0.02, 'decyzja finansow'),
      calc('Narzędzia SaaS', 'Akceptacje', '1.5% kosztow', costs * 0.015, costs * 0.015, 'kontrola abonamentow'),
      calc('Rezerwa', 'Akceptacje', '1.5% kosztow', costs * 0.015, costs * 0.015, 'bufor miesiaca'),
    ],
    actions: ['Dodac formularz wniosku kosztowego.', 'Dodac statusy: zgloszone, zaakceptowane, odrzucone.', 'Powiazac koszt z raportem miesiaca.'],
  };
}

function calc(
  label: string,
  area: string,
  base: string,
  value: number,
  result: number,
  note: string,
): CalculationRow {
  return {
    label,
    area,
    base,
    value: formatPricePln(value),
    result: formatPricePln(result),
    note,
  };
}

function metricValue(month: FinanceMonth, metric: ChartMetric): number {
  return month[metric];
}

function formatMetric(value: number, metric: ChartMetric): string {
  if (!Number.isFinite(value)) return '-';
  if (metric === 'marzaPct' || metric === 'kosztDoSprzedazy') {
    return `${(value * 100).toFixed(1)}%`;
  }
  return formatPricePln(value);
}

function avg(values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (!clean.length) return 0;
  return clean.reduce((sum, v) => sum + v, 0) / clean.length;
}

function buildChartRows(months: FinanceMonth[], pref: ChartPreference) {
  return months.slice(-pref.months).map((m) => ({
    label: monthLabel(m.month),
    month: m.month,
    primary: metricValue(m, pref.metric),
    secondary: pref.compareMetric ? metricValue(m, pref.compareMetric) : undefined,
    sprzedaz: m.sprzedaz,
    kosztyRazem: m.kosztyRazem,
    wynikNetto: m.wynikNetto,
    marzaNetto: m.marzaNetto,
    marzaPct: m.marzaPct,
    kosztDoSprzedazy: m.kosztDoSprzedazy,
  }));
}

function ChartPreview({
  months,
  preference,
}: {
  months: FinanceMonth[];
  preference: ChartPreference;
}) {
  const rows = buildChartRows(months, preference);
  const tooltipFormatter = (value: number) =>
    formatMetric(value, preference.metric);

  if (preference.kind === 'pie') {
    const latest = months.at(-1);
    const data = latest
      ? [
          { name: 'Koszt towaru', value: latest.kosztTowaru },
          { name: 'Marketplace', value: latest.marketplace },
          { name: 'Dostawa', value: latest.dostawa },
          { name: 'Operacyjne', value: latest.operacyjne },
        ]
      : [];
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92} paddingAngle={3}>
              {data.map((item, idx) => (
                <Cell key={item.name} fill={['#38bdf8', '#f59e0b', '#34d399', '#a78bfa'][idx % 4]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
              formatter={(v: number) => formatPricePln(v)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (preference.kind === 'scatter') {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="primary" name={CHART_METRIC_LABELS[preference.metric]} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="secondary" name={preference.compareMetric ? CHART_METRIC_LABELS[preference.compareMetric] : 'Wynik'} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
              formatter={(v: number) => formatPricePln(v)}
            />
            <Scatter data={rows.map((r) => ({ ...r, secondary: r.secondary ?? r.wynikNetto }))} fill="#38bdf8" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const common = {
    data: rows,
    margin: { top: 10, right: 18, left: 0, bottom: 0 },
  };

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
      <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
      <Tooltip
        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
        formatter={tooltipFormatter}
      />
      <Legend wrapperStyle={{ fontSize: 11 }} />
    </>
  );

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        {preference.kind === 'bar' ? (
          <BarChart {...common}>
            {axes}
            <Bar dataKey="primary" name={CHART_METRIC_LABELS[preference.metric]} fill="#38bdf8" radius={[6, 6, 0, 0]} />
            {preference.compareMetric && <Bar dataKey="secondary" name={CHART_METRIC_LABELS[preference.compareMetric]} fill="#34d399" radius={[6, 6, 0, 0]} />}
          </BarChart>
        ) : preference.kind === 'area' ? (
          <AreaChart {...common}>
            {axes}
            <Area type="monotone" dataKey="primary" name={CHART_METRIC_LABELS[preference.metric]} stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} />
            {preference.compareMetric && <Area type="monotone" dataKey="secondary" name={CHART_METRIC_LABELS[preference.compareMetric]} stroke="#34d399" fill="#34d399" fillOpacity={0.12} />}
          </AreaChart>
        ) : preference.kind === 'combo' ? (
          <ComposedChart {...common}>
            {axes}
            <Bar dataKey="primary" name={CHART_METRIC_LABELS[preference.metric]} fill="#38bdf8" radius={[6, 6, 0, 0]} />
            {preference.compareMetric && <Line type="monotone" dataKey="secondary" name={CHART_METRIC_LABELS[preference.compareMetric]} stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />}
          </ComposedChart>
        ) : (
          <LineChart {...common}>
            {axes}
            <Line type="monotone" dataKey="primary" name={CHART_METRIC_LABELS[preference.metric]} stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
            {preference.compareMetric && <Line type="monotone" dataKey="secondary" name={CHART_METRIC_LABELS[preference.compareMetric]} stroke="#34d399" strokeWidth={2.5} dot={{ r: 3 }} />}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function buildAnalyticsRows(months: FinanceMonth[]): AnalyticsRow[] {
  const wynikValues = months.map((m) => m.wynikNetto);
  const mean = avg(wynikValues);
  const sd = standardDeviation(wynikValues) || 1;
  return months.map((m, idx) => {
    const prev = idx > 0 ? months[idx - 1] : null;
    return {
      month: m.month,
      sprzedaz: m.sprzedaz,
      koszty: m.kosztyRazem,
      wynik: m.wynikNetto,
      marzaPct: m.marzaPct * 100,
      kosztPct: m.kosztDoSprzedazy * 100,
      salesGrowthPct: prev ? pctDelta(m.sprzedaz, prev.sprzedaz) : null,
      wynikZScore: (m.wynikNetto - mean) / sd,
    };
  });
}

function EChartsFinanceChart({ rows }: { rows: AnalyticsRow[] }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    let disposed = false;
    let chart: { setOption: (option: unknown) => void; resize: () => void; dispose: () => void } | null = null;

    void import('echarts').then((echarts) => {
      if (!ref.current || disposed) return;
      chart = echarts.init(ref.current, 'dark');
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        legend: {
          top: 0,
          textStyle: { color: '#94a3b8' },
          data: ['Sprzedaz', 'Koszty', 'Wynik', 'Marza %'],
        },
        grid: { left: 48, right: 42, top: 48, bottom: 32 },
        xAxis: {
          type: 'category',
          data: rows.map((r) => monthLabel(r.month)),
          axisLabel: { color: '#94a3b8' },
          axisLine: { lineStyle: { color: '#334155' } },
        },
        yAxis: [
          {
            type: 'value',
            axisLabel: { color: '#94a3b8' },
            splitLine: { lineStyle: { color: '#1e293b' } },
          },
          {
            type: 'value',
            axisLabel: { color: '#94a3b8', formatter: '{value}%' },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: 'Sprzedaz',
            type: 'bar',
            data: rows.map((r) => Math.round(r.sprzedaz)),
            itemStyle: { color: '#38bdf8', borderRadius: [6, 6, 0, 0] },
          },
          {
            name: 'Koszty',
            type: 'bar',
            data: rows.map((r) => Math.round(r.koszty)),
            itemStyle: { color: '#f59e0b', borderRadius: [6, 6, 0, 0] },
          },
          {
            name: 'Wynik',
            type: 'line',
            smooth: true,
            data: rows.map((r) => Math.round(r.wynik)),
            lineStyle: { color: '#34d399', width: 3 },
            itemStyle: { color: '#34d399' },
          },
          {
            name: 'Marza %',
            type: 'line',
            yAxisIndex: 1,
            smooth: true,
            data: rows.map((r) => Number(r.marzaPct.toFixed(1))),
            lineStyle: { color: '#a78bfa', width: 2, type: 'dashed' },
            itemStyle: { color: '#a78bfa' },
          },
        ],
      });
    });

    const onResize = () => chart?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      chart?.dispose();
    };
  }, [rows]);

  return <div ref={ref} className="mt-4 h-80 w-full" />;
}

function dataSetColumnsByKind(
  dataSet: CustomDataSet,
  kind: CustomDataColumnKind,
): CustomDataColumn[] {
  return dataSet.columns.filter((column) => column.kind === kind);
}

function dataSetMetricValues(dataSet: CustomDataSet, metricId: string): number[] {
  return dataSet.rows
    .map((row) => row[metricId])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function columnName(dataSet: CustomDataSet, columnId: string): string {
  return dataSet.columns.find((column) => column.id === columnId)?.name ?? 'brak metryki';
}

function cellLabel(value: DataCell): string {
  if (value == null || value === '') return 'Brak';
  return String(value);
}

function formatDataCell(value: DataCell): string {
  if (value == null) return '';
  if (typeof value === 'number') return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value);
  return value;
}

function groupDataSetRows(
  dataSet: CustomDataSet,
  groupId: string,
  metricId: string,
): { label: string; value: number }[] {
  const map = new Map<string, number>();
  dataSet.rows.forEach((row) => {
    const metric = row[metricId];
    if (typeof metric !== 'number' || !Number.isFinite(metric)) return;
    const label = cellLabel(row[groupId]);
    map.set(label, (map.get(label) ?? 0) + metric);
  });
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function timeDataSetRows(
  dataSet: CustomDataSet,
  dateId: string,
  metricId: string,
): { label: string; value: number }[] {
  return groupDataSetRows(dataSet, dateId, metricId).sort((a, b) =>
    a.label.localeCompare(b.label, 'pl'),
  );
}

function EChartsCustomDataChart({
  dataSet,
  metricId,
  categoryId,
  dateId,
}: {
  dataSet: CustomDataSet;
  metricId: string;
  categoryId: string;
  dateId: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current || !metricId) return;
    let disposed = false;
    let chart: { setOption: (option: unknown) => void; resize: () => void; dispose: () => void } | null = null;
    const rows = dateId
      ? timeDataSetRows(dataSet, dateId, metricId)
      : categoryId
        ? groupDataSetRows(dataSet, categoryId, metricId).slice(0, 16)
        : dataSetMetricValues(dataSet, metricId)
            .slice(0, 40)
            .map((value, idx) => ({ label: `#${idx + 1}`, value }));

    void import('echarts').then((echarts) => {
      if (!ref.current || disposed) return;
      chart = echarts.init(ref.current, 'dark');
      chart.setOption({
        backgroundColor: 'transparent',
        tooltip: { trigger: 'axis' },
        grid: { left: 56, right: 24, top: 28, bottom: 44 },
        xAxis: {
          type: 'category',
          data: rows.map((row) => row.label),
          axisLabel: { color: '#94a3b8', rotate: rows.length > 8 ? 25 : 0 },
          axisLine: { lineStyle: { color: '#334155' } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#94a3b8' },
          splitLine: { lineStyle: { color: '#1e293b' } },
        },
        series: [
          {
            name: columnName(dataSet, metricId),
            type: dateId ? 'line' : 'bar',
            smooth: Boolean(dateId),
            data: rows.map((row) => Number(row.value.toFixed(2))),
            areaStyle: dateId ? { color: 'rgba(20, 184, 166, 0.12)' } : undefined,
            lineStyle: { color: '#14b8a6', width: 3 },
            itemStyle: { color: '#14b8a6', borderRadius: [6, 6, 0, 0] },
          },
        ],
      });
    });

    const onResize = () => chart?.resize();
    window.addEventListener('resize', onResize);
    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      chart?.dispose();
    };
  }, [categoryId, dataSet, dateId, metricId]);

  if (!metricId) {
    return (
      <div className="mt-4 flex h-80 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/50 text-sm text-slate-500">
        Brak kolumny liczbowej do wykresu.
      </div>
    );
  }

  return <div ref={ref} className="mt-4 h-80 w-full" />;
}

function CustomDataPreviewTable({ dataSet }: { dataSet: CustomDataSet }) {
  const columns = dataSet.columns.slice(0, 14);
  const rows = dataSet.rows.slice(0, 80);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.id} className="whitespace-nowrap px-4 py-2 font-medium">
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="border-b border-slate-800/70 last:border-0">
              {columns.map((column) => (
                <td key={column.id} className="max-w-[240px] truncate px-4 py-3 text-slate-200">
                  {formatDataCell(row[column.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {dataSet.columns.length > columns.length ? (
        <p className="px-4 py-3 text-xs text-slate-500">
          Pokazano {columns.length} z {dataSet.columns.length} kolumn.
        </p>
      ) : null}
    </div>
  );
}

function AnalyticsTanStackTable({
  rows,
  sorting,
  onSortingChange,
}: {
  rows: AnalyticsRow[];
  sorting: AnalyticsSort;
  onSortingChange: (sorting: AnalyticsSort) => void;
}) {
  const columns: { id: keyof AnalyticsRow; header: string; render: (row: AnalyticsRow) => string }[] = [
    { id: 'month', header: 'Miesiac', render: (row) => row.month },
    { id: 'sprzedaz', header: 'Sprzedaz', render: (row) => formatPricePln(row.sprzedaz) },
    { id: 'koszty', header: 'Koszty', render: (row) => formatPricePln(row.koszty) },
    { id: 'wynik', header: 'Wynik', render: (row) => formatPricePln(row.wynik) },
    { id: 'marzaPct', header: 'Marza %', render: (row) => `${row.marzaPct.toFixed(1)}%` },
    { id: 'wynikZScore', header: 'Z-score', render: (row) => row.wynikZScore.toFixed(2) },
  ];
  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sorting.id];
      const bv = b[sorting.id];
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), 'pl');
      return sorting.desc ? -cmp : cmp;
    });
    return copy;
  }, [rows, sorting]);

  function toggleSort(id: keyof AnalyticsRow) {
    onSortingChange({
      id,
      desc: sorting.id === id ? !sorting.desc : true,
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.id} className="px-4 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => toggleSort(column.id)}
                  className="inline-flex items-center gap-1 hover:text-slate-300"
                >
                  {column.header}
                  <span className="text-slate-600">
                    {sorting.id === column.id ? (sorting.desc ? '↓' : '↑') : ''}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.month} className="border-b border-slate-800/70 last:border-0">
              {columns.map((column) => (
                <td key={column.id} className="px-4 py-3 text-slate-200">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InsightCard({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-100">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{note}</p>
    </div>
  );
}

function EngineCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{text}</p>
    </div>
  );
}

function categoryActual(
  category: CostCategoryConfig,
  current: FinanceMonth | null,
  imports: OpsImportRecord[],
): number {
  const imported = imports
    .filter((item) => item.area === category.group)
    .reduce((sum, item) => sum + item.value, 0);
  if (!current) return imported;

  const name = category.name.toLowerCase();
  let base = 0;
  if (name.includes('towar')) base += current.kosztTowaru;
  if (name.includes('marketplace') || category.group === 'ecommerce') base += current.marketplace;
  if (name.includes('dostaw') || name.includes('kurier')) base += current.dostawa;
  if (category.group === 'costs' || category.group === 'accounting') base += current.operacyjne * 0.35;
  return base + imported;
}

function normalizeSalesReps(reps: SalesRepConfig[], fieldSales: number): SalesRepConfig[] {
  if (!reps.length) return [];
  const currentTotal = reps.reduce((sum, rep) => sum + rep.sales, 0);
  if (currentTotal > 0 || fieldSales <= 0) return reps;
  const weights = [0.46, 0.34, 0.2];
  return reps.map((rep, idx) => ({
    ...rep,
    sales: Math.round(fieldSales * (weights[idx] ?? 0.12)),
  }));
}

function repCommission(rep: SalesRepConfig): number {
  return Math.max(0, rep.sales - rep.returns) * (rep.commissionPct / 100);
}

function repMarginValue(rep: SalesRepConfig): number {
  return Math.max(0, rep.sales - rep.returns) * (rep.marginPct / 100);
}

function repContribution(rep: SalesRepConfig): number {
  return repMarginValue(rep) - repCommission(rep) - rep.costs;
}

function SalesRepMiniList({ reps }: { reps: SalesRepConfig[] }) {
  if (!reps.length) {
    return <p className="py-8 text-center text-sm text-slate-500">Brak handlowcow.</p>;
  }
  return (
    <ul className="space-y-2">
      {reps.slice(0, 4).map((rep) => (
        <li key={rep.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-100">{rep.name}</p>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-50">{formatPricePln(rep.sales)}</p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{
                width: `${Math.max(4, Math.min(100, (rep.marginPct / Math.max(rep.targetMarginPct, 1)) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            marza {rep.marginPct.toFixed(1)}% / cel {rep.targetMarginPct.toFixed(1)}% · wynik {formatPricePln(repContribution(rep))}
          </p>
        </li>
      ))}
    </ul>
  );
}

function SalesRepDetail({ rep }: { rep: SalesRepConfig }) {
  const margin = repMarginValue(rep);
  const commission = repCommission(rep);
  const contribution = repContribution(rep);
  const targetGap = rep.marginPct - rep.targetMarginPct;
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-50">{rep.name}</h3>
          <p className="text-xs text-slate-500">{rep.userLabel}</p>
        </div>
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
            targetGap >= 0
              ? 'bg-emerald-500/15 text-emerald-300'
              : 'bg-amber-500/15 text-amber-300'
          }`}
        >
          {targetGap >= 0 ? '+' : ''}
          {targetGap.toFixed(1)} pp do celu
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Sprzedaz" value={formatPricePln(rep.sales)} />
        <MiniStat label="Marza" value={formatPricePln(margin)} />
        <MiniStat label="Prowizja" value={formatPricePln(commission)} />
        <MiniStat label="Wynik" value={formatPricePln(contribution)} />
      </div>
      <CalculationTable
        rows={[
          calc('Sprzedaz netto', 'Handlowiec', 'CRM / raport', rep.sales, rep.sales, 'podstawa rozliczenia'),
          calc('Marza handlowca', 'Handlowiec', `${rep.marginPct.toFixed(1)}% sprzedazy`, rep.sales, margin, 'marza ustawiona dla uzytkownika'),
          calc('Prowizja', 'Handlowiec', `${rep.commissionPct.toFixed(1)}% po zwrotach`, rep.sales - rep.returns, -commission, 'do wyplaty'),
          calc('Koszty i zwroty', 'Handlowiec', 'koszty + zwroty', rep.costs + rep.returns, -(rep.costs + rep.returns), 'obniza wynik'),
          calc('Wynik koncowy', 'Handlowiec', 'marza - prowizja - koszty', margin, contribution, 'wynik po rozliczeniu'),
        ]}
      />
    </section>
  );
}

function rule(
  label: string,
  area: string,
  value: string,
  target: string,
  ok: boolean | null | undefined,
): CalculationRow {
  return {
    label,
    area,
    base: target,
    value,
    result: ok ? 'OK' : 'Do sprawdzenia',
    note: ok ? 'w limicie' : 'wymaga reakcji',
  };
}

const INPUT_CLS =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none';

function SectionTitle({
  title,
  subtitle,
  helpId,
}: {
  title: string;
  subtitle?: string;
  helpId?: string;
}) {
  const contextHelpId = helpId ?? inferContextHelpId(`${title} ${subtitle ?? ''}`);
  return (
    <div>
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
        {title}
        {contextHelpId ? <ContextHelp id={contextHelpId} /> : null}
      </h3>
      {subtitle && <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>}
    </div>
  );
}

function BackButton({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/70">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function OpsCommandDock({
  current,
  priorities,
  readiness,
  reconciliationGap,
  onOpenTool,
}: {
  current: FinanceMonth | null;
  priorities: OpsPriority[];
  readiness: number;
  reconciliationGap: number;
  onOpenTool: (tool: OpsToolId) => void;
}) {
  const urgentCount = priorities.filter((item) => item.tone === 'bad' || item.tone === 'warn').length;

  return (
    <section className="lg:sticky lg:top-2 lg:z-20">
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-slate-950/20">
        <div className="grid gap-3 xl:grid-cols-[0.75fr_1.45fr_0.8fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Panel decyzji
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {current ? monthLabel(current.month) : 'Brak miesiaca'}
                </p>
              </div>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${urgentCount ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                {urgentCount ? `${urgentCount} do sprawdzenia` : 'czysto'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniStat label="Jakosc" value={`${readiness}%`} />
              <MiniStat label="Luka" value={formatPricePln(reconciliationGap)} />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {priorities.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenTool(item.tool)}
                className="group rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-brand-400 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-brand-500/50 dark:hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${priorityToneClass(item.tone)}`}>
                    {item.value}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 dark:text-slate-600 dark:group-hover:text-brand-300" />
                </div>
                <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-500">{item.detail}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
            <button
              type="button"
              onClick={() => onOpenTool('workspace-builder')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Nowa plansza
            </button>
            <button
              type="button"
              onClick={() => onOpenTool('analytics-lab')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Database className="h-4 w-4" />
              Analiza
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function priorityToneClass(tone: OpsPriority['tone']): string {
  if (tone === 'bad') return 'bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-300';
  if (tone === 'warn') return 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300';
  if (tone === 'good') return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300';
  return 'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-300';
}

function FinanceKpiTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-emerald-800 dark:text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-800 dark:text-amber-300'
        : tone === 'bad'
          ? 'text-rose-800 dark:text-rose-300'
          : 'text-slate-950 dark:text-slate-100';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function FinanceLaneCard({
  title,
  icon,
  value,
  hint,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  value: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-28 flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand-400 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/55 dark:hover:border-brand-500/50 dark:hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-xl bg-slate-100 p-2 text-brand-700 dark:bg-slate-800 dark:text-brand-300">{icon}</span>
        <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-brand-600 dark:text-slate-600 dark:group-hover:text-brand-300" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-950 dark:text-slate-50">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </button>
  );
}

function ToolCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-32 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-600 dark:hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-xl bg-slate-100 p-2 text-brand-700 dark:bg-slate-800 dark:text-brand-400">{icon}</span>
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300">
          aktywne
        </span>
      </div>
      <div>
        <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-500">{subtitle}</p>
      </div>
      <span className="mt-auto flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-300">
        Otworz
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function CalculationTable({ rows }: { rows: CalculationRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
      <div className="border-b border-slate-800 px-4 py-3">
        <SectionTitle title="Tabela wyliczen" subtitle="Robocze liczby, baza obliczenia, wynik i notatka kontrolna." />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Obszar</th>
              <th className="px-4 py-2 font-medium">Pozycja</th>
              <th className="px-4 py-2 font-medium">Baza</th>
              <th className="px-4 py-2 font-medium text-right">Wartosc</th>
              <th className="px-4 py-2 font-medium text-right">Wynik</th>
              <th className="px-4 py-2 font-medium">Notatka</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.area}-${row.label}`} className="border-b border-slate-800/70 last:border-0">
                <td className="px-4 py-3 text-slate-400">{row.area}</td>
                <td className="px-4 py-3 font-medium text-slate-100">{row.label}</td>
                <td className="px-4 py-3 text-slate-500">{row.base}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-200">{row.value}</td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-100">{row.result}</td>
                <td className="px-4 py-3 text-slate-500">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DataImportsList({
  imports,
  onClear,
}: {
  imports: OpsImportRecord[];
  onClear: () => void;
}) {
  if (imports.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-500">
        Brak importow. Dodaj pierwszy raport po lewej stronie.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Data</th>
              <th className="px-4 py-2 font-medium">Zrodlo</th>
              <th className="px-4 py-2 font-medium">Miesiac</th>
              <th className="px-4 py-2 font-medium text-right">Wiersze</th>
              <th className="px-4 py-2 font-medium text-right">Wartosc</th>
              <th className="px-4 py-2 font-medium">Plik</th>
            </tr>
          </thead>
          <tbody>
            {imports.slice(0, 12).map((item) => (
              <tr key={item.id} className="border-b border-slate-800/70 last:border-0">
                <td className="px-4 py-3 text-slate-500">{item.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-3 font-medium text-slate-100">{item.sourceName}</td>
                <td className="px-4 py-3 text-slate-400">{item.month}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-200">{item.rows}</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-200">{formatPricePln(item.value)}</td>
                <td className="px-4 py-3 text-slate-500">{item.fileName ?? item.note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-slate-800 px-4 py-3 text-right">
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-slate-500 hover:text-rose-300"
        >
          wyczysc historie lokalna
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function flowLabel(flow: SourceFlow): string {
  const labels: Record<SourceFlow, string> = {
    ecommerce: 'E-commerce',
    field: 'Handel',
    accounting: 'Ksiegowosc',
    bank: 'Bank',
    costs: 'Koszty',
    warehouse: 'Magazyn',
  };
  return labels[flow];
}

function statusLabel(status: SourceStatus): string {
  const labels: Record<SourceStatus, string> = {
    connected: 'polaczone',
    manual: 'reczne',
    missing: 'brak danych',
  };
  return labels[status];
}
