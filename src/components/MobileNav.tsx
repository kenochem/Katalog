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
  Sparkles,
  Users,
  Download,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  Loader2,
  ShoppingCart,
  AlertTriangle,
  Shield,
  Calculator,
} from 'lucide-react';
import type { View, CatalogType } from '../types';
import type { AppRole } from '../lib/roles';
import { roleCan } from '../lib/roles';
import { DatabaseSyncIcon } from './DatabaseSyncIcon';

interface MobileBottomNavProps {
  view: View;
  onView: (v: View) => void;
  onMore: () => void;
  favoriteCount: number;
  labelCount: number;
  orderCount?: number;
  role: AppRole;
}

export function MobileBottomNav({
  view,
  onView,
  onMore,
  favoriteCount,
  labelCount,
  orderCount = 0,
  role,
}: MobileBottomNavProps) {
  const moreActive = [
    'kits',
    'progress',
    'missing-images',
    'admin',
    'ean-hygiene',
    'role-matrix',
    'ops',
  ].includes(view);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Nawigacja"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        <BottomItem
          active={view === 'catalog'}
          onClick={() => onView('catalog')}
          icon={<Search className="h-5 w-5" />}
          label="Katalog"
        />
        {roleCan(role, 'useCrm') && (
          <BottomItem
            active={view === 'crm'}
            onClick={() => onView('crm')}
            icon={<ShoppingCart className="h-5 w-5" />}
            label="Zamów."
            badge={orderCount > 0 ? orderCount : undefined}
            hint={orderCount > 0 && view !== 'crm'}
          />
        )}
        {roleCan(role, 'manageFavorites') && (
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
            : 'text-slate-500'
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
  activeCatalog: CatalogType;
  view: View;
  editMode: boolean;
  loading: boolean;
  syncBusy?: boolean;
  canRequestStockSync: boolean;
  missingCount: number;
  kitsCount: number;
  onView: (v: View) => void;
  onToggleEdit: () => void;
  onAddProduct: () => void;
  onLens: () => void;
  onAdminUsers: () => void;
  onRoleMatrix: () => void;
  onInstallApp: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
  onRefresh: () => void;
  onSyncStock: () => void;
  onSignOut: () => void;
  modeGuest: boolean;
}

export function MobileMoreSheet({
  open,
  onClose,
  role,
  displayLabel,
  roleLabel,
  activeCatalog,
  view,
  editMode,
  loading,
  syncBusy,
  canRequestStockSync,
  missingCount,
  kitsCount,
  onView,
  onToggleEdit,
  onAddProduct,
  onLens,
  onAdminUsers,
  onRoleMatrix,
  onInstallApp,
  onToggleTheme,
  isDark,
  onRefresh,
  onSyncStock,
  onSignOut,
  modeGuest,
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
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-label="Menu">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Zamknij"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{displayLabel}</p>
            <p className="text-xs text-slate-500">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Widoki
            </p>
            <div className="grid grid-cols-2 gap-2">
              {roleCan(role, 'viewOps') && (
                <SheetAction
                  active={view === 'ops'}
                  icon={<Calculator className="h-4 w-4" />}
                  label="Operacje"
                  onClick={() => go('ops')}
                />
              )}
              {activeCatalog === 'accessories' && roleCan(role, 'manageKits') && (
                <SheetAction
                  active={view === 'kits'}
                  icon={<Layers className="h-4 w-4" />}
                  label={`Zestawy (${kitsCount})`}
                  onClick={() => go('kits')}
                />
              )}
              {roleCan(role, 'viewProgress') && (
                <SheetAction
                  active={view === 'progress'}
                  icon={<BarChart3 className="h-4 w-4" />}
                  label="Postęp zdjęć"
                  onClick={() => go('progress')}
                />
              )}
              {roleCan(role, 'viewProgress') && (
                <SheetAction
                  active={view === 'missing-images'}
                  icon={<ImageOff className="h-4 w-4" />}
                  label={`Bez zdjęć (${missingCount})`}
                  onClick={() => go('missing-images')}
                />
              )}
              {roleCan(role, 'printLabels') && (
                <SheetAction
                  active={view === 'labels'}
                  icon={<Printer className="h-4 w-4" />}
                  label="Etykiety"
                  onClick={() => go('labels')}
                />
              )}
              {(roleCan(role, 'editProduct') || roleCan(role, 'manageUsers')) && (
                <SheetAction
                  active={view === 'ean-hygiene'}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  label="Higiena EAN"
                  onClick={() => go('ean-hygiene')}
                />
              )}
              {roleCan(role, 'useCrm') && (
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
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Akcje
            </p>
            <div className="grid grid-cols-2 gap-2">
              {roleCan(role, 'addProduct') && (
                <SheetAction
                  icon={<Plus className="h-4 w-4" />}
                  label="Dodaj produkt"
                  onClick={() => {
                    onAddProduct();
                    onClose();
                  }}
                />
              )}
              {roleCan(role, 'editStock') && (
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
              {activeCatalog === 'shop' && roleCan(role, 'useLens') && (
                <SheetAction
                  icon={<Sparkles className="h-4 w-4" />}
                  label="Lens"
                  onClick={() => {
                    onLens();
                    onClose();
                  }}
                />
              )}
              {roleCan(role, 'manageUsers') && (
                <SheetAction
                  icon={<Users className="h-4 w-4" />}
                  label="Konta"
                  onClick={() => {
                    onAdminUsers();
                    onClose();
                  }}
                />
              )}
              {roleCan(role, 'viewRoleMatrix') && (
                <SheetAction
                  icon={<Shield className="h-4 w-4" />}
                  label="Uprawnienia"
                  onClick={() => {
                    onRoleMatrix();
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
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              System
            </p>
            <div className="grid grid-cols-2 gap-2">
              <SheetAction
                icon={isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                label={isDark ? 'Motyw jasny' : 'Motyw ciemny'}
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
          ? 'border-brand-500/50 bg-brand-500/15 text-brand-200'
          : 'border-slate-700 bg-slate-950/50 text-slate-200 hover:bg-slate-800'
      }`}
    >
      <span className="shrink-0 text-slate-400">{icon}</span>
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
    </button>
  );
}
