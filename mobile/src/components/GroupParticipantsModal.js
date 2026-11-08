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
import { getDirectory, getParticipants } from '../api/endpoints';
import { isAbortError } from '../api/client';
import { formatListTime } from '../lib/time';
import { Colors, Radii, Spacing, Typography } from '../theme';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

/** Modal for viewing all participants in a group chat on mobile. */
export function GroupParticipantsModal({
  open,
  onClose,
  chatId,
  chatTitle = 'Group',
  participants: propParticipants = [],
}) {
  const [query, setQuery] = useState('');
  const [participants, setParticipants] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !chatId) return undefined;
    setQuery('');
    setError(null);

    const controller = new AbortController();
    setLoading(true);

    Promise.allSettled([
      getParticipants(chatId, { signal: controller.signal }),
      getDirectory({ signal: controller.signal }),
    ])
      .then(([participantsResult, directoryResult]) => {
        if (participantsResult.status === 'fulfilled') {
          const raw = participantsResult.value;
          const list = Array.isArray(raw) ? raw : raw?.participants ?? [];
          setParticipants(list);
        } else if (!isAbortError(participantsResult.reason)) {
          if (propParticipants && propParticipants.length > 0) {
            setParticipants(propParticipants);
          } else {
            setError(participantsResult.reason?.message || 'Failed to load participants');
          }
        }

        if (directoryResult.status === 'fulfilled') {
          setDirectory(directoryResult.value?.users ?? []);
        }

        setLoading(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setError(err.message || 'Failed to load participants');
        setLoading(false);
      });

    return () => controller.abort();
  }, [open, chatId, propParticipants]);

  // Combine participant list with directory data to get rich roles & emails
  const allParticipants = useMemo(() => {
    const dirMap = new Map((directory || []).map((u) => [u.id, u]));
    const list = participants.length > 0 ? participants : propParticipants;

    return list.map((p) => {
      const id = p.userId ?? p.id;
      const dirUser = dirMap.get(id);
      return {
        id,
        userId: id,
        name: p.name || dirUser?.name || 'Teammate',
        email: dirUser?.email,
        role: dirUser?.role,
        joinedAt: p.joinedAt,
      };
    });
  }, [participants, propParticipants, directory]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allParticipants;
    const lower = query.trim().toLowerCase();
    return allParticipants.filter((person) =>
      `${person.name ?? ''} ${person.email ?? ''}`.toLowerCase().includes(lower),
    );
  }, [allParticipants, query]);

  if (!open) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {chatTitle} — Participants
              </Text>
              <Text style={styles.headerSubtitle}>
                {allParticipants.length} participant{allParticipants.length === 1 ? '' : 's'} in this group
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityLabel="Close participants modal"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.searchSection}>
            <TextInput
              style={styles.textInput}
              placeholder="Search participants…"
              placeholderTextColor={Colors.slateLight}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          {/* Body content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.ember} />
              <Text style={styles.loadingText}>Loading participants…</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {query.trim() ? 'No matching participants found.' : 'No participants found in this group.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id || item.userId)}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <View style={styles.participantRow}>
                  <Avatar name={item.name} role={item.role} size={40} />
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.email ? (
                      <Text style={styles.participantEmail} numberOfLines={1}>
                        {item.email}
                      </Text>
                    ) : item.joinedAt ? (
                      <Text style={styles.participantJoined} numberOfLines={1}>
                        Joined {formatListTime(item.joinedAt)}
                      </Text>
                    ) : null}
                  </View>
                  {item.role && <RoleBadge role={item.role} />}
                </View>
              )}
            />
          )}

          {/* Footer Close Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.closeButtonText}>Done</Text>
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
    backgroundColor: 'rgba(27, 36, 48, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    maxHeight: '90%',
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
  headerTitles: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.midnight,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.slate,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  closeBtnText: {
    fontSize: 18,
    color: Colors.slate,
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  textInput: {
    height: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.midnight,
    backgroundColor: Colors.canvas,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight || Colors.border,
    gap: Spacing.md,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.midnight,
  },
  participantEmail: {
    ...Typography.caption,
    color: Colors.slate,
    marginTop: 1,
  },
  participantJoined: {
    fontSize: 11,
    color: Colors.slateLight,
    marginTop: 1,
  },
  loadingContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...Typography.bodyMuted,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.bodyMuted,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  closeButton: {
    backgroundColor: Colors.midnight,
    paddingVertical: 12,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.parchment,
  },
});
