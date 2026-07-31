import { useMemo, useState } from 'react';
import {
  Calculator,
  ChevronRight,
  Layers,
  LineChart,
  Percent,
  Store,
  ArrowUpDown,
} from 'lucide-react';
import type { Product } from '../types';
import {
  formatMarginPercent,
  formatPricePln,
  marginPercent,
} from '../lib/format';
import { getProductImage } from '../lib/products';

type OpsToolId = 'hub' | 'margin-rank' | 'marketplace' | 'finance' | 'kits-note';

interface OpsHubViewProps {
  products: Product[];
  canManageKits: boolean;
  onOpenKits: () => void;
}

export function OpsHubView({
  products,
  canManageKits,
  onOpenKits,
}: OpsHubViewProps) {
  const [tool, setTool] = useState<OpsToolId>('hub');

  if (tool === 'margin-rank') {
    return (
      <MarginRankPanel products={products} onBack={() => setTool('hub')} />
    );
  }

  if (tool === 'marketplace' || tool === 'finance') {
    return (
      <SoonPanel
        title={
          tool === 'marketplace'
            ? 'Kalkulator marży marketplace'
            : 'Zestawienie finansowe'
        }
        blurb={
          tool === 'marketplace'
            ? 'Docelowo: prowizje Allegro / Amazon / własne kanały, koszty wysyłki i netto po opłatach — na bazie cen z katalogu i WAPRO.'
            : 'Docelowo: podgląd operacyjny sprzedaży, marży i kosztów Kenochem — nie księgowość, tylko żywa baza pod decyzje.'
        }
        onBack={() => setTool('hub')}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-1 pb-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-brand-400">
          <Calculator className="h-5 w-5" />
          <h2 className="text-lg font-semibold text-slate-100">Operacje</h2>
        </div>
        <p className="text-sm leading-relaxed text-slate-400">
          Miejsce na kalkulatory i zestawienia wokół żywej bazy e‑commerce
          Kenochem. Na razie szkielet — narzędzia doprecyzujemy w kolejnych
          krokach.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToolCard
          icon={<Percent className="h-5 w-5" />}
          title="Ranking marży"
          subtitle="Sortowanie produktów po marży WAPRO (oba katalogi, zakup/sprzedaż netto)"
          status="ready"
          onClick={() => setTool('margin-rank')}
        />
        <ToolCard
          icon={<Store className="h-5 w-5" />}
          title="Marża marketplace"
          subtitle="Prowizje i marża netto po sprzedaży na platformach"
          status="soon"
          onClick={() => setTool('marketplace')}
        />
        <ToolCard
          icon={<LineChart className="h-5 w-5" />}
          title="Finanse firmy"
          subtitle="Ogólne zestawienie operacyjne — sprzedaż, marża, koszty"
          status="soon"
          onClick={() => setTool('finance')}
        />
        <ToolCard
          icon={<Layers className="h-5 w-5" />}
          title="Zestawy produktów"
          subtitle={
            canManageKits
              ? 'Tworzenie i edycja zestawów (już w katalogu Akcesoria)'
              : 'Tworzenie zestawów — wymaga roli z dostępem do zestawów'
          }
          status={canManageKits ? 'link' : 'soon'}
          onClick={() => {
            if (canManageKits) onOpenKits();
            else setTool('kits-note');
          }}
        />
      </div>

      {tool === 'kits-note' && (
        <p className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-400">
          Zestawy są już w osobnym widoku (Akcesoria). Rozszerzenie na Produkty /
          sklep doprecyzujemy później.
          <button
            type="button"
            className="ml-2 text-brand-400 underline-offset-2 hover:underline"
            onClick={() => setTool('hub')}
          >
            OK
          </button>
        </p>
      )}
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

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = products
      .map((p) => {
        const margin = marginPercent(p.pricePurchaseNet, p.priceSaleNet);
        return { p, margin };
      })
      .filter((r) => r.margin != null)
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
    return list.slice(0, 200);
  }, [products, dir, q]);

  const withPrices = products.filter(
    (p) =>
      marginPercent(p.pricePurchaseNet, p.priceSaleNet) != null,
  ).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-1 pb-8">
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
            Marża = (sprzedaż − zakup) / sprzedaż netto · {withPrices} SKU z
            cenami · max 200 pozycji
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {dir === 'desc' ? 'Od najwyższej' : 'Od najniższej'}
        </button>
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
          Brak produktów z kompletnymi cenami netto w tym katalogu.
        </p>
      ) : (
        <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800">
          {rows.map(({ p, margin }, idx) => (
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
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={`text-sm font-semibold tabular-nums ${
                    (margin ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
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
    </div>
  );
}
