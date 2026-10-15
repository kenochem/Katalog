import {
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  MousePointerClick,
  Puzzle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '../../lib/auth';
import { roleCan } from '../../lib/roles';
import { LoginGate } from '../../components/LoginGate';
import { AppHeaderActions } from '../../components/AppHeaderActions';
import { AdminHubPanel } from '../../components/AdminHubPanel';
import { canAccessAdminPanel } from '../../lib/adminAccess';
import type { View } from '../../types';

interface Planned {
  icon: ReactNode;
  title: string;
  text: string;
  stage: string;
}

const PLANNED: Planned[] = [
  {
    icon: <Bot className="h-5 w-5" />,
    title: 'Asystent AI na stronie',
    text: 'Doradza klientom w doborze produktów na podstawie naszego katalogu (także parametrów technicznych), zbiera kontakt za zgodą i przekazuje sprawę człowiekowi.',
    stage: 'Etap 2',
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: 'Leady i zgody',
    text: 'Rejestr kontaktów z dowodem zgody (kiedy, jaki tekst, jaki kanał), lista wypisanych i podgląd w CRM.',
    stage: 'Etap 1',
  },
  {
    icon: <Mail className="h-5 w-5" />,
    title: 'Wiadomości i remarketing',
    text: 'Porzucony koszyk, powrót produktu na stan, wiadomość po zakupie — wysyłka przez sprawdzoną usługę e-mail/SMS.',
    stage: 'Etap 3',
  },
  {
    icon: <MousePointerClick className="h-5 w-5" />,
    title: 'Popupy i widżety',
    text: 'Lekkie okna na stronie (zapis do newslettera, rabat, komunikaty) sterowane z jednego miejsca.',
    stage: 'Etap 4',
  },
  {
    icon: <Puzzle className="h-5 w-5" />,
    title: 'Wtyczka do sklepu',
    text: 'Mała wtyczka do WordPressa: osadza widżety i wysyła zdarzenia (koszyk, zamówienie) bez obciążania hostingu.',
    stage: 'Etap 3',
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: 'Analityka',
    text: 'Skuteczność asystenta i kampanii: rozmowy, zebrane kontakty, odzyskane koszyki, koszt na rozmowę.',
    stage: 'Etap 4',
  },
];

const RULES = [
  'Zgody marketingowe osobne dla każdego kanału (e-mail, SMS), niezaznaczone domyślnie, z dowodem i możliwością wycofania.',
  'Asystent zawsze informuje, że to AI, i nie obiecuje cen ani terminów bez sprawdzenia w danych.',
  'Remarketing reklamowy i cookies tylko po zgodzie w banerze.',
  'Każda wiadomość marketingowa ma link do wypisania się; wypisani trafiają na listę, której system nie przekroczy.',
  'Limity kosztów i ochrona przed spamem dla czatu (dzienny budżet, limit rozmów na adres).',
];

/** Kenochem Marketing — szablon aplikacji (w budowie): nawigacja, role i plan etapów. */
export function MarketingProductApp() {
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

  const allowed = roleCan(role, 'manageUsers');

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/95 px-4 py-3 pt-[env(safe-area-inset-top)]">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/icons/marketing-icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">Kenochem Marketing</p>
            <p className="truncate text-[11px] text-slate-500">Asystent AI, leady i remarketing</p>
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
      ) : !allowed ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-400">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-slate-100">Marketing — dostęp ograniczony</h1>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            Aplikacja jest w budowie i na razie dostępna tylko dla administratorów. Wróć do{' '}
            <a href="https://kenochem-f4a5b.web.app" className="text-brand-400 underline">
              Suite
            </a>
            .
          </p>
        </div>
      ) : (
        <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 sm:p-6">
          <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-brand-500/20 via-slate-900/40 to-transparent p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
                  W budowie
                </span>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-50">Kenochem Marketing</h1>
                <p className="mt-2 text-sm text-slate-300 sm:text-base">
                  Własne narzędzia marketingowe Kenochem: asystent AI w sklepie, który zna nasz katalog, rejestr leadów ze zgodami i
                  wiadomości do klientów — wszystko w jednym miejscu, razem z CRM i resztą Suite.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href="https://kenochem-f4a5b.web.app"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Wróć do Suite
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                  <a
                    href="https://kenochem.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Sklep kenochem.com
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <img src="/icons/marketing-icon-512.png" alt="" className="hidden h-32 w-32 rounded-3xl shadow-xl sm:block" />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Planowane moduły</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PLANNED.map((p) => (
                <article key={p.title} className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">{p.icon}</span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{p.stage}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-slate-100">{p.title}</h3>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-400">{p.text}</p>
                  <p className="mt-3 text-[11px] font-medium text-slate-500">Wkrótce</p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <ShieldCheck className="h-4 w-4 text-brand-400" />
              Zasady, które wbudowujemy od początku
            </h2>
            <ul className="mt-3 space-y-2">
              {RULES.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-slate-500">
              To lista robocza, nie porada prawna — przed uruchomieniem publicznym zgody i polityka prywatności wymagają potwierdzenia z prawnikiem.
            </p>
          </section>
        </main>
      )}
    </div>
  );
}
