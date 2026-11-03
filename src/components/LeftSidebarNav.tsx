import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  FolderOpen,
  GripVertical,
  History,
  Home,
  Layers,
  Maximize2,
  Printer,
  RotateCcw,
  ScrollText,
  Search,
  Settings2,
  Sparkles,
  Star,
  Tag,
  TrendingUp,
  Wrench,
  Building2,
  Cpu,
  Network,
  FolderTree,
  Type,
  Wand2,
  ListChecks,
} from 'lucide-react';
import type { View } from '../types';
import { canAccessAdminPanel } from '../lib/adminAccess';
import { openGlobalAdminPanel } from '../lib/adminNavigation';
import { roleCan, type AppRole } from '../lib/roles';
import { ENGINE_NAME } from '../lib/engineBrand';
import {
  getCachedCatalogPreferences,
  scheduleSaveUserPreferences,
} from '../lib/userPreferences';
import { NavTab } from './NavTab';
import { APP_VERSION } from '../lib/appVersion';

type SidebarItem = {
  id: View;
  icon: ReactNode;
  label: string;
  count?: number;
  highlight?: boolean;
  available: boolean;
  onClick: () => void;
};

type SidebarPrefs = {
  order: View[];
  hidden: View[];
  /** Własne przypisanie pozycji do sekcji menu: widok → id sekcji (domyślnie wg NAV_GROUPS). */
  groups: Record<string, string>;
};

const PREFS_KEY = 'katalog-sidebar-prefs-v1';

const DEFAULT_ORDER: View[] = [
  'home',
  'catalog',
  'engine',
  'groups',
  'library',
  'logs',
  'history',
  'new-products',
  'updates',
  'favorites',
  'collections',
  'kits',
  'progress',
  'catalog-decisions',
  'catalog-hidden',
  'manufacturers',
  'categories',
  'assortment',
  'rules',
  'names',
  'attributes',
  'small-images',
  'promotions',
  'labels',
  'admin',
  'warehouse',
];

const GROUPS_KEY = 'katalog-sidebar-groups-v1';

/** Grupy menu bocznego (jak w panelach typu BaseLinker): nagłówek zwija i rozwija sekcję. */
const NAV_GROUPS: { id: string; label: string; defaultOpen: boolean; items: View[]; icon?: typeof Boxes }[] = [
  { id: 'main', label: '', defaultOpen: true, items: ['home', 'catalog', 'favorites', 'collections'] },
  { id: 'products', label: 'Produkty', icon: Boxes, defaultOpen: true, items: ['engine', 'new-products', 'groups', 'kits', 'promotions', 'labels', 'warehouse', 'library'] },
  { id: 'quality', label: 'Jakość danych', icon: ListChecks, defaultOpen: true, items: ['catalog-decisions', 'names', 'rules', 'small-images', 'catalog-hidden'] },
  { id: 'dictionaries', label: 'Słowniki', icon: FolderTree, defaultOpen: false, items: ['assortment', 'manufacturers', 'attributes'] },
  { id: 'analytics', label: 'Analizy', icon: BarChart3, defaultOpen: false, items: ['progress', 'history'] },
  { id: 'system', label: 'System', icon: Settings2, defaultOpen: false, items: ['logs', 'updates', 'admin'] },
];

const DEFAULT_GROUP_OF: Record<string, string> = Object.fromEntries(NAV_GROUPS.flatMap((g) => g.items.map((id) => [id, g.id])));
const GROUP_IDS = new Set(NAV_GROUPS.map((g) => g.id));

function cleanGroups(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && GROUP_IDS.has(v)) out[k] = v;
    }
  }
  return out;
}

function readOpenGroups(): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(GROUPS_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function readLocalPrefs(): SidebarPrefs {
  const cached = getCachedCatalogPreferences();
  const fromCache: SidebarPrefs = {
    order: Array.isArray(cached.sidebarOrder) ? cached.sidebarOrder : [],
    hidden: Array.isArray(cached.sidebarHidden) ? cached.sidebarHidden : [],
    groups: cleanGroups(cached.sidebarGroups),
  };
  if (fromCache.order.length || fromCache.hidden.length || Object.keys(fromCache.groups).length) return fromCache;

  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { order: [], hidden: [], groups: {} };
    const parsed = JSON.parse(raw) as Partial<SidebarPrefs>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      groups: cleanGroups(parsed.groups),
    };
  } catch {
    return { order: [], hidden: [], groups: {} };
  }
}

function persistPrefs(userId: string | undefined, prefs: SidebarPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  scheduleSaveUserPreferences(userId ?? '', {
    catalog: {
      sidebarOrder: prefs.order,
      sidebarHidden: prefs.hidden,
      sidebarGroups: prefs.groups,
    },
  });
}

function sortSidebarItems(items: SidebarItem[], order: View[]): SidebarItem[] {
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) => {
    const ai = orderMap.get(a.id) ?? DEFAULT_ORDER.indexOf(a.id);
    const bi = orderMap.get(b.id) ?? DEFAULT_ORDER.indexOf(b.id);
    return ai - bi;
  });
}

function normalizePrefs(prefs: SidebarPrefs, availableIds: View[]): SidebarPrefs {
  const available = new Set(availableIds);
  const order = [
    ...prefs.order.filter((id) => available.has(id)),
    ...DEFAULT_ORDER.filter((id) => available.has(id) && !prefs.order.includes(id)),
  ];
  const hidden = prefs.hidden.filter((id) => available.has(id));
  const groups = Object.fromEntries(Object.entries(cleanGroups(prefs.groups)).filter(([id]) => available.has(id as View)));
  return { order, hidden, groups };
}

function moveItem(list: View[], fromId: View, toId: View): View[] {
  if (fromId === toId) return list;
  const next = [...list];
  const from = next.indexOf(fromId);
  const to = next.indexOf(toId);
  if (from < 0 || to < 0) return list;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export interface LeftSidebarNavProps {
  view: View;
  setView: (view: View) => void;
  role: AppRole;
  userId?: string;
  isCatalogProduct: boolean;
  isStockProduct: boolean;
  collectionUserKey: string | null | undefined;
  productsCount: number;
  favoriteCount: number;
  collectionCount: number;
  catalogKitsCount: number;
  catalogDecisionCount: number;
  hiddenProductsCount: number;
  missingImagesCount: number;
  labelQueueCount: number;
  newProductsCount: number;
  onOpenMissingImages: () => void;
  onOpenLabels: () => void;
  /** 'embedded' = menu w szufladzie telefonu (bez własnego pozycjonowania); domyślnie stały panel boczny na komputerze. */
  variant?: 'sidebar' | 'embedded';
  /** Wywoływane po wybraniu pozycji (np. zamknięcie szuflady na telefonie). */
  onNavigate?: () => void;
}

export function LeftSidebarNav({
  view,
  setView,
  role,
  userId,
  isCatalogProduct,
  isStockProduct,
  collectionUserKey,
  productsCount,
  favoriteCount,
  collectionCount,
  catalogKitsCount,
  catalogDecisionCount,
  hiddenProductsCount,
  missingImagesCount,
  labelQueueCount,
  newProductsCount,
  onOpenMissingImages,
  onOpenLabels,
  variant = 'sidebar',
  onNavigate,
}: LeftSidebarNavProps) {
  const [customizing, setCustomizing] = useState(false);
  const [prefs, setPrefs] = useState<SidebarPrefs>(() => readLocalPrefs());
  const [draggedId, setDraggedId] = useState<View | null>(null);
  const [dropTargetId, setDropTargetId] = useState<View | null>(null);
  const [dropGroupId, setDropGroupId] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(readLocalPrefs());
    const onChange = () => setPrefs(readLocalPrefs());
    window.addEventListener('katalog-user-preferences-changed', onChange);
    return () => window.removeEventListener('katalog-user-preferences-changed', onChange);
  }, [userId]);

  const allItems = useMemo<SidebarItem[]>(
    () => [
      {
        id: 'home',
        icon: <Home className="h-4 w-4" />,
        label: 'Start',
        available: isCatalogProduct,
        onClick: () => setView('home'),
      },
      {
        id: 'catalog',
        icon: <Search className="h-4 w-4" />,
        label: 'Katalog',
        count: productsCount,
        available: true,
        onClick: () => setView('catalog'),
      },
      {
        id: 'groups',
        icon: <Wrench className="h-4 w-4" />,
        label: 'Grupy produktów',
        available: isCatalogProduct,
        onClick: () => setView('groups'),
      },
      {
        id: 'library',
        icon: <BookOpen className="h-4 w-4" />,
        label: 'Biblioteka',
        available: true,
        onClick: () => setView('library'),
      },
      {
        id: 'logs',
        icon: <ScrollText className="h-4 w-4" />,
        label: 'Logi',
        available: true,
        onClick: () => setView('logs'),
      },
      {
        id: 'history',
        icon: <TrendingUp className="h-4 w-4" />,
        label: 'Zmiany w czasie',
        available: isCatalogProduct,
        onClick: () => setView('history'),
      },
      {
        id: 'new-products',
        icon: <Sparkles className="h-4 w-4" />,
        label: 'Nowe produkty',
        count: newProductsCount,
        highlight: newProductsCount > 0,
        available: isCatalogProduct,
        onClick: () => setView('new-products'),
      },
      {
        id: 'updates',
        icon: <History className="h-4 w-4" />,
        label: 'Aktualizacje',
        available: isCatalogProduct,
        onClick: () => setView('updates'),
      },
      {
        id: 'favorites',
        icon: <Star className="h-4 w-4" />,
        label: 'Ulubione',
        count: favoriteCount,
        highlight: favoriteCount > 0,
        available: roleCan(role, 'manageFavorites'),
        onClick: () => setView('favorites'),
      },
      {
        id: 'collections',
        icon: <FolderOpen className="h-4 w-4" />,
        label: 'Foldery',
        count: collectionCount > 0 ? collectionCount : undefined,
        available: isCatalogProduct && Boolean(collectionUserKey),
        onClick: () => setView('collections'),
      },
      {
        id: 'kits',
        icon: <Layers className="h-4 w-4" />,
        label: 'Zestawy',
        count: catalogKitsCount,
        available: roleCan(role, 'manageKits'),
        onClick: () => setView('kits'),
      },
      {
        id: 'progress',
        icon: <BarChart3 className="h-4 w-4" />,
        label: 'Statystyki',
        available: roleCan(role, 'viewProgress'),
        onClick: () => setView('progress'),
      },
      {
        id: 'catalog-decisions',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Uzupełnianie danych',
        count: catalogDecisionCount,
        highlight: catalogDecisionCount > 0,
        available: roleCan(role, 'viewProgress'),
        onClick: () => setView('catalog-decisions'),
      },
      {
        id: 'attributes',
        icon: <ListChecks className="h-4 w-4" />,
        label: 'Atrybuty',
        available: isCatalogProduct && roleCan(role, 'viewProgress'),
        onClick: () => setView('attributes'),
      },
      {
        id: 'names',
        icon: <Type className="h-4 w-4" />,
        label: 'Standard nazw',
        available: isCatalogProduct && roleCan(role, 'viewProgress'),
        onClick: () => setView('names'),
      },
      {
        id: 'rules',
        icon: <Wand2 className="h-4 w-4" />,
        label: 'Reguły jakości',
        available: isCatalogProduct && roleCan(role, 'viewProgress'),
        onClick: () => setView('rules'),
      },
      {
        id: 'engine',
        icon: <Cpu className="h-4 w-4" />,
        label: ENGINE_NAME,
        available: isCatalogProduct && roleCan(role, 'viewProgress'),
        onClick: () => setView('engine'),
      },
      {
        id: 'assortment',
        icon: <Network className="h-4 w-4" />,
        label: 'Porządkowanie',
        available: isCatalogProduct && roleCan(role, 'viewProgress'),
        onClick: () => setView('assortment'),
      },
      {
        id: 'categories',
        icon: <FolderTree className="h-4 w-4" />,
        label: 'Kategorie',
        available: false,
        onClick: () => setView('assortment'),
      },
      {
        id: 'manufacturers',
        icon: <Building2 className="h-4 w-4" />,
        label: 'Producenci',
        available: isCatalogProduct && roleCan(role, 'viewProgress'),
        onClick: () => setView('manufacturers'),
      },
      {
        id: 'catalog-hidden',
        icon: <EyeOff className="h-4 w-4" />,
        label: 'Ukryte',

        count: hiddenProductsCount,
        highlight: hiddenProductsCount > 0,
        available: roleCan(role, 'viewProgress'),
        onClick: () => setView('catalog-hidden'),
      },
      {
        id: 'small-images',
        icon: <Maximize2 className="h-4 w-4" />,
        label: 'Zdjęcia do poprawy',
        available: isCatalogProduct && roleCan(role, 'viewProgress'),
        onClick: () => setView('small-images'),
      },
      {
        id: 'promotions',
        icon: <Tag className="h-4 w-4" />,
        label: 'Promocje',
        available: isCatalogProduct && roleCan(role, 'viewPrices'),
        onClick: () => setView('promotions'),
      },
      {
        id: 'labels',
        icon: <Printer className="h-4 w-4" />,
        label: 'Etykiety',
        count: labelQueueCount,
        highlight: labelQueueCount > 0,
        available: roleCan(role, 'printLabels'),
        onClick: onOpenLabels,
      },
      {
        id: 'admin',
        icon: <Settings2 className="h-4 w-4" />,
        label: 'Administracja',
        available: canAccessAdminPanel(role),
        onClick: () => openGlobalAdminPanel(),
      },
      {
        id: 'warehouse',
        icon: <Boxes className="h-4 w-4" />,
        label: 'Magazyn',
        available:
          isStockProduct && (roleCan(role, 'printLabels') || roleCan(role, 'editStock')),
        onClick: () => setView('warehouse'),
      },
    ],
    [
      role,
      isCatalogProduct,
      isStockProduct,
      collectionUserKey,
      productsCount,
      favoriteCount,
      collectionCount,
      catalogKitsCount,
      catalogDecisionCount,
      hiddenProductsCount,
      missingImagesCount,
      labelQueueCount,
      newProductsCount,
      setView,
      onOpenMissingImages,
      onOpenLabels,
    ],
  );

  const availableItems = allItems.filter((item) => item.available);
  const normalizedPrefs = useMemo(
    () => normalizePrefs(prefs, availableItems.map((item) => item.id)),
    [availableItems, prefs],
  );
  const hidden = new Set(normalizedPrefs.hidden);
  const sortedItems = sortSidebarItems(availableItems, normalizedPrefs.order);
  const visibleItems = customizing
    ? sortedItems
    : sortedItems.filter((item) => !hidden.has(item.id));

  function commitPrefs(next: SidebarPrefs) {
    const normalized = normalizePrefs(next, availableItems.map((item) => item.id));
    setPrefs(normalized);
    persistPrefs(userId, normalized);
  }

  function toggleHidden(id: View) {
    const nextHidden = hidden.has(id)
      ? normalizedPrefs.hidden.filter((x) => x !== id)
      : [...normalizedPrefs.hidden, id];
    commitPrefs({ ...normalizedPrefs, hidden: nextHidden });
  }

  function resetPrefs() {
    commitPrefs({ order: DEFAULT_ORDER, hidden: [], groups: {} });
    setDraggedId(null);
    setDropTargetId(null);
  }

  const lastGroupId = NAV_GROUPS[NAV_GROUPS.length - 1].id;

  function groupOf(id: string): string {
    return normalizedPrefs.groups[id] ?? DEFAULT_GROUP_OF[id] ?? lastGroupId;
  }

  function withGroup(id: string, groupId: string): Record<string, string> {
    const groups = { ...normalizedPrefs.groups };
    if (groupId === (DEFAULT_GROUP_OF[id] ?? lastGroupId)) delete groups[id];
    else groups[id] = groupId;
    return groups;
  }

  function onDropOn(targetId: View) {
    if (!draggedId) return;
    commitPrefs({
      ...normalizedPrefs,
      groups: withGroup(draggedId, groupOf(targetId)),
      order: moveItem(normalizedPrefs.order, draggedId, targetId),
    });
    setDraggedId(null);
    setDropTargetId(null);
    setDropGroupId(null);
  }

  /** Upuszczenie na nagłówek sekcji: pozycja trafia na koniec tej sekcji. */
  function onDropOnGroup(groupId: string) {
    if (!draggedId) return;
    const rest = normalizedPrefs.order.filter((id) => id !== draggedId);
    let insertAt = rest.length;
    for (let i = rest.length - 1; i >= 0; i--) {
      if (groupOf(rest[i]) === groupId) {
        insertAt = i + 1;
        break;
      }
    }
    rest.splice(insertAt, 0, draggedId);
    commitPrefs({ ...normalizedPrefs, groups: withGroup(draggedId, groupId), order: rest });
    setDraggedId(null);
    setDropTargetId(null);
    setDropGroupId(null);
  }

  const groupedItems = useMemo(() => {
    // kolejność wewnątrz sekcji wynika z ustawień użytkownika (przeciąganie); sekcję wskazuje domyślny podział lub wybór użytkownika
    const out = NAV_GROUPS.map((g) => ({ ...g, items: visibleItems.filter((i) => groupOf(i.id) === g.id) }));
    // w trybie edycji pokazujemy też puste sekcje, żeby dało się do nich przeciągać
    return customizing ? out : out.filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleItems, normalizedPrefs.groups, customizing]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(readOpenGroups);
  // przejście do widoku z zwiniętej grupy rozwija tę grupę
  useEffect(() => {
    const g = NAV_GROUPS.find((x) => x.id === groupOf(view));
    if (g && g.label) setOpenGroups((prev) => (prev[g.id] === false || (prev[g.id] === undefined && !g.defaultOpen) ? { ...prev, [g.id]: true } : prev));
  }, [view]);

  function toggleGroup(id: string, currentlyOpen: boolean) {
    const next = { ...openGroups, [id]: !currentlyOpen };
    setOpenGroups(next);
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const renderItem = (item: SidebarItem) => {
        const isHidden = hidden.has(item.id);
        const isDragged = draggedId === item.id;
        const isDropTarget = dropTargetId === item.id && draggedId !== item.id;

        if (!customizing) {
          // kafelek można chwycić i upuścić na panel podzielonego ekranu (App nasłuchuje data-nav-view)
          return (
            <div
              key={item.id}
              data-nav-view={item.id}
              draggable={variant !== 'embedded'}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copyMove';
                e.dataTransfer.setData('application/x-kenochem-view', item.id);
                e.dataTransfer.setData('text/plain', item.id);
              }}
            >
              <NavTab
                layout="sidebar"
                active={view === item.id}
                onClick={() => {
                  item.onClick();
                  onNavigate?.();
                }}
                icon={item.icon}
                label={item.label}
                count={item.count}
                highlight={item.highlight}
              />
            </div>
          );
        }

        return (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              setDraggedId(item.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', item.id);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropTargetId(item.id);
            }}
            onDragLeave={() => {
              if (dropTargetId === item.id) setDropTargetId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDropOn(item.id);
            }}
            onDragEnd={() => {
              setDraggedId(null);
              setDropTargetId(null);
            }}
            className={`group relative flex min-h-11 items-center gap-2 rounded-xl border px-2 py-2 text-sm transition ${
              isDropTarget
                ? 'translate-y-0 border-brand-500 bg-brand-50 shadow-lg shadow-brand-100/80 dark:bg-brand-500/15 dark:shadow-brand-950/20'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/45'
            } ${isDragged ? 'scale-[0.98] opacity-50' : ''} ${isHidden ? 'opacity-55' : ''}`}
          >
            {isDropTarget && (
              <span className="absolute -top-1 left-3 right-3 h-0.5 rounded-full bg-brand-400" />
            )}
            <span
              className="cursor-grab rounded-lg p-1 text-slate-500 active:cursor-grabbing group-hover:text-slate-900 dark:group-hover:text-slate-200"
              title="Przeciągnij"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <span className="shrink-0 text-slate-500 dark:text-slate-300">{item.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-slate-900 dark:text-slate-100">{item.label}</span>
              <span className="block text-[10px] text-slate-500">
                {isHidden ? 'Ukryte' : 'Widoczne'}
              </span>
            </span>
            {item.count !== undefined && (
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {item.count}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleHidden(item.id)}
              className={`rounded-lg p-1.5 transition ${
                isHidden
                  ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                  : 'text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10'
              }`}
              title={isHidden ? 'Pokaż w menu' : 'Ukryj z menu'}
              aria-label={isHidden ? 'Pokaż w menu' : 'Ukryj z menu'}
            >
              {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        );
  };

  return (
    <div
      className={
        variant === 'embedded'
          ? 'catalog-readable-light flex flex-col gap-2'
          : 'catalog-readable-light fixed z-30 hidden w-60 flex-col gap-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-800/60 dark:bg-slate-950/95 dark:shadow-none lg:flex'
      }
      style={
        variant === 'embedded'
          ? undefined
          : {
              top: 'calc(var(--catalog-sticky-top, 0px) + 0.75rem)',
              left: '0.75rem',
              bottom: '0.75rem',
            }
      }
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Menu
          <button
            type="button"
            onClick={() => setView('updates')}
            className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal tabular-nums text-slate-500 hover:text-brand-600 dark:bg-slate-800/70 dark:text-slate-400 dark:hover:text-brand-300"
            title="Wersja aplikacji — zobacz dziennik zmian"
          >
            v{APP_VERSION}
          </button>
        </span>
        <div className="flex items-center gap-1">
          {customizing && (
            <button
              type="button"
              onClick={resetPrefs}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-200"
              title="Przywróć domyślną kolejność"
              aria-label="Przywróć domyślną kolejność"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCustomizing((v) => !v)}
            className={`rounded-lg p-1.5 transition ${
              customizing
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-200'
            }`}
            title={customizing ? 'Zakończ edycję menu' : 'Edytuj menu boczne'}
            aria-label={customizing ? 'Zakończ edycję menu' : 'Edytuj menu boczne'}
          >
            {customizing ? <Check className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {customizing && (
        <p className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-[11px] leading-snug text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200">
          Chwyć uchwyt i przeciągnij pozycję: na inną pozycję (zmienia kolejność) albo na nagłówek innej sekcji (przenosi ją tam). Ikona oka ukrywa pozycję z menu.
        </p>
      )}

      <nav className="flex flex-col gap-1" aria-label="Menu katalogu">
        {groupedItems.map((group) => {
          const open = customizing || !group.label || (openGroups[group.id] ?? group.defaultOpen);
          const alertCount = group.items.reduce((n, i) => n + (i.highlight && i.count ? i.count : 0), 0);
          return (
            <div key={group.id} className={group.label ? 'mt-1.5' : ''}>
              {(group.label || customizing) && (
                <button
                  type="button"
                  onClick={() => (customizing ? undefined : toggleGroup(group.id, open))}
                  onDragOver={(e) => {
                    if (!customizing) return;
                    e.preventDefault();
                    setDropGroupId(group.id);
                  }}
                  onDragLeave={() => {
                    if (dropGroupId === group.id) setDropGroupId(null);
                  }}
                  onDrop={(e) => {
                    if (!customizing) return;
                    e.preventDefault();
                    onDropOnGroup(group.id);
                  }}
                  aria-expanded={open}
                  className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-200 ${customizing && dropGroupId === group.id ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-400 dark:bg-brand-500/15' : ''}`}
                >
                  {group.icon && <group.icon className="h-[18px] w-[18px] shrink-0 text-brand-500" />}
                  <span className="min-w-0 flex-1 truncate">{group.label || 'Główne'}</span>
                  {!open && alertCount > 0 && (
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold normal-case tabular-nums tracking-normal text-amber-600 dark:text-amber-300">{alertCount}</span>
                  )}
                  {!customizing && group.label && <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`} />}
                </button>
              )}
              {open && (
                <div className={`flex flex-col gap-1 ${group.label ? 'ml-4 mt-0.5 border-l border-slate-200 pl-2 dark:border-slate-800' : ''}`}>
                  {group.items.map(renderItem)}
                  {customizing && group.items.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-center text-[11px] text-slate-500 dark:border-slate-700">Upuść tutaj pozycję</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
