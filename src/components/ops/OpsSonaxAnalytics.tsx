import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Ban,
  CheckSquare,
  Download,
  FileText,
  GitMerge,
  Hand,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPricePln } from '../../lib/format';
import { downloadCsv, stampFile } from '../../lib/exportReport';
import { showToast } from '../../lib/toast';
import {
  fetchSonaxReconcileReport,
  filterAcquisitionClients,
  filterAcquisitionInvoices,
  type SonaxAcquisitionClient,
  type SonaxAcquisitionInvoice,
  type SonaxAcquisitionReport,
  type SonaxReconcileReport,
  type SonaxOverlapExcludedReport,
} from '../../lib/sonaxReconcile';
import {
  computeSonaxView,
  loadSonaxCustomKeys,
  loadSonaxViewMode,
  saveSonaxCustomKeys,
  saveSonaxViewMode,
  sonaxViewModeLabel,
  type SonaxComputedView,
  type SonaxViewMode,
} from '../../lib/sonaxViewState';
import { ContextHelp } from '../ContextHelp';

type SonaxTab = 'summary' | 'clients' | 'invoices' | 'excluded';

interface OpsSonaxAnalyticsProps {
  onBack: () => void;
  embedded?: boolean;
}

const VIEW_MODES: {
  id: SonaxViewMode;
  label: string;
  short: string;
  icon: typeof ShieldCheck;
  tone: string;
}[] = [
  {
    id: 'strict',
    label: 'Standard',
    short: 'Tylko czysty Sonax',
    icon: ShieldCheck,
    tone: 'emerald',
  },
  {
    id: 'with_overlap',
    label: 'Z mieszanymi',
    short: 'Dodaj wszystkich overlap',
    icon: GitMerge,
    tone: 'amber',
  },
  {
    id: 'custom',
    label: 'Własny wybór',
    short: 'Zaznaczasz ręcznie',
    icon: Hand,
    tone: 'sky',
  },
];

export function OpsSonaxAnalytics({ onBack, embedded = false }: OpsSonaxAnalyticsProps) {
  const [report, setReport] = useState<SonaxReconcileReport | null>(null);
  const [acq, setAcq] = useState<SonaxAcquisitionReport | null>(null);
  const [excluded, setExcluded] = useState<SonaxOverlapExcludedReport | null>(null);
  const [viewMode, setViewMode] = useState<SonaxViewMode>(() => loadSonaxViewMode());
  const [customKeys, setCustomKeys] = useState<Set<string>>(() => loadSonaxCustomKeys());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<SonaxTab>('summary');
  const [query, setQuery] = useState('');
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null);

  useEffect(() => {
    saveSonaxViewMode(viewMode);
  }, [viewMode]);

  useEffect(() => {
    saveSonaxCustomKeys(customKeys);
  }, [customKeys]);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchSonaxReconcileReport(force);
      if (loaded.summary.waproDataMissing || !loaded.acquisition) {
        throw new Error('Brak danych WAPRO — uruchom eksport z Mag i reconcile:sonax');
      }
      setReport(loaded);
      setAcq(loaded.acquisition);
      setExcluded(loaded.excludedOverlap ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd wczytywania');
      setReport(null);
      setAcq(null);
      setExcluded(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const computed: SonaxComputedView | null = useMemo(() => {
    if (!acq) return null;
    return computeSonaxView(acq, excluded, viewMode, customKeys);
  }, [acq, excluded, viewMode, customKeys]);

  const methodology = useMemo(() => {
    if (!acq || !excluded) return null;
    const stdNet = acq.summary.waproNetPln;
    const overlapNet = excluded.summary.waproNetPln;
    const topOverlap = [...excluded.clients].sort((a, b) => b.waproNetPln - a.waproNetPln);
    const top2 = topOverlap.slice(0, 2);
    const top2Net = top2.reduce((sum, c) => sum + c.waproNetPln, 0);
    const sonaxHistGross =
      report?.segments?.find((seg) => seg.segment === 'from_sonax')?.sonaxGrossPln ?? 0;
    return {
      stdNet,
      stdClients: acq.summary.migratedClients,
      stdInvoices: acq.summary.waproInvoices,
      overlapNet,
      overlapClients: excluded.summary.clients,
      allSonaxNet: stdNet + overlapNet,
      allSonaxClients: acq.summary.migratedClients + excluded.summary.clients,
      top2Net,
      top2PlusStd: stdNet + top2Net,
      top2Labels: top2.map((c) => c.displayName),
      bruttoEstimate: stdNet * 1.23,
      sonaxHistGross,
      totalWapro: acq.summary.totalWaproNetPln,
    };
  }, [acq, excluded, report]);

  const clients = useMemo(
    () => filterAcquisitionClients(computed?.clients ?? [], query),
    [computed, query],
  );

  const excludedClients = useMemo(
    () => filterAcquisitionClients(excluded?.clients ?? [], query),
    [excluded, query],
  );

  const invoices = useMemo(
    () =>
      filterAcquisitionInvoices(
        computed?.invoices ?? [],
        tab === 'invoices' ? query : '',
        selectedClientKey ?? undefined,
      ),
    [computed, query, tab, selectedClientKey],
  );

  const selectedClient = useMemo(
    () => computed?.clients.find((c) => c.clientKey === selectedClientKey) ?? null,
    [computed, selectedClientKey],
  );

  const s = computed?.summary;
  const ex = excluded?.summary;
  const kenochemBeforeMissing =
    report?.summary.kenochemBeforeDataMissing ?? acq?.kenochemBeforeDataMissing ?? false;

  function setMode(mode: SonaxViewMode) {
    setViewMode(mode);
    if (mode !== 'custom') setSelectedClientKey(null);
  }

  function toggleCustomClient(key: string) {
    setViewMode('custom');
    setCustomKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function includeAllOverlap() {
    if (!excluded?.clients.length) return;
    setViewMode('custom');
    setCustomKeys(new Set(excluded.clients.map((c) => c.clientKey)));
    showToast(`Dodano ${excluded.clients.length} klientów mieszanych do widoku`, 'ok');
  }

  function clearCustomSelection() {
    setCustomKeys(new Set());
    showToast('Wyczyszczono ręczny wybór', 'ok');
  }

  function exportClients() {
    if (!clients.length) return;
    downloadCsv(
      stampFile('sonax_klienci_widok'),
      ['NIP', 'Klient', 'FV u nas', 'Netto PLN', 'Brutto PLN', 'Od', 'Do', 'Segment'],
      clients.map((c) => [
        c.nip,
        c.displayName,
        c.waproInvoiceCount,
        c.waproNetPln,
        c.waproGrossPln,
        c.waproFirstDate ?? '',
        c.waproLastDate ?? '',
        c.segment,
      ]),
    );
    showToast('Eksport klientów CSV', 'ok');
  }

  function exportInvoices() {
    if (!invoices.length) return;
    downloadCsv(
      stampFile('sonax_faktury_widok'),
      ['Data', 'Numer', 'NIP', 'Klient', 'Netto PLN', 'Brutto PLN'],
      invoices.map((i) => [i.date, i.number, i.nip, i.displayName, i.netPln, i.grossPln]),
    );
    showToast('Eksport faktur CSV', 'ok');
  }

  function openClientInvoices(client: SonaxAcquisitionClient) {
    setSelectedClientKey(client.clientKey);
    setQuery('');
    setTab('invoices');
  }

  return (
    <div className="ops-sales-analytics mx-auto w-full max-w-[1600px] space-y-5 px-1 pb-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        {embedded ? 'Własne zbiory' : 'Operacje'}
      </button>

      <header className="ops-sonax-header rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 dark:border-emerald-500/30 dark:from-emerald-500/10 dark:to-slate-950 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                Przejęcie Sonax · od 01.03.2026
              </p>
              <ContextHelp id="opsSonax" />
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-slate-50">
              Przychód od klientów przeszłych z Sonax
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Domyślnie liczymy tylko klientów, którzy mieli Sonax, a u Kenochem nie kupowali przed
              marcem. Możesz zmienić tryb widoku i dodać wybranych „mieszanych”.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Odśwież
            </button>
            <button
              type="button"
              onClick={tab === 'invoices' ? exportInvoices : exportClients}
              disabled={!(tab === 'invoices' ? invoices.length : clients.length)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              Eksport CSV
            </button>
          </div>
        </div>
      </header>

      {kenochemBeforeMissing ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Brak pliku <code className="text-amber-900 dark:text-amber-200">wapro-kenochem-przed.tsv</code> — overlap
          nie jest wykluczany. Uruchom eksport na serwerze i{' '}
          <code className="text-amber-900 dark:text-amber-200">npm run reconcile:sonax</code>.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading && !acq ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Wczytywanie…
        </div>
      ) : null}

      {acq && computed && s ? (
        <>
          <section className="grid gap-2 sm:grid-cols-3">
            <LegendChip
              icon={UserCheck}
              label="Czysty Sonax"
              hint="Subiekt przed marcem, u nas od marca, bez FV Kenochem wcześniej"
              tone="emerald"
            />
            <LegendChip
              icon={GitMerge}
              label="Mieszany (overlap)"
              hint="Byli u Kenochem i u Sonax — domyślnie poza KPI"
              tone="amber"
            />
            <LegendChip
              icon={FileText}
              label="Faktury WAPRO"
              hint="Dokumenty od 01.03.2026 w systemie Kenochem (Mag)"
              tone="slate"
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">Tryb widoku sumy</span>
              <ContextHelp id="opsSonaxViewMode" />
              <span className="ml-auto text-xs text-slate-500">{sonaxViewModeLabel(viewMode)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {VIEW_MODES.map((m) => {
                const Icon = m.icon;
                const active = viewMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`inline-flex min-w-[140px] flex-1 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition sm:max-w-[220px] ${
                      active
                        ? m.tone === 'emerald'
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-500/50 dark:bg-emerald-500/15 dark:text-emerald-100'
                          : m.tone === 'amber'
                            ? 'border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100'
                            : 'border-sky-400 bg-sky-50 text-sky-950 dark:border-sky-500/50 dark:bg-sky-500/15 dark:text-sky-100'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4 shrink-0" />
                      {m.label}
                    </span>
                    <span className="text-[11px] leading-snug opacity-80">{m.short}</span>
                  </button>
                );
              })}
            </div>
            {viewMode === 'custom' ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                <span className="text-slate-500">
                  Ręcznie dodani:{' '}
                  <strong className="text-sky-800 dark:text-sky-300">{customKeys.size}</strong> klientów mieszanych
                </span>
                <button
                  type="button"
                  onClick={includeAllOverlap}
                  className="rounded-lg border border-amber-400 bg-amber-50 px-2.5 py-1 font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
                >
                  Zaznacz wszystkich mieszanych
                </button>
                <button
                  type="button"
                  onClick={clearCustomSelection}
                  disabled={customKeys.size === 0}
                  className="rounded-lg border border-slate-700 px-2.5 py-1 font-medium text-slate-400 hover:text-slate-200 disabled:opacity-40"
                >
                  Wyczyść wybór
                </button>
                <button
                  type="button"
                  onClick={() => setTab('excluded')}
                  className="rounded-lg border border-slate-700 px-2.5 py-1 font-medium text-slate-300 hover:bg-slate-800"
                >
                  Otwórz listę wykluczonych →
                </button>
              </div>
            ) : null}
            {viewMode !== 'strict' && s.addedOverlapClients > 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                +{s.addedOverlapClients} klientów mieszanych ·{' '}
                {formatPricePln(s.addedOverlapNetPln)} netto dodane do sumy
              </p>
            ) : null}
          </section>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile
              icon={Wallet}
              label="Obrot netto (widok)"
              value={formatPricePln(s.netPln)}
              hint={`${s.invoiceCount} faktur · ${s.shareOfWaproPct}% całego WAPRO od marca`}
              helpId="opsSonaxKpiNet"
              highlight
            />
            <KpiTile
              icon={Users}
              label="Klienci w sumie"
              value={String(s.clientCount)}
              hint={`${s.clientsWithNip} z NIP`}
              helpId="opsSonaxKpiClients"
            />
            <KpiTile
              icon={Ban}
              label="Wykluczeni (overlap)"
              value={ex ? String(ex.clients) : '—'}
              hint={
                ex
                  ? `${formatPricePln(ex.waproNetPln)} netto · poza standardem`
                  : 'brak danych overlap'
              }
              helpId="opsSonaxKpiOverlap"
              muted
            />
            <KpiTile
              icon={TrendingUp}
              label="Całe WAPRO od marca"
              value={formatPricePln(s.totalWaproNetPln)}
              hint="wszyscy klienci Kenochem"
              helpId="opsSonaxKpiContext"
              muted
            />
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-1">
            <TabButton active={tab === 'summary'} onClick={() => { setTab('summary'); setSelectedClientKey(null); }}>
              Podsumowanie
            </TabButton>
            <TabButton active={tab === 'clients'} onClick={() => { setTab('clients'); setSelectedClientKey(null); }}>
              <Users className="h-4 w-4" />
              Klienci ({s.clientCount})
            </TabButton>
            <TabButton active={tab === 'invoices'} onClick={() => setTab('invoices')}>
              <FileText className="h-4 w-4" />
              Faktury ({s.invoiceCount})
            </TabButton>
            {excluded ? (
              <TabButton active={tab === 'excluded'} onClick={() => { setTab('excluded'); setSelectedClientKey(null); }}>
                <Ban className="h-4 w-4" />
                Wykluczeni ({excluded.summary.clients})
              </TabButton>
            ) : null}
          </div>

          {tab !== 'summary' ? (
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    tab === 'clients' || tab === 'excluded'
                      ? 'Szukaj klienta lub NIP…'
                      : 'Szukaj faktury, klienta, NIP…'
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 text-sm text-slate-100"
                />
              </label>
              {selectedClient ? (
                <button
                  type="button"
                  onClick={() => setSelectedClientKey(null)}
                  className="rounded-xl border border-emerald-400 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                >
                  Filtr: {selectedClient.displayName.slice(0, 40)} ×
                </button>
              ) : null}
            </div>
          ) : null}

          {tab === 'summary' ? (
            <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Obrót miesięczny (widok)</h3>
                  <ContextHelp id="opsSonaxChart" />
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  WAPRO Kenochem od 01.03.2026 · {sonaxViewModeLabel(viewMode)}
                </p>
                <div className="h-72 ops-sales-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={computed.monthlyWapro}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8 }}
                        wrapperClassName="ops-sales-chart-tooltip"
                        formatter={(v: number) => formatPricePln(v)}
                      />
                      <Bar dataKey="netPln" fill="#10b981" name="Netto PLN" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-4">
                {methodology ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">
                        Porównanie metod liczenia
                      </h3>
                      <ContextHelp id="opsSonaxMethodology" />
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-slate-600 dark:text-slate-500">
                      Jeśli biuro liczyło ręcznie ~200 tys., najczęściej chodzi o standard (
                      {formatPricePln(methodology.stdNet)}) plus 1–2 największych klientów mieszanych —
                      nie o pełny overlap (~561 tys.).
                    </p>
                    <ul className="space-y-2 text-sm">
                      <MethodologyRow
                        label="Standard (czysty Sonax, bez overlap)"
                        value={formatPricePln(methodology.stdNet)}
                        detail={`${methodology.stdClients} kl. · ${methodology.stdInvoices} FV · netto WAPRO od 03/2026`}
                        tone="highlight"
                      />
                      <MethodologyRow
                        label="Standard + 2 największych mieszanych"
                        value={formatPricePln(methodology.top2PlusStd)}
                        detail={`+ ${methodology.top2Labels.map((n) => n.slice(0, 28)).join(', ')}`}
                        tone="warn"
                      />
                      <MethodologyRow
                        label="Wszyscy Sonax z WAPRO (bez filtra Kenochem przed marcem)"
                        value={formatPricePln(methodology.allSonaxNet)}
                        detail={`${methodology.allSonaxClients} kl. · tryb „Z mieszanymi”`}
                        tone="muted"
                      />
                      <MethodologyRow
                        label="Historia Subiekt (przed marcem, segment from_sonax)"
                        value={formatPricePln(methodology.sonaxHistGross)}
                        detail="Inna metryka — obrót u Sonax, nie u Kenochem; nie sumuj z WAPRO"
                        tone="muted"
                      />
                      <MethodologyRow
                        label="Standard × 1,23 (gdyby liczyć brutto z VAT)"
                        value={formatPricePln(methodology.bruttoEstimate)}
                        detail="W eksporcie Mag brutto ≈ netto — VAT nie tłumaczy ~200 tys."
                        tone="muted"
                      />
                    </ul>
                    <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800">
                      <strong className="text-slate-700 dark:text-slate-400">Nie wdrożono (faza 2):</strong>{' '}
                      obrót tylko z pozycji FV z towarami Sonax (SKU), klienci „kenochem_new” kupujący
                      wyłącznie Sonax, korekty poza eksportem Mag.
                    </p>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Skrót — co tu widać</h3>
                  <ul className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex gap-2">
                      <UserCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                      <span>
                        <strong className="text-slate-900 dark:text-slate-200">Standard</strong> — tylko klienci z
                        Sonax, którzy wcześniej nie mieli FV u Kenochem.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <GitMerge className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                      <span>
                        <strong className="text-slate-900 dark:text-slate-200">Mieszani</strong> — np. MOTOZBYT:
                        Subiekt + Kenochem przed marcem — możesz ich dodać do sumy.
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <Hand className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-400" />
                      <span>
                        <strong className="text-slate-900 dark:text-slate-200">Własny wybór</strong> — zaznaczasz
                        pojedynczych klientów z zakładki Wykluczeni.
                      </span>
                    </li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Top 5 klientów (widok)</h3>
                  <ul className="mt-3 space-y-2">
                    {computed.clients.slice(0, 5).map((c) => (
                      <li key={c.clientKey}>
                        <button
                          type="button"
                          onClick={() => openClientInvoices(c)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800/80"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <SegmentBadge segment={c.segment} />
                            <span className="truncate text-slate-800 dark:text-slate-200">{c.displayName}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-emerald-800 dark:text-emerald-300">
                            {formatPricePln(c.waproNetPln)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'clients' ? (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
              <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-500">
                {clients.length} klientów w aktualnym widoku · kliknij wiersz → faktury
              </div>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-950 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Typ</th>
                      <th className="px-4 py-3">Klient</th>
                      <th className="px-4 py-3">NIP</th>
                      <th className="px-4 py-3 text-right">FV</th>
                      <th className="px-4 py-3 text-right">Netto</th>
                      <th className="px-4 py-3">Okres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <ClientRow key={c.clientKey} client={c} onOpen={() => openClientInvoices(c)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {tab === 'excluded' && excluded ? (
            <section className="rounded-2xl border border-amber-300 bg-white dark:border-amber-500/30 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3 text-xs text-amber-900 dark:border-slate-800 dark:text-amber-200/80">
                <span>
                  {excludedClients.length} wykluczonych · overlap ·{' '}
                  {formatPricePln(excluded.summary.waproNetPln)} netto
                </span>
                <ContextHelp id="opsSonaxExcluded" />
                <button
                  type="button"
                  onClick={includeAllOverlap}
                  className="ml-auto rounded-lg border border-amber-400 px-2 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-100 dark:hover:bg-amber-500/10"
                >
                  Dodaj wszystkich do sumy
                </button>
              </div>
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-950 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <span className="sr-only">W sumie</span>
                      </th>
                      <th className="px-4 py-3">Klient</th>
                      <th className="px-4 py-3">NIP</th>
                      <th className="px-4 py-3 text-right">FV</th>
                      <th className="px-4 py-3 text-right">Netto</th>
                      <th className="px-4 py-3">Okres</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excludedClients.map((c) => (
                      <ExcludedClientRow
                        key={c.clientKey}
                        client={c}
                        included={customKeys.has(c.clientKey)}
                        onToggle={() => toggleCustomClient(c.clientKey)}
                        onOpen={() => openClientInvoices(c)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {tab === 'invoices' ? (
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-4 py-3 text-xs text-slate-500">
                <span>
                  {invoices.length} faktur
                  {selectedClient ? ` · ${selectedClient.displayName}` : ''}
                  {invoices.length === s.invoiceCount ? ' · pełna lista widoku' : ''}
                </span>
                <ContextHelp id="opsSonaxInvoices" />
              </div>
              <div className="max-h-[640px] overflow-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-950 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Numer</th>
                      <th className="px-4 py-3">Klient</th>
                      <th className="px-4 py-3">NIP</th>
                      <th className="px-4 py-3 text-right">Netto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, idx) => (
                      <InvoiceRow key={`${inv.number}-${inv.date}-${idx}`} invoice={inv} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function MethodologyRow({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'highlight' | 'warn' | 'muted';
}) {
  const cls =
    tone === 'highlight'
      ? 'ops-sonax-method-row--highlight border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5'
      : tone === 'warn'
        ? 'ops-sonax-method-row--warn border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5'
        : 'ops-sonax-method-row--muted border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40';
  return (
    <li className={`rounded-xl border px-3 py-2.5 ${cls}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-slate-800 dark:text-slate-300">{label}</span>
        <span className="font-semibold tabular-nums text-slate-950 dark:text-slate-100">{value}</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-500">{detail}</p>
    </li>
  );
}

function LegendChip({
  icon: Icon,
  label,
  hint,
  tone,
}: {
  icon: typeof UserCheck;
  label: string;
  hint: string;
  tone: 'emerald' | 'amber' | 'slate';
}) {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/5 dark:text-emerald-200'
      : tone === 'amber'
        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/5 dark:text-amber-200'
        : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300';
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${cls}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/30 bg-white/80 dark:bg-black/20">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-xs font-semibold">{label}</div>
        <div className="mt-0.5 text-[11px] leading-snug opacity-75">{hint}</div>
      </div>
    </div>
  );
}

function SegmentBadge({ segment }: { segment: string }) {
  const overlap = segment.startsWith('overlap');
  if (overlap) {
    return (
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
        title="Klient mieszany (overlap)"
      >
        <GitMerge className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
      title="Czysty Sonax"
    >
      <UserCheck className="h-3.5 w-3.5" />
    </span>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-t-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? 'border border-b-0 border-slate-200 bg-white text-emerald-800 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300'
          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  hint,
  helpId,
  highlight = false,
  muted = false,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
  helpId: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  const cls = highlight
    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
    : muted
      ? 'border-slate-200 bg-slate-50 opacity-95 dark:border-slate-800/80 dark:bg-slate-950/40'
      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50';
  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-600/80 bg-slate-950/60">
            <Icon className="h-3.5 w-3.5 text-slate-400" />
          </span>
          {label}
        </div>
        <ContextHelp id={helpId} />
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${highlight ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-950 dark:text-slate-50'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function ClientRow({
  client: c,
  onOpen,
}: {
  client: SonaxAcquisitionClient;
  onOpen: () => void;
}) {
  return (
    <tr
      className="cursor-pointer border-t border-slate-800/80 hover:bg-emerald-500/5"
      onClick={onOpen}
    >
      <td className="px-4 py-2.5">
        <SegmentBadge segment={c.segment} />
      </td>
      <td className="max-w-[280px] truncate px-4 py-2.5 font-medium text-slate-100" title={c.displayName}>
        {c.displayName}
      </td>
      <td className="px-4 py-2.5 tabular-nums text-slate-400">{c.nip || '—'}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{c.waproInvoiceCount}</td>
      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-emerald-800 dark:text-emerald-300">
        {formatPricePln(c.waproNetPln)}
      </td>
      <td className="px-4 py-2.5 text-xs tabular-nums text-slate-500">
        {c.waproFirstDate ?? '—'} → {c.waproLastDate ?? '—'}
      </td>
    </tr>
  );
}

function ExcludedClientRow({
  client: c,
  included,
  onToggle,
  onOpen,
}: {
  client: SonaxAcquisitionClient;
  included: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <tr className="border-t border-slate-800/80 hover:bg-amber-500/5">
      <td className="px-4 py-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="inline-flex items-center text-amber-800 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
          title={included ? 'Usuń z sumy' : 'Dodaj do sumy (tryb własny)'}
        >
          {included ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-slate-600" />}
        </button>
      </td>
      <td
        className="max-w-[280px] cursor-pointer truncate px-4 py-2.5 font-medium text-slate-100"
        title={c.displayName}
        onClick={onOpen}
      >
        {c.displayName}
      </td>
      <td className="px-4 py-2.5 tabular-nums text-slate-400">{c.nip || '—'}</td>
      <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{c.waproInvoiceCount}</td>
      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-amber-900 dark:text-amber-200/90">
        {formatPricePln(c.waproNetPln)}
      </td>
      <td
        className="cursor-pointer px-4 py-2.5 text-xs tabular-nums text-slate-500"
        onClick={onOpen}
      >
        {c.waproFirstDate ?? '—'} → {c.waproLastDate ?? '—'}
      </td>
    </tr>
  );
}

function InvoiceRow({ invoice: i }: { invoice: SonaxAcquisitionInvoice }) {
  return (
    <tr className="border-t border-slate-800/80 hover:bg-slate-900/40">
      <td className="px-4 py-2 tabular-nums text-slate-300">{i.date}</td>
      <td className="px-4 py-2 text-slate-400">{i.number}</td>
      <td className="max-w-[240px] truncate px-4 py-2 text-slate-200" title={i.displayName}>
        {i.displayName}
      </td>
      <td className="px-4 py-2 tabular-nums text-slate-500">{i.nip || '—'}</td>
      <td className="px-4 py-2 text-right tabular-nums text-emerald-800 dark:text-emerald-300">{formatPricePln(i.netPln)}</td>
    </tr>
  );
}

export function SonaxWorkspaceTile({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-4 text-left transition hover:border-emerald-400 dark:border-emerald-500/40 dark:from-emerald-500/10 dark:to-slate-900/80 dark:hover:border-emerald-400/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-950 dark:text-slate-50">Sonax — klienci z Sonax u nas</span>
              <ContextHelp id="opsSonax" />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              ROI przejęcia z możliwością dodania klientów mieszanych. Ikony i kółka pomocy przy
              każdej liczbie.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-lg bg-emerald-600/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
          Wbudowane
        </span>
      </div>
    </button>
  );
}
