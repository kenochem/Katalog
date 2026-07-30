import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader2, UserPlus, X, Shield } from 'lucide-react';
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
    return {
      ok: false,
      error: error.message || 'Błąd funkcji admin-users',
    };
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    return { ok: false, error: String((data as { error: string }).error) };
  }
  return { ok: true, data };
}

interface AdminUsersPanelProps {
  onClose: () => void;
}

export function AdminUsersPanel({ onClose }: AdminUsersPanelProps) {
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
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callAdminUsers(token, { action: 'list' });
      if (!res.ok) {
        // Fallback: bezpośredni SELECT (RLS admin)
        if (supabase) {
          const { data, error: qErr } = await supabase
            .from('profiles')
            .select('id, email, display_name, role, active, created_at')
            .order('created_at', { ascending: true });
          if (qErr) throw qErr;
          setUsers((data || []) as AdminUserRow[]);
          if (res.error) {
            setError(
              `Edge Function niedostępna (${res.error}). Lista z bazy OK — tworzenie kont wymaga deploy funkcji admin-users.`,
            );
          }
        } else {
          setError(res.error || 'Nie udało się pobrać użytkowników');
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callAdminUsers(token, {
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
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callAdminUsers(token, {
        action: 'update',
        id,
        ...patch,
      });
      if (!res.ok) {
        // Fallback update przez RLS
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

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-700 bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-400" />
            <h2 className="font-semibold text-slate-100">Użytkownicy</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <form onSubmit={onCreate} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Nowy użytkownik
            </p>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Imię / wyświetlana nazwa (np. Piotr)"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@kenochem.pl"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
            />
            <input
              type="text"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Hasło tymczasowe (min. 8)"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-brand-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AccountRole)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none"
            >
              {ACCOUNT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
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
            <ul className="space-y-2">
              {users.map((u) => (
                <li
                  key={u.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/30 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100">
                        {u.display_name}
                      </p>
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
                        void patchUser(u.id, {
                          role: e.target.value as AccountRole,
                        })
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
                      onClick={() =>
                        void patchUser(u.id, { active: !u.active })
                      }
                      className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      {u.active ? 'Wyłącz' : 'Włącz'}
                    </button>
                  </div>
                </li>
              ))}
              {users.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-500">
                  Brak użytkowników w profiles.
                </p>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
