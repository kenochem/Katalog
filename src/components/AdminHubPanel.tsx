import { useState, type ReactNode } from 'react';
import {
  Activity,
  ArrowLeft,
  Calculator,
  Database,
  FileSpreadsheet,
  Gauge,
  LayoutDashboard,
  Link2,
  Settings2,
  Shield,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { roleCan } from '../lib/roles';
import { ROLE_LABELS } from '../lib/roles';
import { AdminUsersSection } from './AdminUsersSection';
import { AdminPermissionsSection } from './AdminPermissionsSection';
import { AdminBaselinkerSection } from './AdminBaselinkerSection';
import { AdminAuditSection } from './AdminAuditSection';
import { AdminOverviewSection, type AdminShortcut } from './AdminOverviewSection';
import { MigrationsStatusView } from './MigrationsStatusView';
import { SystemStatusView } from './SystemStatusView';
import { ContextHelp } from './ContextHelp';

type AdminTab = 'overview' | AdminShortcut | 'operations';

type AdminHubPanelProps = {
  onBack?: () => void;
  backLabel?: string;
  title?: string;
  description?: string;
  product?: 'catalog' | 'ops' | 'stock';
};

export function AdminHubPanel({
  onBack,
  backLabel = 'Wróć do katalogu',
  title = 'Administracja Kenochem',
  description = 'Konta zespołu, uprawnienia, integracje, dziennik aktywności i stan bazy danych.',
  product = 'catalog',
}: AdminHubPanelProps) {
  const { role } = useAuth();
  const showUsers = roleCan(role, 'manageUsers');
  const showMatrix = roleCan(role, 'viewRoleMatrix');
  const showOperations = product === 'ops';
  const showBaselinker = roleCan(role, 'manageBaselinker');
  const canEditMatrix = roleCan(role, 'editRoleMatrix');
  // dziennik, migracje i status systemów są dostępne tylko administratorowi (RLS po stronie bazy)
  const showAdminData = showUsers;

  const [tab, setTab] = useState<AdminTab>(
    showAdminData ? 'overview' : showOperations ? 'operations' : showMatrix ? 'permissions' : 'baselinker',
  );

  const tabs: { id: AdminTab; label: string; icon: ReactNode; show: boolean }[] = [
    { id: 'overview', label: 'Przegląd', icon: <LayoutDashboard className="h-4 w-4" />, show: showAdminData },
    { id: 'users', label: 'Użytkownicy', icon: <Users className="h-4 w-4" />, show: showUsers },
    { id: 'permissions', label: 'Uprawnienia', icon: <Shield className="h-4 w-4" />, show: showMatrix },
    { id: 'baselinker', label: 'BaseLinker', icon: <Link2 className="h-4 w-4" />, show: showBaselinker },
    { id: 'activity', label: 'Aktywność', icon: <Activity className="h-4 w-4" />, show: showAdminData },
    { id: 'migrations', label: 'Migracje bazy', icon: <Database className="h-4 w-4" />, show: showAdminData },
    { id: 'system', label: 'Status systemów', icon: <Gauge className="h-4 w-4" />, show: showAdminData },
    { id: 'operations', label: 'Operacje', icon: <Calculator className="h-4 w-4" />, show: showOperations },
  ];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 pb-12">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {backLabel}
        </button>
      )}

      <header className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-violet-500/15 via-slate-900/80 to-slate-900/80">
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-violet-500/20 p-3.5 text-violet-300 shadow-inner">
              <Settings2 className="h-7 w-7" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">Panel kontrolny</p>
              <h1 className="inline-flex items-center gap-2 text-xl font-bold text-slate-50 sm:text-2xl">
                {title}
                <ContextHelp id="admin" side="left" />
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatPill label="Twoja rola" value={ROLE_LABELS[role]} />
            <StatPill label="Konta" value={showUsers ? 'Zarządzanie' : '—'} />
            <StatPill label="Uprawnienia" value={showMatrix ? (canEditMatrix ? 'Edycja' : 'Podgląd') : '—'} accent />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-800/80 bg-slate-950/30 px-3 py-2" role="tablist">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  tab === t.id ? 'bg-violet-500/20 text-violet-200 shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
        </nav>
      </header>

      {tab === 'overview' && showAdminData && (
        <AdminOverviewSection
          onGo={(t) => setTab(t)}
          canGo={{
            users: showUsers,
            permissions: showMatrix,
            baselinker: showBaselinker,
            activity: showAdminData,
            migrations: showAdminData,
            system: showAdminData,
          }}
        />
      )}
      {tab === 'users' && showUsers && <AdminUsersSection />}
      {tab === 'permissions' && showMatrix && <AdminPermissionsSection canEditMatrix={canEditMatrix} />}
      {tab === 'baselinker' && showBaselinker && <AdminBaselinkerSection />}
      {tab === 'activity' && showAdminData && <AdminAuditSection />}
      {tab === 'migrations' && showAdminData && <MigrationsStatusView />}
      {tab === 'system' && showAdminData && <SystemStatusView />}
      {tab === 'operations' && showOperations && <OpsAdminSection />}
    </div>
  );
}

function OpsAdminSection() {
  const tools = [
    ['Dashboard finansowy', 'Podglad wyniku, kosztow, marzy i trendow.'],
    ['Dostawa danych', 'Raporty CSV/TSV z marketplace, banku, WAPRO i handlowcow.'],
    ['Cashflow', 'Prognoza salda, wplywy i platnosci.'],
    ['Faktury i platnosci', 'Terminy, naleznosci, zobowiazania i statusy.'],
    ['Windykacja', 'Sprawy po terminie i priorytety odzysku.'],
    ['Rozliczenia handlowcow', 'Prowizje, korekty i wynik kanalu.'],
  ];

  const sources = [
    ['BaseLinker / marketplace', 'E-commerce', 'manualny import raportow'],
    ['Allegro / Erli / Empik', 'Marketplace', 'oplaty, prowizje, zwroty'],
    ['WAPRO', 'Ksiegowosc', 'faktury, dokumenty, kontrahenci'],
    ['Bank', 'Platnosci', 'wyciagi, przelewy, uzgodnienia'],
    ['Raporty handlowcow', 'Handel', 'sprzedaz terenowa i prowizje'],
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-brand-500/15 p-3 text-brand-300">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Zrodla danych operacyjnych
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Lista obszarow, ktore powinny zasilac finanse. Na tym etapie panel
              porzadkuje odpowiedzialnosc i pokazuje, co bedziemy automatyzowac.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Zrodlo</th>
                <th className="px-3 py-2 font-medium">Obszar</th>
                <th className="px-3 py-2 font-medium">Zakres</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(([name, area, scope]) => (
                <tr key={name} className="border-b border-slate-800/70 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-slate-100">{name}</td>
                  <td className="px-3 py-2.5 text-slate-400">{area}</td>
                  <td className="px-3 py-2.5 text-slate-500">{scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-violet-500/15 p-3 text-violet-300">
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Narzedzia finansowe
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Docelowo kazde narzedzie dostanie osobne role: podglad, edycja,
              import danych, eksport raportow i zatwierdzanie kosztow.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {tools.map(([name, desc]) => (
            <div key={name} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-sm font-semibold text-slate-100">{name}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        accent ? 'border-violet-500/35 bg-violet-500/10' : 'border-slate-700 bg-slate-800/50'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}
