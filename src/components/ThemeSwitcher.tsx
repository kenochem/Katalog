import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Cookie, Moon, Sun } from 'lucide-react';
import { THEME_LABELS, useTheme, type ThemeMode } from '../lib/theme';

const THEME_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  cookie: Cookie,
};

const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'cookie'];

interface ThemeSwitcherProps {
  className?: string;
}

export function ThemeSwitcher({ className = '' }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const CurrentIcon = THEME_ICONS[theme];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hub-header-btn hub-header-btn--text hub-header-btn--ghost inline-flex"
        title={`Motyw: ${THEME_LABELS[theme]}`}
        aria-label="Wybierz motyw"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <CurrentIcon className="h-4 w-4 shrink-0" />
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[220] w-48 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 py-1.5 text-sm shadow-2xl shadow-black/40"
        >
          {THEME_OPTIONS.map((mode) => {
            const Icon = THEME_ICONS[mode];
            const active = mode === theme;
            return (
              <button
                key={mode}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setTheme(mode);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                  active ? 'bg-emerald-500/15 text-emerald-300' : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{THEME_LABELS[mode]}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
