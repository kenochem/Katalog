import { ChevronDown, ChevronRight, FolderPlus, FolderTree, Loader2, Move, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Product } from '../types';
import { getProductDisplayCategory, isGenericSourceCategory, isLikelyProducerCategory } from '../lib/catalogCategory';
import { ACCESSORY_CATEGORIES } from '../types';
import { getShopCategoryTree, type ShopCategoryNode } from '../lib/shopCategoryTree';
import {
  addCategory,
  categoryKey,
  cleanCategoryName,
  flattenCategories,
  getAssignableCategories,
  getParentCandidates,
  moveCategory,
  removeCategory,
  removedShopCategories,
  renameCategory,
  restoreShopCategory,
  useCategoryRegistry,
} from '../lib/categoryRegistry';
import { confirmDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';

function subtreeNames(node: ShopCategoryNode): string[] {
  return [node.name, ...node.children.flatMap(subtreeNames)];
}

/** Zarządzanie drzewem kategorii katalogu: dodawanie, zmiana nazwy, przenoszenie i usuwanie (zapis w bazie). */
export function CategoriesView({
  products,
  onShowProducts,
  canEdit = true,
}: {
  products: Product[];
  onShowProducts: (category: string) => void;
  canEdit?: boolean;
}) {
  const version = useCategoryRegistry();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rootDraft, setRootDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const c = getProductDisplayCategory(p);
      map.set(categoryKey(c), (map.get(categoryKey(c)) || 0) + 1);
    }
    return map;
  }, [products]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roots = useMemo(() => getShopCategoryTree().roots, [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flat = useMemo(() => flattenCategories(), [version]);
  const info = selected ? flat.find((c) => categoryKey(c.name) === categoryKey(selected)) : undefined;
  const selectedNode = useMemo(() => {
    if (!selected) return null;
    const find = (nodes: ShopCategoryNode[]): ShopCategoryNode | null => {
      for (const n of nodes) {
        if (categoryKey(n.name) === categoryKey(selected)) return n;
        const inner = find(n.children);
        if (inner) return inner;
      }
      return null;
    };
    return find(roots);
  }, [roots, selected]);

  const countOf = (node: ShopCategoryNode) => subtreeNames(node).reduce((s, n) => s + (counts.get(categoryKey(n)) || 0), 0);
  const q = query.trim().toLowerCase();
  const matches = (node: ShopCategoryNode): boolean => node.name.toLowerCase().includes(q) || node.children.some(matches);

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function run<T>(key: string, fn: () => Promise<T>, okMsg?: (r: T) => string): Promise<T | undefined> {
    setBusy(key);
    try {
      const res = await fn();
      if (okMsg) showToast(okMsg(res), 'ok');
      return res;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 8000);
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  function renderNode(node: ShopCategoryNode, depth: number) {
    if (q && !matches(node)) return null;
    const isOpen = q ? true : expanded.has(node.name);
    const hasChildren = node.children.length > 0;
    const n = countOf(node);
    const nodeInfo = flat.find((c) => categoryKey(c.name) === categoryKey(node.name));
    const active = selected && categoryKey(selected) === categoryKey(node.name);
    return (
      <li key={node.name + depth}>
        <div
          className={`flex items-center gap-1 rounded-xl px-2 py-1.5 transition hover:bg-slate-800/60 ${active ? 'bg-brand-500/15 ring-1 ring-brand-500/40' : ''}`}
          style={{ paddingLeft: 8 + depth * 18 }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.name)}
            className={`flex h-6 w-6 items-center justify-center rounded text-slate-400 ${hasChildren ? 'hover:bg-slate-700' : 'opacity-0'}`}
            aria-label={isOpen ? 'Zwiń' : 'Rozwiń'}
          >
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setSelected(node.name)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className={`truncate text-sm ${hasChildren ? 'font-semibold text-slate-100' : 'text-slate-200'}`}>{node.name}</span>
            {nodeInfo && !nodeInfo.fromShop && (
              <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-violet-200">własna</span>
            )}
          </button>
          <span className="shrink-0 text-xs tabular-nums text-slate-400">{n}</span>
        </div>
        {hasChildren && isOpen && <ul>{node.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  }

  // kategorie wpisane w produktach (np. dodane wcześniej z karty produktu), których nie ma w drzewie
  const orphans = useMemo(() => {
    const acc = new Set((ACCESSORY_CATEGORIES as readonly string[]).map(categoryKey));
    const map = new Map<string, { name: string; count: number }>();
    for (const p of products) {
      const raw = (p.category ?? '').trim();
      if (!raw || acc.has(categoryKey(raw)) || isGenericSourceCategory(raw) || isLikelyProducerCategory(raw, p)) continue;
      if (flat.some((c) => categoryKey(c.name) === categoryKey(raw))) continue;
      const k = categoryKey(raw);
      const e = map.get(k) ?? { name: raw, count: 0 };
      e.count++;
      map.set(k, e);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 40);
  }, [products, flat]);

  const removed = useMemo(
    () => removedShopCategories(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );

  return (
    <div className="catalog-readable-light w-full space-y-4 pb-10">
      <section className="surface-panel p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Porządkowanie katalogu</p>
        <h2 className="mt-1 flex items-center gap-2 text-xl font-bold text-slate-950 dark:text-slate-50">
          <FolderTree className="h-5 w-5" /> Kategorie
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-700 dark:text-slate-400">
          Drzewo kategorii katalogu. Zmiany zapisują się na stałe w bazie i od razu są dostępne przy wyborze kategorii w każdym produkcie.
          Kategorie ze sklepu można przenosić, zmieniać im nazwy i usuwać (produkty trafiają wtedy do wybranej kategorii).
        </p>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]">
        <section className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj kategorii…" className="input-field with-icon" />
            </div>
            <button
              type="button"
              onClick={() => setExpanded(new Set(flat.filter((c) => !c.isLeaf).map((c) => c.name)))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Rozwiń wszystko
            </button>
            <button
              type="button"
              onClick={() => setExpanded(new Set())}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Zwiń
            </button>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <input
                value={rootDraft}
                onChange={(e) => setRootDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.nextElementSibling instanceof HTMLButtonElement && e.currentTarget.nextElementSibling.click();
                }}
                placeholder="Nowa kategoria główna"
                className="input-field min-w-0 flex-1"
              />
              <button
                type="button"
                disabled={!rootDraft.trim() || busy !== null}
                onClick={async () => {
                  const name = await run('root', () => addCategory(rootDraft, null), (n) => `Dodano kategorię „${n}”`);
                  if (name) {
                    setRootDraft('');
                    setSelected(name);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {busy === 'root' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Dodaj
              </button>
            </div>
          )}
          <ul className="space-y-0.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950/30 dark:shadow-none">
            {roots.map((r) => renderNode(r, 0))}
            {roots.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-600 dark:text-slate-400">Brak kategorii.</li>}
          </ul>
          {orphans.length > 0 && canEdit && (
            <section className="surface-panel p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Kategorie z produktów spoza drzewa</p>
              <p className="mb-2 text-[11px] text-slate-600 dark:text-slate-400">
                Te nazwy są wpisane w produktach, ale nie ma ich w drzewie (np. dodane wcześniej z karty produktu). Dodaj je do drzewa, żeby były dostępne do wyboru w każdym produkcie.
              </p>
              <ul className="space-y-1">
                {orphans.map((o) => (
                  <li key={o.name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-800 dark:text-slate-200">
                      {o.name} <span className="text-xs text-slate-500">({o.count})</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void run('orphan:' + o.name, () => addCategory(o.name, null), (n) => `Dodano „${n}” do drzewa`)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      <Plus className="h-3.5 w-3.5" /> Dodaj do drzewa
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {removed.length > 0 && canEdit && (
            <section className="surface-panel p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Usunięte kategorie ze sklepu</p>
              <ul className="space-y-1">
                {removed.map((name) => (
                  <li key={name} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-800 dark:text-slate-200">{name}</span>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void run('restore:' + name, () => restoreShopCategory(name), () => `Przywrócono „${name}”`)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Przywróć
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>

        <aside className="lg:sticky lg:top-3">
          {info && selectedNode ? (
            <CategoryDetail
              key={info.name + version}
              info={info}
              node={selectedNode}
              count={counts.get(categoryKey(info.name)) || 0}
              total={countOf(selectedNode)}
              canEdit={canEdit}
              busy={busy}
              run={run}
              onShow={() => onShowProducts(info.name)}
              onSelect={setSelected}
              onRemoved={() => setSelected(null)}
            />
          ) : (
            <div className="surface-panel p-6 text-sm text-slate-700 dark:text-slate-400">
              Wybierz kategorię z drzewa, aby zobaczyć jej szczegóły, dodać podkategorię, zmienić nazwę, przenieść ją albo usunąć.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function CategoryDetail({
  info,
  node,
  count,
  total,
  canEdit,
  busy,
  run,
  onShow,
  onSelect,
  onRemoved,
}: {
  info: ReturnType<typeof flattenCategories>[number];
  node: ShopCategoryNode;
  count: number;
  total: number;
  canEdit: boolean;
  busy: string | null;
  run: <T>(key: string, fn: () => Promise<T>, okMsg?: (r: T) => string) => Promise<T | undefined>;
  onShow: () => void;
  onSelect: (name: string) => void;
  onRemoved: () => void;
}) {
  const [name, setName] = useState(info.name);
  const [child, setChild] = useState('');
  const [parent, setParent] = useState(info.parent ?? '');
  const [moveTo, setMoveTo] = useState('');

  const descendants = useMemo(() => new Set(subtreeNames(node).map(categoryKey)), [node]);
  const parentOptions = useMemo(
    () => getParentCandidates().filter((c) => !descendants.has(categoryKey(c.name))),
    [descendants],
  );
  const moveOptions = useMemo(
    () => getAssignableCategories().filter((c) => categoryKey(c) !== categoryKey(info.name)).sort((a, b) => a.localeCompare(b, 'pl')),
    [info.name],
  );
  const canAddChild = !info.isLeaf || info.depth === 0 || count === 0;
  const canRename = info.isLeaf || !info.fromShop;
  const label = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';

  return (
    <fieldset disabled={!canEdit} className="surface-panel m-0 min-w-0 space-y-4 p-4">
      <div>
        <h3 className="text-lg font-bold text-slate-950 dark:text-slate-50">{info.name}</h3>
        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{info.path}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Produkty</p>
            <p className="text-lg font-bold tabular-nums text-slate-100">{count}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Z podkategoriami</p>
            <p className="text-lg font-bold tabular-nums text-slate-100">{total}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-2 py-2">
            <p className="text-[10px] uppercase text-slate-500">Podkategorie</p>
            <p className="text-lg font-bold tabular-nums text-slate-100">{node.children.length}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={total === 0}
          onClick={onShow}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          Pokaż produkty w katalogu
        </button>
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          <FolderPlus className="h-3.5 w-3.5" /> Dodaj podkategorię
        </p>
        {canAddChild ? (
          <div className="flex gap-2">
            <input value={child} onChange={(e) => setChild(e.target.value)} placeholder={`Nowa w „${info.name}”`} className="input-field min-w-0 flex-1" />
            <button
              type="button"
              disabled={!child.trim() || busy !== null}
              onClick={async () => {
                const created = await run('child', () => addCategory(child, info.name), (n) => `Dodano „${n}” w „${info.name}”`);
                if (created) {
                  setChild('');
                  onSelect(created);
                }
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {busy === 'child' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Dodaj
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Ta kategoria ma produkty — podkategorię dodasz w kategorii grupującej albo najpierw przenieś produkty gdzie indziej.
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          <Pencil className="h-3.5 w-3.5" /> Nazwa
        </p>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={!canRename} className="input-field min-w-0 flex-1" />
          <button
            type="button"
            disabled={!canRename || busy !== null || !cleanCategoryName(name) || cleanCategoryName(name) === info.name}
            onClick={async () => {
              const next = cleanCategoryName(name);
              if (info.isLeaf && count > 0) {
                const ok = await confirmDialog({
                  title: 'Zmiana nazwy kategorii',
                  message: `Zmienić „${info.name}” na „${next}” w ${count} produktach?`,
                  confirmLabel: 'Zmień nazwę',
                  tone: 'warn',
                });
                if (!ok) return;
              }
              const res = await run('rename', () => renameCategory(info.name, next), (r) => `Zmieniono nazwę (${r.updated} produktów)`);
              if (res) onSelect(next);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {busy === 'rename' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Zmień
          </button>
        </div>
        {!canRename && <p className="text-[11px] text-slate-600 dark:text-slate-400">Nazwy kategorii grupującej ze sklepu nie można zmienić.</p>}
      </div>

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          <Move className="h-3.5 w-3.5" /> Położenie w drzewie
        </p>
        <div className="flex gap-2">
          <select value={parent} onChange={(e) => setParent(e.target.value)} className="input-field min-w-0 flex-1">
            <option value="">— kategoria główna —</option>
            {parentOptions.map((c) => (
              <option key={c.name} value={c.name}>
                {'— '.repeat(c.depth)}
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy !== null || parent === (info.parent ?? '')}
            onClick={() => void run('move', () => moveCategory(info.name, parent || null), () => 'Przeniesiono kategorię')}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {busy === 'move' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Move className="h-4 w-4" />} Przenieś
          </button>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-rose-500/30 p-3">
        <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Usuń kategorię</p>
        {info.isLeaf ? (
          <>
            {count > 0 && (
              <label className="block">
                <span className={label}>Przenieś jej {count} produktów do:</span>
                <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="input-field">
                  <option value="">— Do decyzji (bez kategorii) —</option>
                  {moveOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: 'Usunięcie kategorii',
                  message: count > 0 ? `Usunąć „${info.name}”? ${count} produktów przejdzie do: ${moveTo || 'Do decyzji'}.` : `Usunąć „${info.name}”?`,
                  confirmLabel: 'Usuń',
                  tone: 'danger',
                });
                if (!ok) return;
                const res = await run('remove', () => removeCategory(info.name, moveTo), (r) => `Usunięto kategorię${r.moved ? ` (przeniesiono ${r.moved} produktów)` : ''}`);
                if (res) onRemoved();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {busy === 'remove' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Usuń kategorię
            </button>
          </>
        ) : (
          <p className="text-[11px] text-slate-600 dark:text-slate-400">Kategoria ma podkategorie — najpierw usuń lub przenieś je gdzie indziej.</p>
        )}
      </div>
    </fieldset>
  );
}
