import { Download, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../../types';
import { downloadText } from '../../lib/assortmentAudit';
import { withAuditBatch } from '../../lib/auditLog';
import { confirmDialog } from '../../lib/dialog';
import type { NameRow, NameStats } from '../../lib/engineNames';
import { updateProduct } from '../../lib/products';
import { showToast } from '../../lib/toast';
import { TECH_NAME_MAX } from '../../lib/technicalNames';
import { btn, btnPrimary, card, Disclosure, field, FilterBar, FilterField, inner, Pill, Stat, SubTabs } from './ui';

type StatusFilter = 'todo' | 'sprawdz' | 'dubel' | 'zgodna' | 'all';

const STATUSES: [StatusFilter, string][] = [
  ['todo', 'Do ujednolicenia'],
  ['sprawdz', 'Do sprawdzenia'],
  ['dubel', 'Dubel'],
  ['zgodna', 'Zgodne'],
  ['all', 'Wszystko'],
];

const EXAMPLES: [string, string][] = [
  ['NYPEL MOSIĄDZ GZ3/8 - GW1/4', 'Nypel mosiężny GZ 3/8 × GW 1/4'],
  ['LANCA DO OPRYSKU STAL 60cm', 'Lanca stalowa do opryskiwania 600mm'],
  ['WĄŻ CIŚNIEN. 8 x 2 400bar 20m czarny', 'Wąż ciśnieniowy 8x2 400bar 20m czarny'],
];

const GRID = 'md:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1.25fr)_5rem]';

/** Standard nazw rodzin: jeden szyk nazw dla produktów o wielu wersjach (nyple, lance, dysze, węże, redukcje…). */
export function NamesTab({ rows, stats, canEdit, onPatched }: { rows: NameRow[]; stats: NameStats; canEdit: boolean; onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void }) {
  const [family, setFamily] = useState('');
  const [status, setStatus] = useState<StatusFilter>('todo');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(40);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const families = useMemo(() => {
    const m = new Map<string, { total: number; todo: number }>();
    for (const r of rows) {
      const e = m.get(r.result.family) ?? { total: 0, todo: 0 };
      e.total++;
      if (r.status !== 'zgodna') e.todo++;
      m.set(r.result.family, e);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [rows]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      rows.filter((r) => {
        if (family && r.result.family !== family) return false;
        if (status === 'todo' && r.status !== 'zmiana') return false;
        if (status === 'sprawdz' && r.status !== 'sprawdz') return false;
        if (status === 'zgodna' && r.status !== 'zgodna') return false;
        if (status === 'dubel' && !r.dupWith.length) return false;
        if (q && !`${r.product.sku} ${r.current} ${r.result.name}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    [rows, family, status, q],
  );

  const nameOf = (r: NameRow) => (edits[r.product.id] ?? r.result.name).trim();
  const changed = (r: NameRow) => nameOf(r) !== r.current && !!nameOf(r);

  async function apply(items: NameRow[], label: string) {
    const todo = items.filter(changed);
    if (!canEdit || !todo.length || busy) return;
    const ok = await confirmDialog({
      title: 'Ujednolicenie nazw',
      message: `Zmienię nazwę w ${todo.length} produktach na zgodną ze standardem. Zmiana jest zapisana w dzienniku jako jedna operacja i da się ją cofnąć w Logi → Operacje masowe.`,
      confirmLabel: 'Zmień nazwy',
      tone: 'warn',
    });
    if (!ok) return;
    setBusy(true);
    const done: { id: string; patch: Partial<Product> }[] = [];
    const failed: string[] = [];
    try {
      await withAuditBatch(`${label}: ${todo.length} produktów`, async () => {
        for (let i = 0; i < todo.length; i += 8) {
          await Promise.all(
            todo.slice(i, i + 8).map(async (r) => {
              const name = nameOf(r);
              try {
                await updateProduct(r.product.id, { displayName: name });
                done.push({ id: r.product.id, patch: { displayName: name } });
              } catch {
                failed.push(r.product.sku);
              }
            }),
          );
        }
      });
    } finally {
      if (done.length) onPatched(done);
      setBusy(false);
      setSelected(new Set());
      setEdits((e) => {
        const next = { ...e };
        for (const d of done) delete next[d.id];
        return next;
      });
    }
    showToast(failed.length ? `Zmieniono ${done.length}, błędy: ${failed.length}` : `Zmieniono nazwy: ${done.length}`, failed.length ? 'warn' : 'ok', 6000);
  }

  const sureInView = visible.filter((r) => r.status === 'zmiana' && changed(r));
  const selectedRows = rows.filter((r) => selected.has(r.product.id));
  const count = (s: StatusFilter) => (s === 'todo' ? stats.sure : s === 'sprawdz' ? stats.check : s === 'dubel' ? stats.dups : s === 'zgodna' ? stats.ok : stats.total);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Produktów w rodzinach" value={stats.total.toLocaleString('pl-PL')} />
        <Stat label="Już zgodne" value={`${stats.total ? Math.round((100 * stats.ok) / stats.total) : 0}%`} tone="ok" />
        <Stat label="Do ujednolicenia" value={stats.sure} tone={stats.sure ? 'warn' : undefined} />
        <Stat label="Do sprawdzenia" value={stats.check} />
        <Stat label="Dubli po ujednoliceniu" value={stats.dups} tone={stats.dups ? 'bad' : undefined} />
      </div>

      <Disclosure title="Jak ATLAS układa nazwy" summary="jeden szyk dla wszystkich rodzin produktów">
        <p className="mb-2 text-[13px] text-slate-500">
          Produkty o wielu wersjach (nyple, lance, dysze, węże, redukcje…) mają różne zapisy tego samego: <span className="font-mono">GZ3/8</span>, <span className="font-mono">Gw 3/8</span>, <span className="font-mono">3/8 M</span>. ATLAS rozbija nazwę
          na pola i składa ją zawsze w tym szyku:
        </p>
        <p className={`${inner} px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100`}>
          Rodzaj · cecha · materiał · do czego · model · przyłącza (A × B) · wymiary · kolor · <span className="font-normal text-slate-500">- opis i kod</span>
        </p>
        <div className="mt-2 grid gap-1.5 text-xs md:grid-cols-3">
          {EXAMPLES.map(([a, b]) => (
            <div key={a} className={`${inner} px-3 py-2`}>
              <p className="text-slate-500 line-through decoration-slate-400/60">{a}</p>
              <p className="font-semibold text-slate-900 dark:text-slate-50">{b}</p>
            </div>
          ))}
        </div>
      </Disclosure>

      <section className={`${card} space-y-3`}>
        <SubTabs
          value={status}
          onChange={(s) => {
            setStatus(s);
            setLimit(40);
          }}
          items={STATUSES.map(([id, label]) => ({ id, label, count: count(id) }))}
        />
        <FilterBar
          query={query}
          onQuery={(v) => {
            setQuery(v);
            setLimit(40);
          }}
          placeholder="Szukaj SKU lub nazwy…"
          activeFilters={family ? 1 : 0}
          onReset={() => setFamily('')}
          extra={
            <FilterField label="Rodzina produktów">
              <select
                className={field}
                value={family}
                onChange={(e) => {
                  setFamily(e.target.value);
                  setLimit(40);
                }}
              >
                <option value="">Wszystkie rodziny</option>
                {families.map(([name, e]) => (
                  <option key={name} value={name}>
                    {name} · {e.total}
                    {e.todo ? ` (do zmiany: ${e.todo})` : ''}
                  </option>
                ))}
              </select>
            </FilterField>
          }
          actions={
            <>
              {canEdit && selectedRows.length > 0 && (
                <button type="button" className={btn} disabled={busy} onClick={() => void apply(selectedRows, 'Standard nazw rodzin (wybrane)')}>
                  Zastosuj zaznaczone ({selectedRows.length})
                </button>
              )}
              {canEdit && (
                <button type="button" className={btnPrimary} disabled={busy || !sureInView.length} onClick={() => void apply(sureInView, 'Standard nazw rodzin')}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Zastosuj pewne ({sureInView.length})
                </button>
              )}
              <button
                type="button"
                className={btn}
                title="Pobierz widok jako CSV"
                onClick={() =>
                  downloadText(
                    `nazwy-rodzin-${new Date().toISOString().slice(0, 10)}.csv`,
                    '﻿' +
                      ['SKU;Rodzina;Przed;Po;Status;Uwagi;Dubel z']
                        .concat(visible.map((r) => [r.product.sku, r.result.family, r.current, nameOf(r), r.status, r.result.notes.join(', '), r.dupWith.join(' ')].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')))
                        .join('\r\n'),
                    'text/csv',
                  )
                }
              >
                <Download className="h-4 w-4" /> CSV
              </button>
            </>
          }
        />

        <div className={`hidden gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid ${GRID}`}>
          <span />
          <span>Obecna nazwa</span>
          <span>Po ujednoliceniu (możesz poprawić)</span>
          <span />
        </div>
        <ul className="divide-y divide-black/10 dark:divide-white/10">
          {visible.slice(0, limit).map((r) => {
            const after = nameOf(r);
            const len = after.length;
            return (
              <li key={r.product.id} className={`grid items-start gap-x-3 gap-y-1.5 py-3 ${GRID}`}>
                <div className="pt-1.5">
                  {canEdit && r.status !== 'zgodna' && (
                    <input
                      type="checkbox"
                      aria-label={`Zaznacz ${r.product.sku}`}
                      checked={selected.has(r.product.id)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(r.product.id);
                          else next.delete(r.product.id);
                          return next;
                        })
                      }
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm ${r.status === 'zgodna' ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 line-through decoration-slate-400/60'}`}>{r.current}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="font-mono">{r.product.sku}</span>
                    <Pill tone="neutral">{r.result.family}</Pill>
                  </p>
                </div>
                <div className="min-w-0">
                  <input
                    value={after}
                    disabled={!canEdit}
                    aria-label="Nazwa po ujednoliceniu"
                    onChange={(e) => setEdits((s) => ({ ...s, [r.product.id]: e.target.value }))}
                    className={`${field} w-full font-semibold ${r.status === 'sprawdz' ? '!border-amber-500/70' : ''}`}
                  />
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className={len > TECH_NAME_MAX ? 'font-semibold text-rose-600' : ''}>{len} zn.</span>
                    {r.status === 'sprawdz' && <Pill tone="warn">sprawdź: {r.result.unknown.slice(0, 3).join(', ') || r.result.notes[0]}</Pill>}
                    {r.dupWith.length > 0 && <Pill tone="bad">taka sama nazwa: {r.dupWith.slice(0, 3).join(', ')}</Pill>}
                    {r.result.notes.length > 0 && r.status !== 'sprawdz' && <span>{r.result.notes.join('; ')}</span>}
                  </p>
                </div>
                <div className="md:text-right">
                  {canEdit && changed(r) && (
                    <button type="button" className={btn} disabled={busy} onClick={() => void apply([r], 'Standard nazw rodzin')}>
                      Zmień
                    </button>
                  )}
                </div>
              </li>
            );
          })}
          {visible.length === 0 && <li className="py-10 text-center text-sm text-slate-500">Brak pozycji w tym widoku.</li>}
        </ul>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Widać {Math.min(limit, visible.length).toLocaleString('pl-PL')} z {visible.length.toLocaleString('pl-PL')}
          </span>
          {visible.length > limit && (
            <button type="button" className={btn} onClick={() => setLimit((l) => l + 60)}>
              Pokaż więcej
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
