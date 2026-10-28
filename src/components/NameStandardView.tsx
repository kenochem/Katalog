import { useMemo, useState } from 'react';
import { CopyName } from './CopyName';
import { ArrowRight, Check, ChevronDown, ChevronUp, Loader2, Search, Sparkles, Type } from 'lucide-react';
import type { Product } from '../types';
import { exceptionsOf, type ExceptionKind } from '../lib/dataExceptions';
import {
  NAME_IDEAL,
  NAME_ISSUES,
  NAME_ISSUE_KINDS,
  NAME_MAX,
  buildNameContext,
  checkName,
  lengthTone,
  suggestName,
  type BrandRule,
  type NameIssue,
  type NameIssueKind,
  type NameSuggestion,
} from '../lib/nameStandard';

const RULES_KEY = 'catalog.nameStandard.brandRules';
const PAGE = 50;

function loadRules(): Record<string, BrandRule> {
  try {
    const raw = JSON.parse(localStorage.getItem(RULES_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

const TONE: Record<'danger' | 'warn' | 'info', string> = {
  danger: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  info: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
};

function LenBadge({ len }: { len: number }) {
  const t = lengthTone(len);
  const cls =
    t === 'danger'
      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
      : t === 'warn'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ${cls}`}>{len} zn.</span>;
}

interface Row {
  product: Product;
  issues: NameIssue[];
  suggestion: NameSuggestion;
}

export interface NameApplyItem {
  product: Product;
  name: string;
}

/** Kontrola i poprawianie nazw produktów wg standardu „PRODUCENT Nazwa Pojemność - krótki opis” (do 60 znaków). */
export function NameStandardView({
  products,
  canEdit,
  onApply,
  onSetExceptions,
  onOpenProduct,
}: {
  products: Product[];
  canEdit: boolean;
  onApply: (items: NameApplyItem[]) => Promise<{ failed: string[] }>;
  onSetExceptions?: (items: Product[], kinds: (ExceptionKind | 'all')[] | null, note: string) => Promise<void> | void;
  onOpenProduct?: (p: Product) => void;
}) {
  const [rules, setRules] = useState<Record<string, BrandRule>>(loadRules);
  const [showBrands, setShowBrands] = useState(false);
  const [kind, setKind] = useState<NameIssueKind | 'all' | 'fixable' | 'safe'>('all');
  const [query, setQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const base = useMemo(
    () =>
      products.filter((p) => {
        if (p.isGroup || p.meta?.catalogHidden) return false;
        const ex = exceptionsOf(p);
        return !ex.includes('name') && !ex.includes('all');
      }),
    [products],
  );
  const ctx = useMemo(() => buildNameContext(products, rules), [products, rules]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const product of base) {
      const issues = checkName(product, ctx);
      if (issues.length === 0) continue;
      out.push({ product, issues, suggestion: suggestName(product, ctx) });
    }
    return out;
  }, [base, ctx]);

  const counts = useMemo(() => {
    const c = {} as Record<NameIssueKind, number>;
    for (const k of NAME_ISSUE_KINDS) c[k] = 0;
    let fixable = 0;
    let safe = 0;
    for (const r of rows) {
      for (const i of r.issues) c[i.kind]++;
      if (r.suggestion.changed) {
        fixable++;
        if (!r.suggestion.needsReview) safe++;
      }
    }
    return { c, fixable, safe };
  }, [rows]);

  const brands = useMemo(() => [...new Set(rows.map((r) => r.product.manufacturer).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')), [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind === 'fixable' && !r.suggestion.changed) return false;
      if (kind === 'safe' && !(r.suggestion.changed && !r.suggestion.needsReview)) return false;
      if (kind !== 'all' && kind !== 'fixable' && kind !== 'safe' && !r.issues.some((i) => i.kind === kind)) return false;
      if (brandFilter && r.product.manufacturer !== brandFilter) return false;
      if (q && !`${r.product.sku} ${r.product.displayName} ${r.product.manufacturer}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, kind, query, brandFilter]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = visible.slice(cur * PAGE, cur * PAGE + PAGE);
  const okPct = base.length ? Math.round(((base.length - rows.length) / base.length) * 100) : 100;

  const proposed = (r: Row) => edits[r.product.id] ?? r.suggestion.name;
  const applicable = (r: Row) => {
    const v = proposed(r).trim();
    return v.length > 0 && v !== (r.product.displayName ?? '').trim();
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setRule = (key: string, rule: BrandRule) => {
    const next = { ...rules };
    if (rule === 'auto') delete next[key];
    else next[key] = rule;
    setRules(next);
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify(next));
    } catch {
      /* ignoruj */
    }
  };

  const run = async (list: Row[]) => {
    const items = list.filter(applicable).map((r) => ({ product: r.product, name: proposed(r).trim() }));
    if (items.length === 0) return;
    if (items.length > 1 && !window.confirm(`Zmienić nazwy ${items.length} produktów? Operację można cofnąć w Logi → Operacje masowe.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await onApply(items);
      setSelected(new Set());
      setEdits({});
      setMessage(res.failed.length ? `Zmieniono ${items.length - res.failed.length}, błędy: ${res.failed.length}` : `Zmieniono nazwy: ${items.length}`);
    } finally {
      setBusy(false);
    }
  };

  const selectedRows = rows.filter((r) => selected.has(r.product.id));

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-24">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-slate-50 sm:text-xl">
          <Type className="h-5 w-5 text-brand-500" /> Standard nazw produktów
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Kontrola i poprawianie nazw: zgodność z wzorem, długość, zapis pojemności i producenta.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Wzór</p>
        <p className="mt-1 font-mono text-sm text-slate-900 dark:text-slate-100">
          PRODUCENT <span className="text-sky-600 dark:text-sky-300">Nazwa własna</span> <span className="text-emerald-600 dark:text-emerald-300">Pojemność</span>
          {' - '}
          <span className="text-slate-500">krótki opis</span>
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500">np. KENOCHEM Super Gold Foam 5L - aktywna piana do mycia</p>
        <p className="mt-2 text-xs text-slate-500">
          Do {NAME_MAX} znaków (celujemy w {NAME_IDEAL}). Pojemność (5L, 750ml, 20kg) pomijamy tam, gdzie nie ma sensu — akcesoria i części. Opis jest opcjonalny i
          skracany jako pierwszy.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{okPct}%</p>
          <p className="text-xs text-slate-500">nazw zgodnych ze standardem</p>
        </div>
        <button type="button" onClick={() => setKind('all')} className="rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{rows.length}</p>
          <p className="text-xs text-slate-500">do sprawdzenia</p>
        </button>
        <button type="button" onClick={() => setKind('safe')} className="rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-2xl font-bold tabular-nums text-sky-600 dark:text-sky-400">{counts.safe}</p>
          <p className="text-xs text-slate-500">z bezpieczną poprawką</p>
        </button>
        <button type="button" onClick={() => setKind('tooLong')} className="rounded-xl border border-slate-200 bg-white p-3 text-left dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{counts.c.tooLong}</p>
          <p className="text-xs text-slate-500">dłuższych niż {NAME_MAX} znaków</p>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ['all', 'Wszystkie', rows.length],
            ['fixable', 'Z propozycją', counts.fixable],
            ['safe', 'Bezpieczne', counts.safe],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setKind(id);
              setPage(0);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${kind === id ? 'border-brand-500 bg-brand-600/10 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
          >
            {label} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />
        {NAME_ISSUE_KINDS.filter((k) => counts.c[k] > 0).map((k) => (
          <button
            key={k}
            type="button"
            title={NAME_ISSUES[k].hint}
            onClick={() => {
              setKind(kind === k ? 'all' : k);
              setPage(0);
            }}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${kind === k ? 'border-brand-500 bg-brand-600/10 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
          >
            {NAME_ISSUES[k].label} <span className="tabular-nums opacity-70">{counts.c[k]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Szukaj: SKU, nazwa, producent…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <select
          value={brandFilter}
          onChange={(e) => {
            setBrandFilter(e.target.value);
            setPage(0);
          }}
          className="input-field w-auto text-sm"
        >
          <option value="">Wszyscy producenci</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setShowBrands((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Marki w nazwach {showBrands ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {showBrands && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="mb-2 text-xs text-slate-500">
            Marka jest wymagana na początku nazwy, gdy ma ją na początku co najmniej 20% jej produktów (tryb „Auto”). Dla dostawców i części (np. HYDROFLEX) wybierz „Pomijaj”,
            a dla marek, które chcesz wymusić — „Wymagaj”. Ustawienie zapisuje się w tej przeglądarce.
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Marka</th>
                  <th className="px-3 py-2 text-right">Produktów</th>
                  <th className="px-3 py-2 text-right">W nazwie</th>
                  <th className="px-3 py-2">Tryb</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {ctx.stats.slice(0, 80).map((s) => (
                  <tr key={s.key}>
                    <td className="px-3 py-1.5 font-medium text-slate-900 dark:text-slate-100">
                      {s.label} {s.required && <span className="ml-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">wymagana</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{s.products}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{Math.round(s.usage * 100)}%</td>
                    <td className="px-3 py-1.5">
                      <select value={s.rule} onChange={(e) => setRule(s.key, e.target.value as BrandRule)} className="input-field w-auto py-0.5 text-xs">
                        <option value="auto">Auto</option>
                        <option value="require">Wymagaj</option>
                        <option value="ignore">Pomijaj</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {message && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(new Set(visible.filter((r) => r.suggestion.changed && !r.suggestion.needsReview).map((r) => r.product.id)))}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Zaznacz bezpieczne ({visible.filter((r) => r.suggestion.changed && !r.suggestion.needsReview).length})
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set(pageRows.filter((r) => r.suggestion.changed).map((r) => r.product.id)))}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Zaznacz stronę
          </button>
          {selected.size > 0 && (
            <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-slate-500 underline">
              Wyczyść zaznaczenie
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">
            {visible.length} wyników · strona {cur + 1}/{pages}
          </span>
        </div>
      )}

      {pageRows.length === 0 ? (
        <p className="py-16 text-center text-sm text-slate-500">{rows.length === 0 ? 'Wszystkie nazwy są zgodne ze standardem.' : 'Brak wyników dla wybranych filtrów.'}</p>
      ) : (
        <ul className="space-y-2">
          {pageRows.map((r) => {
            const value = proposed(r);
            const changed = applicable(r);
            const isSel = selected.has(r.product.id);
            return (
              <li key={r.product.id} className={`rounded-xl border p-3 ${isSel ? 'border-brand-500/60 bg-brand-600/5' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50'}`}>
                <div className="flex items-start gap-3">
                  {canEdit && (
                    <input
                      type="checkbox"
                      checked={isSel}
                      disabled={!changed}
                      onChange={() => toggle(r.product.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
                      aria-label={`Zaznacz ${r.product.sku}`}
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      <button type="button" onClick={() => onOpenProduct?.(r.product)} className="font-mono hover:text-brand-500 hover:underline">
                        {r.product.sku}
                      </button>
                      {r.product.manufacturer && <span>{r.product.manufacturer}</span>}
                      {r.product.category && <span>{r.product.category}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 break-words text-sm text-slate-700 dark:text-slate-300"><CopyName text={r.product.displayName}>{r.product.displayName}</CopyName></p>
                      <LenBadge len={(r.product.displayName ?? '').trim().length} />
                    </div>
                    {r.suggestion.changed || edits[r.product.id] !== undefined ? (
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 shrink-0 text-emerald-500" />
                        {canEdit ? (
                          <input
                            value={value}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [r.product.id]: e.target.value }))}
                            className="input-field min-w-0 flex-1 border-emerald-500/40 text-sm font-medium"
                          />
                        ) : (
                          <p className="min-w-0 flex-1 text-sm font-medium text-emerald-700 dark:text-emerald-300">{value}</p>
                        )}
                        <LenBadge len={value.trim().length} />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Brak automatycznej propozycji — popraw ręcznie.</p>
                    )}
                    {canEdit && !(r.suggestion.changed || edits[r.product.id] !== undefined) && (
                      <input
                        placeholder="Wpisz poprawioną nazwę…"
                        onChange={(e) => setEdits((prev) => ({ ...prev, [r.product.id]: e.target.value }))}
                        className="input-field text-sm"
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-1">
                      {r.issues.map((i, idx) => (
                        <span key={idx} title={NAME_ISSUES[i.kind].hint} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE[NAME_ISSUES[i.kind].tone]}`}>
                          {NAME_ISSUES[i.kind].label}
                          {i.detail ? `: ${i.detail}` : ''}
                        </span>
                      ))}
                      {r.suggestion.notes.map((n) => (
                        <span key={n} className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        disabled={!changed || busy}
                        onClick={() => void run([r])}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
                      >
                        <Check className="h-3.5 w-3.5" /> Zastosuj
                      </button>
                      {onSetExceptions && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onSetExceptions([r.product], ['name'], 'Nazwa celowo nietypowa')}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Pomiń
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700">
            Poprzednia
          </button>
          <span className="text-xs text-slate-500">
            {cur + 1} / {pages}
          </span>
          <button type="button" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm disabled:opacity-40 dark:border-slate-700">
            Następna
          </button>
        </div>
      )}

      {canEdit && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-fit items-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <Sparkles className="h-4 w-4 text-brand-500" />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Zaznaczono {selected.size}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(selectedRows)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Zastosuj zaznaczone
          </button>
        </div>
      )}
    </div>
  );
}
