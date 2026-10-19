import { ChevronDown, ChevronRight, Loader2, Pencil, Play, Plus, Sparkles, Trash2, Wand2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product } from '../types';
import {
  FIELD_LABEL,
  FIELD_OPS,
  NO_VALUE_OPS,
  OP_LABEL,
  RULE_TEMPLATES,
  actionWouldChange,
  deleteRule,
  describeAction,
  describeCondition,
  fetchRules,
  matchesRule,
  ruleIsValid,
  runRule,
  saveRule,
  type CatalogRule,
  type RuleAction,
  type RuleCondition,
  type RuleField,
  type RuleOp,
  type RuleRunResult,
} from '../lib/catalogRules';
import { HIDE_REASON_PRESETS } from '../lib/hideReasons';
import { EXCEPTION_PRESETS } from '../lib/dataExceptions';
import { getAssignableCategories, useCategoryRegistry } from '../lib/categoryRegistry';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';
import { ManufacturerSelect } from './ManufacturerSelect';

type Draft = Omit<CatalogRule, 'id'> & { id?: string };

const EMPTY_DRAFT: Draft = {
  name: '',
  enabled: true,
  conditions: [{ field: 'name', op: 'contains', value: '' }],
  action: { type: 'hide', reason: HIDE_REASON_PRESETS[0] },
};

const ACTION_TYPES: { type: RuleAction['type']; label: string }[] = [
  { type: 'hide', label: 'Ukryj produkt' },
  { type: 'setCategory', label: 'Ustaw kategorię' },
  { type: 'setManufacturer', label: 'Ustaw producenta' },
  { type: 'addTag', label: 'Dodaj tag' },
  { type: 'exception', label: 'Ustaw wyjątek (nie wymaga uzupełnień)' },
];

function defaultAction(type: RuleAction['type']): RuleAction {
  if (type === 'hide') return { type, reason: HIDE_REASON_PRESETS[0] };
  if (type === 'exception') return { type, kinds: EXCEPTION_PRESETS[0].kinds, note: EXCEPTION_PRESETS[0].note };
  return { type, value: '' } as RuleAction;
}

/** Reguły jakości: warunki + akcja, z podglądem dopasowanych produktów i cofalnym uruchomieniem. */
export function RulesView({
  products,
  canEdit,
  onApplied,
}: {
  products: Product[];
  canEdit: boolean;
  onApplied: (rule: CatalogRule, result: RuleRunResult) => void;
}) {
  const [rules, setRules] = useState<CatalogRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRules(await fetchRules());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wczytać reguł');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const matches = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const r of rules ?? []) {
      map.set(r.id, products.filter((p) => matchesRule(p, r.conditions) && actionWouldChange(p, r.action)));
    }
    return map;
  }, [rules, products]);

  async function run(rule: CatalogRule) {
    const list = matches.get(rule.id) ?? [];
    if (!list.length) return;
    const ok = await confirmDialog({
      title: 'Uruchomienie reguły',
      message: `Reguła „${rule.name}”: ${describeAction(rule.action)}\nzostanie zastosowana do ${list.length} produktów. Całą operację cofniesz w Logi → Operacje masowe.`,
      confirmLabel: `Zastosuj (${list.length})`,
      tone: 'warn',
    });
    if (!ok) return;
    setBusy(rule.id);
    try {
      const res = await runRule(rule, list);
      onApplied(rule, res);
      showToast(
        res.failed ? `Zastosowano do ${res.affected}, błędy: ${res.failed}` : `Zastosowano regułę do ${res.affected} produktów`,
        res.failed ? 'warn' : 'ok',
        7000,
      );
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się uruchomić reguły', 'error', 8000);
    } finally {
      setBusy(null);
    }
  }

  async function toggle(rule: CatalogRule) {
    try {
      await saveRule({ ...rule, enabled: !rule.enabled });
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 6000);
    }
  }

  async function remove(rule: CatalogRule) {
    const ok = await confirmDialog({ title: 'Usunięcie reguły', message: `Usunąć regułę „${rule.name}”? (zmiany już wykonane zostają)`, confirmLabel: 'Usuń', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteRule(rule);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się usunąć', 'error', 6000);
    }
  }

  return (
    <div className="catalog-readable-light w-full space-y-4 pb-10">
      {draft && (
        <RuleEditor
          draft={draft}
          products={products}
          onClose={() => setDraft(null)}
          onSaved={async () => {
            setDraft(null);
            await load();
          }}
        />
      )}

      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Porządkowanie katalogu</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-950 dark:text-slate-50">
              <Wand2 className="h-5 w-5" /> Reguły jakości
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-700 dark:text-slate-400">
              Reguła to „jeśli produkt spełnia warunki, to wykonaj akcję” (ustaw kategorię lub producenta, dodaj tag, ukryj, ustaw wyjątek).
              Przed uruchomieniem widzisz, których produktów dotyczy, a cała operacja jest jedną partią do cofnięcia.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setDraft({ ...EMPTY_DRAFT, conditions: EMPTY_DRAFT.conditions.map((c) => ({ ...c })) })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" /> Nowa reguła
            </button>
          )}
        </div>
      </section>

      {error && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">{error}</p>}
      {!rules && !error && (
        <p className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Wczytuję reguły…
        </p>
      )}

      {rules && rules.length === 0 && (
        <section className="surface-panel p-5">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Sparkles className="h-4 w-4 text-amber-500" /> Zacznij od szablonu
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {RULE_TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                disabled={!canEdit}
                onClick={() => setDraft({ ...t, enabled: true, conditions: t.conditions.map((c) => ({ ...c })) })}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-brand-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t.name}</span>
                <span className="mt-1 block text-[11px] text-slate-600 dark:text-slate-400">
                  {t.conditions.map(describeCondition).join(' i ')} → {describeAction(t.action)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <ul className="space-y-2">
        {(rules ?? []).map((r) => {
          const list = matches.get(r.id) ?? [];
          const isOpen = open === r.id;
          return (
            <li key={r.id} className={`overflow-hidden rounded-2xl border bg-white dark:bg-slate-950/30 ${r.enabled ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 opacity-60 dark:border-slate-800'}`}>
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100" aria-label="Podgląd">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-950 dark:text-slate-50">{r.name}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Jeśli {r.conditions.map(describeCondition).join(' i ')} → <strong>{describeAction(r.action)}</strong>
                  </p>
                  {r.lastRunAt && (
                    <p className="text-[10px] text-slate-500">
                      Ostatnio uruchomiona {new Date(r.lastRunAt).toLocaleDateString('pl-PL')}
                      {r.lastRunCount != null ? ` (${r.lastRunCount} produktów)` : ''}
                    </p>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold tabular-nums ${list.length ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                  {list.length ? `${list.length} do zmiany` : 'nic do zmiany'}
                </span>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      disabled={!r.enabled || list.length === 0 || busy !== null}
                      onClick={() => void run(r)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
                    >
                      {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Zastosuj
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                      <input type="checkbox" checked={r.enabled} onChange={() => void toggle(r)} className="h-4 w-4 accent-brand-500" /> aktywna
                    </label>
                    <button type="button" onClick={() => setDraft({ ...r, conditions: r.conditions.map((c) => ({ ...c })) })} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Edytuj">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => void remove(r)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-500/20" aria-label="Usuń">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              {isOpen && (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                  {list.length === 0 ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400">Żaden produkt nie wymaga teraz zmiany.</p>
                  ) : (
                    <ul className="max-h-64 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
                      {list.slice(0, 40).map((p) => (
                        <li key={p.id} className="py-1.5 text-xs">
                          <span className="font-mono text-slate-600 dark:text-slate-400">{p.sku}</span>{' '}
                          <span className="text-slate-900 dark:text-slate-100">{p.displayName}</span>
                        </li>
                      ))}
                      {list.length > 40 && <li className="py-2 text-center text-[11px] text-slate-500">…i {list.length - 40} kolejnych</li>}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {rules && rules.length > 0 && canEdit && (
        <details className="surface-panel p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800 dark:text-slate-200">Szablony reguł</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {RULE_TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => setDraft({ ...t, enabled: true, conditions: t.conditions.map((c) => ({ ...c })) })}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{t.name}</span>
                <span className="mt-1 block text-[11px] text-slate-600 dark:text-slate-400">{t.conditions.map(describeCondition).join(' i ')} → {describeAction(t.action)}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function RuleEditor({
  draft: initial,
  products,
  onClose,
  onSaved,
}: {
  draft: Draft;
  products: Product[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  useCategoryRegistry();
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const categories = useMemo(
    () => getAssignableCategories().sort((a, b) => a.localeCompare(b, 'pl')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const error = ruleIsValid(draft);
  const preview = useMemo(
    () => (error ? [] : products.filter((p) => matchesRule(p, draft.conditions) && actionWouldChange(p, draft.action))),
    [draft, products, error],
  );

  function patchCondition(i: number, patch: Partial<RuleCondition>) {
    setDraft((d) => ({ ...d, conditions: d.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  }

  async function save() {
    const err = ruleIsValid(draft);
    if (err) return showToast(err, 'warn');
    setSaving(true);
    try {
      await saveRule(draft);
      showToast('Reguła zapisana', 'ok');
      await onSaved();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error', 7000);
    } finally {
      setSaving(false);
    }
  }

  const a = draft.action;
  const sel = 'input-field text-sm';

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h3 className="text-base font-bold text-slate-50">{draft.id ? 'Edycja reguły' : 'Nowa reguła'}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-xs text-slate-400">
            Nazwa reguły
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${sel} mt-1`} placeholder="np. Części myjek → ukryj" />
          </label>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Jeśli produkt spełnia wszystkie warunki:</p>
            {draft.conditions.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={c.field}
                  onChange={(e) => {
                    const field = e.target.value as RuleField;
                    patchCondition(i, { field, op: FIELD_OPS[field][0], value: '' });
                  }}
                  className={`${sel} !w-44`}
                >
                  {(Object.keys(FIELD_LABEL) as RuleField[]).map((f) => (
                    <option key={f} value={f}>
                      {FIELD_LABEL[f]}
                    </option>
                  ))}
                </select>
                <select value={c.op} onChange={(e) => patchCondition(i, { op: e.target.value as RuleOp })} className={`${sel} !w-44`}>
                  {FIELD_OPS[c.field].map((op) => (
                    <option key={op} value={op}>
                      {OP_LABEL[op]}
                    </option>
                  ))}
                </select>
                {!NO_VALUE_OPS.includes(c.op) && (
                  <input value={c.value} onChange={(e) => patchCondition(i, { value: e.target.value })} className={`${sel} min-w-0 flex-1`} placeholder="wartość" />
                )}
                <button
                  type="button"
                  disabled={draft.conditions.length === 1}
                  onClick={() => setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, idx) => idx !== i) }))}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 disabled:opacity-30"
                  aria-label="Usuń warunek"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, conditions: [...d.conditions, { field: 'name', op: 'contains', value: '' }] }))}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-300 hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> dodaj warunek
            </button>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">To wykonaj:</p>
            <select value={a.type} onChange={(e) => setDraft({ ...draft, action: defaultAction(e.target.value as RuleAction['type']) })} className={sel}>
              {ACTION_TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
            {a.type === 'hide' && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {HIDE_REASON_PRESETS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setDraft({ ...draft, action: { type: 'hide', reason: r } })}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${a.reason === r ? 'border-rose-500 bg-rose-500/15 text-rose-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input value={a.reason} onChange={(e) => setDraft({ ...draft, action: { type: 'hide', reason: e.target.value } })} className={sel} placeholder="Powód ukrycia" />
              </>
            )}
            {a.type === 'setCategory' && (
              <select value={a.value} onChange={(e) => setDraft({ ...draft, action: { type: 'setCategory', value: e.target.value } })} className={sel}>
                <option value="">— wybierz kategorię —</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
            {a.type === 'setManufacturer' && <ManufacturerSelect value={a.value} onChange={(v) => setDraft({ ...draft, action: { type: 'setManufacturer', value: v } })} />}
            {a.type === 'addTag' && <input value={a.value} onChange={(e) => setDraft({ ...draft, action: { type: 'addTag', value: e.target.value } })} className={sel} placeholder="Nazwa tagu" />}
            {a.type === 'exception' && (
              <div className="grid gap-1.5">
                {EXCEPTION_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setDraft({ ...draft, action: { type: 'exception', kinds: p.kinds, note: p.note } })}
                    className={`rounded-xl border px-3 py-2 text-left text-sm ${JSON.stringify(a.kinds) === JSON.stringify(p.kinds) ? 'border-violet-500 bg-violet-500/10 text-violet-100' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}
                  >
                    {p.label} <span className="text-[11px] text-slate-400">— {p.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-xs font-semibold text-slate-300">Podgląd: {error ? <span className="text-amber-300">{error}</span> : `${preview.length} produktów do zmiany`}</p>
            {!error && preview.length > 0 && (
              <ul className="mt-2 max-h-40 divide-y divide-slate-800 overflow-y-auto text-xs">
                {preview.slice(0, 20).map((p) => (
                  <li key={p.id} className="py-1">
                    <span className="font-mono text-slate-400">{p.sku}</span> <span className="text-slate-200">{p.displayName}</span>
                  </li>
                ))}
                {preview.length > 20 && <li className="py-1 text-center text-[11px] text-slate-500">…i {preview.length - 20} kolejnych</li>}
              </ul>
            )}
          </section>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
            Anuluj
          </button>
          <button
            type="button"
            disabled={saving || Boolean(error)}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Zapisz regułę
          </button>
        </div>
      </div>
    </div>
  );
}
