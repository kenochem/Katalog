const KEY = 'katalog-talk-last-thread';

export type TalkLastThread =
  | { kind: 'general' }
  | { kind: 'dm'; peerId: string };

export function saveTalkLastThread(value: TalkLastThread): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function loadTalkLastThread(): TalkLastThread | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as TalkLastThread;
    if (v?.kind === 'general') return { kind: 'general' };
    if (v?.kind === 'dm' && typeof v.peerId === 'string') return v;
  } catch {
    /* ignore */
  }
  return null;
}
