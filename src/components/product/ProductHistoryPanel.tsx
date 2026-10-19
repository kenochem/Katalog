import { History, Layers, Loader2, RotateCcw, User } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AuditChange, AuditEntry } from '../../lib/auditLog';
import { AUDIT_ACTION_LABELS } from '../../lib/auditLog';
import { batchOf, canRevert, fetchProductHistory, revertProductFields, visibleChanges } from '../../lib/productHistory';
import { confirmDialog } from '../../lib/dialog';
import { showToast } from '../../lib/toast';

function show(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'tak' : 'nie';
  if (Array.isArray(value)) return value.length ? `${value.length} poz.: ${value.slice(0, 2).join(', ')}${value.length > 2 ? '…' : ''}` : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  const s = String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > 140 ? `${s.slice(0, 140)}…` : s || '—';
}

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Zakładka „Historia”: kto i kiedy zmienił pola produktu, z możliwością przywrócenia dawnej wartości. */
export function ProductHistoryPanel({
  sku,
  canEdit,
  onReverted,
}: {
  sku: string;
  canEdit: boolean;
  /** Wywoływane po przywróceniu — rodzic odświeża produkt. */
  onReverted: () => void;
}) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchProductHistory(sku));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wczytać historii');
    }
  }, [sku]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  async function revert(entry: AuditEntry, label: string, change: AuditChange) {
    const ok = await confirmDialog({
      title: 'Przywrócenie wartości',
      message: `Przywrócić pole „${label}” do wartości: ${show(change.from)}?\n(obecna wartość zostanie zastąpiona; zmiana trafi do historii)`,
      confirmLabel: 'Przywróć',
      tone: 'warn',
    });
    if (!ok) return;
    const key = `${entry.id}:${label}`;
    setBusyKey(key);
    try {
      await revertProductFields(sku, [{ label, value: change.from }]);
      showToast(`Przywrócono „${label}”`, 'ok');
      await load();
      onReverted();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się przywrócić', 'error', 7000);
    } finally {
      setBusyKey(null);
    }
  }

  if (error) {
    return (
      <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        Nie udało się wczytać historii: {error}. Jeśli widzisz tylko własne zmiany, uruchom migrację migration-audit-log-product-history.sql.
      </p>
    );
  }
  if (!rows) {
    return (
      <p className="inline-flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Wczytuję historię…
      </p>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
        <History className="mx-auto mb-2 h-6 w-6 text-slate-500" />
        Brak zapisanych zmian tego produktu. Historia zaczyna się od momentu włączenia dziennika aktywności.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {rows.map((e) => {
        const batch = batchOf(e);
        const changes = visibleChanges(e.changes);
        return (
          <li key={e.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100">
                <User className="h-3.5 w-3.5 text-slate-500" />
                {e.userLabel || 'ktoś'}
              </span>
              <span className="text-slate-500">{when(e.createdAt)}</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                {AUDIT_ACTION_LABELS[e.action] ?? e.action}
              </span>
              {batch && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-200" title="Zmiana wykonana w ramach operacji masowej">
                  <Layers className="h-3 w-3" /> {batch.label}
                </span>
              )}
            </div>
            <ul className="mt-2 divide-y divide-slate-800">
              {changes.map(([label, ch]) => {
                const rc = canRevert(label, ch);
                const key = `${e.id}:${label}`;
                return (
                  <li key={label} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                    <span className="w-44 shrink-0 text-xs font-semibold text-slate-300">{label.replace(/^meta: /, '')}</span>
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="text-rose-300/90 line-through decoration-rose-400/40">{show(ch.from)}</span>
                      <span className="mx-2 text-slate-500">→</span>
                      <span className="text-emerald-300">{show(ch.to)}</span>
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        disabled={!rc.ok || busyKey !== null}
                        title={rc.ok ? 'Przywróć starą wartość' : rc.reason}
                        onClick={() => void revert(e, label, ch)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-30"
                      >
                        {busyKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                        Przywróć
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
