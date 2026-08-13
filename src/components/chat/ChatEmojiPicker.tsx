import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CHAT_EMOJI_GROUPS } from '../../lib/chatEmojis';

interface ChatEmojiPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  toggleAttr?: string;
  anchorRef?: RefObject<HTMLElement | null>;
  placement?: 'above' | 'below';
}

function EmojiPickerPanel({
  tab,
  onTabChange,
  onPick,
  onClose,
  className = '',
}: {
  tab: string;
  onTabChange: (id: string) => void;
  onPick: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const group = CHAT_EMOJI_GROUPS.find((g) => g.id === tab) ?? CHAT_EMOJI_GROUPS[0];

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 ${className}`}
      role="dialog"
      aria-label="Wybierz emotikonę"
    >
      <div className="flex gap-0.5 border-b border-slate-200 px-2 py-1.5 dark:border-slate-700">
        {CHAT_EMOJI_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onTabChange(g.id)}
            className={`rounded-lg px-2 py-1 text-[10px] font-medium transition ${
              tab === g.id
                ? 'bg-brand-500/15 text-brand-600 dark:text-brand-300'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid max-h-36 grid-cols-8 gap-0.5 overflow-y-auto p-2 sm:grid-cols-10">
        {group.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              onPick(emoji);
              onClose();
            }}
            className="flex h-9 w-full items-center justify-center rounded-lg text-xl leading-none transition hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function useMobileSheet() {
  const [mobile, setMobile] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return mobile;
}

export function ChatEmojiPicker({
  open,
  onClose,
  onPick,
  toggleAttr = 'data-chat-emoji-toggle',
  anchorRef,
  placement = 'above',
}: ChatEmojiPickerProps) {
  const [tab, setTab] = useState(CHAT_EMOJI_GROUPS[0]?.id ?? 'smile');
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const isMobileSheet = useMobileSheet();

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) {
      setAnchorRect(null);
      return;
    }
    const update = () => setAnchorRect(anchorRef.current!.getBoundingClientRect());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open || anchorRef) return;
    let armed = false;
    const armId = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        armed = true;
      });
    });
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (!armed) return;
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if ((target as HTMLElement).closest?.(`[${toggleAttr}]`)) return;
      onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    return () => {
      window.cancelAnimationFrame(armId);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [open, onClose, toggleAttr, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const panel = (
    <EmojiPickerPanel
      tab={tab}
      onTabChange={setTab}
      onPick={onPick}
      onClose={onClose}
      className={isMobileSheet && anchorRef ? 'rounded-b-none md:rounded-2xl' : ''}
    />
  );

  if (anchorRef && anchorRect) {
    if (isMobileSheet) {
      return createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[200] bg-black/40"
            aria-label="Zamknij wybór emotikon"
            onClick={onClose}
          />
          <div
            ref={panelRef}
            className="fixed inset-x-0 bottom-0 z-[201] max-h-[min(52dvh,20rem)]"
          >
            {panel}
          </div>
        </>,
        document.body,
      );
    }

    const placeAbove = placement === 'above' && anchorRect.top > 200;

    return createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[200]"
          aria-label="Zamknij wybór emotikon"
          onClick={onClose}
        />
        <div
          ref={panelRef}
          className="fixed z-[201] w-[min(calc(100vw-1rem),16rem)]"
          style={{
            left: Math.min(
              Math.max(8, anchorRect.left),
              window.innerWidth - 8 - Math.min(window.innerWidth - 16, 256),
            ),
            ...(placeAbove
              ? { bottom: window.innerHeight - anchorRect.top + 8 }
              : { top: anchorRect.bottom + 8 }),
          }}
        >
          {panel}
        </div>
      </>,
      document.body,
    );
  }

  return (
    <div ref={panelRef} className="absolute bottom-full left-0 right-0 z-10 mb-2">
      {panel}
    </div>
  );
}
