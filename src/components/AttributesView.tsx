import { ListChecks, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../types';
import {
  ATTR_TYPE_LABEL,
  attributeCoverage,
  deleteAttribute,
  saveAttribute,
  slugKey,
  useAttributesVersion,
  getAttributes,
  type AttrType,
  type AttributeDef,
} from '../lib/attributes';
import { flattenCategories, useCategoryRegistry } from '../lib/categoryRegistry';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';

const EMPTY: AttributeDef = { key: '', label: '', type: 'text', unit: '', options: [], categories: [], required: false, sort: 0 };

/** Atrybuty strukturalne: definicje (typ, jednostka, lista wartości, kategorie) i pokrycie w produktach. */
export function AttributesView({ products, canEdit }: { products: Product[]; canEdit: boolean }) {
  const version = useAttributesVersion();
  useCategoryRegistry();
  const [draft, setDraft] = useState<AttributeDef | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const coverage = useMemo(() => attributeCoverage(products, getAttributes()), [products, version]);
  const shown = coverage.filter((c) => !query.trim() || c.def.label.toLowerCase().includes(query.trim().toLowerCase()));

  async function remove(def: AttributeDef) {
    const ok = await confirmDialog({
      title: 'Usunięcie atrybutu',
      message: `Usunąć definicję atrybutu „${def.label}”? Wartości zapisane w produktach zostają, ale przestaną być widoczne w karcie.`,
      confirmLabel: 'Usuń',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteAttribute(def.key);
      showToast('Atrybut usunięty', 'ok');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się usunąć', 'error', 6000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="catalog-readable-light w-full space-y-4 pb-10">
      {draft && <AttributeEditor initial={draft} isNew={isNew} onClose={() => setDraft(null)} />}

      <section className="surface-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Porządkowanie katalogu</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-950 dark:text-slate-50">
              <ListChecks className="h-5 w-5" /> Atrybuty produktów
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-700 dark:text-slate-400">
              Strukturalne parametry (pojemność, stężenie, zapach, kolor…) zdefiniowane per kategoria. W karcie produktu pojawiają się tylko te,
              które obowiązują w jego kategorii; można je też uzupełniać hurtem, eksportować i liczyć ich kompletność.
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setIsNew(true);
                setDraft({ ...EMPTY });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" /> Nowy atrybut
            </button>
          )}
        </div>
      </section>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj atrybutu…" className="input-field with-icon" />
      </div>

      {shown.length === 0 ? (
        <div className="surface-panel p-8 text-center text-sm text-slate-700 dark:text-slate-400">
          {coverage.length === 0
            ? 'Brak zdefiniowanych atrybutów. Dodaj pierwszy, np. „Pojemność” (liczba, jednostka l) dla kategorii chemii. Jeśli dodawanie kończy się błędem, uruchom migrację migration-catalog-attributes.sql.'
            : 'Nic nie pasuje do wyszukiwania.'}
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ def, inScope, filled, pct }) => (
            <li key={def.key} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-950 dark:text-slate-50">
                    {def.label}
                    {def.required && <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-500/20 dark:text-rose-300">wymagany</span>}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {ATTR_TYPE_LABEL[def.type]}
                    {def.unit ? ` · ${def.unit}` : ''}
                    {def.type === 'select' ? ` · ${def.options.length} wartości` : ''}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNew(false);
                        setDraft({ ...def, options: [...def.options], categories: [...def.categories] });
                      }}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Edytuj"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={busy} onClick={() => void remove(def)} className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-500/20" aria-label="Usuń">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-[11px] text-slate-600 dark:text-slate-400">
                {def.categories.length ? `Kategorie: ${def.categories.join(', ')}` : 'Wszystkie kategorie'}
              </p>
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span>
                    uzupełniono {filled} z {inScope}
                  </span>
                  <span className="font-semibold tabular-nums">{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div className={`h-full rounded-full ${pct < 40 ? 'bg-rose-500' : pct < 75 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttributeEditor({ initial, isNew, onClose }: { initial: AttributeDef; isNew: boolean; onClose: () => void }) {
  const [def, setDef] = useState<AttributeDef>(initial);
  const [optionsText, setOptionsText] = useState(initial.options.join('\n'));
  const [catQuery, setCatQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const flat = useMemo(() => flattenCategories(), []);
  const groups = flat.filter((c) => !c.isLeaf || c.depth === 0);
  const shownCats = (catQuery.trim() ? flat : groups).filter((c) => !catQuery.trim() || c.name.toLowerCase().includes(catQuery.trim().toLowerCase())).slice(0, 80);

  async function save() {
    if (!def.label.trim()) return showToast('Podaj nazwę atrybutu', 'warn');
    setSaving(true);
    try {
      await saveAttribute({
        ...def,
        key: isNew ? slugKey(def.label) : def.key,
        options: optionsText.split('\n').map((o) => o.trim()).filter(Boolean),
      });
      showToast('Atrybut zapisany', 'ok');
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 7000);
    } finally {
      setSaving(false);
    }
  }

  const sel = 'input-field text-sm';
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-2 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h3 className="text-base font-bold text-slate-50">{isNew ? 'Nowy atrybut' : `Atrybut: ${initial.label}`}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" aria-label="Zamknij">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-slate-400 sm:col-span-2">
              Nazwa
              <input value={def.label} onChange={(e) => setDef({ ...def, label: e.target.value })} className={`${sel} mt-1`} placeholder="np. Pojemność" />
            </label>
            <label className="block text-xs text-slate-400">
              Typ
              <select value={def.type} onChange={(e) => setDef({ ...def, type: e.target.value as AttrType })} className={`${sel} mt-1`}>
                {(Object.keys(ATTR_TYPE_LABEL) as AttrType[]).map((t) => (
                  <option key={t} value={t}>
                    {ATTR_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            {(def.type === 'number' || def.type === 'text') && (
              <label className="block text-xs text-slate-400">
                Jednostka (opcjonalnie)
                <input value={def.unit} onChange={(e) => setDef({ ...def, unit: e.target.value })} className={`${sel} mt-1`} placeholder="np. l, ml, kg, %" />
              </label>
            )}
            {def.type === 'select' && (
              <label className="block text-xs text-slate-400 sm:col-span-2">
                Dozwolone wartości (jedna w wierszu)
                <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={5} className={`${sel} mt-1`} placeholder={'np.\nczerwony\nniebieski\nzielony'} />
              </label>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={def.required} onChange={(e) => setDef({ ...def, required: e.target.checked })} className="h-4 w-4 accent-brand-500" />
            Wymagany — brak wartości będzie zgłaszany w Uzupełnianiu danych
          </label>

          <section>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Kategorie, w których obowiązuje ({def.categories.length || 'wszystkie'}) — obejmuje też podkategorie
            </p>
            <input value={catQuery} onChange={(e) => setCatQuery(e.target.value)} placeholder="Szukaj kategorii…" className={`${sel} mb-2`} />
            <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {shownCats.map((c) => {
                const on = def.categories.some((x) => x.toLowerCase() === c.name.toLowerCase());
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() =>
                      setDef({
                        ...def,
                        categories: on ? def.categories.filter((x) => x.toLowerCase() !== c.name.toLowerCase()) : [...def.categories, c.name],
                      })
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${on ? 'border-brand-500 bg-brand-500/15 text-brand-200' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            {def.categories.length > 0 && (
              <button type="button" onClick={() => setDef({ ...def, categories: [] })} className="mt-2 text-xs font-semibold text-brand-300 hover:underline">
                wyczyść (obowiązuje we wszystkich kategoriach)
              </button>
            )}
          </section>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
            Anuluj
          </button>
          <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Zapisz atrybut
          </button>
        </div>
      </div>
    </div>
  );
}
