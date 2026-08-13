import { supabase } from './supabase';
import type { ChatMessage } from './chat';

const META_PREFIX = 'katalog-chat-message-meta:';
export const DELETED_MESSAGE_LABEL = 'Ta wiadomość została usunięta';

export interface ChatMessageMetaEntry {
  deletedAt?: string;
  editedAt?: string;
  body?: string;
}

type MetaStore = Record<string, ChatMessageMetaEntry>;

function readStore(threadId: string): MetaStore {
  try {
    const raw = localStorage.getItem(`${META_PREFIX}${threadId}`);
    return raw ? (JSON.parse(raw) as MetaStore) : {};
  } catch {
    return {};
  }
}

function writeStore(threadId: string, store: MetaStore) {
  try {
    localStorage.setItem(`${META_PREFIX}${threadId}`, JSON.stringify(store));
    window.dispatchEvent(
      new CustomEvent('katalog-chat-message-meta-changed', { detail: { threadId } }),
    );
  } catch {
    /* quota */
  }
}

export function applyChatMessageMeta(messages: ChatMessage[], threadId: string): ChatMessage[] {
  const store = readStore(threadId);
  if (Object.keys(store).length === 0) return messages;

  let changed = false;
  const next = messages.map((m) => {
    const meta = store[m.id];
    if (!meta) return m;
    if (meta.deletedAt) {
      changed = true;
      return { ...m, deletedAt: meta.deletedAt, editedAt: meta.editedAt };
    }
    if (meta.body != null) {
      changed = true;
      return { ...m, body: meta.body, editedAt: meta.editedAt };
    }
    if (meta.editedAt && meta.editedAt !== m.editedAt) {
      changed = true;
      return { ...m, editedAt: meta.editedAt };
    }
    return m;
  });
  return changed ? next : messages;
}

export async function editChatMessage(
  threadId: string,
  messageId: string,
  userId: string,
  newText: string,
): Promise<void> {
  const trimmed = newText.trim();
  if (!trimmed) throw new Error('Pusta wiadomość');

  const store = readStore(threadId);
  const prev = store[messageId] ?? {};
  store[messageId] = {
    ...prev,
    body: trimmed,
    editedAt: new Date().toISOString(),
    deletedAt: undefined,
  };
  writeStore(threadId, store);

  if (supabase) {
    const { error } = await supabase
      .from('chat_messages')
      .update({ body: trimmed })
      .eq('id', messageId)
      .eq('user_id', userId);
    if (error) console.warn('editChatMessage', error.message);
  }
}

export async function deleteChatMessage(
  threadId: string,
  messageId: string,
  userId: string,
): Promise<void> {
  const store = readStore(threadId);
  store[messageId] = {
    ...(store[messageId] ?? {}),
    deletedAt: new Date().toISOString(),
  };
  writeStore(threadId, store);

  if (supabase) {
    const { error } = await supabase
      .from('chat_messages')
      .update({ body: DELETED_MESSAGE_LABEL })
      .eq('id', messageId)
      .eq('user_id', userId);
    if (error) console.warn('deleteChatMessage', error.message);
  }
}

export function subscribeMessageMeta(threadId: string, onChange: () => void): () => void {
  const handler = (e: Event) => {
    const tid = (e as CustomEvent<{ threadId?: string }>).detail?.threadId;
    if (!tid || tid === threadId) onChange();
  };
  window.addEventListener('katalog-chat-message-meta-changed', handler);
  return () => window.removeEventListener('katalog-chat-message-meta-changed', handler);
}

export function isMessageDeleted(m: ChatMessage): boolean {
  return Boolean(m.deletedAt) || m.body === DELETED_MESSAGE_LABEL;
}
