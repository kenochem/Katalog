import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, Loader2, Mail, Plug, RefreshCw } from 'lucide-react';
import {
  connectCrmMailbox,
  DEFAULT_SYNC_LIMIT,
  fetchCrmMailboxConfig,
  formatCrmMailError,
  isCrmMailSchemaError,
  MAILBOX_PRESETS,
  syncCrmMailbox,
  testCrmMailboxConnection,
  type CrmMailboxSettingsPublic,
  type CrmMailboxServerInput,
  type MailboxPresetId,
} from '../../lib/crmMail';
import { phaseLabel, type MailboxConnectPhase } from '../../lib/crmMailValidation';
import { showToast } from '../../lib/toast';

interface CrmMailboxPanelProps {
  onSynced?: () => void;
}

const PRESET_ORDER: MailboxPresetId[] = [
  'webio',
  'zenbox',
  'microsoft',
  'gmail',
  'homepl',
  'custom',
];

function applyPreset(id: MailboxPresetId): CrmMailboxServerInput {
  const p = MAILBOX_PRESETS[id];
  return {
    imapHost: p.imapHost,
    imapPort: p.imapPort,
    smtpHost: p.smtpHost,
    smtpPort: p.smtpPort,
  };
}

function serversFromForm(
  imapHost: string,
  imapPort: string,
  smtpHost: string,
  smtpPort: string,
): CrmMailboxServerInput | null {
  if (!imapHost.trim() || !smtpHost.trim()) return null;
  return {
    imapHost: imapHost.trim(),
    imapPort: Number(imapPort) || 993,
    smtpHost: smtpHost.trim(),
    smtpPort: Number(smtpPort) || 465,
  };
}

export function CrmMailboxPanel({ onSynced }: CrmMailboxPanelProps) {
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<MailboxConnectPhase>('idle');
  const [syncing, setSyncing] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [settings, setSettings] = useState<CrmMailboxSettingsPublic | null>(null);
  const [schemaOk, setSchemaOk] = useState(true);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showServers, setShowServers] = useState(true);

  const [mailboxEmail, setMailboxEmail] = useState('');
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState(MAILBOX_PRESETS.webio.imapHost);
  const [imapPort, setImapPort] = useState(String(MAILBOX_PRESETS.webio.imapPort));
  const [smtpHost, setSmtpHost] = useState(MAILBOX_PRESETS.webio.smtpHost);
  const [smtpPort, setSmtpPort] = useState(String(MAILBOX_PRESETS.webio.smtpPort));
  const [preset, setPreset] = useState<MailboxPresetId>('webio');

  const busy = phase !== 'idle' || syncing;

  const servers = useMemo(
    () => serversFromForm(imapHost, imapPort, smtpHost, smtpPort),
    [imapHost, imapPort, smtpHost, smtpPort],
  );

  async function reloadConfig() {
    setPanelError(null);
    const res = await fetchCrmMailboxConfig();
    if (res.schemaOk === false) {
      setSchemaOk(false);
      setPanelError(
        'Brak tabel poczty w Supabase. Uruchom migration-crm-mailbox.sql w SQL Editor.',
      );
    } else {
      setSchemaOk(true);
    }
    if (res.hint && res.schemaOk === false) {
      setPanelError(res.hint);
    }
    setConfigured(res.configured);
    setSettings(res.settings);
    if (res.settings?.mailbox_email) setMailboxEmail(res.settings.mailbox_email);
    if (res.settings) {
      setImapHost(res.settings.imap_host);
      setImapPort(String(res.settings.imap_port));
      setSmtpHost(res.settings.smtp_host);
      setSmtpPort(String(res.settings.smtp_port));
    }
    if (res.settings?.last_sync_error) {
      setPanelError(formatCrmMailError(res.settings.last_sync_error));
    }
    return res;
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await reloadConfig();
      } catch (err) {
        const msg = formatCrmMailError(err instanceof Error ? err.message : 'Nie wczytano poczty');
        setPanelError(msg);
        if (isCrmMailSchemaError(err)) setSchemaOk(false);
        showToast(msg, 'warn', 7000);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function onPresetChange(id: MailboxPresetId) {
    setPreset(id);
    const next = applyPreset(id);
    setImapHost(next.imapHost);
    setImapPort(String(next.imapPort));
    setSmtpHost(next.smtpHost);
    setSmtpPort(String(next.smtpPort));
    setShowServers(true);
  }

function formatDiagnostics(d: unknown): string | null {
  if (!d || typeof d !== 'object') return null;
  const x = d as { tcp993?: boolean; tcp143?: boolean; attempts?: { profile: string; error?: string }[] };
  const lines: string[] = [];
  if (typeof x.tcp993 === 'boolean') {
    lines.push(`Port 993 (SSL): ${x.tcp993 ? 'otwarty z chmury' : 'zablokowany w Supabase'}`);
  }
  if (typeof x.tcp143 === 'boolean') {
    lines.push(`Port 143: ${x.tcp143 ? 'otwarty' : 'zablokowany'}`);
  }
  if (x.attempts?.length) {
    for (const a of x.attempts.slice(-3)) {
      lines.push(`${a.profile}: ${a.error?.slice(0, 120) || '—'}`);
    }
  }
  return lines.length ? lines.join(' · ') : null;
}

  async function runTest() {
    setPanelError(null);
    setPhase('validating');
    try {
      setPhase('testing');
      const res = await testCrmMailboxConnection(mailboxEmail, password, servers);
      showToast(
        `IMAP OK — ${res.inboxTotal} wiadomości (${res.imapHost}:${res.imapPort}).`,
        'ok',
        6000,
      );
    } catch (err) {
      const msg = formatCrmMailError(err instanceof Error ? err.message : 'Test nieudany');
      const diag =
        err instanceof Error && 'diagnostics' in err
          ? formatDiagnostics((err as Error & { diagnostics?: unknown }).diagnostics)
          : null;
      setPanelError(diag ? `${msg}\n${diag}` : msg);
      showToast(msg, 'error', 12000);
    } finally {
      setPhase('idle');
    }
  }

  async function connect() {
    setPanelError(null);
    setPhase('validating');
    try {
      setPhase('syncing');
      const res = await connectCrmMailbox(
        mailboxEmail,
        password,
        servers,
        DEFAULT_SYNC_LIMIT,
      );
      setPassword('');
      setConfigured(true);
      await reloadConfig();
      const total = res.inboxTotal ?? res.imported;
      showToast(
        `Połączono (${res.discovered.source}). Pobrano ${res.imported} z ${total} w skrzynce.`,
        'ok',
        6000,
      );
      onSynced?.();
    } catch (err) {
      const msg = formatCrmMailError(err instanceof Error ? err.message : 'Połączenie nieudane');
      setPanelError(msg);
      showToast(msg, 'error', 12000);
      try {
        await reloadConfig();
      } catch {
        /* ignore */
      }
    } finally {
      setPhase('idle');
    }
  }

  async function refresh() {
    setSyncing(true);
    setPanelError(null);
    try {
      const n = await syncCrmMailbox(DEFAULT_SYNC_LIMIT);
      await reloadConfig();
      showToast(
        n > 0
          ? `Sync z chmury: ${n} nagłówków`
          : 'Sync z chmury: brak nowych — lista wczytana z bazy (sync serwera co 5 min)',
        'ok',
        6000,
      );
    } catch (err) {
      const msg = formatCrmMailError(err instanceof Error ? err.message : 'Sync nieudany');
      setPanelError(msg);
      showToast(
        `${msg} — wczytuję listę z bazy (nowe maile mogą wymagać sync:crm-mail na serwerze).`,
        'warn',
        12000,
      );
    } finally {
      setSyncing(false);
      onSynced?.();
    }
  }

  const serverFields = (
    <div className="mt-3 grid gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:max-w-lg">
          <p className="text-xs text-slate-500">
            Webio: IMAP 993, SMTP 465. Jeśli Test IMAP pada w chmurze, użyj skryptu{' '}
            <code className="font-mono text-[10px]">scripts/crm-mail-pull.mjs</code> na serwerze
            z dostępem do poczty.
          </p>
      <label className="block">
        <span className="text-xs text-slate-500">Hosting poczty</span>
        <select
          value={preset}
          onChange={(e) => onPresetChange(e.target.value as MailboxPresetId)}
          className="input-field mt-1"
          disabled={busy}
        >
          {PRESET_ORDER.map((id) => (
            <option key={id} value={id}>
              {MAILBOX_PRESETS[id].label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-xs text-slate-500">Serwer IMAP</span>
          <input
            type="text"
            value={imapHost}
            onChange={(e) => setImapHost(e.target.value)}
            className="input-field mt-1 font-mono text-sm"
            disabled={busy}
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Port IMAP</span>
          <input
            type="number"
            value={imapPort}
            onChange={(e) => setImapPort(e.target.value)}
            className="input-field mt-1 font-mono text-sm"
            disabled={busy}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-slate-500">Serwer SMTP</span>
          <input
            type="text"
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            className="input-field mt-1 font-mono text-sm"
            disabled={busy}
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">Port SMTP</span>
          <input
            type="number"
            value={smtpPort}
            onChange={(e) => setSmtpPort(e.target.value)}
            className="input-field mt-1 font-mono text-sm"
            disabled={busy}
          />
        </label>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ładowanie poczty…
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      {!schemaOk && (
        <div className="mb-3 flex gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Brak tabel poczty w Supabase — w Dashboard → SQL uruchom{' '}
          <code className="font-mono">migration-crm-mailbox.sql</code>, potem odśwież stronę.
        </div>
      )}

      {panelError && (
        <div className="mb-3 flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs whitespace-pre-wrap text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {panelError}
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Mail className="h-4 w-4 text-brand-400" />
          {configured ? settings?.mailbox_email : 'Podłącz skrzynkę e-mail'}
        </h3>
        {configured && settings && (
          <span className="font-mono text-[10px] text-slate-500">
            IMAP {settings.imap_host}:{settings.imap_port} · SMTP {settings.smtp_host}:
            {settings.smtp_port}
          </span>
        )}
      </div>

      {!configured ? (
        <div className="grid gap-3 sm:max-w-lg">
          <p className="text-xs text-slate-500">
            Inna skrzynka? „Zmień konto / hasło / serwery” — jedno konto na login CRM
            (np. handel@ → potem biuro@ zastępuje poprzednie). Auto-sync: Harmonogram
            co 5 min — scripts/install-crm-mail-sync.ps1 (jako admin).
          </p>
          <label className="block">
            <span className="text-xs text-slate-500">Adres e-mail</span>
            <input
              type="email"
              value={mailboxEmail}
              onChange={(e) => setMailboxEmail(e.target.value)}
              className="input-field mt-1"
              placeholder="biuro@firma.pl"
              autoComplete="username"
              disabled={busy}
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Hasło skrzynki</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field mt-1"
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          <button
            type="button"
            onClick={() => setShowServers((v) => !v)}
            className="flex items-center gap-1 text-left text-xs text-brand-300 hover:text-brand-200"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${showServers ? 'rotate-180' : ''}`}
            />
            Serwery IMAP / SMTP
          </button>
          {showServers && serverFields}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !password}
              onClick={() => void runTest()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {phase === 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plug className="h-4 w-4" />
              )}
              Test IMAP
            </button>
            <button
              type="button"
              disabled={busy || !password}
              onClick={() => void connect()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {phase !== 'idle' && phase !== 'testing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {phaseLabel(phase) || 'Połącz i pobierz pocztę'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Odśwież skrzynkę
            </button>
          </div>
      {configured && settings?.last_sync_at && (
        <p className="mt-2 text-[11px] text-emerald-400/90">
          Ostatni sync: {new Date(settings.last_sync_at).toLocaleString('pl-PL')}. Nowe wiadomości
          na bieżąco: Harmonogram Windows +{' '}
          <code className="font-mono text-[10px]">npm run sync:crm-mail</code> (incremental po UID).
        </p>
      )}

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${showAdvanced ? 'rotate-180' : ''}`}
            />
            Zmień konto / hasło / serwery
          </button>
          {showAdvanced && (
            <div className="mt-2 grid gap-2 border-t border-slate-800 pt-3">
              <input
                type="email"
                value={mailboxEmail}
                onChange={(e) => setMailboxEmail(e.target.value)}
                className="input-field"
                disabled={busy}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Nowe hasło"
                disabled={busy}
              />
              {serverFields}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || !password}
                  onClick={() => void runTest()}
                  className="rounded-xl border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
                >
                  Test IMAP
                </button>
                <button
                  type="button"
                  disabled={busy || !password}
                  onClick={() => void connect()}
                  className="rounded-xl border border-brand-500/50 px-3 py-2 text-sm text-brand-200 disabled:opacity-50"
                >
                  Zapisz i synchronizuj
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
