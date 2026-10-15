import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes,
  CalendarDays,
  Camera,
  Check,
  Feather,
  Flame,
  Layers,
  Loader2,
  Moon,
  Pencil,
  Plug,
  RotateCcw,
  Sunrise,
  Tag,
  Trophy,
  Wrench,
} from 'lucide-react';
import type { View } from '../types';
import { useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/roleDefinitions';
import { useUserAvatar } from '../lib/useUserAvatar';
import { saveUserAvatarFile } from '../lib/userAvatar';
import { THEME_LABELS, useTheme, type ThemeMode } from '../lib/theme';
import {
  getCachedProfilePreferences,
  scheduleSaveUserPreferences,
  type ProfilePreferences,
} from '../lib/userPreferences';
import {
  CATEGORY_LABEL,
  TIER_LABEL,
  computeStats,
  dayKey,
  evaluateBadges,
  fetchMyActivity,
  levelFromXp,
  type BadgeDef,
  type CategoryId,
  type ProfileStats,
} from '../lib/profileStats';
import { showToast } from '../lib/toast';
import { UserAvatar } from './UserAvatar';

const ACCENTS: Record<string, { label: string; hex: string }> = {
  sky: { label: 'Niebieski', hex: '#0ea5e9' },
  emerald: { label: 'Zielony', hex: '#10b981' },
  violet: { label: 'Fioletowy', hex: '#8b5cf6' },
  rose: { label: 'Różowy', hex: '#f43f5e' },
  amber: { label: 'Bursztynowy', hex: '#f59e0b' },
  teal: { label: 'Morski', hex: '#14b8a6' },
  orange: { label: 'Pomarańczowy', hex: '#f97316' },
  slate: { label: 'Grafitowy', hex: '#94a3b8' },
};

const START_VIEWS: { id: View; label: string }[] = [
  { id: 'home', label: 'Start (strona główna)' },
  { id: 'catalog', label: 'Katalog' },
  { id: 'groups', label: 'Grupy produktów' },
  { id: 'favorites', label: 'Ulubione' },
];

const BADGE_ICON: Record<BadgeDef['icon'], typeof Trophy> = {
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
};

const TIER_COLOR = ['#475569', '#b45309', '#cbd5e1', '#facc15'] as const;

interface Props {
  gridDensity: 'sm' | 'md' | 'lg';
  onGridDensityChange: (d: 'sm' | 'md' | 'lg') => void;
}

/** „Mój profil”: personalizacja, statystyki pracy w katalogu i odznaki. */
export function UserProfileView({ gridDensity, onGridDensityChange }: Props) {
  const { profile, role, displayLabel, updateDisplayName } = useAuth();
  const { theme, setTheme } = useTheme();
  const userId = profile?.id;
  const avatar = useUserAvatar(userId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'overview' | 'badges' | 'settings'>('overview');
  const [prefs, setPrefs] = useState<ProfilePreferences>(() => getCachedProfilePreferences());
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const accent = ACCENTS[prefs.accent ?? 'sky'] ?? ACCENTS.sky;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyActivity(userId)
      .then((rows) => {
        if (!cancelled) setStats(computeStats(rows));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Nie udało się pobrać statystyk');
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function savePrefs(patch: Partial<ProfilePreferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (userId) scheduleSaveUserPreferences(userId, { profile: next });
  }

  async function onPickAvatar(file: File) {
    if (!userId) return;
    try {
      await saveUserAvatarFile(userId, file);
      showToast('Avatar zapisany', 'ok');
    } catch {
      showToast('Nie udało się zapisać avatara', 'error');
    }
  }

  async function saveName() {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!next || next === displayLabel) return;
    const { error: err } = await updateDisplayName(next);
    showToast(err ?? 'Nazwa zaktualizowana', err ? 'error' : 'ok');
  }

  const level = useMemo(() => levelFromXp(stats?.total ?? 0), [stats]);
  const badges = useMemo(() => (stats ? evaluateBadges(stats) : []), [stats]);
  const earned = badges.filter((b) => b.tier > 0);

  const card = 'rounded-2xl border border-slate-800 bg-slate-900/50 p-4';

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      {/* nagłówek profilu */}
      <div
        className="overflow-hidden rounded-3xl border border-slate-800"
        style={{ background: `linear-gradient(135deg, ${accent.hex}33, transparent 60%)` }}
      >
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="relative">
            <span className="block rounded-full p-1" style={{ background: accent.hex }}>
              <span className="block rounded-full bg-slate-950 p-0.5">
                <UserAvatar name={displayLabel} src={avatar} size="md" className="!h-20 !w-20 !text-xl" />
              </span>
            </span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 rounded-full border border-slate-700 bg-slate-900 p-1.5 text-slate-200 hover:bg-slate-800"
              title="Zmień avatar"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void onPickAvatar(f);
              }}
            />
          </div>

          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void saveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-950 px-2.5 py-1 text-lg font-bold text-slate-50"
                />
                <button type="button" onClick={() => void saveName()} className="rounded-lg bg-emerald-600 p-1.5 text-white">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-50">
                {displayLabel}
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(displayLabel);
                    setEditingName(true);
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800"
                  title="Zmień nazwę"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </h2>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-slate-950" style={{ background: accent.hex }}>
                {level.title} · poz. {level.level}
              </span>
              <span className="text-slate-400">{ROLE_LABELS[role] ?? role}</span>
              {profile?.email && <span className="text-xs text-slate-500">{profile.email}</span>}
            </p>
            {prefs.motto && <p className="mt-1 text-sm italic text-slate-300">„{prefs.motto}”</p>}
            <div className="mt-2 max-w-md">
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.round((level.xpIntoLevel / level.xpForNext) * 100))}%`,
                    background: accent.hex,
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {level.xpIntoLevel} / {level.xpForNext} punktów do poziomu {level.level + 1} · łącznie {level.xp} punktów pracy
              </p>
            </div>
          </div>

          <div className="flex gap-3 text-center">
            <Mini label="Seria" value={stats ? `${stats.currentStreak} dni` : '—'} />
            <Mini label="Odznaki" value={stats ? `${earned.length}/${badges.length}` : '—'} />
          </div>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        {(
          [
            ['overview', 'Statystyki'],
            ['badges', 'Odznaki'],
            ['settings', 'Ustawienia'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              tab === key ? 'bg-slate-700 text-slate-50' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Nie udało się pobrać Twoich statystyk: {error}. Jeśli to pierwsze uruchomienie, trzeba wykonać migrację
          migration-audit-log-self-read.sql w Supabase.
        </p>
      )}

      {tab === 'overview' &&
        (!stats && !error ? (
          <div className="flex justify-center py-12 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : stats ? (
          <Overview stats={stats} accent={accent.hex} card={card} />
        ) : null)}

      {tab === 'badges' && stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b) => {
            const Icon = BADGE_ICON[b.def.icon];
            const color = TIER_COLOR[b.tier];
            const target = b.next ?? b.def.tiers[2];
            return (
              <div key={b.def.id} className={`${card} ${b.tier === 0 ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{ background: color + '26', color, boxShadow: b.tier ? `0 0 0 2px ${color}` : undefined }}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-100">{b.def.name}</p>
                    <p className="text-xs text-slate-400">{b.def.desc.replace('{n}', String(target))}</p>
                    <p className="mt-1 text-[11px] font-semibold" style={{ color }}>
                      {b.tier ? TIER_LABEL[b.tier] : 'Jeszcze nie zdobyta'}
                      {b.tier === 3 ? ' — maksimum!' : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.round((b.value / target) * 100))}%`, background: color }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {b.value} / {target}
                  {b.next ? ` — do ${TIER_LABEL[(b.tier + 1) as 1 | 2 | 3].toLowerCase()}` : ''}
                </p>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'badges' && !stats && !error && (
        <div className="flex justify-center py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {tab === 'settings' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={card}>
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Personalizacja profilu</h3>
            <label className="block text-[11px] font-medium text-slate-400">
              Motto / opis (do 80 znaków)
              <input
                value={prefs.motto ?? ''}
                maxLength={80}
                onChange={(e) => savePrefs({ motto: e.target.value })}
                placeholder="np. Porządek w katalogu to połowa sprzedaży"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100"
              />
            </label>
            <p className="mt-3 text-[11px] font-medium text-slate-400">Kolor akcentu</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {Object.entries(ACCENTS).map(([key, a]) => (
                <button
                  key={key}
                  type="button"
                  title={a.label}
                  onClick={() => savePrefs({ accent: key })}
                  className={`h-8 w-8 rounded-full border-2 ${(prefs.accent ?? 'sky') === key ? 'border-white' : 'border-transparent'}`}
                  style={{ background: a.hex }}
                />
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              Tytuł zależy od poziomu (zdobywasz punkty za pracę w katalogu), a odznaki odblokowują się same.
            </p>
          </div>

          <div className={card}>
            <h3 className="mb-3 text-sm font-semibold text-slate-100">Ustawienia katalogu</h3>
            <label className="block text-[11px] font-medium text-slate-400">
              Po wejściu otwieraj
              <select
                value={prefs.startView ?? 'home'}
                onChange={(e) => savePrefs({ startView: e.target.value as View })}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100"
              >
                {START_VIEWS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-3 text-[11px] font-medium text-slate-400">Gęstość siatki produktów</p>
            <div className="mt-1 flex gap-1 rounded-lg border border-slate-800 p-0.5">
              {(
                [
                  ['lg', 'Duże kafelki'],
                  ['md', 'Średnie'],
                  ['sm', 'Małe'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onGridDensityChange(key)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                    gridDensity === key ? 'bg-slate-700 text-slate-50' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] font-medium text-slate-400">Motyw</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(Object.keys(THEME_LABELS) as ThemeMode[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                    theme === t ? 'border-slate-400 bg-slate-700 text-slate-50' : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {THEME_LABELS[t]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                if (userId) scheduleSaveUserPreferences(userId, { catalog: { sidebarOrder: [], sidebarHidden: [] } });
                showToast('Układ menu bocznego przywrócony — zobaczysz go po odświeżeniu strony', 'ok', 5000);
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Przywróć domyślny układ menu
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-2">
      <p className="text-lg font-bold text-slate-50">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function Overview({ stats, accent, card }: { stats: ProfileStats; accent: string; card: string }) {
  const cats = (Object.keys(CATEGORY_LABEL) as CategoryId[])
    .map((id) => ({ id, n: stats.counts[id] }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...cats.map((c) => c.n));

  // siatka aktywności: 16 tygodni × 7 dni (od poniedziałku)
  const weeks = 16;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7; // 0 = poniedziałek
  const start = new Date(today);
  start.setDate(start.getDate() - dow - (weeks - 1) * 7);
  const cells: { key: string; n: number; future: boolean }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: { key: string; n: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      const key = dayKey(day);
      col.push({ key, n: stats.perDay.get(key) ?? 0, future: day > today });
    }
    cells.push(col);
  }
  const shade = (n: number) => (n === 0 ? 0 : n <= 2 ? 0.3 : n <= 6 ? 0.55 : n <= 15 ? 0.8 : 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ostatnie 7 dni" value={stats.last7} />
        <Stat label="Ostatnie 30 dni" value={stats.last30} />
        <Stat label="Dni aktywności" value={stats.activeDays} />
        <Stat label="Najdłuższa seria" value={`${stats.bestStreak} dni`} />
      </div>

      <div className={card}>
        <h3 className="mb-3 text-sm font-semibold text-slate-100">Aktywność — ostatnie 16 tygodni</h3>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {cells.map((col, i) => (
            <div key={i} className="flex flex-col gap-1">
              {col.map((c) => (
                <span
                  key={c.key}
                  title={`${c.key}: ${c.n}`}
                  className="h-4 w-4 rounded-[4px]"
                  style={{
                    background: c.future ? 'transparent' : c.n === 0 ? '#1e293b' : accent,
                    opacity: c.future ? 0 : c.n === 0 ? 1 : shade(c.n),
                  }}
                />
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Im ciemniejszy kwadrat, tym więcej wykonanej pracy danego dnia. Weekend nie przerywa serii.</p>
      </div>

      <div className={card}>
        <h3 className="mb-3 text-sm font-semibold text-slate-100">Nad czym pracujesz (cały okres)</h3>
        <ul className="space-y-2">
          {cats.map((c) => (
            <li key={c.id}>
              <div className="flex justify-between text-xs text-slate-300">
                <span>{CATEGORY_LABEL[c.id]}</span>
                <span className="tabular-nums text-slate-400">{c.n}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full" style={{ width: `${(c.n / max) * 100}%`, background: accent }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate-500">
          Dane z dziennika aktywności za ostatnie 13 miesięcy. Logowań: {stats.logins}.
          {stats.firstAt ? ` Pierwsza zapisana aktywność: ${new Date(stats.firstAt).toLocaleDateString('pl-PL')}.` : ''}
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
      <p className="text-2xl font-bold tabular-nums text-slate-50">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}
