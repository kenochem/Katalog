/** Walidacja i czytelne komunikaty poczty CRM. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMailboxEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateMailboxEmail(email: string): string | null {
  const e = normalizeMailboxEmail(email);
  if (!e) return 'Podaj adres e-mail skrzynki';
  if (!EMAIL_RE.test(e)) return 'Niepoprawny format adresu e-mail';
  return null;
}

export function validateMailboxPassword(password: string): string | null {
  if (!password) return 'Podaj hasło do skrzynki';
  if (password.length < 4) return 'Hasło jest za krótkie';
  return null;
}

export function validateMailPort(port: number, label: string): string | null {
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return `${label}: port musi być między 1 a 65535`;
  }
  return null;
}

export function validateImapSmtpHosts(imapHost: string, smtpHost: string): string | null {
  if (!imapHost.trim()) return 'Podaj serwer IMAP (np. imap.webio.pl)';
  if (!smtpHost.trim()) return 'Podaj serwer SMTP (np. smtp.webio.pl)';
  return null;
}

export function formatCrmMailError(raw: string): string {
  const m = raw.trim();
  const lower = m.toLowerCase();

  if (/does not exist|schema cache|crm_inbox_sync|crm_mailbox/.test(lower)) {
    return 'Brak tabel poczty w Supabase — uruchom plik migration-crm-mailbox.sql w SQL Editor.';
  }
  if (/brak uprawnień|403|forbidden/.test(lower)) {
    return 'Brak uprawnień do poczty CRM. Zaloguj się jako admin, operator lub handlowiec.';
  }
  if (/nieautoryzowany|401|invalid jwt|jwt expired/.test(lower)) {
    return 'Sesja wygasła — wyloguj się i zaloguj ponownie.';
  }
  if (/invalid credentials|authentication failed|auth.*fail|login fail|no permission|incorrect password/.test(lower)) {
    return 'Błędny e-mail lub hasło skrzynki. Sprawdź logowanie w Webmail / Outlook.';
  }
  if (/certificate|self signed|tls|ssl|handshake/.test(lower)) {
    return 'Błąd szyfrowania SSL/TLS — sprawdź porty (Webio: IMAP 993, SMTP 465).';
  }
  if (/timeout|timed out|deadline|etimedout|econnrefused|enotfound|getaddrinfo|network/.test(lower)) {
    return 'Serwer poczty nie odpowiada — sprawdź host IMAP/SMTP i połączenie sieci.';
  }
  if (/unexpected close|connection closed|connection ended|econnreset/.test(lower)) {
    return 'Serwer poczty zakończył połączenie podczas pobierania — kliknij „Odśwież pocztę”.';
  }
  if (/edge function returned|non-2xx|failed to send|functionshttperror|command failed/.test(lower)) {
    return 'Błąd funkcji poczty na Supabase — spróbuj ponownie za chwilę. Jeśli trwa długo, zmniejsz liczbę pobieranych wiadomości (Odśwież).';
  }
  if (/najpierw skonfiguruj|brak zapisanego hasła/.test(lower)) {
    return m;
  }

  return m.length > 280 ? `${m.slice(0, 277)}…` : m;
}

export type MailboxConnectPhase =
  | 'idle'
  | 'validating'
  | 'testing'
  | 'saving'
  | 'syncing';

export function phaseLabel(phase: MailboxConnectPhase): string {
  switch (phase) {
    case 'validating':
      return 'Sprawdzam dane…';
    case 'testing':
      return 'Testuję logowanie IMAP…';
    case 'saving':
      return 'Zapisuję konto…';
    case 'syncing':
      return 'Pobieram wiadomości…';
    default:
      return '';
  }
}
