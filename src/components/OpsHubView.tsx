import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  Calculator,
  ChevronRight,
  Download,
  LineChart,
  Package,
  Percent,
  Store,
} from 'lucide-react';
import type { Product } from '../types';
import { downloadCsv, stampFile } from '../lib/exportReport';
import {
  formatMarginPercent,
  formatPricePln,
  marginPercent,
} from '../lib/format';
import { getProductImage } from '../lib/products';
import { showToast } from '../lib/toast';
import { FinanceDashboard } from './FinanceDashboard';

type OpsToolId =
  | 'hub'
  | 'margin-rank'
  | 'marketplace'
  | 'finance'
  | 'abc'
  | 'alerts';

type MarginBand = 'all' | 'lt20' | '20-30' | '30-40' | '40plus';

interface OpsHubViewProps {
  products: Product[];
}

export function OpsHubView({ products }: OpsHubViewProps) {
  const [tool, setTool] = useState<OpsToolId>('hub');

  if (tool === 'margin-rank') {
    return (
      <MarginRankPanel products={products} onBack={() => setTool('hub')} />
    );
  }

  if (tool === 'finance') {
    return <FinanceDashboard onBack={() => setTool('hub')} />;
  }

  if (tool === 'marketplace' || tool === 'abc' || tool === 'alerts') {
    const copy =
      tool === 'marketplace'
        ? {
            title: 'Marża marketplace',
            blurb:
              'Prowizje Allegro / Erli / Empik / sklep własne — marża netto po opłatach kanału, na bazie cen katalogu i rejestru kosztów.',
          }
        : tool === 'abc'
          ? {
              title: 'ABC produktów',
              blurb:
                'Pareto sprzedaży: które SKU robią 80% obrotu, a które zalegają. Wymaga podpięcia sprzedaży per SKU (Baselinker / Mag).',
            }
          : {
              title: 'Alerty marży i cen',
              blurb:
                'Lista produktów bez ceny, z marżą poniżej progu albo ze spadkiem marży vs poprzedni okres — do szybkiej reakcji handlu.',
            };
    return (
      <div className="mx-auto max-w-xl">
        <SoonPanel
          title={copy.title}
          blurb={copy.blurb}
          onBack={() => setTool('hub')}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-1 pb-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-brand-400">
          <Calculator className="h-5 w-5" />
          <h2 className="text-lg font-semibold text-slate-100">Operacje</h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          Moduły analityczne ponad katalogami — finanse, marże, kanały. Osobny
          tryb od przeglądania produktów.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard
          icon={<Percent className="h-5 w-5" />}
          title="Ranking marży"
          subtitle="Filtry <20% / 20–30 / 30–40 / 40+ · eksport Excel"
          status="ready"
          onClick={() => setTool('margin-rank')}
        />
        <ToolCard
          icon={<LineChart className="h-5 w-5" />}
          title="Finanse firmy"
          subtitle="KPI, sprzedaż netto vs poprzedni miesiąc, koszty, raport CSV"
          status="ready"
          onClick={() => setTool('finance')}
        />
        <ToolCard
          icon={<Store className="h-5 w-5" />}
          title="Marża marketplace"
          subtitle="Prowizje i marża netto po sprzedaży na platformach"
          status="soon"
          onClick={() => setTool('marketplace')}
        />
        <ToolCard
          icon={<Package className="h-5 w-5" />}
          title="ABC produktów"
          subtitle="Top / dead stock — które SKU robią obrót"
          status="soon"
          onClick={() => setTool('abc')}
        />
        <ToolCard
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Alerty marży"
          subtitle="Niska marża, brak cen, odchylenia do pilnej korekty"
          status="soon"
          onClick={() => setTool('alerts')}
        />
      </div>
    </div>
  );
}

function ToolCard({
  icon,
  title,
  subtitle,
  status,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: 'ready' | 'soon' | 'link';
  onClick: () => void;
}) {
  const badge =
    status === 'ready'
      ? 'Dostępne'
      : status === 'link'
        ? 'Otwórz'
        : 'Wkrótce';
  const badgeClass =
    status === 'ready'
      ? 'bg-emerald-500/15 text-emerald-300'
      : status === 'link'
        ? 'bg-brand-500/15 text-brand-300'
        : 'bg-slate-700/80 text-slate-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-left transition hover:border-slate-600 hover:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-xl bg-slate-800 p-2 text-brand-400 group-hover:bg-slate-800/80">
          {icon}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
        >
          {badge}
        </span>
      </div>
      <div>
        <p className="font-semibold text-slate-100">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{subtitle}</p>
      </div>
      <span className="mt-auto flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-300">
        Wejdź
        <ChevronRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function SoonPanel({
  title,
  blurb,
  onBack,
}: {
  title: string;
  blurb: string;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-4 px-1 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        ← Operacje
      </button>
      <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
      <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-6 text-sm leading-relaxed text-slate-400">
        {blurb}
        <span className="mt-3 block text-xs text-slate-500">
          Placeholder — logika i pola pojawią się, gdy ustalimy źródła danych i
          zasady liczenia.
        </span>
      </p>
    </div>
  );
}

function MarginRankPanel({
  products,
  onBack,
}: {
  products: Product[];
  onBack: () => void;
}) {
  const [dir, setDir] = useState<'desc' | 'asc'>('desc');
  const [q, setQ] = useState('');
  const [band, setBand] = useState<MarginBand>('all');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = products
      .map((p) => {
        const margin = marginPercent(p.pricePurchaseNet, p.priceSaleNet);
        return { p, margin };
      })
      .filter((r) => r.margin != null)
      .filter((r) => {
        const m = r.margin!;
        if (band === 'lt20') return m < 20;
        if (band === '20-30') return m >= 20 && m < 30;
        if (band === '30-40') return m >= 30 && m < 40;
        if (band === '40plus') return m >= 40;
        return true;
      })
      .filter((r) => {
        if (!needle) return true;
        return (
          r.p.displayName.toLowerCase().includes(needle) ||
          r.p.sku.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const am = a.margin ?? 0;
        const bm = b.margin ?? 0;
        return dir === 'desc' ? bm - am : am - bm;
      });
    return list;
  }, [products, dir, q, band]);

  const bandCounts = useMemo(() => {
    const counts: Record<MarginBand, number> = {
      all: 0,
      lt20: 0,
      '20-30': 0,
      '30-40': 0,
      '40plus': 0,
    };
    for (const p of products) {
      const m = marginPercent(p.pricePurchaseNet, p.priceSaleNet);
      if (m == null) continue;
      counts.all += 1;
      if (m < 20) counts.lt20 += 1;
      else if (m < 30) counts['20-30'] += 1;
      else if (m < 40) counts['30-40'] += 1;
      else counts['40plus'] += 1;
    }
    return counts;
  }, [products]);

  const bands: { id: MarginBand; label: string }[] = [
    { id: 'all', label: 'Wszystkie' },
    { id: 'lt20', label: '< 20%' },
    { id: '20-30', label: '20–30%' },
    { id: '30-40', label: '30–40%' },
    { id: '40plus', label: '40%+' },
  ];

  return (
    <div className="w-full space-y-4 px-1 pb-8">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        ← Operacje
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Ranking marży</h2>
          <p className="text-xs text-slate-500">
            Marża = (sprzedaż − zakup) / sprzedaż netto · {bandCounts.all} SKU z
            cenami · pokazano {rows.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {dir === 'desc' ? 'Od najwyższej' : 'Od najniższej'}
          </button>
          <button
            type="button"
            onClick={() => {
              downloadCsv(
                stampFile(`marze_${band}`),
                [
                  'SKU',
                  'Nazwa',
                  'Katalog',
                  'Zakup netto',
                  'Sprzedaż netto',
                  'Marża %',
                ],
                rows.map(({ p, margin }) => [
                  p.sku,
                  p.displayName,
                  p.catalog === 'shop' ? 'Produkty' : 'Akcesoria',
                  p.pricePurchaseNet?.toFixed(2) ?? '',
                  p.priceSaleNet?.toFixed(2) ?? '',
                  margin != null ? margin.toFixed(2) : '',
                ]),
              );
              showToast(`Eksport ${rows.length} pozycji`, 'ok');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-600"
          >
            <Download className="h-3.5 w-3.5" />
            Excel (CSV)
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {bands.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBand(b.id)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
              band === b.id
                ? 'bg-brand-600 text-white shadow'
                : 'border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {b.label}
            <span
              className={`ml-1.5 tabular-nums ${
                band === b.id ? 'text-white/70' : 'text-slate-600'
              }`}
            >
              {bandCounts[b.id]}
            </span>
          </button>
        ))}
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filtruj SKU / nazwę…"
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
          Brak produktów w tym zakresie marży.
        </p>
      ) : (
        <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800">
          {rows.slice(0, 300).map(({ p, margin }, idx) => (
            <li
              key={p.id}
              className="flex items-center gap-3 bg-slate-900/40 px-3 py-2.5"
            >
              <span className="w-7 shrink-0 text-center text-xs tabular-nums text-slate-600">
                {idx + 1}
              </span>
              <img
                src={getProductImage(p) || undefined}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover bg-slate-800"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">
                  {p.displayName}
                </p>
                <p className="truncate font-mono text-[11px] text-slate-500">
                  {p.sku}
                  <span className="ml-2 text-slate-600">
                    {p.catalog === 'shop' ? 'Produkty' : 'Akcesoria'}
                  </span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    (margin ?? 0) >= 30
                      ? 'text-emerald-400'
                      : (margin ?? 0) >= 20
                        ? 'text-amber-300'
                        : 'text-rose-400'
                  }`}
                >
                  {formatMarginPercent(margin)}
                </p>
                <p className="text-[10px] tabular-nums text-slate-500">
                  {formatPricePln(p.pricePurchaseNet)} →{' '}
                  {formatPricePln(p.priceSaleNet)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 300 && (
        <p className="text-center text-xs text-slate-500">
          Lista ucięta do 300 — pełny zestaw w eksporcie CSV.
        </p>
      )}
    </div>
  );
}
