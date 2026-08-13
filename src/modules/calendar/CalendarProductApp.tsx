import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { LoginGate } from '../../components/LoginGate';
import { AppHeaderActions } from '../../components/AppHeaderActions';
import { AdminHubPanel } from '../../components/AdminHubPanel';
import { canAccessAdminPanel } from '../../lib/adminAccess';
import { CalendarKenochemView } from '../../components/hub/CalendarKenochemView';
import type { View } from '../../types';

export function CalendarProductApp() {
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
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/95 px-4 py-3 pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/icons/calendar-icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">Kenochem Kalendarz</p>
            <p className="truncate text-[11px] text-slate-500">Plan firmy i zdarzen</p>
          </div>
        </div>
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
        <CalendarKenochemView standalone />
      )}
    </div>
  );
}
