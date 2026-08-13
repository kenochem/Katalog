import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import {
  ACCOUNT_ROLES,
  ROLE_LABELS,
  type AccountRole,
} from '../lib/roles';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface AdminUserRow {
  id: string;
  email: string;
  display_name: string;
  role: AccountRole;
  active: boolean;
  created_at?: string;
}

async function callAdminUsers(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  if (!supabase) return { ok: false, error: 'Brak Supabase' };

  const { data, error } = await supabase.functions.invoke('admin-users', {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) {
    let detail = error.message || 'Błąd funkcji admin-users';
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const payload = (await ctx.json()) as { error?: string; msg?: string };
        if (payload?.error) detail = payload.error;
        else if (payload?.msg) detail = payload.msg;
      }
    } catch {
      /* ignore */
    }
    return { ok: false, error: detail };
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { ok: false, error: String((data as { error: string }).error) };
  }
  return { ok: true, data };
}

export function AdminUsersSection() {
  const { session } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AccountRole>('handlowiec');

  const token = session?.access_token;

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sessData } = await supabase.auth.getSession();
      const accessToken = sessData.session?.access_token || token;
      if (!accessToken) {
        setError('Brak sesji — zaloguj się ponownie');
        return;
      }
      const res = await callAdminUsers(accessToken, { action: 'list' });
      if (!res.ok) {
        const { data, error: qErr } = await supabase
          .from('profiles')
          .select('id, email, display_name, role, active, created_at')
          .order('created_at', { ascending: true });
        if (qErr) throw qErr;
        setUsers((data || []) as AdminUserRow[]);
        if (res.error) {
          setError(
            `Funkcja admin-users: ${res.error}. Lista z bazy OK — tworzenie kont wymaga działającej funkcji.`,
          );
        }
        return;
      }
      const list = (res.data as { users?: AdminUserRow[] })?.users;
      setUsers(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function freshToken(): Promise<string | null> {
    if (!supabase) return token || null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || token || null;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const accessToken = await freshToken();
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callAdminUsers(accessToken, {
        action: 'create',
        email: email.trim(),
        password,
        display_name: displayName.trim() || email.split('@')[0],
        role,
      });
      if (!res.ok) {
        setError(res.error || 'Nie utworzono użytkownika');
        return;
      }
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRole('handlowiec');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(
    id: string,
    patch: Partial<{ role: AccountRole; active: boolean; display_name: string }>,
  ) {
    const accessToken = await freshToken();
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callAdminUsers(accessToken, {
        action: 'update',
        id,
        ...patch,
      });
      if (!res.ok) {
        if (supabase && (patch.role || patch.active !== undefined || patch.display_name)) {
          const { error: uErr } = await supabase
            .from('profiles')
            .update({
              ...(patch.role ? { role: patch.role } : {}),
              ...(patch.active !== undefined ? { active: patch.active } : {}),
              ...(patch.display_name ? { display_name: patch.display_name } : {}),
            })
            .eq('id', id);
          if (uErr) {
            setError(uErr.message);
            return;
          }
        } else {
          setError(res.error || 'Aktualizacja nieudana');
          return;
        }
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(id: string, userEmail: string) {
    const accessToken = await freshToken();
    if (!accessToken) return;
    const suggested = `Tmp${Math.random().toString(36).slice(2, 8)}!a1`;
    const pwd = window.prompt(
      `Nowe hasło dla ${userEmail} (min. 8 znaków). Podaj własne albo zostaw propozycję:`,
      suggested,
    );
    if (!pwd) return;
    if (pwd.length < 8) {
      setError('Hasło musi mieć min. 8 znaków');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await callAdminUsers(accessToken, {
        action: 'resetPassword',
        id,
        password: pwd,
      });
      if (!res.ok) {
        setError(res.error || 'Nie udało się zmienić hasła');
        return;
      }
      window.alert(`Hasło ustawione dla ${userEmail}:\n\n${pwd}\n\nPrzekaż je użytkownikowi.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
      <form
        onSubmit={onCreate}
        className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Nowy użytkownik
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Imię / nazwa wyświetlana"
            className="input-field"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@kenochem.pl"
            className="input-field"
          />
          <input
            type="text"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Hasło tymczasowe (min. 8)"
            className="input-field"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AccountRole)}
            className="input-field"
          >
            {ACCOUNT_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white disabled:opacity-50 sm:w-auto sm:px-6"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          Utwórz konto
        </button>
      </form>

      {error && (
        <p className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
        </div>
      ) : (
        <ul className="grid gap-2 lg:grid-cols-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-slate-800 bg-slate-950/30 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">{u.display_name}</p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    u.active
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {u.active ? 'aktywny' : 'wyłączony'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  value={u.role}
                  disabled={busy}
                  onChange={(e) =>
                    void patchUser(u.id, { role: e.target.value as AccountRole })
                  }
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                >
                  {ACCOUNT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void patchUser(u.id, { active: !u.active })}
                  className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  {u.active ? 'Wyłącz' : 'Włącz'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void resetPassword(u.id, u.email)}
                  className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Reset hasła
                </button>
              </div>
            </li>
          ))}
          {users.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-500 lg:col-span-2">
              Brak użytkowników w profiles.
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
