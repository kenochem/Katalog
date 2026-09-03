import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Boxes,
  Check,
  Eye,
  EyeOff,
  FolderOpen,
  GripVertical,
  Home,
  ImageOff,
  Layers,
  Printer,
  RotateCcw,
  ScrollText,
  Search,
  Settings2,
  Star,
} from 'lucide-react';
import type { View } from '../types';
import { canAccessAdminPanel } from '../lib/adminAccess';
import { openGlobalAdminPanel } from '../lib/adminNavigation';
import { roleCan, type AppRole } from '../lib/roles';
import {
  getCachedCatalogPreferences,
  scheduleSaveUserPreferences,
} from '../lib/userPreferences';
import { NavTab } from './NavTab';

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
};

const PREFS_KEY = 'katalog-sidebar-prefs-v1';

const DEFAULT_ORDER: View[] = [
  'home',
  'catalog',
  'library',
  'logs',
  'favorites',
  'collections',
  'kits',
  'progress',
  'catalog-decisions',
  'catalog-hidden',
  'missing-images',
  'labels',
  'admin',
  'warehouse',
];

function readLocalPrefs(): SidebarPrefs {
  const cached = getCachedCatalogPreferences();
  const fromCache: SidebarPrefs = {
    order: Array.isArray(cached.sidebarOrder) ? cached.sidebarOrder : [],
    hidden: Array.isArray(cached.sidebarHidden) ? cached.sidebarHidden : [],
  };
  if (fromCache.order.length || fromCache.hidden.length) return fromCache;

  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { order: [], hidden: [] };
    const parsed = JSON.parse(raw) as Partial<SidebarPrefs>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    };
  } catch {
    return { order: [], hidden: [] };
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
  return { order, hidden };
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
  onOpenMissingImages: () => void;
  onOpenLabels: () => void;
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
  onOpenMissingImages,
  onOpenLabels,
}: LeftSidebarNavProps) {
  const [customizing, setCustomizing] = useState(false);
  const [prefs, setPrefs] = useState<SidebarPrefs>(() => readLocalPrefs());
  const [draggedId, setDraggedId] = useState<View | null>(null);
  const [dropTargetId, setDropTargetId] = useState<View | null>(null);

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
        label: 'Postęp',
        available: roleCan(role, 'viewProgress'),
        onClick: () => setView('progress'),
      },
      {
        id: 'catalog-decisions',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'Decyzje',
        count: catalogDecisionCount,
        highlight: catalogDecisionCount > 0,
        available: roleCan(role, 'viewProgress'),
        onClick: () => setView('catalog-decisions'),
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
        id: 'missing-images',
        icon: <ImageOff className="h-4 w-4" />,
        label: 'Bez zdjęć',
        count: missingImagesCount,
        highlight: missingImagesCount > 0,
        available: roleCan(role, 'viewProgress'),
        onClick: onOpenMissingImages,
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
    commitPrefs({ order: DEFAULT_ORDER, hidden: [] });
    setDraggedId(null);
    setDropTargetId(null);
  }

  function onDropOn(targetId: View) {
    if (!draggedId) return;
    commitPrefs({
      ...normalizedPrefs,
      order: moveItem(normalizedPrefs.order, draggedId, targetId),
    });
    setDraggedId(null);
    setDropTargetId(null);
  }

  return (
    <div
      className="catalog-readable-light fixed bottom-0 left-0 z-30 hidden w-60 flex-col gap-2 overflow-y-auto border-r border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-800/60 dark:bg-slate-950/95 dark:shadow-none lg:flex"
      style={{ top: 'var(--catalog-sticky-top, 0px)' }}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Menu
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
          Chwyć uchwyt i przeciągnij pozycję. Ikona oka ukrywa sekcję z menu.
        </p>
      )}

      <nav className="flex flex-col gap-1" aria-label="Menu katalogu">
        {visibleItems.map((item) => {
          const isHidden = hidden.has(item.id);
          const isDragged = draggedId === item.id;
          const isDropTarget = dropTargetId === item.id && draggedId !== item.id;

          if (!customizing) {
            return (
              <NavTab
                key={item.id}
                layout="sidebar"
                active={view === item.id}
                onClick={item.onClick}
                icon={item.icon}
                label={item.label}
                count={item.count}
                highlight={item.highlight}
              />
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
        })}
      </nav>
    </div>
  );
}
