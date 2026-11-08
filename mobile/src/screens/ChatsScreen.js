import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { createChat, getChats, getDirectory } from '../api/endpoints';
import { isAbortError } from '../api/client';
import { Avatar } from '../components/Avatar';
import { NewChatModal } from '../components/NewChatModal';
import { RoleBadge } from '../components/RoleBadge';
import { canCreateChat } from '../lib/roles';
import { formatListTime } from '../lib/time';
import { useAuth } from '../state/AuthContext';
import { useRealtime } from '../state/RealtimeContext';
import { Colors, Radii, Spacing, Typography } from '../theme';

function normalizeMessage(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const id = msg.id ?? msg._id ?? msg.messageId;
  if (!id) return null;
  const senderId = msg.senderId ?? msg.userId ?? msg.sender?.id;
  const senderName = msg.senderName ?? msg.userName ?? msg.sender?.name;
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

export function ChatsScreen({ navigation }) {
  const { user } = useAuth();
  const { subscribe } = useRealtime();

  const [chats, setChats] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);

  const allowedToCreate = canCreateChat(user?.role);

  // --- Fetch chats and directory ------------------------------------------
  const fetchChats = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [chatsData, dirData] = await Promise.allSettled([
        getChats(),
        getDirectory(),
      ]);

      if (dirData.status === 'fulfilled' && dirData.value?.users) {
        const mapping = {};
        dirData.value.users.forEach((u) => {
          if (u.name) mapping[u.name.toLowerCase().trim()] = u;
          if (u.id) mapping[u.id] = u;
        });
        setUsersMap(mapping);
      }

      if (chatsData.status === 'fulfilled') {
        const rawChats = chatsData.value.chats ?? (Array.isArray(chatsData.value) ? chatsData.value : []);
        setChats(rawChats);
      } else {
        throw chatsData.reason;
      }
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err.message || 'Failed to load conversations');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // --- Realtime bump and unread count tracking ----------------------------
  const bumpChat = useCallback((id, rawMessage, { incrementUnread = false } = {}) => {
    const message = normalizeMessage(rawMessage);
    if (!message) return;

    setChats((current) => {
      const index = current.findIndex((chat) => chat.id === id);
      if (index === -1) return current;
      const chat = current[index];

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

  // Subscribe to all chats in the list
  const chatIds = useMemo(() => chats.map((c) => c.id).join(','), [chats]);

  useEffect(() => {
    if (!user?.id || !chatIds) return undefined;

    const unsubs = chatIds.split(',').map((chatIdToSub) =>
      subscribe(`/topic/chat.${chatIdToSub}`, (incoming) => {
        const msg = normalizeMessage(incoming);
        if (!msg?.id) return;
        if (msg.senderId !== user.id) {
          bumpChat(chatIdToSub, msg, { incrementUnread: true });
        } else {
          bumpChat(chatIdToSub, msg, { incrementUnread: false });
        }
      }),
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [chatIds, user?.id, subscribe, bumpChat]);

  // --- Filtering ----------------------------------------------------------
  const filteredChats = useMemo(() => {
    if (!query.trim()) return chats;
    const lower = query.trim().toLowerCase();
    return chats.filter((c) => (c.name || '').toLowerCase().includes(lower));
  }, [chats, query]);

  // --- Handlers -----------------------------------------------------------
  const handleChatCreated = (newChat) => {
    setNewChatModalOpen(false);
    if (newChat && newChat.id) {
      setChats((current) => [newChat, ...current.filter((c) => c.id !== newChat.id)]);
      navigation.navigate('ChatThread', {
        chatId: newChat.id,
        chatTitle: newChat.name || (newChat.type === 'GROUP' ? 'Group Discussion' : 'Direct Message'),
        chatType: newChat.type,
      });
    } else {
      fetchChats();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Search and Action Bar */}
        <View style={styles.topBar}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations…"
              placeholderTextColor={Colors.slateLight}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <View style={styles.actionRow}>
            <Text style={styles.sectionHeader}>
              {filteredChats.length} {filteredChats.length === 1 ? 'Conversation' : 'Conversations'}
            </Text>

            {allowedToCreate ? (
              <TouchableOpacity
                style={styles.newChatBtn}
                onPress={() => setNewChatModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.newChatBtnText}>+ New Chat</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.restrictedBadge}>
                <Text style={styles.restrictedText}>Read Only</Text>
              </View>
            )}
          </View>
        </View>

        {/* Main List / State View */}
        {loading && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.ember} />
            <Text style={styles.loadingText}>Loading conversations…</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchChats()}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredChats.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>
              {query.trim() ? 'No matching conversations' : 'No conversations yet'}
            </Text>
            <Text style={styles.emptyDesc}>
              {query.trim()
                ? 'Try searching with a different name or keyword.'
                : allowedToCreate
                  ? 'Tap "+ New Chat" above to start a direct message or group conversation.'
                  : 'You will see conversations here once someone adds you.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredChats}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchChats(true)}
                colors={[Colors.ember, Colors.midnight]}
                tintColor={Colors.ember}
              />
            }
            renderItem={({ item }) => {
              const isUnread = (item.unreadCount ?? 0) > 0;
              const isGroup = item.type === 'GROUP';
              const nameLower = (item.name || '').toLowerCase().trim();
              const matchedUser = usersMap[nameLower] || usersMap[item.id];
              const resolvedRole = item.role || matchedUser?.role || (isGroup ? 'GROUP' : undefined);
              const displayName = item.name || (isGroup ? 'Group Discussion' : 'Direct Message');

              return (
                <TouchableOpacity
                  style={[styles.chatRow, isUnread && styles.chatRowUnread]}
                  onPress={() =>
                    navigation.navigate('ChatThread', {
                      chatId: item.id,
                      chatTitle: displayName,
                      chatType: item.type,
                      participantIds: item.participantIds,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <Avatar
                    name={displayName}
                    role={resolvedRole}
                    isGroup={isGroup}
                    size={46}
                  />

                  <View style={styles.chatInfo}>
                    <View style={styles.chatHeader}>
                      <View style={styles.titleWithBadge}>
                        <Text style={[styles.chatTitle, isUnread && styles.chatTitleUnread]} numberOfLines={1}>
                          {displayName}
                        </Text>
                        {resolvedRole && resolvedRole !== 'GROUP' && (
                          <RoleBadge role={resolvedRole} />
                        )}
                        {isGroup && (
                          <View style={styles.groupBadge}>
                            <Text style={styles.groupBadgeText}>GROUP</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.chatTime}>{formatListTime(item.lastMessageAt)}</Text>
                    </View>

                    <View style={styles.chatFooter}>
                      <Text
                        style={[styles.preview, isUnread && styles.previewUnread]}
                        numberOfLines={1}
                      >
                        {item.lastMessage ?? 'No messages yet'}
                      </Text>

                      {isUnread && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>
                            {item.unreadCount > 99 ? '99+' : item.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* New Chat Modal */}
      <NewChatModal
        open={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        onCreate={(payload) => createChat(payload)}
        onCreated={handleChatCreated}
        existingChats={chats}
        currentUserId={user?.id}
      />
    </View>
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
  topBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  searchRow: {
    marginBottom: Spacing.sm,
  },
  searchInput: {
    backgroundColor: Colors.canvas,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
    color: Colors.ink,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeader: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  newChatBtn: {
    backgroundColor: Colors.midnight,
    paddingHorizontal: Spacing.md + 4,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.full,
  },
  newChatBtnText: {
    color: Colors.parchment,
    fontSize: 13,
    fontWeight: '700',
  },
  restrictedBadge: {
    backgroundColor: Colors.canvas,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  restrictedText: {
    fontSize: 11,
    color: Colors.slate,
    fontWeight: '600',
  },
  listContent: {
    padding: Spacing.md,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  chatRowUnread: {
    borderColor: Colors.ember,
    backgroundColor: '#FCFAF6',
  },
  chatInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
    gap: 6,
  },
  chatTitle: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.midnight,
    flexShrink: 1,
  },
  chatTitleUnread: {
    fontWeight: '800',
  },
  groupBadge: {
    backgroundColor: '#EEF2F6',
    borderRadius: Radii.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  groupBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.slateDark,
    letterSpacing: 0.4,
  },
  chatTime: {
    ...Typography.caption,
    color: Colors.slate,
    fontSize: 11,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  preview: {
    ...Typography.bodyMuted,
    fontSize: 13,
    flex: 1,
    marginRight: Spacing.sm,
  },
  previewUnread: {
    color: Colors.midnight,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: Colors.ember,
    borderRadius: Radii.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: Colors.midnight,
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
  emptyTitle: {
    ...Typography.h3,
    color: Colors.midnight,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptyDesc: {
    ...Typography.bodyMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
