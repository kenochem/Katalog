import { Truck, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { LoginGate } from '../../components/LoginGate';
import { branding } from '../../app/moduleRegistry';
import { AppHeaderActions } from '../../components/AppHeaderActions';
import { canAccessAdminPanel } from '../../lib/adminAccess';
import { AdminHubPanel } from '../../components/AdminHubPanel';
import type { View } from '../../types';

/** Placeholder — logistyka / dostawy (osobny produkt, rozwój później). */
export function LogisticsProductApp() {
  const { mode, role } = useAuth();
  const [view, setView] = useState<View>('catalog');

  if (mode === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
      </div>
    );
  }

  if (mode === 'gate') {
    return <LoginGate />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950">
      <header className="flex items-center justify-end gap-2 border-b border-slate-800/80 px-4 py-3 pt-[env(safe-area-inset-top)]">
        <AppHeaderActions
          role={role}
          view={view}
          onOpenAdmin={() => setView('admin')}
          onNavigate={setView}
          showAdminShortcut={false}
        />
      </header>
      {view === 'admin' && canAccessAdminPanel(role) ? (
        <div className="flex-1 overflow-y-auto p-4">
          <AdminHubPanel onBack={() => setView('catalog')} />
        </div>
      ) : (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
        <Truck className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold text-slate-100">
        {branding.headerTitle}
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-400">
        Moduł logistyki (trasy, dostawy, okna czasowe) — w przygotowaniu.
        Tymczasem trasy klientów są w{' '}
        <a
          href="https://kenochem-sell.web.app"
          className="text-brand-400 underline"
        >
          Handel (CRM)
        </a>
        .
      </p>
    </div>
      )}
    </div>
  );
}
