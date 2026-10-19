import { ChevronDown, ChevronRight, Layers, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAuditLog, type AuditEntry } from '../lib/auditLog';
import { groupBatches, undoBatch, visibleChanges, type BatchGroup } from '../lib/productHistory';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';

const DAYS = 30;

function show(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'tak' : 'nie';
  if (Array.isArray(value)) return value.join(', ') || '—';
  const s = String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > 60 ? `${s.slice(0, 60)}…` : s || '—';
}

/** Operacje masowe z ostatnich 30 dni (edycja masowa, import…) z możliwością cofnięcia całej partii. */
export function BulkOperationsPanel({ canUndo }: { canUndo: boolean }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ id: string; done: number; total: number } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
      const all: AuditEntry[] = [];
      let before: string | undefined;
      for (let page = 0; page < 6; page++) {
        const batch = await fetchAuditLog({ entityType: 'product', since, limit: 1000, before });
        all.push(...batch);
        if (batch.length < 1000) break;
        before = batch[batch.length - 1].createdAt;
      }
      setEntries(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wczytać operacji');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const batches = useMemo(() => groupBatches(entries ?? []), [entries]);
  const undone = useMemo(() => new Set(batches.map((b) => b.undoes).filter(Boolean) as string[]), [batches]);

  async function undo(b: BatchGroup) {
    const skus = new Set(b.entries.map((e) => e.entityId));
    const ok = await confirmDialog({
      title: 'Cofnięcie operacji masowej',
      message: `Cofnąć „${b.label}” dla ${skus.size} produktów? Pola zmienione w tej operacji wrócą do wartości sprzed niej (nadpisze późniejsze zmiany tych pól).`,
      confirmLabel: 'Cofnij całość',
      tone: 'warn',
    });
    if (!ok) return;
    setBusy({ id: b.id, done: 0, total: skus.size });
    try {
      const res = await undoBatch(b, (done, total) => setBusy({ id: b.id, done, total }));
      showToast(
        res.errors.length
          ? `Cofnięto ${res.restored} pól, błędy: ${res.errors.length} (${res.errors[0]})`
          : `Cofnięto operację: przywrócono ${res.restored} pól${res.skipped ? `, pominięto ${res.skipped} (nie do cofnięcia)` : ''}`,
        res.errors.length ? 'warn' : 'ok',
        8000,
      );
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się cofnąć', 'error', 8000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-50">
              <Layers className="h-4 w-4" /> Operacje masowe
            </h3>
            <p className="mt-1 max-w-3xl text-xs text-slate-400">
              Zmiany wykonane hurtem (edycja masowa, cofnięcia) z ostatnich {DAYS} dni. Każdą partię można cofnąć jednym kliknięciem —
              produkty wracają do wartości sprzed operacji. Pojedyncze pola cofniesz w zakładce „Historia” produktu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" /> Odśwież
          </button>
        </div>
      </section>

      {error && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{error}</p>}
      {!entries && !error && (
        <p className="inline-flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Wczytuję…
        </p>
      )}
      {entries && batches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          Brak operacji masowych w ostatnich {DAYS} dniach.
        </div>
      )}

      <ul className="space-y-2">
        {batches.map((b) => {
          const skus = new Set(b.entries.map((e) => e.entityId));
          const fields = b.entries.reduce((s, e) => s + visibleChanges(e.changes).length, 0);
          const isUndo = Boolean(b.undoes);
          const isUndone = undone.has(b.id);
          const isOpen = open === b.id;
          const working = busy?.id === b.id;
          return (
            <li key={b.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setOpen(isOpen ? null : b.id)} className="text-slate-400 hover:text-slate-100" aria-label="Szczegóły">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">{b.label}</p>
                  <p className="text-[11px] text-slate-500">
                    {b.userLabel || 'ktoś'} · {new Date(b.at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} ·{' '}
                    {skus.size} produktów · {fields} zmian pól
                  </p>
                </div>
                {isUndone && <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">cofnięta</span>}
                {isUndo && <span className="rounded-full bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200">cofnięcie</span>}
                {canUndo && !isUndone && !isUndo && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void undo(b)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
                  >
                    {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    {working ? `Cofam ${busy?.done}/${busy?.total}…` : 'Cofnij całość'}
                  </button>
                )}
              </div>
              {isOpen && (
                <ul className="max-h-72 divide-y divide-slate-800 overflow-y-auto border-t border-slate-800 bg-slate-950/40 px-4">
                  {b.entries.slice(0, 200).map((e) => (
                    <li key={e.id} className="py-1.5 text-xs">
                      <span className="font-mono text-slate-300">{e.entityId}</span>
                      <span className="ml-2 text-slate-500">{e.entityLabel}</span>
                      <div className="mt-0.5 space-y-0.5 pl-2">
                        {visibleChanges(e.changes).map(([label, ch]) => (
                          <p key={label} className="text-slate-400">
                            {label.replace(/^meta: /, '')}: <span className="text-rose-300/90">{show(ch.from)}</span> →{' '}
                            <span className="text-emerald-300">{show(ch.to)}</span>
                          </p>
                        ))}
                      </div>
                    </li>
                  ))}
                  {b.entries.length > 200 && <li className="py-2 text-center text-[11px] text-slate-500">…i {b.entries.length - 200} kolejnych</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
