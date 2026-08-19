import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Download,
  RefreshCw,
  Search,
} from 'lucide-react';
import { downloadCsv, stampFile } from '../../lib/exportReport';
import { formatPricePln } from '../../lib/format';
import { fetchOpsCustomers, type OpsCustomer } from '../../lib/opsCustomers';
import { showToast } from '../../lib/toast';

interface OpsCustomersPanelProps {
  onBack: () => void;
}

export function OpsCustomersPanel({ onBack }: OpsCustomersPanelProps) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<OpsCustomer[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCustomers(search = query) {
    setLoading(true);
    const result = await fetchOpsCustomers(search);
    setRows(result.rows);
    setCount(result.count);
    setError(result.error ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void loadCustomers('');
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadCustomers(query);
    }, 260);
    return () => window.clearTimeout(id);
  }, [query]);

  const stats = useMemo(() => {
    const inBase = rows.filter((row) => row.is_active).length;
    const withNip = rows.filter((row) => row.nip_normalized).length;
    const cities = new Set(rows.map((row) => row.city).filter(Boolean)).size;
    const latestSync = rows
      .map((row) => row.synced_at ?? row.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    return { inBase, withNip, cities, latestSync };
  }, [rows]);

  function exportRows() {
    downloadCsv(
      stampFile('operacje_baza_klientow'),
      ['Nazwa', 'NIP', 'Kod', 'Miasto', 'Adres', 'Telefon', 'Email', 'Termin', 'Limit', 'Saldo'],
      rows.map((row) => [
        row.name,
        row.nip ?? '',
        row.code ?? '',
        row.city ?? '',
        row.address ?? '',
        row.phone ?? '',
        row.email ?? '',
        row.payment_terms_days == null ? '' : `${row.payment_terms_days}`,
        row.credit_limit == null ? '' : `${row.credit_limit}`,
        row.balance == null ? '' : `${row.balance}`,
      ]),
    );
    showToast('Eksport bazy klientow CSV', 'ok');
  }

  return (
    <div className="ops-sales-analytics ops-customers-panel mx-auto w-full max-w-[1600px] space-y-5 px-1 pb-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Operacje
      </button>

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-2xl bg-brand-50 p-3 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
                Dane operacyjne WAPRO
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-slate-50">
                Baza klientow i kontrahentow
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Wspolna baza do analiz: NIP, adres, miejscowosc, kontakt, limity i warunki platnosci.
                CRM moze pracowac na relacjach handlowych, a Operacje na czystych danych z WAPRO.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadCustomers(query)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Odswiez
            </button>
            <button
              type="button"
              onClick={exportRows}
              disabled={!rows.length}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CustomerStat label="Rekordy w widoku" value={loading ? '...' : String(rows.length)} hint={`z ${count}`} />
        <CustomerStat label="W bazie WAPRO" value={String(stats.inBase)} hint="status techniczny importu" />
        <CustomerStat label="Z NIP" value={String(stats.withNip)} hint="gotowe do laczenia faktur" />
        <CustomerStat
          label="Miejscowosci"
          value={String(stats.cities)}
          hint={stats.latestSync ? `sync ${formatDate(stats.latestSync)}` : 'czeka na import'}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj po nazwie, NIP, miejscowosci, kodzie lub adresie..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-500 focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400"
            />
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200">
            Import: <span className="font-semibold">powershell -ExecutionPolicy Bypass -File scripts\sync-wapro-customers.ps1</span>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            {error.includes('ops_customers')
              ? 'Brakuje tabeli ops_customers. Uruchom migracje supabase/migration-ops-customers.sql.'
              : error}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="max-h-[620px] overflow-auto">
            <table className="ops-sales-table min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Klient</th>
                  <th className="px-4 py-3">NIP</th>
                  <th className="px-4 py-3">Adres</th>
                  <th className="px-4 py-3">Kontakt</th>
                  <th className="px-4 py-3">Platnosci</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-600 dark:text-slate-400">
                      Wczytuje baze klientow...
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((row) => <CustomerRow key={row.id} row={row} />)
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-600 dark:text-slate-400">
                      Brak klientow dla tego wyszukiwania albo tabela czeka na pierwszy import z WAPRO.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function CustomerRow({ row }: { row: OpsCustomer }) {
  return (
    <tr className="align-top hover:bg-slate-50 dark:hover:bg-slate-900/60">
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-950 dark:text-slate-100">{row.name}</p>
        <p className="mt-0.5 text-xs text-slate-500">{row.code || row.wapro_id}</p>
        {row.legal_name && row.legal_name !== row.name ? (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{row.legal_name}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 font-semibold tabular-nums text-slate-800 dark:text-slate-200">
        {row.nip || '-'}
      </td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
        <p>{[row.postal_code, row.city].filter(Boolean).join(' ') || '-'}</p>
        <p className="mt-0.5 max-w-xs text-xs text-slate-500">{row.address || row.street || ''}</p>
      </td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
        <p>{row.phone || '-'}</p>
        {row.email ? <p className="mt-0.5 text-xs text-slate-500">{row.email}</p> : null}
      </td>
      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
        <p>{row.payment_terms_days == null ? '-' : `${row.payment_terms_days} dni`}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          limit {row.credit_limit == null ? '-' : formatPricePln(row.credit_limit)}
        </p>
        {row.balance != null ? (
          <p className="mt-0.5 text-xs text-slate-500">saldo {formatPricePln(row.balance)}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
            row.is_active
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {row.is_active ? 'W bazie' : 'Nieaktywny'}
        </span>
      </td>
    </tr>
  );
}

function CustomerStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950 dark:text-slate-50">{value}</p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pl-PL');
}
