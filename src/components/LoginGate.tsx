import { useEffect, useState, type FormEvent } from 'react';
import { Download, Eye, Loader2, LogIn } from 'lucide-react';
import { branding } from '../app/moduleRegistry';
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

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
            Kenochem
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">
            {branding.headerTitle}
          </h1>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">{branding.description}</p>
          <p className="mt-2 text-sm text-slate-400">
            Zaloguj się do pracy albo przeglądaj jako gość (tylko podgląd).
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl"
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Zaloguj
          </button>
        </form>

        <button
          type="button"
          onClick={continueAsGuest}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/50 py-3.5 text-sm font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800"
        >
          <Eye className="h-4 w-4 text-slate-400" />
          Przeglądaj jako gość
        </button>

        {!isStandalone() && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={installBusy}
              onClick={() => void onInstall()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-500/40 bg-brand-500/10 py-3.5 text-sm font-semibold text-brand-200 hover:bg-brand-500/20 disabled:opacity-50"
            >
              {installBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
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

        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          Konta zakłada administrator. Brak publicznej rejestracji.
        </p>
      </div>
    </div>
  );
}
