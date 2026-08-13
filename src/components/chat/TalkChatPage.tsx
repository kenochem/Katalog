import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  Component,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import {
  CheckCheck,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownRight,
  FileText,
  Loader2,
  MessageCircle,
  Paperclip,
  Pencil,
  Pin,
  Search,
  Send,
  Settings2,
  Smile,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ChatSwipeReply } from './ChatSwipeReply';
import { ChatMessageActions } from './ChatMessageActions';
import { ChatReactionChips } from './ChatMessageReactions';
import { DELETED_MESSAGE_LABEL, isMessageDeleted } from '../../lib/chatMessageMeta';
import { QUICK_REACTIONS, type ReactionChip } from '../../lib/chatReactions';
import { useChatPanel } from './useChatPanel';
import {
  chatBodySnippet,
  chatDayLabel,
  chatMessagesGrouped,
  formatChatTime,
} from './chatUi';
import { UserAvatar } from '../UserAvatar';
import { ChatEmojiPicker } from './ChatEmojiPicker';
import { insertEmojiInText } from '../../lib/chatEmojis';
import {
  loadTalkChatAppearance,
  talkChatFontClass,
  talkChatShellClasses,
  talkWallpaperClass,
  talkMessageSpacingClass,
  type TalkChatAppearance,
} from '../../lib/talkChatAppearance';
import { TalkChatAppearancePanel } from './TalkChatAppearancePanel';
import {
  parseChatBody,
  inboxBodyPreview,
  formatAttachmentSize,
  attachmentPreviewLabel,
} from '../../lib/chatAttachments';
import { ChatVoiceRecordButton } from './ChatVoiceRecordButton';
import { ChatVoicePlayer } from './ChatVoicePlayer';
import type { ChatMessage, ChatPeer, ChatInboxSnippet } from '../../lib/chat';
import { GENERAL_THREAD_ID } from '../../lib/chat';
import { CHAT_FILE_MAX_BYTES } from '../../lib/chatFiles';
import { TALK_GIFS, type TalkGif } from '../../lib/chatGifs';
import {
  loadTalkPinnedThreads,
  talkDmPinId,
  toggleTalkPinnedThread,
} from '../../lib/talkPinnedThreads';
import { showToast } from '../../lib/toast';
import { loadTalkDmThreadId, talkDraftPreview } from '../../lib/talkThreadDrafts';

function useIsMobileLayout() {
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

function chatMessageCopyText(body: string): string {
  const parsed = parseChatBody(body);
  const text = parsed.text.trim();
  if (!parsed.attachmentKind) return text;

  const parts: string[] = [];
  if (text) parts.push(text);
  if (parsed.attachmentKind === 'file') parts.push(parsed.fileName || 'Plik');
  if (parsed.attachmentKind === 'gif') parts.push(parsed.gifLabel ? `GIF: ${parsed.gifLabel}` : 'GIF');
  if (parsed.attachmentKind === 'voice') parts.push('Wiadomosc glosowa');
  if (parsed.attachmentUrl) parts.push(parsed.attachmentUrl);
  return parts.join('\n').trim();
}

async function copyChatMessage(body: string) {
  const text = chatMessageCopyText(body);
  if (!text) {
    showToast('Brak tresci do skopiowania', 'warn');
    return;
  }

  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(text);
    showToast('Skopiowano wiadomosc', 'ok');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast(copied ? 'Skopiowano wiadomosc' : 'Nie udalo sie skopiowac', copied ? 'ok' : 'error');
  }
}

function ChatErrorBanner({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="shrink-0 border-b border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
      {error}
      {(error.toLowerCase().includes('chat-voice') || error.toLowerCase().includes('głosówk')) && (
        <span className="mt-1 block text-rose-600/80 dark:text-rose-400/80">
          Głosówki: uruchom{' '}
          <code className="font-mono">supabase/migration-chat-voice-bucket.sql</code> w SQL Editor.
        </span>
      )}
      {error.toLowerCase().includes('relation') ||
      error.toLowerCase().includes('function') ||
      error.toLowerCase().includes('schema cache') ? (
        <span className="mt-1 block text-rose-600/80 dark:text-rose-400/80">
          Uruchom migrację{' '}
          <code className="font-mono">supabase/migration-chat.sql</code> w SQL Editor.
          {(error.toLowerCase().includes('reply_to') ||
            error.toLowerCase().includes('thanks') ||
            error.toLowerCase().includes('reaction')) && (
            <span className="mt-1 block">
              Dla odpowiedzi, reakcji i edycji:{' '}
              <code className="font-mono">supabase/migration-chat-reply-thanks.sql</code>
              {' · '}
              <code className="font-mono">supabase/migration-chat-reactions-edit.sql</code>
            </span>
          )}
        </span>
      ) : null}
    </div>
  );
}

class TalkChatPanelBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('TalkChatPanel', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-300">
            Nie udało się wyświetlić czatu
          </p>
          <p className="max-w-md text-xs text-slate-500">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white hover:bg-brand-500"
          >
            Spróbuj ponownie
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function TalkChatSidebar({
  peerQuery,
  onPeerQueryChange,
  unreadGeneral,
  unreadDm,
  peers,
  threadId,
  threadPeerId,
  avatars,
  inboxSnippets = new Map(),
  currentUserId,
  pinnedThreadIds,
  onTogglePinned,
  onOpenGeneral,
  onOpenDm,
}: {
  peerQuery: string;
  onPeerQueryChange: (v: string) => void;
  unreadGeneral: number;
  unreadDm: Record<string, number>;
  peers: ChatPeer[];
  threadId: string | null;
  threadPeerId: string | null;
  avatars: Map<string, string>;
  inboxSnippets?: Map<string, ChatInboxSnippet>;
  currentUserId?: string;
  pinnedThreadIds: string[];
  onTogglePinned: (id: string) => void;
  onOpenGeneral: () => void;
  onOpenDm: (peer: ChatPeer) => void;
}) {
  const q = peerQuery.trim().toLowerCase();
  const pinnedSet = useMemo(() => new Set(pinnedThreadIds), [pinnedThreadIds]);
  const filtered = useMemo(() => {
    const list = q
      ? peers.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
        )
      : peers;
    return [...list].sort((a, b) => {
      const aPinned = pinnedSet.has(talkDmPinId(a.id));
      const bPinned = pinnedSet.has(talkDmPinId(b.id));
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return a.displayName.localeCompare(b.displayName, 'pl');
    });
  }, [peers, pinnedSet, q]);

  const generalActive = threadId === GENERAL_THREAD_ID;
  const generalSnippet = inboxSnippets.get(GENERAL_THREAD_ID);
  const generalDraft = talkDraftPreview(GENERAL_THREAD_ID);

  const snippetByPeer = useMemo(() => {
    const m = new Map<string, ChatInboxSnippet>();
    for (const s of inboxSnippets.values()) {
      if (s.peerId) m.set(s.peerId, s);
    }
    return m;
  }, [inboxSnippets]);

  const peerNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of peers) m.set(p.id, p.displayName);
    return m;
  }, [peers]);

  function inboxPreviewLine(
    snippet: ChatInboxSnippet | undefined,
    channelGeneral = false,
    draftPreview = '',
  ) {
    if (draftPreview) return `Szkic: ${draftPreview}`;
    if (!snippet) return channelGeneral ? 'Kanał zespołu' : 'Rozpocznij rozmowę';
    const mine = snippet.authorUserId === currentUserId;
    let prefix = '';
    if (mine) prefix = 'Ty: ';
    else if (channelGeneral) {
      const who = peerNameById.get(snippet.authorUserId);
      if (who) prefix = `${who.split(' ')[0]}: `;
    }
    return prefix + inboxBodyPreview(snippet.body, 52);
  }

  function inboxTime(snippet: ChatInboxSnippet | undefined) {
    if (!snippet) return '';
    return formatChatTime(snippet.createdAt);
  }

  return (
    <div className="talk-messenger-inbox flex h-full min-h-0 flex-col md:border-r md:border-slate-200 dark:md:border-slate-800">
      <div className="talk-inbox-search shrink-0 border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={peerQuery}
            onChange={(e) => onPeerQueryChange(e.target.value)}
            placeholder="Szukaj…"
            className="talk-inbox-search-input w-full rounded-full border-0 py-2 pl-9 pr-3 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-1 py-1">
        <button
          type="button"
          onClick={onOpenGeneral}
          className={`talk-inbox-row mb-0.5 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition ${
            generalActive ? 'talk-inbox-row--active' : ''
          }`}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
            <Users className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="talk-inbox-title truncate text-[15px] font-medium">
                Ogólny
              </span>
              {generalSnippet ? (
                <span className="talk-inbox-meta shrink-0 text-[11px]">
                  {inboxTime(generalSnippet)}
                </span>
              ) : null}
            </span>
            <span className="talk-inbox-preview block truncate text-[13px]">
              {inboxPreviewLine(generalSnippet, true, generalDraft)}
            </span>
          </span>
          {unreadGeneral > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
              {unreadGeneral > 99 ? '99+' : unreadGeneral}
            </span>
          )}
        </button>

        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            {q ? 'Brak wyników' : 'Brak innych użytkowników online w katalogu.'}
          </p>
        ) : (
          filtered.map((p) => {
            const active = threadPeerId === p.id;
            const snippet = snippetByPeer.get(p.id);
            const pinId = talkDmPinId(p.id);
            const pinned = pinnedSet.has(pinId);
            const draftThreadId = snippet?.threadId ?? loadTalkDmThreadId(p.id);
            const draftPreview = talkDraftPreview(draftThreadId);
            return (
              <div
                key={p.id}
                className={`talk-inbox-row flex w-full items-center gap-2 rounded-lg px-2 py-2.5 transition ${
                  active ? 'talk-inbox-row--active' : ''
                } ${pinned ? 'talk-inbox-row--pinned' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => onOpenDm(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <UserAvatar
                    name={p.displayName}
                    src={avatars.get(p.id) ?? p.avatarUrl}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="talk-inbox-title truncate text-[15px] font-medium">
                        {p.displayName}
                      </span>
                      {snippet ? (
                        <span className="talk-inbox-meta shrink-0 text-[11px]">
                          {inboxTime(snippet)}
                        </span>
                      ) : null}
                    </span>
                    <span className="talk-inbox-preview block truncate text-[13px]">
                      {inboxPreviewLine(snippet, false, draftPreview)}
                    </span>
                  </span>
                </button>
                {(unreadDm[p.id] ?? 0) > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">
                    {unreadDm[p.id]! > 99 ? '99+' : unreadDm[p.id]}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onTogglePinned(pinId)}
                  className={`talk-inbox-pin flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
                    pinned
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/10 dark:hover:text-slate-300'
                  }`}
                  aria-label={pinned ? 'Odepnij rozmowe' : 'Przypnij rozmowe'}
                  title={pinned ? 'Odepnij rozmowe' : 'Przypnij rozmowe'}
                >
                  <Pin className={`h-4 w-4 ${pinned ? 'fill-current' : ''}`} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function ChatMessageBubble({
  message: m,
  mine,
  showAuthor,
  showAvatar,
  avatars,
  fontClass,
  align,
  reactions,
  compact = false,
  stackTop = false,
  stackBottom = false,
  onReply,
  onReact,
  onCopy,
  onEdit,
  onDelete,
  showAvatars = true,
  showTimestampsEvery = false,
  showReadReceipts = true,
  searchSelected = false,
}: {
  message: ChatMessage;
  mine: boolean;
  showAuthor: boolean;
  showAvatar: boolean;
  avatars: Map<string, string>;
  fontClass: string;
  align: 'left' | 'right';
  reactions: ReactionChip[];
  compact?: boolean;
  stackTop?: boolean;
  stackBottom?: boolean;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showAvatars?: boolean;
  showTimestampsEvery?: boolean;
  showReadReceipts?: boolean;
  searchSelected?: boolean;
}) {
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const deleted = isMessageDeleted(m);
  const parsed = parseChatBody(m.body);
  const bubbleShape = mine
    ? `${stackTop ? 'talk-bubble-mine-stack-top' : ''} ${stackBottom ? 'talk-bubble-mine-stack-bottom' : ''} talk-bubble-mine`
    : `${stackTop ? 'talk-bubble-theirs-stack-top' : ''} ${stackBottom ? 'talk-bubble-theirs-stack-bottom' : ''} talk-bubble-theirs`;

  const isVoice = !deleted && parsed.attachmentKind === 'voice' && parsed.attachmentUrl;
  const isFile = !deleted && parsed.attachmentKind === 'file' && parsed.attachmentUrl;
  const isGif = !deleted && parsed.attachmentKind === 'gif' && parsed.attachmentUrl;
  const bodyText = deleted ? DELETED_MESSAGE_LABEL : parsed.text;
  const showMeta = showTimestampsEvery || stackBottom || (mine && showReadReceipts);

  return (
    <div
      className={`group/msg flex ${mine ? 'justify-end' : 'justify-start'} ${compact ? 'mt-0.5' : 'mt-1.5'}`}
    >
      <div
        className={`flex max-w-[min(92%,22rem)] items-end gap-1.5 ${mine ? 'flex-row-reverse' : 'flex-row'}`}
      >
        {showAvatars && showAvatar ? (
          <UserAvatar
            name={m.authorName}
            src={avatars.get(m.userId)}
            size="xs"
            className="mb-0.5 shrink-0"
          />
        ) : showAvatars && !mine ? (
          <span className="w-6 shrink-0" aria-hidden />
        ) : null}
        <div className={`flex min-w-0 flex-col ${mine ? 'items-end' : 'items-start'}`}>
          {showAuthor && (
            <span className="mb-0.5 px-1 text-[11px] font-medium text-brand-700 dark:text-brand-300">
              {m.authorName}
            </span>
          )}
          <ChatSwipeReply
            side={align}
            onReply={onReply}
            onLongPress={() => setMobileActionsOpen(true)}
            disabled={deleted}
          >
            <div className="relative max-w-full">
              <div
                className={`talk-message-pressable relative px-2.5 py-1.5 ${fontClass} ${bubbleShape} ${deleted ? 'opacity-70 italic' : ''} ${
                  searchSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent' : ''
                }`}
              >
                {!deleted && m.replyTo ? (
                  <div
                    className={`mb-1 rounded-md border-l-2 py-0.5 pl-2 pr-1 text-[11px] leading-tight ${
                      mine
                        ? 'border-[#53bdeb]/90 bg-black/[0.06] text-slate-800'
                        : 'border-brand-500/80 bg-slate-100/90 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'
                    }`}
                  >
                    <p className="font-semibold opacity-90">{m.replyTo.authorName}</p>
                    <p className="truncate opacity-80">{chatBodySnippet(m.replyTo.body, 64)}</p>
                  </div>
                ) : null}
                {isVoice ? (
                  <ChatVoicePlayer
                    src={parsed.attachmentUrl!}
                    durationMs={parsed.voiceDurationMs ?? 0}
                  />
                ) : isFile || isGif ? (
                  <ChatAttachmentPreview parsed={parsed} />
                ) : bodyText ? (
                  <p className="whitespace-pre-wrap break-words leading-snug">{bodyText}</p>
                ) : null}
                {(isFile || isGif) && bodyText ? (
                  <p className="mt-1 whitespace-pre-wrap break-words leading-snug">{bodyText}</p>
                ) : null}
                {showMeta ? (
                <div className="mt-0.5 flex items-center justify-end gap-1">
                  <span className="text-[10px] tabular-nums opacity-55">
                    {formatChatTime(m.createdAt)}
                    {m.editedAt && !deleted ? ' · edyt.' : ''}
                  </span>
                  {mine && showReadReceipts ? (
                    <MessageDeliveryStatus readCount={m.readByOthersCount ?? 0} />
                  ) : null}
                </div>
                ) : null}
              </div>
              {reactions.length > 0 && !deleted ? (
                <div
                  className={`chat-reaction-chips-wrap ${mine ? 'chat-reaction-chips-wrap--out' : 'chat-reaction-chips-wrap--in'}`}
                >
                  <ChatReactionChips
                    messageId={m.id}
                    reactions={reactions}
                    onReact={onReact}
                    align={align}
                  />
                </div>
              ) : null}
            </div>
          </ChatSwipeReply>
        </div>
        {!deleted ? (
          <ChatMessageActions
            onReply={onReply}
            onReact={onReact}
            onCopy={onCopy}
            onEdit={onEdit}
            onDelete={onDelete}
            side={align}
          />
        ) : null}
      </div>
      {mobileActionsOpen && !deleted ? (
        <MobileMessageActionSheet
          mine={mine}
          onClose={() => setMobileActionsOpen(false)}
          onReply={onReply}
          onReact={onReact}
          onCopy={onCopy}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : null}
    </div>
  );
}

function MobileMessageActionSheet({
  mine,
  onClose,
  onReply,
  onReact,
  onCopy,
  onEdit,
  onDelete,
}: {
  mine: boolean;
  onClose: () => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = (fn?: () => void) => {
    if (!fn) return;
    fn();
    onClose();
  };

  return (
    <div className="chat-mobile-action-sheet md:hidden">
      <button
        type="button"
        className="fixed inset-0 z-[220] bg-black/20"
        aria-label="Zamknij akcje wiadomości"
        onClick={onClose}
      />
      <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[221] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex justify-center gap-1 border-b border-slate-200 px-2 py-2 dark:border-slate-800">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="py-1">
          <MobileActionButton icon={<CornerDownRight className="h-4 w-4" />} label="Odpowiedz" onClick={() => run(onReply)} />
          <MobileActionButton icon={<Copy className="h-4 w-4" />} label="Kopiuj" onClick={() => run(onCopy)} />
          {mine && onEdit ? (
            <MobileActionButton icon={<Pencil className="h-4 w-4" />} label="Edytuj" onClick={() => run(onEdit)} />
          ) : null}
          {mine && onDelete ? (
            <MobileActionButton
              icon={<Trash2 className="h-4 w-4" />}
              label="Usuń"
              tone="danger"
              onClick={() => run(onDelete)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MobileActionButton({
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium ${
        tone === 'danger'
          ? 'text-rose-600 dark:text-rose-300'
          : 'text-slate-800 dark:text-slate-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MessageDeliveryStatus({ readCount }: { readCount: number }) {
  return (
    <CheckCheck
      className={`h-3.5 w-3.5 ${readCount > 0 ? 'text-sky-500' : 'opacity-45'}`}
      aria-label={readCount > 0 ? 'Odczytano' : 'Dostarczono'}
    />
  );
}

function ChatAttachmentPreview({ parsed }: { parsed: ReturnType<typeof parseChatBody> }) {
  const url = parsed.attachmentUrl!;

  if (parsed.attachmentKind === 'gif') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
        <img
          src={url}
          alt={parsed.gifLabel || 'GIF'}
          className="max-h-52 w-full min-w-48 max-w-64 object-cover"
          loading="lazy"
        />
      </a>
    );
  }

  const isImage = parsed.fileMime?.startsWith('image/');
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
        <img
          src={url}
          alt={parsed.fileName || 'Załącznik'}
          className="max-h-52 w-full min-w-48 max-w-64 object-cover"
          loading="lazy"
        />
        <span className="block truncate bg-black/10 px-2 py-1 text-[11px]">
          {parsed.fileName || 'Obraz'} · {formatAttachmentSize(parsed.fileSize)}
        </span>
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-56 max-w-72 items-center gap-2 rounded-xl bg-black/10 px-3 py-2 hover:bg-black/15"
    >
      <FileText className="h-5 w-5 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {parsed.fileName || attachmentPreviewLabel(parsed.attachmentKind)}
        </span>
        <span className="block text-[11px] opacity-65">
          {formatAttachmentSize(parsed.fileSize)}
        </span>
      </span>
    </a>
  );
}

function TalkChatThread({
  panel,
  appearance,
  showBack,
  onBack,
  onOpenSettings,
  settingsOpen,
}: {
  panel: ReturnType<typeof useChatPanel>;
  appearance: TalkChatAppearance;
  showBack: boolean;
  onBack: () => void;
  onOpenSettings?: () => void;
  settingsOpen?: boolean;
}) {
  const {
    user,
    threadId,
    threadTitle,
    threadPeerId,
    messages,
    draft,
    setDraft,
    loading,
    sending,
    handleSend,
    handleSendVoice,
    handleSendFile,
    handleSendGif,
    avatars,
    bottomRef,
    replyTo,
    setReplyTo,
    clearReply,
    editingMessage,
    cancelEdit,
    startEditMessage,
    handleDeleteMessage,
    reactionsMap = {},
    handleReaction,
    setError,
    typingNames,
  } = panel;

  const [emojiOpen, setEmojiOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const lastAutoScrollThreadRef = useRef<string | null>(null);
  const lastAutoScrollCountRef = useRef(0);
  const fontClass = talkChatFontClass(appearance.fontSize);
  const spacingClass = talkMessageSpacingClass(appearance.messageSpacing);
  const isGeneral = threadId === GENERAL_THREAD_ID;

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return messages
      .filter((m) => {
        const parsed = parseChatBody(m.body);
        return [parsed.text, parsed.fileName, parsed.gifLabel, m.authorName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .map((m) => m.id);
  }, [messages, searchQuery]);

  useEffect(() => {
    setSearchIndex(0);
  }, [searchQuery, threadId]);

  useEffect(() => {
    if (!searchMatches.length) return;
    const id = searchMatches[Math.min(searchIndex, searchMatches.length - 1)];
    const el = document.querySelector(`[data-chat-message-id="${id}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [searchIndex, searchMatches]);

  const scrollThreadToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = threadScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
    bottomRef.current?.scrollIntoView({ block: 'end', behavior });
    nearBottomRef.current = true;
    setShowJumpToBottom(false);
  }, [bottomRef]);

  useEffect(() => {
    const el = threadScrollRef.current;
    if (!el) return;

    const syncScrollPosition = () => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const awayFromBottom = distanceFromBottom > 180;
      nearBottomRef.current = !awayFromBottom;
      setShowJumpToBottom(awayFromBottom && messages.length > 0 && !searchOpen);
    };

    syncScrollPosition();
    el.addEventListener('scroll', syncScrollPosition, { passive: true });
    return () => el.removeEventListener('scroll', syncScrollPosition);
  }, [messages.length, searchOpen, threadId]);

  useLayoutEffect(() => {
    if (!threadId || searchOpen) return;
    const el = threadScrollRef.current;
    if (!el) return;

    const previousThread = lastAutoScrollThreadRef.current;
    const previousCount = lastAutoScrollCountRef.current;
    const newThread = previousThread !== threadId;
    const latestMessage = messages[messages.length - 1];
    const latestMine = Boolean(latestMessage && latestMessage.userId === user?.id);
    const shouldScroll =
      newThread || loading || previousCount === 0 || nearBottomRef.current || latestMine;

    lastAutoScrollThreadRef.current = threadId;
    lastAutoScrollCountRef.current = messages.length;

    if (!shouldScroll) {
      setShowJumpToBottom(messages.length > 0);
      return;
    }

    const scrollToBottom = () => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
      bottomRef.current?.scrollIntoView({ block: 'end' });
      nearBottomRef.current = true;
      setShowJumpToBottom(false);
    };

    scrollToBottom();
    const raf = window.requestAnimationFrame(scrollToBottom);
    const timeouts = [60, 180, 420, 900].map((delay) =>
      window.setTimeout(scrollToBottom, delay),
    );
    return () => {
      window.cancelAnimationFrame(raf);
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [bottomRef, loading, messages, searchOpen, threadId, user?.id]);

  function onEmojiPick(emoji: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? draft.length;
    const { next, cursor } = insertEmojiInText(draft, emoji, start, end);
    setDraft(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(cursor, cursor);
    });
  }

  if (!threadId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50 p-8 text-center dark:bg-slate-950">
        <MessageCircle className="h-10 w-10 text-slate-300 dark:text-slate-600" />
        <p className="max-w-xs text-sm text-slate-500">
          Wybierz kanał Ogólny lub rozmowę z listy po lewej.
        </p>
      </div>
    );
  }

  const headerAvatarSrc = isGeneral
    ? null
    : threadPeerId
      ? avatars.get(threadPeerId)
      : null;

  return (
    <div className="talk-thread-shell relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="talk-thread-header sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-slate-200/80 bg-[#f0f2f5] px-2 py-2 shadow-sm dark:border-slate-800 dark:bg-[#202c33]">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
            aria-label="Wróć do listy"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        {isGeneral ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400">
            <Users className="h-4 w-4" />
          </span>
        ) : (
          <UserAvatar name={threadTitle} src={headerAvatarSrc} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <p className="talk-thread-title truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {threadTitle}
          </p>
          <p className="talk-thread-subtitle truncate text-[11px] text-slate-500 dark:text-[#8696a0]">
            {typingNames.length > 0
              ? `${typingNames.join(', ')} pisze...`
              : isGeneral
                ? 'Zespół'
                : 'Aktywny teraz'}
          </p>
        </div>
        {onOpenSettings ? (
          <>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10 ${
              searchOpen ? 'bg-black/5 dark:bg-white/10' : ''
            }`}
            aria-label="Szukaj w rozmowie"
            aria-expanded={searchOpen}
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/10 ${
              settingsOpen ? 'bg-black/5 dark:bg-white/10' : ''
            }`}
            aria-label="Ustawienia czatu"
            aria-expanded={settingsOpen}
          >
            <Settings2 className="h-5 w-5" />
          </button>
          </>
        ) : null}
      </div>

      {searchOpen ? (
        <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-2 py-2 dark:border-slate-800 dark:bg-[#111b21]">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Szukaj w tej rozmowie"
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            autoFocus
          />
          <span className="w-12 text-center text-[11px] text-slate-500">
            {searchQuery.trim()
              ? `${searchMatches.length ? searchIndex + 1 : 0}/${searchMatches.length}`
              : ''}
          </span>
          <button
            type="button"
            onClick={() => setSearchIndex((i) => Math.max(0, i - 1))}
            disabled={searchMatches.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 disabled:opacity-35"
            aria-label="Poprzedni wynik"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSearchIndex((i) => Math.min(searchMatches.length - 1, i + 1))}
            disabled={searchMatches.length === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 disabled:opacity-35"
            aria-label="Następny wynik"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery('');
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500"
            aria-label="Zamknij wyszukiwanie"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div
        ref={threadScrollRef}
        onLoadCapture={() => {
          if (searchOpen) return;
          scrollThreadToBottom('auto');
        }}
        className={`${talkWallpaperClass(appearance.wallpaper)} talk-messenger-thread flex-1 overflow-y-auto px-2 py-3 sm:px-4 ${fontClass} ${spacingClass}`}
      >
        {loading && messages.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-500">
            Brak wiadomości — napisz pierwszą.
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.userId === user?.id;
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const prevDay = prev ? chatDayLabel(prev.createdAt) : '';
            const day = chatDayLabel(m.createdAt);
            const showDay = day !== prevDay;
            const groupedWithPrev = chatMessagesGrouped(m, prev);
            const groupedWithNext = chatMessagesGrouped(next, m);
            const showAuthor =
              !mine && isGeneral && !groupedWithPrev;
            const showAvatar =
              appearance.showAvatars &&
              !mine &&
              (!next || !chatMessagesGrouped(next, m));
            const stackTop = groupedWithPrev;
            const stackBottom = groupedWithNext;
            const align = mine ? 'right' : 'left';
            const startReply = () => {
              if (isMessageDeleted(m)) return;
              setReplyTo(m);
              cancelEdit();
              textareaRef.current?.focus();
            };
            const ownerActions =
              mine && !isMessageDeleted(m)
                ? {
                    onEdit: () => startEditMessage(m.id, m.body),
                    onDelete: () => void handleDeleteMessage(m.id),
                  }
                : {};
            return (
              <div key={m.id} data-chat-message-id={m.id}>
                {showDay ? (
                  <p className="my-2 text-center text-[11px] font-medium text-slate-500 dark:text-[#8696a0]">
                    {day}
                  </p>
                ) : null}
                <ChatMessageBubble
                  message={m}
                  mine={mine}
                  showAuthor={showAuthor}
                  showAvatar={showAvatar}
                  avatars={avatars}
                  fontClass={fontClass}
                  align={align}
                  reactions={reactionsMap[m.id] ?? []}
                  compact={groupedWithPrev}
                  stackTop={stackTop}
                  stackBottom={stackBottom}
                  onReply={startReply}
                  onCopy={() => void copyChatMessage(m.body)}
                  onReact={(emoji) => {
                    if (typeof handleReaction === 'function') {
                      void handleReaction(m.id, emoji);
                    }
                  }}
                  showAvatars={appearance.showAvatars}
                  showTimestampsEvery={appearance.showTimestampsEvery}
                  showReadReceipts={appearance.showReadReceipts}
                  searchSelected={searchMatches[searchIndex] === m.id}
                  {...ownerActions}
                />
              </div>
            );
          })
        )}
        {typingNames.length > 0 ? (
          <div className="mt-2 flex justify-start">
            <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm dark:bg-[#202c33] dark:text-slate-200">
              {typingNames.join(', ')} pisze...
            </span>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {showJumpToBottom ? (
        <button
          type="button"
          onClick={() => scrollThreadToBottom('smooth')}
          className="absolute bottom-[5.25rem] right-4 z-20 flex h-10 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-lg transition hover:bg-slate-50 dark:border-slate-700 dark:bg-[#202c33] dark:text-slate-100 dark:hover:bg-slate-700"
          aria-label="Przejdz do najnowszych wiadomosci"
          title="Przejdz do najnowszych"
        >
          <ChevronDown className="h-4 w-4" />
          <span className="hidden sm:inline">Najnowsze</span>
        </button>
      ) : null}

      <form
        onSubmit={(e) => void handleSend(e)}
        className="talk-messenger-composer relative shrink-0 border-t border-slate-200/80 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] dark:border-slate-800"
      >
        {editingMessage ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2">
            <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold text-amber-800 dark:text-amber-300">Edycja wiadomości</p>
              <p className="truncate text-slate-600 dark:text-slate-400">{editingMessage.text}</p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Anuluj edycję"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : replyTo ? (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
            <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Odpowiedź dla {replyTo.authorName}
              </p>
              <p className="truncate text-slate-500">{chatBodySnippet(replyTo.body)}</p>
            </div>
            <button
              type="button"
              onClick={clearReply}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800"
              aria-label="Anuluj odpowiedź"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="talk-composer-field flex items-end gap-1 rounded-3xl bg-white py-1 pl-1 pr-1 dark:bg-[#2a3942]">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.currentTarget.value = '';
              if (!file) return;
              if (file.size > CHAT_FILE_MAX_BYTES) {
                setError('Plik za duży — maksymalnie 2 MB.');
                return;
              }
              void handleSendFile(file);
            }}
          />
          {!voiceRecording && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Wyślij plik do 2 MB"
              title="Wyślij plik do 2 MB"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          )}
          {!voiceRecording && (
            <button
              ref={emojiBtnRef}
              type="button"
              data-chat-emoji-toggle
              onClick={() => setEmojiOpen((v) => !v)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Emotikony"
              aria-expanded={emojiOpen}
            >
              <Smile className="h-5 w-5" />
            </button>
          )}
          {!voiceRecording && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setGifOpen((v) => !v)}
                className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl px-2 text-[11px] font-bold text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="GIF"
                aria-expanded={gifOpen}
              >
                GIF
              </button>
              {gifOpen ? (
                <div className="absolute bottom-full left-0 z-20 mb-2 grid w-64 grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                  {TALK_GIFS.map((gif: TalkGif) => (
                    <button
                      key={gif.id}
                      type="button"
                      onClick={() => {
                        setGifOpen(false);
                        void handleSendGif(gif);
                      }}
                      className="overflow-hidden rounded-xl border border-slate-200 text-left hover:border-brand-400 dark:border-slate-700"
                    >
                      <img src={gif.url} alt={gif.label} className="h-20 w-full object-cover" />
                      <span className="block truncate px-2 py-1 text-[11px] text-slate-700 dark:text-slate-200">
                        {gif.label}
                      </span>
                    </button>
                  ))}
                  <span className="col-span-2 px-1 text-right text-[10px] text-slate-500 dark:text-slate-400">
                    Via Tenor
                  </span>
                </div>
              ) : null}
            </div>
          )}
          {!voiceRecording && (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && appearance.enterToSend && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            onFocus={() => {
              const scrollToBottom = () => {
                const el = threadScrollRef.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
              };
              window.requestAnimationFrame(scrollToBottom);
              window.setTimeout(scrollToBottom, 140);
              window.setTimeout(scrollToBottom, 420);
            }}
            rows={1}
            placeholder={editingMessage ? 'Edytuj wiadomość…' : 'Wiadomość…'}
            className="talk-composer-input max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100"
            maxLength={2000}
          />
          )}
          <ChatVoiceRecordButton
            disabled={sending || Boolean(editingMessage)}
            onRecorded={handleSendVoice}
            onError={(msg) => setError(msg)}
            onRecordingChange={setVoiceRecording}
            className={voiceRecording ? 'min-w-0 flex-1' : ''}
          />
          {!voiceRecording && (
          <button
            type="submit"
            disabled={(!draft.trim() && !appearance.quickSendEmoji) || sending}
            onClick={(e) => {
              if (!draft.trim() && appearance.quickSendEmoji && !editingMessage) {
                e.preventDefault();
                void handleSend(undefined, appearance.quickSendEmoji);
              }
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-500 disabled:opacity-40"
            aria-label="Wyślij"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : draft.trim() ? (
              <Send className="h-4 w-4" />
            ) : (
              <span className="text-lg leading-none">{appearance.quickSendEmoji}</span>
            )}
          </button>
          )}
        </div>
        <ChatEmojiPicker
          open={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onPick={onEmojiPick}
          anchorRef={emojiBtnRef}
        />
      </form>
    </div>
  );
}

export function TalkChatPage({
  variant = 'page',
  messengerLayout = false,
}: {
  variant?: 'page' | 'drawer';
  /** Pełnoekranowy Talk — lista jak Messenger na telefonie. */
  messengerLayout?: boolean;
}) {
  const panel = useChatPanel(true);
  const isMobile = useIsMobileLayout();
  const isDrawer = variant === 'drawer';
  const effectiveMobile = isDrawer ? false : isMobile;
  const [peerQuery, setPeerQuery] = useState('');
  const [appearance, setAppearance] = useState<TalkChatAppearance>(() => loadTalkChatAppearance());
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [pinnedThreadIds, setPinnedThreadIds] = useState<string[]>(() =>
    loadTalkPinnedThreads(),
  );
  const bootedDesktop = useRef(false);
  const restoredLast = useRef(false);
  const mobileThreadHistoryPushed = useRef(false);
  const handledDeepLinkRef = useRef<string | null>(null);

  const {
    enabled,
    view,
    threadId,
    error,
    unreadGeneral,
    unreadDm,
    peers,
    avatars,
    inboxSnippets,
    openGeneral,
    openDm,
    openThreadById,
    backToList,
    threadPeerId,
    user,
  } = panel;
  const backToListRef = useRef(backToList);
  const mobileHistoryStateRef = useRef({ effectiveMobile, view });

  useEffect(() => {
    backToListRef.current = backToList;
  }, [backToList]);

  useEffect(() => {
    mobileHistoryStateRef.current = { effectiveMobile, view };
  }, [effectiveMobile, view]);

  useEffect(() => {
    const sync = () => {
      setAppearance(loadTalkChatAppearance());
    };
    window.addEventListener('katalog-talk-chat-appearance', sync);
    return () => window.removeEventListener('katalog-talk-chat-appearance', sync);
  }, []);

  useEffect(() => {
    const sync = () => setPinnedThreadIds(loadTalkPinnedThreads());
    window.addEventListener('katalog-talk-pinned-threads', sync);
    return () => window.removeEventListener('katalog-talk-pinned-threads', sync);
  }, []);

  useEffect(() => {
    if (bootedDesktop.current || !enabled) return;
    bootedDesktop.current = true;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const params = new URLSearchParams(window.location.search);
    const targetThreadId = params.get('talkThread')?.trim();
    if (!targetThreadId || handledDeepLinkRef.current === targetThreadId) return;
    handledDeepLinkRef.current = targetThreadId;
    void openThreadById(targetThreadId, true);
    params.delete('talkThread');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [enabled, openThreadById]);

  useEffect(() => {
    if (!messengerLayout || !enabled || restoredLast.current || peers.length === 0) return;
    restoredLast.current = true;
  }, [messengerLayout, enabled, peers]);

  useEffect(() => {
    if (isDrawer) return;
    const onPopState = () => {
      const state = mobileHistoryStateRef.current;
      if (!state.effectiveMobile || state.view !== 'thread') return;
      mobileThreadHistoryPushed.current = false;
      backToListRef.current();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isDrawer]);

  useEffect(() => {
    if (isDrawer || !enabled || !effectiveMobile) return;
    if (view !== 'thread') return;
    if (mobileThreadHistoryPushed.current) return;
    window.history.pushState(
      { kenochemTalkThread: true },
      '',
      window.location.href,
    );
    mobileThreadHistoryPushed.current = true;
  }, [effectiveMobile, enabled, isDrawer, view, threadId]);

  const handleBackToList = () => {
    if (effectiveMobile && mobileThreadHistoryPushed.current) {
      window.history.back();
      return;
    }
    backToList();
  };

  if (!enabled) {
    return (
      <p className="p-6 text-center text-sm text-slate-500">
        Czat wymaga zalogowania i skonfigurowanego Supabase.
      </p>
    );
  }

  const showMobileList = effectiveMobile && view === 'list';
  const showMobileThread = effectiveMobile && view === 'thread';
  const showDesktopSplit = !effectiveMobile;

  return (
    <div
      className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden ${talkChatShellClasses(appearance)} ${isDrawer ? 'h-full bg-slate-950' : ''}`}
    >
      {effectiveMobile && appearanceOpen ? (
        <div className="absolute inset-0 z-30 flex flex-col bg-white pt-[env(safe-area-inset-top)] dark:bg-slate-950">
          <TalkChatAppearancePanel
            userId={user?.id}
            onClose={() => setAppearanceOpen(false)}
          />
        </div>
      ) : null}

      <ChatErrorBanner error={error} />

      <TalkChatPanelBoundary>
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {(showDesktopSplit || showMobileList) && (
          <div
            className={`min-h-0 shrink-0 ${
              showDesktopSplit
                ? isDrawer
                  ? 'w-[44%] min-w-[12rem] max-w-[18rem] border-r border-slate-800'
                  : 'w-full max-w-sm'
                : 'flex-1'
            } ${showMobileThread ? 'hidden' : ''}`}
          >
            <TalkChatSidebar
              peerQuery={peerQuery}
              onPeerQueryChange={setPeerQuery}
              unreadGeneral={unreadGeneral}
              unreadDm={unreadDm}
              peers={peers}
              threadId={threadId}
              threadPeerId={threadPeerId}
              avatars={avatars}
              inboxSnippets={inboxSnippets}
              currentUserId={user?.id}
              pinnedThreadIds={pinnedThreadIds}
              onTogglePinned={(id) => setPinnedThreadIds(toggleTalkPinnedThread(id))}
              onOpenGeneral={() => void openGeneral(effectiveMobile)}
              onOpenDm={(p) => void openDm(p, effectiveMobile)}
            />
          </div>
        )}

        {(showDesktopSplit || showMobileThread) && (
          <div
            className={`min-h-0 min-w-0 flex-1 overflow-hidden ${showMobileList ? 'hidden' : 'flex flex-col'}`}
          >
            {appearanceOpen && showDesktopSplit ? (
              <div className="absolute inset-0 z-20 flex flex-col bg-white dark:bg-slate-950">
                <TalkChatAppearancePanel
                  userId={user?.id}
                  onClose={() => setAppearanceOpen(false)}
                />
              </div>
            ) : null}
            <TalkChatThread
              panel={panel}
              appearance={appearance}
              showBack={effectiveMobile}
              onBack={handleBackToList}
              onOpenSettings={() => setAppearanceOpen((v) => !v)}
              settingsOpen={appearanceOpen}
            />
          </div>
        )}
      </div>
      </TalkChatPanelBoundary>
    </div>
  );
}
