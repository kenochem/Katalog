import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  addFinanceExpense,
  getChannels,
  getMergedFinanceData,
  getMonthSources,
  listKnownSourceNames,
  removeFinanceExpense,
  suggestNextMonth,
  upsertFinanceMonth,
  type FinanceCostArea,
} from '../lib/financeStore';
import { formatPricePln } from '../lib/format';
import { downloadCsv, stampFile } from '../lib/exportReport';
import { showToast } from '../lib/toast';

const INPUT_CLS =
  'w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500 focus:outline-none';

const MONTH_PL = [
  'sty',
  'lut',
  'mar',
  'kwi',
  'maj',
  'cze',
  'lip',
  'sie',
  'wrz',
  'paź',
  'lis',
  'gru',
];

const AREAS: FinanceCostArea[] = ['Marketplace', 'Dostawa', 'Operacyjne'];

function labelMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTH_PL[m - 1]} ${y}`;
}

function pctDelta(cur: number, prev: number | null | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function formatPct(v: number, digits = 1): string {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

function formatRatioPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function parseMoney(raw: string): number {
  const n = Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

interface FinanceDashboardProps {
  onBack: () => void;
}

export function FinanceDashboard({ onBack }: FinanceDashboardProps) {
  const [tick, setTick] = useState(0);
  const data = useMemo(() => {
    void tick;
    return getMergedFinanceData();
  }, [tick]);

  const [month, setMonth] = useState(data.meta.defaultMonth);
  const [showMonthForm, setShowMonthForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState('');

  const refresh = () => setTick((t) => t + 1);

  const idx = data.months.findIndex((m) => m.month === month);
  const current =
    data.months[idx] ?? data.months[data.months.length - 1] ?? null;
  const prev = idx > 0 ? data.months[idx - 1] : null;

  const sources = useMemo(() => {
    void tick;
    return current ? getMonthSources(current.month) : [];
  }, [current, tick]);

  const channels = current ? getChannels(current.month) : [];
  const channelTotal = channels.reduce((s, c) => s + c.amount, 0);
  const sourceTotal = sources.reduce((s, c) => s + c.amount, 0);
  const knownSources = useMemo(() => {
    void tick;
    return listKnownSourceNames();
  }, [tick]);

  const costStructure = useMemo(() => {
    if (!current) return [];
    return [
      { category: 'Koszt towaru', amount: current.kosztTowaru },
      { category: 'Marketplace', amount: current.marketplace },
      { category: 'Dostawa', amount: current.dostawa },
      { category: 'Operacyjne', amount: current.operacyjne },
    ];
  }, [current]);
  const structureTotal = costStructure.reduce((s, c) => s + c.amount, 0);

  const chartData = useMemo(
    () =>
      data.months.map((m, i) => ({
        key: m.month,
        label: labelMonth(m.month).split(' ')[0],
        fullLabel: labelMonth(m.month),
        sprzedaz: Math.round(m.sprzedaz),
        // Linia porównawcza = sprzedaż poprzedniego miesiąca (jak „previous period” w BL)
        poprzedni: i > 0 ? Math.round(data.months[i - 1].sprzedaz) : null,
        active: m.month === current?.month,
      })),
    [data.months, current?.month],
  );

  useEffect(() => {
    if (!exportFrom && data.months.length) {
      setExportFrom(data.months[0].month);
      setExportTo(data.months[data.months.length - 1].month);
    }
  }, [data.months, exportFrom]);

  if (!current) {
    return (
      <div className="space-y-4 pb-10">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          ← Operacje
        </button>
        <p className="text-slate-400">Brak danych finansowych.</p>
        <button
          type="button"
          onClick={() => setShowMonthForm(true)}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm text-white"
        >
          Dodaj pierwszy miesiąc
        </button>
        {showMonthForm && (
          <MonthFormModal
            suggested={suggestNextMonth([])}
            existing={[]}
            onClose={() => setShowMonthForm(false)}
            onSave={(m) => {
              upsertFinanceMonth(m);
              setMonth(m.month);
              refresh();
              setShowMonthForm(false);
              showToast('Dodano miesiąc', 'ok');
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 pb-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Operacje
          </button>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">
            {data.meta.title}
          </h2>
          <p className="max-w-3xl text-xs leading-relaxed text-slate-500">
            {data.meta.note} Edycje miesięcy i wydatków zapisują się lokalnie w
            tej przeglądarce.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-500">Miesiąc</label>
          <select
            value={current.month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-brand-500 focus:outline-none"
          >
            {data.months.map((m) => (
              <option key={m.month} value={m.month}>
                {labelMonth(m.month)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowMonthForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Miesiąc
          </button>
          <span className="rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-2 text-[11px] text-slate-500">
            vs poprzedni okres
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-300">Raport Excel (CSV)</p>
          <p className="text-[11px] text-slate-500">
            KPI miesięczne z wybranego zakresu
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-slate-500">
            Od
            <select
              value={exportFrom}
              onChange={(e) => setExportFrom(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            >
              {data.months.map((m) => (
                <option key={m.month} value={m.month}>
                  {labelMonth(m.month)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-slate-500">
            Do
            <select
              value={exportTo}
              onChange={(e) => setExportTo(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            >
              {data.months.map((m) => (
                <option key={m.month} value={m.month}>
                  {labelMonth(m.month)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              const from = exportFrom || data.months[0]?.month;
              const to = exportTo || data.months.at(-1)?.month;
              if (!from || !to) return;
              const lo = from <= to ? from : to;
              const hi = from <= to ? to : from;
              const slice = data.months.filter(
                (m) => m.month >= lo && m.month <= hi,
              );
              downloadCsv(
                stampFile(`finanse_${lo}_${hi}`),
                [
                  'Miesiąc',
                  'Sprzedaż netto',
                  'Koszt towaru',
                  'Marża netto',
                  'Marketplace',
                  'Dostawa',
                  'Operacyjne',
                  'Koszty razem',
                  'Wynik netto',
                  'Marża %',
                  'Wynik/sprzedaż %',
                  'Koszt/sprzedaż %',
                ],
                slice.map((m) => [
                  m.month,
                  m.sprzedaz.toFixed(2),
                  m.kosztTowaru.toFixed(2),
                  m.marzaNetto.toFixed(2),
                  m.marketplace.toFixed(2),
                  m.dostawa.toFixed(2),
                  m.operacyjne.toFixed(2),
                  m.kosztyRazem.toFixed(2),
                  m.wynikNetto.toFixed(2),
                  (m.marzaPct * 100).toFixed(2),
                  (m.wynikDoSprzedazy * 100).toFixed(2),
                  (m.kosztDoSprzedazy * 100).toFixed(2),
                ]),
              );
              showToast(`Eksport ${slice.length} mies.`, 'ok');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            <Download className="h-4 w-4" />
            Pobierz
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Sprzedaż netto"
          value={formatPricePln(current.sprzedaz)}
          delta={pctDelta(current.sprzedaz, prev?.sprzedaz)}
        />
        <KpiCard
          label="Koszt towaru"
          value={formatPricePln(current.kosztTowaru)}
          delta={pctDelta(current.kosztTowaru, prev?.kosztTowaru)}
          invertDelta
        />
        <KpiCard
          label="Marketplace"
          value={formatPricePln(current.marketplace)}
          delta={pctDelta(current.marketplace, prev?.marketplace)}
          invertDelta
          warn
        />
        <KpiCard
          label="Dostawa"
          value={formatPricePln(current.dostawa)}
          delta={pctDelta(current.dostawa, prev?.dostawa)}
          invertDelta
          warn
        />
        <KpiCard
          label="Operacyjne"
          value={formatPricePln(current.operacyjne)}
          delta={pctDelta(current.operacyjne, prev?.operacyjne)}
          invertDelta
          warn
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Marża netto"
          value={formatPricePln(current.marzaNetto)}
          delta={pctDelta(current.marzaNetto, prev?.marzaNetto)}
          accent
        />
        <KpiCard
          label="Koszty razem"
          value={formatPricePln(current.kosztyRazem)}
          delta={pctDelta(current.kosztyRazem, prev?.kosztyRazem)}
          invertDelta
        />
        <KpiCard
          label="Wynik netto"
          value={formatPricePln(current.wynikNetto)}
          delta={pctDelta(current.wynikNetto, prev?.wynikNetto)}
          accent
        />
        <KpiCard
          label="Koszt / sprzedaż"
          value={formatRatioPct(current.kosztDoSprzedazy)}
          delta={
            prev
              ? (current.kosztDoSprzedazy - prev.kosztDoSprzedazy) * 100
              : null
          }
          invertDelta
          points
        />
        <KpiCard
          label="Wynik / sprzedaż"
          value={formatRatioPct(current.wynikDoSprzedazy)}
          delta={
            prev
              ? (current.wynikDoSprzedazy - prev.wynikDoSprzedazy) * 100
              : null
          }
          accent
          points
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 xl:col-span-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Sprzedaż netto w czasie
              </h3>
              <p className="text-[10px] text-slate-500">
                Linia ciągła = miesiąc · przerywana = poprzedni miesiąc
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-4 rounded bg-slate-100" /> bieżący
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-0.5 w-4 rounded border border-dashed border-slate-400" />{' '}
                poprzedni
              </span>
            </div>
          </div>
          <div className="h-56 w-full sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: number, name: string) => [
                    formatPricePln(value),
                    name === 'sprzedaz'
                      ? 'Sprzedaż netto'
                      : 'Poprzedni miesiąc',
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                  formatter={(v) =>
                    v === 'sprzedaz' ? 'Sprzedaż netto' : 'Poprzedni miesiąc'
                  }
                />
                <Line
                  type="monotone"
                  dataKey="poprzedni"
                  name="poprzedni"
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="sprzedaz"
                  name="sprzedaz"
                  stroke="#e2e8f0"
                  strokeWidth={2.75}
                  dot={{ r: 3.5, fill: '#38bdf8', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#38bdf8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 xl:col-span-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Platformy sprzedaży
            </h3>
            <span className="text-[10px] text-slate-500">
              {formatPricePln(channelTotal)}
            </span>
          </div>
          <HBarList
            items={channels.map((c) => ({
              label: c.channel,
              value: c.amount,
              share: channelTotal > 0 ? c.amount / channelTotal : 0,
            }))}
            barClass="bg-sky-500"
          />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 xl:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Struktura kosztów
            </h3>
            <span className="text-[10px] text-slate-500">
              {formatPricePln(structureTotal)}
            </span>
          </div>
          <HBarList
            items={costStructure.map((c) => ({
              label: c.category,
              value: c.amount,
              share: structureTotal > 0 ? c.amount / structureTotal : 0,
            }))}
            barClass="bg-amber-500"
          />
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Źródła kosztów — {labelMonth(current.month)}
            </h3>
            <p className="text-[11px] text-slate-500">
              {sources.length} pozycji · {formatPricePln(sourceTotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowExpenseForm(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500"
          >
            <Plus className="h-4 w-4" />
            Wydatek
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Źródło</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">
                  Obszar
                </th>
                <th className="px-4 py-2 font-medium text-right">Kwota netto</th>
                <th className="hidden px-4 py-2 font-medium text-right md:table-cell">
                  Udział
                </th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {sources.map((s, i) => {
                const share = sourceTotal > 0 ? s.amount / sourceTotal : 0;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-slate-800/70 last:border-0"
                  >
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-200">
                      {s.name}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-500 sm:table-cell">
                      {s.area || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-100">
                      {formatPricePln(s.amount)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-slate-400 md:table-cell">
                      {(share * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          removeFinanceExpense(current.month, s.id);
                          refresh();
                          showToast('Usunięto wydatek', 'info');
                        }}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                        title="Usuń"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sources.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Brak pozycji — dodaj pierwszy wydatek.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showMonthForm && (
        <MonthFormModal
          suggested={suggestNextMonth(data.months.map((m) => m.month))}
          existing={data.months.map((m) => m.month)}
          onClose={() => setShowMonthForm(false)}
          onSave={(m) => {
            upsertFinanceMonth(m);
            setMonth(m.month);
            refresh();
            setShowMonthForm(false);
            showToast(`Zapisano ${labelMonth(m.month)}`, 'ok');
          }}
        />
      )}

      {showExpenseForm && (
        <ExpenseFormModal
          month={current.month}
          knownSources={knownSources}
          onClose={() => setShowExpenseForm(false)}
          onSave={(payload) => {
            addFinanceExpense({ month: current.month, ...payload });
            refresh();
            setShowExpenseForm(false);
            showToast('Dodano wydatek', 'ok');
          }}
        />
      )}
    </div>
  );
}

function MonthFormModal({
  suggested,
  existing,
  onClose,
  onSave,
}: {
  suggested: string;
  existing: string[];
  onClose: () => void;
  onSave: (m: {
    month: string;
    sprzedaz: number;
    kosztTowaru: number;
    marketplace: number;
    dostawa: number;
    operacyjne: number;
  }) => void;
}) {
  const [month, setMonth] = useState(suggested);
  const [sprzedaz, setSprzedaz] = useState('');
  const [kosztTowaru, setKosztTowaru] = useState('');
  const [marketplace, setMarketplace] = useState('');
  const [dostawa, setDostawa] = useState('');
  const [operacyjne, setOperacyjne] = useState('');

  return (
    <Modal title="Nowy / edycja miesiąca" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\d{4}-\d{2}$/.test(month)) {
            showToast('Miesiąc w formacie RRRR-MM', 'warn');
            return;
          }
          onSave({
            month,
            sprzedaz: parseMoney(sprzedaz),
            kosztTowaru: parseMoney(kosztTowaru),
            marketplace: parseMoney(marketplace),
            dostawa: parseMoney(dostawa),
            operacyjne: parseMoney(operacyjne),
          });
        }}
      >
        <Field label="Miesiąc (RRRR-MM)">
          <input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="2026-07"
            className={INPUT_CLS}
            required
          />
          {existing.includes(month) && (
            <p className="mt-1 text-[11px] text-amber-400">
              Ten miesiąc już jest — zapis nadpisze wartości KPI.
            </p>
          )}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sprzedaż netto">
            <input
              value={sprzedaz}
              onChange={(e) => setSprzedaz(e.target.value)}
              inputMode="decimal"
              className={INPUT_CLS}
              required
            />
          </Field>
          <Field label="Koszt towaru">
            <input
              value={kosztTowaru}
              onChange={(e) => setKosztTowaru(e.target.value)}
              inputMode="decimal"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Marketplace">
            <input
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              inputMode="decimal"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Dostawa">
            <input
              value={dostawa}
              onChange={(e) => setDostawa(e.target.value)}
              inputMode="decimal"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Operacyjne">
            <input
              value={operacyjne}
              onChange={(e) => setOperacyjne(e.target.value)}
              inputMode="decimal"
              className={INPUT_CLS}
            />
          </Field>
        </div>
        <p className="text-[11px] text-slate-500">
          Marża i wynik policzą się same (sprzedaż − koszty).
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300"
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            Zapisz miesiąc
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ExpenseFormModal({
  month,
  knownSources,
  onClose,
  onSave,
}: {
  month: string;
  knownSources: string[];
  onClose: () => void;
  onSave: (p: {
    name: string;
    amount: number;
    area: FinanceCostArea;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [area, setArea] = useState<FinanceCostArea>('Operacyjne');
  const [custom, setCustom] = useState(false);

  return (
    <Modal title={`Wydatek — ${labelMonth(month)}`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          const a = parseMoney(amount);
          if (!n) {
            showToast('Podaj źródło', 'warn');
            return;
          }
          if (a <= 0) {
            showToast('Kwota musi być > 0', 'warn');
            return;
          }
          onSave({ name: n, amount: a, area });
        }}
      >
        <Field label="Źródło kosztu">
          {!custom ? (
            <div className="flex gap-2">
              <select
                value={name}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setCustom(true);
                    setName('');
                  } else setName(e.target.value);
                }}
                className={`${INPUT_CLS} flex-1`}
              >
                <option value="">Wybierz…</option>
                {knownSources.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="__new__">+ Nowe źródło…</option>
              </select>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Meta Ads"
                className={`${INPUT_CLS} flex-1`}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setCustom(false);
                  setName('');
                }}
                className="rounded-xl border border-slate-700 px-3 text-xs text-slate-400"
              >
                Lista
              </button>
            </div>
          )}
        </Field>
        <Field label="Obszar">
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as FinanceCostArea)}
            className={INPUT_CLS}
          >
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kwota netto (PLN)">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className={INPUT_CLS}
            required
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300"
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          >
            Dodaj wydatek
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 p-4 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function KpiCard({
  label,
  value,
  delta,
  invertDelta,
  accent,
  warn,
  points,
}: {
  label: string;
  value: string;
  delta: number | null;
  invertDelta?: boolean;
  accent?: boolean;
  warn?: boolean;
  points?: boolean;
}) {
  const good =
    delta == null ? null : invertDelta ? delta <= 0 : delta >= 0;
  return (
    <div
      className={`rounded-2xl border px-3 py-3 sm:px-4 ${
        accent
          ? 'border-emerald-500/30 bg-emerald-500/10'
          : warn
            ? 'border-amber-500/20 bg-amber-500/5'
            : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-slate-50 sm:text-xl">
        {value}
      </p>
      {delta != null ? (
        <p
          className={`mt-1 flex items-center gap-1 text-[11px] font-medium tabular-nums ${
            good ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {good ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {formatPct(delta)}
          <span className="font-normal text-slate-600">
            {points ? 'pp vs poprz.' : 'vs poprz.'}
          </span>
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-slate-600">brak porównania</p>
      )}
    </div>
  );
}

function HBarList({
  items,
  barClass,
}: {
  items: { label: string; value: number; share: number }[];
  barClass: string;
}) {
  if (!items.length) {
    return (
      <p className="py-8 text-center text-xs text-slate-500">Brak danych</p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-medium text-slate-200">
              {item.label}
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-slate-400">
              {formatPricePln(item.value)}
              <span className="ml-1 text-slate-600">
                {(item.share * 100).toFixed(0)}%
              </span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${Math.max(3, item.share * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
