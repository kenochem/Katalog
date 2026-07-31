import { Shield, X } from 'lucide-react';
import {
  APP_ROLES,
  DEFAULT_ROLE_MATRIX,
  ROLE_ACTION_LABELS,
  ROLE_ACTIONS,
  ROLE_LABELS,
  type AppRole,
  type RoleAction,
} from '../lib/roles';

interface RoleMatrixPanelProps {
  onClose: () => void;
}

export function RoleMatrixPanel({ onClose }: RoleMatrixPanelProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-slate-700 bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-400" />
            <h2 className="font-semibold text-slate-100">Uprawnienia ról</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:text-amber-100">
            Podgląd macierzy z kodu aplikacji. Edycja per rola (włączanie cen, edycji
            produktów itd.) — wkrótce; na razie wartości są na sztywno.
          </p>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60">
                  <th className="sticky left-0 bg-slate-950 px-3 py-2 font-semibold text-slate-300">
                    Uprawnienie
                  </th>
                  {APP_ROLES.map((role) => (
                    <th
                      key={role}
                      className="px-2 py-2 text-center font-semibold text-slate-300"
                    >
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLE_ACTIONS.map((action: RoleAction) => (
                  <tr key={action} className="border-b border-slate-800/80">
                    <td className="sticky left-0 bg-slate-900 px-3 py-1.5 font-medium text-slate-200">
                      {ROLE_ACTION_LABELS[action]}
                    </td>
                    {APP_ROLES.map((role: AppRole) => {
                      const on = DEFAULT_ROLE_MATRIX[role][action];
                      return (
                        <td key={`${role}-${action}`} className="px-2 py-1.5 text-center">
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              on
                                ? 'bg-brand-600/20 text-brand-300'
                                : 'bg-slate-800 text-slate-600'
                            }`}
                          >
                            {on ? 'TAK' : '—'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
