import { ArrowRight, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Product, View } from '../../types';
import { computeCatalogStats, suggestNext, type GroupStat, type Suggestion } from '../../lib/catalogStats';
import { computeInventoryStats, formatMoney, LOW_STOCK_MAX, type InventoryStats } from '../../lib/inventoryStats';
import { FIX_IDS, FIX_LABEL, detectFixes, type ActivityRow } from '../../lib/profileStats';
import { VALIDATION_KINDS, VALIDATION_LABEL } from '../../lib/validations';
import { attributeCoverage, getAttributes, useAttributesVersion } from '../../lib/attributes';
import { hasBaselinkerLink } from '../../lib/baselinkerLink';
import { useBaselinkerLinksVersion } from '../../lib/baselinkerLive';
import { fetchAuditLog, type AuditEntry } from '../../lib/auditLog';
import { ChartCard, Columns, Donut, HBars, Kpi, MiniMeter, PALETTE, Trend, type SeriesPoint } from './ChartCards';

type Tab = 'overview' | 'stock' | 'prices' | 'media' | 'manufacturers' | 'categories' | 'changes';

interface CatalogProgressViewProps {
  products: Product[];
  /** Otwiera Uzupełnianie danych z gotowym filtrem (rodzaje braków, kategoria, producent). */
  onOpenDecisions: (kinds?: string[], category?: string, manufacturer?: string) => void;
  onOpenProduct: (product: Product) => void;
  onOpenView: (view: View) => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Przegląd' },
  { id: 'stock', label: 'Magazyn' },
  { id: 'prices', label: 'Ceny i marże' },
  { id: 'media', label: 'Zdjęcia i opisy' },
  { id: 'manufacturers', label: 'Producenci' },
  { id: 'categories', label: 'Kategorie' },
  { id: 'changes', label: 'Zmiany pracowników' },
];

const nf = (n: number) => n.toLocaleString('pl-PL');
const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const pctText = (n: number, d: number) => `${pctOf(n, d)}%`;
const oneDec = (n: number) => n.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Stats = ReturnType<typeof computeCatalogStats>;

export function CatalogProgressView({ products, onOpenDecisions, onOpenProduct }: CatalogProgressViewProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const linksVersion = useBaselinkerLinksVersion();
  const stats = useMemo(() => computeCatalogStats(products), [products]);
  const inv = useMemo(() => computeInventoryStats(products), [products]);
  const bl = useMemo(() => {
    let linked = 0;
    let ready = 0;
    for (const p of products) {
      if (p.isGroup) continue;
      if (hasBaselinkerLink(p)) linked++;
      else if (p.hasImage) ready++;
    }
    return { linked, ready, notLinked: Math.max(0, inv.singles - linked) };
    // linksVersion: powiązania z BaseLinkerem odświeżają się w tle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, inv.singles, linksVersion]);
  const suggestions = useMemo(() => suggestNext(stats, 5), [stats]);
  const next = suggestions[0];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div>
          <h2 className="text-[34px] font-semibold leading-tight tracking-tight text-slate-950 dark:text-slate-50">Statystyki</h2>
          <p className="mt-1 text-[15px] text-slate-500">
            {nf(stats.total)} aktywnych produktów · jakość danych, magazyn, ceny i praca zespołu
          </p>
        </div>
      </header>

      <nav className="-mx-1 overflow-x-auto px-1" role="tablist">
        <div className="inline-flex gap-0.5 rounded-xl bg-slate-200/70 p-1 dark:bg-white/10">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition ${
                tab === id
                  ? 'bg-white text-slate-950 shadow-sm dark:bg-white/20 dark:text-white'
                  : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'overview' && (
        <Overview stats={stats} inv={inv} bl={bl} suggestions={suggestions} next={next} products={products} onOpenDecisions={onOpenDecisions} />
      )}
      {tab === 'stock' && <StockTab inv={inv} onOpenProduct={onOpenProduct} />}
      {tab === 'prices' && <PricesTab inv={inv} onOpenProduct={onOpenProduct} />}
      {tab === 'media' && <MediaTab stats={stats} inv={inv} onOpenDecisions={onOpenDecisions} />}
      {tab === 'manufacturers' && <GroupTab kind="manufacturers" stats={stats} onOpenDecisions={onOpenDecisions} />}
      {tab === 'categories' && <GroupTab kind="categories" stats={stats} onOpenDecisions={onOpenDecisions} />}
      {tab === 'changes' && <ChangesTab products={products} onOpenProduct={onOpenProduct} />}
    </div>
  );
}

/** Lista „etykieta — wartość” z cienkimi separatorami. */
function Facts({ title, rows }: { title: string; rows: [string, ReactNode][] }) {
  return (
    <div>
      <p className="mb-1 text-[13px] font-semibold text-slate-950 dark:text-slate-50">{title}</p>
      <dl className="divide-y divide-slate-200 dark:divide-white/10">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 py-2 text-[13px]">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right font-medium tabular-nums text-slate-950 dark:text-slate-50">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function NextStep({ suggestion, onGo }: { suggestion: Suggestion; onGo: (s: Suggestion) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-slate-100/70 p-5 dark:bg-white/[0.045] sm:p-6">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-slate-500">Następny krok</p>
        <p className="mt-0.5 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">{suggestion.title}</p>
        <p className="mt-0.5 text-[13px] text-slate-500">{suggestion.detail}</p>
      </div>
      <button
        type="button"
        onClick={() => onGo(suggestion)}
        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:opacity-85 dark:bg-white dark:text-slate-950"
      >
        Zacznij <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Przegląd
// ---------------------------------------------------------------------------------------------

function AttributesCoverageCard({ products, onOpenDecisions }: { products: Product[]; onOpenDecisions: CatalogProgressViewProps['onOpenDecisions'] }) {
  const version = useAttributesVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => attributeCoverage(products, getAttributes()).filter((r) => r.inScope > 0), [products, version]);
  if (rows.length === 0) return null;
  return (
    <ChartCard title="Atrybuty produktów" subtitle="Ile produktów w zakresie atrybutu ma uzupełnioną wartość">
      <HBars
        data={rows.map((r) => ({ name: r.def.label, value: r.pct, color: r.pct < 40 ? PALETTE.rose : r.pct < 75 ? PALETTE.amber : PALETTE.green }))}
        unit="%"
        max={100}
        onClick={() => onOpenDecisions(['attrs'])}
      />
    </ChartCard>
  );
}

function Overview({
  stats,
  inv,
  bl,
  suggestions,
  next,
  products,
  onOpenDecisions,
}: {
  products: Product[];
  stats: Stats;
  inv: InventoryStats;
  bl: { linked: number; ready: number; notLinked: number };
  suggestions: Suggestion[];
  next?: Suggestion;
  onOpenDecisions: CatalogProgressViewProps['onOpenDecisions'];
}) {
  const levelData = [
    { name: 'Bogaty (85+)', value: stats.levels.rich, color: PALETTE.green },
    { name: 'Dobry (65–84)', value: stats.levels.good, color: PALETTE.sky },
    { name: 'Średni (40–64)', value: stats.levels.fair, color: PALETTE.amber },
    { name: 'Słaby (<40)', value: stats.levels.weak, color: PALETTE.rose },
  ];
  const histogram = stats.histogram.map((v, i) => ({
    name: i === 9 ? '90+' : `${i * 10}`,
    value: v,
    color: i < 4 ? PALETTE.rose : i < 6 ? PALETTE.amber : i < 8 ? PALETTE.sky : PALETTE.green,
  }));
  const worst = [...stats.manufacturers].filter((m) => m.count >= 5).sort((a, b) => a.avgScore - b.avgScore).slice(0, 8);

  return (
    <div className="space-y-5">
      {next && <NextStep suggestion={next} onGo={(s) => onOpenDecisions(s.kinds)} />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Produkty" value={nf(inv.products)} sub={`${nf(inv.groups)} grup · ${nf(inv.groupVariants)} wariantów`} />
        <Kpi label="Wartość magazynu" value={formatMoney(inv.valuePurchase, true)} sub="po cenach zakupu netto" />
        <Kpi label="Na stanie" value={nf(inv.withStock)} sub={`${nf(inv.units)} szt. · ${nf(inv.zeroStock)} bez stanu`} />
        <Kpi label="Kompletność" value={`${stats.avgScore}%`} sub="średnia 0–100 pkt" />
        <Kpi label="Marża średnia" value={inv.withMargin ? `${oneDec(inv.avgMarginPct)}%` : '—'} sub={`${nf(inv.withMargin)} produktów z obiema cenami`} />
        <Kpi label="W BaseLinkerze" value={pctText(bl.linked, inv.singles)} sub={`${nf(bl.notLinked)} poza BaseLinkerem`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Poziomy kompletności" subtitle="Podział produktów wg oceny wiedzy o produkcie">
          <Donut data={levelData} center={{ top: `${stats.avgScore}%`, bottom: 'średnio' }} />
        </ChartCard>
        <ChartCard title="Rozkład kompletności" subtitle="Liczba produktów w przedziałach po 10 punktów" className="lg:col-span-2">
          <Columns data={histogram} />
        </ChartCard>
      </div>

      <ChartCard title="Wszystkie wskaźniki" subtitle="Komplet kluczowych parametrów katalogu w jednym miejscu">
        <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
          <Facts
            title="Asortyment"
            rows={[
              ['Produkty (bez grup)', nf(inv.singles)],
              ['Grupy produktów', nf(inv.groups)],
              ['Warianty w grupach', nf(inv.groupVariants)],
              ['Sklep', nf(stats.catalogs.shop)],
              ['Akcesoria', nf(stats.catalogs.accessories)],
              ['Producenci', nf(stats.manufacturers.length)],
              ['Kategorie', nf(stats.categories.length)],
            ]}
          />
          <Facts
            title="Magazyn"
            rows={[
              ['Sztuk na stanie', nf(inv.units)],
              ['Produkty ze stanem', nf(inv.withStock)],
              ['Produkty bez stanu', nf(inv.zeroStock)],
              [`Niski stan (1–${LOW_STOCK_MAX} szt.)`, nf(inv.lowStock)],
              ['Stan ujemny', nf(inv.negativeStock)],
              ['Stany ustawione ręcznie', nf(inv.manualStock)],
              ['Kandydaci do ukrycia', nf(stats.junkCandidates)],
            ]}
          />
          <Facts
            title="Wartość i marża"
            rows={[
              ['Wartość po cenie zakupu', formatMoney(inv.valuePurchase)],
              ['Wartość po cenie sprzedaży', formatMoney(inv.valueSale)],
              ['Potencjalna marża zapasu', formatMoney(inv.valueSale - inv.valuePurchase)],
              ['Marża średnia', inv.withMargin ? `${oneDec(inv.avgMarginPct)}%` : '—'],
              ['Marża ważona zapasem', inv.weightedMarginPct ? `${oneDec(inv.weightedMarginPct)}%` : '—'],
              ['Sprzedaż poniżej zakupu', nf(inv.negativeMargin)],
              ['Bez ceny zakupu / sprzedaży', `${nf(inv.noPurchasePrice)} / ${nf(inv.noSalePrice)}`],
            ]}
          />
          <Facts
            title="Zdjęcia i opisy"
            rows={[
              ['Ze zdjęciem', `${nf(stats.withPhoto)} (${pctText(stats.withPhoto, stats.total)})`],
              ['Bez zdjęcia', nf(stats.total - stats.withPhoto)],
              ['Z więcej niż jednym zdjęciem', nf(inv.multiImage)],
              ['Z opisem', `${nf(inv.withDescription)} (${pctText(inv.withDescription, inv.singles)})`],
              ['Z kodem EAN', `${nf(stats.withEan)} (${pctText(stats.withEan, stats.total)})`],
              ['Z producentem', `${nf(stats.withManufacturer)} (${pctText(stats.withManufacturer, stats.total)})`],
              ['Z ceną sprzedaży', `${nf(stats.withPrice)} (${pctText(stats.withPrice, stats.total)})`],
            ]}
          />
          <Facts
            title="BaseLinker"
            rows={[
              ['Powiązane', `${nf(bl.linked)} (${pctText(bl.linked, inv.singles)})`],
              ['Poza BaseLinkerem', nf(bl.notLinked)],
              ['Gotowe do dodania (mają zdjęcie)', nf(bl.ready)],
            ]}
          />
          <Facts
            title="Błędy jakości danych"
            rows={VALIDATION_KINDS.map((k) => [VALIDATION_LABEL[k], nf(stats.validation[k])] as [string, ReactNode])}
          />
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Co poprawić, żeby zyskać najwięcej" subtitle="Podpowiedzi wg wzrostu średniej kompletności">
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {suggestions.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onOpenDecisions(s.kinds)}
                  className="group flex w-full items-center gap-3 py-3 text-left"
                >
                  <span className="w-5 text-[13px] tabular-nums text-slate-400">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-950 dark:text-slate-50">{s.title}</span>
                    <span className="block text-xs text-slate-500">+{s.gain.toFixed(1)} pkt do średniej</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
            {suggestions.length === 0 && <li className="py-3 text-sm text-slate-500">Katalog jest kompletny — brak podpowiedzi.</li>}
          </ul>
        </ChartCard>
        <ChartCard title="Producenci z najsłabszą kompletnością" subtitle="Średnia kompletność (min. 5 produktów); kliknij, aby uzupełniać">
          <HBars
            data={worst.map((m) => ({ name: m.name, value: m.avgScore, color: m.avgScore < 40 ? PALETTE.rose : m.avgScore < 65 ? PALETTE.amber : PALETTE.green }))}
            unit="%"
            max={100}
            onClick={(name) => onOpenDecisions([], undefined, name)}
          />
        </ChartCard>
      </div>

      <AttributesCoverageCard products={products} onOpenDecisions={onOpenDecisions} />

      <ChartCard title="Walidacje jakości danych" subtitle="Produkty z błędami: EAN, duplikaty, ceny, tytuły — kliknij, aby poprawiać">
        <HBars
          data={VALIDATION_KINDS.map((k) => ({
            name: VALIDATION_LABEL[k],
            value: stats.validation[k],
            color: stats.validation[k] === 0 ? PALETTE.green : k === 'eanBad' || k === 'dupEan' || k === 'priceBelow' ? PALETTE.rose : PALETTE.amber,
          }))}
          onClick={(name) => {
            const k = VALIDATION_KINDS.find((x) => VALIDATION_LABEL[x] === name);
            if (k) onOpenDecisions([k]);
          }}
        />
        <p className="mt-4 text-xs text-slate-500">
          {VALIDATION_KINDS.every((k) => stats.validation[k] === 0)
            ? 'Brak wykrytych błędów jakości.'
            : 'Wyjątek „Ignoruj walidacje jakości” wyłącza produkt z tych liczników.'}
        </p>
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Magazyn
// ---------------------------------------------------------------------------------------------

function ProductRows({ rows, onOpenProduct }: { rows: { product: Product; right: string; sub?: string }[]; onOpenProduct: (p: Product) => void }) {
  if (rows.length === 0) return <p className="text-[13px] text-slate-500">Brak danych.</p>;
  return (
    <ul className="divide-y divide-slate-200 dark:divide-white/10">
      {rows.map(({ product, right, sub }) => (
        <li key={product.id}>
          <button type="button" onClick={() => onOpenProduct(product)} className="flex w-full items-center gap-3 py-2.5 text-left hover:opacity-80">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-950 dark:text-slate-50">{product.displayName || product.name}</span>
              <span className="block truncate font-mono text-[11px] text-slate-500">
                {product.sku}
                {sub ? ` · ${sub}` : ''}
              </span>
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-slate-950 dark:text-slate-50">{right}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function StockTab({ inv, onOpenProduct }: { inv: InventoryStats; onOpenProduct: (p: Product) => void }) {
  const stockData = [
    { name: 'Ze stanem', value: inv.withStock, color: PALETTE.sky },
    { name: 'Stan zero', value: inv.zeroStock, color: PALETTE.slate },
    ...(inv.negativeStock ? [{ name: 'Stan ujemny', value: inv.negativeStock, color: PALETTE.rose }] : []),
  ];
  const mfRows = inv.byManufacturer.filter((r) => r.value > 0).slice(0, 10);
  const catRows = inv.byCategory.filter((r) => r.value > 0).slice(0, 10);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Wartość (zakup netto)" value={formatMoney(inv.valuePurchase, true)} sub={formatMoney(inv.valuePurchase)} />
        <Kpi label="Wartość (sprzedaż netto)" value={formatMoney(inv.valueSale, true)} sub={`potencjał ${formatMoney(inv.valueSale - inv.valuePurchase, true)}`} />
        <Kpi label="Sztuk na stanie" value={nf(inv.units)} sub={`${nf(inv.withStock)} produktów`} />
        <Kpi label={`Niski stan (1–${LOW_STOCK_MAX})`} value={nf(inv.lowStock)} sub={`${nf(inv.manualStock)} stanów ręcznych`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Stan magazynowy" subtitle="Produkty ze stanem i bez">
          <Donut data={stockData} center={{ top: nf(inv.singles), bottom: 'produktów' }} />
        </ChartCard>
        <ChartCard title="Rozkład stanów" subtitle="Liczba produktów wg ilości sztuk na stanie" className="lg:col-span-2">
          <Columns data={inv.stockBuckets.map((b) => ({ name: b.label, value: b.count }))} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Wartość zapasu wg producentów" subtitle="Cena zakupu netto × stan; 10 największych">
          <HBars data={mfRows.map((r) => ({ name: r.name, value: r.value, display: formatMoney(r.value, true) }))} />
        </ChartCard>
        <ChartCard title="Wartość zapasu wg kategorii" subtitle="Cena zakupu netto × stan; 10 największych">
          <HBars data={catRows.map((r) => ({ name: r.name, value: r.value, display: formatMoney(r.value, true) }))} color={PALETTE.violet} />
        </ChartCard>
      </div>

      <ChartCard title="Największe zapasy" subtitle="Produkty o najwyższej wartości zapasu po cenie zakupu">
        <ProductRows
          onOpenProduct={onOpenProduct}
          rows={inv.topByValue.map((r) => ({ product: r.product, right: formatMoney(r.value), sub: `${nf(r.product.stock)} szt.` }))}
        />
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Ceny i marże
// ---------------------------------------------------------------------------------------------

function PricesTab({ inv, onOpenProduct }: { inv: InventoryStats; onOpenProduct: (p: Product) => void }) {
  const marginColors = [PALETTE.rose, PALETTE.amber, PALETTE.amber, PALETTE.sky, PALETTE.green, PALETTE.green];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Marża średnia" value={inv.withMargin ? `${oneDec(inv.avgMarginPct)}%` : '—'} sub={`${nf(inv.withMargin)} produktów z obiema cenami`} />
        <Kpi label="Marża ważona zapasem" value={inv.weightedMarginPct ? `${oneDec(inv.weightedMarginPct)}%` : '—'} sub="od wartości sprzedaży netto" />
        <Kpi label="Sprzedaż poniżej zakupu" value={nf(inv.negativeMargin)} sub="ujemna marża" />
        <Kpi label="Bez ceny zakupu / sprzedaży" value={`${nf(inv.noPurchasePrice)} / ${nf(inv.noSalePrice)}`} sub="braki do uzupełnienia" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Rozkład marż" subtitle="Liczba produktów wg marży od ceny sprzedaży netto">
          <Columns data={inv.marginBuckets.map((b, i) => ({ name: b.label, value: b.count, color: marginColors[i] }))} />
        </ChartCard>
        <ChartCard title="Przedziały cenowe" subtitle="Liczba produktów wg ceny sprzedaży brutto">
          <Columns data={inv.priceBuckets.map((b) => ({ name: b.label, value: b.count }))} color={PALETTE.violet} />
        </ChartCard>
      </div>

      <ChartCard title="Najniższe marże" subtitle="Produkty z najniższą (także ujemną) marżą — do sprawdzenia cen">
        <ProductRows
          onOpenProduct={onOpenProduct}
          rows={inv.worstMargins.map((r) => ({
            product: r.product,
            right: `${oneDec(r.marginPct)}%`,
            sub: `zakup ${formatMoney(r.product.pricePurchaseNet ?? 0)} · sprzedaż ${formatMoney(r.product.priceSaleNet ?? 0)}`,
          }))}
        />
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Zdjęcia i opisy
// ---------------------------------------------------------------------------------------------

function MediaTab({
  stats,
  inv,
  onOpenDecisions,
}: {
  stats: Stats;
  inv: InventoryStats;
  onOpenDecisions: CatalogProgressViewProps['onOpenDecisions'];
}) {
  const photoData = [
    { name: 'Ze zdjęciem', value: stats.withPhoto, color: PALETTE.green },
    { name: 'Bez zdjęcia', value: stats.total - stats.withPhoto, color: PALETTE.rose },
  ];
  const descData = [
    { name: 'Z opisem', value: inv.withDescription, color: PALETTE.sky },
    { name: 'Bez opisu', value: Math.max(0, inv.singles - inv.withDescription), color: PALETTE.slate },
  ];
  const checks = [...stats.checks].sort((a, b) => a.pct - b.pct);
  const worstPhoto = [...stats.categories]
    .filter((c) => c.count >= 5)
    .sort((a, b) => a.photoPct - b.photoPct)
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Zdjęcia" subtitle="Ile produktów ma zdjęcie">
          <Donut data={photoData} center={{ top: pctText(stats.withPhoto, stats.total), bottom: 'ze zdjęciem' }} />
        </ChartCard>
        <ChartCard title="Opisy" subtitle="Produkty z opisem (min. 30 znaków)">
          <Donut data={descData} center={{ top: pctText(inv.withDescription, inv.singles), bottom: 'z opisem' }} />
        </ChartCard>
        <ChartCard title="Katalogi" subtitle="Sklep i akcesoria">
          <Donut
            data={[
              { name: 'Sklep', value: stats.catalogs.shop, color: PALETTE.violet },
              { name: 'Akcesoria', value: stats.catalogs.accessories, color: PALETTE.teal },
            ]}
            center={{ top: nf(stats.total), bottom: 'produktów' }}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Pokrycie danych wg składnika oceny" subtitle="% produktów spełniających warunek, od najsłabszych">
          <HBars
            data={checks.map((c) => ({ name: c.label, value: c.pct, color: c.pct < 40 ? PALETTE.rose : c.pct < 75 ? PALETTE.amber : PALETTE.green }))}
            unit="%"
            max={100}
          />
        </ChartCard>
        <ChartCard title="Kategorie z najmniejszym odsetkiem zdjęć" subtitle="Kliknij kategorię, aby dodać brakujące zdjęcia">
          <HBars
            data={worstPhoto.map((c) => ({ name: c.name, value: c.photoPct, color: c.photoPct < 50 ? PALETTE.rose : PALETTE.amber }))}
            unit="%"
            max={100}
            onClick={(name) => onOpenDecisions(['photo'], name)}
          />
        </ChartCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Producenci / Kategorie
// ---------------------------------------------------------------------------------------------

function GroupTab({
  kind,
  stats,
  onOpenDecisions,
}: {
  kind: 'manufacturers' | 'categories';
  stats: Stats;
  onOpenDecisions: CatalogProgressViewProps['onOpenDecisions'];
}) {
  const [sort, setSort] = useState<'count' | 'score' | 'photo'>('count');
  const all: GroupStat[] = kind === 'manufacturers' ? stats.manufacturers : stats.categories;
  const noun = kind === 'manufacturers' ? 'producenta' : 'kategorię';
  const open = (name: string) =>
    kind === 'manufacturers' ? onOpenDecisions([], undefined, name) : onOpenDecisions([], name);

  const top = all.slice(0, 12);
  const palette = [PALETTE.sky, PALETTE.green, PALETTE.violet, PALETTE.amber, PALETTE.rose, PALETTE.teal, PALETTE.orange];
  const pie = [
    ...top.slice(0, 7).map((g, i) => ({ name: g.name, value: g.count, color: palette[i % palette.length] })),
    { name: 'Pozostałe', value: all.slice(7).reduce((s, g) => s + g.count, 0), color: PALETTE.slate },
  ].filter((d) => d.value > 0);

  const rows = useMemo(() => {
    const list = [...all];
    if (sort === 'score') list.sort((a, b) => a.avgScore - b.avgScore);
    else if (sort === 'photo') list.sort((a, b) => a.photoPct - b.photoPct);
    return list;
  }, [all, sort]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title={kind === 'manufacturers' ? 'Udział producentów' : 'Udział kategorii'} subtitle="Liczba produktów (7 największych + reszta)">
          <Donut data={pie} center={{ top: nf(all.length), bottom: kind === 'manufacturers' ? 'producentów' : 'kategorii' }} />
        </ChartCard>
        <ChartCard title="Największe — liczba produktów" subtitle="12 pozycji; kliknij, aby uzupełniać" className="lg:col-span-2">
          <HBars data={top.map((g) => ({ name: g.name, value: g.count }))} onClick={open} />
        </ChartCard>
      </div>

      <ChartCard
        title={kind === 'manufacturers' ? 'Wszyscy producenci' : 'Wszystkie kategorie'}
        subtitle={`Średnia kompletność, zdjęcia i EAN dla każdej pozycji — kliknij ${noun}, aby uzupełniać dane`}
        action={
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input-field !w-auto text-xs">
            <option value="count">Wg liczby produktów</option>
            <option value="score">Najsłabsza kompletność</option>
            <option value="photo">Najmniej zdjęć</option>
          </select>
        }
      >
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="py-2 text-left font-medium">Nazwa</th>
                <th className="py-2 text-right font-medium">Produkty</th>
                <th className="py-2 text-right font-medium">Kompletność</th>
                <th className="py-2 text-right font-medium">Zdjęcia</th>
                <th className="py-2 text-right font-medium">EAN</th>
                <th className="py-2 text-right font-medium">Słabe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/10">
              {rows.map((g) => (
                <tr key={g.name} className="cursor-pointer hover:bg-slate-200/50 dark:hover:bg-white/5" onClick={() => open(g.name)}>
                  <td className="max-w-[16rem] truncate py-2.5 font-medium text-slate-950 dark:text-slate-50">{g.name}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{g.count}</td>
                  <td className="py-2.5 text-right"><MiniMeter value={g.avgScore} /></td>
                  <td className="py-2.5 text-right"><MiniMeter value={g.photoPct} /></td>
                  <td className="py-2.5 text-right"><MiniMeter value={g.eanPct} /></td>
                  <td className="py-2.5 text-right tabular-nums text-slate-500">{g.weak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Zmiany pracowników
// ---------------------------------------------------------------------------------------------

const DAYS = 30;

function dayLabel(d: Date): string {
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'przed chwilą';
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} godz. temu`;
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' }) + ' ' + new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function ChangesTab({ products, onOpenProduct }: { products: Product[]; onOpenProduct: (p: Product) => void }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
        const all: AuditEntry[] = [];
        let before: string | undefined;
        for (let page = 0; page < 5; page++) {
          const batch = await fetchAuditLog({ since, limit: 1000, before });
          all.push(...batch);
          if (batch.length < 1000) break;
          before = batch[batch.length - 1].createdAt;
        }
        if (alive) setEntries(all);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Nie udało się pobrać zmian');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const bySku = useMemo(() => new Map(products.map((p) => [p.sku.toUpperCase(), p])), [products]);

  const data = useMemo(() => {
    const rows = (entries ?? []).filter((e) => e.action.startsWith('product.'));
    const days: SeriesPoint[] = [];
    const index = new Map<string, SeriesPoint>();
    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const point: SeriesPoint = { label: dayLabel(d), changes: 0, fixes: 0 };
      days.push(point);
      index.set(key, point);
    }
    const perUser = new Map<string, number>();
    const fixTotals = new Map<string, number>();
    for (const e of rows) {
      const point = index.get(e.createdAt.slice(0, 10));
      const row: ActivityRow = { created_at: e.createdAt, action: e.action, changes: (e.changes ?? null) as ActivityRow['changes'] };
      const f = detectFixes(row);
      const fixCount = FIX_IDS.reduce((s, id) => s + (f[id] ?? 0), 0);
      for (const id of FIX_IDS) if (f[id]) fixTotals.set(id, (fixTotals.get(id) ?? 0) + (f[id] ?? 0));
      if (point) {
        point.changes = (point.changes as number) + 1;
        point.fixes = (point.fixes as number) + fixCount;
      }
      const who = e.userLabel || 'nieznany';
      perUser.set(who, (perUser.get(who) ?? 0) + 1);
    }
    return {
      total: rows.length,
      days,
      users: [...perUser.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
      fixTotals: FIX_IDS.map((id) => ({ name: FIX_LABEL[id], value: fixTotals.get(id) ?? 0 })).filter((x) => x.value > 0),
      recent: rows.slice(0, 40),
      fixesTotal: [...fixTotals.values()].reduce((a, b) => a + b, 0),
    };
  }, [entries]);

  if (error) {
    return <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">Nie udało się pobrać zmian: {error}</p>;
  }
  if (!entries) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Wczytuję ostatnie zmiany…
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={`Zmiany produktów (${DAYS} dni)`} value={nf(data.total)} />
        <Kpi label="Uzupełnione pola" value={nf(data.fixesTotal)} sub="EAN, opis, producent, cena…" />
        <Kpi label="Aktywnych osób" value={nf(data.users.length)} />
        <Kpi label="Średnio dziennie" value={(data.total / DAYS).toFixed(1)} />
      </div>
      <p className="text-xs text-slate-500">Administrator widzi zmiany wszystkich pracowników, pozostali użytkownicy tylko własne.</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title={`Aktywność w ostatnich ${DAYS} dniach`} subtitle="Zmiany produktów dziennie i uzupełnione pola" className="lg:col-span-2">
          <Trend
            data={data.days}
            series={[
              { key: 'changes', name: 'Zmiany produktów', color: PALETTE.sky },
              { key: 'fixes', name: 'Uzupełnione pola', color: PALETTE.green },
            ]}
          />
        </ChartCard>
        <ChartCard title="Kto pracuje" subtitle="Liczba zmian produktów wg osoby">
          <HBars data={data.users} color={PALETTE.violet} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Co uzupełniono" subtitle="Rodzaje napraw danych">
          <HBars data={data.fixTotals} color={PALETTE.green} />
        </ChartCard>
        <ChartCard title="Ostatnie zmiany produktów" subtitle="Najnowsze 40 wpisów" className="lg:col-span-2">
          <ul className="max-h-[26rem] divide-y divide-slate-200 overflow-y-auto dark:divide-white/10">
            {data.recent.map((e) => {
              const product = bySku.get(e.entityId.toUpperCase());
              return (
                <li key={e.id} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {(e.userLabel || '?').slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-950 dark:text-slate-50">
                      <span className="font-medium">{e.userLabel || 'ktoś'}</span>{' '}
                      {product ? (
                        <button type="button" onClick={() => onOpenProduct(product)} className="text-left text-slate-600 hover:text-slate-950 hover:underline dark:text-slate-300 dark:hover:text-white">
                          {e.entityLabel || e.entityId}
                        </button>
                      ) : (
                        <span className="text-slate-600 dark:text-slate-300">{e.entityLabel || e.entityId}</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      <span className="font-mono">{e.entityId}</span> · {e.summary}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">{timeAgo(e.createdAt)}</span>
                </li>
              );
            })}
            {data.recent.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Brak zmian w tym okresie.</li>}
          </ul>
        </ChartCard>
      </div>
    </div>
  );
}
