import { useEffect, useState, type FormEvent } from 'react';
import { Eye, Loader2, LogIn, ShieldCheck, Smartphone } from 'lucide-react';
import { APP_PRODUCT, branding } from '../app/moduleRegistry';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  clearDeferredInstall,
  getDeferredInstall,
} from '../lib/pwaInstall';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Boolean((navigator as any).standalone)
  );
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const APP_ICONS: Record<string, string> = {
  catalog: '/icons/app-icon.svg',
  stock: '/icons/stock-app-icon.svg',
  suite: '/icons/suite-app-icon.svg',
  sell: '/icons/sell-app-icon.svg',
  ops: '/icons/ops-app-icon.svg',
  talk: '/icons/talk-app-icon.svg',
  calendar: '/icons/calendar-app-icon.svg',
  logistics: '/icons/app-icon.svg',
};

export function LoginGate() {
  const { signIn, continueAsGuest, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [installHint, setInstallHint] = useState<string | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const sync = () => setCanInstall(Boolean(getDeferredInstall()));
    sync();
    window.__katalogInstallReady = sync;
    return () => {
      if (window.__katalogInstallReady === sync) {
        window.__katalogInstallReady = null;
      }
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setBusy(true);
    try {
      const res = await signIn(email, password);
      if (res.error) setLocalError(res.error);
    } finally {
      setBusy(false);
    }
  }

  async function onInstall() {
    setInstallHint(null);
    const promptEvent = getDeferredInstall();
    if (promptEvent) {
      setInstallBusy(true);
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        clearDeferredInstall();
        setCanInstall(false);
        if (choice.outcome === 'accepted') {
          setInstallHint(`Zainstalowano — otwórz ${branding.headerTitle} z ikony.`);
        }
      } catch {
        setInstallHint('Nie udało się — użyj menu przeglądarki → Zainstaluj.');
      } finally {
        setInstallBusy(false);
      }
      return;
    }
    if (isIos()) {
      setInstallHint('iPhone: Udostępnij → Do ekranu początkowego');
    } else {
      setInstallHint(
        `Chrome / Edge: ikona instalacji w pasku adresu albo menu → Zainstaluj ${branding.headerTitle}`,
      );
    }
  }

  const err = localError || authError;
  const iconSrc = APP_ICONS[APP_PRODUCT] ?? APP_ICONS.catalog;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-10%] h-80 w-80 -translate-x-1/2 rounded-full bg-brand-400/25 blur-3xl dark:bg-brand-500/20" />
        <div className="absolute bottom-[-15%] right-[-10%] h-72 w-72 rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-700/25" />
        <div className="absolute bottom-[-10%] left-[-10%] h-64 w-64 rounded-full bg-brand-200/25 blur-3xl dark:bg-brand-900/30" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <img
            src={iconSrc}
            alt=""
            className="h-16 w-16 rounded-2xl shadow-lg shadow-brand-900/20 dark:shadow-black/50"
          />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.28em] text-brand-600 dark:text-brand-300">
            Kenochem
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-50">
            {branding.headerTitle}
          </h1>
          <p className="mx-auto mt-2.5 max-w-xs text-sm leading-relaxed text-slate-400">
            {branding.description}
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={continueAsGuest}
            className="group flex w-full items-center justify-center gap-2.5 rounded-2xl bg-brand-600 py-4 text-[15px] font-semibold text-white shadow-lg shadow-brand-900/25 transition hover:bg-brand-500 hover:shadow-brand-900/35 dark:shadow-black/40"
          >
            <Eye className="h-5 w-5" />
            Przeglądaj jako gość
          </button>
          <p className="text-center text-xs text-slate-500">
            Podgląd bez logowania — zaraz w środku
          </p>
        </div>

        <div className="mt-7 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-800" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            albo zaloguj się do pracy
          </span>
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-5 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl"
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500"
              placeholder="imie@kenochem.pl"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-400">Hasło</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-brand-500"
            />
          </label>

          {err && (
            <p className="rounded-xl bg-red-600/90 px-3 py-2 text-sm font-medium text-white">
              {err}
            </p>
          )}

          {!isSupabaseConfigured && (
            <p className="rounded-xl bg-amber-500/20 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
              Brak VITE_SUPABASE_* w .env — logowanie niedostępne. Możesz wejść jako
              gość.
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !isSupabaseConfigured}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 py-3 text-sm font-semibold text-slate-100 transition hover:border-brand-500 hover:text-brand-300 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Zaloguj
          </button>
        </form>

        {!isStandalone() && (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              disabled={installBusy}
              onClick={() => void onInstall()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-500/40 bg-brand-500/10 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-500/20 disabled:opacity-50 dark:text-brand-200"
            >
              {installBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Smartphone className="h-4 w-4" />
              )}
              {canInstall ? 'Zainstaluj aplikację' : 'Zainstaluj / dodaj do telefonu'}
            </button>
            {installHint && (
              <p className="text-center text-xs leading-relaxed text-slate-400">
                {installHint}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] leading-relaxed text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 flex-none text-slate-600" />
          Konta zakłada administrator. Brak publicznej rejestracji.
        </div>
      </div>
    </div>
  );
}
