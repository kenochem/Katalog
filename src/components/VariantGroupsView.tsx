import { useDeferredValue, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Check, ImageOff, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { GroupEditor } from './GroupEditor';
import { allGroups, findPartFamilies } from '../lib/groupBuilder';
import type { Product } from '../types';
import { createProduct, deleteProduct, updateProduct } from '../lib/products';
import { withAuditBatch } from '../lib/auditLog';
import {
  buildGroupData,
  capacityGroups,
  findVariantFamilies,
  groupImageFix,
  groupSkuFor,
  withPrimary,
  type VariantFamily,
} from '../lib/variantGroups';

const PAGE = 40;

type Preset = 'all' | 'scent' | 'noimage';

const DISMISS_KEY = 'catalog.variantGroups.dismissed';

function loadDismissed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set();
  }
}

const SCENT_RE = /olejek|zapach|patyczki|perfum|dyfuzor|odświeżacz|odswiezacz/i;

/** Grupy wariantów po pojemności: jeden produkt (np. zapach) + jego pojemności; zdjęcie grupy z wariantu ok. 500 ml. */
export function VariantGroupsView({
  products: productsProp,
  canEdit,
  onCreated,
  onDeleted,
  onPatched,
  onOpenProduct,
}: {
  products: Product[];
  canEdit: boolean;
  onCreated: (created: Product[]) => void;
  onDeleted: (id: string) => void;
  onPatched: (id: string, patch: Partial<Product>) => void;
  onOpenProduct?: (p: Product) => void;
}) {
  // ciężkie wyliczenia (propozycje rodzin) nie blokują reszty ekranu przy zmianie listy produktów
  const products = useDeferredValue(productsProp);
  const [tab, setTab] = useState<'proposals' | 'parts' | 'created'>('parts');
  const [editor, setEditor] = useState<{ group?: Product } | null>(null);
  const [query, setQuery] = useState('');
  const [preset, setPreset] = useState<Preset>('scent');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [primaryOf, setPrimaryOf] = useState<Record<string, string>>({});
  const [nameOf, setNameOf] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [showDismissed, setShowDismissed] = useState(false);

  const saveDismissed = (next: Set<string>) => {
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
    } catch {
      /* ignoruj */
    }
  };
  const dismiss = (key: string, on: boolean) => {
    const next = new Set(dismissed);
    if (on) next.add(key);
    else next.delete(key);
    saveDismissed(next);
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(key);
      return n;
    });
  };

  // „Pojemności”: ten sam produkt w różnych pojemnościach; „Części”: ta sama nazwa i kod na końcu (np. dysze)
  const { families, skippedDuplicates } = useMemo(
    () => (tab === 'parts' ? { families: findPartFamilies(products), skippedDuplicates: 0 } : findVariantFamilies(products)),
    [products, tab],
  );
  const existing = useMemo(() => allGroups(products), [products]);
  const capacityOnes = useMemo(() => capacityGroups(products), [products]);

  const effective = (f: VariantFamily): VariantFamily => {
    const sku = primaryOf[f.key];
    return sku ? withPrimary(f, sku) : f;
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return families
      .map(effective)
      .filter((f) => {
        if (dismissed.has(f.key) !== showDismissed) return false;
        if (tab === 'proposals' && preset === 'scent' && !SCENT_RE.test(f.name)) return false;
        if (preset === 'noimage' && f.imageFromPrimary) return false;
        if (q && !`${f.name} ${f.primary.product.manufacturer}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [families, query, preset, primaryOf, dismissed, showDismissed, tab]);

  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const pageRows = visible.slice(cur * PAGE, cur * PAGE + PAGE);
  const scentCount = families.filter((f) => SCENT_RE.test(f.name)).length;
  const noImageCount = families.filter((f) => !effective(f).imageFromPrimary).length;

  const toggle = (key: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const create = async () => {
    const chosen = visible.filter((f) => selected.has(f.key));
    if (chosen.length === 0) return;
    if (!window.confirm(`Utworzyć ${chosen.length} grup wariantów? Produkty zostają, a na liście będą pokazane w grupie.`)) return;
    setBusy(true);
    setMessage(null);
    const created: Product[] = [];
    const failed: string[] = [];
    try {
      const taken = new Set(products.filter((p) => p.sku.toUpperCase().startsWith('GROUP-')).map((p) => p.sku.toUpperCase()));
      await withAuditBatch(`Grupy wariantów: ${chosen.length}`, async () => {
        for (const fam of chosen) {
          const name = (nameOf[fam.key] ?? fam.name).trim() || fam.name;
          try {
            const sku = groupSkuFor(name, taken);
            created.push(await createProduct(buildGroupData({ ...fam, name }, sku)));
          } catch (err) {
            console.error(err);
            failed.push(fam.name);
          }
        }
      });
      if (created.length) onCreated(created);
      setSelected(new Set());
      setMessage(failed.length ? `Utworzono ${created.length}, błędy: ${failed.length}` : `Utworzono grup: ${created.length}`);
    } finally {
      setBusy(false);
    }
  };

  const refreshOne = async (g: Product) => {
    const fix = groupImageFix(g, products);
    if (!fix) return false;
    await updateProduct(g.id, { imageUrl: fix.imageUrl, customImageUrl: '', hasImage: true });
    onPatched(g.id, { imageUrl: fix.imageUrl, customImageUrl: undefined, hasImage: true });
    return true;
  };

  const stale = capacityOnes.filter((g) => groupImageFix(g, products));

  const refreshAll = async () => {
    setBusy(true);
    setMessage(null);
    let n = 0;
    try {
      for (const g of stale) if (await refreshOne(g)) n++;
      setMessage(`Odświeżono zdjęcia grup: ${n}`);
    } finally {
      setBusy(false);
    }
  };

  const dissolve = async (g: Product) => {
    if (!window.confirm(`Rozwiązać grupę „${g.displayName}”? Warianty zostają jako osobne produkty.`)) return;
    setBusy(true);
    try {
      await deleteProduct(g.id);
      onDeleted(g.id);
    } finally {
      setBusy(false);
    }
  };

  if (editor) {
    return (
      <div className="mx-auto max-w-6xl pb-24">
        <GroupEditor
          products={products}
          group={editor.group}
          onClose={() => setEditor(null)}
          onCreated={(g) => onCreated([g])}
          onUpdated={(id, patch) => onPatched(id, patch)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-24">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950 dark:text-slate-50 sm:text-xl">
          <Boxes className="h-5 w-5 text-brand-500" /> Łączenie w grupy
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Łącz dowolne produkty w jedną grupę: dysze i części różniące się rozmiarem albo własny dobór. Żaden produkt nie jest „główny” — grupa ma własne zdjęcie.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
        {(
          [
            ['parts', 'Części i dysze'],
            ['created', `Grupy (${existing.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${tab === id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}

      {tab === 'proposals' || tab === 'parts' ? (
        <>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditor({})}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500/50 bg-brand-600/10 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-600/20 dark:text-brand-300"
            >
              <Plus className="h-4 w-4" /> Nowa grupa z dowolnych produktów
            </button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {(
              (tab === 'parts'
                ? [
                    ['all', `Wszystkie (${families.length})`],
                    ['noimage', `Bez zdjęcia głównego (${noImageCount})`],
                  ]
                : [
                    ['scent', `Olejki i zapachy (${scentCount})`],
                    ['noimage', `Bez zdjęcia głównego (${noImageCount})`],
                    ['all', `Wszystkie (${families.length})`],
                  ]) as [Preset, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPreset(id);
                  setPage(0);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${preset === id ? 'border-brand-500 bg-brand-600/10 text-brand-700 dark:text-brand-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
              >
                {label}
              </button>
            ))}
            {dismissed.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowDismissed((v) => !v);
                  setPage(0);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${showDismissed ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-slate-300 text-slate-500 dark:border-slate-700'}`}
              >
                Odrzucone ({dismissed.size})
              </button>
            )}
            <div className="relative ml-auto min-w-[14rem] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Szukaj grupy…"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set(visible.filter((f) => f.imageFromPrimary).map((f) => f.key)))}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Zaznacz z gotowym zdjęciem głównym ({visible.filter((f) => f.imageFromPrimary).length})
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set(pageRows.map((f) => f.key)))}
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
                {visible.length} propozycji · strona {cur + 1}/{pages}
                {skippedDuplicates > 0 && ` · pominięto ${skippedDuplicates} z powtórzoną pojemnością`}
              </span>
            </div>
          )}

          {pageRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">Brak propozycji dla wybranych filtrów.</p>
          ) : (
            <ul className="space-y-2">
              {pageRows.map((f) => (
                <li key={f.key} className={`rounded-xl border p-3 ${selected.has(f.key) ? 'border-brand-500/60 bg-brand-600/5' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/50'}`}>
                  <div className="flex items-start gap-3">
                    {canEdit && (
                      <input type="checkbox" checked={selected.has(f.key)} onChange={() => toggle(f.key)} className="mt-1 h-4 w-4 shrink-0 accent-brand-600" aria-label={`Zaznacz ${f.name}`} />
                    )}
                    {f.imageUrl ? (
                      <img src={f.imageUrl} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg bg-white object-contain" />
                    ) : (
                      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-400 text-slate-500">
                        <ImageOff className="h-5 w-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {canEdit ? (
                        <input
                          value={nameOf[f.key] ?? f.name}
                          onChange={(e) => setNameOf((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          className="input-field w-full text-sm font-medium"
                        />
                      ) : (
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{f.name}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-slate-500">{f.primary.product.manufacturer}</span>
                        {f.members.map((m) => {
                          const isMain = m.product.sku === f.primary.product.sku;
                          const hasImg = !!(m.product.customImageUrl || m.product.imageUrl);
                          return (
                            <button
                              key={m.product.sku}
                              type="button"
                              disabled={!canEdit}
                              onClick={() => setPrimaryOf((prev) => ({ ...prev, [f.key]: m.product.sku }))}
                              onDoubleClick={() => onOpenProduct?.(m.product)}
                              title={`${m.product.sku}${m.product.priceSaleGross != null ? ` · ${m.product.priceSaleGross.toFixed(2).replace('.', ',')} zł` : ''}${isMain ? ' · wariant główny (zdjęcie i cena grupy)' : ' · kliknij, aby ustawić jako główny'}${hasImg ? '' : ' · brak zdjęcia'}`}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${isMain ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}
                            >
                              {isMain && <Check className="h-3 w-3" />}
                              {m.capText}
                              {!hasImg && <ImageOff className="h-3 w-3 opacity-60" />}
                            </button>
                          );
                        })}
                      </div>
                      {new Set(f.members.map((m) => m.product.category)).size > 1 && (
                        <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Warianty mają różne kategorie — grupa dostanie kategorię wariantu głównego ({f.primary.product.category || 'brak'}).
                        </p>
                      )}
                      {!f.imageFromPrimary && (
                        <p className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Wariant główny ({f.primary.capText}) nie ma zdjęcia{f.imageUrl ? ' — użyto zdjęcia innego wariantu' : ''}.
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => dismiss(f.key, !showDismissed)}
                        className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        title={showDismissed ? 'Przywróć propozycję' : 'To nie są warianty — nie proponuj ponownie'}
                      >
                        {showDismissed ? 'Przywróć' : 'Odrzuć'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
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
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Zaznaczono {selected.size}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void create()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Utwórz grupy
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {canEdit && stale.length > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void refreshAll()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Odśwież zdjęcia grup ({stale.length})
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditor({})}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-500/50 bg-brand-600/10 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-600/20 dark:text-brand-300"
            >
              <Plus className="h-4 w-4" /> Nowa grupa z dowolnych produktów
            </button>
          )}
          {existing.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">Nie ma jeszcze żadnej grupy produktów.</p>
          ) : (
            <ul className="space-y-2">
              {existing.map((g) => {
                const isStale = !!groupImageFix(g, products);
                return (
                  <li key={g.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50">
                    {g.customImageUrl || g.imageUrl ? (
                      <img src={g.customImageUrl || g.imageUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-slate-400 text-slate-500">
                        <ImageOff className="h-4 w-4" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => onOpenProduct?.(g)} className="truncate text-left text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">
                        {g.displayName}
                      </button>
                      <p className="text-[11px] text-slate-500">
                        {g.variants?.length ?? 0} wariantów{g.meta?.groupPrimarySku ? ` · główny ${g.meta.groupPrimarySku}` : ''}
                        {isStale && <span className="ml-2 text-amber-600 dark:text-amber-400">zdjęcie wariantu głównego jest nowsze</span>}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 gap-1">
                        {isStale && (
                          <button type="button" disabled={busy} onClick={() => void refreshOne(g)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                            <RefreshCw className="h-3.5 w-3.5" /> Odśwież
                          </button>
                        )}
                        <button type="button" disabled={busy} onClick={() => setEditor({ group: g })} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                          <Pencil className="h-3.5 w-3.5" /> Edytuj
                        </button>
                        <button type="button" disabled={busy} onClick={() => void dissolve(g)} className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-500/10 dark:text-rose-300">
                          <Trash2 className="h-3.5 w-3.5" /> Rozwiąż
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
