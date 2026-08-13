const KEY = 'katalog-talk-pinned-threads';

export function loadTalkPinnedThreads(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function saveTalkPinnedThreads(ids: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
    window.dispatchEvent(new CustomEvent('katalog-talk-pinned-threads'));
  } catch {
    /* ignore */
  }
}

export function toggleTalkPinnedThread(id: string): string[] {
  const all = loadTalkPinnedThreads();
  const next = all.includes(id) ? all.filter((x) => x !== id) : [id, ...all];
  saveTalkPinnedThreads(next);
  return next;
}

export function talkDmPinId(peerId: string): string {
  return `dm:${peerId}`;
}
