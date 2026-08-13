const SOUNDS_KEY = 'katalog-talk-chat-sounds';
const MUTED_THREADS_KEY = 'katalog-talk-chat-muted';
const APPEARANCE_KEY = 'katalog-talk-chat-appearance';
const LEGACY_FONT_KEY = 'katalog-talk-chat-font';

export type TalkChatWallpaperId =
  | 'default'
  | 'messenger'
  | 'midnight'
  | 'ocean'
  | 'aurora'
  | 'slate'
  | 'lavender'
  | 'sunset'
  | 'graphite'
  | 'clean'
  | 'paper';
export type TalkChatBubbleStyle = 'rounded' | 'square';
export type TalkChatFontSize = 'sm' | 'md' | 'lg';
export type TalkChatPanelTheme = 'auto' | 'light' | 'dark' | 'soft' | 'whatsapp' | 'discord';
export type TalkChatMessageSpacing = 'compact' | 'normal' | 'comfortable';
export type TalkChatAccentColor =
  | 'brand'
  | 'teal'
  | 'violet'
  | 'rose'
  | 'emerald'
  | 'blue'
  | 'amber';

export interface TalkChatAppearance {
  wallpaper: TalkChatWallpaperId;
  bubbleStyle: TalkChatBubbleStyle;
  fontSize: TalkChatFontSize;
  messageSpacing: TalkChatMessageSpacing;
  panelTheme: TalkChatPanelTheme;
  accentColor: TalkChatAccentColor;
  showAvatars: boolean;
  showTimestampsEvery: boolean;
  showReadReceipts: boolean;
  enterToSend: boolean;
  quickSendEmoji: string;
  pushEnabled: boolean;
}

export const TALK_CHAT_WALLPAPERS: { id: TalkChatWallpaperId; label: string }[] = [
  { id: 'default', label: 'WhatsApp' },
  { id: 'messenger', label: 'Messenger' },
  { id: 'midnight', label: 'Północ' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'aurora', label: 'Zorza' },
  { id: 'slate', label: 'Grafit' },
  { id: 'lavender', label: 'Lawenda' },
  { id: 'sunset', label: 'Zachód' },
  { id: 'graphite', label: 'Grafit II' },
  { id: 'clean', label: 'Czyste' },
  { id: 'paper', label: 'Papier' },
];

export const TALK_CHAT_PANEL_THEMES: { id: TalkChatPanelTheme; label: string; hint: string }[] = [
  { id: 'auto', label: 'Jak aplikacja', hint: 'Motyw systemu / dark mode' },
  { id: 'light', label: 'Jasny', hint: 'Jasne tło rozmowy' },
  { id: 'dark', label: 'Ciemny', hint: 'Mniej światła wieczorem' },
  { id: 'soft', label: 'Soft', hint: 'Przygaszone kolory' },
  { id: 'whatsapp', label: 'WhatsApp', hint: 'Zielone bańki' },
  { id: 'discord', label: 'Discord', hint: 'Ciemny fioletowo-szary' },
];

export const TALK_CHAT_ACCENT_COLORS: { id: TalkChatAccentColor; label: string; swatch: string }[] = [
  { id: 'brand', label: 'Kenochem', swatch: '#0d9488' },
  { id: 'teal', label: 'Morski', swatch: '#14b8a6' },
  { id: 'violet', label: 'Fiolet', swatch: '#8b5cf6' },
  { id: 'rose', label: 'Róż', swatch: '#f43f5e' },
  { id: 'emerald', label: 'Szmaragd', swatch: '#10b981' },
  { id: 'blue', label: 'Messenger', swatch: '#0084ff' },
  { id: 'amber', label: 'Złoty', swatch: '#f59e0b' },
];

export const TALK_CHAT_MESSAGE_SPACING: { id: TalkChatMessageSpacing; label: string }[] = [
  { id: 'compact', label: 'Gęsto' },
  { id: 'normal', label: 'Normalnie' },
  { id: 'comfortable', label: 'Luźno' },
];

export const TALK_QUICK_SEND_EMOJIS = ['👍', '❤️', '😂', '🙏', '🔥', '👋', '🎉', '✅', '😊', '😮'] as const;

const DEFAULT_APPEARANCE: TalkChatAppearance = {
  wallpaper: 'default',
  bubbleStyle: 'rounded',
  fontSize: 'md',
  messageSpacing: 'normal',
  panelTheme: 'auto',
  accentColor: 'brand',
  showAvatars: true,
  showTimestampsEvery: false,
  showReadReceipts: true,
  enterToSend: true,
  quickSendEmoji: '👍',
  pushEnabled: true,
};

function readMutedThreads(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(MUTED_THREADS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function normalizeAppearance(raw: Partial<TalkChatAppearance>): TalkChatAppearance {
  const merged = { ...DEFAULT_APPEARANCE, ...raw };
  if (!TALK_CHAT_WALLPAPERS.some((w) => w.id === merged.wallpaper)) merged.wallpaper = 'default';
  if (!TALK_CHAT_PANEL_THEMES.some((t) => t.id === merged.panelTheme)) merged.panelTheme = 'auto';
  if (!TALK_CHAT_MESSAGE_SPACING.some((s) => s.id === merged.messageSpacing)) {
    merged.messageSpacing = 'normal';
  }
  if (!TALK_CHAT_ACCENT_COLORS.some((c) => c.id === merged.accentColor)) merged.accentColor = 'brand';
  if (!merged.quickSendEmoji?.trim()) merged.quickSendEmoji = '👍';
  return merged;
}

function migrateLegacyFont(): TalkChatFontSize | null {
  try {
    const v = localStorage.getItem(LEGACY_FONT_KEY);
    if (v === 'sm' || v === 'md' || v === 'lg') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function loadTalkChatAppearance(): TalkChatAppearance {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) {
      const legacy = migrateLegacyFont();
      if (legacy) return normalizeAppearance({ fontSize: legacy });
      return { ...DEFAULT_APPEARANCE };
    }
    return normalizeAppearance(JSON.parse(raw) as Partial<TalkChatAppearance>);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveTalkChatAppearance(patch: Partial<TalkChatAppearance>) {
  const next = normalizeAppearance({ ...loadTalkChatAppearance(), ...patch });
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  try {
    localStorage.setItem(LEGACY_FONT_KEY, next.fontSize);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('katalog-talk-chat-appearance'));
}

export function resetTalkChatAppearance() {
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(DEFAULT_APPEARANCE));
  window.dispatchEvent(new CustomEvent('katalog-talk-chat-appearance'));
}

export function loadTalkChatFontSize(): TalkChatFontSize {
  return loadTalkChatAppearance().fontSize;
}

export function saveTalkChatFontSize(size: TalkChatFontSize): void {
  saveTalkChatAppearance({ fontSize: size });
}

export function talkChatFontClass(size: TalkChatFontSize): string {
  switch (size) {
    case 'sm':
      return 'text-[13px]';
    case 'lg':
      return 'text-base';
    default:
      return 'text-sm';
  }
}

export function isTalkChatSoundsEnabled(): boolean {
  try {
    const v = localStorage.getItem(SOUNDS_KEY);
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

export function setTalkChatSoundsEnabled(enabled: boolean) {
  localStorage.setItem(SOUNDS_KEY, enabled ? '1' : '0');
  window.dispatchEvent(new CustomEvent('katalog-talk-chat-appearance'));
}

export function isTalkChatPushEnabled(): boolean {
  return loadTalkChatAppearance().pushEnabled;
}

export function isThreadMuted(threadId: string): boolean {
  return Boolean(readMutedThreads()[threadId]);
}

export function setThreadMuted(threadId: string, muted: boolean) {
  const all = readMutedThreads();
  if (muted) all[threadId] = true;
  else delete all[threadId];
  localStorage.setItem(MUTED_THREADS_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent('katalog-talk-chat-appearance'));
}

export function talkChatShellClasses(a: TalkChatAppearance): string {
  const parts = ['talk-chat-shell'];
  if (a.panelTheme !== 'auto') parts.push(`talk-chat-theme-${a.panelTheme}`);
  parts.push(`talk-chat-accent-${a.accentColor}`);
  if (a.bubbleStyle === 'square') parts.push('talk-chat-bubbles-square');
  parts.push(`talk-chat-spacing-${a.messageSpacing}`);
  return parts.join(' ');
}

export function talkWallpaperClass(wallpaper: TalkChatWallpaperId): string {
  return `talk-wallpaper talk-wallpaper-${wallpaper}`;
}

export function talkMessageSpacingClass(spacing: TalkChatMessageSpacing): string {
  if (spacing === 'compact') return 'space-y-0.5';
  if (spacing === 'comfortable') return 'space-y-3';
  return 'space-y-1';
}
