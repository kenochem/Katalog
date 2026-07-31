/**
 * Aktualizacje PWA bez gwałtownego przeładowania w trakcie pracy.
 * Nowy SW czeka → banner „Odśwież” → dopiero wtedy skipWaiting + reload.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let waitingWorker: ServiceWorker | null = null;
let updateReady = false;
let userAcceptedUpdate = false;

export function onPwaUpdateAvailable(fn: Listener): () => void {
  listeners.add(fn);
  if (updateReady) fn();
  return () => listeners.delete(fn);
}

export function applyPwaUpdate(): void {
  userAcceptedUpdate = true;
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    waitingWorker = null;
  } else {
    window.location.reload();
  }
}

function notifyUpdateAvailable(worker: ServiceWorker | null) {
  waitingWorker = worker;
  updateReady = true;
  listeners.forEach((fn) => fn());
}

function watchRegistration(reg: ServiceWorkerRegistration) {
  const checkWaiting = () => {
    if (reg.waiting && navigator.serviceWorker.controller) {
      notifyUpdateAvailable(reg.waiting);
    }
  };

  checkWaiting();

  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        notifyUpdateAvailable(reg.waiting || installing);
      }
    });
  });

  const softCheck = () => {
    void reg.update().catch(() => undefined);
    checkWaiting();
  };

  // Rzadziej niż na każdy focus — mniej szarpania przy pracy w tle
  softCheck();
  let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    softCheck();
  });
}

export function registerPwaWithAutoUpdate(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then(watchRegistration)
      .catch((err) => console.warn('SW register failed', err));
  });

  let hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    // Reload tylko gdy użytkownik kliknął „Odśwież” — nie w środku pracy
    if (!userAcceptedUpdate || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
