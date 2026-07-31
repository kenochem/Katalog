import { supabase } from './supabase';

export const GENERAL_THREAD_ID = '00000000-0000-0000-0000-0000000000c1';

export interface ChatPeer {
  id: string;
  displayName: string;
  email: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  userId: string;
  body: string;
  createdAt: string;
  authorName: string;
}

function mapMessage(
  row: {
    id: string;
    thread_id: string;
    user_id: string;
    body: string;
    created_at: string;
  },
  names: Map<string, string>
): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    authorName: names.get(row.user_id) ?? 'Użytkownik',
  };
}

export async function listChatPeers(): Promise<ChatPeer[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('list_chat_peers');
  if (error) throw error;
  return (data ?? []).map(
    (r: { id: string; display_name: string; email: string }) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
    })
  );
}

export async function getOrCreateDm(otherUserId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase niedostępne');
  const { data, error } = await supabase.rpc('get_or_create_dm', {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function markThreadRead(threadId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.rpc('mark_chat_thread_read', {
    p_thread_id: threadId,
  });
  if (error) console.warn('mark_chat_thread_read', error);
}

async function loadAuthorNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!supabase || userIds.length === 0) return names;

  const unique = [...new Set(userIds)];
  // profiles: własny + admin; peery przez RPC
  const { data: own } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', unique);

  for (const row of own ?? []) {
    names.set(row.id, row.display_name);
  }

  const missing = unique.filter((id) => !names.has(id));
  if (missing.length > 0) {
    try {
      const peers = await listChatPeers();
      for (const p of peers) {
        if (missing.includes(p.id)) names.set(p.id, p.displayName);
      }
    } catch {
      /* ignore */
    }
  }
  return names;
}

export async function fetchMessages(
  threadId: string,
  limit = 80
): Promise<ChatMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, thread_id, user_id, body, created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = (data ?? []).reverse();
  const names = await loadAuthorNames(rows.map((r) => r.user_id));
  return rows.map((r) => mapMessage(r, names));
}

export async function sendMessage(
  threadId: string,
  userId: string,
  body: string
): Promise<ChatMessage> {
  if (!supabase) throw new Error('Supabase niedostępne');
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Pusta wiadomość');
  if (trimmed.length > 2000) throw new Error('Za długa wiadomość');

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      user_id: userId,
      body: trimmed,
    })
    .select('id, thread_id, user_id, body, created_at')
    .single();
  if (error) throw error;
  const names = await loadAuthorNames([data.user_id]);
  return mapMessage(data, names);
}

export type ChatRealtimeHandler = (msg: ChatMessage) => void;

/** Subskrypcja nowych wiadomości w wątku. Zwraca unsubscribe. */
export function subscribeThread(
  threadId: string,
  onInsert: ChatRealtimeHandler,
  nameCache?: Map<string, string>
): () => void {
  const client = supabase;
  if (!client) return () => undefined;

  const channel = client
    .channel(`chat:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      async (payload) => {
        const row = payload.new as {
          id: string;
          thread_id: string;
          user_id: string;
          body: string;
          created_at: string;
        };
        const names = nameCache ?? new Map<string, string>();
        if (!names.has(row.user_id)) {
          const loaded = await loadAuthorNames([row.user_id]);
          loaded.forEach((v, k) => names.set(k, v));
        }
        onInsert(mapMessage(row, names));
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

/** Liczba nieprzeczytanych (wiadomości nowsze niż last_read). */
export async function countUnread(
  threadId: string,
  userId: string
): Promise<number> {
  if (!supabase) return 0;

  const { data: member } = await supabase
    .from('chat_thread_members')
    .select('last_read_at')
    .eq('thread_id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  // Brak last_read: dla ogólnego licz od „teraz-ish” (nie bombarduj badge’em historii)
  const since =
    member?.last_read_at ??
    (threadId === GENERAL_THREAD_ID
      ? new Date().toISOString()
      : '1970-01-01T00:00:00Z');

  const { count, error } = await supabase
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId)
    .gt('created_at', since)
    .neq('user_id', userId);

  if (error) {
    console.warn('countUnread', error);
    return 0;
  }
  return count ?? 0;
}

export interface DmThreadSummary {
  threadId: string;
  peerId: string;
  unread: number;
}

/** Istniejące DM użytkownika + unread (bez tworzenia nowych wątków). */
export async function listMyDmUnread(
  userId: string
): Promise<DmThreadSummary[]> {
  if (!supabase) return [];

  const { data: members, error } = await supabase
    .from('chat_thread_members')
    .select('thread_id, last_read_at')
    .eq('user_id', userId);
  if (error || !members?.length) return [];

  const threadIds = members.map((m) => m.thread_id);
  const { data: threads } = await supabase
    .from('chat_threads')
    .select('id, kind, dm_key')
    .in('id', threadIds)
    .eq('kind', 'dm');

  const out: DmThreadSummary[] = [];
  for (const t of threads ?? []) {
    if (!t.dm_key) continue;
    const [a, b] = t.dm_key.split(':');
    const peerId = a === userId ? b : a;
    if (!peerId) continue;
    const unread = await countUnread(t.id, userId);
    if (unread > 0) {
      out.push({ threadId: t.id, peerId, unread });
    }
  }
  return out;
}
