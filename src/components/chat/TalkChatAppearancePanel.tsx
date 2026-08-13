import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronLeft,
  Palette,
  RefreshCw,
  RotateCcw,
  Send,
} from 'lucide-react';
import {
  TALK_CHAT_ACCENT_COLORS,
  TALK_CHAT_MESSAGE_SPACING,
  TALK_CHAT_PANEL_THEMES,
  TALK_CHAT_WALLPAPERS,
  TALK_QUICK_SEND_EMOJIS,
  loadTalkChatAppearance,
  resetTalkChatAppearance,
  saveTalkChatAppearance,
  setTalkChatSoundsEnabled,
  isTalkChatSoundsEnabled,
  type TalkChatAppearance,
  type TalkChatBubbleStyle,
  type TalkChatFontSize,
} from '../../lib/talkChatAppearance';
import { showToast } from '../../lib/toast';
import {
  isWebPushSupported,
  requestNotificationPermission,
  getTalkPushDiagnostics,
  subscribeTalkWebPush,
  sendTalkPushSelfTest,
  talkPushStatus,
  type TalkPushDiagnostics,
  type TalkPushSendResult,
} from '../../lib/push/talkWebPush';
import { disableTalkPush, isTalkVapidConfigured } from '../../lib/push/talkPushSync';

interface TalkChatAppearancePanelProps {
  onClose: () => void;
  userId?: string;
}

export function TalkChatAppearancePanel({ onClose, userId }: TalkChatAppearancePanelProps) {
  const [appearance, setAppearance] = useState<TalkChatAppearance>(() => loadTalkChatAppearance());
  const [soundsOn, setSoundsOn] = useState(isTalkChatSoundsEnabled);
  const [pushBusy, setPushBusy] = useState(false);
  const [diagBusy, setDiagBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<TalkPushDiagnostics | null>(null);
  const [testResult, setTestResult] = useState<TalkPushSendResult | null>(null);
  const pushStatus = talkPushStatus();

  useEffect(() => {
    const sync = () => {
      setAppearance(loadTalkChatAppearance());
      setSoundsOn(isTalkChatSoundsEnabled());
    };
    window.addEventListener('katalog-talk-chat-appearance', sync);
    return () => window.removeEventListener('katalog-talk-chat-appearance', sync);
  }, []);

  useEffect(() => {
    if (!userId) return;
    void refreshDiagnostics();
  }, [userId]);

  function patch(p: Partial<TalkChatAppearance>) {
    saveTalkChatAppearance(p);
    setAppearance(loadTalkChatAppearance());
  }

  function handleReset() {
    resetTalkChatAppearance();
    setAppearance(loadTalkChatAppearance());
    setSoundsOn(isTalkChatSoundsEnabled());
    showToast('Przywrocono domyslny wyglad czatu', 'info');
  }

  async function enablePush() {
    if (!userId) return;
    if (!isTalkVapidConfigured()) {
      showToast('Push wymaga klucza VAPID w buildzie Talk', 'warn');
      return;
    }
    setPushBusy(true);
    try {
      await requestNotificationPermission();
      await subscribeTalkWebPush(userId);
      patch({ pushEnabled: true });
      await refreshDiagnostics();
      showToast('Powiadomienia push wlaczone na tym urzadzeniu', 'ok');
    } catch {
      showToast('Nie udalo sie wlaczyc powiadomien push', 'error');
    } finally {
      setPushBusy(false);
    }
  }

  async function refreshDiagnostics() {
    setDiagBusy(true);
    try {
      setDiagnostics(await getTalkPushDiagnostics(userId));
    } finally {
      setDiagBusy(false);
    }
  }

  async function sendPushTest() {
    if (!userId) return;
    setTestBusy(true);
    setTestResult(null);
    try {
      const result = await sendTalkPushSelfTest(userId);
      setTestResult(result);
      await refreshDiagnostics();
      showToast(
        result.ok && (result.sent ?? 0) > 0
          ? 'Test push wyslany'
          : 'Test push nie wyslal powiadomienia',
        result.ok && (result.sent ?? 0) > 0 ? 'ok' : 'warn',
      );
    } catch {
      showToast('Test push nie powiodl sie', 'error');
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="talk-settings-panel flex h-full flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
          aria-label="Wróć"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <Palette className="h-4 w-4 text-brand-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Wygląd i dźwięki</p>
          <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300">Motyw, tło rozmowy, powiadomienia</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex h-9 items-center gap-1 rounded-xl px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div className="mx-auto w-full flex-1 space-y-5 overflow-y-auto p-4 md:max-w-2xl md:p-5">
        <section>
          <SectionLabel title="Motyw okna czatu" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TALK_CHAT_PANEL_THEMES.map((t) => (
              <OptionCard
                key={t.id}
                active={appearance.panelTheme === t.id}
                title={t.label}
                desc={t.hint}
                onClick={() => patch({ panelTheme: t.id })}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionLabel title="Kolor własnych wiadomości" />
          <div className="flex flex-wrap gap-2">
            {TALK_CHAT_ACCENT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => patch({ accentColor: c.id })}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] transition ${
                  appearance.accentColor === c.id
                    ? 'border-brand-500/50 bg-brand-500/10 text-brand-900 dark:text-brand-100'
                    : 'border-slate-400 bg-white text-slate-900 hover:border-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'
                }`}
              >
                <span
                  className="h-4 w-4 rounded-full ring-1 ring-black/10 dark:ring-white/20"
                  style={{ background: c.swatch }}
                  aria-hidden
                />
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel title="Tło rozmowy" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TALK_CHAT_WALLPAPERS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => patch({ wallpaper: w.id })}
                className={`overflow-hidden rounded-xl ring-2 transition ${
                  appearance.wallpaper === w.id
                    ? 'ring-brand-500'
                    : 'ring-transparent hover:ring-slate-300 dark:hover:ring-slate-600'
                }`}
              >
                <div className={`talk-wallpaper talk-wallpaper-${w.id} h-14 w-full`} />
                <span className="block bg-white px-2 py-1 text-[10px] font-medium text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                  {w.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel title="Wiadomości" />
          <p className="mb-2 text-[11px] font-medium text-slate-700 dark:text-slate-300">Kształt bańek</p>
          <div className="mb-3 flex gap-2">
            {(
              [
                ['rounded', 'Zaokrąglone'],
                ['square', 'Kwadratowe'],
              ] as const
            ).map(([id, label]) => (
              <ToggleChip
                key={id}
                active={appearance.bubbleStyle === id}
                label={label}
                onClick={() => patch({ bubbleStyle: id as TalkChatBubbleStyle })}
              />
            ))}
          </div>
          <p className="mb-2 text-[11px] font-medium text-slate-700 dark:text-slate-300">Rozmiar tekstu</p>
          <div className="mb-3 flex gap-2">
            {(
              [
                ['sm', 'Mały'],
                ['md', 'Normalny'],
                ['lg', 'Duży'],
              ] as const
            ).map(([id, label]) => (
              <ToggleChip
                key={id}
                active={appearance.fontSize === id}
                label={label}
                onClick={() => patch({ fontSize: id as TalkChatFontSize })}
              />
            ))}
          </div>
          <p className="mb-2 text-[11px] font-medium text-slate-700 dark:text-slate-300">Odstępy</p>
          <div className="flex gap-2">
            {TALK_CHAT_MESSAGE_SPACING.map((s) => (
              <ToggleChip
                key={s.id}
                active={appearance.messageSpacing === s.id}
                label={s.label}
                onClick={() => patch({ messageSpacing: s.id })}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionLabel title="Przycisk wysyłania (puste pole)" />
          <div className="flex flex-wrap gap-2">
            {TALK_QUICK_SEND_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => patch({ quickSendEmoji: emoji })}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${
                  appearance.quickSendEmoji === emoji
                    ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/30'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel title="Wygoda" />
          <div className="space-y-2">
            <ToggleRow
              label="Awatary przy wiadomościach"
              checked={appearance.showAvatars}
              onChange={(v) => patch({ showAvatars: v })}
            />
            <ToggleRow
              label="Godzina przy każdej wiadomości"
              checked={appearance.showTimestampsEvery}
              onChange={(v) => patch({ showTimestampsEvery: v })}
            />
            <ToggleRow
              label="Haczyki dostarczenia i odczytu"
              desc="Szare = dostarczono, niebieskie = odczytano"
              checked={appearance.showReadReceipts}
              onChange={(v) => patch({ showReadReceipts: v })}
            />
            <ToggleRow
              label="Enter wysyła wiadomość"
              checked={appearance.enterToSend}
              onChange={(v) => patch({ enterToSend: v })}
            />
            <ToggleRow
              label="Dźwięki (nowa wiadomość + wysłanie)"
              checked={soundsOn}
              onChange={(v) => {
                setTalkChatSoundsEnabled(v);
                setSoundsOn(v);
                showToast(v ? 'Dzwieki czatu wlaczone' : 'Dzwieki czatu wylaczone', 'info');
              }}
            />
            <ToggleRow
              label="Powiadomienia push (PWA / telefon)"
              desc={
                pushStatus === 'unsupported'
                  ? 'Brak Web Push w tej przeglądarce'
                  : pushStatus === 'denied'
                    ? 'Zablokowane w ustawieniach systemu'
                    : !isTalkVapidConfigured()
                      ? 'Brak klucza VAPID w buildzie — patrz TALK-CHAT-ETAP2.md'
                      : 'Nowe wiadomości na telefonie (PWA na ekranie głównym)'
              }
              checked={appearance.pushEnabled}
              onChange={(v) => {
                patch({ pushEnabled: v });
                if (v && userId && pushStatus !== 'denied') void enablePush();
                if (!v && userId) {
                  void disableTalkPush(userId);
                  showToast('Powiadomienia push wylaczone', 'info');
                }
              }}
            />
            {appearance.pushEnabled && userId && pushStatus === 'prompt' ? (
              <button
                type="button"
                disabled={pushBusy || !isWebPushSupported()}
                onClick={() => void enablePush()}
                className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
              >
                {pushBusy ? 'Włączanie…' : 'Zezwól na powiadomienia'}
              </button>
            ) : null}
            {appearance.pushEnabled && userId ? (
              <PushDiagnosticsCard
                diagnostics={diagnostics}
                testResult={testResult}
                busy={diagBusy}
                testBusy={testBusy}
                onRefresh={() => void refreshDiagnostics()}
                onTest={() => void sendPushTest()}
              />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function PushDiagnosticsCard({
  diagnostics,
  testResult,
  busy,
  testBusy,
  onRefresh,
  onTest,
}: {
  diagnostics: TalkPushDiagnostics | null;
  testResult: TalkPushSendResult | null;
  busy: boolean;
  testBusy: boolean;
  onRefresh: () => void;
  onTest: () => void;
}) {
  const ready =
    diagnostics?.supported &&
    diagnostics.vapidConfigured &&
    diagnostics.permission === 'granted' &&
    diagnostics.serviceWorkerReady &&
    diagnostics.hasBrowserSubscription &&
    diagnostics.currentEndpointSaved;
  const lastSaved = diagnostics?.latestSavedAt
    ? new Date(diagnostics.latestSavedAt).toLocaleString('pl-PL')
    : null;

  return (
    <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/70">
      <div className="mb-2 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Diagnostyka push
          </p>
          <p className="text-[10px] text-slate-600 dark:text-slate-300">
            Testuje dokladnie to urzadzenie i zapis w Supabase.
          </p>
        </div>
        {ready ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        )}
      </div>

      <div className="grid gap-1.5 text-[11px] text-slate-700 dark:text-slate-200 sm:grid-cols-2">
        <PushDiagLine label="Web Push" ok={diagnostics?.supported} />
        <PushDiagLine label="Klucz VAPID w aplikacji" ok={diagnostics?.vapidConfigured} />
        <PushDiagLine label="Zgoda systemu" ok={diagnostics?.permission === 'granted'} value={diagnostics?.permission} />
        <PushDiagLine label="Service worker" ok={diagnostics?.serviceWorkerReady} />
        <PushDiagLine label="Subskrypcja telefonu" ok={diagnostics?.hasBrowserSubscription} />
        <PushDiagLine label="Zapis w Supabase" ok={diagnostics?.currentEndpointSaved} value={diagnostics?.dbSubscriptionCount == null ? undefined : `${diagnostics.dbSubscriptionCount}`} />
      </div>

      {diagnostics?.displayMode === 'browser' ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Na iPhonie push dziala dopiero po dodaniu Talk do ekranu poczatkowego.
        </p>
      ) : null}

      {lastSaved ? (
        <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
          Ostatni zapis telefonu: {lastSaved}
        </p>
      ) : null}

      {testResult ? (
        <div
          className={`mt-2 rounded-lg px-2 py-1.5 text-[11px] ${
            testResult.ok && (testResult.sent ?? 0) > 0
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200'
          }`}
        >
          {testResult.ok ? (
            <span>
              Test: wyslano {testResult.sent ?? 0}, proby {testResult.attempted ?? 0},
              subskrypcje {testResult.subscriptions ?? 0}, bledy {testResult.failed ?? 0}.
            </span>
          ) : (
            <span>{testResult.error || 'Test push nie powiodl sie.'}</span>
          )}
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={busy || testBusy}
          className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
          Odswiez
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={busy || testBusy}
          className="inline-flex items-center justify-center gap-1 rounded-xl bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {testBusy ? 'Wysylam...' : 'Test push'}
        </button>
      </div>
    </div>
  );
}

function PushDiagLine({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean | null | undefined;
  value?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 dark:bg-slate-950">
      <span className="truncate">{label}</span>
      <span
        className={`shrink-0 font-semibold ${
          ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
        }`}
      >
        {value || (ok ? 'OK' : 'Sprawdz')}
      </span>
    </div>
  );
}

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">{title}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}

function OptionCard({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? 'border-brand-500/60 bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-100'
          : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
      }`}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-300">{desc}</p>
    </button>
  );
}

function ToggleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium ${
        active
          ? 'border-brand-500/60 bg-brand-50 text-brand-900 dark:bg-brand-500/15 dark:text-brand-100'
          : 'border-slate-400 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
      }`}
    >
      {label}
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
      <span>
        <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{label}</span>
        {desc ? <span className="mt-0.5 block text-[10px] text-slate-600 dark:text-slate-300">{desc}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600"
      />
    </label>
  );
}
