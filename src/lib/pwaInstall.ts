/** Wczesne złapanie beforeinstallprompt — zanim React się zamontuje. */
export type DeferredInstallPrompt = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

declare global {
  interface Window {
    __katalogDeferredInstall?: DeferredInstallPrompt | null;
    __katalogInstallReady?: (() => void) | null;
  }
}

export function captureInstallPromptEarly(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__katalogDeferredInstall = e as unknown as DeferredInstallPrompt;
    window.__katalogInstallReady?.();
  });
}

export function getDeferredInstall(): DeferredInstallPrompt | null {
  return window.__katalogDeferredInstall ?? null;
}

export function clearDeferredInstall(): void {
  window.__katalogDeferredInstall = null;
}
