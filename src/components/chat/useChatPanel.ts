import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type SetStateAction } from 'react';
import { useAuth } from '../../lib/auth';
import {
  GENERAL_THREAD_ID,
  listChatPeers,
  getOrCreateDm,
  fetchMessages,
  sendMessage,
  subscribeThread,
  markThreadRead,
  countUnread,
  listMyDmUnread,
  listChatInboxSnippets,
  markMessagesRead,
  subscribeMessageReads,
  toggleMessageThanks,
  type ChatInboxSnippet,
  type ChatMessage,
  type ChatPeer,
} from '../../lib/chat';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { loadUserAvatar } from '../../lib/userAvatar';
import { saveTalkLastThread } from '../../lib/talkLastThread';
import {
  loadThreadReactions,
  subscribeReactions,
  toggleMessageReaction,
  type MessageReactionsMap,
} from '../../lib/chatReactions';
import {
  applyChatMessageMeta,
  deleteChatMessage,
  editChatMessage,
  subscribeMessageMeta,
} from '../../lib/chatMessageMeta';
import { playChatNotification, playChatSendSound } from '../../lib/chatNotify';
import { buildFileMessage, buildVoiceMessage, inboxBodyPreview } from '../../lib/chatAttachments';
import { uploadChatVoice } from '../../lib/chatVoice';
import { uploadChatFile } from '../../lib/chatFiles';
import { buildTalkGifMessage, type TalkGif } from '../../lib/chatGifs';
import { isThreadMuted } from '../../lib/talkChatAppearance';
import { sendTalkPushForMessage, showTalkWebNotification } from '../../lib/push/talkWebPush';
import {
  clearTalkThreadDraft,
  loadTalkThreadDraft,
  saveTalkDmThreadId,
  saveTalkThreadDraft,
} from '../../lib/talkThreadDrafts';

export type ChatPanelView = 'list' | 'thread';

function normalizeChatMessage(m: ChatMessage): ChatMessage {
  return {
    ...m,
    thanksCount: m.thanksCount ?? 0,
    thanksMine: m.thanksMine ?? false,
    authorName: m.authorName?.trim() || 'Użytkownik',
    body: typeof m.body === 'string' ? m.body : String(m.body ?? ''),
  };
}

export function useChatPanel(active: boolean) {
  const { mode, user, profile } = useAuth();
  const [view, setView] = useState<ChatPanelView>('list');
  const [peers, setPeers] = useState<ChatPeer[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadTitle, setThreadTitle] = useState('Ogólny');
  const [threadPeerId, setThreadPeerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraftState] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [reactionsMap, setReactionsMap] = useState<MessageReactionsMap>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadGeneral, setUnreadGeneral] = useState(0);
  const [unreadDm, setUnreadDm] = useState<Record<string, number>>({});
  const [avatars, setAvatars] = useState<Map<string, string>>(() => new Map());
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const [inboxSnippets, setInboxSnippets] = useState<Map<string, ChatInboxSnippet>>(
    () => new Map(),
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const nameCache = useRef(new Map<string, string>());
  const refreshReactionsRef = useRef<() => void>(() => undefined);
  const viewRef = useRef(view);
  viewRef.current = view;
  const threadIdRef = useRef(threadId);
  threadIdRef.current = threadId;
  const draftThreadRef = useRef<string | null>(null);
  const editingMessageRef = useRef(editingMessage);
  editingMessageRef.current = editingMessage;
  const activeRef = useRef(active);
  activeRef.current = active;
  const prevUnreadRef = useRef(0);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutsRef = useRef(new Map<string, number>());
  const lastTypingSentRef = useRef(0);

  const messageIdsKey = useMemo(
    () => messages.map((m) => m.id).join('\0'),
    [messages],
  );
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const enabled = mode === 'signed_in' && Boolean(user?.id) && isSupabaseConfigured;
  const unreadTotal =
    unreadGeneral + Object.values(unreadDm).reduce((a, b) => a + b, 0);

  const setDraft = useCallback((next: SetStateAction<string>) => {
    setDraftState((prev) => {
      const value = typeof next === 'function' ? (next as (value: string) => string)(prev) : next;
      if (!editingMessageRef.current) saveTalkThreadDraft(draftThreadRef.current, value);
      return value;
    });
  }, []);

  const activateDraftForThread = useCallback((nextThreadId: string) => {
    draftThreadRef.current = nextThreadId;
    setDraftState(loadTalkThreadDraft(nextThreadId));
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!user?.id) return;
    try {
      const g = await countUnread(GENERAL_THREAD_ID, user.id);
      setUnreadGeneral(g);
      const dms = await listMyDmUnread(user.id);
      const next: Record<string, number> = {};
      for (const d of dms) next[d.peerId] = d.unread;
      setUnreadDm(next);
    } catch {
      /* ignore — migracja może jeszcze nie być wdrożona */
    }
  }, [user?.id]);

  const refreshInboxSnippets = useCallback(async () => {
    if (!user?.id) return;
    try {
      const map = await listChatInboxSnippets(user.id);
      setInboxSnippets(map);
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  const refreshReactions = useCallback(async () => {
    const msgs = messagesRef.current;
    if (!threadId || !user?.id || msgs.length === 0) {
      setReactionsMap((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const map = await loadThreadReactions(
      threadId,
      msgs.map((m) => m.id),
      user.id,
    );
    setReactionsMap(map);
  }, [threadId, user?.id, messageIdsKey]);

  refreshReactionsRef.current = () => {
    void refreshReactions();
  };

  const notifyIncoming = useCallback(
    (fromUserId: string, msgThreadId: string, authorName: string, body: string) => {
      if (fromUserId === user?.id) return;
      if (isThreadMuted(msgThreadId)) return;
      const viewing =
        active && viewRef.current === 'thread' && threadIdRef.current === msgThreadId;
      if (!viewing) playChatNotification();
      if (!viewing || document.hidden) {
        void showTalkWebNotification(authorName, inboxBodyPreview(body), {
          threadId: msgThreadId,
        });
      }
    },
    [active, user?.id],
  );

  const reloadMessageMeta = useCallback(() => {
    if (!threadId) return;
    setMessages((prev) => applyChatMessageMeta(prev, threadId));
  }, [threadId]);

  const markVisibleMessagesRead = useCallback(
    (msgs: ChatMessage[]) => {
      if (!user?.id) return;
      const unreadIds = msgs.filter((m) => m.userId !== user.id).map((m) => m.id);
      if (unreadIds.length) void markMessagesRead(unreadIds, user.id);
    },
    [user?.id],
  );

  const hydrateAvatars = useCallback(async (userIds: string[]) => {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (unique.length === 0) return;
    const entries = await Promise.all(
      unique.map(async (id) => {
        const url = await loadUserAvatar(id);
        return url ? ([id, url] as const) : null;
      }),
    );
    const found = entries.filter((e): e is readonly [string, string] => e !== null);
    if (found.length === 0) return;
    setAvatars((prev) => {
      const next = new Map(prev);
      for (const [id, url] of found) next.set(id, url);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void listChatPeers()
      .then((list) => {
        setPeers(list);
        setAvatars((prev) => {
          const next = new Map(prev);
          for (const p of list) {
            if (p.avatarUrl) next.set(p.id, p.avatarUrl);
          }
          return next;
        });
        const missing = list.filter((p) => !p.avatarUrl).map((p) => p.id);
        if (missing.length) void hydrateAvatars(missing);
      })
      .catch(() => setPeers([]));
    if (user?.id) void hydrateAvatars([user.id]);
    void refreshUnread();
    void refreshInboxSnippets();
    const t = window.setInterval(() => {
      void refreshUnread();
      void refreshInboxSnippets();
    }, 45_000);
    return () => window.clearInterval(t);
  }, [enabled, hydrateAvatars, refreshUnread, refreshInboxSnippets, user?.id]);

  useEffect(() => {
    if (unreadTotal > prevUnreadRef.current) {
      if (viewRef.current === 'list' || !activeRef.current) {
        playChatNotification();
      }
    }
    prevUnreadRef.current = unreadTotal;
  }, [unreadTotal]);

  useEffect(() => {
    if (!active || !threadId || !user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchMessages(threadId)
      .then((msgs) => {
        if (cancelled) return;
        setMessages(applyChatMessageMeta(msgs, threadId).map(normalizeChatMessage));
        markVisibleMessagesRead(msgs);
        for (const m of msgs) nameCache.current.set(m.userId, m.authorName);
        void hydrateAvatars(msgs.map((m) => m.userId));
        void markThreadRead(threadId).then(() => {
          void refreshUnread();
          void refreshInboxSnippets();
        });
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Nie udało się wczytać czatu');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsub = subscribeThread(
      threadId,
      (msg) => {
        const normalized = normalizeChatMessage(msg);
        setMessages((prev) => {
          if (prev.some((m) => m.id === normalized.id)) return prev;
          return [...prev, normalized];
        });
        nameCache.current.set(normalized.userId, normalized.authorName);
        void hydrateAvatars([normalized.userId]);
        void refreshInboxSnippets();
        notifyIncoming(
          normalized.userId,
          threadId,
          normalized.authorName,
          normalized.body,
        );
        if (normalized.userId !== user.id) {
          void markThreadRead(threadId);
          void markMessagesRead([normalized.id], user.id);
        }
      },
      nameCache.current,
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [active, threadId, user?.id, hydrateAvatars, refreshUnread, refreshInboxSnippets, notifyIncoming, markVisibleMessagesRead]);

  useEffect(() => {
    void refreshReactions();
  }, [refreshReactions]);

  useEffect(() => {
    if (!active || !threadId) return;
    const unsubR = subscribeReactions(threadId, () => {
      refreshReactionsRef.current();
    });
    const unsubM = subscribeMessageMeta(threadId, reloadMessageMeta);
    const unsubReads = subscribeMessageReads(threadId, (messageId, readerId) => {
      if (readerId === user?.id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, readByOthersCount: Math.max(1, (m.readByOthersCount ?? 0) + 1) }
            : m,
        ),
      );
    });
    return () => {
      unsubR();
      unsubM();
      unsubReads();
    };
  }, [active, threadId, reloadMessageMeta, user?.id]);

  useEffect(() => {
    if (!active || !threadId || !user?.id || !supabase) {
      setTypingNames([]);
      return;
    }

    const client = supabase;
    const channel = client
      .channel(`talk-typing:${threadId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }: { payload: any }) => {
        const otherId = String(payload?.userId ?? '');
        if (!otherId || otherId === user.id) return;

        const name = String(payload?.name || 'Uzytkownik');
        nameCache.current.set(otherId, name);
        setTypingNames((prev) =>
          prev.includes(name) ? prev : [...prev, name].slice(-2),
        );

        const oldTimeout = typingTimeoutsRef.current.get(otherId);
        if (oldTimeout) window.clearTimeout(oldTimeout);
        const timeoutId = window.setTimeout(() => {
          typingTimeoutsRef.current.delete(otherId);
          setTypingNames((prev) => prev.filter((n) => n !== name));
        }, 2800);
        typingTimeoutsRef.current.set(otherId, timeoutId);
      });

    typingChannelRef.current = channel;
    channel.subscribe();

    return () => {
      if (typingChannelRef.current === channel) typingChannelRef.current = null;
      typingTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
      typingTimeoutsRef.current.clear();
      setTypingNames([]);
      void client.removeChannel(channel);
    };
  }, [active, threadId, user?.id]);

  useEffect(() => {
    if (!active || !threadId || !user?.id || !draft.trim()) return;
    const channel = typingChannelRef.current;
    if (!channel) return;

    const now = Date.now();
    if (now - lastTypingSentRef.current < 1200) return;
    lastTypingSentRef.current = now;

    const timeoutId = window.setTimeout(() => {
      void channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: user.id,
          name: profile?.displayName || profile?.email || 'Uzytkownik',
        },
      });
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [active, draft, profile?.displayName, profile?.email, threadId, user?.id]);

  useEffect(() => {
    if (!active) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, active, view]);

  useEffect(() => {
    const onAvatar = (e: Event) => {
      const id = (e as CustomEvent<{ userId: string }>).detail?.userId;
      if (id) void hydrateAvatars([id]);
    };
    window.addEventListener('katalog-avatar-changed', onAvatar);
    return () => window.removeEventListener('katalog-avatar-changed', onAvatar);
  }, [hydrateAvatars]);

  async function openGeneral(showThread = true) {
    setEditingMessage(null);
    setReplyTo(null);
    activateDraftForThread(GENERAL_THREAD_ID);
    setThreadId(GENERAL_THREAD_ID);
    setThreadPeerId(null);
    setThreadTitle('Ogólny');
    saveTalkLastThread({ kind: 'general' });
    if (showThread) setView('thread');
    setMessages([]);
  }

  async function openDm(peer: ChatPeer, showThread = true) {
    setEditingMessage(null);
    setReplyTo(null);
    setLoading(true);
    setError(null);
    try {
      const tid = await getOrCreateDm(peer.id);
      activateDraftForThread(tid);
      saveTalkDmThreadId(peer.id, tid);
      setThreadId(tid);
      setThreadPeerId(peer.id);
      setThreadTitle(peer.displayName);
      saveTalkLastThread({ kind: 'dm', peerId: peer.id });
      if (showThread) setView('thread');
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się otworzyć DM');
    } finally {
      setLoading(false);
    }
  }

  async function openThreadById(targetThreadId: string, showThread = true) {
    if (!targetThreadId || !user?.id) return;
    if (targetThreadId === GENERAL_THREAD_ID) {
      await openGeneral(showThread);
      return;
    }

    setEditingMessage(null);
    setReplyTo(null);
    setLoading(true);
    setError(null);
    try {
      let peerId: string | null = null;
      if (supabase) {
        const { data: member } = await supabase
          .from('chat_thread_members')
          .select('user_id')
          .eq('thread_id', targetThreadId)
          .neq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        peerId = member?.user_id ?? null;
      }

      const peer = peerId ? peers.find((p) => p.id === peerId) : null;
      let title = peer?.displayName || 'Rozmowa';
      let avatarUrl = peer?.avatarUrl ?? null;
      if (peerId && !peer && supabase) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('display_name, email, avatar_url')
          .eq('id', peerId)
          .maybeSingle();
        title = profileRow?.display_name?.trim() || profileRow?.email || title;
        avatarUrl = profileRow?.avatar_url?.trim() || null;
      }
      if (peerId && avatarUrl) {
        setAvatars((prev) => {
          const next = new Map(prev);
          next.set(peerId!, avatarUrl!);
          return next;
        });
      }

      activateDraftForThread(targetThreadId);
      if (peerId) saveTalkDmThreadId(peerId, targetThreadId);
      setThreadId(targetThreadId);
      setThreadPeerId(peerId);
      setThreadTitle(title);
      saveTalkLastThread(peerId ? { kind: 'dm', peerId } : { kind: 'general' });
      if (showThread) setView('thread');
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udalo sie otworzyc rozmowy');
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e?: FormEvent, overrideText?: string) {
    e?.preventDefault();
    if (!threadId || !user?.id || sending) return;
    const text = (overrideText ?? draft).trim();
    if (!text) return;
    setSending(true);
    setError(null);

    if (editingMessage) {
      try {
        await editChatMessage(threadId, editingMessage.id, user.id, text);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessage.id
              ? { ...m, body: text, editedAt: new Date().toISOString() }
              : m,
          ),
        );
        setEditingMessage(null);
        setDraft('');
        clearTalkThreadDraft(threadId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Edycja nieudana');
      } finally {
        setSending(false);
      }
      return;
    }

    const replyTarget = replyTo;
    const replyId = replyTarget?.id ?? null;
    setDraft('');
    clearTalkThreadDraft(threadId);
    setReplyTo(null);
    try {
      const msg = await sendMessage(threadId, user.id, text, replyId);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setInboxSnippets((prev) => {
        const next = new Map(prev);
        next.set(threadId, {
          threadId,
          peerId: threadPeerId,
          body: msg.body,
          createdAt: msg.createdAt,
          authorUserId: user.id,
        });
        return next;
      });
      void markThreadRead(threadId);
      void refreshInboxSnippets();
      notifyMessagePush(msg.id);
      playChatSendSound();
    } catch (err) {
      setDraft(text);
      if (replyTarget) setReplyTo(replyTarget);
      setError(err instanceof Error ? err.message : 'Wysyłanie nieudane');
    } finally {
      setSending(false);
    }
  }

  async function handleSendVoice(blob: Blob, durationMs: number) {
    if (!threadId || !user?.id || sending) return;
    setSending(true);
    setError(null);
    try {
      const url = await uploadChatVoice(user.id, threadId, blob);
      const text = buildVoiceMessage(url, durationMs);
      const msg = await sendMessage(threadId, user.id, text, null);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      void markThreadRead(threadId);
      void refreshInboxSnippets();
      notifyMessagePush(msg.id);
      playChatSendSound();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Głosówka nie wysłana');
    } finally {
      setSending(false);
    }
  }

  async function handleSendFile(file: File) {
    if (!threadId || !user?.id || sending) return;
    setSending(true);
    setError(null);
    try {
      const url = await uploadChatFile(user.id, threadId, file);
      const text = buildFileMessage(url, file.name, file.size, file.type);
      const msg = await sendMessage(threadId, user.id, text, null);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      void markThreadRead(threadId);
      void refreshInboxSnippets();
      notifyMessagePush(msg.id);
      playChatSendSound();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plik nie został wysłany');
    } finally {
      setSending(false);
    }
  }

  async function handleSendGif(gif: TalkGif) {
    if (!threadId || !user?.id || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage(threadId, user.id, buildTalkGifMessage(gif), null);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      void markThreadRead(threadId);
      void refreshInboxSnippets();
      notifyMessagePush(msg.id);
      playChatSendSound();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GIF nie został wysłany');
    } finally {
      setSending(false);
    }
  }

  async function handleReaction(messageId: string, emoji: string) {
    if (!threadId || !user?.id) return;
    try {
      await toggleMessageReaction(threadId, messageId, user.id, emoji);
      void refreshReactions();
    } catch {
      /* ignore */
    }
  }

  function startEditMessage(messageId: string, text: string) {
    setReplyTo(null);
    setEditingMessage({ id: messageId, text });
    setDraftState(text);
  }

  function cancelEdit() {
    setEditingMessage(null);
    setDraftState(loadTalkThreadDraft(threadId));
  }

  function notifyMessagePush(messageId: string) {
    void sendTalkPushForMessage(messageId).then((result) => {
      if (!result.ok || (result.failed ?? 0) > 0) {
        console.warn('Talk push message delivery', result);
      }
    });
  }

  async function handleDeleteMessage(messageId: string) {
    if (!threadId || !user?.id) return;
    if (!window.confirm('Usunąć tę wiadomość dla wszystkich?')) return;
    try {
      await deleteChatMessage(threadId, messageId, user.id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, deletedAt: new Date().toISOString() } : m,
        ),
      );
      if (editingMessage?.id === messageId) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usuwanie nieudane');
    }
  }

  async function handleToggleThanks(message: ChatMessage) {
    if (!user?.id) return;
    const prevMine = message.thanksMine;
    const prevCount = message.thanksCount;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? {
              ...m,
              thanksMine: !prevMine,
              thanksCount: Math.max(0, prevCount + (prevMine ? -1 : 1)),
            }
          : m,
      ),
    );
    try {
      await toggleMessageThanks(message.id, user.id, prevMine);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id
            ? { ...m, thanksMine: prevMine, thanksCount: prevCount }
            : m,
        ),
      );
    }
  }

  function clearReply() {
    setReplyTo(null);
  }

  function backToList() {
    setView('list');
    setThreadId(null);
    setThreadPeerId(null);
    setReplyTo(null);
    setEditingMessage(null);
    void refreshUnread();
  }

  return {
    enabled,
    user,
    profile,
    view,
    setView,
    peers,
    threadId,
    threadTitle,
    threadPeerId,
    messages,
    draft,
    setDraft,
    replyTo,
    setReplyTo,
    clearReply,
    editingMessage,
    cancelEdit,
    startEditMessage,
    handleDeleteMessage,
    reactionsMap,
    handleReaction,
    loading,
    sending,
    error,
    setError,
    unreadGeneral,
    unreadDm,
    unreadTotal,
    avatars,
    typingNames,
    inboxSnippets,
    bottomRef,
    refreshUnread,
    openGeneral,
    openDm,
    openThreadById,
    handleSend,
    handleSendVoice,
    handleSendFile,
    handleSendGif,
    handleToggleThanks,
    backToList,
    GENERAL_THREAD_ID,
  };
}
