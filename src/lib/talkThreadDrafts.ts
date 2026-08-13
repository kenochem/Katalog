const DRAFT_PREFIX = 'katalog-talk-thread-draft:';
const DM_THREAD_PREFIX = 'katalog-talk-dm-thread:';
const MAX_DRAFT_LENGTH = 4000;

function draftKey(threadId: string): string {
  return `${DRAFT_PREFIX}${threadId}`;
}

function dmThreadKey(peerId: string): string {
  return `${DM_THREAD_PREFIX}${peerId}`;
}

export function loadTalkThreadDraft(threadId: string | null | undefined): string {
  if (!threadId) return '';
  try {
    return localStorage.getItem(draftKey(threadId)) ?? '';
  } catch {
    return '';
  }
}

export function saveTalkThreadDraft(threadId: string | null | undefined, value: string) {
  if (!threadId) return;
  const next = value.slice(0, MAX_DRAFT_LENGTH);
  try {
    if (next.trim()) localStorage.setItem(draftKey(threadId), next);
    else localStorage.removeItem(draftKey(threadId));
  } catch {
    /* ignore */
  }
}

export function clearTalkThreadDraft(threadId: string | null | undefined) {
  if (!threadId) return;
  try {
    localStorage.removeItem(draftKey(threadId));
  } catch {
    /* ignore */
  }
}

export function saveTalkDmThreadId(peerId: string | null | undefined, threadId: string | null | undefined) {
  if (!peerId || !threadId) return;
  try {
    localStorage.setItem(dmThreadKey(peerId), threadId);
  } catch {
    /* ignore */
  }
}

export function loadTalkDmThreadId(peerId: string | null | undefined): string | null {
  if (!peerId) return null;
  try {
    return localStorage.getItem(dmThreadKey(peerId));
  } catch {
    return null;
  }
}

export function talkDraftPreview(threadId: string | null | undefined, max = 52): string {
  const text = loadTalkThreadDraft(threadId).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max - 1)}...`;
}
