import type { CSSProperties, ReactNode } from 'react';

/**
 * Wizualna kosmetyka profilu: ramki avatara, tła nagłówka (część animowana) i nakładki.
 * Czysty CSS (bez bibliotek); animacje wyłączają się przy „ograniczonym ruchu” w systemie.
 */

const CSS = `
@keyframes pf-spin{to{transform:rotate(360deg)}}
@keyframes pf-pulse{0%,100%{filter:brightness(1);opacity:.92}50%{filter:brightness(1.35);opacity:1}}
@keyframes pf-twinkle{0%,100%{opacity:.15;transform:scale(.7)}50%{opacity:1;transform:scale(1.15)}}
@keyframes pf-rise{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:.9}100%{transform:translateY(-130px) scale(1.1);opacity:0}}
@keyframes pf-fall{0%{transform:translate(0,-12px);opacity:0}12%{opacity:.95}100%{transform:translate(var(--sw,10px),150px);opacity:0}}
@keyframes pf-spinfall{0%{transform:translateY(-12px) rotate(0);opacity:0}12%{opacity:1}100%{transform:translateY(150px) rotate(540deg);opacity:0}}
@keyframes pf-float{0%,100%{transform:translate(0,0);opacity:.2}30%{opacity:1}50%{transform:translate(14px,-18px)}75%{transform:translate(-10px,-6px);opacity:.8}}
@keyframes pf-gradmove{0%{background-position:0% 50%}100%{background-position:300% 50%}}
@keyframes pf-aurora{0%{transform:translate(-8%,-6%) rotate(0) scale(1)}50%{transform:translate(8%,5%) rotate(25deg) scale(1.25)}100%{transform:translate(-8%,-6%) rotate(0) scale(1)}}
@keyframes pf-wave{to{background-position-x:600px}}
@keyframes pf-sheen{0%{transform:translateX(-140%) skewX(-20deg)}100%{transform:translateX(260%) skewX(-20deg)}}
@keyframes pf-pulse-line{0%{transform:translateX(-30%);opacity:0}20%{opacity:1}100%{transform:translateX(130%);opacity:0}}

.pf-frame{position:relative;display:inline-block;border-radius:9999px;line-height:0;flex-shrink:0}
.pf-ring{position:absolute;inset:0;border-radius:9999px}
.pf-inner{position:relative;display:block;border-radius:9999px;background:#0b1220;padding:2px;margin:4px}
.pf-frame.pf-sm .pf-inner{margin:2px;padding:1px}
.pf-f-classic .pf-ring{background:var(--ac)}
.pf-f-double .pf-ring{background:var(--ac);box-shadow:0 0 0 2px #0b1220,0 0 0 4px var(--ac)}
.pf-f-dash .pf-ring{background:repeating-conic-gradient(var(--ac) 0 10deg,transparent 10deg 20deg)}
.pf-f-bronze .pf-ring{background:linear-gradient(135deg,#f4b983,#b8651b 55%,#6e3a0c)}
.pf-f-silver .pf-ring{background:linear-gradient(135deg,#fff,#c4c9d4 50%,#7d8799)}
.pf-f-gold .pf-ring{background:linear-gradient(135deg,#fff6b0,#f5c518 50%,#a8730a);box-shadow:0 0 14px rgba(250,204,21,.45)}
.pf-f-neon .pf-ring{background:var(--ac);box-shadow:0 0 10px var(--ac),0 0 26px var(--ac);animation:pf-pulse 2s ease-in-out infinite}
.pf-f-rainbow .pf-ring{background:conic-gradient(#f43f5e,#f59e0b,#eab308,#22c55e,#06b6d4,#6366f1,#d946ef,#f43f5e);animation:pf-spin 4s linear infinite}
.pf-f-flame .pf-ring{background:conic-gradient(#f97316,#ef4444,#fde047,#f97316,#ef4444,#f97316);animation:pf-spin 2.4s linear infinite;box-shadow:0 0 16px rgba(249,115,22,.65)}
.pf-f-diamond .pf-ring{background:conic-gradient(#e0fbff,#7dd3fc,#6366f1,#e0fbff,#a5f3fc,#e0fbff);animation:pf-spin 5s linear infinite;box-shadow:0 0 18px rgba(125,211,252,.7)}
.pf-f-photo .pf-ring{background:repeating-conic-gradient(#fde047 0 9deg,#1e293b 9deg 18deg)}
.pf-f-tech .pf-ring{background:repeating-conic-gradient(#94a3b8 0 22.5deg,#334155 22.5deg 45deg);animation:pf-spin 12s linear infinite}
.pf-f-ember .pf-ring{background:conic-gradient(#fb923c,#dc2626,#fbbf24,#fb923c);animation:pf-spin 6s linear infinite;box-shadow:0 0 12px rgba(220,38,38,.5)}

.pf-banner{position:relative;overflow:hidden;--ac2:color-mix(in srgb,var(--ac) 22%,transparent)}
.pf-banner>.pf-content{position:relative;z-index:3}
.pf-banner::before,.pf-banner::after{content:'';position:absolute;pointer-events:none}
.pf-bg-graphite{background:linear-gradient(135deg,#111827,#1f2937)}
.pf-bg-dusk{background:linear-gradient(135deg,#1e1b4b,#4c1d95 45%,#b45309)}
.pf-bg-grid{background-color:#0b1220;background-image:linear-gradient(var(--ac2) 1px,transparent 1px),linear-gradient(90deg,var(--ac2) 1px,transparent 1px);background-size:22px 22px}
.pf-bg-film{background:linear-gradient(#0b0f1a,#151c2c)}
.pf-bg-film::before{left:0;right:0;top:6px;height:9px;background:repeating-linear-gradient(90deg,rgba(226,232,240,.55) 0 12px,transparent 12px 26px);border-radius:2px}
.pf-bg-film::after{left:0;right:0;bottom:6px;height:9px;background:repeating-linear-gradient(90deg,rgba(226,232,240,.55) 0 12px,transparent 12px 26px);border-radius:2px}
.pf-bg-circuit{background:#06141a}
.pf-bg-circuit::before{inset:0;background:repeating-linear-gradient(0deg,rgba(34,211,238,.13) 0 1px,transparent 1px 26px),repeating-linear-gradient(90deg,rgba(34,211,238,.13) 0 1px,transparent 1px 26px)}
.pf-bg-circuit::after{left:0;top:38%;width:45%;height:2px;background:linear-gradient(90deg,transparent,#22d3ee,transparent);animation:pf-pulse-line 3.2s ease-in-out infinite}
.pf-bg-waves{background:linear-gradient(180deg,#0c4a6e,#082f49)}
.pf-bg-waves::before,.pf-bg-waves::after{left:0;right:0;height:46px;background-repeat:repeat-x;background-size:600px 46px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 40' preserveAspectRatio='none'%3E%3Cpath d='M0 20 Q 75 0 150 20 T 300 20 T 450 20 T 600 20 V40 H0Z' fill='%2338bdf8' fill-opacity='.28'/%3E%3C/svg%3E")}
.pf-bg-waves::before{bottom:0;animation:pf-wave 9s linear infinite}
.pf-bg-waves::after{bottom:10px;opacity:.7;animation:pf-wave 14s linear infinite reverse}
.pf-bg-aurora,.pf-bg-legend{background:#050816}
.pf-bg-aurora::before{inset:-30%;background:radial-gradient(40% 40% at 25% 40%,rgba(52,211,153,.55),transparent 70%),radial-gradient(35% 45% at 70% 30%,rgba(129,140,248,.55),transparent 70%),radial-gradient(40% 40% at 55% 85%,rgba(34,211,238,.45),transparent 70%);filter:blur(18px);animation:pf-aurora 12s ease-in-out infinite}
.pf-bg-legend::before{inset:-30%;background:radial-gradient(40% 40% at 25% 40%,rgba(244,114,182,.55),transparent 70%),radial-gradient(35% 45% at 70% 30%,rgba(250,204,21,.45),transparent 70%),radial-gradient(40% 40% at 55% 85%,rgba(56,189,248,.5),transparent 70%);filter:blur(18px);animation:pf-aurora 9s ease-in-out infinite}
.pf-bg-space{background:linear-gradient(180deg,#02030a,#0b1030)}
.pf-bg-neoncity{background:linear-gradient(120deg,#f43f5e,#8b5cf6,#06b6d4,#f43f5e);background-size:300% 100%;animation:pf-gradmove 10s linear infinite}
.pf-bg-neoncity::before{inset:0;background:rgba(2,6,23,.55)}
.pf-bg-goldshine{background:linear-gradient(135deg,#3a2a05,#8a6508 50%,#3a2a05)}
.pf-bg-goldshine::after{top:0;bottom:0;width:30%;left:0;background:linear-gradient(90deg,transparent,rgba(255,244,176,.45),transparent);animation:pf-sheen 4.5s ease-in-out infinite}
.pf-ov-stars i{width:2px;height:2px;border-radius:50%;background:#fff;animation:pf-twinkle var(--d) ease-in-out infinite;animation-delay:var(--dl)}
.pf-ov{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:hidden}
.pf-ov i{position:absolute;display:block}
.pf-ov-sparkles i{width:3px;height:3px;border-radius:50%;background:#fff;box-shadow:0 0 6px 1px #fff;animation:pf-twinkle var(--d) ease-in-out infinite;animation-delay:var(--dl)}
.pf-ov-bubbles i{bottom:0;border-radius:50%;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.08);animation:pf-rise var(--d) ease-in infinite;animation-delay:var(--dl)}
.pf-ov-snow i{top:0;width:4px;height:4px;border-radius:50%;background:#fff;opacity:.9;animation:pf-fall var(--d) linear infinite;animation-delay:var(--dl)}
.pf-ov-confetti i{top:0;width:5px;height:9px;animation:pf-spinfall var(--d) linear infinite;animation-delay:var(--dl)}
.pf-ov-embers i{bottom:0;width:3px;height:3px;border-radius:50%;background:#fb923c;box-shadow:0 0 6px 2px rgba(249,115,22,.7);animation:pf-rise var(--d) ease-out infinite;animation-delay:var(--dl)}
.pf-ov-fireflies i{width:5px;height:5px;border-radius:50%;background:#d9f99d;box-shadow:0 0 9px 3px rgba(190,242,100,.65);animation:pf-float var(--d) ease-in-out infinite;animation-delay:var(--dl)}
@media (prefers-reduced-motion:reduce){.pf-banner,.pf-banner::before,.pf-banner::after,.pf-ring,.pf-ov i{animation:none!important}}
`;

const CONFETTI = ['#fde047', '#7dd3fc', '#f472b6', '#4ade80', '#fb923c', '#a78bfa'];

function overlayItems(type: string): ReactNode[] {
  const n = type === 'snow' || type === 'confetti' ? 24 : type === 'stars' ? 40 : 16;
  return Array.from({ length: n }, (_, i) => {
    const left = (i * 37 + (i % 5) * 9) % 98;
    const top = (i * 29 + (i % 4) * 13) % 90;
    const d = 2.6 + ((i * 7) % 9) * 0.45;
    const dl = -((i * 11) % 8) * 0.55;
    const size = type === 'bubbles' ? 6 + ((i * 5) % 12) : undefined;
    const style: CSSProperties & Record<string, string | number> = {
      left: `${left}%`,
      '--d': `${d}s`,
      '--dl': `${dl}s`,
      '--sw': `${(i % 2 ? 1 : -1) * (8 + (i % 4) * 5)}px`,
    };
    if (type === 'sparkles' || type === 'fireflies' || type === 'stars') style.top = `${top}%`;
    if (size) {
      style.width = size;
      style.height = size;
    }
    if (type === 'confetti') style.background = CONFETTI[i % CONFETTI.length];
    return <i key={i} style={style} />;
  });
}

interface BannerProps {
  bg?: string;
  overlay?: string;
  accent: string;
  className?: string;
  children?: ReactNode;
}

/** Nagłówek profilu z tłem i nakładką. */
export function ProfileBanner({ bg = 'default', overlay = 'none', accent, className = '', children }: BannerProps) {
  const style: CSSProperties & Record<string, string> = { '--ac': accent };
  if (bg === 'default') style.background = `linear-gradient(135deg, ${accent}33, transparent 60%)`;
  return (
    <div className={`pf-banner pf-bg-${bg} ${className}`} style={style}>
      <style>{CSS}</style>
      {(bg === 'space' || bg === 'legend') && (
        <span className="pf-ov pf-ov-stars" aria-hidden="true">
          {overlayItems('stars')}
        </span>
      )}
      {overlay !== 'none' && (
        <span className={`pf-ov pf-ov-${overlay}`} aria-hidden="true">
          {overlayItems(overlay)}
        </span>
      )}
      <div className="pf-content">{children}</div>
    </div>
  );
}

interface FrameProps {
  frame?: string;
  accent: string;
  small?: boolean;
  children: ReactNode;
}

/** Ramka wokół avatara. */
export function AvatarFrame({ frame = 'classic', accent, small, children }: FrameProps) {
  const style: CSSProperties & Record<string, string> = { '--ac': accent };
  return (
    <span className={`pf-frame pf-f-${frame} ${small ? 'pf-sm' : ''}`} style={style}>
      <style>{CSS}</style>
      <span className="pf-ring" aria-hidden="true" />
      <span className="pf-inner">{children}</span>
    </span>
  );
}
