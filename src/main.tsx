import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { captureInstallPromptEarly } from './lib/pwaInstall';
import './index.css';

captureInstallPromptEarly();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW register failed', err);
    });
  });
}
