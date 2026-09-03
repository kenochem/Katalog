import { LogOut, Settings2 } from 'lucide-react';
import type { View } from '../types';
import { canAccessAdminPanel } from '../lib/adminAccess';
import { roleCan, type AppRole } from '../lib/roles';
import { useAuth } from '../lib/auth';
import { AppNotificationCenter } from './AppNotificationCenter';
import { AppProfileMenu } from './AppProfileMenu';
import { ThemeSwitcher } from './ThemeSwitcher';
import { APP_PRODUCT } from '../app/moduleRegistry';

interface AppHeaderActionsProps {
  role: AppRole;
  view: View;
  onOpenAdmin: () => void;
  onNavigate: (view: View) => void;
  /** Desktop: violet Admin shortcut obok profilu */
  showAdminShortcut?: boolean;
  /** Osobny „Wyloguj” w HubShell — w katalogu domyślnie włączony */
  showSignOut?: boolean;
  /** Talk: ustawienia czatu z menu profilu */
  onOpenChatSettings?: () => void;
}

export function AppHeaderActions({
  role,
  view,
  onOpenAdmin,
  onNavigate,
  showAdminShortcut = true,
  showSignOut = true,
  onOpenChatSettings,
}: AppHeaderActionsProps) {
  const canAdmin = canAccessAdminPanel(role);
  const { mode, signOut, exitGuest } = useAuth();
  const adminActive = view === 'admin';
  const notificationScope =
    APP_PRODUCT === 'suite'
      ? 'all'
      : view === 'ops' || APP_PRODUCT === 'ops'
      ? 'ops'
      : view === 'crm'
        ? 'crm'
        : APP_PRODUCT === 'talk'
          ? 'talk'
          : APP_PRODUCT === 'calendar'
            ? 'calendar'
            : 'catalog';
  const notificationSubtitle =
    notificationScope === 'all'
      ? 'Wszystkie aplikacje konta'
      : notificationScope === 'ops'
      ? 'Finanse, dane, raporty'
      : notificationScope === 'crm'
        ? 'CRM, klienci, sprzedaz'
        : notificationScope === 'talk'
          ? 'Czat i zespol'
          : notificationScope === 'calendar'
            ? 'Plan, wizyty, wydarzenia'
            : APP_PRODUCT === 'stock'
              ? 'Magazyn, stany, etykiety'
          : 'Stany, zdjecia, system';

  function handleSignOut() {
    if (mode === 'guest') exitGuest();
    else void signOut();
  }

  return (
    <div className="hub-header-actions flex shrink-0 items-center gap-1.5 sm:gap-2">
      <ThemeSwitcher />
      {showAdminShortcut && canAdmin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className={`hub-header-btn hub-header-btn--text inline-flex ${
            adminActive ? 'hub-header-btn--admin-active' : 'hub-header-btn--admin'
          }`}
          title="Panel administracyjny — konta i uprawnienia"
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Admin</span>
        </button>
      )}
      <AppNotificationCenter
        onNavigate={onNavigate}
        scope={notificationScope}
        subtitle={notificationSubtitle}
      />
      <AppProfileMenu
        onOpenAdmin={onOpenAdmin}
        adminActive={adminActive}
        onOpenChatSettings={onOpenChatSettings}
      />
      {showSignOut && mode !== 'gate' && (
        <button
          type="button"
          onClick={handleSignOut}
          className="hub-header-btn hub-header-btn--text hub-header-btn--ghost hidden lg:inline-flex"
          title={mode === 'guest' ? 'Logowanie' : 'Wyloguj'}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="hidden xl:inline">{mode === 'guest' ? 'Logowanie' : 'Wyloguj'}</span>
        </button>
      )}
    </div>
  );
}

/** Czy pokazać skrót admin w mobile sheet zamiast osobnych Konta/Uprawnienia. */
export function canOpenAdminPanel(role: AppRole): boolean {
  return canAccessAdminPanel(role);
}

export function canManageUsersOnly(role: AppRole): boolean {
  return roleCan(role, 'manageUsers');
}
