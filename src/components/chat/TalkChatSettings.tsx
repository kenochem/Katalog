import {
  loadTalkChatFontSize,
  saveTalkChatFontSize,
  type TalkChatFontSize,
} from '../../lib/talkChatAppearance';

export function TalkChatFontSizePicker({
  fontSize,
  onPick,
  className = '',
}: {
  fontSize: TalkChatFontSize;
  onPick: (id: TalkChatFontSize) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {(
        [
          ['sm', 'Mały'],
          ['md', 'Normalny'],
          ['lg', 'Duży'],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
            fontSize === id
              ? 'border-brand-500/50 bg-brand-500/10 text-brand-800 dark:text-brand-300'
              : 'border-slate-200 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function TalkChatSettingsPanel({
  fontSize,
  onPickFont,
  onClose,
  variant = 'inline',
}: {
  fontSize: TalkChatFontSize;
  onPickFont: (id: TalkChatFontSize) => void;
  onClose?: () => void;
  variant?: 'inline' | 'sheet';
}) {
  function pick(id: TalkChatFontSize) {
    saveTalkChatFontSize(id);
    onPickFont(id);
  }

  const body = (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Rozmiar tekstu wiadomości
        </p>
        <TalkChatFontSizePicker fontSize={fontSize} onPick={pick} className="mt-2" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        <p className="font-medium text-slate-800 dark:text-slate-200">Skróty</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <kbd className="rounded bg-white px-1 font-mono dark:bg-slate-800">Enter</kbd> — wyślij
          </li>
          <li>
            <kbd className="rounded bg-white px-1 font-mono dark:bg-slate-800">Shift+Enter</kbd> —
            nowa linia
          </li>
        </ul>
        <p className="mt-3 font-medium text-slate-800 dark:text-slate-200">Wiadomości</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Odpowiedz — cytat pod wiadomością</li>
          <li>Dzięki — podziękowanie widoczne dla zespołu</li>
          <li>Emotikony — przycisk obok pola tekstu</li>
        </ul>
      </div>
    </div>
  );

  if (variant === 'sheet') {
    return (
      <div className="flex h-full flex-col bg-white dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Ustawienia Talk
          </p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              Gotowe
            </button>
          ) : null}
        </div>
        <div className="flex-1 overflow-y-auto p-4">{body}</div>
      </div>
    );
  }

  return body;
}

export { loadTalkChatFontSize };
