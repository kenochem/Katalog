import { useEffect, useState } from 'react';
import { Download, MoreVertical, Share, X } from 'lucide-react';
import {
  clearDeferredInstall,
  getDeferredInstall,
  type DeferredInstallPrompt,
} from '../lib/pwaInstall';

const DISMISS_KEY = 'katalog-pwa-hint-dismissed';

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

function isSamsungBrowser(): boolean {
  return /SamsungBrowser/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isDesktop(): boolean {
  return !isIos() && !isAndroid() && !/Mobile/i.test(navigator.userAgent);
}

/**
 * Banner: dodaj Katalog do ekranu głównego.
 * Przycisk „Zainstaluj” tylko gdy przeglądarka naprawdę umie pokazać prompt;
 * w przeciwnym razie jasna instrukcja ręczna (Samsung / iOS).
 */
export function InstallAppHint() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<DeferredInstallPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isStandalone()) return;

    const sync = () => {
      const d = getDeferredInstall();
      if (d) setDeferred(d);
    };
    sync();
    window.__katalogInstallReady = sync;

    const show = () => {
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
      sync();
      setVisible(true);
      setErr(null);
    };

    window.addEventListener('katalog-show-install', show);

    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') {
        return () => {
          window.removeEventListener('katalog-show-install', show);
          if (window.__katalogInstallReady === sync) {
            window.__katalogInstallReady = null;
          }
        };
      }
    } catch {
      /* ignore */
    }

    const t = window.setTimeout(() => {
      if (!isStandalone()) setVisible(true);
    }, 900);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('katalog-show-install', show);
      if (window.__katalogInstallReady === sync) {
        window.__katalogInstallReady = null;
      }
    };
  }, []);

  if (!visible || isStandalone()) return null;

  async function install() {
    const promptEvent = deferred || getDeferredInstall();
    if (!promptEvent) {
      setErr('Ta przeglądarka nie pokazuje przycisku — użyj menu poniżej.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      clearDeferredInstall();
      setDeferred(null);
      if (choice.outcome === 'accepted') dismiss();
    } catch {
      setErr('Nie udało się otworzyć instalatora. Użyj menu przeglądarki.');
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  const canPrompt = Boolean(deferred || getDeferredInstall());

  return (
    <div
      className="pointer-events-auto fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-[80] mx-auto max-w-lg rounded-2xl border border-brand-500/50 bg-slate-950 p-3.5 shadow-2xl shadow-black/50 ring-1 ring-white/10 sm:left-auto sm:right-4"
      role="dialog"
      aria-label="Zainstaluj aplikację"
    >
      <div className="flex items-start gap-3">
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl shadow-md"
          width={48}
          height={48}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-bold text-white">
              {isDesktop() ? 'Katalog na komputer' : 'Katalog na telefon'}
            </p>
            <button
              type="button"
              onClick={dismiss}
              className="relative z-[1] -mr-1 -mt-1 shrink-0 rounded-full p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
              aria-label="Zamknij"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-1 text-sm leading-snug text-slate-200">
            {isIos() ? (
              <>
                Safari → <Share className="inline h-4 w-4 text-brand-300" />{' '}
                <strong className="text-white">Udostępnij</strong> →{' '}
                <strong className="text-white">Do ekranu początkowego</strong>
              </>
            ) : isSamsungBrowser() && !canPrompt ? (
              <>
                Menu <MoreVertical className="inline h-4 w-4 text-brand-300" /> →{' '}
                <strong className="text-white">Dodaj stronę do</strong> →{' '}
                <strong className="text-white">Ekran główny</strong>
              </>
            ) : isDesktop() && !canPrompt ? (
              <>
                Chrome / Edge: ikona <strong className="text-white">instalacji</strong> w
                pasku adresu (albo menu → <strong className="text-white">Zainstaluj Katalog</strong>
                ). Powstanie ikona na pulpicie / w menu Start.
              </>
            ) : canPrompt ? (
              <>
                {isDesktop()
                  ? 'Zainstaluj jak zwykłą aplikację — ikona na pulpicie, bez paska przeglądarki.'
                  : 'Jednym kliknięciem dodasz ikonę jak zwykłą aplikację.'}
              </>
            ) : (
              <>
                Menu przeglądarki <MoreVertical className="inline h-4 w-4 text-brand-300" /> →{' '}
                <strong className="text-white">Zainstaluj aplikację</strong> /{' '}
                <strong className="text-white">Dodaj do ekranu głównego</strong>
              </>
            )}
          </p>

          {err && (
            <p className="mt-2 rounded-lg bg-red-600 px-2.5 py-2 text-sm font-semibold text-white">
              {err}
            </p>
          )}

          {canPrompt && !isIos() && (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void install();
              }}
              className="relative z-[1] mt-3 flex w-full min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 text-sm font-bold text-white active:bg-brand-600 disabled:opacity-60"
            >
              <Download className="h-5 w-5" />
              {busy ? 'Otwieram…' : 'Zainstaluj'}
            </button>
          )}

          {!canPrompt && isAndroid() && !isIos() && (
            <p className="mt-2 text-xs text-slate-400">
              Jeśli nie widzisz opcji: otwórz stronę w <strong className="text-slate-200">Chrome</strong>{' '}
              — tam instalacja działa najczęściej.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Pozwala ponownie pokazać banner (np. z menu). */
export function resetInstallHint(): void {
  try {
    localStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}
