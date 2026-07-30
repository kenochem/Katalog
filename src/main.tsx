import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ToastHost } from './components/ToastHost';
import { captureInstallPromptEarly } from './lib/pwaInstall';
import { registerPwaWithAutoUpdate } from './lib/pwaUpdate';
import './index.css';

captureInstallPromptEarly();
registerPwaWithAutoUpdate();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <ToastHost />
    </AuthProvider>
  </StrictMode>,
);
