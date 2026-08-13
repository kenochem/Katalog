import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './lib/auth';
import { ToastHost } from './components/ToastHost';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { captureInstallPromptEarly } from './lib/pwaInstall';
import { registerPwaWithAutoUpdate } from './lib/pwaUpdate';
import { APP_PRODUCT } from './app/moduleRegistry';
import { Loader2 } from 'lucide-react';
import './index.css';

captureInstallPromptEarly();
registerPwaWithAutoUpdate();

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
        <PwaUpdateBanner />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
