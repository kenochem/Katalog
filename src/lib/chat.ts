import { supabase } from './supabase';

export const GENERAL_THREAD_ID = '00000000-0000-0000-0000-0000000000c1';

export interface ChatPeer {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string | null;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  userId: string;
  body: string;
  createdAt: string;
  authorName: string;
  replyToId?: string | null;
  replyTo?: { authorName: string; body: string } | null;
  thanksCount: number;
  thanksMine: boolean;
  editedAt?: string | null;
  deletedAt?: string | null;
  readByOthersCount?: number;
}

export interface ChatThanksSummary {
  messageId: string;
  count: number;
  mine: boolean;
}

function mapMessage(
  row: {
    id: string;
    thread_id: string;
    user_id: string;
    body: string;
    created_at: string;
    reply_to_id?: string | null;
  },
  names: Map<string, string>,
  replyLookup?: Map<string, { userId: string; body: string }>,
  thanks?: Map<string, ChatThanksSummary>,
  reads?: Map<string, number>,
): ChatMessage {
  const replyRow = row.reply_to_id ? replyLookup?.get(row.reply_to_id) : undefined;
  const t = thanks?.get(row.id);
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    authorName: names.get(row.user_id) ?? 'Użytkownik',
    replyToId: row.reply_to_id ?? null,
    replyTo: replyRow
      ? {
          authorName: names.get(replyRow.userId) ?? 'Użytkownik',
          body: replyRow.body,
        }
      : null,
    thanksCount: t?.count ?? 0,
    thanksMine: t?.mine ?? false,
    readByOthersCount: reads?.get(row.id) ?? 0,
  };
}

async function loadThanksForMessages(
  messageIds: string[],
  userId?: string,
): Promise<Map<string, ChatThanksSummary>> {
  const map = new Map<string, ChatThanksSummary>();
  if (!supabase || messageIds.length === 0) return map;

  const { data, error } = await supabase
    .from('chat_message_thanks')
    .select('message_id, user_id')
    .in('message_id', messageIds);
  if (error) {
    console.warn('loadThanksForMessages', error);
    return map;
  }
  for (const id of messageIds) {
    map.set(id, { messageId: id, count: 0, mine: false });
  }
  for (const row of data ?? []) {
    const cur = map.get(row.message_id) ?? {
      messageId: row.message_id,
      count: 0,
      mine: false,
    };
    cur.count += 1;
    if (userId && row.user_id === userId) cur.mine = true;
    map.set(row.message_id, cur);
  }
  return map;
}

async function loadReadCountsForMessages(
  messageIds: string[],
  currentUserId?: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!supabase || messageIds.length === 0) return map;
  for (const id of messageIds) map.set(id, 0);

  const { data, error } = await supabase
    .from('chat_message_reads')
    .select('message_id, user_id')
    .in('message_id', messageIds);
  if (error) {
    if (!/does not exist|schema cache|relation/i.test(error.message)) {
      console.warn('loadReadCountsForMessages', error);
    }
    return map;
  }
  for (const row of data ?? []) {
    if (currentUserId && row.user_id === currentUserId) continue;
    map.set(row.message_id, (map.get(row.message_id) ?? 0) + 1);
  }
  return map;
}

export async function listChatPeers(): Promise<ChatPeer[]> {
  const client = supabase;
  if (!client) return [];
  try {
    const { data, error } = await client.rpc('list_chat_peers');
    if (!error) {
      return (data ?? []).map(
        (r: { id: string; display_name: string; email: string; avatar_url?: string | null }) => ({
          id: r.id,
          displayName: r.display_name,
          email: r.email,
          avatarUrl: r.avatar_url?.trim() || null,
        }),
      );
    }
    if (!/avatar_url|function|schema|does not exist/i.test(error.message)) {
      throw error;
    }
  } catch (e) {
    console.warn('listChatPeers rpc', e);
  }

  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    const uid = user?.id;
    const base = () => {
      let q = client
        .from('profiles')
        .select('id, display_name, email, avatar_url')
        .eq('active', true)
        .order('display_name');
      if (uid) q = q.neq('id', uid);
      return q;
    };
    type PeerRow = {
      id: string;
      display_name: string;
      email: string;
      avatar_url?: string | null;
    };
    let rows: PeerRow[] | null = null;
    let qErr: { message: string } | null = null;
    const first = await base();
    rows = first.data as PeerRow[] | null;
    qErr = first.error;
    if (qErr && /avatar_url|column|schema/i.test(qErr.message)) {
      let q = client
        .from('profiles')
        .select('id, display_name, email')
        .eq('active', true)
        .order('display_name');
      if (uid) q = q.neq('id', uid);
      const fallback = await q;
      rows = (fallback.data ?? []) as PeerRow[];
      qErr = fallback.error;
    }
    if (qErr) {
      console.warn('listChatPeers fallback', qErr);
      return [];
    }
    return (rows ?? []).map((r) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
      avatarUrl:
        'avatar_url' in r && typeof r.avatar_url === 'string'
          ? r.avatar_url.trim() || null
          : null,
    }));
  } catch (e) {
    console.warn('listChatPeers', e);
    return [];
  }
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

function isMissingChatColumnError(message: string): boolean {
  return /reply_to|reaction|column|schema cache|does not exist/i.test(message);
}

type ChatRow = {
  id: string;
  thread_id: string;
  user_id: string;
  body: string;
  created_at: string;
  reply_to_id?: string | null;
};

async function mapFetchedRows(rows: ChatRow[]): Promise<ChatMessage[]> {
  if (!supabase || rows.length === 0) return [];
  const names = await loadAuthorNames(rows.map((r) => r.user_id));

  const replyIds = [
    ...new Set(rows.map((r) => r.reply_to_id).filter((id): id is string => Boolean(id))),
  ];
  const replyLookup = new Map<string, { userId: string; body: string }>();
  if (replyIds.length > 0) {
    const { data: replyRows } = await supabase
      .from('chat_messages')
      .select('id, user_id, body')
      .in('id', replyIds);
    for (const r of replyRows ?? []) {
      replyLookup.set(r.id, { userId: r.user_id, body: r.body });
      if (!names.has(r.user_id)) {
        const extra = await loadAuthorNames([r.user_id]);
        extra.forEach((v, k) => names.set(k, v));
      }
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const thanks = await loadThanksForMessages(
    rows.map((r) => r.id),
    user?.id,
  );
  const reads = await loadReadCountsForMessages(
    rows.map((r) => r.id),
    user?.id,
  );

  return rows.map((r) => mapMessage(r, names, replyLookup, thanks, reads));
}

export async function fetchMessages(
  threadId: string,
  limit = 80
): Promise<ChatMessage[]> {
  if (!supabase) return [];

  const baseQuery = () =>
    supabase!
      .from('chat_messages')
      .select('id, thread_id, user_id, body, created_at, reply_to_id')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit);

  let { data, error } = await baseQuery();

  if (error && isMissingChatColumnError(error.message)) {
    const fallback = await supabase
      .from('chat_messages')
      .select('id, thread_id, user_id, body, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit);
    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) throw error;
  const rows = ((data ?? []) as ChatRow[]).reverse();
  return mapFetchedRows(rows);
}

export async function sendMessage(
  threadId: string,
  userId: string,
  body: string,
  replyToId?: string | null,
): Promise<ChatMessage> {
  if (!supabase) throw new Error('Supabase niedostępne');
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Pusta wiadomość');
  if (trimmed.length > 2000) throw new Error('Za długa wiadomość');

  const payload: {
    thread_id: string;
    user_id: string;
    body: string;
    reply_to_id?: string;
  } = {
    thread_id: threadId,
    user_id: userId,
    body: trimmed,
  };
  if (replyToId) payload.reply_to_id = replyToId;

  let { data, error } = await supabase
    .from('chat_messages')
    .insert(payload)
    .select('id, thread_id, user_id, body, created_at, reply_to_id')
    .single();

  if (error && replyToId && isMissingChatColumnError(error.message)) {
    delete payload.reply_to_id;
    ({ data, error } = await supabase
      .from('chat_messages')
      .insert(payload)
      .select('id, thread_id, user_id, body, created_at')
      .single());
  }

  if (error) throw error;
  if (!data) throw new Error('Brak wiadomości w odpowiedzi');
  const names = await loadAuthorNames([data.user_id]);
  let replyLookup: Map<string, { userId: string; body: string }> | undefined;
  const replyId = 'reply_to_id' in data ? data.reply_to_id : null;
  if (replyId) {
    const { data: replyRow } = await supabase
      .from('chat_messages')
      .select('id, user_id, body')
      .eq('id', replyId)
      .maybeSingle();
    if (replyRow) {
      replyLookup = new Map([[replyRow.id, { userId: replyRow.user_id, body: replyRow.body }]]);
      const extra = await loadAuthorNames([replyRow.user_id]);
      extra.forEach((v, k) => names.set(k, v));
    }
  }
  return mapMessage(data, names, replyLookup, new Map(), new Map());
}

export async function markMessagesRead(messageIds: string[], userId: string): Promise<void> {
  if (!supabase || messageIds.length === 0) return;
  const rows = [...new Set(messageIds)].map((message_id) => ({
    message_id,
    user_id: userId,
  }));
  const { error } = await supabase.from('chat_message_reads').upsert(rows, {
    onConflict: 'message_id,user_id',
    ignoreDuplicates: true,
  });
  if (error && !/does not exist|schema cache|relation/i.test(error.message)) {
    console.warn('markMessagesRead', error);
  }
}

export function subscribeMessageReads(
  threadId: string,
  onRead: (messageId: string, userId: string) => void,
): () => void {
  const client = supabase;
  if (!client) return () => undefined;

  const channel = client
    .channel(`chat-reads:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_message_reads',
      },
      async (payload) => {
        const row = payload.new as { message_id: string; user_id: string };
        const { data: msg } = await client
          .from('chat_messages')
          .select('thread_id')
          .eq('id', row.message_id)
          .maybeSingle();
        if (msg?.thread_id !== threadId) return;
        onRead(row.message_id, row.user_id);
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

/** Przełącz „Dzięki” na wiadomości. Zwraca nowy stan (czy ja podziękowałem). */
export async function toggleMessageThanks(
  messageId: string,
  userId: string,
  currentlyMine: boolean,
): Promise<boolean> {
  if (!supabase) throw new Error('Supabase niedostępne');
  if (currentlyMine) {
    const { error } = await supabase
      .from('chat_message_thanks')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from('chat_message_thanks').insert({
    message_id: messageId,
    user_id: userId,
  });
  if (error) throw error;
  return true;
}

export type ThanksRealtimeHandler = (messageId: string, delta: number, mine: boolean) => void;

/** Realtime: ktoś dodał / usunął „Dzięki” w wątku. */
export function subscribeThreadThanks(
  threadId: string,
  userId: string,
  onChange: ThanksRealtimeHandler,
): () => void {
  const client = supabase;
  if (!client) return () => undefined;

  const channel = client
    .channel(`chat-thanks:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_message_thanks',
      },
      async (payload) => {
        const row = payload.new as { message_id: string; user_id: string };
        const { data: msg } = await client
          .from('chat_messages')
          .select('thread_id')
          .eq('id', row.message_id)
          .maybeSingle();
        if (msg?.thread_id !== threadId) return;
        onChange(row.message_id, 1, row.user_id === userId);
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_message_thanks',
      },
      async (payload) => {
        const row = payload.old as { message_id: string; user_id: string };
        const { data: msg } = await client
          .from('chat_messages')
          .select('thread_id')
          .eq('id', row.message_id)
          .maybeSingle();
        if (msg?.thread_id !== threadId) return;
        onChange(row.message_id, -1, false);
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
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
        try {
        const row = payload.new as {
          id: string;
          thread_id: string;
          user_id: string;
          body: string;
          created_at: string;
          reply_to_id?: string | null;
        };
        const names = nameCache ?? new Map<string, string>();
        if (!names.has(row.user_id)) {
          const loaded = await loadAuthorNames([row.user_id]);
          loaded.forEach((v, k) => names.set(k, v));
        }
        let replyLookup: Map<string, { userId: string; body: string }> | undefined;
        if (row.reply_to_id) {
          const { data: replyRow } = await supabase!
            .from('chat_messages')
            .select('id, user_id, body')
            .eq('id', row.reply_to_id)
            .maybeSingle();
          if (replyRow) {
            replyLookup = new Map([
              [replyRow.id, { userId: replyRow.user_id, body: replyRow.body }],
            ]);
            if (!names.has(replyRow.user_id)) {
              const loaded = await loadAuthorNames([replyRow.user_id]);
              loaded.forEach((v, k) => names.set(k, v));
            }
          }
        }
        const {
          data: { user },
        } = await supabase!.auth.getUser();
        const thanks = await loadThanksForMessages([row.id], user?.id);
        const reads = await loadReadCountsForMessages([row.id], user?.id);
        onInsert(mapMessage(row, names, replyLookup, thanks, reads));
        } catch (e) {
          console.warn('subscribeThread insert', e);
        }
      },
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

export interface ChatInboxSnippet {
  threadId: string;
  peerId: string | null;
  body: string;
  createdAt: string;
  authorUserId: string;
}

/** Ostatnia wiadomość na wątek (ogólny + DM) — podgląd jak Messenger. */
export async function listChatInboxSnippets(
  userId: string,
): Promise<Map<string, ChatInboxSnippet>> {
  const out = new Map<string, ChatInboxSnippet>();
  if (!supabase) return out;

  const { data: members, error: memErr } = await supabase
    .from('chat_thread_members')
    .select('thread_id')
    .eq('user_id', userId);
  if (memErr || !members?.length) return out;

  const threadIds = [...new Set(members.map((m) => m.thread_id))];
  const { data: threads } = await supabase
    .from('chat_threads')
    .select('id, kind, dm_key')
    .in('id', threadIds);

  const peerByThread = new Map<string, string | null>();
  for (const t of threads ?? []) {
    if (t.id === GENERAL_THREAD_ID) {
      peerByThread.set(t.id, null);
      continue;
    }
    if (t.kind === 'dm' && t.dm_key) {
      const [a, b] = t.dm_key.split(':');
      peerByThread.set(t.id, a === userId ? b : a);
    }
  }

  const { data: rows, error } = await supabase
    .from('chat_messages')
    .select('thread_id, body, created_at, user_id')
    .in('thread_id', threadIds)
    .order('created_at', { ascending: false })
    .limit(Math.min(threadIds.length * 3, 120));

  if (error) {
    console.warn('listChatInboxSnippets', error);
    return out;
  }

  for (const row of rows ?? []) {
    if (out.has(row.thread_id)) continue;
    out.set(row.thread_id, {
      threadId: row.thread_id,
      peerId: peerByThread.get(row.thread_id) ?? null,
      body: row.body,
      createdAt: row.created_at,
      authorUserId: row.user_id,
    });
  }
  return out;
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
