import { useEffect } from 'react';
import {
  Search,
  Star,
  Printer,
  MoreHorizontal,
  X,
  Layers,
  BarChart3,
  ImageOff,
  Plus,
  Pencil,
  Download,
  Sun,
  Moon,
  Palette,
  Cookie,
  LogOut,
  RefreshCw,
  Loader2,
  ShoppingCart,
  Shield,
  FolderOpen,
  Boxes,
  EyeOff,
  AlertTriangle,
  BookOpen,
  ScrollText,
} from 'lucide-react';
import type { View } from '../types';
import type { AppRole } from '../lib/roles';
import { roleCan } from '../lib/roles';
import { canAccessAdminPanel } from '../lib/adminAccess';
import { canUseCrmModule } from '../app/productAccess';
import { isStockProduct } from '../app/productLayout';
import { DatabaseSyncIcon } from './DatabaseSyncIcon';
import { THEME_LABELS, type ThemeMode } from '../lib/theme';

const THEME_SHEET_ICONS = { light: Sun, dark: Moon, gray: Palette, cookie: Cookie } as const;

interface MobileBottomNavProps {
  view: View;
  onView: (v: View) => void;
  onMore: () => void;
  favoriteCount: number;
  labelCount: number;
  orderCount?: number;
  role: AppRole;
  showCatalog?: boolean;
  showCatalogTools?: boolean;
}

export function MobileBottomNav({
  view,
  onView,
  onMore,
  favoriteCount,
  labelCount,
  orderCount = 0,
  role,
  showCatalog = true,
  showCatalogTools = true,
}: MobileBottomNavProps) {
  const moreActive = ['kits', 'progress', 'catalog-decisions', 'catalog-hidden', 'missing-images', 'admin', 'library', 'logs', ...(isStockProduct() ? ['warehouse' as const] : [])].includes(view);
  return (
    <nav
      className="catalog-readable-light fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-none lg:hidden"
      aria-label="Nawigacja"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {showCatalog && (
          <BottomItem
            active={view === 'catalog'}
            onClick={() => onView('catalog')}
            icon={<Search className="h-5 w-5" />}
            label="Katalog"
          />
        )}
        {canUseCrmModule(role) && (
          <BottomItem
            active={view === 'crm'}
            onClick={() => onView('crm')}
            icon={<ShoppingCart className="h-5 w-5" />}
            label="Zamów."
            badge={orderCount > 0 ? orderCount : undefined}
            hint={orderCount > 0 && view !== 'crm'}
          />
        )}
        {showCatalogTools && roleCan(role, 'manageFavorites') && (
          <BottomItem
            active={view === 'favorites'}
            onClick={() => onView('favorites')}
            icon={<Star className="h-5 w-5" />}
            label="Ulubione"
            badge={favoriteCount > 0 ? favoriteCount : undefined}
          />
        )}
        <BottomItem
          active={moreActive}
          onClick={onMore}
          icon={<MoreHorizontal className="h-5 w-5" />}
          label="Więcej"
          badge={
            roleCan(role, 'printLabels') && labelCount > 0 ? labelCount : undefined
          }
        />
      </div>
    </nav>
  );
}

function BottomItem({
  active,
  onClick,
  icon,
  label,
  badge,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  /** Podświetlenie bez zasłaniania (np. coś w koszyku). */
  hint?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium transition ${
        active
          ? 'text-brand-400'
          : hint
            ? 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/35'
            : 'text-slate-600 dark:text-slate-500'
      }`}
    >
      <span className="relative">
        {icon}
        {badge !== undefined && (
          <span className="absolute -right-2.5 -top-1.5 min-w-[1rem] rounded-full bg-amber-500 px-1 text-[9px] font-bold leading-4 text-amber-950">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  role: AppRole;
  displayLabel: string;
  roleLabel: string;
  view: View;
  editMode: boolean;
  loading: boolean;
  syncBusy?: boolean;
  canRequestStockSync: boolean;
  decisionCount: number;
  missingCount: number;
  hiddenCount: number;
  kitsCount: number;
  collectionsCount?: number;
  showCollections?: boolean;
  onView: (v: View) => void;
  onToggleEdit: () => void;
  onAddProduct: () => void;
  onOpenAdmin: () => void;
  onInstallApp: () => void;
  onToggleTheme: () => void;
  theme: ThemeMode;
  onRefresh: () => void;
  onSyncStock: () => void;
  onSignOut: () => void;
  modeGuest: boolean;
  showCatalogTools?: boolean;
}

export function MobileMoreSheet({
  open,
  onClose,
  role,
  displayLabel,
  roleLabel,
  view,
  editMode,
  loading,
  syncBusy,
  canRequestStockSync,
  decisionCount,
  missingCount,
  hiddenCount,
  kitsCount,
  collectionsCount = 0,
  showCollections = false,
  onView,
  onToggleEdit,
  onAddProduct,
  onOpenAdmin,
  onInstallApp,
  onToggleTheme,
  theme,
  onRefresh,
  onSyncStock,
  onSignOut,
  modeGuest,
  showCatalogTools = true,
}: MobileMoreSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function go(v: View) {
    onView(v);
    onClose();
  }

  return (
    <div className="catalog-readable-light fixed inset-0 z-[60] lg:hidden" role="dialog" aria-label="Menu">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Zamknij"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{displayLabel}</p>
            <p className="text-xs text-slate-600 dark:text-slate-500">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              Widoki
            </p>
            <div className="grid grid-cols-2 gap-2">
              {showCatalogTools && (
                <SheetAction
                  active={view === 'library'}
                  icon={<BookOpen className="h-4 w-4" />}
                  label="Biblioteka"
                  onClick={() => go('library')}
                />
              )}
              {showCatalogTools && (
                <SheetAction
                  active={view === 'logs'}
                  icon={<ScrollText className="h-4 w-4" />}
                  label="Logi sync"
                  onClick={() => go('logs')}
                />
              )}
              {showCatalogTools && showCollections && (
                <SheetAction
                  active={view === 'collections'}
                  icon={<FolderOpen className="h-4 w-4" />}
                  label={`Foldery (${collectionsCount})`}
                  onClick={() => go('collections')}
                />
              )}
              {showCatalogTools && roleCan(role, 'manageFavorites') && (
                <SheetAction
                  active={view === 'favorites'}
                  icon={<Star className="h-4 w-4" />}
                  label="Ulubione"
                  onClick={() => go('favorites')}
                />
              )}
              {showCatalogTools && roleCan(role, 'manageKits') && (
                <SheetAction
                  active={view === 'kits'}
                  icon={<Layers className="h-4 w-4" />}
                  label={`Zestawy (${kitsCount})`}
                  onClick={() => go('kits')}
                />
              )}
              {showCatalogTools && roleCan(role, 'viewProgress') && (
                <SheetAction
                  active={view === 'progress'}
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="Postęp zdjęć"
                  onClick={() => go('progress')}
                />
              )}
              {showCatalogTools && roleCan(role, 'viewProgress') && (
                <SheetAction
                  active={view === 'catalog-decisions'}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  label={`Decyzje (${decisionCount})`}
                  onClick={() => go('catalog-decisions')}
                />
              )}
              {showCatalogTools && roleCan(role, 'viewProgress') && (
                <SheetAction
                  active={view === 'catalog-hidden'}
                  icon={<EyeOff className="h-4 w-4" />}
                  label={`Ukryte (${hiddenCount})`}
                  onClick={() => go('catalog-hidden')}
                />
              )}
              {showCatalogTools && roleCan(role, 'viewProgress') && (
                <SheetAction
                  active={view === 'missing-images'}
                  icon={<ImageOff className="h-4 w-4" />}
                  label={`Bez zdjęć (${missingCount})`}
                  onClick={() => go('missing-images')}
                />
              )}
              {showCatalogTools && roleCan(role, 'printLabels') && (
                <SheetAction
                  active={view === 'labels'}
                  icon={<Printer className="h-4 w-4" />}
                  label="Etykiety"
                  onClick={() => go('labels')}
                />
              )}
              {showCatalogTools &&
                isStockProduct() &&
                (roleCan(role, 'printLabels') || roleCan(role, 'editStock')) && (
                <SheetAction
                  active={view === 'warehouse'}
                  icon={<Boxes className="h-4 w-4" />}
                  label="Magazyn"
                  onClick={() => go('warehouse')}
                />
              )}
              {canAccessAdminPanel(role) && (
                <SheetAction
                  active={view === 'admin'}
                  icon={<Shield className="h-4 w-4" />}
                  label="Panel admin"
                  onClick={() => {
                    onOpenAdmin();
                    onClose();
                  }}
                />
              )}
              {canUseCrmModule(role) && (
                <SheetAction
                  active={view === 'crm'}
                  icon={<ShoppingCart className="h-4 w-4" />}
                  label="Zamówienie"
                  onClick={() => go('crm')}
                />
              )}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              Akcje
            </p>
            <div className="grid grid-cols-2 gap-2">
              {showCatalogTools && roleCan(role, 'addProduct') && (
                <SheetAction
                  icon={<Plus className="h-4 w-4" />}
                  label="Dodaj produkt"
                  onClick={() => {
                    onAddProduct();
                    onClose();
                  }}
                />
              )}
              {showCatalogTools && roleCan(role, 'editStock') && (
                <SheetAction
                  active={editMode}
                  icon={<Pencil className="h-4 w-4" />}
                  label={editMode ? 'Edycja ON' : 'Tryb edycji'}
                  onClick={() => {
                    onToggleEdit();
                    onClose();
                  }}
                />
              )}
              {canAccessAdminPanel(role) && (
                <SheetAction
                  icon={<Shield className="h-4 w-4" />}
                  label="Administracja"
                  onClick={() => {
                    onOpenAdmin();
                    onClose();
                  }}
                />
              )}
              <SheetAction
                icon={<Download className="h-4 w-4" />}
                label="Zainstaluj apkę"
                onClick={() => {
                  onInstallApp();
                  onClose();
                }}
              />
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              System
            </p>
            <div className="grid grid-cols-2 gap-2">
              <SheetAction
                icon={(() => {
                  const ThemeIcon = THEME_SHEET_ICONS[theme];
                  return <ThemeIcon className="h-4 w-4" />;
                })()}
                label={`Motyw: ${THEME_LABELS[theme]}`}
                onClick={onToggleTheme}
              />
              <SheetAction
                icon={
                  loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )
                }
                label="Odśwież katalog"
                onClick={() => {
                  onRefresh();
                  onClose();
                }}
              />
              {canRequestStockSync && (
                <SheetAction
                  icon={
                    syncBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <DatabaseSyncIcon className="h-4 w-4" />
                    )
                  }
                  label="Sync stanów WAPRO"
                  onClick={() => {
                    onSyncStock();
                    onClose();
                  }}
                />
              )}
              <SheetAction
                icon={<LogOut className="h-4 w-4" />}
                label={modeGuest ? 'Logowanie' : 'Wyloguj'}
                onClick={() => {
                  onSignOut();
                  onClose();
                }}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${
        active
          ? 'border-brand-500/50 bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-200'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-200 dark:hover:bg-slate-800'
      }`}
    >
      <span className={`shrink-0 ${active ? 'text-brand-700 dark:text-brand-200' : 'text-slate-500 dark:text-slate-400'}`}>{icon}</span>
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
    </button>
  );
}
