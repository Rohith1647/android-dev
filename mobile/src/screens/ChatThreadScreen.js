import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { addParticipants, getMessages, getParticipants, sendMessage } from '../api/endpoints';
import { isAbortError } from '../api/client';
import { AddParticipantModal } from '../components/AddParticipantModal';
import { Avatar } from '../components/Avatar';
import { GroupParticipantsModal } from '../components/GroupParticipantsModal';
import { MessageComposer } from '../components/MessageComposer';
import { TYPING_TTL_MS } from '../config';
import { canCreateChat, roleColor } from '../lib/roles';
import { formatDayLabel, formatMessageTime, sameDay } from '../lib/time';
import { useAuth } from '../state/AuthContext';
import { useRealtime } from '../state/RealtimeContext';
import { Colors, Radii, Spacing, Typography } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function normalizeMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const id = msg.id ?? msg._id ?? msg.messageId;
  if (!id) return null;
  const senderId = msg.senderId ?? msg.userId ?? msg.sender?.id;
  const senderName = msg.senderName ?? msg.userName ?? msg.sender?.name ?? 'User';
  return {
    ...msg,
    id,
    content: msg.content ?? msg.text ?? '',
    sentAt: msg.sentAt ?? msg.createdAt ?? msg.timestamp ?? new Date().toISOString(),
    senderId,
    senderName,
    senderRole: msg.senderRole ?? msg.role,
    status: msg.status ?? 'DELIVERED',
  };
}

function StatusIndicator({ status, onRetry }) {
  if (status === 'SENDING') {
    return <Text style={styles.statusTickSending}>Sending…</Text>;
  }
  if (status === 'FAILED') {
    return (
      <TouchableOpacity
        onPress={onRetry}
        style={styles.retryBubbleBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Failed to deliver. Tap to retry."
      >
        <Text style={styles.statusTickFailed}>⚠️ Failed · Tap to retry</Text>
      </TouchableOpacity>
    );
  }
  if (status === 'READ') {
    return <Text style={styles.statusTickRead}>✓✓</Text>;
  }
  if (status === 'DELIVERED') {
    return <Text style={styles.statusTickDelivered}>✓✓</Text>;
  }
  return <Text style={styles.statusTickSent}>✓</Text>;
}

export function ChatThreadScreen({ route, navigation }) {
  const { user } = useAuth();
  const { subscribe, publish } = useRealtime();
  const insets = useSafeAreaInsets();

  const { chatId, chatTitle = 'Chat', chatType = 'DIRECT', participantIds = [] } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [typingPeers, setTypingPeers] = useState({});
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [groupParticipantsOpen, setGroupParticipantsOpen] = useState(false);
  const [groupParticipants, setGroupParticipants] = useState([]);

  const lastTypingSentRef = useRef(0);
  const seenRef = useRef(new Set());

  const isGroup = chatType === 'GROUP';
  const canAddMembers = isGroup && canCreateChat(user?.role);

  // Android hardware back button handler: cleanly pop to chat list
  useEffect(() => {
    const handleBack = () => {
      navigation.navigate('Chats');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [navigation]);

  const loadGroupParticipants = useCallback(async (targetChatId, { signal } = {}) => {
    if (!targetChatId) {
      setGroupParticipants([]);
      return;
    }
    try {
      const data = await getParticipants(targetChatId, { signal });
      const list = Array.isArray(data) ? data : data?.participants ?? [];
      setGroupParticipants(list);
    } catch (err) {
      if (isAbortError(err)) return;
      // Soft fail, retry on modal open
    }
  }, []);

  useEffect(() => {
    if (!chatId || !isGroup) {
      setGroupParticipants([]);
      return undefined;
    }
    const controller = new AbortController();
    loadGroupParticipants(chatId, { signal: controller.signal });
    return () => controller.abort();
  }, [chatId, isGroup, loadGroupParticipants]);

  // Set navigation header options (custom title, back button & right buttons)
  useLayoutEffect(() => {
    navigation.setOptions({
      title: chatTitle,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Chats')}
          style={styles.headerBackBtn}
          activeOpacity={0.7}
          accessibilityLabel="Back to conversations"
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.headerBackBtnText}>‹</Text>
        </TouchableOpacity>
      ),
      headerRight: () =>
        isGroup ? (
          <View style={styles.headerRightContainer}>
            <TouchableOpacity
              style={styles.headerBtnSecondary}
              onPress={() => setGroupParticipantsOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.headerBtnSecondaryText}>
                {groupParticipants.length > 0 ? `👥 ${groupParticipants.length}` : '👥 Info'}
              </Text>
            </TouchableOpacity>
            {canAddMembers && (
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={() => setAddParticipantOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.headerBtnText}>+ Member</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null,
    });
  }, [navigation, chatTitle, isGroup, canAddMembers, groupParticipants.length]);

  // --- Load Initial Messages ----------------------------------------------
  const fetchInitialMessages = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    setError(null);
    setSendError(null);
    setTypingPeers({});

    try {
      const data = await getMessages(chatId);
      const rawList = data?.messages ?? (Array.isArray(data) ? data : []);
      const cleanMessages = rawList.map(normalizeMessage).filter(Boolean);

      // Inverted FlatList stores list reversed (newest first at index 0)
      // Standard backend returns ascending chronological order [oldest ... newest]
      const reversed = [...cleanMessages].reverse();
      setMessages(reversed);
      setHasMore(Boolean(data?.hasMore));

      // Report read receipt for messages not sent by current user
      cleanMessages.forEach((msg) => {
        if (msg.senderId !== user?.id && msg.status !== 'READ') {
          publish('/app/chat.read', { chatId, messageId: msg.id });
        }
      });
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err.message || 'Failed to load messages');
      }
    } finally {
      setLoading(false);
    }
  }, [chatId, user?.id, publish]);

  useEffect(() => {
    fetchInitialMessages();
  }, [fetchInitialMessages]);

  // --- Realtime Subscriptions --------------------------------------------
  // 1. Incoming live messages
  useEffect(() => {
    if (!chatId) return undefined;

    return subscribe(`/topic/chat.${chatId}`, (incoming) => {
      const msg = normalizeMessage(incoming);
      if (!msg?.id) return;
      if (msg.senderId === user?.id) return; // Handled optimistically

      setMessages((current) => {
        if (current.some((m) => m.id === msg.id)) return current;
        // Inverted: newest prepended to index 0
        return [msg, ...current];
      });

      // Mark as read immediately
      publish('/app/chat.read', {
        chatId,
        messageId: msg.id,
      });
    });
  }, [chatId, subscribe, publish, user?.id]);

  // 2. Typing status
  useEffect(() => {
    if (!chatId) return undefined;

    return subscribe(`/topic/chat.${chatId}.typing`, (event) => {
      if (!event?.userId || event.userId === user?.id) return;

      setTypingPeers((current) => {
        if (event.typing === false || event.isTyping === false) {
          const { [event.userId]: _removed, ...rest } = current;
          return rest;
        }
        return {
          ...current,
          [event.userId]: { name: event.userName ?? 'Someone', at: Date.now() },
        };
      });
    });
  }, [chatId, subscribe, user?.id]);

  // 3. Expire stale typing indicators
  useEffect(() => {
    if (Object.keys(typingPeers).length === 0) return undefined;
    const interval = setInterval(() => {
      const cutoff = Date.now() - TYPING_TTL_MS;
      setTypingPeers((current) => {
        const next = Object.fromEntries(
          Object.entries(current).filter(([, value]) => value.at > cutoff),
        );
        return Object.keys(next).length === Object.keys(current).length ? current : next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [typingPeers]);

  // 4. Read receipts
  useEffect(() => {
    if (!chatId) return undefined;

    return subscribe(`/topic/chat.${chatId}.read`, (event) => {
      if (!event || event.readBy === user?.id) return;
      const readId = event.messageId;

      setMessages((current) =>
        current.map((msg) =>
          msg.senderId === user?.id && (!readId || msg.id === readId)
            ? { ...msg, status: 'READ' }
            : msg,
        ),
      );
    });
  }, [chatId, subscribe, user?.id]);

  // --- Handlers -----------------------------------------------------------
  const handleTyping = useCallback(() => {
    if (!chatId) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;

    publish('/app/chat.typing', {
      chatId,
      isTyping: true,
    });
  }, [chatId, publish]);

  const handleSend = async (content) => {
    if (!chatId) return false;

    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      chatId,
      senderId: user?.id,
      senderName: user?.name || 'Me',
      senderRole: user?.role,
      content,
      sentAt: new Date().toISOString(),
      status: 'SENDING',
    };

    setSendError(null);
    setSending(true);
    // Inverted FlatList: newest message is placed at index 0
    setMessages((current) => [optimistic, ...current]);

    try {
      const res = await sendMessage(chatId, content);
      const serverMsg = res?.message ?? res?.data ?? (res?.id ? res : null);
      const message = normalizeMessage(serverMsg) ?? {
        ...optimistic,
        id: serverMsg?.id ?? `msg-${Date.now()}`,
        status: 'DELIVERED',
      };

      setMessages((current) =>
        current.map((m) => (m.id === tempId ? message : m)),
      );
      publish('/app/chat.send', message);
      return true;
    } catch (err) {
      setMessages((current) =>
        current.map((m) => (m.id === tempId ? { ...m, status: 'FAILED' } : m)),
      );
      setSendError(err.message || 'Failed to send message');
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleRetrySend = useCallback(
    async (failedMsg) => {
      if (!chatId || !failedMsg) return;
      setSendError(null);
      setMessages((current) =>
        current.map((m) => (m.id === failedMsg.id ? { ...m, status: 'SENDING' } : m)),
      );

      try {
        const res = await sendMessage(chatId, failedMsg.content);
        const serverMsg = res?.message ?? res?.data ?? (res?.id ? res : null);
        const message = normalizeMessage(serverMsg) ?? {
          ...failedMsg,
          id: serverMsg?.id ?? `msg-${Date.now()}`,
          status: 'DELIVERED',
        };

        setMessages((current) =>
          current.map((m) => (m.id === failedMsg.id ? message : m)),
        );
        publish('/app/chat.send', message);
      } catch (err) {
        setMessages((current) =>
          current.map((m) => (m.id === failedMsg.id ? { ...m, status: 'FAILED' } : m)),
        );
        setSendError(err.message || 'Retry failed');
      }
    },
    [chatId, publish],
  );

  // Pagination backwards in history onEndReached (since list is inverted, reaching end = older messages)
  const handleLoadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return;

    // The oldest message currently in state is at the end of the inverted array
    const oldest = messages[messages.length - 1];
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const data = await getMessages(chatId, { before: oldest.id });
      const rawList = data?.messages ?? (Array.isArray(data) ? data : []);
      const cleanMessages = rawList.map(normalizeMessage).filter(Boolean);

      const reversedOlder = [...cleanMessages].reverse();
      setMessages((current) => [...current, ...reversedOlder]);
      setHasMore(Boolean(data?.hasMore));
    } catch {
      // Keep existing list on failure
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAddParticipants = async (targetChatId, pIds) => {
    await addParticipants(targetChatId, pIds);
    loadGroupParticipants(targetChatId);
  };

  // Typing peers summary
  const typingNames = Object.values(typingPeers).map((p) => p.name);
  const typingLabel =
    typingNames.length === 0
      ? null
      : !isGroup
        ? 'typing…'
        : typingNames.length === 1
          ? `${typingNames[0]} is typing…`
          : `${typingNames.length} people are typing…`;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        {/* Subheader info & Typing Indicator */}
        <View style={styles.subHeader}>
          <Text style={styles.subHeaderText}>
            {typingLabel ? (
              <Text style={styles.typingHighlight}>{typingLabel}</Text>
            ) : isGroup ? (
              'Group Discussion'
            ) : (
              'Direct Message'
            )}
          </Text>
        </View>

        {/* Message Feed */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.ember} />
            <Text style={styles.loadingText}>Loading messages…</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchInitialMessages}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyDesc}>
              Start the conversation below — your messages appear in real time.
            </Text>
          </View>
        ) : (
          <FlatList
            inverted={true}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.messageList}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={11}
            removeClippedSubviews={Platform.OS !== 'web'}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadMoreIndicator}>
                  <ActivityIndicator size="small" color={Colors.slate} />
                </View>
              ) : null
            }
            renderItem={({ item, index }) => {
              const isMe = item.senderId === user?.id;

              // Since list is inverted:
              // older message is at index + 1
              const olderMessage = messages[index + 1];
              const isDifferentDay = !olderMessage || !sameDay(olderMessage.sentAt, item.sentAt);

              return (
                <View style={styles.messageWrapper}>
                  {/* Date Divider shown above the older message group (below it in inverted list) */}
                  {isDifferentDay && (
                    <View style={styles.dateDivider}>
                      <View style={styles.dateLine} />
                      <Text style={styles.dateLabel}>{formatDayLabel(item.sentAt)}</Text>
                      <View style={styles.dateLine} />
                    </View>
                  )}

                  <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
                    {!isMe && (
                      <Avatar
                        name={item.senderName}
                        role={item.senderRole}
                        size={28}
                        style={styles.senderAvatar}
                      />
                    )}

                    <View
                      style={[
                        styles.bubble,
                        isMe ? styles.myBubble : styles.theirBubble,
                        isMe && { backgroundColor: roleColor(user?.role, Colors.midnight) },
                      ]}
                    >
                      {!isMe && (
                        <Text style={[styles.senderName, { color: roleColor(item.senderRole, Colors.ember) }]}>
                          {item.senderName}
                        </Text>
                      )}

                      <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                        {item.content}
                      </Text>

                      <View style={styles.metaRow}>
                        <Text style={[styles.metaTime, isMe ? styles.myMetaTime : styles.theirMetaTime]}>
                          {formatMessageTime(item.sentAt)}
                        </Text>
                        {isMe && (
                          <StatusIndicator
                            status={item.status}
                            onRetry={() => handleRetrySend(item)}
                          />
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Sticky Message Composer */}
        <MessageComposer
          draftKey={chatId}
          onSend={handleSend}
          onTyping={handleTyping}
          sending={sending}
          error={sendError}
          disabled={loading || Boolean(error)}
          participants={isGroup ? groupParticipants : []}
        />
      </View>

      {/* Add Participant Modal for Group chats */}
      <AddParticipantModal
        open={addParticipantOpen}
        onClose={() => setAddParticipantOpen(false)}
        chatId={chatId}
        existingParticipantIds={groupParticipants.map((p) => p.userId ?? p.id).filter(Boolean)}
        onAdd={handleAddParticipants}
      />

      {/* Group Participants View Modal */}
      <GroupParticipantsModal
        open={groupParticipantsOpen}
        onClose={() => setGroupParticipantsOpen(false)}
        chatId={chatId}
        chatTitle={chatTitle}
        participants={groupParticipants}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 680,
    backgroundColor: Colors.canvas,
  },
  headerBackBtn: {
    minHeight: 44,
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  headerBackBtnText: {
    color: Colors.parchment,
    fontSize: 32,
    lineHeight: 32,
    fontWeight: '300',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerBtnSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: Spacing.sm + 4,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  headerBtnSecondaryText: {
    color: Colors.parchment,
    fontSize: 12,
    fontWeight: '600',
  },
  headerBtn: {
    backgroundColor: Colors.ember,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.full,
  },
  headerBtnText: {
    color: Colors.midnight,
    fontSize: 12,
    fontWeight: '700',
  },
  subHeader: {
    backgroundColor: Colors.surface,
    paddingVertical: 6,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  subHeaderText: {
    ...Typography.caption,
    color: Colors.slate,
  },
  typingHighlight: {
    color: Colors.emberDark,
    fontWeight: '700',
  },
  messageList: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  loadMoreIndicator: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  messageWrapper: {
    marginBottom: Spacing.sm,
  },
  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dateLabel: {
    ...Typography.caption,
    color: Colors.slate,
    marginHorizontal: Spacing.md,
    fontWeight: '600',
    fontSize: 11,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bubbleRowMe: {
    justifyContent: 'flex-end',
  },
  bubbleRowThem: {
    justifyContent: 'flex-start',
  },
  senderAvatar: {
    marginRight: Spacing.xs + 2,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  myBubble: {
    backgroundColor: Colors.midnight,
    borderBottomRightRadius: Radii.xs,
  },
  theirBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: Radii.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  messageText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  theirMessageText: {
    color: Colors.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  metaTime: {
    fontSize: 10,
  },
  myMetaTime: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  theirMetaTime: {
    color: Colors.slateLight,
  },
  statusTickSending: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
  },
  statusTickSent: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '700',
  },
  statusTickDelivered: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '700',
  },
  statusTickRead: {
    color: Colors.ember,
    fontSize: 11,
    fontWeight: '800',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  loadingText: {
    ...Typography.bodyMuted,
    marginTop: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  retryBtn: {
    backgroundColor: Colors.midnight,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.md,
  },
  retryBtnText: {
    color: Colors.parchment,
    fontWeight: '600',
  },
  retryBubbleBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  statusTickFailed: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyTitle: {
    ...Typography.h3,
    color: Colors.midnight,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    ...Typography.bodyMuted,
    textAlign: 'center',
  },
});
