import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { changePassword } from '../api/endpoints';
import { Colors, Radii, Spacing, Typography } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ChangePasswordModal({ open, forced = false, onClose, onSuccess }) {
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setError(null);
    setSuccess(false);
    setSubmitting(false);
  }, [open]);

  const handleSubmit = async () => {
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (!newPassword || newPassword.length < 12) {
      setError('New password must be at least 12 characters long.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('New password must differ from current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        if (!forced) {
          onClose?.();
        }
      }, 1200);
    } catch (err) {
      setError(err?.message || 'Failed to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = useCallback(() => {
    if (forced || submitting) return;
    onClose?.();
  }, [forced, submitting, onClose]);

  if (!open) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {forced ? 'Set up your password' : 'Change password'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {forced
                  ? 'Your account has a temporary password. Set a permanent password to continue.'
                  : 'Update your account password. All sessions will be refreshed.'}
              </Text>
            </View>
            {!forced && (
              <TouchableOpacity
                onPress={handleClose}
                disabled={submitting}
                style={styles.closeBtn}
                accessibilityLabel="Close modal"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {success ? (
            <View style={styles.successContainer}>
              <View style={styles.successBadge}>
                <Text style={styles.successBadgeIcon}>✓</Text>
              </View>
              <Text style={styles.successTitle}>Password updated successfully</Text>
              <Text style={styles.successSubtitle}>
                {forced ? 'Redirecting to your workspace…' : 'Your new password is now active.'}
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Current Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Current password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry={!showCurrent}
                    placeholder="Enter current password"
                    placeholderTextColor={Colors.slateLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!submitting}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowCurrent((prev) => !prev)}
                  >
                    <Text style={styles.eyeText}>{showCurrent ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {forced && (
                  <Text style={styles.hintText}>
                    Enter the temporary password provided to you.
                  </Text>
                )}
              </View>

              {/* New Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>New password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNew}
                    placeholder="Min 12 characters"
                    placeholderTextColor={Colors.slateLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!submitting}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowNew((prev) => !prev)}
                  >
                    <Text style={styles.eyeText}>{showNew ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.hintText}>
                  Must be at least 12 characters and different from current.
                </Text>
              </View>

              {/* Confirm Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm new password</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirm}
                    placeholder="Re-enter new password"
                    placeholderTextColor={Colors.slateLight}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!submitting}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowConfirm((prev) => !prev)}
                  >
                    <Text style={styles.eyeText}>{showConfirm ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={[styles.actions, { paddingBottom: Math.max(Spacing.md, insets.bottom) }]}>
                {!forced && (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={onClose}
                    disabled={submitting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={Colors.midnight} />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {forced ? 'Set password and continue' : 'Update password'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
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
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.midnight,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.slate,
    marginTop: 2,
    maxWidth: 280,
  },
  closeBtn: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xs,
  },
  closeBtnText: {
    fontSize: 18,
    color: Colors.slate,
    fontWeight: '600',
  },
  formContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    ...Typography.bodySmall,
    fontWeight: '600',
    color: Colors.midnight,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radii.md,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.midnight,
  },
  eyeBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  eyeText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.ember,
  },
  hintText: {
    ...Typography.caption,
    color: Colors.slateLight,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  cancelButton: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.slate,
  },
  submitButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: Colors.ember,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.white,
  },
  successContainer: {
    padding: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  successBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  successBadgeIcon: {
    fontSize: 26,
    color: '#16A34A',
    fontWeight: 'bold',
  },
  successTitle: {
    ...Typography.h2,
    color: Colors.midnight,
  },
  successSubtitle: {
    ...Typography.body,
    color: Colors.slate,
    textAlign: 'center',
  },
});
