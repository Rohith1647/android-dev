import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { getDirectory } from '../api/endpoints';
import { isAbortError } from '../api/client';
import { Colors, Radii, Spacing, Typography } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

/** Extract unique direct chat peer user IDs from the user's existing chats list. */
export function getExistingDirectPeerIds(existingChats, currentUserId) {
  if (!existingChats || existingChats.length === 0) return new Set();
  const set = new Set();
  existingChats.forEach((chat) => {
    if (chat.type === 'DIRECT') {
      if (chat.peerUserId && chat.peerUserId !== currentUserId) {
        set.add(chat.peerUserId);
      }
      const ids = (chat.participantIds ?? chat.participants ?? []).map((p) =>
        typeof p === 'object' ? p.id : p
      );
      ids.forEach((id) => {
        if (id && id !== currentUserId) set.add(id);
      });
    }
  });
  return set;
}

export function NewChatModal({
  open,
  onClose,
  onCreated,
  onCreate,
  existingChats = [],
  currentUserId,
}) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState('DIRECT');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');

  const [people, setPeople] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [directoryError, setDirectoryError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const existingDirectPeerIds = useMemo(
    () => getExistingDirectPeerIds(existingChats, currentUserId),
    [existingChats, currentUserId],
  );

  useEffect(() => {
    if (!open) return undefined;
    setType('DIRECT');
    setName('');
    setSelected([]);
    setQuery('');
    setError(null);

    const controller = new AbortController();
    setLoadingPeople(true);
    setDirectoryError(null);

    getDirectory({ signal: controller.signal })
      .then((data) => {
        setPeople(data.users ?? []);
        setLoadingPeople(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setDirectoryError(err.message || 'Failed to load user directory');
        setLoadingPeople(false);
      });

    return () => controller.abort();
  }, [open]);

  const toggle = (id) => {
    setError(null);
    if (type === 'DIRECT' && existingDirectPeerIds.has(id)) return;
    setSelected((current) => {
      if (type === 'DIRECT') return current.includes(id) ? [] : [id];
      return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    });
  };

  const switchType = (nextType) => {
    setType(nextType);
    setError(null);
    if (nextType === 'DIRECT') setSelected((current) => current.slice(0, 1));
  };

  const filtered = query.trim()
    ? people.filter((person) =>
        `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : people;

  const handleSubmit = async () => {
    setError(null);

    if (selected.length === 0) {
      setError('Pick at least one participant');
      return;
    }
    if (type === 'GROUP' && !name.trim()) {
      setError('Group chats need a name');
      return;
    }

    setSubmitting(true);
    try {
      const data = await onCreate({
        type,
        name: type === 'GROUP' ? name.trim() : undefined,
        participantIds: selected,
      });
      const chat = data?.chat ?? data?.data ?? (data?.id ? data : null);
      if (chat) {
        // Enrich chat object for immediate optimistic rendering
        let enrichedName = chat.name;
        let enrichedRole = chat.role;
        if (type === 'DIRECT' && selected.length > 0) {
          const directUser = people.find((p) => p.id === selected[0]);
          if (directUser) {
            enrichedName = directUser.name;
            enrichedRole = directUser.role;
          }
        } else if (type === 'GROUP') {
          enrichedName = name.trim() || 'Group';
        }

        const enrichedChat = {
          ...chat,
          name: enrichedName || (type === 'GROUP' ? 'Group' : 'Direct Message'),
          role: enrichedRole,
          participantIds: selected,
        };

        onCreated(enrichedChat);
      } else {
        throw new Error('Chat creation succeeded but no chat details were returned.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create chat');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent={true}
      onRequestClose={submitting ? () => {} : onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>New Conversation</Text>
              <Text style={styles.headerSubtitle}>
                {type === 'DIRECT' ? 'Direct Message' : 'Create a Group'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Segmented Type Switcher */}
          <View style={styles.typeSwitcher}>
            <TouchableOpacity
              style={[styles.typeButton, type === 'DIRECT' && styles.typeButtonActive]}
              onPress={() => switchType('DIRECT')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'DIRECT' && styles.typeButtonTextActive,
                ]}
              >
                Direct
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, type === 'GROUP' && styles.typeButtonActive]}
              onPress={() => switchType('GROUP')}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  type === 'GROUP' && styles.typeButtonTextActive,
                ]}
              >
                Group
              </Text>
            </TouchableOpacity>
          </View>

          {/* Group Name Input */}
          {type === 'GROUP' && (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Group Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Design Team, Cohort Alpha"
                placeholderTextColor={Colors.slateLight}
                value={name}
                onChangeText={setName}
                editable={!submitting}
              />
            </View>
          )}

          {/* Search Input */}
          <View style={styles.searchSection}>
            <View style={styles.searchHeader}>
              <Text style={styles.inputLabel}>
                {type === 'DIRECT' ? 'Select recipient' : 'Select participants'}
              </Text>
              {selected.length > 0 && (
                <Text style={styles.selectedCount}>
                  {selected.length} selected
                </Text>
              )}
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Search people by name or email…"
              placeholderTextColor={Colors.slateLight}
              value={query}
              onChangeText={setQuery}
              editable={!submitting}
            />
          </View>

          {/* Error notice */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorBoxText}>{error}</Text>
            </View>
          )}

          {/* People List */}
          {loadingPeople ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.ember} />
              <Text style={styles.loadingText}>Loading directory…</Text>
            </View>
          ) : directoryError ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.errorBoxText}>{directoryError}</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No people found.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = selected.includes(item.id);
                const hasExistingChat = type === 'DIRECT' && existingDirectPeerIds.has(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.userRow,
                      isSelected && styles.userRowSelected,
                      hasExistingChat && styles.userRowDisabled,
                    ]}
                    onPress={() => toggle(item.id)}
                    disabled={submitting || hasExistingChat}
                    activeOpacity={0.7}
                  >
                    <Avatar name={item.name} role={item.role} size={36} />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </View>
                    {hasExistingChat ? (
                      <View style={styles.existingChatBadge}>
                        <Text style={styles.existingChatText}>Chat exists</Text>
                      </View>
                    ) : (
                      <>
                        <RoleBadge role={item.role} />
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Action Buttons */}
          <View style={[styles.actions, { paddingBottom: Math.max(Spacing.lg, insets.bottom) }]}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (selected.length === 0 || submitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={selected.length === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={Colors.midnight} />
              ) : (
                <Text style={styles.submitButtonText}>
                  {type === 'DIRECT' ? 'Start Chat' : 'Create Group'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(27, 36, 48, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.midnight,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.slate,
    marginTop: 2,
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
  },
  closeButtonText: {
    fontSize: 18,
    color: Colors.slate,
    fontWeight: '700',
  },
  typeSwitcher: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  typeButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radii.md,
    alignItems: 'center',
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeButtonActive: {
    backgroundColor: Colors.midnight,
    borderColor: Colors.midnight,
  },
  typeButtonText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.slateDark,
  },
  typeButtonTextActive: {
    color: Colors.parchment,
  },
  inputSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.midnight,
    marginBottom: 6,
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCount: {
    ...Typography.caption,
    color: Colors.emberDark,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    minHeight: 44,
    fontSize: 16,
    color: Colors.ink,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    marginHorizontal: Spacing.lg,
    padding: Spacing.sm,
    borderRadius: Radii.sm,
    marginTop: Spacing.xs,
  },
  errorBoxText: {
    color: '#B91C1C',
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  userRowSelected: {
    backgroundColor: '#F2EFEB',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.midnight,
  },
  userEmail: {
    fontSize: 11,
    color: Colors.slate,
    marginTop: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Radii.xs,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.midnight,
    borderColor: Colors.midnight,
  },
  checkboxCheck: {
    color: Colors.parchment,
    fontWeight: '800',
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  loadingText: {
    ...Typography.bodyMuted,
    marginTop: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  emptyText: {
    ...Typography.bodyMuted,
  },
  actions: {
    flexDirection: 'row',
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  cancelButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.midnight,
  },
  submitButton: {
    flex: 1.5,
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: Colors.ember,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#DCD6CB',
    opacity: 0.7,
  },
  submitButtonText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.midnight,
  },
  userRowDisabled: {
    opacity: 0.55,
    backgroundColor: 'rgba(238, 234, 227, 0.4)',
  },
  existingChatBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.sm,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  existingChatText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.slate,
  },
});
