import { useId, type CSSProperties, type ReactNode } from 'react';

import {
  Boxes,
  CalendarDays,
  Camera,
  CheckCheck,
  Feather,
  Flame,
  Layers,
  Moon,
  Pencil,
  Plug,
  Rocket,
  Sparkles,
  Sunrise,
  Tag,
  Wrench,
} from 'lucide-react';
import type { AchIcon, Tier } from '../lib/achievements';

export const ACH_ICON: Record<AchIcon, typeof Camera> = {
  pencil: Pencil,
  camera: Camera,
  boxes: Boxes,
  tag: Tag,
  wrench: Wrench,
  feather: Feather,
  plug: Plug,
  layers: Layers,
  flame: Flame,
  calendar: CalendarDays,
  sunrise: Sunrise,
  moon: Moon,
  rocket: Rocket,
  check: CheckCheck,
  sparkles: Sparkles,
};

interface Palette {
  ring: [string, string, string];
  inner: [string, string];
  icon: string;
  glow: string;
  star: string;
  /** Wariant koloru stopnia do TEKSTU na jasnym tle. */
  textLight: string;
}

export const TIER_PALETTE: Record<Tier, Palette> = {
  0: { ring: ['#3b4558', '#2a3344', '#1b2230'], inner: ['#141b29', '#0d1320'], icon: '#4b5870', glow: 'transparent', star: '#334155', textLight: '#64748b' },
  1: { ring: ['#f4b983', '#b8651b', '#6e3a0c'], inner: ['#3b2412', '#22130a'], icon: '#f6c89a', glow: 'rgba(205,127,50,.55)', star: '#f0a35e', textLight: '#9a4f12' },
  2: { ring: ['#ffffff', '#c4c9d4', '#7d8799'], inner: ['#2c3345', '#171b27'], icon: '#eef2fb', glow: 'rgba(203,213,225,.55)', star: '#e2e8f0', textLight: '#475569' },
  3: { ring: ['#fff6b0', '#f5c518', '#a8730a'], inner: ['#40320f', '#241b08'], icon: '#ffe27a', glow: 'rgba(250,204,21,.6)', star: '#fde047', textLight: '#a16207' },
  4: { ring: ['#e0fbff', '#7dd3fc', '#6366f1'], inner: ['#1d2c5e', '#0e1535'], icon: '#c9f3ff', glow: 'rgba(125,211,252,.75)', star: '#a5f3fc', textLight: '#4338ca' },
};

/** Styl tekstu w kolorze stopnia: ciemniejszy w jasnym motywie, jasny w ciemnym (klasa tier-text). */
export function tierTextStyle(tier: Tier): CSSProperties {
  return { '--c-light': TIER_PALETTE[tier].textLight, '--c-dark': TIER_PALETTE[tier].star } as CSSProperties;
}

const HEX = '50,3 95,28 95,84 50,109 5,84 5,28';
const HEX_INNER = '50,16 83,35 83,78 50,97 17,78 17,35';

interface Props {
  tier: Tier;
  icon: ReactNode;
  /** Szerokość w px (wysokość = 1.12 szerokości). */
  size?: number;
  /** Delikatny puls (np. świeżo zdobyta). */
  pulse?: boolean;
}

/** Medal odznaki: sześciokątna tarcza z gradientem stopnia, ikoną i gwiazdkami. */
export function BadgeMedal({ tier, icon, size = 96, pulse }: Props) {
  const uid = useId().replace(/:/g, '');
  const p = TIER_PALETTE[tier];
  const shine = tier >= 3;
  const locked = tier === 0;
  const stars = tier;
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        flexShrink: 0,
        lineHeight: 0,
        width: size,
        height: size * 1.12,
        filter: locked ? 'none' : `drop-shadow(0 4px 10px ${p.glow})`,
        animation: pulse ? 'bm-pulse 1.6s ease-in-out infinite' : undefined,
      }}
    >
      <style>{`@keyframes bm-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}.bm-ico svg{width:100%;height:100%;display:block}`}</style>
      <svg viewBox="0 0 100 112" width={size} height={size * 1.12} aria-hidden="true">
        <defs>
          <linearGradient id={`r${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.ring[0]} />
            <stop offset="0.5" stopColor={p.ring[1]} />
            <stop offset="1" stopColor={p.ring[2]} />
          </linearGradient>
          <linearGradient id={`i${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={p.inner[0]} />
            <stop offset="1" stopColor={p.inner[1]} />
          </linearGradient>
          <linearGradient id={`s${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity={tier === 4 ? 0.55 : 0.35} />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`g${uid}`} cx="50%" cy="42%" r="45%">
            <stop offset="0" stopColor={p.icon} stopOpacity={locked ? 0.05 : 0.28} />
            <stop offset="1" stopColor={p.icon} stopOpacity="0" />
          </radialGradient>
          <clipPath id={`c${uid}`}>
            <polygon points={HEX} />
          </clipPath>
        </defs>
        <polygon points={HEX} fill={`url(#r${uid})`} />
        <polygon points={HEX_INNER} fill={`url(#i${uid})`} stroke={p.ring[0]} strokeOpacity={locked ? 0.25 : 0.55} strokeWidth="1.2" />
        <circle cx="50" cy="52" r="30" fill={`url(#g${uid})`} />
        {/* delikatny połysk u góry */}
        <polygon points="50,16 83,35 83,48 50,41 17,48 17,35" fill="#fff" fillOpacity={locked ? 0.03 : 0.1} />
        {shine && (
          <g clipPath={`url(#c${uid})`}>
            <rect x="-40" y="0" width="34" height="112" fill={`url(#s${uid})`} transform="skewX(-18)">
              <animate attributeName="x" from="-60" to="140" dur={tier === 4 ? '2.6s' : '4.2s'} repeatCount="indefinite" />
            </rect>
          </g>
        )}
        {/* gwiazdki stopnia */}
        {Array.from({ length: 4 }).map((_, i) => {
          const cx = 50 + (i - 1.5) * 11;
          const on = i < stars;
          return (
            <polygon
              key={i}
              transform={`translate(${cx} 91) scale(0.55)`}
              points="0,-7 2,-2.2 7,-2.2 3,1 4.5,6 0,3 -4.5,6 -3,1 -7,-2.2 -2,-2.2"
              fill={on ? p.star : '#1e293b'}
              fillOpacity={on ? 1 : 0.7}
            />
          );
        })}
      </svg>
      <span
        className="bm-ico"
        style={{
          position: 'absolute',
          left: '50%',
          top: '28%',
          transform: 'translateX(-50%)',
          width: size * 0.4,
          height: size * 0.4,
          color: p.icon,
          opacity: locked ? 0.7 : 1,
        }}
      >
        {icon}
      </span>
    </span>
  );
}
