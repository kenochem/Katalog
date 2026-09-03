import { useCallback, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'gray' | 'cookie';

const THEME_KEY = 'katalog-theme';
const THEME_ORDER: ThemeMode[] = ['light', 'dark', 'gray', 'cookie'];
const THEME_CLASSES: Record<ThemeMode, string[]> = {
  light: [],
  dark: ['dark'],
  gray: ['dark', 'theme-gray'],
  cookie: ['theme-cookie'],
};
const THEME_COLOR: Record<ThemeMode, string> = {
  light: '#33b33b',
  dark: '#020617',
  gray: '#323a3f',
  cookie: '#c17f2a',
};

export const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Jasny',
  dark: 'Ciemny',
  gray: 'Szary',
  cookie: 'Ciasteczkowy',
};

function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'dark' || v === 'gray' || v === 'cookie') return v;
    return 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-cookie', 'theme-gray');
  for (const cls of THEME_CLASSES[theme]) root.classList.add(cls);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[theme]);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const t = readTheme();
    applyTheme(t);
    return t;
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const idx = THEME_ORDER.indexOf(prev);
      return THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    });
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next);
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' || theme === 'gray' };
}
