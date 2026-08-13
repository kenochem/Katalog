import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { ImapFlow } from 'npm:imapflow@1.0.177';
import { simpleParser } from 'npm:mailparser@3.7.2';
import nodemailer from 'npm:nodemailer@6.9.16';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type CrmRole = 'admin' | 'operator' | 'magazynier' | 'handlowiec';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function canUseCrmMail(role: string): boolean {
  return role === 'admin' || role === 'operator' || role === 'handlowiec';
}

function threadIdFromMessageId(messageId: string): string {
  const clean = messageId.replace(/[^a-zA-Z0-9@._+-]/g, '_').slice(0, 180);
  return `email-${clean || crypto.randomUUID()}`;
}

interface DiscoveredMail {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  source: string;
}

function domainFromEmail(email: string): string {
  return email.split('@')[1]?.trim().toLowerCase() ?? '';
}

function byProvider(
  imapHost: string,
  smtpHost: string,
  smtpPort: number,
  source: string,
): DiscoveredMail {
  const smtpSecure = smtpPort === 465;
  return {
    imapHost,
    imapPort: 993,
    imapSecure: true,
    smtpHost,
    smtpPort,
    smtpSecure,
    source,
  };
}

async function discoverMailbox(email: string): Promise<DiscoveredMail> {
  const domain = domainFromEmail(email);
  if (!domain || !email.includes('@')) {
    throw new Error('Podaj poprawny adres e-mail');
  }

  const hostProviders: Record<string, DiscoveredMail> = {
    'gmail.com': byProvider('imap.gmail.com', 'smtp.gmail.com', 465, 'Gmail'),
    'googlemail.com': byProvider('imap.gmail.com', 'smtp.gmail.com', 465, 'Gmail'),
    'outlook.com': byProvider(
      'outlook.office365.com',
      'smtp.office365.com',
      587,
      'Microsoft',
    ),
    'hotmail.com': byProvider(
      'outlook.office365.com',
      'smtp.office365.com',
      587,
      'Microsoft',
    ),
    'live.com': byProvider(
      'outlook.office365.com',
      'smtp.office365.com',
      587,
      'Microsoft',
    ),
    'office365.com': byProvider(
      'outlook.office365.com',
      'smtp.office365.com',
      587,
      'Microsoft',
    ),
    'o2.pl': byProvider('poczta.o2.pl', 'poczta.o2.pl', 587, 'O2'),
    'wp.pl': byProvider('imap.wp.pl', 'smtp.wp.pl', 465, 'WP'),
    'interia.pl': byProvider('poczta.interia.pl', 'poczta.interia.pl', 587, 'Interia'),
    'onet.pl': byProvider('imap.poczta.onet.pl', 'smtp.poczta.onet.pl', 587, 'Onet'),
  };

  if (hostProviders[domain]) return hostProviders[domain];

  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
    );
    if (res.ok) {
      const data = await res.json();
      const mx = ((data.Answer as { data?: string }[]) ?? [])
        .map((a) => String(a.data || '').toLowerCase())
        .join(' ');
      if (mx.includes('zenbox')) {
        return byProvider('imap.zenbox.pl', 'smtp.zenbox.pl', 587, 'Zenbox (MX)');
      }
      if (mx.includes('google') || mx.includes('gmail')) {
        return byProvider('imap.gmail.com', 'smtp.gmail.com', 465, 'Google Workspace (MX)');
      }
      if (mx.includes('outlook') || mx.includes('protection.outlook.com')) {
        return byProvider(
          'outlook.office365.com',
          'smtp.office365.com',
          587,
          'Microsoft 365 (MX)',
        );
      }
      if (mx.includes('home.pl')) {
        return byProvider('imap.home.pl', 'smtp.home.pl', 465, 'home.pl (MX)');
      }
      if (mx.includes('webio')) {
        return byProvider('imap.webio.pl', 'smtp.webio.pl', 465, 'Webio (MX)');
      }
      if (mx.includes('protonmail')) {
        return byProvider('127.0.0.1', '127.0.0.1', 587, 'Proton — użyj klienta Proton');
      }
    }
  } catch {
    /* fallback */
  }

  return byProvider(
    `mail.${domain}`,
    `mail.${domain}`,
    587,
    `Poczta domeny (${domain})`,
  );
}

function smtpTransportOptions(
  settings: {
    smtp_host: string;
    smtp_port: number;
    smtp_secure: boolean;
    username: string;
  },
  password: string,
) {
  const port = Number(settings.smtp_port);
  const secure = settings.smtp_secure === true;
  return {
    host: settings.smtp_host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: { user: settings.username, pass: password },
  };
}

function humanizeMailError(raw: string): string {
  const m = raw.trim();
  const lower = m.toLowerCase();
  if (/unexpected close|connection closed|connection ended|econnreset/i.test(lower)) {
    return 'Serwer poczty zakończył połączenie podczas pobierania — spróbuj „Odśwież” (pobieramy mniejszą partię).';
  }
  if (/invalid credentials|authentication failed|login fail|no permission|incorrect password|invalid login/i.test(lower)) {
    return 'Błędny login lub hasło IMAP/SMTP (pełny adres e-mail + hasło skrzynki).';
  }
  if (/certificate|self signed|tls|ssl|handshake/i.test(lower)) {
    return 'Błąd SSL/TLS — sprawdź porty (np. Webio: IMAP 993, SMTP 465).';
  }
  if (/timeout|timed out|etimedout|econnrefused|enotfound|getaddrinfo/i.test(lower)) {
    return 'Nie można połączyć z serwerem poczty — sprawdź host i port IMAP/SMTP.';
  }
  return m.length > 400 ? `${m.slice(0, 397)}…` : m;
}

function settingsFromBody(
  mailboxEmail: string,
  username: string,
  discovered: DiscoveredMail,
): MailboxSettingsRow {
  return {
    mailbox_email: mailboxEmail,
    username,
    imap_host: discovered.imapHost,
    imap_port: discovered.imapPort,
    imap_secure: discovered.imapSecure,
    smtp_host: discovered.smtpHost,
    smtp_port: discovered.smtpPort,
    smtp_secure: discovered.smtpSecure,
  };
}

function discoveredFromBody(body: Record<string, unknown>, fallback: DiscoveredMail): DiscoveredMail {
  const imapHost = String(body.imapHost || '').trim();
  const smtpHost = String(body.smtpHost || '').trim();
  if (!imapHost || !smtpHost) return fallback;
  const imapPort = Number(body.imapPort) || 993;
  const smtpPort = Number(body.smtpPort) || 465;
  const imapSecure = body.imapSecure !== false;
  const smtpSecure =
    body.smtpSecure === true || (body.smtpSecure !== false && smtpPort === 465);
  return {
    imapHost,
    imapPort,
    imapSecure,
    smtpHost,
    smtpPort,
    smtpSecure,
    source: 'Ręczna konfiguracja IMAP/SMTP',
  };
}

type MailboxSettingsRow = {
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  username: string;
  mailbox_email: string;
};

type ImapProfile = { label: string; port: number; secure: boolean };

function imapProfilesFor(settings: MailboxSettingsRow): ImapProfile[] {
  const host = settings.imap_host.toLowerCase();
  const list: ImapProfile[] = [];
  const custom: ImapProfile = {
    label: `Zapisany (${settings.imap_port})`,
    port: settings.imap_port,
    secure: settings.imap_secure !== false,
  };
  list.push(custom);
  if (host.includes('webio')) {
    list.push({ label: 'Webio SSL 993', port: 993, secure: true });
    list.push({ label: 'Webio STARTTLS 143', port: 143, secure: false });
  }
  const seen = new Set<string>();
  return list.filter((p) => {
    const k = `${p.port}/${p.secure}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function imapClientFor(
  settings: MailboxSettingsRow,
  password: string,
  profile: ImapProfile,
) {
  return new ImapFlow({
    host: settings.imap_host,
    port: profile.port,
    secure: profile.secure,
    servername: settings.imap_host,
    auth: { user: settings.username, pass: password },
    logger: false,
    connectionTimeout: 25000,
    greetingTimeout: 20000,
    socketTimeout: 90000,
    disableAutoIdle: true,
  });
}

function imapClient(settings: MailboxSettingsRow, password: string) {
  return imapClientFor(settings, password, {
    label: 'default',
    port: settings.imap_port,
    secure: settings.imap_secure !== false,
  });
}

async function probeTls(host: string, port: number): Promise<boolean> {
  try {
    const conn = await Deno.connectTls({ hostname: host, port });
    conn.close();
    return true;
  } catch {
    return false;
  }
}

async function probeTcp(host: string, port: number): Promise<boolean> {
  try {
    const conn = await Deno.connect({ hostname: host, port });
    conn.close();
    return true;
  } catch {
    return false;
  }
}

async function imapInboxCountWithProfile(
  settings: MailboxSettingsRow,
  password: string,
  profile: ImapProfile,
): Promise<{ total: number } | { error: string }> {
  const client = imapClientFor(settings, password, profile);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const total =
      client.mailbox && 'exists' in client.mailbox
        ? Number(client.mailbox.exists)
        : 0;
    lock.release();
    await client.logout();
    return { total };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    return { error: raw };
  } finally {
    try {
      await client.close();
    } catch {
      /* ignore */
    }
  }
}

type ImapTestDiagnostics = {
  tcp993: boolean;
  tcp143: boolean;
  attempts: { profile: string; error?: string }[];
};

async function testImapOnly(
  settings: MailboxSettingsRow,
  password: string,
): Promise<{
  inboxTotal: number;
  error?: string;
  profile?: string;
  diagnostics?: ImapTestDiagnostics;
}> {
  const diagnostics: ImapTestDiagnostics = {
    tcp993: await probeTls(settings.imap_host, 993),
    tcp143: await probeTcp(settings.imap_host, 143),
    attempts: [],
  };

  if (!diagnostics.tcp993 && !diagnostics.tcp143) {
    return {
      inboxTotal: 0,
      error:
        'Chmura Supabase nie łączy się z serwerem poczty (porty 993/143). Uruchom sync na serwerze — instrukcja: scripts/crm-mail-pull.mjs',
      diagnostics,
    };
  }

  for (const profile of imapProfilesFor(settings)) {
    const result = await imapInboxCountWithProfile(settings, password, profile);
    if ('total' in result) {
      return {
        inboxTotal: result.total,
        profile: profile.label,
        diagnostics,
      };
    }
    diagnostics.attempts.push({
      profile: profile.label,
      error: result.error,
    });
  }

  const lastRaw =
    diagnostics.attempts[diagnostics.attempts.length - 1]?.error ??
    'Logowanie IMAP nieudane';
  return {
    inboxTotal: 0,
    error: humanizeMailError(lastRaw),
    diagnostics,
  };
}

function extractEmailAddress(raw: string): string {
  const m = raw.match(/<([^>]+@[^>]+)>/);
  if (m) return m[1].trim();
  if (raw.includes('@')) return raw.trim();
  return raw;
}

type EnvelopeListItem = {
  uid: number;
  envelope?: {
    subject?: string;
    date?: Date;
    messageId?: string;
    from?: { name?: string; address?: string }[];
  };
  seen: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function threadFromEnvelopeItem(
  item: EnvelopeListItem,
  settings: MailboxSettingsRow,
): Record<string, unknown> {
  const env = item.envelope ?? {};
  const fromAddr = env.from?.[0];
  const from = fromAddr?.name || fromAddr?.address || 'Nieznany';
  const subject = env.subject || '(bez tematu)';
  const createdAt = (env.date || new Date()).toISOString();
  const messageId = env.messageId || `uid-${item.uid}`;
  const id = threadIdFromMessageId(messageId);
  return {
    id,
    channel: 'email',
    channelLabel: 'E-mail',
    from: String(from),
    subject: String(subject),
    preview: String(subject).slice(0, 160),
    body: '',
    unread: !item.seen,
    createdAt,
    integrationId: 'email',
    replied: false,
    meta: {
      messageId,
      imapUid: item.uid,
      bodyFetched: false,
      replyTo: fromAddr?.address || extractEmailAddress(String(from)),
      to: settings.mailbox_email,
    },
  };
}

async function fetchImapMessageBody(
  settings: MailboxSettingsRow,
  password: string,
  imapUid: number,
): Promise<{ body: string; preview: string; bodyHtml?: string } | { error: string }> {
  const client = imapClient(settings, password);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const one = await client.fetchOne(
        imapUid,
        { source: { maxLength: 480_000 }, flags: true },
        { uid: true },
      );
      if (!one?.source) {
        return { error: 'Serwer nie zwrócił treści wiadomości' };
      }
      const parsed = await simpleParser(one.source);
      const subject = parsed.subject || '(bez tematu)';
      const html = typeof parsed.html === 'string' ? parsed.html.trim() : '';
      const text =
        parsed.text?.trim() ||
        (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
      const body = text || subject;
      return {
        body,
        preview: (text || subject).replace(/\s+/g, ' ').slice(0, 160) || subject,
        bodyHtml: html || undefined,
      };
    } finally {
      lock.release();
    }
  } catch (err) {
    return {
      error: humanizeMailError(err instanceof Error ? err.message : String(err)),
    };
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

/** Krótkie połączenia IMAP — incremental po UID (Edge) lub backfill przy pierwszym sync. */
async function pullInboxThreadsIncremental(
  settings: MailboxSettingsRow,
  password: string,
  lastImapUid: number | null,
  initialBackfill: number,
): Promise<{ threads: Record<string, unknown>[]; inboxTotal: number; maxUid: number; warn?: string }> {
  const backfill = Math.min(200, Math.max(10, initialBackfill));
  const CHUNK = 4;
  let inboxTotal = 0;
  let maxUid = lastImapUid ?? 0;
  const items: EnvelopeListItem[] = [];
  const warnings: string[] = [];

  {
    const client = imapClient(settings, password);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      inboxTotal =
        client.mailbox && 'exists' in client.mailbox
          ? Number(client.mailbox.exists)
          : 0;

      let uidList: number[] = [];
      if (lastImapUid != null && lastImapUid > 0) {
        const searchRes = await client.search(
          { uid: `${lastImapUid + 1}:*` },
          { uid: true },
        );
        uidList = Array.isArray(searchRes) ? searchRes : [];
      } else if (inboxTotal > 0) {
        const all = await client.search({ all: true }, { uid: true });
        const sorted = (Array.isArray(all) ? all : []).sort((a, b) => a - b);
        uidList = sorted.slice(-backfill);
      }
      lock.release();
      await client.logout();

      for (let i = 0; i < uidList.length; i += CHUNK) {
        const slice = uidList.slice(i, i + CHUNK);
        if (slice.length === 0) continue;
        const uidSet = slice.join(',');
        const client2 = imapClient(settings, password);
        try {
          await client2.connect();
          const lock2 = await client2.getMailboxLock('INBOX');
          try {
            for await (const msg of client2.fetch(
              uidSet,
              { uid: true, envelope: true, flags: true },
              { uid: true },
            )) {
              if (msg.uid > maxUid) maxUid = msg.uid;
              items.push({
                uid: msg.uid,
                envelope: msg.envelope as EnvelopeListItem['envelope'],
                seen: msg.flags?.has('\\Seen') ?? false,
              });
            }
          } finally {
            lock2.release();
          }
          await client2.logout();
        } catch (err) {
          warnings.push(err instanceof Error ? err.message : String(err));
        }
        await sleep(350);
      }
    } catch (err) {
      throw err;
    }
  }

  const threads = items.map((item) => threadFromEnvelopeItem(item, settings));
  if (threads.length === 0 && warnings.length > 0 && inboxTotal > 0) {
    throw new Error(warnings[warnings.length - 1]!);
  }
  return { threads, inboxTotal, maxUid, warn: warnings[0] };
}

/** @deprecated Okno sekwencyjne — fallback gdy brak kolumny last_imap_uid */
async function pullInboxThreads(
  settings: MailboxSettingsRow,
  password: string,
  limit: number,
): Promise<{ threads: Record<string, unknown>[]; inboxTotal: number; warn?: string }> {
  const cap = Math.min(24, Math.max(1, limit));
  const CHUNK = 3;
  let inboxTotal = 0;
  const items: EnvelopeListItem[] = [];
  const warnings: string[] = [];

  {
    const client = imapClient(settings, password);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      inboxTotal =
        client.mailbox && 'exists' in client.mailbox
          ? Number(client.mailbox.exists)
          : 0;
      lock.release();
      await client.logout();
    } catch (err) {
      throw err;
    }
  }

  if (inboxTotal <= 0) {
    return { threads: [], inboxTotal: 0 };
  }

  const fromSeq = Math.max(1, inboxTotal - cap + 1);

  for (let start = fromSeq; start <= inboxTotal; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, inboxTotal);
    const client = imapClient(settings, password);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        for await (const msg of client.fetch(`${start}:${end}`, {
          uid: true,
          envelope: true,
          flags: true,
        })) {
          items.push({
            uid: msg.uid,
            envelope: msg.envelope as EnvelopeListItem['envelope'],
            seen: msg.flags?.has('\\Seen') ?? false,
          });
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(msg);
    }
    await sleep(350);
  }

  const threads = items.map((item) => threadFromEnvelopeItem(item, settings));
  if (threads.length === 0 && warnings.length > 0) {
    throw new Error(warnings[warnings.length - 1]!);
  }
  return { threads, inboxTotal };
}

async function runImapSync(
  admin: ReturnType<typeof createClient>,
  userId: string,
  settings: MailboxSettingsRow & { last_imap_uid?: number | null },
  password: string,
  limit: number,
): Promise<{ imported: number; inboxTotal?: number; error?: string }> {
  const threads: Record<string, unknown>[] = [];
  let syncError: string | null = null;
  let inboxTotal = 0;
  let syncWarn: string | null = null;
  let maxUid = settings.last_imap_uid != null ? Number(settings.last_imap_uid) : 0;

  const lastUid =
    settings.last_imap_uid != null ? Number(settings.last_imap_uid) : null;
  const backfill = Math.min(120, Math.max(limit, 25));

  try {
    const pulled = await pullInboxThreadsIncremental(
      settings,
      password,
      lastUid,
      backfill,
    );
    threads.push(...pulled.threads);
    inboxTotal = pulled.inboxTotal;
    maxUid = Math.max(maxUid, pulled.maxUid);
    syncWarn = pulled.warn ?? null;
  } catch (err) {
    syncError = humanizeMailError(err instanceof Error ? err.message : String(err));
    const attempts = [Math.min(24, limit), 12, 6];
    for (let i = 0; i < attempts.length; i++) {
      const tryLimit = attempts[i]!;
      try {
        if (i > 0) await sleep(600);
        const pulled = await pullInboxThreads(settings, password, tryLimit);
        threads.length = 0;
        threads.push(...pulled.threads);
        inboxTotal = pulled.inboxTotal;
        for (const t of threads) {
          const uid = (t as { meta?: { imapUid?: number } }).meta?.imapUid;
          if (uid && uid > maxUid) maxUid = uid;
        }
        syncWarn = pulled.warn ?? null;
        syncError = null;
        break;
      } catch (fallbackErr) {
        syncError = humanizeMailError(
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
        );
        if (tryLimit === attempts[attempts.length - 1]) break;
      }
    }
  }

  if (syncError && threads.length === 0) {
    await admin
      .from('crm_mailbox_settings')
      .update({
        last_sync_error: syncError,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    return { imported: 0, inboxTotal, error: syncError };
  }

  const now = new Date().toISOString();
  if (threads.length > 0) {
    const rows = threads.map((p) => ({
      id: String((p as { id: string }).id),
      user_id: userId,
      payload: p,
      received_at: (p as { createdAt: string }).createdAt || now,
    }));
    const { error: upErr } = await admin
      .from('crm_inbox_sync')
      .upsert(rows, { onConflict: 'user_id,id' });
    if (upErr) {
      const dbErr = humanizeMailError(upErr.message);
      await admin
        .from('crm_mailbox_settings')
        .update({
          last_sync_error: dbErr,
          updated_at: now,
        })
        .eq('user_id', userId);
      return { imported: 0, inboxTotal, error: dbErr };
    }
  }

  await admin
    .from('crm_mailbox_settings')
    .update({
      last_sync_at: now,
      last_sync_error: syncWarn,
      updated_at: now,
      ...(maxUid > (lastUid ?? 0) ? { last_imap_uid: maxUid } : {}),
    })
    .eq('user_id', userId);

  return { imported: threads.length, inboxTotal };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Brak Authorization' }, 401);

    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser(jwt);
    if (userErr || !user) return json({ error: 'Nieautoryzowany' }, 401);

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, role, active')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !profile?.active || !canUseCrmMail(profile.role as CrmRole)) {
      return json({ error: 'Brak uprawnień CRM / poczty' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'save_config') {
      const mailboxEmail = String(body.mailboxEmail || '').trim().toLowerCase();
      const username = String(body.username || mailboxEmail).trim();
      const password = String(body.password || '');
      const imapHost = String(body.imapHost || '').trim();
      const smtpHost = String(body.smtpHost || '').trim();
      const imapPort = Number(body.imapPort) || 993;
      const smtpPort = Number(body.smtpPort) || 465;
      const imapSecure = body.imapSecure !== false;
      const smtpSecure =
        body.smtpSecure === true || (body.smtpSecure !== false && smtpPort === 465);

      if (!mailboxEmail || !imapHost || !smtpHost || !username) {
        return json({ error: 'Uzupełnij e-mail, IMAP i SMTP' }, 400);
      }

      const { data: existingCreds } = await admin
        .from('crm_mailbox_credentials')
        .select('password')
        .eq('user_id', user.id)
        .maybeSingle();

      const passToStore = password || existingCreds?.password;
      if (!passToStore) {
        return json({ error: 'Podaj hasło lub hasło aplikacji' }, 400);
      }

      const now = new Date().toISOString();
      const { error: setErr } = await admin.from('crm_mailbox_settings').upsert({
        user_id: user.id,
        mailbox_email: mailboxEmail,
        imap_host: imapHost,
        imap_port: imapPort,
        imap_secure: imapSecure,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_secure: smtpSecure,
        username,
        updated_at: now,
      });
      if (setErr) return json({ error: setErr.message }, 500);

      if (password) {
        const { error: credErr } = await admin.from('crm_mailbox_credentials').upsert({
          user_id: user.id,
          password,
          updated_at: now,
        });
        if (credErr) return json({ error: credErr.message }, 500);
      }

      return json({ ok: true });
    }

    if (action === 'discover') {
      const mailboxEmail = String(body.mailboxEmail || '').trim().toLowerCase();
      const discovered = await discoverMailbox(mailboxEmail);
      return json({ discovered });
    }

    if (action === 'test') {
      const mailboxEmail = String(body.mailboxEmail || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!mailboxEmail || !password) {
        return json({ error: 'Podaj e-mail i hasło do skrzynki' }, 400);
      }
      const auto = await discoverMailbox(mailboxEmail);
      const discovered = discoveredFromBody(body, auto);
      const username = String(body.username || mailboxEmail).trim();
      const settings = settingsFromBody(mailboxEmail, username, discovered);
      const test = await testImapOnly(settings, password);
      if (test.error) {
        return json({
          ok: false,
          error: test.error,
          imapHost: discovered.imapHost,
          imapPort: discovered.imapPort,
          diagnostics: test.diagnostics,
        });
      }
      return json({
        ok: true,
        inboxTotal: test.inboxTotal,
        imapHost: discovered.imapHost,
        imapPort: discovered.imapPort,
        imapProfile: test.profile,
        discovered,
        diagnostics: test.diagnostics,
      });
    }

    if (action === 'connect') {
      const mailboxEmail = String(body.mailboxEmail || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!mailboxEmail || !password) {
        return json({ error: 'Podaj e-mail i hasło do skrzynki' }, 400);
      }
      const auto = await discoverMailbox(mailboxEmail);
      const discovered = discoveredFromBody(body, auto);
      const username = String(body.username || mailboxEmail).trim();
      const now = new Date().toISOString();

      const { error: setErr } = await admin.from('crm_mailbox_settings').upsert({
        user_id: user.id,
        mailbox_email: mailboxEmail,
        imap_host: discovered.imapHost,
        imap_port: discovered.imapPort,
        imap_secure: discovered.imapSecure,
        smtp_host: discovered.smtpHost,
        smtp_port: discovered.smtpPort,
        smtp_secure: discovered.smtpSecure,
        username,
        updated_at: now,
      });
      if (setErr) return json({ error: humanizeMailError(setErr.message) }, 500);

      const { error: credErr } = await admin.from('crm_mailbox_credentials').upsert({
        user_id: user.id,
        password,
        updated_at: now,
      });
      if (credErr) return json({ error: humanizeMailError(credErr.message) }, 500);

      const limit = Math.min(120, Math.max(25, Number(body.limit) || 50));
      const settings = settingsFromBody(mailboxEmail, username, discovered);
      const syncResult = await runImapSync(admin, user.id, settings, password, limit);
      if (syncResult.error && (syncResult.imported ?? 0) === 0) {
        return json({
          ok: false,
          configured: true,
          error: syncResult.error,
          imported: 0,
          inboxTotal: syncResult.inboxTotal ?? 0,
          discovered,
          hint:
            'Konto zapisane — uruchom sync na serwerze (npm run sync:crm-mail) lub Odśwież. Edge często nie ma pełnego IMAP.',
        });
      }
      return json({
        ok: true,
        imported: syncResult.imported ?? 0,
        inboxTotal: syncResult.inboxTotal ?? syncResult.imported,
        discovered,
        warning: syncResult.error,
      });
    }

    if (action === 'get_config') {
      const { error: schemaErr } = await admin.from('crm_mailbox_settings').select('user_id').limit(1);
      const schemaOk = !schemaErr || !/does not exist|schema cache/i.test(schemaErr.message);
      const { data: settings, error: setLoadErr } = await admin
        .from('crm_mailbox_settings')
        .select(
          'mailbox_email, imap_host, imap_port, imap_secure, smtp_host, smtp_port, smtp_secure, username, last_sync_at, last_sync_error',
        )
        .eq('user_id', user.id)
        .maybeSingle();
      if (setLoadErr && /does not exist|schema cache/i.test(setLoadErr.message)) {
        return json({
          settings: null,
          configured: false,
          schemaOk: false,
          hint: 'Uruchom migration-crm-mailbox.sql w Supabase SQL Editor.',
        });
      }
      return json({
        settings: settings ?? null,
        configured: Boolean(settings),
        schemaOk,
      });
    }

    async function loadMailbox() {
      const { data: settings, error: sErr } = await admin
        .from('crm_mailbox_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (sErr || !settings) {
        throw new Error('Najpierw skonfiguruj skrzynkę (IMAP/SMTP)');
      }
      const { data: creds, error: cErr } = await admin
        .from('crm_mailbox_credentials')
        .select('password')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cErr || !creds?.password) {
        throw new Error('Brak zapisanego hasła — ustaw ponownie');
      }
      return { settings, password: creds.password as string };
    }

    if (action === 'sync') {
      const limit = Math.min(120, Math.max(25, Number(body.limit) || 50));
      const { settings, password } = await loadMailbox();
      const syncResult = await runImapSync(
        admin,
        user.id,
        settings as MailboxSettingsRow,
        password,
        limit,
      );
      if (syncResult.error && (syncResult.imported ?? 0) === 0) {
        return json({
          ok: false,
          error: syncResult.error,
          imported: 0,
          inboxTotal: syncResult.inboxTotal,
          hint: 'Lista w aplikacji odświeża się z bazy — uruchom npm run sync:crm-mail na serwerze z IMAP.',
        });
      }
      return json({
        ok: true,
        imported: syncResult.imported ?? 0,
        inboxTotal: syncResult.inboxTotal,
        warning: syncResult.error,
      });
    }

    if (action === 'fetch_body') {
      const threadId = String(body.threadId || '');
      if (!threadId) return json({ error: 'Brak id wiadomości' }, 400);

      const { settings, password } = await loadMailbox();

      const { data: row, error: rowErr } = await admin
        .from('crm_inbox_sync')
        .select('payload')
        .eq('user_id', user.id)
        .eq('id', threadId)
        .maybeSingle();
      if (rowErr || !row?.payload) {
        return json({ error: 'Nie znaleziono wiadomości' }, 404);
      }

      const payload = row.payload as {
        body?: string;
        preview?: string;
        subject?: string;
        meta?: { imapUid?: number; bodyFetched?: boolean };
      };
      const imapUid = payload.meta?.imapUid;
      if (payload.meta?.bodyFetched && (payload.body || payload.bodyHtml)) {
        return json({
          ok: true,
          body: payload.body,
          bodyHtml: (payload as { bodyHtml?: string }).bodyHtml,
          preview: payload.preview ?? payload.body?.slice(0, 160),
        });
      }
      if (!imapUid) {
        return json({
          ok: true,
          body: payload.body || payload.subject || '',
          preview: payload.preview || payload.subject || '',
        });
      }

      const fetched = await fetchImapMessageBody(
        settings as MailboxSettingsRow,
        password,
        imapUid,
      );
      if ('error' in fetched) {
        return json({ error: fetched.error });
      }

      const nextPayload = {
        ...row.payload,
        body: fetched.body,
        preview: fetched.preview,
        bodyHtml: fetched.bodyHtml,
        meta: { ...payload.meta, bodyFetched: true },
      };
      await admin
        .from('crm_inbox_sync')
        .update({ payload: nextPayload })
        .eq('user_id', user.id)
        .eq('id', threadId);

      return json({
        ok: true,
        body: fetched.body,
        bodyHtml: fetched.bodyHtml,
        preview: fetched.preview,
      });
    }

    if (action === 'send') {
      const threadId = String(body.threadId || '');
      const replyBody = String(body.body || '').trim();
      if (!threadId || !replyBody) {
        return json({ error: 'Brak wątku lub treści' }, 400);
      }

      const { settings, password } = await loadMailbox();

      const { data: row, error: rowErr } = await admin
        .from('crm_inbox_sync')
        .select('payload')
        .eq('user_id', user.id)
        .eq('id', threadId)
        .maybeSingle();
      if (rowErr || !row?.payload) {
        return json({ error: 'Nie znaleziono wiadomości' }, 404);
      }

      const payload = row.payload as {
        subject?: string;
        meta?: { messageId?: string; replyTo?: string };
        from?: string;
      };
      const meta = payload.meta ?? {};
      const replyTo = extractEmailAddress(
        meta.replyTo || payload.from || '',
      );
      const subject = payload.subject?.startsWith('Re:')
        ? payload.subject
        : `Re: ${payload.subject || 'Wiadomość'}`;

      const transporter = nodemailer.createTransport(
        smtpTransportOptions(settings, password),
      );

      try {
        await transporter.sendMail({
          from: settings.mailbox_email,
          to: replyTo,
          subject,
          text: replyBody,
          inReplyTo: meta.messageId,
          references: meta.messageId,
        });
      } catch (sendErr) {
        const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
        const hint =
          /timeout|econnrefused|unexpected close|connection closed/i.test(msg)
            ? ' SMTP z chmury Supabase może być zablokowany — sprawdź port 465/587 u hostingu.'
            : '';
        return json({ error: humanizeMailError(msg) + hint });
      }

      const nextPayload = {
        ...row.payload,
        replied: true,
        unread: false,
      };
      await admin
        .from('crm_inbox_sync')
        .update({ payload: nextPayload })
        .eq('user_id', user.id)
        .eq('id', threadId);

      return json({ ok: true });
    }

    return json({ error: 'Nieznana action' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Błąd serwera';
    return json({ error: msg }, 500);
  }
});
