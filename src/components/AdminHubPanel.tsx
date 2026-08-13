import { useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Calculator,
  Database,
  FileSpreadsheet,
  RotateCcw,
  Settings2,
  Shield,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { roleCan } from '../lib/roles';
import {
  APP_ROLES,
  ROLE_ACTION_LABELS,
  ROLE_ACTIONS,
  ROLE_LABELS,
  type AppRole,
} from '../lib/roles';
import {
  getRoleMatrix,
  resetRoleMatrixToDefault,
  setRoleMatrixCell,
} from '../lib/roleMatrixStore';
import { AdminUsersSection } from './AdminUsersSection';
import { HubToggle } from './HubToggle';
import { ContextHelp } from './ContextHelp';

type AdminTab = 'users' | 'permissions' | 'operations';

type AdminHubPanelProps = {
  onBack?: () => void;
  backLabel?: string;
  title?: string;
  description?: string;
  product?: 'catalog' | 'ops' | 'stock';
};

export function AdminHubPanel({
  onBack,
  backLabel = 'Wroc do katalogu',
  title = 'Administracja Kenochem',
  description = 'Konta zespolu i macierz uprawnien.',
  product = 'catalog',
}: AdminHubPanelProps) {
  const { role, roleMatrixRevision, profile } = useAuth();
  const [tab, setTab] = useState<AdminTab>(
    roleCan(role, 'manageUsers') ? 'users' : product === 'ops' ? 'operations' : 'permissions',
  );

  const showUsers = roleCan(role, 'manageUsers');
  const showMatrix = roleCan(role, 'viewRoleMatrix');
  const showOperations = product === 'ops';
  const canEditMatrix = role === 'admin';

  const accountRoles = APP_ROLES.filter((r) => r !== 'guest') as AppRole[];
  const matrix = getRoleMatrix();
  void roleMatrixRevision;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 pb-12">
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

      <header className="rounded-2xl border border-slate-800 bg-slate-900/80">
        <div className="p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-2xl bg-violet-500/15 p-3 text-violet-400">
                <Settings2 className="h-6 w-6" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-400">
                  Panel kontrolny
                </p>
                <h1 className="inline-flex items-center gap-2 text-xl font-semibold text-slate-50 sm:text-2xl">
                  {title}
                  <ContextHelp id="admin" side="left" />
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  {description}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatPill label="Twoja rola" value={ROLE_LABELS[role]} />
              <StatPill label="Konta" value={showUsers ? 'Zarzadzanie' : '-'} />
              <StatPill
                label={product === 'ops' ? 'Operacje' : 'Macierz'}
                value={showMatrix ? (canEditMatrix ? 'Edycja' : 'Podglad') : '-'}
                accent
              />
            </div>
          </div>
        </div>
        <div className="flex gap-1 border-t border-slate-800 px-4 pb-0 pt-2">
          {showUsers && (
            <TabButton
              active={tab === 'users'}
              onClick={() => setTab('users')}
              icon={<Users className="h-4 w-4" />}
              label="Uzytkownicy"
            />
          )}
          {showMatrix && (
            <TabButton
              active={tab === 'permissions'}
              onClick={() => setTab('permissions')}
              icon={<Shield className="h-4 w-4" />}
              label="Uprawnienia rol"
            />
          )}
          {showOperations && (
            <TabButton
              active={tab === 'operations'}
              onClick={() => setTab('operations')}
              icon={<Calculator className="h-4 w-4" />}
              label="Operacje"
            />
          )}
        </div>
      </header>

      {tab === 'users' && showUsers && <AdminUsersSection />}

      {tab === 'operations' && showOperations && <OpsAdminSection />}

      {tab === 'permissions' && showMatrix && (
        <section className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Macierz uprawnien</h2>
              <p className="mt-1 max-w-2xl text-xs text-slate-500">
                {canEditMatrix
                  ? 'Suwaki zapisuja sie w Supabase, wiec caly zespol widzi te same uprawnienia.'
                  : 'Podglad macierzy. Edycja tylko dla admina.'}
              </p>
            </div>
            {canEditMatrix && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Przywrocic domyslna macierz z kodu?')) {
                    resetRoleMatrixToDefault(profile?.id);
                  }
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Domyslne
              </button>
            )}
          </div>
          <table className="min-w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <th className="sticky left-0 z-10 bg-slate-950 px-3 py-2 font-semibold text-slate-300">
                  Uprawnienie
                </th>
                {accountRoles.map((r) => (
                  <th key={r} className="px-2 py-2 text-center font-semibold text-slate-300">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLE_ACTIONS.map((action) => (
                <tr key={action} className="border-b border-slate-800/80">
                  <td className="sticky left-0 z-10 bg-slate-900 px-3 py-1.5 font-medium text-slate-200">
                    {ROLE_ACTION_LABELS[action]}
                  </td>
                  {accountRoles.map((r) => (
                    <td key={`${r}-${action}`} className="px-2 py-1.5 text-center">
                      <div className="flex justify-center">
                        <HubToggle
                          checked={matrix[r][action]}
                          disabled={!canEditMatrix}
                          label={`${ROLE_LABELS[r]}: ${ROLE_ACTION_LABELS[action]}`}
                          onChange={
                            canEditMatrix
                              ? (v) => setRoleMatrixCell(r, action, v, profile?.id)
                              : undefined
                          }
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
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

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`catalog-product-tab mb-2 inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm font-medium ${
        active ? 'catalog-product-tab--active' : ''
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
