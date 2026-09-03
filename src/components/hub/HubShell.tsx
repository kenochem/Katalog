import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Search, MessageCircle, LogOut } from 'lucide-react';
import type { HubView } from '../../app/hubNavigation';
import { branding } from '../../app/moduleRegistry';
import { RefreshControls } from '../RefreshControls';
import { AppHeaderActions } from '../AppHeaderActions';
import { buildKenochemHubNavItems } from './HubPrimaryNav';
import { HubSidebar, useHubSidebarPrefs } from './HubSidebar';
import type { View } from '../../types';
import type { AppRole } from '../../lib/roles';
import type { StockSyncScope } from '../../lib/stockSync';
import { CRM_INBOX_ENABLED } from '../../lib/crmInboxFeature';
import { HubCommandSearch, useHubCommandPaletteHotkey } from './HubCommandSearch';
import { SuiteHubMobileNav } from './SuiteHubMobileNav';
import { HubChatDrawer } from './HubChatDrawer';
import { openGlobalAdminPanel } from '../../lib/adminNavigation';
import { openHubChat } from '../../lib/hubChatEvents';

export interface HubShellProps {
  view: HubView;
  onViewChange: (v: HubView) => void;
  children: ReactNode;
  /** Segment poza App (workspace, magazyn, …) */
  overlay?: ReactNode;
  signedIn: boolean;
  effectiveRole: AppRole;
  appView: View;
  onAppNavigate: (v: View) => void;
  onSignOut: () => void;
  favoriteCount: number;
  productCount: number;
  orderCount: number;
  catalogLoading: boolean;
  onRefreshCatalog: () => void;
  stockSyncScope?: StockSyncScope;
  canEditStock: boolean;
  canUseCrm: boolean;
  canViewOps: boolean;
  canAdmin: boolean;
  showCatalog: boolean;
  showComms: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
  mobileMoreOpen: boolean;
  onMobileMoreOpen: (open: boolean) => void;
  userId: string;
  canGoBack?: boolean;
  backLabel?: string;
  onBack?: () => void;
}

export function HubShell({
  view,
  onViewChange,
  children,
  overlay,
  signedIn,
  effectiveRole,
  appView,
  onAppNavigate,
  onSignOut,
  favoriteCount,
  productCount,
  orderCount,
  catalogLoading,
  onRefreshCatalog,
  stockSyncScope = 'all',
  canEditStock,
  canUseCrm,
  canViewOps,
  canAdmin,
  showCatalog,
  showComms,
  editMode: _editMode,
  onToggleEdit: _onToggleEdit,
  mobileMoreOpen: _mobileMoreOpen,
  onMobileMoreOpen: _onMobileMoreOpen,
  userId,
  canGoBack = false,
  backLabel,
  onBack,
}: HubShellProps) {
  const { prefs, setPrefs } = useHubSidebarPrefs(userId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(prefs.sidebarCollapsed);
  const [commandOpen, setCommandOpen] = useState(false);
  useHubCommandPaletteHotkey(() => setCommandOpen(true));

  useEffect(() => {
    setSidebarCollapsed(prefs.sidebarCollapsed);
  }, [prefs.sidebarCollapsed]);

  const navItems = useMemo(
    () =>
      buildKenochemHubNavItems({
        showCatalog,
        showWarehouse: showCatalog,
        showLogistics: false,
        showCrm: canUseCrm,
        showOrders: canUseCrm,
        showFinance: canViewOps,
        showOps: canViewOps,
        showComms,
        showInbox: CRM_INBOX_ENABLED,
        showIntegrations: canViewOps,
        showAdmin: canAdmin,
        showDepartments: false,
        showDownloads: true,
        showGuide: true,
        showCalendar: true,
        showAssist: false,
      }),
    [showCatalog, canUseCrm, canViewOps, canAdmin],
  );

  const toggleSidebar = () => {
    const next = { ...prefs, sidebarCollapsed: !sidebarCollapsed };
    setPrefs(next);
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="hub-shell flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/95 pt-[env(safe-area-inset-top)] supports-[backdrop-filter]:backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4 xl:px-5">
          <a
            href="https://kenochem.com"
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center"
            title="Kenochem.com"
          >
            <img src="/kenochem-logo.webp" alt="Kenochem" className="kenochem-logo" />
          </a>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-bold text-slate-100">{branding.headerTitle}</p>
            <p className="truncate text-[11px] text-slate-500">
              {productCount > 0 ? `${productCount} SKU` : 'Hub'}
              {favoriteCount > 0 ? ` · ${favoriteCount} ulub.` : ''}
              {orderCount > 0 ? ` · koszyk ${orderCount}` : ''}
            </p>
          </div>
          <div className="min-w-0 flex-1" />
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
            {canGoBack && onBack && (
              <button
                type="button"
                onClick={onBack}
                className="hub-header-btn hub-header-btn--text hub-header-btn--ghost inline-flex text-slate-400 hover:text-slate-100"
                title={backLabel ?? 'Wroc'}
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">{backLabel ?? 'Wroc'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="hub-header-btn hub-header-btn--text hidden text-slate-400 hover:text-slate-100 sm:inline-flex"
              title="Szybkie przejście (Ctrl+K)"
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">Szukaj</span>
            </button>
            {showComms && signedIn && (
              <button
                type="button"
                onClick={() => openHubChat()}
                className="hub-header-btn hub-header-btn--icon inline-flex text-slate-400 hover:text-slate-100"
                title="Talk — czat"
                aria-label="Otwórz czat"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            )}
            {canEditStock && view !== 'admin' && (
              <RefreshControls
                loading={catalogLoading}
                onRefresh={onRefreshCatalog}
                catalog={stockSyncScope}
                canRequestStockSync={signedIn && canEditStock}
              />
            )}
            <AppHeaderActions
              role={effectiveRole}
              view={appView}
              onOpenAdmin={openGlobalAdminPanel}
              onNavigate={onAppNavigate}
              showSignOut={false}
            />
            <button
              type="button"
              onClick={onSignOut}
              className="hub-header-btn hub-header-btn--text hub-header-btn--ghost hidden lg:inline-flex"
              title="Wyloguj"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden xl:inline">Wyloguj</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <HubSidebar
          view={view}
          onViewChange={onViewChange}
          items={navItems}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
          userId={userId}
          prefs={prefs}
          onPrefsChange={setPrefs}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {overlay}
          <div className={overlay ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}>{children}</div>
        </div>
      </div>
      <HubCommandSearch
        open={commandOpen}
        onOpenChange={setCommandOpen}
        canCrm={canUseCrm}
        canOps={canViewOps}
        canAdmin={canAdmin}
      />
      <SuiteHubMobileNav
        view={view}
        onViewChange={onViewChange}
        showCrm={canUseCrm}
        showOps={canViewOps}
      />
      {showComms && signedIn && <HubChatDrawer />}
    </div>
  );
}

export function hubViewSectionLabel(view: HubView): string {
  const map: Partial<Record<HubView, string>> = {
    workspace: 'Pulpit',
    catalog: 'Produkty',
    warehouse: 'Magazyn',
    logistics: 'Magazyn',
    calendar: 'Kalendarz',
    crm: 'CRM',
    ops: 'Operacje',
    comms: 'Czat',
    admin: 'Admin',
  };
  return map[view] ?? 'Suite';
}
