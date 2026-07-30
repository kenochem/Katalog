/**
 * Aktualizacje PWA bez reinstalacji:
 * po deployu nowy sw.js → skipWaiting → przeładowanie jak twarde odświeżenie.
 */
export function registerPwaWithAutoUpdate(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        const check = () => {
          void reg.update().catch(() => undefined);
        };
        check();
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
        window.addEventListener('focus', check);
      })
      .catch((err) => console.warn('SW register failed', err));
  });

  // Tylko przy aktualizacji (nie przy pierwszej instalacji SW)
  let hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}
