import { ArrowRight, BarChart3, Building2, Camera, Clock, FolderTree, LayoutDashboard, Lightbulb, Loader2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Product, View } from '../../types';
import { computeCatalogStats, suggestNext, type GroupStat, type Suggestion } from '../../lib/catalogStats';
import { FIX_IDS, FIX_LABEL, detectFixes, type ActivityRow } from '../../lib/profileStats';
import { VALIDATION_KINDS, VALIDATION_LABEL } from '../../lib/validations';
import { attributeCoverage, getAttributes, useAttributesVersion } from '../../lib/attributes';

import { fetchAuditLog, type AuditEntry } from '../../lib/auditLog';
import { ChartCard, Columns, Donut, HBars, Kpi, PALETTE, Trend, type SeriesPoint } from './ChartCards';

type Tab = 'overview' | 'media' | 'manufacturers' | 'categories' | 'changes';

interface CatalogProgressViewProps {
  products: Product[];
  /** Otwiera Uzupełnianie danych z gotowym filtrem (rodzaje braków, kategoria, producent). */
  onOpenDecisions: (kinds?: string[], category?: string, manufacturer?: string) => void;
  onOpenProduct: (product: Product) => void;
  onOpenView: (view: View) => void;
}

const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'overview', label: 'Przegląd', icon: LayoutDashboard },
  { id: 'media', label: 'Zdjęcia i opisy', icon: Camera },
  { id: 'manufacturers', label: 'Producenci', icon: Building2 },
  { id: 'categories', label: 'Kategorie', icon: FolderTree },
  { id: 'changes', label: 'Zmiany pracowników', icon: Users },
];

const pctText = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '0%');
const nf = (n: number) => n.toLocaleString('pl-PL');

export function CatalogProgressView({ products, onOpenDecisions, onOpenProduct }: CatalogProgressViewProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const stats = useMemo(() => computeCatalogStats(products), [products]);
  const suggestions = useMemo(() => suggestNext(stats, 5), [stats]);
  const next = suggestions[0];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-300">Statystyki katalogu</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-50">Statystyki</h2>
          <p className="text-sm text-slate-400">
            Jakość danych produktów, zdjęć, opisów i producentów oraz ostatnia praca zespołu.
          </p>
        </div>
        <p className="text-xs text-slate-500">Dane z {nf(stats.total)} aktywnych produktów (bez ukrytych)</p>
      </header>

      {next && <NextStep suggestion={next} onGo={(s) => onOpenDecisions(s.kinds)} />}

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 p-1" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === id ? 'bg-brand-500/15 text-brand-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <Overview stats={stats} suggestions={suggestions} products={products} onOpenDecisions={onOpenDecisions} />}
      {tab === 'media' && <MediaTab stats={stats} onOpenDecisions={onOpenDecisions} />}
      {tab === 'manufacturers' && <GroupTab kind="manufacturers" stats={stats} onOpenDecisions={onOpenDecisions} />}
      {tab === 'categories' && <GroupTab kind="categories" stats={stats} onOpenDecisions={onOpenDecisions} />}
      {tab === 'changes' && <ChangesTab products={products} onOpenProduct={onOpenProduct} />}
    </div>
  );
}

function NextStep({ suggestion, onGo }: { suggestion: Suggestion; onGo: (s: Suggestion) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-500/40 bg-gradient-to-r from-brand-500/15 to-transparent p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 text-brand-300">
        <Lightbulb className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-300">Następny krok</p>
        <p className="text-base font-semibold text-slate-50">{suggestion.title}</p>
        <p className="text-xs text-slate-400">{suggestion.detail}</p>
      </div>
      <button
        type="button"
        onClick={() => onGo(suggestion)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
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
    <ChartCard title="Atrybuty produktów — pokrycie" subtitle="Ile produktów w zakresie atrybutu ma uzupełnioną wartość">
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
  suggestions,
  products,
  onOpenDecisions,
}: {
  products: Product[];
  stats: ReturnType<typeof computeCatalogStats>;
  suggestions: Suggestion[];
  onOpenDecisions: CatalogProgressViewProps['onOpenDecisions'];
}) {
  const levelData = [
    { name: 'Bogaty (85+)', value: stats.levels.rich, color: PALETTE.green },
    { name: 'Dobry (65–84)', value: stats.levels.good, color: PALETTE.sky },
    { name: 'Średni (40–64)', value: stats.levels.fair, color: PALETTE.amber },
    { name: 'Słaby (<40)', value: stats.levels.weak, color: PALETTE.rose },
  ];
  const histogram = stats.histogram.map((v, i) => ({
    name: i === 9 ? '90–100' : `${i * 10}–${i * 10 + 9}`,
    value: v,
    color: i < 4 ? PALETTE.rose : i < 6 ? PALETTE.amber : i < 8 ? PALETTE.sky : PALETTE.green,
  }));
  const worst = [...stats.manufacturers].filter((m) => m.count >= 5).sort((a, b) => a.avgScore - b.avgScore).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Produkty" value={nf(stats.total)} sub={`${nf(stats.catalogs.shop)} sklep · ${nf(stats.catalogs.accessories)} akcesoria`} />
        <Kpi label="Śr. kompletność" value={`${stats.avgScore}%`} tone="text-brand-300" sub="0–100 pkt" />
        <Kpi label="Ze zdjęciem" value={pctText(stats.withPhoto, stats.total)} sub={`${nf(stats.total - stats.withPhoto)} bez zdjęcia`} tone="text-sky-300" />
        <Kpi label="Z EAN" value={pctText(stats.withEan, stats.total)} sub={`${nf(stats.total - stats.withEan)} bez EAN`} tone="text-violet-300" />
        <Kpi label="Z producentem" value={pctText(stats.withManufacturer, stats.total)} sub={`${nf(stats.total - stats.withManufacturer)} bez`} tone="text-amber-300" />
        <Kpi label="Z ceną" value={pctText(stats.withPrice, stats.total)} sub={`${nf(stats.total - stats.withPrice)} bez ceny`} tone="text-teal-300" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Poziomy kompletności" subtitle="Podział produktów wg oceny wiedzy o produkcie">
          <Donut data={levelData} center={{ top: `${stats.avgScore}%`, bottom: 'średnio' }} />
        </ChartCard>
        <ChartCard title="Rozkład kompletności" subtitle="Ile produktów w każdym przedziale punktów" className="lg:col-span-2">
          <Columns data={histogram} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Co poprawić, żeby zyskać najwięcej" subtitle="Podpowiedzi wg wzrostu średniej kompletności">
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold text-slate-300">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-100">{s.title}</span>
                  <span className="block text-[11px] text-slate-500">+{s.gain.toFixed(1)} pkt do średniej</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenDecisions(s.kinds)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Otwórz <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {suggestions.length === 0 && <li className="text-sm text-slate-400">Katalog jest kompletny — brak podpowiedzi.</li>}
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
        <p className="mt-1 text-[11px] text-slate-500">
          {VALIDATION_KINDS.every((k) => stats.validation[k] === 0)
            ? 'Brak wykrytych błędów jakości — świetnie.'
            : 'Wyjątek „Ignoruj walidacje jakości” wyłącza produkt z tych liczników.'}
        </p>
      </ChartCard>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Zdjęcia i opisy
// ---------------------------------------------------------------------------------------------

function MediaTab({
  stats,
  onOpenDecisions,
}: {
  stats: ReturnType<typeof computeCatalogStats>;
  onOpenDecisions: CatalogProgressViewProps['onOpenDecisions'];
}) {
  const photoData = [
    { name: 'Ze zdjęciem', value: stats.withPhoto, color: PALETTE.green },
    { name: 'Bez zdjęcia', value: stats.total - stats.withPhoto, color: PALETTE.rose },
  ];
  const stockData = [
    { name: 'Ze stanem', value: stats.inStock, color: PALETTE.sky },
    { name: 'Stan zero', value: stats.zeroStock, color: PALETTE.slate },
  ];
  const checks = [...stats.checks].sort((a, b) => a.pct - b.pct);
  const worstPhoto = [...stats.categories]
    .filter((c) => c.count >= 5)
    .sort((a, b) => a.photoPct - b.photoPct)
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Zdjęcia" subtitle="Ile produktów ma zdjęcie">
          <Donut data={photoData} center={{ top: pctText(stats.withPhoto, stats.total), bottom: 'ze zdjęciem' }} />
        </ChartCard>
        <ChartCard title="Stan magazynowy" subtitle="Produkty ze stanem i bez">
          <Donut data={stockData} center={{ top: nf(stats.inStock), bottom: 'ze stanem' }} />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Pokrycie danych wg składnika oceny" subtitle="% produktów, które spełniają dany warunek (od najsłabszych)">
          <HBars
            data={checks.map((c) => ({ name: c.label.length > 22 ? c.label.slice(0, 21) + '…' : c.label, value: c.pct, color: c.pct < 40 ? PALETTE.rose : c.pct < 75 ? PALETTE.amber : PALETTE.green }))}
            unit="%"
            max={100}
            height={Math.max(220, checks.length * 28 + 20)}
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
  stats: ReturnType<typeof computeCatalogStats>;
  onOpenDecisions: CatalogProgressViewProps['onOpenDecisions'];
}) {
  const [sort, setSort] = useState<'count' | 'score' | 'photo'>('count');
  const all: GroupStat[] = kind === 'manufacturers' ? stats.manufacturers : stats.categories;
  const noun = kind === 'manufacturers' ? 'producenta' : 'kategorię';
  const open = (name: string) =>
    kind === 'manufacturers' ? onOpenDecisions([], undefined, name) : onOpenDecisions([], name);

  const top = all.slice(0, 12);
  const palette = [PALETTE.green, PALETTE.sky, PALETTE.violet, PALETTE.amber, PALETTE.rose, PALETTE.teal, PALETTE.orange, PALETTE.slate];
  const pie = [
    ...top.slice(0, 7).map((g, i) => ({ name: g.name, value: g.count, color: palette[i % palette.length] })),
    { name: 'Pozostałe', value: all.slice(7).reduce((s, g) => s + g.count, 0), color: '#334155' },
  ].filter((d) => d.value > 0);

  const rows = useMemo(() => {
    const list = [...all];
    if (sort === 'score') list.sort((a, b) => a.avgScore - b.avgScore);
    else if (sort === 'photo') list.sort((a, b) => a.photoPct - b.photoPct);
    return list;
  }, [all, sort]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title={kind === 'manufacturers' ? 'Udział producentów' : 'Udział kategorii'} subtitle="Liczba produktów (7 największych + reszta)">
          <Donut data={pie} center={{ top: nf(all.length), bottom: kind === 'manufacturers' ? 'producentów' : 'kategorii' }} />
        </ChartCard>
        <ChartCard title="Największe — liczba produktów" subtitle="12 pozycji; kliknij, aby uzupełniać" className="lg:col-span-2">
          <HBars data={top.map((g) => ({ name: g.name, value: g.count }))} color={PALETTE.sky} onClick={open} />
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
            <thead className="sticky top-0 bg-slate-900 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 text-left font-semibold">Nazwa</th>
                <th className="py-2 text-right font-semibold">Prod.</th>
                <th className="py-2 text-right font-semibold">Kompl.</th>
                <th className="py-2 text-right font-semibold">Zdjęcia</th>
                <th className="py-2 text-right font-semibold">EAN</th>
                <th className="py-2 text-right font-semibold">Słabe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((g) => (
                <tr key={g.name} className="cursor-pointer hover:bg-slate-800/50" onClick={() => open(g.name)}>
                  <td className="max-w-[16rem] truncate py-2 font-medium text-slate-100">{g.name}</td>
                  <td className="py-2 text-right tabular-nums text-slate-300">{g.count}</td>
                  <td className="py-2 text-right"><Meter value={g.avgScore} /></td>
                  <td className="py-2 text-right"><Meter value={g.photoPct} /></td>
                  <td className="py-2 text-right"><Meter value={g.eanPct} /></td>
                  <td className="py-2 text-right tabular-nums text-slate-400">{g.weak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

function Meter({ value }: { value: number }) {
  const color = value < 40 ? 'bg-rose-500' : value < 70 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-800">
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      <span className="w-9 text-right text-xs tabular-nums text-slate-300">{value}%</span>
    </span>
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
    return <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Nie udało się pobrać zmian: {error}</p>;
  }
  if (!entries) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Wczytuję ostatnie zmiany…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={`Zmiany produktów (${DAYS} dni)`} value={nf(data.total)} />
        <Kpi label="Uzupełnione pola" value={nf(data.fixesTotal)} tone="text-brand-300" sub="EAN, opis, producent, cena…" />
        <Kpi label="Aktywnych osób" value={nf(data.users.length)} tone="text-sky-300" />
        <Kpi label="Średnio dziennie" value={(data.total / DAYS).toFixed(1)} tone="text-violet-300" />
      </div>
      <p className="text-[11px] text-slate-500">
        Administrator widzi zmiany wszystkich pracowników, pozostali użytkownicy tylko własne.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
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

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Co uzupełniono" subtitle="Rodzaje napraw danych">
          <HBars data={data.fixTotals} color={PALETTE.green} />
          {data.fixTotals.length === 0 && <p className="text-sm text-slate-500">Brak uzupełnień w tym okresie.</p>}
        </ChartCard>
        <ChartCard
          title="Ostatnie zmiany produktów"
          subtitle="Najnowsze 40 wpisów"
          className="lg:col-span-2"
          action={<Clock className="h-4 w-4 text-slate-500" />}
        >
          <ul className="max-h-[26rem] divide-y divide-slate-800 overflow-y-auto">
            {data.recent.map((e) => {
              const product = bySku.get(e.entityId.toUpperCase());
              return (
                <li key={e.id} className="flex items-start gap-3 py-2">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold uppercase text-slate-300">
                    {(e.userLabel || '?').slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200">
                      <span className="font-semibold">{e.userLabel || 'ktoś'}</span>{' '}
                      <span className="text-slate-400">zmienił(a)</span>{' '}
                      {product ? (
                        <button type="button" onClick={() => onOpenProduct(product)} className="font-semibold text-brand-300 hover:underline">
                          {e.entityLabel || e.entityId}
                        </button>
                      ) : (
                        <span className="font-semibold">{e.entityLabel || e.entityId}</span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      <span className="font-mono">{e.entityId}</span> · {e.summary}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(e.createdAt)}</span>
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
