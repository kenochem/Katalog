import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Smile } from 'lucide-react';
import { ChatEmojiPicker } from './ChatEmojiPicker';
import { QUICK_REACTIONS, type ReactionChip } from '../../lib/chatReactions';

interface ReactionBaseProps {
  messageId: string;
  reactions: ReactionChip[];
  onReact: (emoji: string) => void;
  align: 'left' | 'right';
}

export function ChatReactionChips({
  messageId,
  reactions,
  onReact,
  align,
}: ReactionBaseProps) {
  if (reactions.length === 0) return null;

  return (
    <div
      className={`chat-reaction-chips flex flex-wrap gap-0.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
    >
      {reactions.map((r) => (
        <button
          key={`${messageId}-${r.emoji}`}
          type="button"
          onClick={() => onReact(r.emoji)}
          className={`chat-reaction-chip inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition ${
            r.reactedByMe ? 'chat-reaction-chip-active' : ''
          }`}
          title={`${r.count} reakcji`}
        >
          <span className="text-sm leading-none">{r.emoji}</span>
          {r.count > 1 && (
            <span className="chat-reaction-count tabular-nums text-[10px]">{r.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  centerX: number;
}

function useAnchorRect(open: boolean, anchorRef: RefObject<HTMLElement | null>) {
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setRect(null);
      return;
    }

    const update = () => {
      const r = anchorRef.current!.getBoundingClientRect();
      setRect({
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        centerX: r.left + r.width / 2,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  return rect;
}

export function ChatReactionAddButton({ onReact }: Pick<ReactionBaseProps, 'onReact'>) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const menuOpen = quickOpen || pickerOpen;
  const anchorRect = useAnchorRect(menuOpen, anchorRef);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setQuickOpen(false);
        setPickerOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const closeAll = () => {
    setQuickOpen(false);
    setPickerOpen(false);
  };

  const portal =
    menuOpen && anchorRect
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[200]"
              aria-label="Zamknij"
              onClick={closeAll}
            />
            {quickOpen && !pickerOpen && (
              <div
                className="chat-reaction-quick-menu fixed z-[201] flex max-w-[min(calc(100vw-1rem),20rem)] flex-nowrap gap-0.5 rounded-full border border-slate-200 bg-white px-1 py-0.5 shadow-lg dark:border-slate-700 dark:bg-slate-800"
                style={{
                  top: anchorRect.top > 56 ? anchorRect.top - 8 : anchorRect.bottom + 8,
                  left: anchorRect.centerX,
                  transform: `translate(-50%, ${anchorRect.top > 56 ? '-100%' : '0'})`,
                }}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(emoji);
                      closeAll();
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg transition hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setQuickOpen(false);
                    setPickerOpen(true);
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label="Więcej emotikon"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}
            {pickerOpen && (
              <div
                className="fixed z-[201] w-64 max-w-[calc(100vw-1rem)]"
                style={{
                  top: anchorRect.top > 280 ? anchorRect.top - 8 : anchorRect.bottom + 8,
                  left: Math.min(Math.max(anchorRect.centerX, 136), window.innerWidth - 136),
                  transform: `translate(-50%, ${anchorRect.top > 280 ? '-100%' : '0'})`,
                }}
              >
                <ChatEmojiPicker
                  open={pickerOpen}
                  onClose={() => setPickerOpen(false)}
                  onPick={(emoji) => {
                    onReact(emoji);
                    closeAll();
                  }}
                />
              </div>
            )}
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={() => setQuickOpen((v) => !v)}
        className="chat-reaction-add flex h-7 w-7 items-center justify-center rounded-full data-[open=true]:opacity-100"
        data-open={menuOpen}
        aria-label="Dodaj reakcję"
        aria-expanded={menuOpen}
      >
        <Smile className="h-4 w-4" />
      </button>
      {portal}
    </>
  );
}
