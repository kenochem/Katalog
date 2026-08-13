import { createContext, useCallback, useContext, type ReactNode, useMemo, useState, useEffect } from 'react';
import type { HubView } from '../app/hubNavigation';

interface SuiteHubContextValue {
  hubView: HubView;
  setHubView: (v: HubView) => void;
  previousHubView: HubView | null;
  goBack: () => void;
  canGoBack: boolean;
  embedded: boolean;
}

const SuiteHubContext = createContext<SuiteHubContextValue | null>(null);

export function SuiteHubProvider({
  children,
  initialView = 'workspace',
}: {
  children: ReactNode;
  initialView?: HubView;
}) {
  const [hubView, setHubView] = useState<HubView>(initialView);
  const [history, setHistory] = useState<HubView[]>([]);

  const navigateHubView = useCallback((next: HubView) => {
    setHubView((current) => {
      if (current === next) return current;
      setHistory((prev) => [current, ...prev.filter((item) => item !== current)].slice(0, 8));
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setHistory((prev) => {
      const [target, ...rest] = prev;
      if (!target) return prev;
      setHubView(target);
      return rest;
    });
  }, []);

  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<{ view: HubView }>).detail;
      if (detail?.view) navigateHubView(detail.view);
    };
    window.addEventListener('katalog-hub-navigate', onNav);
    return () => window.removeEventListener('katalog-hub-navigate', onNav);
  }, [navigateHubView]);
  const value = useMemo(
    () => ({
      hubView,
      setHubView: navigateHubView,
      previousHubView: history[0] ?? null,
      goBack,
      canGoBack: history.length > 0,
      embedded: true,
    }),
    [goBack, history, hubView, navigateHubView],
  );
  return (
    <SuiteHubContext.Provider value={value}>{children}</SuiteHubContext.Provider>
  );
}

export function useSuiteHub() {
  return useContext(SuiteHubContext);
}
