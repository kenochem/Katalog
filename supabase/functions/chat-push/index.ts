import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-chat-push-secret',
};

type AdminClient = ReturnType<typeof createClient>;

interface ChatPushRecord {
  id: string;
  thread_id: string;
  user_id: string;
  body: string;
}

interface PushFailure {
  status?: number;
  name?: string;
  message: string;
}

interface PushResult {
  ok: true;
  mode: 'message' | 'self-test';
  recipients: number;
  subscriptions: number;
  attempted: number;
  sent: number;
  failed: number;
  stale: number;
  failures: PushFailure[];
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function normalizePushKeys(raw: unknown): { p256dh: string; auth: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, string>;
  const p256dh = o.p256dh ?? o.P256DH;
  const auth = o.auth ?? o.Auth;
  if (!p256dh || !auth) return null;
  return { p256dh, auth };
}

function parseWebhookRow(body: unknown): ChatPushRecord | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const record = (o.record ?? o) as Record<string, unknown>;
  const thread_id = String(record.thread_id ?? '');
  const user_id = String(record.user_id ?? '');
  const text = String(record.body ?? '');
  const id = String(record.id ?? '');
  if (!thread_id || !user_id) return null;
  return { id, thread_id, user_id, body: text };
}

function messageSnippet(body: string): string {
  if (/^\[\[(?:talk-voice|hub-voice):/.test(body)) return 'Glosowka';
  if (/^\[\[(?:talk-file|hub-file):/.test(body)) return 'Plik';
  if (/^\[\[(?:talk-gif|hub-gif):/.test(body)) return 'GIF';
  const one = body.replace(/\s+/g, ' ').trim();
  return one.length > 120 ? `${one.slice(0, 119)}...` : one;
}

function cleanImageUrl(value: unknown): string | null {
  const url = String(value ?? '').trim();
  if (!/^https:\/\//i.test(url)) return null;
  return url;
}

async function pushForMessageRecord(
  admin: AdminClient,
  row: ChatPushRecord,
): Promise<PushResult | { ok: true; skipped: string; sent: 0 }> {
  const { data: thread } = await admin
    .from('chat_threads')
    .select('id, kind')
    .eq('id', row.thread_id)
    .maybeSingle();

  if (!thread?.id) {
    return { ok: true, skipped: 'thread_not_found', sent: 0 };
  }

  let recipientIds: string[] = [];

  if (thread.kind === 'general') {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id')
      .eq('active', true)
      .neq('id', row.user_id);
    recipientIds = (profiles ?? []).map((p) => p.id);
  } else {
    const { data: members } = await admin
      .from('chat_thread_members')
      .select('user_id')
      .eq('thread_id', row.thread_id)
      .neq('user_id', row.user_id);
    recipientIds = (members ?? []).map((m) => m.user_id);
  }

  const { data: author } = await admin
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', row.user_id)
    .maybeSingle();
  const avatarUrl = cleanImageUrl(author?.avatar_url);

  return sendToRecipients(admin, {
    mode: 'message',
    recipientIds,
    title: author?.display_name?.trim() || 'Nowa wiadomosc',
    body: messageSnippet(row.body),
    url: `/?talkThread=${encodeURIComponent(row.thread_id)}`,
    icon: avatarUrl ?? '/icons/talk-notification-icon-192.png',
    image: avatarUrl ?? undefined,
    badge: '/icons/talk-notification-badge-96.png',
    threadId: row.thread_id,
    messageId: row.id,
    senderUserId: row.user_id,
  });
}

async function getAuthedUserId(admin: AdminClient, req: Request): Promise<string | null> {
  const raw = req.headers.get('authorization') ?? '';
  const token = raw.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user?.id ?? null;
}

async function logPushAttempt(
  admin: AdminClient,
  payload: {
    mode: 'message' | 'self-test';
    messageId?: string;
    threadId?: string;
    senderUserId?: string;
    recipientCount: number;
    subscriptionCount: number;
    attempted: number;
    sent: number;
    failed: number;
    stale: number;
    failures: PushFailure[];
  },
): Promise<void> {
  try {
    await admin.from('chat_push_logs').insert({
      mode: payload.mode,
      message_id: payload.messageId ?? null,
      thread_id: payload.threadId ?? null,
      sender_user_id: payload.senderUserId ?? null,
      recipient_count: payload.recipientCount,
      subscription_count: payload.subscriptionCount,
      attempted: payload.attempted,
      sent: payload.sent,
      failed: payload.failed,
      stale: payload.stale,
      failures: payload.failures,
    });
  } catch {
    // The logging table is optional. Push delivery must not depend on it.
  }
}

async function sendToRecipients(
  admin: AdminClient,
  opts: {
    mode: 'message' | 'self-test';
    recipientIds: string[];
    title: string;
    body: string;
    url?: string;
    icon?: string;
    image?: string;
    badge?: string;
    threadId?: string;
    messageId?: string;
    senderUserId?: string;
  },
): Promise<PushResult> {
  const recipientIds = [...new Set(opts.recipientIds.filter(Boolean))];
  if (recipientIds.length === 0) {
    const result: PushResult = {
      ok: true,
      mode: opts.mode,
      recipients: 0,
      subscriptions: 0,
      attempted: 0,
      sent: 0,
      failed: 0,
      stale: 0,
      failures: [],
    };
    await logPushAttempt(admin, {
      mode: opts.mode,
      messageId: opts.messageId,
      threadId: opts.threadId,
      senderUserId: opts.senderUserId,
      recipientCount: 0,
      subscriptionCount: 0,
      attempted: 0,
      sent: 0,
      failed: 0,
      stale: 0,
      failures: [],
    });
    return result;
  }

  const { data: subs } = await admin
    .from('chat_push_subscriptions')
    .select('endpoint, keys, user_id')
    .in('user_id', recipientIds);

  let sent = 0;
  let attempted = 0;
  let failed = 0;
  const stale: string[] = [];
  const failures: PushFailure[] = [];
  const seenEndpoints = new Set<string>();

  for (const sub of subs ?? []) {
    if (!sub.endpoint || seenEndpoints.has(sub.endpoint)) continue;
    seenEndpoints.add(sub.endpoint);
    const keys = normalizePushKeys(sub.keys);
    if (!keys) continue;
    attempted++;

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys,
        },
        JSON.stringify({
          title: opts.title,
          body: opts.body,
          url: opts.url ?? '/',
          threadId: opts.threadId,
          icon: opts.icon ?? '/icons/talk-notification-icon-192.png',
          image: opts.image,
          badge: opts.badge ?? '/icons/talk-notification-badge-96.png',
        }),
      );
      sent++;
    } catch (e) {
      failed++;
      const err = e as { statusCode?: number; name?: string; message?: string };
      const status = err.statusCode;
      if (status === 403 || status === 404 || status === 410) stale.push(sub.endpoint);
      if (failures.length < 5) {
        failures.push({
          status,
          name: err.name,
          message: err.message ?? String(e),
        });
      }
    }
  }

  if (stale.length) {
    await admin.from('chat_push_subscriptions').delete().in('endpoint', stale);
  }

  const result: PushResult = {
    ok: true,
    mode: opts.mode,
    recipients: recipientIds.length,
    subscriptions: subs?.length ?? 0,
    attempted,
    sent,
    failed,
    stale: stale.length,
    failures,
  };

  console.log('chat-push result', {
    mode: result.mode,
    recipients: result.recipients,
    subscriptions: result.subscriptions,
    attempted: result.attempted,
    sent: result.sent,
    failed: result.failed,
    stale: result.stale,
    failures: result.failures,
  });

  await logPushAttempt(admin, {
    mode: opts.mode,
    messageId: opts.messageId,
    threadId: opts.threadId,
    senderUserId: opts.senderUserId,
    recipientCount: result.recipients,
    subscriptionCount: result.subscriptions,
    attempted: result.attempted,
    sent: result.sent,
    failed: result.failed,
    stale: result.stale,
    failures: result.failures,
  });

  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:it@kenochem.pl';
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!vapidPublic || !vapidPrivate) {
    return json({ error: 'VAPID keys not configured' }, 503);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  const admin = createClient(supabaseUrl, serviceKey);
  const action = String((payload as Record<string, unknown>)?.action ?? '');

  if (action === 'self-test') {
    const userId = await getAuthedUserId(admin, req);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const { data: profile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    const name = profile?.display_name?.trim() || 'Kenochem Talk';

    const result = await sendToRecipients(admin, {
      mode: 'self-test',
      recipientIds: [userId],
      title: 'Kenochem Talk',
      body: `Test push dla ${name}. Jesli to widzisz, telefon przyjmuje powiadomienia.`,
      url: '/',
      icon: '/icons/talk-notification-icon-192.png',
      badge: '/icons/talk-notification-badge-96.png',
      senderUserId: userId,
    });

    return json(result);
  }

  if (action === 'message') {
    const userId = await getAuthedUserId(admin, req);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const messageId = String((payload as Record<string, unknown>)?.messageId ?? '');
    if (!messageId) return json({ error: 'Missing messageId' }, 400);

    const { data: msg, error } = await admin
      .from('chat_messages')
      .select('id, thread_id, user_id, body')
      .eq('id', messageId)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!msg) return json({ error: 'Message not found' }, 404);
    if (msg.user_id !== userId) return json({ error: 'Forbidden' }, 403);

    const result = await pushForMessageRecord(admin, {
      id: msg.id,
      thread_id: msg.thread_id,
      user_id: msg.user_id,
      body: msg.body,
    });
    return json(result);
  }

  const secret = Deno.env.get('CHAT_PUSH_WEBHOOK_SECRET');
  if (secret && req.headers.get('x-chat-push-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const row = parseWebhookRow(payload);
  if (!row) return json({ ok: true, skipped: 'no record' });

  return json(await pushForMessageRecord(admin, row));
});
