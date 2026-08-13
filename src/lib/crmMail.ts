import { supabase, isSupabaseConfigured } from './supabase';
import type { CrmInboxThread } from './crmInbox';
import {
  formatCrmMailError,
  normalizeMailboxEmail,
  validateImapSmtpHosts,
  validateMailPort,
  validateMailboxEmail,
  validateMailboxPassword,
} from './crmMailValidation';

export interface CrmMailboxSettingsPublic {
  mailbox_email: string;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  username: string;
  last_sync_at: string | null;
  last_sync_error: string | null;
}

export type MailboxPresetId =
  | 'custom'
  | 'webio'
  | 'zenbox'
  | 'gmail'
  | 'microsoft'
  | 'homepl';

export const MAILBOX_PRESETS: Record<
  MailboxPresetId,
  { label: string; imapHost: string; imapPort: number; smtpHost: string; smtpPort: number }
> = {
  custom: {
    label: 'Wpisz ręcznie',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 587,
  },
  webio: {
    label: 'Webio (poczta.webio.pl)',
    imapHost: 'imap.webio.pl',
    imapPort: 993,
    smtpHost: 'smtp.webio.pl',
    smtpPort: 465,
  },
  zenbox: {
    label: 'Zenbox',
    imapHost: 'imap.zenbox.pl',
    imapPort: 993,
    smtpHost: 'smtp.zenbox.pl',
    smtpPort: 587,
  },
  gmail: {
    label: 'Gmail / Google Workspace',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
  },
  microsoft: {
    label: 'Microsoft 365 / Outlook',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
  },
  homepl: {
    label: 'home.pl (typowe)',
    imapHost: 'imap.home.pl',
    imapPort: 993,
    smtpHost: 'smtp.home.pl',
    smtpPort: 465,
  },
};

export const DEFAULT_SYNC_LIMIT = 50;
export const MAX_SYNC_LIMIT = 120;
export const CRM_INBOX_LIST_LIMIT = 500;

type InvokePayload = { error?: string; ok?: boolean; hint?: string; diagnostics?: unknown };

function errorFromPayload(payload: InvokePayload): string | null {
  if (payload.error) return payload.error;
  if (payload.ok === false && payload.error) return payload.error;
  return null;
}

async function readErrorBody(context: Response): Promise<string | null> {
  try {
    const text = await context.text();
    if (!text) return null;
    try {
      const j = JSON.parse(text) as InvokePayload;
      if (j.error) return j.error;
      if (j.hint) return j.hint;
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return null;
  }
  return null;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(formatCrmMailError('Brak połączenia z Supabase'));
  }
  const { data, error } = await supabase.functions.invoke('crm-mail', { body });
  const payload = (data ?? {}) as InvokePayload & T;

  const directErr = errorFromPayload(payload);
  if (directErr) {
    const hint = payload.hint ? ` ${payload.hint}` : '';
    const err = new Error(formatCrmMailError(directErr + hint)) as Error & {
      diagnostics?: unknown;
    };
    if (payload.diagnostics) err.diagnostics = payload.diagnostics;
    throw err;
  }

  if (error) {
    const err = error as { message?: string; context?: Response };
    if (err.context) {
      const fromBody = await readErrorBody(err.context);
      if (fromBody) throw new Error(formatCrmMailError(fromBody));
    }
    throw new Error(formatCrmMailError(err.message || 'Błąd poczty (crm-mail)'));
  }

  return payload as T;
}

export interface DiscoveredMailbox {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  source: string;
}

export interface CrmMailboxServerInput {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  username?: string;
}

export function validateConnectForm(
  email: string,
  password: string,
  servers?: CrmMailboxServerInput | null,
): string | null {
  const e1 = validateMailboxEmail(email);
  if (e1) return e1;
  const e2 = validateMailboxPassword(password);
  if (e2) return e2;
  if (servers) {
    const e3 = validateImapSmtpHosts(servers.imapHost, servers.smtpHost);
    if (e3) return e3;
    const e4 = validateMailPort(servers.imapPort, 'IMAP');
    if (e4) return e4;
    const e5 = validateMailPort(servers.smtpPort, 'SMTP');
    if (e5) return e5;
  }
  return null;
}

function connectBody(
  mailboxEmail: string,
  password: string,
  limit: number,
  servers?: CrmMailboxServerInput | null,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    action: 'connect',
    mailboxEmail: normalizeMailboxEmail(mailboxEmail),
    password,
    limit,
  };
  if (servers?.imapHost?.trim() && servers?.smtpHost?.trim()) {
    body.imapHost = servers.imapHost.trim();
    body.imapPort = servers.imapPort || 993;
    body.smtpHost = servers.smtpHost.trim();
    body.smtpPort = servers.smtpPort || 465;
    body.imapSecure = true;
    body.smtpSecure = (servers.smtpPort || 465) === 465;
    if (servers.username?.trim()) body.username = servers.username.trim();
  }
  return body;
}

export async function testCrmMailboxConnection(
  mailboxEmail: string,
  password: string,
  servers?: CrmMailboxServerInput | null,
): Promise<{ inboxTotal: number; imapHost: string; imapPort: number }> {
  const err = validateConnectForm(mailboxEmail, password, servers ?? undefined);
  if (err) throw new Error(err);
  const body = connectBody(mailboxEmail, password, 1, servers);
  body.action = 'test';
  return invoke(body);
}

export async function connectCrmMailbox(
  mailboxEmail: string,
  password: string,
  servers?: CrmMailboxServerInput | null,
  limit = DEFAULT_SYNC_LIMIT,
): Promise<{
  imported: number;
  discovered: DiscoveredMailbox;
  inboxTotal?: number;
}> {
  const err = validateConnectForm(mailboxEmail, password, servers ?? undefined);
  if (err) throw new Error(err);
  return invoke(connectBody(mailboxEmail, password, limit, servers));
}

/** @deprecated Użyj connectCrmMailbox z servers — jedno wywołanie Edge. */
export async function connectCrmMailboxManual(
  mailboxEmail: string,
  password: string,
  servers: CrmMailboxServerInput,
): Promise<{ imported: number }> {
  const res = await connectCrmMailbox(mailboxEmail, password, servers);
  return { imported: res.imported };
}

export async function fetchCrmMailboxConfig(): Promise<{
  configured: boolean;
  settings: CrmMailboxSettingsPublic | null;
  schemaOk?: boolean;
  hint?: string;
}> {
  return invoke({ action: 'get_config' });
}

export async function saveCrmMailboxConfig(input: {
  mailboxEmail: string;
  username?: string;
  password?: string;
  imapHost: string;
  imapPort: number;
  imapSecure?: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure?: boolean;
}): Promise<void> {
  await invoke({ action: 'save_config', ...input });
}

export async function syncCrmMailbox(limit = DEFAULT_SYNC_LIMIT): Promise<number> {
  const res = await invoke<{ imported: number }>({
    action: 'sync',
    limit: Math.min(MAX_SYNC_LIMIT, limit),
  });
  return res.imported ?? 0;
}

export async function fetchCrmMailBody(
  threadId: string,
): Promise<{ body: string; preview: string; bodyHtml?: string }> {
  return invoke({ action: 'fetch_body', threadId });
}

export async function sendCrmMailReply(
  threadId: string,
  body: string,
): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error('Wpisz treść odpowiedzi');
  if (!threadId) throw new Error('Brak wiadomości do odpowiedzi');
  await invoke({ action: 'send', threadId, body: text });
}

export async function fetchCrmInboxUnreadCount(): Promise<number> {
  const threads = await fetchCrmInboxFromCloud();
  return threads.filter((t) => t.unread).length;
}

export async function fetchCrmInboxFromCloud(): Promise<CrmInboxThread[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from('crm_inbox_sync')
    .select('payload, received_at')
    .eq('user_id', user.id)
    .order('received_at', { ascending: false })
    .limit(CRM_INBOX_LIST_LIMIT);
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) {
      throw new Error(formatCrmMailError(error.message));
    }
    throw new Error(formatCrmMailError(error.message));
  }
  return (data ?? []).map((row) => {
    const p = row.payload as CrmInboxThread;
    return {
      ...p,
      channel: 'email',
      channelLabel: p.channelLabel || 'E-mail',
    };
  });
}

export async function patchCrmInboxThread(
  threadId: string,
  patch: Partial<CrmInboxThread>,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Zaloguj się');

  const { data, error: fetchErr } = await supabase
    .from('crm_inbox_sync')
    .select('payload')
    .eq('user_id', user.id)
    .eq('id', threadId)
    .maybeSingle();
  if (fetchErr) throw new Error(formatCrmMailError(fetchErr.message));
  if (!data?.payload) throw new Error('Nie znaleziono wiadomości');
  const next = { ...(data.payload as CrmInboxThread), ...patch };
  const { error: upErr } = await supabase
    .from('crm_inbox_sync')
    .update({ payload: next })
    .eq('user_id', user.id)
    .eq('id', threadId);
  if (upErr) throw new Error(formatCrmMailError(upErr.message));
}

export function isCloudCrmMailThread(id: string): boolean {
  return id.startsWith('email-');
}

export function isCrmMailSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return /migration-crm-mailbox|crm_inbox_sync|crm_mailbox|tabel poczty/i.test(msg);
}

export { formatCrmMailError };
