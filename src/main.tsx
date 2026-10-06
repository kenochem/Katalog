import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './lib/auth';
import { ToastHost } from './components/ToastHost';
import { DialogHost } from './components/DialogHost';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { captureInstallPromptEarly } from './lib/pwaInstall';
import { registerPwaWithAutoUpdate } from './lib/pwaUpdate';
import { APP_PRODUCT } from './app/moduleRegistry';
import { Loader2 } from 'lucide-react';
import './index.css';

captureInstallPromptEarly();
registerPwaWithAutoUpdate();

/**
 * Jesli karta zostala otwarta przed nowym wdrozeniem, przegladarka moze probowac
 * pobrac stary, juz nieistniejacy plik JS dla widoku otwieranego lazy (np. CRM,
 * ProductDetail). Bez tego uzytkownik widzi "Cos poszlo nie tak" i musi sam
 * kliknac Odswiez. Lapiemy to i odswiezamy raz automatycznie — reszta stron
 * (index.html, chunk hashes) jest wtedy juz aktualna, wiec drugie zaladowanie
 * dziala normalnie. Licznik w sessionStorage chroni przed petla odswiezen,
 * gdyby przyczyna byla inna (np. realny brak sieci).
 */
function isChunkLoadError(reason: unknown): boolean {
  const message = reason instanceof Error ? reason.message : String(reason ?? '');
  // UWAGA: samo "Failed to fetch" NIE moze tu lapac — to ogolny blad kazdego
  // nieudanego fetch() (Supabase, obrazki, sync w tle), nie tylko martwego
  // chunku JS. Dawniej lapal wszystko i restartowal apke np. przy zwyklym
  // zrywie sieci na komorce w trakcie wpisywania w wyszukiwarce — wygladalo
  // to jak "apka sie wywala przy szukaniu", a to byl falszywy alarm.
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    message,
  );
}

function recoverFromStaleChunk(): void {
  const KEY = 'katalog-chunk-reload-at';
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 15_000) return; // juz probowalismy przed chwila — nie zapetlaj
  sessionStorage.setItem(KEY, String(Date.now()));
  window.location.reload();
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  recoverFromStaleChunk();
});

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) recoverFromStaleChunk();
});

const RootApp = lazy(async () => {
  if (APP_PRODUCT === 'talk') {
    const { TalkProductApp } = await import('./modules/comms/TalkProductApp');
    return { default: TalkProductApp };
  }
  if (APP_PRODUCT === 'logistics') {
    const { LogisticsProductApp } = await import(
      './modules/logistics/LogisticsProductApp'
    );
    return { default: LogisticsProductApp };
  }
  if (APP_PRODUCT === 'calendar') {
    const { CalendarProductApp } = await import(
      './modules/calendar/CalendarProductApp'
    );
    return { default: CalendarProductApp };
  }
  if (APP_PRODUCT === 'stock') {
    const { StockProductApp } = await import('./modules/stock/StockProductApp');
    return { default: StockProductApp };
  }
  if (APP_PRODUCT === 'suite') {
    const { SuiteHubApp } = await import('./suite/SuiteHubApp');
    return { default: SuiteHubApp };
  }
  const { default: App } = await import('./App');
  return { default: App };
});

function BootFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950">
      <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<BootFallback />}>
          <RootApp />
        </Suspense>
        <ToastHost />
        <DialogHost />
        <PwaUpdateBanner />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
