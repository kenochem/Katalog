import { Loader2, Settings2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { LoginGate } from '../../components/LoginGate';
import { AppHeaderActions } from '../../components/AppHeaderActions';
import { canAccessAdminPanel } from '../../lib/adminAccess';
import { useEffect, useState, type CSSProperties } from 'react';
import type { View } from '../../types';
import { AdminHubPanel } from '../../components/AdminHubPanel';
import { TalkChatPage } from '../../components/chat/TalkChatPage';
import { TalkChatAppearancePanel } from '../../components/chat/TalkChatAppearancePanel';
import { TalkPushOptInBanner } from '../../components/chat/TalkPushOptInBanner';
import { syncTalkPushSubscription } from '../../lib/push/talkPushSync';
import { useTheme } from '../../lib/theme';
import { InstallAppHint } from '../../components/InstallAppHint';
import { roleCan } from '../../lib/roles';
import { ContextHelp } from '../../components/ContextHelp';

/** Produkt Talk — komunikator (Messenger-like), ten sam pasek co katalog. */
export function TalkProductApp() {
  const { mode, role, user } = useAuth();
  const [view, setView] = useState<View>('catalog');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useTheme();

  useEffect(() => {
    if (mode === 'signed_in' && user?.id) {
      void syncTalkPushSubscription(user.id);
    }
  }, [mode, user?.id]);

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;

    const syncViewport = () => {
      const height = Math.round(viewport?.height ?? window.innerHeight);
      root.style.setProperty('--talk-visual-height', `${height}px`);
      const keyboardOffset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      root.classList.toggle('talk-keyboard-open', keyboardOffset > 80);
    };

    syncViewport();
    viewport?.addEventListener('resize', syncViewport);
    viewport?.addEventListener('scroll', syncViewport);
    window.addEventListener('resize', syncViewport);
    return () => {
      viewport?.removeEventListener('resize', syncViewport);
      viewport?.removeEventListener('scroll', syncViewport);
      window.removeEventListener('resize', syncViewport);
      root.style.removeProperty('--talk-visual-height');
      root.classList.remove('talk-keyboard-open');
    };
  }, []);

  if (mode === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (mode === 'gate') {
    return <LoginGate />;
  }

  const inChat = view !== 'admin';
  const canAdmin = canAccessAdminPanel(role);
  const canUseTalk = roleCan(role, 'useTalk') || canAdmin;

  return (
    <div
      className="app-shell talk-app-shell flex h-dvh min-h-dvh flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
      style={{ height: 'var(--talk-visual-height, 100dvh)' } as CSSProperties}
    >
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:border-slate-800/80 dark:bg-slate-950/95">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4 xl:px-6">
          <img
            src="/talk-logo.svg?v=3"
            alt="Kenochem Talk"
            className="talk-app-logo shrink-0 dark:hidden"
          />
          <img
            src="/talk-logo-dark.svg?v=3"
            alt="Kenochem Talk"
            className="talk-app-logo hidden shrink-0 dark:block"
          />
          <ContextHelp id="talk" />

          <div className="min-w-0 flex-1" aria-hidden />

          {canAdmin ? (
            <button
              type="button"
              onClick={() => setView('admin')}
              className={`hub-header-btn hub-header-btn--text inline-flex ${
                view === 'admin' ? 'hub-header-btn--admin-active' : 'hub-header-btn--admin'
              }`}
              title="Panel administracyjny Talk"
            >
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          ) : null}

          <AppHeaderActions
            role={role}
            view={view}
            onOpenAdmin={() => setView('admin')}
            onNavigate={setView}
            showAdminShortcut={false}
            showSignOut
            onOpenChatSettings={inChat ? () => setSettingsOpen(true) : undefined}
          />
        </div>
      </header>

      {settingsOpen && inChat ? (
        <div className="fixed inset-0 z-50 flex justify-center bg-slate-950/25 pt-[env(safe-area-inset-top)] backdrop-blur-sm md:items-start md:p-6">
          <div className="h-full w-full overflow-hidden bg-white shadow-2xl dark:bg-slate-950 md:h-[min(92dvh,860px)] md:max-w-3xl md:rounded-2xl md:border md:border-slate-200 md:dark:border-slate-800">
            <TalkChatAppearancePanel
              userId={user?.id}
              onClose={() => setSettingsOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {view === 'admin' && canAdmin ? (
        <div className="relative min-h-0 flex-1 overflow-y-auto p-4">
          <AdminHubPanel
            onBack={() => setView('catalog')}
            backLabel="Wróć do czatu"
            title="Administracja Talk"
            description="Użytkownicy, role i uprawnienia dostępu do czatu Kenochem."
          />
        </div>
      ) : !canUseTalk ? (
        <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
          <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Brak dostępu do Talk
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Poproś administratora o włączenie uprawnienia „Talk / czat” dla Twojej roli.
            </p>
          </div>
        </main>
      ) : (
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <TalkChatPage variant="page" messengerLayout />
          {user?.id ? <TalkPushOptInBanner userId={user.id} /> : null}
        </main>
      )}

      <InstallAppHint />
    </div>
  );
}
