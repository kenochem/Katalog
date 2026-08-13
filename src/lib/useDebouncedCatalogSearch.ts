import { useEffect, useState, startTransition } from 'react';

/** Opóźnia wartość do filtrowania ciężkiej listy — pole tekstowe reaguje od razu. */
export function useDebouncedCatalogSearch(search: string, delayMs = 100): string {
  const [debounced, setDebounced] = useState(search);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setDebounced(search);
      return;
    }
    const timer = window.setTimeout(() => {
      startTransition(() => setDebounced(search));
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [search, delayMs]);

  return debounced;
}

export function isCatalogSearchPending(live: string, debounced: string): boolean {
  return live.trim().length >= 2 && live !== debounced;
}
