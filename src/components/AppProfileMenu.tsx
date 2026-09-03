import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Cookie,
  LogOut,
  MessageCircle,
  Settings2,
  Sun,
  Moon,
  Palette,
  UserRound,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/roles';
import { canAccessAdminPanel } from '../lib/adminAccess';
import { UserAvatar } from './UserAvatar';
import { useUserAvatar } from '../lib/useUserAvatar';
import { saveUserAvatarFile } from '../lib/userAvatar';
import { THEME_LABELS, useTheme } from '../lib/theme';

const THEME_MENU_ICONS = { light: Sun, dark: Moon, gray: Palette, cookie: Cookie } as const;
import { showToast } from '../lib/toast';

interface AppProfileMenuProps {
  onOpenAdmin?: () => void;
  adminActive?: boolean;
  onOpenChatSettings?: () => void;
}

export function AppProfileMenu({
  onOpenAdmin,
  adminActive,
  onOpenChatSettings,
}: AppProfileMenuProps) {
  const {
    mode,
    displayLabel,
    profile,
    role,
    signOut,
    exitGuest,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const ThemeIcon = THEME_MENU_ICONS[theme];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const userId = profile?.id;
  const avatar = useUserAvatar(userId);
  const canAdmin = canAccessAdminPanel(role);

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

  async function onPickAvatar(file: File) {
    if (!userId) return;
    try {
      await saveUserAvatarFile(userId, file);
      showToast('Avatar zapisany', 'ok');
    } catch (err) {
      console.error(err);
      showToast('Nie udało się zapisać avatara', 'error');
    }
  }

  if (mode === 'gate') return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`hub-header-btn hub-header-btn--profile inline-flex items-center gap-1.5 ${
          open ? 'border-brand-500/40 bg-brand-500/10' : ''
        }`}
        title="Profil"
        aria-expanded={open}
      >
        {mode === 'signed_in' && userId ? (
          <UserAvatar name={displayLabel} src={avatar} size="xs" />
        ) : (
          <UserRound className="h-4 w-4 text-slate-400" />
        )}
        <span className="hidden min-w-0 truncate text-sm font-medium leading-none sm:inline">
          {displayLabel.split(' ')[0]}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[90] w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40">
          <div className="border-b border-slate-800 px-3 py-3">
            <div className="flex items-center gap-2.5">
              <UserAvatar name={displayLabel} src={avatar} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{displayLabel}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {profile?.email ?? (mode === 'guest' ? 'Gość' : '—')}
                </p>
                <p className="text-[10px] font-medium text-brand-400">{ROLE_LABELS[role]}</p>
              </div>
            </div>
            {mode === 'signed_in' && userId && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPickAvatar(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Zmień avatar
                </button>
              </>
            )}
          </div>
          <ul className="py-1">
            {onOpenChatSettings && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChatSettings();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-brand-400" />
                  Ustawienia czatu
                </button>
              </li>
            )}
            {canAdmin && onOpenAdmin && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAdmin();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                    adminActive
                      ? 'bg-violet-500/15 text-violet-200'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Settings2 className="h-4 w-4 shrink-0 text-violet-400" />
                  Panel administracyjny
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                <ThemeIcon className="h-4 w-4" />
                Motyw: {THEME_LABELS[theme]}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (mode === 'guest') exitGuest();
                  else void signOut();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4" />
                {mode === 'guest' ? 'Logowanie' : 'Wyloguj'}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
