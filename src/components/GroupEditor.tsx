import { useMemo, useState } from 'react';
import { ArrowLeft, ImageOff, Loader2, Plus, Search, X } from 'lucide-react';
import type { Product } from '../types';
import { createProduct, getProductImage, updateProduct } from '../lib/products';
import { withAuditBatch } from '../lib/auditLog';
import { draftGroupData, draftGroupPatch, groupableProducts } from '../lib/groupBuilder';
import { groupSkuFor } from '../lib/variantGroups';
import { showToast } from '../lib/toast';

const RESULT_LIMIT = 150;

type Draft = { name: string; skus: string[]; primarySku: string };

/**
 * Składanie grupy z dowolnych produktów (np. dysze, części) albo edycja istniejącej grupy:
 * nazwa, lista wariantów (dodawanie wyszukiwarką, usuwanie) i wariant główny (zdjęcie i cena grupy).
 */
export function GroupEditor({
  products,
  group,
  onClose,
  onCreated,
  onUpdated,
}: {
  products: Product[];
  /** Edytowana grupa; bez niej tworzymy nową. */
  group?: Product;
  onClose: () => void;
  onCreated?: (created: Product) => void;
  onUpdated?: (id: string, patch: Partial<Product>) => void;
}) {
  const bySku = useMemo(() => new Map(products.filter((p) => !p.isGroup).map((p) => [p.sku.toUpperCase(), p])), [products]);

  const initial = useMemo<Draft>(() => {
    if (!group) return { name: '', skus: [], primarySku: '' };
    const skus = (group.variants ?? []).map((v) => String(v.sku).toUpperCase()).filter((s) => bySku.has(s));
    const primary = (group.meta?.groupPrimarySku || '').toUpperCase();
    return { name: group.displayName || group.name, skus, primarySku: skus.includes(primary) ? primary : (skus[0] ?? '') };
  }, [group, bySku]);

  // warianty grupy, których nie ma już na liście produktów — zostają bez zmian
  const unresolved = useMemo(() => (group?.variants ?? []).filter((v) => !bySku.has(String(v.sku).toUpperCase())), [group, bySku]);

  const [draft, setDraft] = useState<Draft>(initial);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const pool = useMemo(() => groupableProducts(products, group?.id), [products, group?.id]);
  const chosen = new Set(draft.skus);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const toggleMark = (id: string) =>
    setMarked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (query.trim().length < 2) return [];
    const out: Product[] = [];
    for (const p of pool) {
      if (chosen.has(p.sku.toUpperCase())) continue;
      const hay = `${p.sku} ${p.ean ?? ''} ${p.displayName} ${p.name} ${p.manufacturer}`.toLowerCase();
      if (tokens.every((t) => hay.includes(t))) out.push(p);
      if (out.length >= RESULT_LIMIT) break;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, query, draft.skus]);

  const members = draft.skus.map((s) => bySku.get(s)).filter((p): p is Product => !!p);

  const add = (p: Product) =>
    setDraft((d) => {
      const sku = p.sku.toUpperCase();
      return { ...d, skus: [...d.skus, sku], primarySku: d.primarySku || sku, name: d.name || p.displayName };
    });
  const addMany = (list: Product[]) =>
    setDraft((d) => {
      const have = new Set(d.skus);
      const fresh = list.filter((p) => !have.has(p.sku.toUpperCase()));
      if (!fresh.length) return d;
      return { ...d, skus: [...d.skus, ...fresh.map((p) => p.sku.toUpperCase())], primarySku: d.primarySku || fresh[0].sku.toUpperCase(), name: d.name || fresh[0].displayName };
    });
  const remove = (sku: string) =>
    setDraft((d) => {
      const skus = d.skus.filter((s) => s !== sku);
      return { ...d, skus, primarySku: d.primarySku === sku ? (skus[0] ?? '') : d.primarySku };
    });

  const valid = draft.name.trim().length > 0 && members.length + (group ? unresolved.length : 0) >= 2 && members.length >= 1;

  async function save() {
    if (!valid) return;
    setSaving(true);
    try {
      const d = { name: draft.name.trim(), members, primarySku: draft.primarySku };
      if (group) {
        const patch = draftGroupPatch(group, d, unresolved);
        await withAuditBatch(`Grupa „${d.name}”: zmiana wariantów`, () => updateProduct(group.id, patch));
        onUpdated?.(group.id, patch);
        showToast('Grupa zapisana', 'ok');
      } else {
        const taken = new Set(products.filter((p) => p.sku.toUpperCase().startsWith('GROUP-')).map((p) => p.sku.toUpperCase()));
        const sku = groupSkuFor(d.name, taken);
        const created = await createProduct(draftGroupData(d, sku));
        onCreated?.(created);
        showToast('Grupa utworzona', 'ok');
      }
      onClose();
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać grupy', 'error', 6000);
    } finally {
      setSaving(false);
    }
  }

  const thumb = (p: Product) => {
    const img = getProductImage(p);
    return img ? (
      <img src={img} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg bg-white object-contain" />
    ) : (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-400 text-slate-500">
        <ImageOff className="h-4 w-4" />
      </span>
    );
  };

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900" aria-label={group ? 'Edycja grupy' : 'Nowa grupa'}>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
          <ArrowLeft className="h-4 w-4" /> Wróć
        </button>
        <h3 className="text-base font-bold text-slate-950 dark:text-slate-50">{group ? 'Edycja grupy' : 'Nowa grupa produktów'}</h3>
        <input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="Nazwa grupy, np. Dysza wody 1/4 - Lechler"
          aria-label="Nazwa grupy"
          className="input-field min-w-[16rem] flex-1 text-sm font-medium"
        />
        <button
          type="button"
          disabled={!valid || saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {group ? 'Zapisz grupę' : 'Utwórz grupę'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Znajdź produkty</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setMarked(new Set());
              }}
              placeholder="Szukaj: SKU, EAN, nazwa, producent — kilka słów naraz…"
              className="input-field with-icon w-full text-sm"
              autoFocus
            />
          </div>
          {results.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">
                Wyniki: {results.length}
                {results.length >= RESULT_LIMIT ? '+' : ''}
              </span>
              <button type="button" className="text-brand-600 hover:underline dark:text-brand-300" onClick={() => setMarked(new Set(results.map((p) => p.id)))}>
                Zaznacz wszystkie
              </button>
              {marked.size > 0 && (
                <button type="button" className="text-slate-500 hover:underline" onClick={() => setMarked(new Set())}>
                  Odznacz
                </button>
              )}
              <button
                type="button"
                disabled={marked.size === 0}
                onClick={() => {
                  addMany(results.filter((p) => marked.has(p.id)));
                  setMarked(new Set());
                }}
                className="ml-auto rounded-lg bg-brand-600 px-3 py-1 font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
              >
                Dodaj zaznaczone ({marked.size})
              </button>
            </div>
          )}
          <ul className="mt-2 max-h-[min(60dvh,32rem)] space-y-1 overflow-y-auto">
            {query.trim().length < 2 ? (
              <li className="px-1 py-3 text-xs text-slate-500">Wpisz min. 2 znaki. Wyniki można zaznaczać pojedynczo i dodawać hurtem; produkty z innych grup są pomijane.</li>
            ) : results.length === 0 ? (
              <li className="px-1 py-3 text-xs text-slate-500">Brak wolnych produktów dla tego wyszukiwania.</li>
            ) : (
              results.map((p) => (
                <li key={p.id} className={`flex items-center gap-2 rounded-xl border p-2 ${marked.has(p.id) ? 'border-brand-500/60 bg-brand-500/5' : 'border-slate-200 dark:border-slate-800'}`}>
                  <input type="checkbox" checked={marked.has(p.id)} onChange={() => toggleMark(p.id)} aria-label="Zaznacz" />
                  {thumb(p)}
                  <button type="button" onClick={() => toggleMark(p.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.displayName}</span>
                    <span className="block truncate font-mono text-[11px] text-slate-500">
                      {p.sku} · {p.manufacturer || 'bez producenta'} · stan {p.stock ?? 0}
                    </span>
                  </button>
                  <button type="button" onClick={() => add(p)} className="shrink-0 rounded-lg border border-brand-500/50 p-1.5 text-brand-600 hover:bg-brand-500/10 dark:text-brand-300" aria-label="Dodaj do grupy" title="Dodaj do grupy">
                    <Plus className="h-4 w-4" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="flex min-h-0 flex-col">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Produkty w grupie ({members.length}
              {unresolved.length ? ` + ${unresolved.length} spoza listy` : ''})
            </p>
            {members.length > 0 && (
              <button type="button" className="text-xs text-slate-500 hover:text-rose-600" onClick={() => setDraft((d) => ({ ...d, skus: [], primarySku: '' }))}>
                Wyczyść
              </button>
            )}
          </div>
          {members.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700">Dodaj produkty z listy obok.</p>
          ) : (
            <ul className="max-h-[min(60dvh,32rem)] space-y-1.5 overflow-y-auto">
              {members.map((m) => (
                <li key={m.sku} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800">
                  {thumb(m)}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{m.displayName}</p>
                    <p className="truncate font-mono text-[11px] text-slate-500">{m.sku}</p>
                  </div>
                  <button type="button" onClick={() => remove(m.sku.toUpperCase())} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-500/20" aria-label="Usuń z grupy">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Żaden produkt nie jest „główny”. Produkty zostają też osobno; zdjęcie grupy ustawisz w jej karcie.</p>
        </section>
      </div>
    </div>
  );
}
