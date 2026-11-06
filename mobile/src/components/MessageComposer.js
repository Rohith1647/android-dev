import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { TYPING_THROTTLE_MS } from '../config';
import { Colors, Radii, Spacing, Typography } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';

const DRAFT_CACHE = {};

/**
 * Native Sticky Message Composer with @ Mention support.
 * - Multiline auto-expanding TextInput (bounded max height).
 * - Sends message on button tap.
 * - Throttles real-time typing events (TYPING_THROTTLE_MS).
 * - Suggests participants when typing '@'.
 */
export function MessageComposer({
  onSend,
  onTyping,
  sending = false,
  error = null,
  disabled = false,
  draftKey = '',
  participants = [],
}) {
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(draftKey ? DRAFT_CACHE[draftKey] || '' : '');
  const [inputHeight, setInputHeight] = useState(40);
  const lastTypingRef = useRef(0);
  const cursorRef = useRef(0);

  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionStart, setMentionStart] = useState(null);

  // Load and hydrate draft when active chat changes
  useEffect(() => {
    setMentionQuery(null);
    lastTypingRef.current = 0;
    setInputHeight(40);

    if (draftKey) {
      if (DRAFT_CACHE[draftKey] !== undefined) {
        setValue(DRAFT_CACHE[draftKey]);
      } else {
        AsyncStorage.getItem(`draft_${draftKey}`)
          .then((saved) => {
            if (saved !== null) {
              DRAFT_CACHE[draftKey] = saved;
              setValue(saved);
            } else {
              setValue('');
            }
          })
          .catch(() => setValue(''));
      }
    } else {
      setValue('');
    }
  }, [draftKey]);

  // Persist draft on edit
  const persistDraft = (text) => {
    if (draftKey) {
      DRAFT_CACHE[draftKey] = text;
      if (!text) {
        AsyncStorage.removeItem(`draft_${draftKey}`).catch(() => {});
      } else {
        AsyncStorage.setItem(`draft_${draftKey}`, text).catch(() => {});
      }
    }
  };

  const filteredParticipants = useMemo(() => {
    if (mentionQuery === null || !participants || participants.length === 0) return [];
    const q = mentionQuery.toLowerCase();
    return participants.filter((p) => {
      const name = p.name || p.userName || 'Teammate';
      return name.toLowerCase().includes(q);
    });
  }, [mentionQuery, participants]);

  const handleSelectionChange = (e) => {
    cursorRef.current = e.nativeEvent.selection.end;
  };

  const handleChangeText = (text) => {
    setValue(text);
    persistDraft(text);

    // Detect @ mention query
    const cursor = cursorRef.current ?? text.length;
    const textBeforeCursor = text.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(cursor - match[1].length - 1);
    } else {
      setMentionQuery(null);
    }

    if (!text.trim()) return;

    const now = Date.now();
    if (now - lastTypingRef.current >= TYPING_THROTTLE_MS) {
      lastTypingRef.current = now;
      onTyping?.();
    }
  };

  const insertMention = (participant) => {
    const name = participant.name || participant.userName || 'Teammate';
    const before = value.slice(0, mentionStart >= 0 ? mentionStart : 0);
    const after = value.slice(cursorRef.current ?? value.length);
    const newVal = `${before}@${name} ${after}`;
    setValue(newVal);
    persistDraft(newVal);
    setMentionQuery(null);
  };

  const handleSendPress = async () => {
    const content = value.trim();
    if (!content || sending || disabled) return;

    setValue('');
    persistDraft('');
    setMentionQuery(null);
    setInputHeight(40);
    lastTypingRef.current = 0;

    const success = await onSend(content);
    if (!success) {
      setValue(content);
      persistDraft(content);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(Spacing.sm, insets.bottom) }]}>
      {/* Mentions Suggestion Popover */}
      {mentionQuery !== null && filteredParticipants.length > 0 && (
        <View style={styles.mentionBox}>
          <Text style={styles.mentionHeader}>Mention a teammate</Text>
          <ScrollView
            style={styles.mentionScroll}
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
          >
            {filteredParticipants.map((p) => {
              const name = p.name || 'Teammate';
              return (
                <TouchableOpacity
                  key={String(p.userId || p.id || name)}
                  style={styles.mentionRow}
                  onPress={() => insertMention(p)}
                  activeOpacity={0.7}
                >
                  <Avatar name={name} role={p.role} size={26} />
                  <Text style={styles.mentionName} numberOfLines={1}>
                    {name}
                  </Text>
                  {p.role && <RoleBadge role={p.role} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.row}>
        <TextInput
          style={[
            styles.input,
            { height: Math.min(Math.max(40, inputHeight), 120) },
            disabled && styles.inputDisabled,
          ]}
          multiline
          placeholder={disabled ? 'Select a chat to begin typing' : 'Write a message… (@ to mention)'}
          placeholderTextColor={Colors.slateLight}
          value={value}
          onChangeText={handleChangeText}
          onSelectionChange={handleSelectionChange}
          onContentSizeChange={(e) => {
            setInputHeight(e.nativeEvent.contentSize.height);
          }}
          editable={!disabled && !sending}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!value.trim() || sending || disabled) && styles.sendButtonDisabled,
          ]}
          onPress={handleSendPress}
          disabled={!value.trim() || sending || disabled}
          activeOpacity={0.8}
          accessibilityLabel="Send message"
        >
          {sending ? (
            <ActivityIndicator size="small" color={Colors.midnight} />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  mentionBox: {
    backgroundColor: Colors.canvas,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    maxHeight: 140,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  mentionHeader: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.slate,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  mentionScroll: {
    maxHeight: 110,
  },
  mentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    borderBottomWidth: 1,
    borderColor: Colors.borderLight || Colors.border,
    gap: Spacing.sm,
  },
  mentionName: {
    flex: 1,
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.midnight,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.sm,
    marginBottom: Spacing.xs,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: Colors.canvas,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: Colors.ink,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputDisabled: {
    backgroundColor: '#EBE7DF',
    color: Colors.slate,
  },
  sendButton: {
    backgroundColor: Colors.ember,
    height: 44,
    minWidth: 54,
    paddingHorizontal: Spacing.md + 2,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#DCD6CB',
    opacity: 0.7,
  },
  sendButtonText: {
    color: Colors.midnight,
    fontWeight: '700',
    fontSize: 14,
  },
});
