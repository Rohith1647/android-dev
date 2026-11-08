import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { hexToRgba, roleColor, roleLabel } from '../lib/roles';
import { Colors, Radii, Spacing, Typography } from '../theme';

export function ChangeRoleModal({ open, user, roleOptions, onClose, onSubmit }) {
  const [role, setRole] = useState(user?.role ?? roleOptions[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setRole(roleOptions.includes(user?.role) ? user.role : roleOptions[0]);
    setError(null);
    setSubmitting(false);
  }, [open, user, roleOptions]);

  const handleSubmit = async () => {
    if (role === user?.role) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(role);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent={true}
      onRequestClose={submitting ? () => {} : onClose}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.centered}>
          <View style={styles.card}>
            <Text style={styles.title}>Change Role</Text>
            <Text style={styles.subtitle}>
              Update permissions for <Text style={styles.userName}>{user?.name || 'User'}</Text>
            </Text>

            {/* Role picker buttons */}
            <View style={styles.optionsList}>
              {roleOptions.map((opt) => {
                const isSelected = role === opt;
                const color = roleColor(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.optionRow,
                      isSelected && {
                        backgroundColor: hexToRgba(color, 0.12),
                        borderColor: color,
                      },
                    ]}
                    onPress={() => setRole(opt)}
                    disabled={submitting}
                    activeOpacity={0.7}
                  >
                    <View style={styles.roleInfo}>
                      <View style={[styles.dot, { backgroundColor: color }]} />
                      <Text
                        style={[
                          styles.roleName,
                          isSelected && { color, fontWeight: '700' },
                        ]}
                      >
                        {roleLabel(opt)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && { borderColor: color, backgroundColor: color },
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {Boolean(error) && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={Colors.midnight} />
                ) : (
                  <Text style={styles.saveText}>Save Role</Text>
                )}
              </TouchableOpacity>
            </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  centered: {
    width: '100%',
    maxWidth: 400,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.midnight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  title: {
    ...Typography.h3,
    color: Colors.midnight,
  },
  subtitle: {
    ...Typography.bodyMuted,
    fontSize: 14,
    marginTop: 2,
    marginBottom: Spacing.lg,
  },
  userName: {
    fontWeight: '700',
    color: Colors.midnight,
  },
  optionsList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
  },
  roleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.midnight,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    padding: Spacing.sm + 2,
    borderRadius: Radii.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
  },
  cancelText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.midnight,
  },
  saveBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.md,
    backgroundColor: Colors.ember,
    minWidth: 100,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.midnight,
  },
});
