import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  Loader2,
  Pencil,
  Pin,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  Wrench,
  X,
} from 'lucide-react';
import type { Product, View } from '../types';
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
  FIX_IDS,
  FIX_LABEL,

  computeStats,
  dayKey,
  fetchMyActivity,
  levelFromXp,
  type ActivityRow,
  type CategoryId,
  type ProfileStats,
} from '../lib/profileStats';
import {
  ACHIEVEMENTS,
  ACH_CATEGORY_LABEL,
  ACH_CATEGORY_ORDER,
  TIER_NAMES,
  computeEarnedDates,
  computeTeamGoals,
  evaluateAchievements,
  type AchievementState,
  type TeamGoal,
  type Tier,
} from '../lib/achievements';
import { computeWeeklySummary } from '../lib/weeklySummary';
import {
  TASK_KIND_LABEL,
  completeTask,
  createTask,
  deleteTask,
  fetchTasks,
  reopenTask,
  suggestPhotoProducts,
  type CatalogTask,
  type TaskKind,
  type TaskLists,
} from '../lib/catalogTasks';
import { listChatPeers, type ChatPeer } from '../lib/chat';
import { buildTechEntries, getTechRecord, useTechVersion } from '../lib/techStore';
import { pushAppNotification } from '../lib/appNotifications';
import { BACKGROUNDS, FRAMES, OVERLAYS, isUnlocked, unlockedByLevelUp, type Cosmetic } from '../lib/profileCosmetics';
import { showToast } from '../lib/toast';
import { UserAvatar } from './UserAvatar';
import { ACH_ICON, BadgeMedal, TIER_PALETTE, tierTextStyle } from './BadgeMedal';
import { AchievementModal, UnlockCelebration, type Unlock } from './AchievementModals';
import { TechTypeIcon } from './TechTypeIcon';
import { AvatarFrame, ProfileBanner } from './ProfileCosmetics';
import { LevelsPanel } from './ProfileLevels';
import { BoardPanel } from './ProfileBoard';

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

interface Props {
  products: Product[];
  gridDensity: 'sm' | 'md' | 'lg';
  onGridDensityChange: (d: 'sm' | 'md' | 'lg') => void;
  onOpenProduct: (p: Product) => void;
  onOpenView: (v: View) => void;
}

/** „Mój profil”: personalizacja, moja kolejka zadań, statystyki, odznaki i cele zespołu. */
export function UserProfileView({ products, gridDensity, onGridDensityChange, onOpenProduct, onOpenView }: Props) {
  const { profile, role, displayLabel, updateDisplayName } = useAuth();
  const { theme, setTheme } = useTheme();
  const techVer = useTechVersion();
  const userId = profile?.id;
  const avatar = useUserAvatar(userId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'overview' | 'queue' | 'badges' | 'levels' | 'board' | 'settings'>('overview');
  const [prefs, setPrefs] = useState<ProfilePreferences>(() => getCachedProfilePreferences());
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [tasks, setTasks] = useState<TaskLists | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [unlocks, setUnlocks] = useState<Unlock[]>([]);

  const accent = ACCENTS[prefs.accent ?? 'sky'] ?? ACCENTS.sky;

  const loadTasks = useCallback(async () => {
    if (!userId) return;
    setTasks(await fetchTasks(userId));
  }, [userId]);

  const loadActivity = useCallback(() => {
    if (!userId) return Promise.resolve();
    return fetchMyActivity(userId)
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Nie udało się pobrać statystyk'));
  }, [userId]);

  useEffect(() => {
    void loadActivity();
    void loadTasks();
  }, [loadActivity, loadTasks]);

  const stats = useMemo<ProfileStats | null>(() => (rows ? computeStats(rows) : null), [rows]);
  const states = useMemo<AchievementState[]>(() => (stats ? evaluateAchievements(stats) : []), [stats]);
  // daty zdobycia odznak to najcięższe liczenie w profilu — robimy je po pierwszym wyrenderowaniu
  const [earnedDates, setEarnedDates] = useState<Record<string, (string | null)[]>>({});
  useEffect(() => {
    if (!rows) return;
    const t = window.setTimeout(() => setEarnedDates(computeEarnedDates(rows)), 30);
    return () => window.clearTimeout(t);
  }, [rows]);

  const summary = useMemo(
    () => (stats && rows ? computeWeeklySummary(stats, rows, earnedDates, displayLabel) : null),
    [stats, rows, earnedDates, displayLabel],
  );
  const entries = useMemo(() => buildTechEntries(products), [products, techVer]);
  const goals = useMemo(() => computeTeamGoals(products, entries), [products, entries]);

  function savePrefs(patch: Partial<ProfilePreferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (userId) scheduleSaveUserPreferences(userId, { profile: next });
  }

  // nowe odznaki od ostatniej wizyty → gratulacje + powiadomienie; podsumowanie poprzedniego tygodnia → powiadomienie
  useEffect(() => {
    if (!userId || states.length === 0 || !summary) return;
    const seen = prefs.seenAch;
    const current: Record<string, number> = {};
    for (const s of states) current[s.def.id] = s.tier;
    if (!seen) {
      // pierwsza wizyta po wdrożeniu: zapisujemy stan wyjściowy bez fajerwerków za całą historię
      savePrefs({ seenAch: current });
      return;
    }
    const fresh: Unlock[] = [];
    for (const s of states) {
      for (let t = (seen[s.def.id] ?? 0) + 1; t <= s.tier; t++) fresh.push({ id: s.def.id, tier: t as Tier });
    }
    if (fresh.length > 0) {
      setUnlocks(fresh);
      for (const u of fresh) {
        const def = ACHIEVEMENTS.find((a) => a.id === u.id);
        pushAppNotification({
          id: `ach-${userId}-${u.id}-${u.tier}`,
          kind: 'achievement',
          scope: 'catalog',
          userId,
          title: 'Nowa odznaka: ' + (def?.name ?? u.id),
          body: 'Stopień: ' + TIER_NAMES[u.tier],
          actionView: 'profile',
        });
      }
      savePrefs({ seenAch: current });
    }
    // podsumowanie ubiegłego tygodnia (raz na tydzień)
    const lastWeek = summary.lastWeek;
    if (lastWeek > 0) {
      pushAppNotification({
        id: `weekly-${userId}-${summary.prevWeekStart}`,
        kind: 'summary',
        scope: 'catalog',
        userId,
        title: 'Podsumowanie tygodnia',
        body: `Poprzedni tydzień: ${lastWeek} działań w katalogu. Zobacz swoje statystyki.`,
        actionView: 'profile',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, states, summary]);

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

  const level = useMemo(() => levelFromXp(stats?.xp ?? 0), [stats]);
  // wybrana kosmetyka musi być odblokowana (zanim wczytają się statystyki — ufamy zapisanym wyborom)
  const pick = (list: Cosmetic[], id: string | undefined, fallback: string) => {
    const c = list.find((x) => x.id === id);
    if (!c) return fallback;
    return !stats || isUnlocked(c, level.level, states) ? c.id : fallback;
  };
  const frame = pick(FRAMES, prefs.frame, 'classic');
  const bg = pick(BACKGROUNDS, prefs.bg, 'default');
  const overlay = pick(OVERLAYS, prefs.overlay, 'none');
  const earnedCount = states.filter((s) => s.tier > 0).length;

  useEffect(() => {
    if (!userId || !stats) return;
    const cur = level.level;
    if (prefs.seenLevel == null) {
      savePrefs({ seenLevel: cur });
      return;
    }
    if (cur > prefs.seenLevel) {
      const rewards = unlockedByLevelUp(prefs.seenLevel, cur);
      pushAppNotification({
        id: `level-${userId}-${cur}`,
        kind: 'achievement',
        scope: 'catalog',
        userId,
        title: `Awans! Poziom ${cur} — ${level.rank.name}`,
        body: rewards.length ? 'Nowe nagrody: ' + rewards.map((r) => r.name).join(', ') : 'Gratulacje, tak trzymaj!',
        actionView: 'profile',
      });
      showToast(`Awans na poziom ${cur}!${rewards.length ? ' Odblokowano: ' + rewards.map((r) => r.name).join(', ') : ''}`, 'ok', 7000);
      savePrefs({ seenLevel: cur });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, stats, level.level]);

  const starCount = states.reduce((a, s) => a + s.tier, 0);
  const openTasks = tasks?.mine.filter((t) => t.status === 'open').length ?? 0;
  const pinnedStates = (prefs.pinned ?? [])
    .map((id) => states.find((s) => s.def.id === id))
    .filter((s): s is AchievementState => !!s && s.tier > 0)
    .slice(0, 3);
  const detailState = states.find((s) => s.def.id === detail) ?? null;

  function togglePin(id: string) {
    const cur = prefs.pinned ?? [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-3);
    savePrefs({ pinned: next });
  }

  const card = 'rounded-2xl border border-slate-800 bg-slate-900/50 p-4';

  return (
    <section className="mx-auto max-w-5xl space-y-4">
      {/* nagłówek profilu */}
      <ProfileBanner bg={bg} overlay={overlay} accent={accent.hex} className="rounded-3xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <div className="relative">
            <AvatarFrame frame={frame} accent={accent.hex}>
              <UserAvatar name={displayLabel} src={avatar} size="md" className="!h-20 !w-20 !text-xl" />
            </AvatarFrame>
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
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-[#0b1220]" style={{ background: level.rank.color }}>

                Poziom {level.level} · {level.rank.name}
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
                    width: `${level.maxed ? 100 : Math.min(100, Math.round((level.xpIntoLevel / level.xpForNext) * 100))}%`,
                    background: level.rank.color,
                  }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {level.maxed ? 'Maksymalny poziom!' : `${level.xpIntoLevel} / ${level.xpForNext} punktów do poziomu ${level.level + 1}`} · łącznie {level.xp} punktów pracy
              </p>
            </div>
          </div>

          {/* gablota */}
          <div className="flex items-center gap-1">
            {pinnedStates.length > 0 ? (
              pinnedStates.map((s) => {
                const Icon = ACH_ICON[s.def.icon];
                return (
                  <button key={s.def.id} type="button" onClick={() => setDetail(s.def.id)} title={s.def.name}>
                    <BadgeMedal tier={s.tier} icon={<Icon strokeWidth={1.7} />} size={64} />
                  </button>
                );
              })
            ) : (
              <button
                type="button"
                onClick={() => setTab('badges')}
                className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-600 px-3 py-2 text-[11px] text-slate-400 hover:bg-slate-800/50"
              >
                <Pin className="h-3.5 w-3.5" />
                Przypnij odznaki do gabloty
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-slate-800 bg-slate-800 sm:grid-cols-4">
          <Mini label="Seria dni" value={stats ? `${stats.currentStreak}` : '—'} />
          <Mini label="Odznaki" value={stats ? `${earnedCount}/${ACHIEVEMENTS.length}` : '—'} />
          <Mini label="Gwiazdki" value={stats ? `${starCount}/${ACHIEVEMENTS.length * 4}` : '—'} />
          <Mini label="Zadania otwarte" value={tasks ? String(openTasks) : '—'} />
        </div>
      </ProfileBanner>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        {(
          [
            ['overview', 'Statystyki'],
            ['queue', `Moja kolejka${openTasks > 0 ? ` (${openTasks})` : ''}`],
            ['badges', 'Odznaki'],
            ['levels', 'Poziomy i nagrody'],
            ['board', 'Ranking'],
            ['settings', 'Ustawienia'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
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
          <Spinner />
        ) : stats && summary ? (
          <Overview stats={stats} summary={summary} accent={accent.hex} card={card} />
        ) : null)}

      {tab === 'queue' && (
        <QueuePanel
          tasks={tasks}
          products={products}
          entriesCount={entries.filter((e) => e.state === 'proposed' && e.confidence === 'ok').length}
          card={card}
          userId={userId}
          label={displayLabel}
          reload={() => {
            void loadTasks();
            void loadActivity();
          }}
          onOpenProduct={onOpenProduct}
          onOpenView={onOpenView}
        />
      )}

      {tab === 'badges' &&
        (!stats ? (
          error ? null : <Spinner />
        ) : (
          <BadgesPanel
            states={states}
            earnedDates={earnedDates}
            goals={goals}
            pinned={prefs.pinned ?? []}
            card={card}
            onOpen={setDetail}
            onOpenProduct={onOpenProduct}
          />
        ))}

      {tab === 'levels' && (
        <LevelsPanel
          level={level}
          states={states}
          accent={accent.hex}
          frame={frame}
          bg={bg}
          overlay={overlay}
          onPick={(kind, id) => savePrefs(kind === 'frame' ? { frame: id } : kind === 'bg' ? { bg: id } : { overlay: id })}
          card={card}
          ready={!!stats}
        />
      )}

      {tab === 'board' && <BoardPanel meId={userId} card={card} />}

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
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={!!prefs.hideFromBoard} onChange={(e) => savePrefs({ hideFromBoard: e.target.checked })} />
              Ukryj mnie w rankingu zespołu
            </label>
            <p className="mt-3 text-[11px] text-slate-500">
              Gablota w nagłówku pokazuje do 3 przypiętych odznak — przypinasz je w szczegółach odznaki. Ramkę, tło i nakładkę wybierasz w zakładce „Poziomy i nagrody”.
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

      {detailState && (
        <AchievementModal
          state={detailState}
          dates={earnedDates[detailState.def.id] ?? []}
          pinned={(prefs.pinned ?? []).includes(detailState.def.id)}
          onTogglePin={() => togglePin(detailState.def.id)}
          onClose={() => setDetail(null)}
        />
      )}
      {unlocks.length > 0 && <UnlockCelebration unlocks={unlocks} states={states} onClose={() => setUnlocks([])} />}
    </section>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-12 text-slate-500">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-950/70 px-4 py-2.5 text-center">
      <p className="text-lg font-bold tabular-nums text-slate-50">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

// =============================================================================================
// Statystyki + podsumowanie tygodnia
// =============================================================================================

function Overview({
  stats,
  summary,
  accent,
  card,
}: {
  stats: ProfileStats;
  summary: ReturnType<typeof computeWeeklySummary>;
  accent: string;
  card: string;
}) {
  const cats = (Object.keys(CATEGORY_LABEL) as CategoryId[])
    .map((id) => ({ id, n: stats.counts[id] }))
    .sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...cats.map((c) => c.n));

  const weeks = 16;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const dow = (today.getDay() + 6) % 7;
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
      {/* podsumowanie tygodnia */}
      <div className="rounded-2xl border border-slate-800 p-4" style={{ background: `linear-gradient(135deg, ${accent}22, transparent 70%)` }}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <Sparkles className="h-4 w-4" style={{ color: accent }} />
              Podsumowanie tygodnia
            </h3>
            <p className="mt-1 text-2xl font-bold text-slate-50">
              {summary.thisWeek} <span className="text-sm font-normal text-slate-400">działań w tym tygodniu</span>
            </p>
            <p className="text-xs text-slate-400">
              {summary.delta === 0
                ? `tyle samo co w poprzednim (${summary.lastWeek})`
                : summary.delta > 0
                  ? `o ${summary.delta} więcej niż w poprzednim (${summary.lastWeek})`
                  : `o ${-summary.delta} mniej niż w poprzednim (${summary.lastWeek})`}
              {' · '}dni aktywności: {summary.activeDays}
              {summary.topCategory ? ` · najwięcej: ${summary.topCategory.label} (${summary.topCategory.count})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(summary.text);
              showToast('Podsumowanie skopiowane — możesz je wkleić np. w czacie', 'ok');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            <Copy className="h-3.5 w-3.5" />
            Kopiuj
          </button>
        </div>
        {summary.newAchievements.length > 0 && (
          <p className="mt-2 text-xs text-amber-200">
            🏅 Nowe w tym tygodniu: {summary.newAchievements.map((a) => `${a.name} (${TIER_NAMES[a.tier]})`).join(', ')}
          </p>
        )}
        {summary.tasksDone > 0 && <p className="mt-1 text-xs text-emerald-300">✔ Wykonane zadania z kolejki: {summary.tasksDone}</p>}
      </div>

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
        <h3 className="mb-1 text-sm font-semibold text-slate-100">Naprawione dane</h3>
        <p className="mb-3 text-[11px] text-slate-500">
          Liczymy pola, które były puste, a Ty je uzupełniłeś/aś (dodatkowe punkty XP). Razem: {stats.fixesTotal}.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FIX_IDS.map((id) => (
            <Stat key={id} label={FIX_LABEL[id]} value={stats.fixes[id]} />
          ))}
        </div>
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

// =============================================================================================
// Odznaki + cele zespołu
// =============================================================================================

function BadgesPanel({
  states,
  earnedDates,
  goals,
  pinned,
  card,
  onOpen,
  onOpenProduct,
}: {
  states: AchievementState[];
  earnedDates: Record<string, (string | null)[]>;
  goals: TeamGoal[];
  pinned: string[];
  card: string;
  onOpen: (id: string) => void;
  onOpenProduct: (p: Product) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'earned' | 'progress'>('all');
  const [goalOpen, setGoalOpen] = useState<string | null>(null);
  const earned = states.filter((s) => s.tier > 0);
  const nearest = states
    .filter((s) => s.next != null)
    .sort((a, b) => b.progress - a.progress)[0];

  const shown = states.filter((s) => (filter === 'all' ? true : filter === 'earned' ? s.tier > 0 : s.tier < 4));
  const openGoal = goals.find((g) => g.id === goalOpen) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1 text-xs">
          {(
            [
              ['all', `Wszystkie (${states.length})`],
              ['earned', `Zdobyte (${earned.length})`],
              ['progress', 'W toku'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-lg px-3 py-1.5 font-medium ${filter === k ? 'bg-slate-700 text-slate-50' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              {l}
            </button>
          ))}
        </div>
        {nearest && nearest.next != null && (
          <p className="text-xs text-slate-400">
            Najbliżej: <b className="text-slate-200">{nearest.def.name}</b> — {nearest.value}/{nearest.next} do stopnia „
            {TIER_NAMES[(nearest.tier + 1) as Tier]}”
          </p>
        )}
      </div>

      {ACH_CATEGORY_ORDER.map((cat) => {
        const list = shown.filter((s) => s.def.category === cat);
        if (list.length === 0) return null;
        return (
          <div key={cat}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{ACH_CATEGORY_LABEL[cat]}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((s) => {
                const Icon = ACH_ICON[s.def.icon];
                const p = TIER_PALETTE[s.tier];
                const lastDate = s.tier > 0 ? earnedDates[s.def.id]?.[s.tier - 1] : null;
                return (
                  <button
                    key={s.def.id}
                    type="button"
                    onClick={() => onOpen(s.def.id)}
                    className="group relative flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/50 px-3 pb-3 pt-4 text-center transition hover:border-slate-600 hover:bg-slate-800/50"
                  >
                    {pinned.includes(s.def.id) && <Pin className="absolute right-2 top-2 h-3.5 w-3.5 text-slate-400" />}
                    <BadgeMedal tier={s.tier} icon={<Icon strokeWidth={1.7} />} size={84} />
                    <p className="mt-2 text-sm font-semibold text-slate-100">{s.def.name}</p>
                    <p className="tier-text text-[11px]" style={tierTextStyle(s.tier)}>
                      {TIER_NAMES[s.tier]}
                      {lastDate ? ` · ${new Date(lastDate + 'T12:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}` : ''}
                    </p>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round(s.progress * 100)}%`, background: s.tier ? p.star : '#475569' }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {s.value}
                      {s.next ? ` / ${s.next}` : ' · max'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* cele zespołu */}
      <div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">Cele zespołu — kompletność katalogu</h3>
        <p className="mb-2 text-[11px] text-slate-500">
          Wspólne osiągnięcia: odblokowują się, gdy cały zespół uzupełni katalog (50% brąz, 75% srebro, 90% złoto, 100% diament).
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {goals.map((g) => {
            const p = TIER_PALETTE[g.tier];
            const Icon = ACH_ICON[g.icon];
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoalOpen(g.id)}
                className="flex flex-col items-center rounded-2xl border border-slate-800 bg-slate-900/50 px-3 pb-3 pt-4 text-center transition hover:border-slate-600 hover:bg-slate-800/50"
              >
                <BadgeMedal
                  tier={g.tier}
                  icon={g.techType ? <TechTypeIcon type={g.techType} className="h-full w-full" /> : <Icon strokeWidth={1.7} />}
                  size={84}
                />
                <p className="mt-2 text-sm font-semibold text-slate-100">{g.name}</p>
                <p className="tier-text text-[11px]" style={tierTextStyle(g.tier)}>
                  {g.pct}% · {g.done}/{g.total}
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full" style={{ width: `${g.pct}%`, background: g.tier ? p.star : '#475569' }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {openGoal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 sm:items-center" onClick={() => setGoalOpen(null)}>
          <div className={`${card} max-h-[80vh] w-full max-w-lg overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-50">{openGoal.name}</h3>
                <p className="text-xs text-slate-400">
                  {openGoal.desc} — brakuje {openGoal.missing.length} z {openGoal.total}
                </p>
              </div>
              <button type="button" onClick={() => setGoalOpen(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800">
                <X className="h-4 w-4" />
              </button>
            </div>
            {openGoal.missing.length === 0 ? (
              <p className="py-6 text-center text-sm text-emerald-300">Cel osiągnięty — 100%! 🎉</p>
            ) : (
              <ul className="divide-y divide-slate-800">
                {openGoal.missing.slice(0, 80).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setGoalOpen(null);
                        onOpenProduct(p);
                      }}
                      className="flex w-full items-center gap-2 py-2 text-left text-sm text-slate-200 hover:text-white"
                    >
                      <span className="min-w-0 flex-1 truncate">{p.displayName || p.name}</span>
                      <span className="shrink-0 font-mono text-[11px] text-slate-500">{p.sku}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {openGoal.missing.length > 80 && <p className="mt-2 text-center text-[11px] text-slate-500">…i {openGoal.missing.length - 80} kolejnych</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================================
// Moja kolejka
// =============================================================================================

function QueuePanel({
  tasks,
  products,
  entriesCount,
  card,
  userId,
  label,
  reload,
  onOpenProduct,
  onOpenView,
}: {
  tasks: TaskLists | null;
  products: Product[];
  entriesCount: number;
  card: string;
  userId: string | undefined;
  label: string;
  reload: () => void;
  onOpenProduct: (p: Product) => void;
  onOpenView: (v: View) => void;
}) {
  const [peers, setPeers] = useState<ChatPeer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const productBySku = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) if (p.sku) m.set(p.sku.toUpperCase(), p);
    return m;
  }, [products]);
  const suggestions = useMemo(() => suggestPhotoProducts(products, 8), [products]);

  useEffect(() => {
    void listChatPeers().then(setPeers).catch(() => setPeers([]));
  }, []);

  // zadania wykonane „same” (zdjęcie dodane / opis zatwierdzony) zamykamy automatycznie
  useEffect(() => {
    if (!tasks) return;
    let changed = false;
    void (async () => {
      for (const t of tasks.mine) {
        if (t.status !== 'open' || !t.sku) continue;
        const p = productBySku.get(t.sku);
        if (!p) continue;
        const auto =
          (t.kind === 'photo' && p.hasImage) || (t.kind === 'tech' && getTechRecord(t.sku)?.status === 'approved');
        if (auto) {
          try {
            await completeTask(t, true);
            changed = true;
          } catch {
            /* ignoruj */
          }
        }
      }
      if (changed) reload();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, productBySku]);

  async function takeSuggestion(p: Product) {
    if (!userId) return;
    setBusy(p.id);
    try {
      await createTask(
        {
          title: 'Dodaj zdjęcie: ' + (p.displayName || p.name),
          kind: 'photo',
          sku: p.sku,
          productName: p.displayName || p.name,
          assignedTo: userId,
          assignedToLabel: label,
        },
        { id: userId, label },
      );
      showToast('Dodano do Twojej kolejki', 'ok');
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się dodać zadania', 'error', 7000);
    } finally {
      setBusy(null);
    }
  }

  async function act(id: string, fn: () => Promise<void>, okMsg?: string) {
    setBusy(id);
    try {
      await fn();
      if (okMsg) showToast(okMsg, 'ok');
      reload();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się', 'error', 7000);
    } finally {
      setBusy(null);
    }
  }

  if (!tasks) return <Spinner />;
  if (tasks.missing) {
    return (
      <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        Brak tabeli zadań w bazie — uruchom migration-catalog-tasks.sql w Supabase, żeby korzystać z kolejki.
      </p>
    );
  }

  const open = tasks.mine.filter((t) => t.status === 'open');
  const done = tasks.mine.filter((t) => t.status === 'done');
  const delegated = tasks.delegated;

  const TaskCard = ({ t, mine }: { t: CatalogTask; mine: boolean }) => {
    const product = t.sku ? productBySku.get(t.sku) : undefined;
    return (
      <li className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-slate-300">
          {t.kind === 'photo' ? <Camera className="h-4 w-4" /> : t.kind === 'tech' ? <Wrench className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${t.status === 'done' ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{t.title}</p>
          <p className="truncate text-[11px] text-slate-500">
            {mine
              ? t.createdBy !== t.assignedTo
                ? `od: ${t.createdByLabel || '—'}`
                : 'własne'
              : `dla: ${t.assignedToLabel || '—'}`}
            {t.sku ? ` · ${t.sku}` : ''}
            {t.doneAuto ? ' · zamknięte automatycznie' : ''}
          </p>
          {t.note && <p className="truncate text-[11px] text-slate-400">{t.note}</p>}
        </div>
        {product && (
          <button
            type="button"
            onClick={() => onOpenProduct(product)}
            className="shrink-0 rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            Otwórz produkt
          </button>
        )}
        {mine && t.status === 'open' && (
          <button
            type="button"
            disabled={busy === t.id}
            onClick={() => void act(t.id, () => completeTask(t), 'Zadanie wykonane')}
            className="shrink-0 rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 disabled:opacity-50"
            title="Oznacz jako wykonane"
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        {mine && t.status === 'done' && (
          <button
            type="button"
            disabled={busy === t.id}
            onClick={() => void act(t.id, () => reopenTask(t.id))}
            className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-slate-300 hover:bg-slate-800"
            title="Przywróć do kolejki"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        )}
        {!mine && (
          <button
            type="button"
            disabled={busy === t.id}
            onClick={() => void act(t.id, () => deleteTask(t.id))}
            className="shrink-0 rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800"
            title="Usuń zadanie"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Do zrobienia ({open.length})</h3>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            Nowe zadanie
          </button>
        </div>
        {showForm && userId && (
          <NewTaskForm
            peers={peers}
            userId={userId}
            label={label}
            productBySku={productBySku}
            onDone={() => {
              setShowForm(false);
              reload();
            }}
          />
        )}
        {open.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Kolejka jest pusta — świetnie! Poniżej podpowiedzi, co warto zrobić.</p>
        ) : (
          <ul className="space-y-2">
            {open.map((t) => (
              <TaskCard key={t.id} t={t} mine />
            ))}
          </ul>
        )}
      </div>

      <div className={card}>
        <h3 className="mb-1 text-sm font-semibold text-slate-100">Podpowiedzi — najważniejsze braki</h3>
        <p className="mb-2 text-[11px] text-slate-500">Produkty bez zdjęcia, od najlepiej sprzedających się (ostatnie 12 miesięcy).</p>
        {suggestions.length === 0 ? (
          <p className="py-3 text-center text-sm text-emerald-300">Wszystkie produkty mają zdjęcia 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {suggestions.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <button type="button" onClick={() => onOpenProduct(p)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm text-slate-100">{p.displayName || p.name}</span>
                  <span className="block font-mono text-[11px] text-slate-500">{p.sku}</span>
                </button>
                <button
                  type="button"
                  disabled={busy === p.id || open.some((t) => t.sku === p.sku.toUpperCase())}
                  onClick={() => void takeSuggestion(p)}
                  className="shrink-0 rounded-lg border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                >
                  {open.some((t) => t.sku === p.sku.toUpperCase()) ? 'W kolejce' : 'Biorę to'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {entriesCount > 0 && (
          <button
            type="button"
            onClick={() => onOpenView('groups')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            <Wrench className="h-3.5 w-3.5" />
            {entriesCount} pewnych propozycji opisów technicznych czeka na zatwierdzenie
          </button>
        )}
      </div>

      {delegated.length > 0 && (
        <div className={card}>
          <h3 className="mb-2 text-sm font-semibold text-slate-100">Przydzielone przeze mnie ({delegated.length})</h3>
          <ul className="space-y-2">
            {delegated.map((t) => (
              <TaskCard key={t.id} t={t} mine={false} />
            ))}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <div className={card}>
          <button type="button" onClick={() => setShowDone((v) => !v)} className="flex w-full items-center justify-between text-left">
            <h3 className="text-sm font-semibold text-slate-100">Wykonane (ostatnie 60 dni): {done.length}</h3>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition ${showDone ? 'rotate-180' : ''}`} />
          </button>
          {showDone && (
            <ul className="mt-2 space-y-2">
              {done.map((t) => (
                <TaskCard key={t.id} t={t} mine />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NewTaskForm({
  peers,
  userId,
  label,
  productBySku,
  onDone,
}: {
  peers: ChatPeer[];
  userId: string;
  label: string;
  productBySku: Map<string, Product>;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<TaskKind>('photo');
  const [sku, setSku] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [assignee, setAssignee] = useState(userId);
  const [saving, setSaving] = useState(false);

  const product = sku.trim() ? productBySku.get(sku.trim().toUpperCase()) : undefined;
  const people = [{ id: userId, displayName: label + ' (ja)' }, ...peers.map((p) => ({ id: p.id, displayName: p.displayName }))];
  const inp = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-slate-100';

  async function save() {
    const finalTitle = title.trim() || (product ? TASK_KIND_LABEL[kind] + ': ' + (product.displayName || product.name) : '');
    if (!finalTitle) {
      showToast('Podaj tytuł zadania albo prawidłowy kod produktu', 'warn');
      return;
    }
    setSaving(true);
    try {
      const who = people.find((p) => p.id === assignee);
      await createTask(
        {
          title: finalTitle,
          note,
          kind,
          sku: product?.sku ?? sku,
          productName: product ? product.displayName || product.name : '',
          assignedTo: assignee,
          assignedToLabel: (who?.displayName ?? '').replace(' (ja)', ''),
        },
        { id: userId, label },
      );
      showToast(assignee === userId ? 'Zadanie dodane do Twojej kolejki' : 'Zadanie przydzielone', 'ok');
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Nie udało się dodać zadania', 'error', 7000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-3 grid gap-2 rounded-xl border border-slate-700 bg-slate-950/50 p-3 sm:grid-cols-2">
      <label className="text-[11px] text-slate-400">
        Rodzaj
        <select className={inp} value={kind} onChange={(e) => setKind(e.target.value as TaskKind)}>
          {(Object.keys(TASK_KIND_LABEL) as TaskKind[]).map((k) => (
            <option key={k} value={k}>
              {TASK_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] text-slate-400">
        Dla kogo
        <select className={inp} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11px] text-slate-400">
        Kod produktu (SKU, opcjonalnie)
        <input className={inp} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="np. HYD000335" />
        {sku.trim() && (
          <span className={`mt-0.5 block text-[11px] ${product ? 'text-emerald-300' : 'text-amber-300'}`}>
            {product ? product.displayName || product.name : 'Nie znaleziono takiego produktu'}
          </span>
        )}
      </label>
      <label className="text-[11px] text-slate-400">
        Tytuł (puste = z rodzaju i produktu)
        <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="text-[11px] text-slate-400 sm:col-span-2">
        Notatka (opcjonalnie)
        <input className={inp} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="flex justify-end sm:col-span-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Dodaj zadanie
        </button>
      </div>
    </div>
  );
}

