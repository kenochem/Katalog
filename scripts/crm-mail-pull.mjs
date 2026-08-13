/**
 * Sync CRM inbox z tej maszyny (IMAP → Supabase) — incremental po UID.
 * Hasło: crm_mailbox_credentials (z CRM) lub CRM_IMAP_PASSWORD.
 *
 * Env (wymagane):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRM_MAIL_USER_ID
 *
 * Env (sync):
 *   CRM_INITIAL_BACKFILL — pierwszy sync: ile najnowszych wiadomości (domyślnie 100)
 *   CRM_FETCH_BODIES — ile treści pobrać na run (domyślnie 20, max 50)
 *   CRM_IMAP_PASSWORD — opcjonalnie zamiast hasła z bazy
 *
 * Produkcja: Harmonogram Windows — scripts/install-crm-mail-sync.ps1 (co 5 min).
 */
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const userId = process.env.CRM_MAIL_USER_ID;
let imapPass = process.env.CRM_IMAP_PASSWORD;
const initialBackfill = Math.min(
  500,
  Math.max(10, Number(process.env.CRM_INITIAL_BACKFILL || 100)),
);
const bodyLimit = Math.min(50, Math.max(1, Number(process.env.CRM_FETCH_BODIES || 20)));

if (!url || !serviceKey || !userId) {
  console.error('Ustaw SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRM_MAIL_USER_ID');
  process.exit(1);
}

const admin = createClient(url, serviceKey);

const { data: settings, error: setErr } = await admin
  .from('crm_mailbox_settings')
  .select('*')
  .eq('user_id', userId)
  .maybeSingle();

if (setErr || !settings) {
  console.error(setErr?.message || 'Brak crm_mailbox_settings — najpierw zapisz skrzynkę w CRM');
  process.exit(1);
}

if (!imapPass) {
  const { data: creds, error: cErr } = await admin
    .from('crm_mailbox_credentials')
    .select('password')
    .eq('user_id', userId)
    .maybeSingle();
  if (cErr || !creds?.password) {
    console.error('Brak hasła w CRM — podaj CRM_IMAP_PASSWORD lub połącz skrzynkę w aplikacji');
    process.exit(1);
  }
  imapPass = creds.password;
}

const imapHost = settings.imap_host;
const imapPort = Number(settings.imap_port) || 993;
const imapUser = settings.username || settings.mailbox_email;
const lastCursor = settings.last_imap_uid != null ? Number(settings.last_imap_uid) : null;

function threadIdFromMessageId(messageId) {
  const clean = messageId.replace(/[^a-zA-Z0-9@._+-]/g, '_').slice(0, 180);
  return `email-${clean || crypto.randomUUID()}`;
}

function threadFromFetchMsg(msg, mailboxEmail) {
  const env = msg.envelope || {};
  const fromAddr = env.from?.[0];
  const from = fromAddr?.name || fromAddr?.address || 'Nieznany';
  const subject = env.subject || '(bez tematu)';
  const messageId = env.messageId || `uid-${msg.uid}`;
  return {
    id: threadIdFromMessageId(messageId),
    channel: 'email',
    channelLabel: 'E-mail',
    from: String(from),
    subject: String(subject),
    preview: String(subject).slice(0, 160),
    body: '',
    unread: !(msg.flags?.has('\\Seen') ?? false),
    createdAt: (env.date || new Date()).toISOString(),
    integrationId: 'email',
    replied: false,
    meta: {
      messageId,
      imapUid: msg.uid,
      bodyFetched: false,
      replyTo: fromAddr?.address || mailboxEmail,
      to: mailboxEmail,
    },
  };
}

const client = new ImapFlow({
  host: imapHost,
  port: imapPort,
  secure: settings.imap_secure !== false,
  servername: imapHost,
  auth: { user: imapUser, pass: imapPass },
  logger: false,
  disableAutoIdle: true,
});

await client.connect();
const lock = await client.getMailboxLock('INBOX');
const total = Number(client.mailbox?.exists ?? 0);
let uidList = [];

if (lastCursor != null && lastCursor > 0) {
  const searchRes = await client.search({ uid: `${lastCursor + 1}:*` }, { uid: true });
  uidList = Array.isArray(searchRes) ? searchRes : [];
} else if (total > 0) {
  const allUids = await client.search({ all: true }, { uid: true });
  const sorted = (Array.isArray(allUids) ? allUids : []).sort((a, b) => a - b);
  uidList = sorted.slice(-initialBackfill);
}

const threads = [];
let maxUid = lastCursor ?? 0;

if (uidList.length > 0) {
  const uidSet = uidList.join(',');
  for await (const msg of client.fetch(uidSet, { uid: true, envelope: true, flags: true }, { uid: true })) {
    if (msg.uid > maxUid) maxUid = msg.uid;
    threads.push(threadFromFetchMsg(msg, settings.mailbox_email));
  }
}

lock.release();

const toFetchBody = threads
  .filter((t) => !t.meta?.bodyFetched)
  .slice(-bodyLimit);

for (const t of toFetchBody) {
  const uid = t.meta?.imapUid;
  if (!uid) continue;
  try {
    const one = await client.fetchOne(
      uid,
      { source: { maxLength: 400_000 } },
      { uid: true },
    );
    if (!one?.source) continue;
    const parsed = await simpleParser(one.source);
    const html = typeof parsed.html === 'string' ? parsed.html.trim() : '';
    const text =
      parsed.text?.trim() ||
      (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
    t.body = text || t.subject;
    if (html) t.bodyHtml = html;
    t.preview = (text || t.subject).replace(/\s+/g, ' ').slice(0, 160);
    t.meta.bodyFetched = true;
  } catch {
    /* nagłówek zostaje */
  }
}

await client.logout();

const now = new Date().toISOString();
const rows = threads.map((p) => ({
  id: p.id,
  user_id: userId,
  payload: p,
  received_at: p.createdAt || now,
}));

if (rows.length) {
  const { error: upErr } = await admin.from('crm_inbox_sync').upsert(rows, {
    onConflict: 'user_id,id',
  });
  if (upErr) throw new Error(upErr.message);
}

const settingsPatch = {
  last_sync_at: now,
  last_sync_error: null,
  updated_at: now,
};
if (maxUid > (lastCursor ?? 0)) {
  settingsPatch.last_imap_uid = maxUid;
}

await admin.from('crm_mailbox_settings').update(settingsPatch).eq('user_id', userId);

console.log(
  JSON.stringify({
    ok: true,
    mode: lastCursor != null && lastCursor > 0 ? 'incremental' : 'backfill',
    imported: rows.length,
    inboxTotal: total,
    lastImapUid: maxUid,
    mailbox: settings.mailbox_email,
  }),
);
