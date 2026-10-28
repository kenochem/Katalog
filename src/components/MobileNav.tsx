import { useEffect, useRef, type ReactNode } from 'react';
import {
  Search,
  Star,
  Menu as MenuIcon,
  X,
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
  Home,
  ScanBarcode,
} from 'lucide-react';

import type { View } from '../types';
import type { AppRole } from '../lib/roles';
import { roleCan } from '../lib/roles';
import { canAccessAdminPanel } from '../lib/adminAccess';
import { canUseCrmModule } from '../app/productAccess';
import { DatabaseSyncIcon } from './DatabaseSyncIcon';
import { THEME_LABELS, type ThemeMode } from '../lib/theme';

const THEME_SHEET_ICONS = { light: Sun, dark: Moon, gray: Palette, cookie: Cookie } as const;

interface MobileBottomNavProps {
  view: View;
  onView: (v: View) => void;
  /** Otwiera menu boczne (szufladę). */
  onMore: () => void;
  /** Skaner kodów kreskowych (środkowy przycisk). */
  onScan?: () => void;
  favoriteCount: number;
  labelCount: number;
  orderCount?: number;
  role: AppRole;
  showHome?: boolean;
  showCatalog?: boolean;
  showCatalogTools?: boolean;
}

/**
 * Dolny pasek aplikacji na telefonie: Start · Katalog · [Skan] · Ulubione/Zamówienie · Menu.
 * „Menu” otwiera boczną szufladę z pełną nawigacją (taką jak panel boczny na komputerze).
 */
export function MobileBottomNav({
  view,
  onView,
  onMore,
  onScan,
  favoriteCount,
  labelCount,
  orderCount = 0,
  role,
  showHome = false,
  showCatalog = true,
  showCatalogTools = true,
}: MobileBottomNavProps) {
  const crm = canUseCrmModule(role);
  const fav = showCatalogTools && roleCan(role, 'manageFavorites');
  const mainViews: View[] = ['home', 'catalog', 'favorites', 'crm'];
  const menuActive = !mainViews.includes(view);

  return (
    <nav
      className="catalog-readable-light fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-none lg:hidden"
      aria-label="Nawigacja"
    >
      <div className="mx-auto flex max-w-lg items-end justify-around px-1 pt-1">
        {showHome && (
          <BottomItem active={view === 'home'} onClick={() => onView('home')} icon={<Home className="h-6 w-6" />} label="Start" />
        )}
        {showCatalog && (
          <BottomItem active={view === 'catalog'} onClick={() => onView('catalog')} icon={<Search className="h-6 w-6" />} label="Katalog" />
        )}
        {showCatalog && onScan && (
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={onScan}
              className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-900/30 ring-4 ring-white transition active:scale-95 dark:ring-slate-950"
              aria-label="Skanuj kod kreskowy"
            >
              <ScanBarcode className="h-7 w-7" />
            </button>
          </div>
        )}
        {crm ? (
          <BottomItem
            active={view === 'crm'}
            onClick={() => onView('crm')}
            icon={<ShoppingCart className="h-6 w-6" />}
            label="Zamów."
            badge={orderCount > 0 ? orderCount : undefined}
            hint={orderCount > 0 && view !== 'crm'}
          />
        ) : (
          fav && (
            <BottomItem
              active={view === 'favorites'}
              onClick={() => onView('favorites')}
              icon={<Star className="h-6 w-6" />}
              label="Ulubione"
              badge={favoriteCount > 0 ? favoriteCount : undefined}
            />
          )
        )}
        <BottomItem
          active={menuActive}
          onClick={onMore}
          icon={<MenuIcon className="h-6 w-6" />}
          label="Menu"
          badge={roleCan(role, 'printLabels') && labelCount > 0 ? labelCount : undefined}
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
  icon: ReactNode;
  label: string;
  badge?: number;
  /** Podświetlenie bez zasłaniania (np. coś w koszyku). */
  hint?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-[3.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
        active
          ? 'text-brand-600 dark:text-brand-400'
          : hint
            ? 'bg-brand-500/15 text-brand-700 ring-1 ring-brand-500/35 dark:text-brand-300'
            : 'text-slate-500 dark:text-slate-500'
      }`}
    >
      <span className="relative">
        {icon}
        {badge !== undefined && (
          <span className="absolute -right-3 -top-1.5 min-w-[1.1rem] rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-[1.1rem] text-amber-950">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="truncate">{label}</span>
      {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand-500" />}
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
  decisionCount?: number;
  missingCount?: number;
  hiddenCount?: number;
  kitsCount?: number;
  collectionsCount?: number;
  showCollections?: boolean;
  newProductsCount?: number;
  /** Nawigacja (te same sekcje co panel boczny na komputerze). */
  navigation?: ReactNode;
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

/** Boczna szuflada menu na telefonie: konto, pełna nawigacja (grupy), akcje i ustawienia. Zamyka się gestem w lewo. */
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
  navigation,
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
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const initials = (displayLabel || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div className="catalog-readable-light fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" className="animate-fade-in absolute inset-0 bg-black/55" aria-label="Zamknij menu" onClick={onClose} />
      <aside
        className="animate-drawer-in absolute inset-y-0 left-0 flex w-[88vw] max-w-sm flex-col bg-white shadow-2xl dark:bg-slate-900"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start != null && end != null && start - end > 70) onClose();
        }}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] dark:border-slate-800 dark:bg-slate-950/60">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-100">{displayLabel}</p>
            <p className="truncate text-xs text-slate-600 dark:text-slate-500">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2.5 text-slate-500 hover:bg-slate-200 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Zamknij menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-3">
          {navigation}

          <section>
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">Akcje</p>
            <div className="grid grid-cols-2 gap-2">
              {canUseCrmModule(role) && (
                <SheetAction
                  active={view === 'crm'}
                  icon={<ShoppingCart className="h-4 w-4" />}
                  label="Zamówienie"
                  onClick={() => {
                    onView('crm');
                    onClose();
                  }}
                />
              )}
              {showCatalogTools && (view === 'catalog' || view === 'favorites') && roleCan(role, 'addProduct') && (
                <SheetAction
                  icon={<Plus className="h-4 w-4" />}
                  label="Dodaj produkt"
                  onClick={() => {
                    onAddProduct();
                    onClose();
                  }}
                />
              )}
              {showCatalogTools && (view === 'catalog' || view === 'favorites') && roleCan(role, 'editStock') && (
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
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">System</p>
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
                icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                label="Odśwież katalog"
                onClick={() => {
                  onRefresh();
                  onClose();
                }}
              />
              {canRequestStockSync && (
                <SheetAction
                  icon={syncBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseSyncIcon className="h-4 w-4" />}
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
          <div className="h-[max(0.5rem,env(safe-area-inset-bottom))]" />
        </div>
      </aside>
    </div>
  );
}

function SheetAction({
  icon,
  label,
  onClick,
  active,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[3rem] items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition active:scale-[0.98] ${
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
