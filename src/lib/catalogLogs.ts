export type CatalogLogLevel = 'info' | 'success' | 'warning' | 'error';
export type CatalogLogSource = 'sync-wapro' | 'catalog' | 'system';

export interface CatalogLogEntry {
  id: string;
  level: CatalogLogLevel;
  source: CatalogLogSource;
  title: string;
  message: string;
  createdAt: string;
  userId?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
}

const KEY = 'katalog-logs-v1';
const MAX_LOGS = 200;
const EVENT_NAME = 'katalog-logs-changed';

function loadAll(): CatalogLogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CatalogLogEntry[]) : [];
  } catch {
    return [];
  }
}

function saveAll(list: CatalogLogEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_LOGS)));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function listCatalogLogs(userId?: string): CatalogLogEntry[] {
  return loadAll()
    .filter((entry) => !entry.userId || !userId || entry.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addCatalogLog(
  entry: Omit<CatalogLogEntry, 'id' | 'createdAt'> & {
    id?: string;
    createdAt?: string;
  },
) {
  const item: CatalogLogEntry = {
    id: entry.id ?? `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level: entry.level,
    source: entry.source,
    title: entry.title,
    message: entry.message,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    userId: entry.userId,
    details: entry.details,
  };
  const list = loadAll();
  const next = [item, ...list.filter((x) => x.id !== item.id)];
  saveAll(next);
}

export function clearCatalogLogs(userId?: string) {
  if (!userId) {
    saveAll([]);
    return;
  }
  saveAll(loadAll().filter((entry) => entry.userId && entry.userId !== userId));
}

export function subscribeCatalogLogs(fn: () => void): () => void {
  window.addEventListener(EVENT_NAME, fn);
  return () => window.removeEventListener(EVENT_NAME, fn);
}

