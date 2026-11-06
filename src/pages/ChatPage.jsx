import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MessagesSquare, UserPlus } from 'lucide-react';
import { useAuth } from '../state/AuthContext';
import { useRealtime } from '../state/RealtimeContext';
import { addParticipants, createChat, getChats, getMessages, sendMessage } from '../api/endpoints';
import { isAbortError } from '../api/client';
import { TYPING_TTL_MS } from '../config';
import { canCreateChat } from '../lib/roles';
import { ChatList } from '../components/chat/ChatList';
import { MessageThread } from '../components/chat/MessageThread';
import { MessageComposer } from '../components/chat/MessageComposer';
import { NewChatModal } from '../components/chat/NewChatModal';
import { AddParticipantModal } from '../components/chat/AddParticipantModal';
import { Button, EmptyState, cx } from '../components/ui';

function normalizeMessage(msg, senderNamesMap = {}) {
  if (!msg || typeof msg !== 'object') return null;
  const id = msg.id ?? msg._id ?? msg.messageId;
  if (!id) return null;
  const senderId = msg.senderId ?? msg.userId ?? msg.sender?.id;
  const senderName =
    msg.senderName ?? msg.userName ?? msg.sender?.name ?? (senderId ? senderNamesMap[senderId] : undefined);
  return {
    ...msg,
    id,
    content: msg.content ?? msg.text ?? '',
    sentAt: msg.sentAt ?? msg.createdAt ?? msg.timestamp ?? new Date().toISOString(),
    senderId,
    senderName,
    status: msg.status ?? 'DELIVERED',
  };
}

export function ChatPage() {
  const { user } = useAuth();
  const { subscribe, publish, status: connectionStatus } = useRealtime();
  const { chatId } = useParams();
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [chatsError, setChatsError] = useState(null);
  const [chatsReloadKey, setChatsReloadKey] = useState(0);

  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [messagesReloadKey, setMessagesReloadKey] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(null);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [typingPeers, setTypingPeers] = useState({});
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);

  const lastTypingSentRef = useRef(0);
  const openChatRef = useRef(chatId);
  openChatRef.current = chatId;
  const senderNamesRef = useRef({});

  if (user?.id && user?.name) {
    senderNamesRef.current[user.id] = user.name;
  }

  const recordSenderNames = useCallback((msgs) => {
    (msgs || []).forEach((m) => {
      if (m?.senderId && m?.senderName) {
        senderNamesRef.current[m.senderId] = m.senderName;
      }
    });
  }, []);

  const activeChat = useMemo(() => chats.find((c) => c.id === chatId) ?? null, [chats, chatId]);

  // --- chat list ---------------------------------------------------------

  useEffect(() => {
    const controller = new AbortController();
    setChatsLoading(true);
    setChatsError(null);

    getChats({ signal: controller.signal })
      .then((data) => {
        // Whatever the list says, the chat currently on screen has been read.
        setChats(
          (data.chats ?? []).map((chat) =>
            chat.id === openChatRef.current ? { ...chat, unreadCount: 0 } : chat,
          ),
        );
        setChatsLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setChatsError(err.message);
        setChatsLoading(false);
      });

    return () => controller.abort();
  }, [chatsReloadKey]);

  const patchChat = useCallback((id, patch) => {
    setChats((current) => current.map((chat) => (chat.id === id ? { ...chat, ...patch } : chat)));
  }, []);

  /** Moves a chat to the top of the list with its new preview line. */
  const bumpChat = useCallback((id, rawMessage, { incrementUnread = false } = {}) => {
    const message = normalizeMessage(rawMessage, senderNamesRef.current);
    if (!message) return;
    setChats((current) => {
      const index = current.findIndex((chat) => chat.id === id);
      if (index === -1) return current;
      const chat = current[index];

      // Deduplicate: ignore if we already bumped this exact message
      if (chat.lastMessageId === message.id) return current;

      const updated = {
        ...chat,
        lastMessageId: message.id,
        lastMessage: message.content,
        lastMessageAt: message.sentAt,
        unreadCount: incrementUnread ? (chat.unreadCount ?? 0) + 1 : chat.unreadCount,
      };
      const rest = current.filter((_, i) => i !== index);
      return [updated, ...rest];
    });
  }, []);

  // --- messages for the open chat ---------------------------------------

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setMessagesError(null);
      return undefined;
    }

    const controller = new AbortController();
    setMessagesLoading(true);
    setMessagesError(null);
    setSendError(null);
    setLoadMoreError(null);
    setTypingPeers({});

    getMessages(chatId, { signal: controller.signal })
      .then((data) => {
        const rawList = data?.messages ?? (Array.isArray(data) ? data : []);
        const cleanMessages = rawList.map((m) => normalizeMessage(m, senderNamesRef.current)).filter(Boolean);
        recordSenderNames(cleanMessages);
        setMessages(cleanMessages);
        setHasMore(Boolean(data?.hasMore));
        setMessagesLoading(false);
        // Clear local unread count
        patchChat(chatId, { unreadCount: 0 });
        // Mark any unread messages from other senders as read
        cleanMessages.forEach((msg) => {
          if (msg.senderId !== user?.id && msg.status !== 'READ') {
            publish('/app/chat.read', { chatId, messageId: msg.id });
          }
        });
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setMessagesError(err.message);
        setMessagesLoading(false);
      });

    // Opening a chat clears its unread badge.
    patchChat(chatId, { unreadCount: 0 });

    return () => controller.abort();
  }, [chatId, messagesReloadKey, patchChat, publish, recordSenderNames, user?.id]);

  // --- realtime: new messages -------------------------------------------

  // Global subscription to update unread counts for chats not currently open
  const chatIds = chats.map((c) => c.id).join(',');

  useEffect(() => {
    if (!user?.id || !chatIds) return undefined;

    const unsubs = chatIds.split(',').map((chatIdToSubscribe) =>
      subscribe(`/topic/chat.${chatIdToSubscribe}`, (incoming) => {
        const msg = normalizeMessage(incoming, senderNamesRef.current);
        if (!msg?.id) return;

        if (msg.senderName) {
          senderNamesRef.current[msg.senderId] = msg.senderName;
        }
        
        // If this chat is currently open, the other subscription handles it
        if (chatIdToSubscribe === openChatRef.current) return;

        // Otherwise, bump the chat to the top and increment unread count
        if (msg.senderId !== user.id) {
          bumpChat(chatIdToSubscribe, msg, { incrementUnread: true });
        }
      }),
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [chatIds, user?.id, subscribe, bumpChat]);

  // Specific subscription for the currently open chat
  useEffect(() => {
    if (!chatId) return undefined;

    return subscribe(`/topic/chat.${chatId}`, (incoming) => {
      const msg = normalizeMessage(incoming, senderNamesRef.current);
      if (!msg?.id) return;
      // The backend echoes every send back to its own sender; the sender already
      // owns this message's lifecycle via the optimistic-add-then-replace flow in
      // handleSend, so folding the echo in here too race-loses against that
      // replace and can double the bubble. Only other people's messages land here.
      if (msg.senderId === user?.id) return;

      if (msg.senderName) {
        senderNamesRef.current[msg.senderId] = msg.senderName;
      }

      setMessages((current) => {
        if (current.some((message) => message.id === msg.id)) return current;
        return [...current, msg];
      });
      bumpChat(chatId, msg);
      // We are looking at this chat, so tell the backend this message has been read.
      publish('/app/chat.read', {
        chatId,
        messageId: msg.id,
      });
    });
  }, [chatId, subscribe, publish, user?.id, bumpChat]);

  // --- realtime: typing --------------------------------------------------

  useEffect(() => {
    if (!chatId) return undefined;

    return subscribe(`/topic/chat.${chatId}.typing`, (event) => {
      if (!event?.userId || event.userId === user?.id) return;
      setTypingPeers((current) => {
        if (event.typing === false) {
          const { [event.userId]: _removed, ...rest } = current;
          return rest;
        }
        return {
          ...current,
          [event.userId]: { name: event.userName ?? 'Someone', at: Date.now() },
        };
      });
    });
  }, [chatId, subscribe, user?.id, connectionStatus]);

  // Expire stale typing notices (the sender may have gone quiet or dropped).
  useEffect(() => {
    if (Object.keys(typingPeers).length === 0) return undefined;
    const timer = setInterval(() => {
      const cutoff = Date.now() - TYPING_TTL_MS;
      setTypingPeers((current) => {
        const next = Object.fromEntries(
          Object.entries(current).filter(([, value]) => value.at > cutoff),
        );
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [typingPeers]);

  // --- realtime: read receipts ------------------------------------------

  useEffect(() => {
    if (!chatId) return undefined;

    return subscribe(`/topic/chat.${chatId}.read`, (event) => {
      if (!event || event.readBy === user?.id) return;
      const readId = event.messageId;
      setMessages((current) =>
        current.map((message) =>
          message.senderId === user?.id && (!readId || message.id === readId)
            ? { ...message, status: 'READ' }
            : message,
        ),
      );
    });
  }, [chatId, subscribe, user?.id]);

  const handleMessagesSeen = useCallback(
    (ids) => {
      if (!chatId || ids.length === 0) return;
      ids.forEach((messageId) => {
        publish('/app/chat.read', {
          chatId,
          messageId,
        });
      });
    },
    [chatId, publish],
  );

  // --- actions -----------------------------------------------------------

  const handleTyping = useCallback(() => {
    if (!chatId) return;
    const now = Date.now();
    // The composer already throttles; this guards against other callers.
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    publish('/app/chat.typing', {
      chatId,
      isTyping: true,
    });
  }, [chatId, publish]);

  async function handleSend(content) {
    if (!chatId) return false;
    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      chatId,
      senderId: user?.id,
      senderName: user?.name,
      content,
      sentAt: new Date().toISOString(),
      status: 'SENDING',
    };

    setSendError(null);
    setSending(true);
    setMessages((current) => [...current, optimistic]);

    try {
      // Persist first, then broadcast the stored message to the room.
      const res = await sendMessage(chatId, content);
      const serverMsg = res?.message ?? res?.data ?? (res?.id ? res : null);
      const message = normalizeMessage(serverMsg) ?? {
        ...optimistic,
        id: serverMsg?.id ?? `msg-${Date.now()}`,
        status: 'DELIVERED',
      };

      setMessages((current) =>
        current.map((item) => (item.id === tempId ? message : item)),
      );
      publish('/app/chat.send', message);
      bumpChat(chatId, message);
      return true;
    } catch (err) {
      setMessages((current) => current.filter((item) => item.id !== tempId));
      setSendError(err.message);
      return false;
    } finally {
      setSending(false);
    }
  }

  /** Pages backwards through the thread using the oldest loaded message. */
  const handleLoadMore = useCallback(async () => {
    const oldest = messages[0];
    if (!chatId || !oldest || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const data = await getMessages(chatId, { before: oldest.id });
      const rawList = data?.messages ?? (Array.isArray(data) ? data : []);
      const cleanMessages = rawList.map((m) => normalizeMessage(m, senderNamesRef.current)).filter(Boolean);
      recordSenderNames(cleanMessages);
      setMessages((current) => [...cleanMessages, ...current]);
      setHasMore(Boolean(data?.hasMore));
    } catch (err) {
      // Keep the thread on screen; the failure belongs next to the button.
      setLoadMoreError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, messages, loadingMore, recordSenderNames]);

  const handleCreateChat = useCallback((payload) => createChat(payload), []);

  const handleAddParticipants = useCallback(
    async (targetChatId, participantIds) => {
      const result = await addParticipants(targetChatId, participantIds);
      setChatsReloadKey((key) => key + 1);
      return result;
    },
    [],
  );

  function handleChatCreated(chat) {
    setNewChatOpen(false);
    if (!chat || !chat.id) {
      setChatsReloadKey((key) => key + 1);
      return;
    }
    setChats((current) => [chat, ...(current || []).filter((item) => item?.id && item.id !== chat.id)]);
    navigate(`/chats/${chat.id}`);
  }

  const typingNames = Object.values(typingPeers).map((peer) => peer.name);

  // --- render ------------------------------------------------------------

  return (
    <div className="flex h-full min-h-0">
      <div className={cx('w-full shrink-0 md:w-80 lg:w-96', chatId ? 'hidden md:block' : 'block')}>
        <ChatList
          chats={chats}
          loading={chatsLoading}
          error={chatsError}
          role={user?.role}
          selectedChatId={chatId}
          onSelect={(id) => navigate(`/chats/${id}`)}
          onNewChat={() => setNewChatOpen(true)}
          onRetry={() => setChatsReloadKey((key) => key + 1)}
        />
      </div>

      <section
        className={cx('min-w-0 flex-1 flex-col bg-canvas', chatId ? 'flex' : 'hidden md:flex')}
        aria-label="Conversation"
      >
        {!chatId ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={MessagesSquare}
              title="Select a chat"
              description="Pick a conversation from the list to read and reply."
            />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-parchment bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => navigate('/chats')}
                aria-label="Back to chats"
                className="-ml-1 rounded-md p-1 text-ink-soft hover:bg-canvas md:hidden"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-base font-semibold text-ink">
                  {activeChat?.name ?? 'Chat'}
                </h2>
                <p className="truncate text-xs text-ink-soft">
                  {typingNames.length > 0
                    ? activeChat?.type === 'GROUP'
                      ? typingNames.length === 1
                        ? `${typingNames[0]} is typing…`
                        : `${typingNames.length} people are typing…`
                      : 'typing…'
                    : activeChat?.type === 'GROUP'
                      ? 'Group conversation'
                      : 'Direct message'}
                </p>
              </div>
              {activeChat?.type === 'GROUP' && canCreateChat(user?.role) && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setAddParticipantOpen(true)}
                  title="Add participants to group chat"
                >
                  <UserPlus size={15} aria-hidden="true" />
                  <span className="hidden sm:inline">Add participant</span>
                </Button>
              )}
            </header>

            <MessageThread
              messages={messages}
              loading={messagesLoading}
              error={messagesError}
              currentUser={user}
              typingNames={typingNames}
              isGroup={activeChat?.type === 'GROUP'}
              chatName={activeChat?.name}
              onRetry={() => setMessagesReloadKey((key) => key + 1)}
              onMessagesSeen={handleMessagesSeen}
              hasMore={hasMore}
              loadingMore={loadingMore}
              loadMoreError={loadMoreError}
              onLoadMore={handleLoadMore}
            />

            <MessageComposer
              draftKey={chatId}
              onSend={handleSend}
              onTyping={handleTyping}
              sending={sending}
              error={sendError}
              disabled={Boolean(messagesError)}
            />
          </>
        )}
      </section>

      <NewChatModal
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onCreate={handleCreateChat}
        onCreated={handleChatCreated}
      />

      <AddParticipantModal
        open={addParticipantOpen}
        onClose={() => setAddParticipantOpen(false)}
        chatId={chatId}
        existingParticipantIds={activeChat?.participantIds ?? []}
        onAdd={handleAddParticipants}
      />
    </div>
  );
}
