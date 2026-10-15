import { useEffect, useState } from 'react';
import { Check, Lock, Pin, PinOff, X } from 'lucide-react';
import {
  TIER_NAMES,
  type AchievementState,
  type Tier,
} from '../lib/achievements';
import { ACH_ICON, BadgeMedal, TIER_PALETTE, tierTextStyle } from './BadgeMedal';

function fmtDate(key: string | null | undefined): string {
  if (!key) return '';
  return new Date(key + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Szczegóły odznaki: duży medal, opis, lista stopni z datami zdobycia i postęp. */
export function AchievementModal({
  state,
  dates,
  pinned,
  onTogglePin,
  onClose,
}: {
  state: AchievementState;
  dates: (string | null)[];
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
}) {
  const { def } = state;
  const Icon = ACH_ICON[def.icon];
  const p = TIER_PALETTE[state.tier];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative flex flex-col items-center px-5 pb-4 pt-6"
          style={{ background: `radial-gradient(circle at 50% 30%, ${p.glow}, transparent 70%)` }}
        >
          <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
          <BadgeMedal tier={state.tier} icon={<Icon strokeWidth={1.7} />} size={132} />
          <h3 className="mt-3 text-xl font-bold text-slate-50">{def.name}</h3>
          <p className="mt-0.5 text-center text-sm text-slate-300">{def.desc.replace('{n}', String(state.next ?? def.tiers[3]))}</p>
          <p className="tier-text mt-1 text-xs font-semibold" style={tierTextStyle(state.tier)}>
            {TIER_NAMES[state.tier]}
          </p>
          <div className="mt-3 w-full max-w-xs">
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full" style={{ width: `${Math.round(state.progress * 100)}%`, background: state.tier ? p.star : '#475569' }} />
            </div>
            <p className="mt-1 text-center text-[11px] text-slate-400">
              {state.value} {state.next ? `/ ${state.next} do stopnia „${TIER_NAMES[(state.tier + 1) as Tier]}”` : '— maksymalny stopień!'}
            </p>
          </div>
        </div>
        <ul className="divide-y divide-slate-800 border-t border-slate-800">
          {def.tiers.map((n, i) => {
            const t = (i + 1) as Tier;
            const got = state.tier >= t;
            return (
              <li key={t} className="flex items-center gap-3 px-5 py-2.5">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: got ? TIER_PALETTE[t].star : '#1e293b', color: got ? '#0f172a' : '#64748b' }}
                >
                  {got ? <Check className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
                </span>
                <span className="flex-1 text-sm text-slate-200">
                  {TIER_NAMES[t]} <span className="text-slate-500">· {n}</span>
                </span>
                <span className="text-[11px] text-slate-400">{got ? fmtDate(dates[i]) || 'zdobyta' : ''}</span>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end border-t border-slate-800 px-5 py-3">
          <button
            type="button"
            onClick={onTogglePin}
            disabled={state.tier === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          >
            {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {pinned ? 'Zdejmij z gabloty profilu' : 'Przypnij do gabloty profilu'}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface Unlock {
  id: string;
  tier: Tier;
}

const CONFETTI_COLORS = ['#fde047', '#7dd3fc', '#f472b6', '#4ade80', '#fb923c', '#a78bfa'];

/** Okno gratulacji po zdobyciu nowej odznaki / stopnia (z konfetti). */
export function UnlockCelebration({
  unlocks,
  states,
  onClose,
}: {
  unlocks: Unlock[];
  states: AchievementState[];
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const cur = unlocks[idx];
  const st = states.find((s) => s.def.id === cur?.id);
  const confetti = Array.from({ length: 36 }, (_, i) => ({
    left: (i * 29) % 100,
    delay: (i % 9) * 0.12,
    dur: 2.2 + (i % 5) * 0.35,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + (i % 4) * 2,
    rot: (i * 47) % 360,
  }));
  if (!cur || !st) return null;
  const Icon = ACH_ICON[st.def.icon];
  const p = TIER_PALETTE[cur.tier];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <style>{`@keyframes cf-fall{0%{transform:translateY(-10vh) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:.9}}@keyframes cf-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}`}</style>
      {confetti.map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: 0,
            left: `${c.left}%`,
            width: c.size,
            height: c.size * 0.45,
            background: c.color,
            transform: `rotate(${c.rot}deg)`,
            animation: `cf-fall ${c.dur}s ${c.delay}s linear infinite`,
            borderRadius: 1,
          }}
        />
      ))}
      <div
        className="relative w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl"
        style={{ animation: 'cf-pop .5s ease-out both', boxShadow: `0 0 60px ${p.glow}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="tier-text text-xs font-bold uppercase tracking-widest" style={tierTextStyle(cur.tier)}>
          Nowa odznaka!
        </p>
        <div className="mt-3 flex justify-center">
          <BadgeMedal tier={cur.tier} icon={<Icon strokeWidth={1.7} />} size={140} pulse />
        </div>
        <h3 className="mt-3 text-2xl font-bold text-slate-50">{st.def.name}</h3>
        <p className="mt-1 text-sm text-slate-300">
          Stopień: <b className="tier-text" style={tierTextStyle(cur.tier)}>{TIER_NAMES[cur.tier]}</b>
        </p>
        <p className="mt-1 text-xs text-slate-400">{st.def.desc.replace('{n}', String(st.def.tiers[cur.tier - 1]))}</p>
        <button
          type="button"
          onClick={() => (idx + 1 < unlocks.length ? setIdx(idx + 1) : onClose())}
          className="mt-5 rounded-xl px-5 py-2 text-sm font-bold text-[#0b1220]"

          style={{ background: p.star }}
        >
          {idx + 1 < unlocks.length ? `Dalej (${idx + 1}/${unlocks.length})` : 'Świetnie!'}
        </button>
      </div>
    </div>
  );
}

