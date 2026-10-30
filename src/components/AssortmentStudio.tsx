import {
  Boxes,
  ChevronDown,
  Download,
  ClipboardCheck,
  ImageOff,
  ChevronRight,
  GitMerge,
  Loader2,
  Minus,
  Network,
  Store,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Product } from '../types';
import { getProductDisplayCategory, productNeedsCategoryDecision } from '../lib/catalogCategory';
import { getShopCategoryTree, type ShopCategoryNode } from '../lib/shopCategoryTree';
import {
  addCategory,
  categoryKey,
  findLooseCategories,
  flattenCategories,
  getCategoryOverrides,
  moveCategory,
  removeCategory,
  renameCategory,
  resetCategoryOverrides,
  useCategoryRegistry,
} from '../lib/categoryRegistry';
import { effectiveManufacturer, NO_MANUFACTURER } from '../lib/waproManufacturers';
import { runBulkEdit, type BulkEditSpec } from '../lib/bulkEdit';
import {
  buildCategoryModel,
  buildManufacturerFinder,
  computeHealth,
  findNearDuplicates,
  topWordsOf,
  UNDECIDED,
  type CategorySuggestion,
  type ManufacturerSuggestion,
} from '../lib/assortmentAnalysis';
import { AUDIT_CODE_LABEL, auditToCsv, downloadText, runAudit, type AuditResult } from '../lib/assortmentAudit';
import { iconForCategory } from '../lib/categoryIcons';
import { ShopMirrorPanel } from './ShopMirrorPanel';
import { effectiveSupplier, supplierStats, SUPPLIER_FROM_MANUFACTURER } from '../lib/suppliers';
import { confirmDialog, promptDialog } from '../lib/dialog';
import { showToast } from '../lib/toast';

type Mode = 'tree' | 'manufacturers' | 'analysis' | 'shop';

const hashOf = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
type TrayFilter = 'undecided' | 'suggested' | 'node' | 'all';

const NODE_W = 256;
const NODE_H = 46;
const GAP_X = 64;
const ROW = 58;
const OVERLOADED = 60;
const TRAY_PAGE = 120;

const ROOT_COLORS = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#64d2ff', '#ff453a', '#ffd60a', '#ac8e68'];

interface LNode {
  node: ShopCategoryNode;
  depth: number;
  x: number;
  y: number;
  color: string;
  kids: LNode[];
  parent: LNode | null;
}

const VIRTUAL_ROOT = '__root__';

/** Zlicza produkty po kategorii wyświetlanej (liście) i po poddrzewie. */
function subtreeNames(node: ShopCategoryNode): string[] {
  return [node.name, ...node.children.flatMap(subtreeNames)];
}

interface RowActions {
  startDrag: (e: React.DragEvent, id: string) => void;
  endDrag: () => void;
  toggle: (id: string, shift: boolean) => void;
  assignCat: (id: string, category: string) => void;
  assignMf: (id: string, name: string) => void;
}

/**
 * Wiersz tacki. Memoizowany: zaznaczenie jednego produktu albo ruch kursora podczas przeciągania
 * nie przerysowuje pozostałych wierszy (a każdy ma zdjęcie). Akcje idą przez stabilny obiekt `rowAct`.
 */
const TrayRow = memo(function TrayRow({
  p,
  on,
  mode,
  catLabel,
  cs,
  ms,
  mfLabel,
  supplier,
  draggable,
  disabled,
  canAssign,
  showImages,
  rowAct,
}: {
  p: Product;
  on: boolean;
  mode: Mode;
  catLabel: string;
  cs?: CategorySuggestion;
  ms?: ManufacturerSuggestion;
  mfLabel: string;
  supplier: string;
  draggable: boolean;
  disabled: boolean;
  canAssign: boolean;
  showImages: boolean;
  rowAct: React.MutableRefObject<RowActions>;
}) {
  return (
    <li
      draggable={draggable}
      onDragStart={(e) => rowAct.current.startDrag(e, p.id)}
      onDragEnd={() => rowAct.current.endDrag()}
      onClick={(e) => rowAct.current.toggle(p.id, e.shiftKey)}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 68px' }}
      className={`flex cursor-grab select-none items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition active:cursor-grabbing ${
        on ? 'bg-brand-500/15 ring-1 ring-brand-500/60' : 'bg-white hover:bg-slate-50 dark:bg-slate-900/60 dark:hover:bg-slate-800/80'
      }`}
    >
      <Thumb p={p} show={showImages} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-slate-900 dark:text-slate-100">{p.displayName || p.name}</p>
        <p className="mt-0.5 truncate text-[11px] text-slate-500">
          {p.sku} · {mode === 'tree' ? catLabel : `${mfLabel}${supplier ? ` · dost.: ${supplier}` : ''}`}
        </p>
        {mode === 'tree' && cs && (
          <button
            type="button"
            disabled={disabled || !canAssign}
            onClick={(e) => {
              e.stopPropagation();
              rowAct.current.assignCat(p.id, cs.category);
            }}
            className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-300"
            title={`Na podstawie słów: ${cs.because.join(', ')}`}
          >
            <Wand2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{cs.category}</span>
            <span className="tabular-nums opacity-70">{Math.round(cs.confidence * 100)}%</span>
          </button>
        )}
        {mode === 'manufacturers' && ms && (
          <button
            type="button"
            disabled={disabled || !canAssign}
            onClick={(e) => {
              e.stopPropagation();
              rowAct.current.assignMf(p.id, ms.manufacturer);
            }}
            className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-300"
          >
            <Wand2 className="h-3 w-3" /> {ms.manufacturer}
          </button>
        )}
      </div>
    </li>
  );
});

/** Miniatura produktu w tacce; bez zdjęcia (albo przy błędzie ładowania) pokazuje neutralną ikonę. */
function Thumb({ p, show }: { p: Product; show: boolean }) {
  const [bad, setBad] = useState(false);
  const src = show ? p.customImageUrl || p.imageUrl || p.extraImageUrls?.[0] || '' : '';
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
      {src && !bad ? (
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBad(true)} className="h-full w-full object-contain" />
      ) : (
        <ImageOff className="h-4 w-4 text-slate-400" aria-hidden />
      )}
    </span>
  );
}

export function AssortmentStudio({
  products,
  canEditCategories,
  canEditManufacturers,
  onPatched,
  onShowCategory,
  onShowManufacturer,
  showImages = true,
}: {
  products: Product[];
  /** false = rola bez uprawnienia do zdjęć. */
  showImages?: boolean;
  canEditCategories: boolean;
  canEditManufacturers: boolean;
  onPatched: (patches: { id: string; patch: Partial<Product> }[]) => void;
  onShowCategory: (name: string) => void;
  onShowManufacturer: (name: string) => void;
}) {
  const version = useCategoryRegistry();
  const [mode, setMode] = useState<Mode>('tree');
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedMf, setSelectedMf] = useState<string | null>(null);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set([VIRTUAL_ROOT]));
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState('');
  const [mfQuery, setMfQuery] = useState('');
  const [trayQuery, setTrayQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'' | 'in' | 'out'>('');
  const [trayFilter, setTrayFilter] = useState<TrayFilter>('undecided');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(TRAY_PAGE);
  const [dragKind, setDragKind] = useState<'products' | 'category' | null>(null);
  const [dragCat, setDragCat] = useState<string | null>(null);
  const [dragIds, setDragIds] = useState<string[]>([]);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const lastPicked = useRef<string | null>(null);

  // ---- dane pochodne ------------------------------------------------------------------------
  const singles = useMemo(() => products.filter((p) => !p.isGroup), [products]);
  const displayCat = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id, getProductDisplayCategory(p));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, version]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const k = categoryKey(displayCat.get(p.id) ?? UNDECIDED);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [products, displayCat]);

  const model = useMemo(() => buildCategoryModel(products), [products, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const findMf = useMemo(() => buildManufacturerFinder(products), [products]);

  const catSuggestions = useMemo(() => {
    const m = new Map<string, CategorySuggestion>();
    for (const p of singles) {
      if (!productNeedsCategoryDecision(p)) continue;
      const s = model.suggest(p);
      if (s && s.category !== (displayCat.get(p.id) ?? '') && s.confidence >= 0.25) m.set(p.id, s);
    }
    return m;
  }, [singles, model, displayCat]);

  const mfSuggestions = useMemo(() => {
    const m = new Map<string, ManufacturerSuggestion>();
    for (const p of singles) {
      if (effectiveManufacturer(p)) continue;
      const s = findMf(p);
      if (s) m.set(p.id, s);
    }
    return m;
  }, [singles, findMf]);

  const [audit, setAudit] = useState<AuditResult | null>(null);
  const runFullAudit = (): AuditResult => {
    const r = runAudit(products, model);
    setAudit(r);
    return r;
  };
  /** Audyt liczy się ok. sekundy — najpierw pokazujemy stan „liczenie”, potem blokujemy wątek. */
  const startAudit = () => {
    setBusy('audit');
    window.setTimeout(() => {
      try {
        runFullAudit();
      } finally {
        setBusy(null);
      }
    }, 40);
  };
  const exportAudit = (kind: 'csv' | 'json') => {
    const r = audit ?? runFullAudit();
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'csv') downloadText(`audyt-asortymentu-${stamp}.csv`, auditToCsv(r), 'text/csv');
    else downloadText(`audyt-asortymentu-${stamp}.json`, JSON.stringify(r), 'application/json');
    showToast(`Pobrano audyt: ${r.summary.withIssues.toLocaleString('pl-PL')} produktów z uwagami`, 'info');
  };

  const health = useMemo(() => computeHealth(singles, catSuggestions, mfSuggestions), [singles, catSuggestions, mfSuggestions]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const roots = useMemo(() => getShopCategoryTree().roots, [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flat = useMemo(() => flattenCategories(), [version]);
  /** Kategorie spoza 7 działów lub głębsze niż 3 poziomy — do usunięcia (produkty wracają do „Do decyzji”). */
  const loose = useMemo(() => findLooseCategories(), [version]); // eslint-disable-line react-hooks/exhaustive-deps
  const pathOf = (name: string) => flat.find((c) => categoryKey(c.name) === categoryKey(name))?.path ?? name;
  const leaves = useMemo(() => flat.filter((c) => c.isLeaf), [flat]);

  const countOf = (node: ShopCategoryNode) => subtreeNames(node).reduce((s, n) => s + (counts.get(categoryKey(n)) ?? 0), 0);

  const mfRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      const m = effectiveManufacturer(p) || NO_MANUFACTURER;
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => (a.name === NO_MANUFACTURER ? -1 : b.name === NO_MANUFACTURER ? 1 : b.count - a.count || a.name.localeCompare(b.name, 'pl')));
  }, [products]);

  // ---- układ grafu --------------------------------------------------------------------------
  const q = query.trim().toLowerCase();
  const layout = useMemo(() => {
    const virtual: ShopCategoryNode = { id: -1, name: VIRTUAL_ROOT, slug: '', parent: 0, count: 0, children: roots };
    let row = 0;
    const matches = (n: ShopCategoryNode): boolean => n.name.toLowerCase().includes(q) || n.children.some(matches);
    const build = (n: ShopCategoryNode, depth: number, parent: LNode | null, color: string): LNode => {
      const open = depth === 0 || (q ? matches(n) : expanded.has(n.name));
      const l: LNode = { node: n, depth, x: depth * (NODE_W + GAP_X), y: 0, color, kids: [], parent };
      const visibleKids = open ? n.children.filter((c) => !q || matches(c)) : [];
      visibleKids.forEach((c) => {
        // kolor działu wynika z jego miejsca w pełnym drzewie, nie z pozycji po filtrowaniu
        const col = depth === 0 ? ROOT_COLORS[Math.max(0, n.children.indexOf(c)) % ROOT_COLORS.length] : color;
        l.kids.push(build(c, depth + 1, l, col));
      });
      if (l.kids.length) l.y = (l.kids[0].y + l.kids[l.kids.length - 1].y) / 2;
      else l.y = row++ * ROW;
      return l;
    };
    const top = build(virtual, 0, null, '#8e8e93');
    const all: LNode[] = [];
    const walk = (l: LNode) => {
      all.push(l);
      l.kids.forEach(walk);
    };
    walk(top);
    const maxDepth = Math.max(...all.map((l) => l.depth));
    return { top, all, width: (maxDepth + 1) * NODE_W + maxDepth * GAP_X + 8, height: Math.max(row, 1) * ROW };
  }, [roots, expanded, q]);

  // zwijanie: węzły, które znikają z układu, na chwilę zostają i „wsuwają się” w najbliższego widocznego rodzica
  const prevAll = useRef<LNode[]>([]);
  const [ghosts, setGhosts] = useState<{ key: string; l: LNode; tx: number; ty: number; go: boolean }[]>([]);
  useEffect(() => {
    const now = new Set(layout.all.map((l) => l.node.name + l.depth));
    const gone = prevAll.current.filter((l) => !now.has(l.node.name + l.depth));
    prevAll.current = layout.all;
    if (!gone.length) return;
    const byName = new Map(layout.all.map((l) => [l.node.name, l]));
    setGhosts(
      gone.map((l) => {
        let a = l.parent;
        while (a && !byName.has(a.node.name)) a = a.parent;
        const t = a ? byName.get(a.node.name)! : null;
        return { key: `g${l.node.name}${l.depth}`, l, tx: t ? t.x : l.x - 40, ty: t ? t.y : l.y, go: false };
      }),
    );
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGhosts((g) => g.map((x) => ({ ...x, go: true })))));
    const timer = window.setTimeout(() => setGhosts([]), 420);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [layout]);
  const pathOfNode = (l: LNode): string => {
    const names: string[] = [];
    for (let c: LNode | null = l; c; c = c.parent) if (c.node.name !== VIRTUAL_ROOT) names.unshift(c.node.name);
    return names.join(' › ');
  };

  // ---- tacka z produktami -------------------------------------------------------------------
  const selectedNodeNames = useMemo(() => {
    if (!selectedCat) return null;
    const find = (nodes: ShopCategoryNode[]): ShopCategoryNode | null => {
      for (const n of nodes) {
        if (categoryKey(n.name) === categoryKey(selectedCat)) return n;
        const inner = find(n.children);
        if (inner) return inner;
      }
      return null;
    };
    const n = find(roots);
    return n ? new Set(subtreeNames(n).map(categoryKey)) : null;
  }, [selectedCat, roots]);

  const trayAll = useMemo(() => {
    const tq = trayQuery.trim().toLowerCase();
    let list = singles;
    if (mode === 'manufacturers') {
      if (supplierFilter) list = list.filter((p) => effectiveSupplier(p) === supplierFilter);
      else if (selectedMf) list = list.filter((p) => (effectiveManufacturer(p) || NO_MANUFACTURER) === selectedMf);
      else list = list.filter((p) => !effectiveManufacturer(p));
    } else if (trayFilter === 'undecided') list = list.filter((p) => displayCat.get(p.id) === UNDECIDED);
    else if (trayFilter === 'suggested') list = list.filter((p) => catSuggestions.has(p.id));
    else if (trayFilter === 'node' && selectedNodeNames) list = list.filter((p) => selectedNodeNames.has(categoryKey(displayCat.get(p.id) ?? '')));
    if (stockFilter) list = list.filter((p) => ((p.stock ?? 0) > 0) === (stockFilter === 'in'));
    if (tq) list = list.filter((p) => `${p.displayName} ${p.name} ${p.sku} ${p.ean ?? ''}`.toLowerCase().includes(tq));
    return list;
  }, [singles, mode, trayFilter, selectedMf, supplierFilter, selectedNodeNames, trayQuery, stockFilter, displayCat, catSuggestions]);
  const tray = trayAll.slice(0, limit);

  // ---- akcje --------------------------------------------------------------------------------
  async function guarded<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(key);
    try {
      return await fn();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nie udało się zapisać', 'error', 8000);
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  /** Zmiany drzewa zapisane w bazie (dodane, usunięte, przeniesione ręcznie) — wszystko, co różni drzewo od wzorca w aplikacji. */
  const overrideCount = useMemo(() => getCategoryOverrides().length, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  async function resetLayout() {
    if (!canEditCategories) return showToast('Brak uprawnienia do zmiany kategorii', 'error');
    const rows = getCategoryOverrides();
    if (!rows.length) return;
    const ok = await confirmDialog({
      title: 'Przywrócenie wzorcowego układu drzewa',
      message: `W bazie zapisano ${rows.length} zmian drzewa (dodane, usunięte i przeniesione kategorie). Usunę je, a drzewo wróci do wzorcowego układu z aplikacji. Kopię zmian pobierzesz jako plik. Produkty zostają, ale te, które siedziały w kategoriach spoza wzorca, wymagają potem użycia „Przebuduj kategorie wg nazw” (Sklep) albo ręcznego przypisania.`,
      confirmLabel: 'Przywróć układ',
      tone: 'warn',
    });
    if (!ok) return;
    downloadText(`kopia-drzewa-kategorii-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(rows, null, 2), 'application/json');
    const done = await guarded('reset', async () => {
      await resetCategoryOverrides();
      return true;
    });
    if (done) showToast('Drzewo wróciło do wzorcowego układu', 'ok', 6000);
  }

  async function cleanupLoose() {
    if (!canEditCategories) return showToast('Brak uprawnienia do zmiany kategorii', 'error');
    if (!loose.length) return;
    const keys = new Set(loose.map((c) => categoryKey(c.name)));
    const ids = singles
      .filter((p) => keys.has(categoryKey(displayCat.get(p.id) ?? '')) || keys.has(categoryKey(p.category ?? '')))
      .map((p) => p.id);
    const ok = await confirmDialog({
      title: 'Usunięcie luźnych kategorii',
      message: `Usunąć ${loose.length} kategorii spoza 7 działów lub głębszych niż 3 poziomy (${loose
        .slice(0, 6)
        .map((c) => c.name)
        .join(', ')}${loose.length > 6 ? '…' : ''})? ${ids.length} produktów trafi do „Do decyzji” — przypiszesz je ręcznie. Przypisanie da się cofnąć w Logi → Operacje masowe.`,
      confirmLabel: 'Usuń kategorie',
      tone: 'danger',
    });
    if (!ok) return;
    const done = await guarded('cleanup', async () => {
      if (ids.length) {
        const res = await runBulkEdit(ids, { category: '', shopPath: '' }, 'Porządkowanie struktury: kategorie spoza 7 działów → Do decyzji');
        onPatched(res.patches);
      }
      // od najgłębszych, żeby każda usuwana kategoria była liściem
      for (const c of [...loose].sort((a, b) => b.depth - a.depth)) await removeCategory(c.name, '');
      return true;
    });
    if (done) showToast(`Usunięto ${loose.length} luźnych kategorii, ${ids.length} produktów czeka w „Do decyzji”`, 'ok', 6000);
  }

  // stabilny uchwyt na aktualne akcje wierszy tacki (wiersze są memoizowane i nie dostają nowych funkcji co render)
  const rowAct = useRef<RowActions>({} as RowActions);
  rowAct.current = {
    startDrag: startProductDrag,
    endDrag: () => {
      setDragKind(null);
      setDropOn(null);
    },
    toggle: togglePick,
    assignCat: (id, category) => assignCategory([id], category),
    assignMf: (id, name) => assignManufacturer([id], name),
  };

  const suppliers = useMemo(() => supplierStats(singles, effectiveManufacturer), [singles]);
  /** Produkty, które mają producenta, ale jeszcze nie mają dostawcy (do jednorazowego przepisania z WAPRO). */
  const withoutSupplier = useMemo(
    () => singles.filter((p) => !effectiveSupplier(p) && (p.manufacturer ?? '').trim() && !/^(wapro|inne)$/i.test(p.manufacturer.trim())),
    [singles],
  );

  async function backfillSuppliers() {
    if (!canEditManufacturers) return showToast('Brak uprawnienia do zmiany producentów', 'error');
    if (!withoutSupplier.length) return;
    const ok = await confirmDialog({
      title: 'Utworzenie dostawców',
      message: `W WAPRO grupa produktu to dostawca, więc obecne pole „producent” zawiera dostawcę. Zapisać je także jako dostawcę w ${withoutSupplier.length} produktach? Producenta nie zmieniam — poprawisz go potem osobno. Da się cofnąć w Logi → Operacje masowe.`,
      confirmLabel: 'Utwórz dostawców',
    });
    if (!ok) return;
    await applySpec(
      withoutSupplier.map((p) => p.id),
      { supplier: SUPPLIER_FROM_MANUFACTURER },
      'Dostawca z obecnego producenta (WAPRO)',
      'Zapisano dostawców',
    );
  }

  async function applySpec(ids: string[], spec: BulkEditSpec, label: string, okText: string) {
    if (!ids.length) return;
    const res = await guarded('assign', () => runBulkEdit(ids, spec, label));
    if (!res) return;
    onPatched(res.patches);
    setPicked(new Set());
    const failed = res.failed.length ? ` (błędy: ${res.failed.length})` : '';
    showToast(`${okText}: ${res.updated} produktów${failed}. Cofniesz w Logi → Operacje masowe.`, res.failed.length ? 'error' : 'ok', 6000);
  }

  function assignCategory(ids: string[], leaf: string) {
    if (!canEditCategories) return showToast('Brak uprawnienia do zmiany kategorii', 'error');
    const info = flat.find((c) => categoryKey(c.name) === categoryKey(leaf));
    if (!info?.isLeaf) return showToast('Produkty można przypisać tylko do kategorii najniższego poziomu — wybierz podkategorię', 'error', 5000);
    void applySpec(ids, { category: info.name, shopPath: info.path }, `Przypisanie do kategorii „${info.name}”`, `Przypisano do „${info.name}”`);
  }

  /** Zdejmuje produkty z kategorii bez przenoszenia do innej — wracają do „Do decyzji”. */
  async function removeFromCategory(ids: string[]) {
    if (!canEditCategories) return showToast('Brak uprawnienia do zmiany kategorii', 'error');
    const targets = ids.filter((id) => (displayCat.get(id) ?? UNDECIDED) !== UNDECIDED);
    if (!targets.length) return showToast('Zaznaczone produkty nie mają kategorii', 'info');
    const ok = await confirmDialog({
      title: 'Usunięcie z kategorii',
      message: `${targets.length} produktów zostanie zdjętych ze swoich kategorii i trafi do „Do decyzji” (bez kategorii). Da się cofnąć w Logi → Operacje masowe.`,
      confirmLabel: 'Usuń z kategorii',
      tone: 'warn',
    });
    if (!ok) return;
    await applySpec(targets, { category: '', shopPath: '' }, 'Usunięcie z kategorii (Do decyzji)', 'Usunięto z kategorii');
  }

  function assignManufacturer(ids: string[], name: string) {
    if (!canEditManufacturers) return showToast('Brak uprawnienia do zmiany producentów', 'error');
    const value = name === NO_MANUFACTURER ? '' : name;
    void applySpec(ids, { manufacturer: value }, `Przypisanie producenta „${name}”`, `Producent „${name}”`);
  }

  async function dropCategoryOn(target: string | null) {
    const name = dragCat;
    setDragCat(null);
    setDragKind(null);
    setDropOn(null);
    if (!name || !canEditCategories) return;
    const cur = flat.find((c) => categoryKey(c.name) === categoryKey(name));
    if (!cur || categoryKey(cur.parent ?? '') === categoryKey(target ?? '')) return;
    const ok = await guarded('move', async () => {
      await moveCategory(name, target);
      return true;
    });
    if (ok) showToast(`„${name}” przeniesiono do ${target ? `„${target}”` : 'kategorii głównych'}`, 'ok');
  }

  function onDropOnNode(l: LNode) {
    const isVirtual = l.node.name === VIRTUAL_ROOT;
    const isLeaf = l.node.children.length === 0;
    const ids = dragIds;
    const kind = dragKind;
    setDropOn(null);
    setDragKind(null);
    if (kind === 'products') {
      if (isVirtual || !isLeaf) return showToast('Upuść na kategorię najniższego poziomu (bez podkategorii). Rozwiń gałąź lub dodaj podkategorię.', 'error', 5000);
      assignCategory(ids, l.node.name);
    } else if (kind === 'category') {
      if (isVirtual) return showToast('Działów głównych jest 7 i są stałe — upuść kategorię na jeden z nich albo na podkategorię', 'error', 5000);
      void dropCategoryOn(l.node.name);
    }
  }

  function startProductDrag(e: React.DragEvent, id: string) {
    const ids = picked.has(id) ? [...picked] : [id];
    setDragIds(ids);
    setDragKind('products');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${ids.length} produktów`);
  }

  function togglePick(id: string, shift: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (shift && lastPicked.current) {
        const a = tray.findIndex((p) => p.id === lastPicked.current);
        const b = tray.findIndex((p) => p.id === id);
        if (a >= 0 && b >= 0) for (const p of tray.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(p.id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastPicked.current = id;
  }

  const toggleNode = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const expandAll = () => setExpanded(new Set([VIRTUAL_ROOT, ...flat.filter((c) => !c.isLeaf).map((c) => c.name)]));

  const canDropProducts = (l: LNode) => dragKind === 'products' && canEditCategories && l.node.children.length === 0 && l.node.name !== VIRTUAL_ROOT;
  const canDropCategory = (l: LNode) => {
    if (dragKind !== 'category' || !canEditCategories || !dragCat) return false;
    if (l.node.name !== VIRTUAL_ROOT && l.node.children.length === 0 && l.depth > 1) return false;
    if (categoryKey(l.node.name) === categoryKey(dragCat)) return false;
    return !pathOf(l.node.name).split(' › ').some((s) => categoryKey(s) === categoryKey(dragCat));
  };

  // ---- szczegóły wybranej kategorii ---------------------------------------------------------
  const selInfo = selectedCat ? flat.find((c) => categoryKey(c.name) === categoryKey(selectedCat)) : undefined;

  async function addChild() {
    if (!selInfo) return;
    const name = await promptDialog({ title: 'Nowa podkategoria', message: `Nazwa podkategorii w „${selInfo.name}”:`, confirmLabel: 'Dodaj' });
    if (!name?.trim()) return;
    const added = await guarded('add', () => addCategory(name, selInfo.name));
    if (added) {
      showToast(`Dodano „${added}”`, 'ok');
      toggleNodeOpen(selInfo.name);
    }
  }
  const toggleNodeOpen = (name: string) => setExpanded((prev) => new Set(prev).add(name));

  async function rename() {
    if (!selInfo) return;
    const next = await promptDialog({ title: 'Zmiana nazwy', message: `Nowa nazwa dla „${selInfo.name}”:`, defaultValue: selInfo.name, confirmLabel: 'Zmień' });
    if (!next?.trim() || next.trim() === selInfo.name) return;
    const r = await guarded('rename', () => renameCategory(selInfo.name, next));
    if (r) {
      showToast(`Zmieniono nazwę (${r.updated} produktów)`, 'ok');
      setSelectedCat(next.trim());
    }
  }

  async function mergeInto(target: string) {
    if (!selInfo || !target) return;
    const n = counts.get(categoryKey(selInfo.name)) ?? 0;
    const ok = await confirmDialog({
      title: 'Scalenie kategorii',
      message: `Przenieść ${n} produktów z „${selInfo.name}” do „${target}” i usunąć „${selInfo.name}”?`,
      confirmLabel: 'Scal',
      tone: 'warn',
    });
    if (!ok) return;
    const r = await guarded('merge', () => removeCategory(selInfo.name, target));
    if (r) {
      showToast(`Scalono: ${r.moved} produktów → „${target}”`, 'ok');
      setSelectedCat(target);
    }
  }

  async function removeEmpty() {
    if (!selInfo) return;
    const ok = await confirmDialog({ title: 'Usunięcie kategorii', message: `Usunąć pustą kategorię „${selInfo.name}”?`, confirmLabel: 'Usuń', tone: 'danger' });
    if (!ok) return;
    const r = await guarded('remove', () => removeCategory(selInfo.name, ''));
    if (r) {
      showToast(`Usunięto „${selInfo.name}”`, 'ok');
      setSelectedCat(null);
    }
  }

  // ---- analiza: grupowanie podpowiedzi ------------------------------------------------------
  const suggestionGroups = useMemo(() => {
    const m = new Map<string, { category: string; ids: string[]; sum: number }>();
    for (const [id, s] of catSuggestions) {
      const g = m.get(s.category) ?? { category: s.category, ids: [], sum: 0 };
      g.ids.push(id);
      g.sum += s.confidence;
      m.set(s.category, g);
    }
    return [...m.values()].map((g) => ({ ...g, avg: g.sum / g.ids.length })).sort((a, b) => b.ids.length - a.ids.length);
  }, [catSuggestions]);

  const mfSuggestionGroups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [id, s] of mfSuggestions) m.set(s.manufacturer, [...(m.get(s.manufacturer) ?? []), id]);
    return [...m.entries()].map(([name, ids]) => ({ name, ids })).sort((a, b) => b.ids.length - a.ids.length);
  }, [mfSuggestions]);

  const overloaded = useMemo(
    () =>
      leaves
        .map((c) => ({ c, n: counts.get(categoryKey(c.name)) ?? 0 }))
        .filter((x) => x.n > OVERLOADED)
        .sort((a, b) => b.n - a.n)
        .map(({ c, n }) => ({
          name: c.name,
          path: c.path,
          count: n,
          topWords: topWordsOf(singles.filter((p) => categoryKey(displayCat.get(p.id) ?? '') === categoryKey(c.name))),
        })),
    [leaves, counts, singles, displayCat],
  );
  const tiny = useMemo(
    () => leaves.map((c) => ({ c, n: counts.get(categoryKey(c.name)) ?? 0 })).filter((x) => x.n <= 2).sort((a, b) => a.n - b.n || a.c.path.localeCompare(b.c.path, 'pl')),
    [leaves, counts],
  );
  const dupCategories = useMemo(() => findNearDuplicates(flat.map((c) => ({ name: c.name, count: counts.get(categoryKey(c.name)) ?? 0 }))), [flat, counts]);
  const dupManufacturers = useMemo(() => findNearDuplicates(mfRows.filter((r) => r.name !== NO_MANUFACTURER)), [mfRows]);

  function applyAllConfident() {
    const groups = suggestionGroups
      .map((g) => ({ ...g, ids: g.ids.filter((id) => (catSuggestions.get(id)?.confidence ?? 0) >= 0.6) }))
      .filter((g) => g.ids.length);
    if (!groups.length) return showToast('Brak podpowiedzi o wysokiej pewności', 'info');
    void (async () => {
      const ok = await confirmDialog({
        title: 'Zastosuj pewne podpowiedzi',
        message: `Przypisać ${groups.reduce((s, g) => s + g.ids.length, 0)} produktów do ${groups.length} kategorii wg podpowiedzi (pewność ≥ 60%)? Każdą partię można cofnąć w Logi → Operacje masowe.`,
        confirmLabel: 'Zastosuj',
        tone: 'warn',
      });
      if (!ok) return;
      for (const g of groups) assignCategory(g.ids, g.category);
    })();
  }

  const modeBtn = (m: Mode, label: string, icon: React.ReactNode) => (
    <button
      key={m}
      type="button"
      onClick={() => {
        setMode(m);
        setPicked(new Set());
        setLimit(TRAY_PAGE);
      }}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
        mode === m ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-white/10'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const btn =
    'inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';
  const btnPrimary = 'inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50';
  const card = 'rounded-3xl bg-slate-100/70 p-5 dark:bg-white/[0.045]';

  const kpis: [string, number, string][] = [
    ['Bez kategorii („Do decyzji”)', health.undecided, health.undecided ? 'text-rose-600 dark:text-rose-400' : ''],
    ['Do sprawdzenia', health.needsReview, health.needsReview ? 'text-amber-600 dark:text-amber-400' : ''],
    ['Podpowiedzi kategorii', health.withSuggestion, ''],
    ['w tym pewne (≥60%)', health.highConfidence, 'text-emerald-600 dark:text-emerald-400'],
    ['Bez producenta', health.noManufacturer, health.noManufacturer ? 'text-amber-600 dark:text-amber-400' : ''],
    ['Podpowiedzi producenta', health.manufacturerSuggestions, ''],
  ];

  return (
    <div className="catalog-readable-light w-full space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Porządkowanie asortymentu</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">Drzewo kategorii i producenci</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            Przeciągaj produkty z lewej tacki na gałęzie drzewa albo na producentów. Zaznacz kilka (Shift = zakres) i przeciągnij razem. Każda partia jest zapisana w dzienniku i można ją cofnąć.
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-white/[0.06]">
          {modeBtn('tree', 'Drzewo', <Network className="h-4 w-4" />)}
          {modeBtn('manufacturers', 'Producenci', <Boxes className="h-4 w-4" />)}
          {modeBtn('analysis', 'Analiza', <Sparkles className="h-4 w-4" />)}
          {modeBtn('shop', 'Sklep', <Store className="h-4 w-4" />)}
        </div>
      </header>

      {mode === 'shop' ? (
        <ShopMirrorPanel products={products} canEdit={canEditCategories} onPatched={onPatched} />
      ) : mode === 'analysis' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {kpis.map(([label, value, tone]) => (
              <div key={label} className={card}>
                <p className="text-[13px] text-slate-500">{label}</p>
                <p className={`mt-1 text-[28px] font-semibold leading-none tabular-nums text-slate-950 dark:text-slate-50 ${tone}`}>{value.toLocaleString('pl-PL')}</p>
              </div>
            ))}
          </div>

          <section className={card}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Pełny audyt asortymentu</h3>
                <p className="text-[13px] text-slate-500">
                  Sprawdza każdy produkt pod kątem producenta, kategorii, nazwy i gotowości do sklepu. Raport można pobrać i przeanalizować w całości.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy !== null} onClick={startAudit} className={btnPrimary}>
                  {busy === 'audit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} {busy === 'audit' ? 'Liczenie…' : 'Uruchom audyt'}
                </button>
                <button type="button" onClick={() => exportAudit('csv')} className={btn}>
                  <Download className="h-4 w-4" /> CSV
                </button>
                <button type="button" onClick={() => exportAudit('json')} className={btn}>
                  <Download className="h-4 w-4" /> JSON
                </button>
              </div>
            </div>
            {audit && (
              <div className="space-y-3">
                <p className="text-[13px] text-slate-600 dark:text-slate-300">
                  {audit.summary.withIssues.toLocaleString('pl-PL')} z {audit.summary.total.toLocaleString('pl-PL')} produktów ma uwagi; bez uwag: {audit.summary.clean.toLocaleString('pl-PL')}.
                </p>
                <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {audit.summary.byCode.map((c) => (
                    <li key={c.code} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="text-slate-700 dark:text-slate-200">{AUDIT_CODE_LABEL[c.code] ?? c.code}</span>
                      <span className="tabular-nums font-semibold text-slate-950 dark:text-slate-50">{c.count.toLocaleString('pl-PL')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className={card}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Podpowiedzi przypisań do kategorii</h3>
                <p className="text-[13px] text-slate-500">
                  Policzone z nazw produktów, którym już przypisano kategorię ({model.trained.toLocaleString('pl-PL')} produktów uczących). Pewność mówi, jak jednoznacznie słowa z nazwy wskazują kategorię.
                </p>
              </div>
              {canEditCategories && (
                <button type="button" disabled={busy !== null || health.highConfidence === 0} onClick={applyAllConfident} className={btnPrimary}>
                  <Wand2 className="h-4 w-4" /> Zastosuj pewne ({health.highConfidence})
                </button>
              )}
            </div>
            <ul className="divide-y divide-slate-200 dark:divide-white/10">
              {suggestionGroups.slice(0, 40).map((g) => (
                <li key={g.category} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{g.category}</p>
                    <p className="truncate text-xs text-slate-500">{pathOf(g.category)}</p>
                  </div>
                  <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">{g.ids.length} prod.</span>
                  <span className="w-24 text-right text-xs tabular-nums text-slate-500">śr. pewność {Math.round(g.avg * 100)}%</span>
                  <button
                    type="button"
                    className={btn}
                    onClick={() => {
                      setMode('tree');
                      setTrayFilter('suggested');
                      setSelectedCat(g.category);
                    }}
                  >
                    Przejrzyj
                  </button>
                  {canEditCategories && (
                    <button type="button" disabled={busy !== null} className={btn} onClick={() => assignCategory(g.ids, g.category)}>
                      Przypisz {g.ids.length}
                    </button>
                  )}
                </li>
              ))}
              {suggestionGroups.length === 0 && <li className="py-6 text-center text-sm text-slate-500">Brak podpowiedzi — wszystkie produkty mają pewną kategorię albo brak podobnych nazw.</li>}
            </ul>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={card}>
              <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Przeładowane kategorie (&gt; {OVERLOADED} produktów)</h3>
              <p className="mb-3 text-[13px] text-slate-500">Kandydaci do podziału na podkategorie. Najczęstsze słowa w nazwach podpowiadają, jak je rozdzielić.</p>
              <ul className="space-y-3">
                {overloaded.map((o) => (
                  <li key={o.name}>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('tree');
                        setSelectedCat(o.name);
                        setTrayFilter('node');
                      }}
                      className="block w-full text-left"
                    >
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{o.name}</span>
                        <span className="tabular-nums text-slate-700 dark:text-slate-300">{o.count}</span>
                      </div>
                      <p className="truncate text-xs text-slate-500">{o.path}</p>
                      <p className="mt-1 flex flex-wrap gap-1.5">
                        {o.topWords.map((w) => (
                          <span key={w.word} className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[11px] text-slate-700 dark:bg-white/10 dark:text-slate-300">
                            {w.word} · {w.count}
                          </span>
                        ))}
                      </p>
                    </button>
                  </li>
                ))}
                {overloaded.length === 0 && <li className="text-sm text-slate-500">Żadna kategoria nie jest przeładowana.</li>}
              </ul>
            </section>

            <section className={card}>
              <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Puste i bardzo małe kategorie (≤ 2 produkty)</h3>
              <p className="mb-3 text-[13px] text-slate-500">Kandydaci do scalenia z sąsiednią kategorią albo usunięcia.</p>
              <ul className="max-h-[26rem] space-y-1.5 overflow-auto pr-1">
                {tiny.map(({ c, n }) => (
                  <li key={c.name}>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('tree');
                        setSelectedCat(c.name);
                        setTrayFilter('node');
                      }}
                      className="flex w-full items-baseline justify-between gap-3 text-left text-sm hover:text-brand-700"
                    >
                      <span className="min-w-0 truncate text-slate-800 dark:text-slate-200">
                        {c.name} <span className="text-xs text-slate-500">· {c.path.split(' › ').slice(0, -1).join(' › ')}</span>
                      </span>
                      <span className={`tabular-nums ${n === 0 ? 'text-amber-600' : 'text-slate-600'}`}>{n}</span>
                    </button>
                  </li>
                ))}
                {tiny.length === 0 && <li className="text-sm text-slate-500">Brak.</li>}
              </ul>
            </section>

            <section className={card}>
              <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Podpowiedzi producenta</h3>
              <p className="mb-3 text-[13px] text-slate-500">Produkty bez producenta, w których nazwie występuje nazwa znanej marki.</p>
              <ul className="space-y-2">
                {mfSuggestionGroups.slice(0, 20).map((g) => (
                  <li key={g.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-semibold text-slate-900 dark:text-slate-100">{g.name}</span>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums text-slate-600">{g.ids.length} prod.</span>
                      {canEditManufacturers && (
                        <button type="button" disabled={busy !== null} className={btn} onClick={() => assignManufacturer(g.ids, g.name)}>
                          Przypisz
                        </button>
                      )}
                    </span>
                  </li>
                ))}
                {mfSuggestionGroups.length === 0 && <li className="text-sm text-slate-500">Brak podpowiedzi.</li>}
              </ul>
            </section>

            <section className={card}>
              <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Duplikaty nazw</h3>
              <p className="mb-3 text-[13px] text-slate-500">Nazwy różniące się tylko wielkością liter, spacją lub znakami.</p>
              <ul className="space-y-2.5">
                {dupManufacturers.map((g) => (
                  <li key={'m' + g.key} className="text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Producent</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {g.names.map((n) => (
                        <span key={n.name} className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs dark:bg-white/10">
                          {n.name} · {n.count}
                        </span>
                      ))}
                      {canEditManufacturers && (
                        <button
                          type="button"
                          disabled={busy !== null}
                          className={btn}
                          onClick={async () => {
                            const keep = g.names[0].name;
                            const ids = singles.filter((p) => g.names.slice(1).some((n) => n.name === effectiveManufacturer(p))).map((p) => p.id);
                            const ok = await confirmDialog({ title: 'Scalenie producentów', message: `Ustawić producenta „${keep}” w ${ids.length} produktach?`, confirmLabel: 'Scal', tone: 'warn' });
                            if (ok) assignManufacturer(ids, keep);
                          }}
                        >
                          <GitMerge className="h-4 w-4" /> Scal do „{g.names[0].name}”
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {dupCategories.map((g) => (
                  <li key={'c' + g.key} className="text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kategoria</p>
                    <div className="flex flex-wrap gap-2">
                      {g.names.map((n) => (
                        <button
                          key={n.name}
                          type="button"
                          onClick={() => {
                            setMode('tree');
                            setSelectedCat(n.name);
                          }}
                          className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs hover:bg-slate-300 dark:bg-white/10"
                        >
                          {n.name} · {n.count}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
                {dupManufacturers.length === 0 && dupCategories.length === 0 && <li className="text-sm text-slate-500">Nie znaleziono duplikatów.</li>}
              </ul>
            </section>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          {/* ------------------------------- tacka z produktami ------------------------------- */}
          <aside className={`${card} lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-hidden lg:flex lg:flex-col`}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-slate-950 dark:text-slate-50">Produkty do przeniesienia</h3>
              <span className="text-xs tabular-nums text-slate-500">{trayAll.length.toLocaleString('pl-PL')}</span>
            </div>
            {mode === 'tree' ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ['undecided', `Bez kategorii · ${health.undecided}`],
                    ['suggested', `Z podpowiedzią · ${health.withSuggestion}`],
                    ['node', 'Z wybranej gałęzi'],
                    ['all', 'Wszystkie'],
                  ] as [TrayFilter, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    disabled={k === 'node' && !selectedCat}
                    onClick={() => {
                      setTrayFilter(k);
                      setLimit(TRAY_PAGE);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-40 ${
                      trayFilter === k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/70 dark:bg-white/10 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mb-2 text-xs text-slate-500">
                {selectedMf ? (
                  <>
                    Produkty producenta <strong>{selectedMf}</strong>.{' '}
                    <button type="button" className="font-semibold text-brand-700 underline" onClick={() => setSelectedMf(null)}>
                      Pokaż bez producenta
                    </button>
                  </>
                ) : (
                  'Produkty bez producenta. Wybierz producenta po prawej, aby zobaczyć jego produkty.'
                )}
              </p>
            )}
            {mode === 'manufacturers' && (
              <div className="mb-2 space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dostawca (od kogo towar)</label>
                <select className="input-field" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
                  <option value="">Wszyscy — wg producenta</option>
                  {suppliers.map((sp) => (
                    <option key={sp.name} value={sp.name}>
                      {sp.name} ({sp.count}{sp.noManufacturer ? `, bez producenta: ${sp.noManufacturer}` : ''})
                    </option>
                  ))}
                </select>
                {canEditManufacturers && withoutSupplier.length > 0 && (
                  <button type="button" disabled={busy !== null} className={btn} onClick={() => void backfillSuppliers()}>
                    Utwórz dostawców z WAPRO ({withoutSupplier.length})
                  </button>
                )}
              </div>
            )}
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={trayQuery} onChange={(e) => setTrayQuery(e.target.value)} placeholder="Szukaj produktu, SKU, EAN…" className="input-field with-icon" />
            </div>
            <div className="mb-2 flex gap-1.5">
              {([['', 'Wszystkie'], ['in', 'Na stanie'], ['out', 'Brak na stanie']] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setStockFilter(k)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    stockFilter === k ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-200/70 text-slate-700 hover:bg-slate-300/70 dark:bg-white/10 dark:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mb-2 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 dark:text-slate-400">{picked.size ? `Zaznaczono: ${picked.size}` : 'Kliknij, aby zaznaczyć'}</span>
              <span className="flex gap-2">
                <button type="button" className="font-semibold text-brand-700 hover:underline dark:text-brand-300" onClick={() => setPicked(new Set(tray.map((p) => p.id)))}>
                  Zaznacz widoczne
                </button>
                {picked.size > 0 && (
                  <button type="button" className="font-semibold text-slate-600 hover:underline" onClick={() => setPicked(new Set())}>
                    Wyczyść
                  </button>
                )}
              </span>
            </div>

            {picked.size > 0 && (
              <div className="mb-2 rounded-2xl bg-brand-500/10 p-2.5">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-brand-800 dark:text-brand-200">
                  Przypisz zaznaczone ({picked.size}) bez przeciągania
                </label>
                {mode === 'tree' ? (
                  <select
                    className="input-field"
                    value=""
                    disabled={busy !== null || !canEditCategories}
                    onChange={(e) => e.target.value && assignCategory([...picked], e.target.value)}
                  >
                    <option value="">Wybierz kategorię…</option>
                    {leaves.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.path}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    className="input-field"
                    value=""
                    disabled={busy !== null || !canEditManufacturers}
                    onChange={(e) => e.target.value && assignManufacturer([...picked], e.target.value)}
                  >
                    <option value="">Wybierz producenta…</option>
                    {mfRows.map((r) => (
                      <option key={r.name} value={r.name}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                )}
                {mode === 'tree' && canEditCategories && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void removeFromCategory([...picked])}
                    className="mt-2 w-full rounded-xl border border-rose-400/60 bg-white px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  >
                    Usuń z kategorii (bez kategorii)
                  </button>
                )}
              </div>
            )}

            <ul className="min-h-0 flex-1 space-y-1 overflow-auto pr-1">
              {tray.map((p) => (
                <TrayRow
                  key={p.id}
                  p={p}
                  on={picked.has(p.id)}
                  mode={mode}
                  catLabel={mode === 'tree' ? displayCat.get(p.id) ?? '' : ''}
                  cs={catSuggestions.get(p.id)}
                  ms={mfSuggestions.get(p.id)}
                  mfLabel={mode === 'tree' ? '' : effectiveManufacturer(p) || 'brak producenta'}
                  supplier={mode === 'tree' ? '' : effectiveSupplier(p)}
                  draggable={mode === 'tree' ? canEditCategories : canEditManufacturers}
                  disabled={busy !== null}
                  canAssign={mode === 'tree' ? canEditCategories : canEditManufacturers}
                  showImages={showImages}
                  rowAct={rowAct}
                />
              ))}
              {tray.length === 0 && <li className="px-2 py-8 text-center text-sm text-slate-500">Brak produktów w tym widoku.</li>}
              {trayAll.length > tray.length && (
                <li>
                  <button type="button" className={`${btn} w-full justify-center`} onClick={() => setLimit((n) => n + TRAY_PAGE)}>
                    Pokaż więcej ({trayAll.length - tray.length})
                  </button>
                </li>
              )}
            </ul>
          </aside>

          {/* ------------------------------- płótno ------------------------------------------- */}
          {mode === 'tree' ? (
            <section className={`${card} min-w-0 !p-3 sm:!p-4`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[11rem] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj kategorii…" className="input-field with-icon" />
                </div>
                <button type="button" className={btn} onClick={expandAll}>
                  Rozwiń wszystko
                </button>
                <button type="button" className={btn} onClick={() => setExpanded(new Set([VIRTUAL_ROOT]))}>
                  Zwiń
                </button>
                {canEditCategories && overrideCount > 0 && (
                  <button type="button" disabled={busy !== null} className={btn} onClick={() => void resetLayout()}>
                    Przywróć wzorcowy układ ({overrideCount})
                  </button>
                )}
                {canEditCategories && loose.length > 0 && (
                  <button type="button" disabled={busy !== null} className={`${btn} !border-rose-400/60 !text-rose-700 dark:!text-rose-300`} onClick={() => void cleanupLoose()}>
                    <Trash2 className="h-4 w-4" /> Usuń luźne kategorie ({loose.length})
                  </button>
                )}
                <span className="flex items-center gap-1">
                  <button type="button" className={btn} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="Oddal">
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-xs tabular-nums text-slate-600">{Math.round(zoom * 100)}%</span>
                  <button type="button" className={btn} onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} aria-label="Przybliż">
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </span>
              </div>

              {selInfo && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 dark:bg-slate-900/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{selInfo.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {selInfo.path} · {counts.get(categoryKey(selInfo.name)) ?? 0} produktów{selInfo.isLeaf ? '' : ' (bezpośrednio)'}
                    </p>
                  </div>
                  <button type="button" className={btn} onClick={() => onShowCategory(selInfo.name)}>
                    Pokaż w katalogu
                  </button>
                  {canEditCategories && (
                    <>
                      {(!selInfo.isLeaf || selInfo.depth === 0) && (
                        <button type="button" disabled={busy !== null} className={btn} onClick={() => void addChild()}>
                          <Plus className="h-4 w-4" /> Podkategoria
                        </button>
                      )}
                      {selInfo.isLeaf && (
                        <button type="button" disabled={busy !== null} className={btn} onClick={() => void rename()}>
                          <Pencil className="h-4 w-4" /> Nazwa
                        </button>
                      )}
                      {selInfo.isLeaf && selInfo.depth > 0 && (
                        <select
                          className="input-field !w-auto"
                          value=""
                          disabled={busy !== null}
                          onChange={(e) => e.target.value && void mergeInto(e.target.value)}
                          aria-label="Scal z…"
                        >
                          <option value="">Scal z…</option>
                          {leaves
                            .filter((c) => categoryKey(c.name) !== categoryKey(selInfo.name))
                            .map((c) => (
                              <option key={c.name} value={c.name}>
                                {c.path}
                              </option>
                            ))}
                        </select>
                      )}
                      {selInfo.isLeaf && selInfo.depth > 0 && (counts.get(categoryKey(selInfo.name)) ?? 0) === 0 && (
                        <button type="button" disabled={busy !== null} className={btn} onClick={() => void removeEmpty()}>
                          <Trash2 className="h-4 w-4" /> Usuń pustą
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {busy && (
                <p className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Zapisuję zmiany…
                </p>
              )}

              <div className="max-h-[calc(100vh-14rem)] min-h-[24rem] overflow-auto rounded-2xl bg-white p-4 dark:bg-slate-950/40">
                <div style={{ width: layout.width * zoom, height: layout.height * zoom + 8 }}>
                  <div className="relative origin-top-left" style={{ width: layout.width, height: layout.height + 8, transform: `scale(${zoom})` }}>
                    <svg className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height + 8} aria-hidden>
                      {layout.all
                        .filter((l) => l.parent)
                        .map((l) => {
                          const p = l.parent!;
                          const x1 = p.x + NODE_W;
                          const y1 = p.y + NODE_H / 2;
                          const x2 = l.x;
                          const y2 = l.y + NODE_H / 2;
                          const mx = (x1 + x2) / 2;
                          const d = `M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
                          return (
                            <path
                              key={l.node.name + l.depth}
                              d={d}
                              style={{ d: `path("${d}")`, transition: `d 0.38s ${EASE}, stroke-opacity 0.3s`, animation: 'fade-in 0.45s ease-out both' } as React.CSSProperties}
                              fill="none"
                              stroke={l.color}
                              strokeOpacity={0.45}
                              strokeWidth={1.75}
                            />
                          );
                        })}
                    </svg>
                    {ghosts.map((g) => {
                      const GIcon = iconForCategory(g.l.node.name, pathOfNode(g.l));
                      return (
                        <div
                          key={g.key}
                          aria-hidden
                          className="pointer-events-none absolute flex items-center gap-2 rounded-xl border border-l-4 border-slate-200 bg-white px-2 text-[13px] font-medium text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          style={{ left: g.go ? g.tx : g.l.x, top: g.go ? g.ty : g.l.y, width: NODE_W, height: NODE_H, borderLeftColor: g.l.color, opacity: g.go ? 0 : 1, transform: g.go ? 'scale(0.9)' : 'none', transition: `left 0.38s ${EASE}, top 0.38s ${EASE}, opacity 0.34s ease-in, transform 0.38s ${EASE}` }}
                        >
                          <GIcon className="h-4 w-4 shrink-0" style={{ color: g.l.color }} />
                          <span className="truncate">{g.l.node.name}</span>
                        </div>
                      );
                    })}
                    {layout.all.map((l, idx) => {
                      const n = l.node;
                      const isVirtual = n.name === VIRTUAL_ROOT;
                      const hasKids = n.children.length > 0;
                      const open = isVirtual || (q ? true : expanded.has(n.name));
                      const total = isVirtual ? products.length : countOf(n);
                      const own = counts.get(categoryKey(n.name)) ?? 0;
                      const active = !isVirtual && selectedCat && categoryKey(selectedCat) === categoryKey(n.name);
                      const dropOk = canDropProducts(l) || canDropCategory(l);
                      const hot = dropOn === n.name && dropOk;
                      const empty = !hasKids && own === 0;
                      const heavy = !hasKids && own > OVERLOADED;
                      const NodeIcon = isVirtual ? Network : iconForCategory(n.name, pathOfNode(l));
                      const hsh = hashOf(n.name);
                      const floatVars = { '--kc-dur': `${8 + (hsh % 50) / 10}s`, '--kc-delay': `-${(hsh % 90) / 10}s`, '--kc-icon-dur': `${5 + (hsh % 30) / 10}s` } as React.CSSProperties;
                      return (
                        <div
                          key={n.name + l.depth}
                          draggable={canEditCategories && !isVirtual}
                          onDragStart={(e) => {
                            setDragCat(n.name);
                            setDragKind('category');
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', n.name);
                          }}
                          onDragEnd={() => {
                            setDragKind(null);
                            setDragCat(null);
                            setDropOn(null);
                          }}
                          onDragOver={(e) => {
                            if (dropOk) {
                              e.preventDefault();
                              setDropOn(n.name);
                            }
                          }}
                          onDragLeave={() => setDropOn((d) => (d === n.name ? null : d))}
                          onDrop={(e) => {
                            if (dropOk) {
                              e.preventDefault();
                              onDropOnNode(l);
                            }
                          }}
                          style={{
                            left: l.x,
                            top: l.y,
                            width: NODE_W,
                            height: NODE_H,
                            transition: `left 0.38s ${EASE}, top 0.38s ${EASE}`,
                            animationDelay: `${Math.min(idx, 14) * 22}ms`,
                          }}
                          className="kc-node-in absolute"
                        >
                        <div
                          style={{ ...floatVars, borderLeftColor: l.color }}
                          className={`kc-card flex h-full w-full items-center gap-1.5 rounded-xl border border-l-4 bg-white px-2 shadow-sm transition dark:bg-slate-900 ${isVirtual || dragKind || layout.all.length > 70 ? '' : 'kc-float'} ${
                            hot
                              ? 'scale-[1.04] border-brand-500 ring-2 ring-brand-500'
                              : dragKind && dropOk
                                ? 'border-brand-400/70 ring-1 ring-brand-400/40'
                                : active
                                  ? 'border-brand-500 ring-1 ring-brand-500/60'
                                  : 'border-slate-200 dark:border-slate-700'
                          } ${dragKind && !dropOk && !isVirtual ? 'opacity-50' : ''}`}
                        >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${l.color}26`, color: l.color }}
                            aria-hidden
                          >
                            <NodeIcon className="kc-icon h-4 w-4" />
                          </span>
                          {hasKids ? (
                            <button
                              type="button"
                              onClick={() => !isVirtual && toggleNode(n.name)}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                              aria-label={open ? 'Zwiń' : 'Rozwiń'}
                            >
                              {isVirtual ? <Minus className="h-3.5 w-3.5 opacity-0" /> : open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          ) : (
                            <span className="h-6 w-1 shrink-0" />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (isVirtual) return;
                              setSelectedCat(n.name);
                              if (trayFilter === 'undecided' && !picked.size) setTrayFilter('node');
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className={`block truncate text-[13px] leading-tight ${hasKids ? 'font-semibold' : 'font-medium'} text-slate-900 dark:text-slate-100`}>
                              {isVirtual ? 'Katalog' : n.name}
                            </span>
                            <span className="block truncate text-[10px] leading-tight text-slate-500">
                              {isVirtual ? `${roots.length} działów` : hasKids ? `${n.children.length} podkategorii` : empty ? 'pusta' : heavy ? 'przeładowana' : 'kategoria'}
                            </span>
                          </button>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                              empty ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : heavy ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {total}
                          </span>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className={`${card} min-w-0`}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[11rem] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input value={mfQuery} onChange={(e) => setMfQuery(e.target.value)} placeholder="Szukaj producenta…" className="input-field with-icon" />
                </div>
                {selectedMf && selectedMf !== NO_MANUFACTURER && (
                  <button type="button" className={btn} onClick={() => onShowManufacturer(selectedMf)}>
                    Pokaż w katalogu
                  </button>
                )}
              </div>
              <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
                {mfRows
                  .filter((r) => !mfQuery.trim() || r.name.toLowerCase().includes(mfQuery.trim().toLowerCase()))
                  .map((r) => {
                    const none = r.name === NO_MANUFACTURER;
                    const hot = dropOn === 'mf:' + r.name && dragKind === 'products';
                    const active = (selectedMf ?? (none ? NO_MANUFACTURER : null)) === r.name && (selectedMf !== null || none);
                    return (
                      <li
                        key={r.name}
                        onClick={() => setSelectedMf(none ? null : r.name)}
                        onDragOver={(e) => {
                          if (dragKind === 'products' && canEditManufacturers) {
                            e.preventDefault();
                            setDropOn('mf:' + r.name);
                          }
                        }}
                        onDragLeave={() => setDropOn((d) => (d === 'mf:' + r.name ? null : d))}
                        onDrop={(e) => {
                          if (dragKind === 'products' && canEditManufacturers) {
                            e.preventDefault();
                            setDropOn(null);
                            setDragKind(null);
                            assignManufacturer(dragIds, r.name);
                          }
                        }}
                        className={`cursor-pointer rounded-2xl border px-3.5 py-3 transition ${
                          hot
                            ? 'scale-[1.03] border-brand-500 bg-brand-500/10 ring-2 ring-brand-500'
                            : active
                              ? 'border-brand-500 bg-white ring-1 ring-brand-500/50 dark:bg-slate-900'
                              : none
                                ? 'border-dashed border-amber-500/60 bg-amber-500/5'
                                : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                        } ${dragKind === 'products' && !hot ? 'ring-1 ring-brand-400/30' : ''}`}
                      >
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{r.name}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-slate-500">{r.count} produktów</p>
                      </li>
                    );
                  })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
