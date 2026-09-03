import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, RotateCcw, Shield, Users } from 'lucide-react';
import { moduleEnabled } from '../app/moduleRegistry';
import { useAuth } from '../lib/auth';
import {
  APP_ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  type AppRole,
  type RoleAction,
} from '../lib/roles';
import {
  getRoleMatrix,
  resetRoleMatrixToDefault,
  setRoleMatrixCell,
} from '../lib/roleMatrixStore';
import {
  GROUP_LABELS,
  GROUP_ORDER,
  capabilitiesByGroup,
  isModuleCapabilityAvailable,
  roleGatedCapabilitiesForRole,
  summarizeRolePermissions,
  type CapabilityGroup,
} from '../lib/access';
import { HubToggle } from './HubToggle';

type PermissionsView = 'overview' | 'matrix';

type AdminPermissionsSectionProps = {
  canEditMatrix: boolean;
};

export function AdminPermissionsSection({ canEditMatrix }: AdminPermissionsSectionProps) {
  const { roleMatrixRevision, profile } = useAuth();
  const [view, setView] = useState<PermissionsView>('overview');
  const [expandedGroups, setExpandedGroups] = useState<Set<CapabilityGroup>>(
    () => new Set(GROUP_ORDER.filter((g) => g !== 'modules')),
  );
  void roleMatrixRevision;

  const matrix = getRoleMatrix();
  const accountRoles = APP_ROLES.filter((r) => r !== 'guest') as AppRole[];
  const grouped = useMemo(() => capabilitiesByGroup(), []);

  function toggleGroup(g: CapabilityGroup) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <ViewToggle
          active={view === 'overview'}
          onClick={() => setView('overview')}
          icon={<Users className="h-4 w-4" />}
          label="Przegląd ról"
        />
        <ViewToggle
          active={view === 'matrix'}
          onClick={() => setView('matrix')}
          icon={<Shield className="h-4 w-4" />}
          label="Macierz uprawnień"
        />
        {canEditMatrix && view === 'matrix' && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Przywrócić domyślną macierz z kodu?')) {
                resetRoleMatrixToDefault(profile?.id);
              }
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Domyślne
          </button>
        )}
      </div>

      {view === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          {accountRoles.map((r) => (
            <RoleOverviewCard key={r} role={r} />
          ))}
        </div>
      )}

      {view === 'matrix' && (
        <div className="space-y-3">
          {GROUP_ORDER.map((group) => {
            const defs = grouped.get(group) ?? [];
            if (defs.length === 0) return null;
            const expanded = expandedGroups.has(group);
            const roleGated = defs.filter((d) => d.roleAction);
            const moduleOnly = defs.filter((d) => !d.roleAction);

            return (
              <section
                key={group}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-900/60"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{GROUP_LABELS[group]}</h3>
                    <p className="text-[11px] text-slate-500">
                      {group === 'modules'
                        ? `${moduleOnly.filter(isModuleCapabilityAvailable).length} aktywnych w tym buildzie`
                        : `${roleGated.length} uprawnień`}
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-slate-500 transition ${expanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {expanded && (
                  <div className="border-t border-slate-800">
                    {group === 'modules' && (
                      <ul className="grid gap-2 p-4 sm:grid-cols-2">
                        {moduleOnly.map((def) => {
                          const on = def.moduleId ? moduleEnabled(def.moduleId) : true;
                          return (
                            <li
                              key={def.id}
                              className={`rounded-xl border px-3 py-2.5 ${
                                on
                                  ? 'border-emerald-500/30 bg-emerald-500/5'
                                  : 'border-slate-800 bg-slate-950/40 opacity-60'
                              }`}
                            >
                              <p className="text-sm font-medium text-slate-100">{def.label}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">{def.description}</p>
                              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                                {on ? 'W buildzie' : 'Niedostępny w tym produkcie'}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {group !== 'modules' && roleGated.length > 0 && (
                      <div className="overflow-x-auto p-4">
                        <table className="min-w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/60">
                              <th className="sticky left-0 z-10 min-w-[180px] bg-slate-950 px-3 py-2 font-semibold text-slate-300">
                                Uprawnienie
                              </th>
                              {accountRoles.map((r) => (
                                <th
                                  key={r}
                                  className="min-w-[72px] px-2 py-2 text-center font-semibold text-slate-300"
                                >
                                  {ROLE_LABELS[r]}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {roleGated.map((def) => {
                              if (!isModuleCapabilityAvailable(def)) return null;
                              const action = def.roleAction as RoleAction;
                              return (
                                <tr key={def.id} className="border-b border-slate-800/80">
                                  <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2">
                                    <p className="font-medium text-slate-200">{def.label}</p>
                                    <p className="mt-0.5 max-w-xs text-[10px] leading-snug text-slate-500">
                                      {def.description}
                                    </p>
                                  </td>
                                  {accountRoles.map((r) => (
                                    <td key={`${r}-${def.id}`} className="px-2 py-2 text-center">
                                      <div className="flex justify-center">
                                        <HubToggle
                                          checked={matrix[r][action]}
                                          disabled={!canEditMatrix}
                                          label={`${ROLE_LABELS[r]}: ${def.label}`}
                                          onChange={
                                            canEditMatrix
                                              ? (v) =>
                                                  setRoleMatrixCell(r, action, v, profile?.id)
                                              : undefined
                                          }
                                        />
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-600">
        Nowe funkcje dodawaj w{' '}
        <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-400">
          src/lib/access/capabilityRegistry.ts
        </code>{' '}
        — panel admina i nawigacja korzystają z tego rejestru automatycznie.
      </p>
    </div>
  );
}

function RoleOverviewCard({ role }: { role: AppRole }) {
  const summary = summarizeRolePermissions(role);
  const groupsWithAccess = GROUP_ORDER.filter(
    (g) => g !== 'modules' && (summary.byGroup.get(g)?.length ?? 0) > 0,
  );

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-50">{ROLE_LABELS[role]}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{ROLE_DESCRIPTIONS[role]}</p>
        </div>
        <span className="shrink-0 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-violet-300">
          {summary.total}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {groupsWithAccess.map((g) => {
          const caps = summary.byGroup.get(g) ?? [];
          return (
            <div key={g}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {GROUP_LABELS[g]}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {caps.map((c) => (
                  <span
                    key={c.id}
                    className="rounded-lg border border-slate-700/80 bg-slate-950/50 px-2 py-0.5 text-[11px] text-slate-300"
                  >
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {groupsWithAccess.length === 0 && (
          <p className="text-xs text-slate-600">Brak aktywnych uprawnień w tym buildzie.</p>
        )}
      </div>
    </article>
  );
}

function ViewToggle({
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
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
        active
          ? 'border-violet-500/40 bg-violet-500/15 text-violet-200'
          : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Podgląd różnic przy zmianie roli użytkownika. */
export function RoleChangePreview({
  fromRole,
  toRole,
}: {
  fromRole: AppRole;
  toRole: AppRole;
}) {
  if (fromRole === toRole) return null;

  const fromCaps = roleGatedCapabilitiesForRole(fromRole);
  const toCaps = roleGatedCapabilitiesForRole(toRole);
  const fromSet = new Set(fromCaps.map((d) => d.id));
  const toSet = new Set(toCaps.map((d) => d.id));
  const gained = toCaps.filter((d) => !fromSet.has(d.id));
  const lost = fromCaps.filter((d) => !toSet.has(d.id));

  if (gained.length === 0 && lost.length === 0) {
    return (
      <p className="text-[11px] text-slate-500">Ta sama rola — bez zmian uprawnień.</p>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-[11px] font-medium text-slate-400">
        {ROLE_LABELS[fromRole]} → {ROLE_LABELS[toRole]}
      </p>
      {gained.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500/90">
            Zyska
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {gained.map((c) => (
              <span
                key={c.id}
                className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300"
              >
                + {c.label}
              </span>
            ))}
          </div>
        </div>
      )}
      {lost.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/90">
            Straci
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {lost.map((c) => (
              <span
                key={c.id}
                className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300"
              >
                − {c.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
