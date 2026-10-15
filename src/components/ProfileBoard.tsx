import { useEffect, useState } from 'react';
import { Loader2, Trophy } from 'lucide-react';
import { fetchLeaderboard, type BoardPeriod, type BoardRow } from '../lib/leaderboard';
import { levelFromXp } from '../lib/profileStats';
import { useUserAvatar } from '../lib/useUserAvatar';
import { UserAvatar } from './UserAvatar';
import { AvatarFrame } from './ProfileCosmetics';

const ACCENT_HEX: Record<string, string> = {
  sky: '#0ea5e9',
  emerald: '#10b981',
  violet: '#8b5cf6',
  rose: '#f43f5e',
  amber: '#f59e0b',
  teal: '#14b8a6',
  orange: '#f97316',
  slate: '#94a3b8',
};

const PERIODS: { id: BoardPeriod; label: string }[] = [
  { id: 'week', label: 'Ten tydzień' },
  { id: 'month', label: 'Ten miesiąc' },
  { id: 'all', label: 'Cały czas' },
];

const PLACE_COLOR = ['#facc15', '#cbd5e1', '#d6874a'];

function Row({ row, place, me, maxXp }: { row: BoardRow; place: number; me: boolean; maxXp: number }) {
  const avatar = useUserAvatar(row.userId);
  const level = levelFromXp(row.xpTotal);
  const accent = ACCENT_HEX[row.profile.accent ?? 'sky'] ?? ACCENT_HEX.sky;
  const placeColor = place <= 3 && row.xpPeriod > 0 ? PLACE_COLOR[place - 1] : undefined;
  return (
    <li
      className={`flex items-center gap-3 px-3 py-2.5 ${me ? 'bg-slate-800/70' : ''}`}
      style={me ? { boxShadow: `inset 3px 0 0 ${accent}` } : undefined}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums"
        style={{ background: placeColor ?? '#1e293b', color: placeColor ? '#0f172a' : '#94a3b8' }}
      >
        {place}
      </span>
      <AvatarFrame frame={row.profile.frame ?? 'classic'} accent={accent} small>
        <UserAvatar name={row.name || '?'} src={avatar} size="sm" />
      </AvatarFrame>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-100">
          <span className="truncate">{row.name || 'Użytkownik'}</span>
          {me && <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">TY</span>}
        </p>
        <p className="truncate text-[11px] text-slate-400">
          <span className="font-semibold" style={{ color: level.rank.color }}>
            Poz. {level.level} · {level.rank.name}
          </span>
          {row.profile.motto ? <span className="italic text-slate-500"> — „{row.profile.motto}”</span> : null}
        </p>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full" style={{ width: `${maxXp ? Math.round((row.xpPeriod / maxXp) * 100) : 0}%`, background: accent }} />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-bold tabular-nums text-slate-50">{row.xpPeriod.toLocaleString('pl-PL')}</p>
        <p className="text-[10px] text-slate-500">
          pkt · {row.actionsPeriod} dział.
        </p>
      </div>
    </li>
  );
}

/** Ranking pracowników: punkty pracy w wybranym okresie (z funkcji catalog_leaderboard). */
export function BoardPanel({ meId, card }: { meId: string | undefined; card: string }) {
  const [period, setPeriod] = useState<BoardPeriod>('week');
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    void fetchLeaderboard(period).then((r) => {
      if (cancelled) return;
      setMissing(r.missing);
      setRows(r.rows);
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const sorted = rows ? [...rows].sort((a, b) => b.xpPeriod - a.xpPeriod || b.xpTotal - a.xpTotal) : [];
  const maxXp = Math.max(0, ...sorted.map((r) => r.xpPeriod));
  const me = sorted.find((r) => r.userId === meId);
  const myPlace = me ? sorted.indexOf(me) + 1 : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1 text-xs">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-lg px-3 py-1.5 font-medium ${period === p.id ? 'bg-slate-700 text-slate-50' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {me && (
          <p className="flex items-center gap-1.5 text-xs text-slate-300">
            <Trophy className="h-4 w-4 text-amber-300" />
            Twoje miejsce: <b className="text-slate-50">{myPlace}</b> z {sorted.length}
          </p>
        )}
      </div>

      {missing ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Ranking wymaga migracji migration-catalog-leaderboard.sql w Supabase.
        </p>
      ) : rows === null ? (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-xl border border-slate-800 px-4 py-8 text-center text-sm text-slate-500">Brak danych do rankingu.</p>
      ) : (
        <ul className={`${card} divide-y divide-slate-800 !p-0 overflow-hidden`}>
          {sorted.map((r, i) => (
            <Row key={r.userId} row={r} place={i + 1} me={r.userId === meId} maxXp={maxXp} />
          ))}
        </ul>
      )}
      <p className="text-[11px] text-slate-500">
        Ranking liczy punkty pracy w katalogu (1 pkt za zmianę, operacje zbiorcze max 25 pkt). Okres „Ten tydzień” zaczyna się w poniedziałek.
        Jeśli nie chcesz być widoczny dla innych, włącz „Ukryj mnie w rankingu” w Ustawieniach.
      </p>
    </div>
  );
}
