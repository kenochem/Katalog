import type { CSSProperties } from 'react';
import { Lock } from 'lucide-react';
import { MAX_LEVEL, RANKS, xpForLevel, type LevelInfo } from '../lib/profileStats';
import type { AchievementState } from '../lib/achievements';
import {
  ALL_COSMETICS,
  BACKGROUNDS,
  FRAMES,
  OVERLAYS,
  isUnlocked,
  requirementText,
  type Cosmetic,
  type CosmeticKind,
} from '../lib/profileCosmetics';
import { AvatarFrame, ProfileBanner } from './ProfileCosmetics';

interface Props {
  level: LevelInfo;
  states: AchievementState[];
  accent: string;
  frame: string;
  bg: string;
  overlay: string;
  onPick: (kind: CosmeticKind, id: string) => void;
  card: string;
  ready: boolean;
}

function Preview({ c, accent }: { c: Cosmetic; accent: string }) {
  if (c.kind === 'frame') {
    return (
      <AvatarFrame frame={c.id} accent={accent} small>
        <span
          style={{
            display: 'flex',
            width: 44,
            height: 44,
            borderRadius: 9999,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg,#334155,#1e293b)',
            color: '#e2e8f0',
            font: '700 14px sans-serif',
          }}
        >
          KB
        </span>
      </AvatarFrame>
    );
  }
  if (c.kind === 'bg') {
    return (
      <ProfileBanner bg={c.id} accent={accent} className="w-full rounded-lg">
        <div style={{ height: 56 }} />
      </ProfileBanner>
    );
  }
  return (
    <ProfileBanner bg="graphite" overlay={c.id} accent={accent} className="w-full rounded-lg">
      <div style={{ height: 56 }} />
    </ProfileBanner>
  );
}

/** Poziomy i rangi + wybór ramki, tła i nakładki profilu. */
export function LevelsPanel({ level, states, accent, frame, bg, overlay, onPick, card, ready }: Props) {
  const nextReward = ALL_COSMETICS.filter((c) => c.req.type === 'level' && c.req.level > level.level).sort(
    (a, b) => (a.req.type === 'level' ? a.req.level : 0) - (b.req.type === 'level' ? b.req.level : 0),
  )[0];
  const rewardsIn = (from: number, to: number) =>
    ALL_COSMETICS.filter((c) => c.req.type === 'level' && c.req.level >= from && c.req.level <= to && c.req.level > 1).length;

  const sections: { title: string; kind: CosmeticKind; list: Cosmetic[]; current: string }[] = [
    { title: 'Ramki avatara', kind: 'frame', list: FRAMES, current: frame },
    { title: 'Tła nagłówka', kind: 'bg', list: BACKGROUNDS, current: bg },
    { title: 'Nakładki', kind: 'overlay', list: OVERLAYS, current: overlay },
  ];

  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Twój poziom</p>
            <p className="text-4xl font-black tabular-nums text-slate-50">
              {level.level}
              <span className="rank-text ml-2 text-lg font-bold" style={{ '--c-light': level.rank.textLight, '--c-dark': level.rank.color } as CSSProperties}>
                {level.rank.name}
              </span>
            </p>
            <p className="text-xs text-slate-400">
              {level.rank.tagline} · poziom {level.levelInRank}/{level.rank.to - level.rank.from + 1} w tej randze
            </p>
          </div>
          <div className="min-w-[14rem] flex-1 sm:max-w-sm">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${level.maxed ? 100 : Math.round((level.xpIntoLevel / level.xpForNext) * 100)}%`,
                  background: level.rank.color,
                }}
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {level.maxed
                ? 'Maksymalny poziom osiągnięty!'
                : `${level.xpIntoLevel} / ${level.xpForNext} pkt do poziomu ${level.level + 1}`}
              {nextReward?.req.type === 'level' && (
                <>
                  {' '}
                  · następna nagroda: <b className="text-slate-200">{nextReward.name}</b> (poz. {nextReward.req.level})
                </>
              )}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Punkty zdobywasz za pracę w katalogu: 1 pkt za zmianę, a za operacje zbiorcze (np. zatwierdzenie wielu opisów naraz) maksymalnie 25 pkt
          za jedną operację — liczy się regularna praca, nie jedno kliknięcie. Poziomy rosną coraz wolniej: poziom 20 to ok.{' '}
          {xpForLevel(20).toLocaleString('pl-PL')} pkt, 60 — {xpForLevel(60).toLocaleString('pl-PL')}, 100 — {xpForLevel(100).toLocaleString('pl-PL')}.
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Rangi</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RANKS.map((r) => {
            const reached = level.level >= r.from;
            const current = level.level >= r.from && level.level <= r.to;
            const span = r.to - r.from + 1;
            const pct = current ? Math.round((level.levelInRank / span) * 100) : reached ? 100 : 0;
            return (
              <div
                key={r.id}
                className={`${card} ${reached ? '' : 'opacity-55'}`}
                style={current ? { borderColor: r.color, boxShadow: `0 0 0 1px ${r.color}55` } : undefined}
              >
                <div className="flex items-center justify-between">
                  <p className="rank-text text-sm font-bold" style={{ '--c-light': reached ? r.textLight : '#64748b', '--c-dark': reached ? r.color : '#64748b' } as CSSProperties}>
                    {r.name}
                  </p>
                  {!reached && <Lock className="h-3.5 w-3.5 text-slate-500" />}
                  {current && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#0b1220]" style={{ background: r.color }}>

                      TY
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  poziomy {r.from}–{r.to > MAX_LEVEL ? MAX_LEVEL : r.to} · od {xpForLevel(r.from).toLocaleString('pl-PL')} pkt
                </p>
                <p className="mt-1 text-[11px] text-slate-500">{r.tagline}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                </div>
                <p className="mt-1 text-[10px] text-slate-500">nagród w tej randze: {rewardsIn(r.from, r.to)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {sections.map((sec) => (
        <div key={sec.kind}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{sec.title}</h3>
          <div className={`grid gap-3 ${sec.kind === 'frame' ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
            {sec.list.map((c) => {
              const open = !ready ? c.req.type === 'level' && c.req.level <= 1 : isUnlocked(c, level.level, states);
              const active = sec.current === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!open}
                  onClick={() => onPick(sec.kind, c.id)}
                  title={open ? c.desc : `${c.desc} — odblokujesz: ${requirementText(c)}`}
                  className={`relative flex flex-col items-center gap-2 rounded-2xl border p-2.5 text-center transition ${
                    active ? 'border-white bg-slate-800' : 'border-slate-800 bg-slate-900/50 hover:bg-slate-800/60'
                  } ${open ? '' : 'cursor-not-allowed'}`}
                >
                  <div className={`flex w-full justify-center ${open ? '' : 'opacity-35 grayscale'}`}>
                    <Preview c={c} accent={accent} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-100">
                      {c.name}
                      {c.animated && <span className="ml-1 text-[9px] font-bold text-sky-300">ANIM.</span>}
                    </p>
                    <p className="text-[10px] text-slate-500">{open ? (active ? 'Wybrane' : c.desc) : requirementText(c)}</p>
                  </div>
                  {!open && <Lock className="absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
