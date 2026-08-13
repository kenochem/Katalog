import { useEffect, useRef, useState } from 'react';
import { Copy, MoreHorizontal, Pencil, Reply, Trash2 } from 'lucide-react';
import { ChatReactionAddButton } from './ChatMessageReactions';

interface ChatMessageActionsProps {
  onReply: () => void;
  onReact: (emoji: string) => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  side: 'left' | 'right';
}

function MessageMoreMenu({
  onReply,
  onCopy,
  onEdit,
  onDelete,
  side,
}: {
  onReply: () => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  side: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="chat-reaction-add flex h-7 w-7 items-center justify-center rounded-full data-[open=true]:opacity-100"
        data-open={open}
        title="Więcej"
        aria-label="Więcej akcji"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          className={`chat-msg-menu absolute bottom-full z-30 mb-1 min-w-[9.5rem] overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900 py-1 shadow-xl ${
            side === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <MenuItem
            icon={<Reply className="h-3.5 w-3.5" />}
            label="Odpowiedz"
            onClick={() => {
              onReply();
              close();
            }}
          />
          <MenuItem
            icon={<Copy className="h-3.5 w-3.5" />}
            label="Kopiuj"
            onClick={() => {
              onCopy();
              close();
            }}
          />
          {onEdit && (
            <MenuItem
              icon={<Pencil className="h-3.5 w-3.5" />}
              label="Edytuj"
              onClick={() => {
                onEdit();
                close();
              }}
            />
          )}
          {onDelete && (
            <MenuItem
              icon={<Trash2 className="h-3.5 w-3.5" />}
              label="Usuń"
              tone="danger"
              onClick={() => {
                onDelete();
                close();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium transition hover:bg-white/5 ${
        tone === 'danger' ? 'text-rose-400' : 'text-slate-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export function ChatMessageActions({
  onReply,
  onReact,
  onCopy,
  onEdit,
  onDelete,
  side,
}: ChatMessageActionsProps) {
  return (
    <div className="chat-msg-actions mb-1 flex shrink-0 flex-row items-center gap-0.5 self-end">
      <ChatReactionAddButton onReact={onReact} />
      <MessageMoreMenu onReply={onReply} onCopy={onCopy} onEdit={onEdit} onDelete={onDelete} side={side} />
    </div>
  );
}
