import React, { useEffect, useState } from 'react';
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
import { Colors, Radii, Spacing, Typography } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

export function AddParticipantModal({
  open,
  onClose,
  chatId,
  existingParticipantIds = [],
  onAdd,
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');

  const [people, setPeople] = useState([]);
  const [fetchedParticipantIds, setFetchedParticipantIds] = useState([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [directoryError, setDirectoryError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    setSelected([]);
    setQuery('');
    setError(null);
    setFetchedParticipantIds([]);

    const controller = new AbortController();
    setLoadingPeople(true);
    setDirectoryError(null);

    const promises = [getDirectory({ signal: controller.signal })];
    if (chatId) {
      promises.push(getParticipants(chatId, { signal: controller.signal }));
    }

    Promise.allSettled(promises)
      .then(([dirRes, partRes]) => {
        if (dirRes.status === 'fulfilled') {
          setPeople(dirRes.value?.users ?? []);
        } else if (!isAbortError(dirRes.reason)) {
          setDirectoryError(dirRes.reason?.message || 'Failed to load user directory');
        }

        if (partRes && partRes.status === 'fulfilled') {
          const raw = partRes.value;
          const list = Array.isArray(raw) ? raw : raw?.participants ?? [];
          setFetchedParticipantIds(list.map((p) => p.userId ?? p.id).filter(Boolean));
        }

        setLoadingPeople(false);
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        setDirectoryError(err.message);
        setLoadingPeople(false);
      });

    return () => controller.abort();
  }, [open, chatId]);

  const existingSet = new Set([...existingParticipantIds, ...fetchedParticipantIds]);
  const availablePeople = people.filter((person) => !existingSet.has(person.id));

  const filtered = query.trim()
    ? availablePeople.filter((person) =>
        `${person.name} ${person.email}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : availablePeople;

  const toggle = (id) => {
    setError(null);
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const handleSubmit = async () => {
    setError(null);

    if (selected.length === 0) {
      setError('Select at least one participant to add');
      return;
    }

    setSubmitting(true);
    try {
      await onAdd(chatId, selected);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add participants');
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
              <Text style={styles.headerTitle}>Add Participants</Text>
              <Text style={styles.headerSubtitle}>
                Invite teammates to this conversation
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

          {/* Search Section */}
          <View style={styles.searchSection}>
            <View style={styles.searchHeader}>
              <Text style={styles.inputLabel}>Available teammates</Text>
              {selected.length > 0 && (
                <Text style={styles.selectedCount}>
                  {selected.length} selected
                </Text>
              )}
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Search by name or email…"
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
          ) : availablePeople.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                All available teammates are already in this chat.
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No matching people found.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isSelected = selected.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.userRow, isSelected && styles.userRowSelected]}
                    onPress={() => toggle(item.id)}
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
                    <RoleBadge role={item.role} />
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                    </View>
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
                  Add Participant{selected.length > 1 ? 's' : ''}
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
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  searchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.midnight,
  },
  selectedCount: {
    ...Typography.caption,
    color: Colors.emberDark,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: Colors.canvas,
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
    textAlign: 'center',
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
});
