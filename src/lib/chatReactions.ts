import { supabase } from './supabase';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '🔥'] as const;

export interface ReactionChip {
  emoji: string;
  count: number;
  userIds: string[];
  reactedByMe: boolean;
}

export type MessageReactionsMap = Record<string, ReactionChip[]>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isChatMessageUuid(messageId: string): boolean {
  return UUID_RE.test(messageId);
}

const LOCAL_PREFIX = 'katalog-chat-reactions:';

type LocalStore = Record<string, Record<string, string[]>>;

function readLocal(threadId: string): LocalStore {
  try {
    const raw = localStorage.getItem(`${LOCAL_PREFIX}${threadId}`);
    return raw ? (JSON.parse(raw) as LocalStore) : {};
  } catch {
    return {};
  }
}

function writeLocal(threadId: string, data: LocalStore) {
  try {
    localStorage.setItem(`${LOCAL_PREFIX}${threadId}`, JSON.stringify(data));
    window.dispatchEvent(
      new CustomEvent('katalog-chat-reactions-changed', { detail: { threadId } }),
    );
  } catch {
    /* quota */
  }
}

function aggregateRows(
  rows: { message_id: string; user_id: string; emoji: string }[],
  myUserId: string,
): MessageReactionsMap {
  const byMessage = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    let emojis = byMessage.get(row.message_id);
    if (!emojis) {
      emojis = new Map();
      byMessage.set(row.message_id, emojis);
    }
    const users = emojis.get(row.emoji) ?? [];
    if (!users.includes(row.user_id)) users.push(row.user_id);
    emojis.set(row.emoji, users);
  }

  const out: MessageReactionsMap = {};
  for (const [messageId, emojis] of byMessage) {
    out[messageId] = [...emojis.entries()]
      .map(([emoji, userIds]) => ({
        emoji,
        count: userIds.length,
        userIds,
        reactedByMe: userIds.includes(myUserId),
      }))
      .sort((a, b) => b.count - a.count);
  }
  return out;
}

function localToRows(store: LocalStore): { message_id: string; user_id: string; emoji: string }[] {
  const rows: { message_id: string; user_id: string; emoji: string }[] = [];
  for (const [messageId, emojis] of Object.entries(store)) {
    for (const [emoji, userIds] of Object.entries(emojis)) {
      for (const userId of userIds) {
        rows.push({ message_id: messageId, user_id: userId, emoji });
      }
    }
  }
  return rows;
}

export async function loadThreadReactions(
  threadId: string,
  messageIds: string[],
  myUserId: string,
): Promise<MessageReactionsMap> {
  if (!messageIds.length) return {};

  const uuidIds = messageIds.filter(isChatMessageUuid);
  const localIds = messageIds.filter((id) => !isChatMessageUuid(id));
  const store = readLocal(threadId);
  const localFiltered = Object.fromEntries(
    Object.entries(store).filter(([id]) => messageIds.includes(id)),
  );
  const localMap = aggregateRows(localToRows(localFiltered), myUserId);

  if (!supabase) {
    return localMap;
  }

  if (!uuidIds.length) {
    return localMap;
  }

  try {
    const { data, error } = await supabase
      .from('chat_message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', uuidIds);

    if (error) {
      if (/relation|schema|does not exist/i.test(error.message)) {
        return localMap;
      }
      console.warn('loadThreadReactions', error.message);
      return localMap;
    }

    const remoteMap = aggregateRows(data ?? [], myUserId);
    for (const id of localIds) {
      if (localMap[id]) remoteMap[id] = localMap[id];
    }
    return remoteMap;
  } catch (e) {
    console.warn('loadThreadReactions', e);
    return localMap;
  }
}

function toggleLocalReaction(
  threadId: string,
  messageId: string,
  myUserId: string,
  emoji: string,
) {
  const store = readLocal(threadId);
  const msg = { ...(store[messageId] ?? {}) };
  let currentEmoji: string | null = null;
  for (const [e, users] of Object.entries(msg)) {
    if (users.includes(myUserId)) currentEmoji = e;
  }
  for (const [e, users] of Object.entries({ ...msg })) {
    const next = users.filter((id) => id !== myUserId);
    if (next.length === 0) delete msg[e];
    else msg[e] = next;
  }
  if (currentEmoji !== emoji) {
    const list = [...(msg[emoji] ?? [])];
    if (!list.includes(myUserId)) list.push(myUserId);
    msg[emoji] = list;
  }
  if (Object.keys(msg).length === 0) delete store[messageId];
  else store[messageId] = msg;
  writeLocal(threadId, store);
}

export async function toggleMessageReaction(
  threadId: string,
  messageId: string,
  myUserId: string,
  emoji: string,
): Promise<void> {
  if (!supabase || !isChatMessageUuid(messageId)) {
    toggleLocalReaction(threadId, messageId, myUserId, emoji);
    return;
  }

  try {
    const { data: existing, error: readErr } = await supabase
      .from('chat_message_reactions')
      .select('emoji')
      .eq('message_id', messageId)
      .eq('user_id', myUserId)
      .maybeSingle();

    if (readErr) {
      if (/relation|schema|does not exist/i.test(readErr.message)) {
        toggleLocalReaction(threadId, messageId, myUserId, emoji);
        return;
      }
      throw readErr;
    }

    if (existing?.emoji === emoji) {
      const { error } = await supabase
        .from('chat_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', myUserId);
      if (error) throw error;
    } else if (existing) {
      const { error } = await supabase
        .from('chat_message_reactions')
        .update({ emoji })
        .eq('message_id', messageId)
        .eq('user_id', myUserId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('chat_message_reactions').insert({
        message_id: messageId,
        user_id: myUserId,
        emoji,
      });
      if (error) throw error;
    }
  } catch (e) {
    console.warn('toggleMessageReaction', e);
    toggleLocalReaction(threadId, messageId, myUserId, emoji);
  }
}

export function subscribeReactions(threadId: string, onChange: () => void): () => void {
  const onLocal = (e: Event) => {
    const tid = (e as CustomEvent<{ threadId?: string }>).detail?.threadId;
    if (!tid || tid === threadId) onChange();
  };
  window.addEventListener('katalog-chat-reactions-changed', onLocal);

  const client = supabase;
  if (!client) {
    return () => window.removeEventListener('katalog-chat-reactions-changed', onLocal);
  }

  try {
    const channel = client
      .channel(`chat-reactions-${threadId.replace(/-/g, '')}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_message_reactions' },
        () => onChange(),
      )
      .subscribe();

    return () => {
      window.removeEventListener('katalog-chat-reactions-changed', onLocal);
      void client.removeChannel(channel);
    };
  } catch (e) {
    console.warn('subscribeReactions', e);
    return () => window.removeEventListener('katalog-chat-reactions-changed', onLocal);
  }
}
