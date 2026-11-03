import { useEffect, useState } from 'react';

export type EngineState = 'off' | 'running' | 'idle';

/**
 * Lekka animacja silnika rzędowego: tłoki, wał, koło zamachowe, iskry i spaliny.
 * „running” — pełne obroty (silnik liczy), „idle” — wolne obroty (wynik gotowy), „off” — stoi.
 */
export function EngineAnimation({ state, className = '' }: { state: EngineState; className?: string }) {
  const [kick, setKick] = useState(false);
  useEffect(() => {
    if (state !== 'running') return;
    setKick(true);
    const t = setTimeout(() => setKick(false), 700);
    return () => clearTimeout(t);
  }, [state]);

  const period = state === 'running' ? '0.7s' : '2.6s';
  const play = state === 'off' ? 'paused' : 'running';
  const cyl = [0, 1, 2, 3];
  // kolejność zapłonu 1-3-4-2
  const fire = [0, 0.5, 0.25, 0.75];
  const phase = [0, 0.5, 0.5, 0];

  return (
    <div className={`relative select-none ${className}`} aria-hidden="true">
      <style>{`
        .eng { --p: ${period}; }
        .eng * { animation-play-state: ${play}; }
        .eng-piston { animation: eng-piston var(--p) ease-in-out infinite; }
        .eng-spin { transform-box: fill-box; transform-origin: center; animation: eng-spin var(--p) linear infinite; }
        .eng-spark { animation: eng-spark var(--p) ease-out infinite; opacity: 0; }
        .eng-puff { transform-box: fill-box; transform-origin: center; animation: eng-puff calc(var(--p) * 3) ease-out infinite; opacity: 0; }
        .eng-shake { animation: eng-shake 0.7s ease-in-out 1; }
        @keyframes eng-piston { 0%,100% { transform: translateY(0); } 50% { transform: translateY(26px); } }
        @keyframes eng-spin { to { transform: rotate(360deg); } }
        @keyframes eng-spark { 0%,6% { opacity: 1; } 22%,100% { opacity: 0; } }
        @keyframes eng-puff { 0% { opacity: 0.55; transform: translate(0,0) scale(0.5); } 100% { opacity: 0; transform: translate(-26px,-22px) scale(1.5); } }
        @keyframes eng-shake { 0%,100% { transform: translate(0,0); } 15% { transform: translate(-1.5px,1px); } 30% { transform: translate(1.5px,-1px); } 45% { transform: translate(-1px,-1px); } 60% { transform: translate(1px,1px); } 80% { transform: translate(-0.5px,0.5px); } }
        @media (prefers-reduced-motion: reduce) { .eng * { animation: none !important; } }
      `}</style>
      <svg viewBox="0 0 380 210" className={`eng w-full text-slate-500 dark:text-slate-400 ${kick ? 'eng-shake' : ''}`} role="img">
        {/* poświata przy pracy */}
        <ellipse cx="190" cy="196" rx="150" ry="8" fill="currentColor" opacity={state === 'off' ? 0.08 : 0.16} />
        {/* kolektor wydechowy */}
        <path d="M60 128 H92 M60 112 H92" stroke="currentColor" strokeWidth="6" strokeLinecap="round" opacity="0.55" />
        {state !== 'off' &&
          [0, 1, 2].map((i) => (
            <circle key={i} className="eng-puff" cx="50" cy="120" r="8" fill="currentColor" style={{ animationDelay: `${i * 0.7}s` }} />
          ))}
        {/* blok */}
        <rect x="90" y="96" width="210" height="76" rx="8" fill="currentColor" opacity="0.14" stroke="currentColor" strokeWidth="2" />
        {/* głowica */}
        <rect x="96" y="52" width="198" height="34" rx="6" fill="currentColor" opacity="0.22" stroke="currentColor" strokeWidth="2" />
        {cyl.map((c) => {
          const x = 110 + c * 46;
          return (
            <g key={c}>
              {/* cylinder */}
              <rect x={x} y="86" width="30" height="62" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
              {/* tłok z korbowodem */}
              <g className="eng-piston" style={{ animationDelay: `-${phase[c] * parseFloat(period)}s` }}>
                <rect x={x + 3} y="90" width="24" height="14" rx="2" fill="currentColor" opacity="0.85" />
                <rect x={x + 13} y="104" width="4" height="30" fill="currentColor" opacity="0.6" />
              </g>
              {/* świeca */}
              <rect x={x + 12} y="40" width="6" height="14" rx="2" fill="currentColor" opacity="0.7" />
              <circle className="eng-spark" cx={x + 15} cy="86" r="5" fill="#f59e0b" style={{ animationDelay: `-${fire[c] * parseFloat(period)}s`, filter: 'blur(1px)' }} />
              {/* przeciwwaga wału */}
              <g className="eng-spin">
                <circle cx={x + 15} cy="160" r="9" fill="currentColor" opacity="0.5" />
                <circle cx={x + 15} cy="154" r="3" fill="currentColor" />
              </g>
            </g>
          );
        })}
        {/* wał */}
        <line x1="104" y1="160" x2="300" y2="160" stroke="currentColor" strokeWidth="3" opacity="0.5" />
        {/* koło zamachowe */}
        <g className="eng-spin">
          <circle cx="326" cy="160" r="32" fill="none" stroke="currentColor" strokeWidth="5" />
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <line key={a} x1="326" y1="160" x2={326 + 28 * Math.cos((a * Math.PI) / 180)} y2={160 + 28 * Math.sin((a * Math.PI) / 180)} stroke="currentColor" strokeWidth="2" opacity="0.6" />
          ))}
          <circle cx="326" cy="160" r="6" fill="currentColor" />
          <circle cx="326" cy="132" r="3.5" fill="#f59e0b" />
        </g>
        {/* pasek */}
        <path d="M290 160 H302" stroke="currentColor" strokeWidth="3" opacity="0.5" />
      </svg>
    </div>
  );
}
