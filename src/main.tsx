import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ToastHost } from './components/ToastHost';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PwaUpdateBanner } from './components/PwaUpdateBanner';
import { captureInstallPromptEarly } from './lib/pwaInstall';
import { registerPwaWithAutoUpdate } from './lib/pwaUpdate';
import './index.css';

captureInstallPromptEarly();
registerPwaWithAutoUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
        <ToastHost />
        <PwaUpdateBanner />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
