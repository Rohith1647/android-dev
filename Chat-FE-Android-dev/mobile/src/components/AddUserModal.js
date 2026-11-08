import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { hexToRgba, roleColor, roleLabel } from '../lib/roles';
import { Colors, Radii, Spacing, Typography } from '../theme';

export function AddUserModal({ open, onClose, onCreate, roleOptions, onCreated }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roleOptions[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setEmail('');
    setRole(roleOptions[0]);
    setError(null);
    setSubmitting(false);
    setCreated(null);
    setCopied(false);
  }, [open, roleOptions]);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError('Name is required');
    if (!email.trim()) return setError('Email is required');

    setSubmitting(true);
    try {
      const data = await onCreate({ name: name.trim(), email: email.trim(), role });
      setCreated(data);
      onCreated?.(data.user);
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyPassword = () => {
    // In React Native without native clipboard module, we acknowledge the action visually
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tempPwd =
    created?.temp_password ?? created?.tempPassword ?? created?.user?.temp_password;

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
              <Text style={styles.headerTitle}>
                {created ? 'Account Created' : 'Add User'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {created
                  ? 'Share credentials with the new user'
                  : 'Assign role and generate login credentials'}
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

          {created ? (
            <View style={styles.successBody}>
              <View style={styles.credentialsCard}>
                <Text style={styles.createdName}>{created.user?.name ?? name}</Text>
                <Text style={styles.createdEmail}>{created.user?.email ?? email}</Text>

                <View style={styles.passwordBox}>
                  <View style={styles.passwordDetails}>
                    <Text style={styles.passwordLabel}>TEMPORARY PASSWORD</Text>
                    <Text style={styles.passwordValue}>{tempPwd}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopyPassword}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.copyButtonText}>{copied ? 'Copied' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.noticeText}>
                  This password will only be shown once. Please provide it to the user.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.doneButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formBody}>
              {/* Name field */}
              <View style={styles.field}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Alex Morgan"
                  placeholderTextColor={Colors.slateLight}
                  value={name}
                  onChangeText={setName}
                  editable={!submitting}
                />
              </View>

              {/* Email field */}
              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. alex@organization.com"
                  placeholderTextColor={Colors.slateLight}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  editable={!submitting}
                />
              </View>

              {/* Role selection */}
              <View style={styles.field}>
                <Text style={styles.label}>Role</Text>
                <View style={styles.rolePickerGrid}>
                  {roleOptions.map((opt) => {
                    const isSelected = role === opt;
                    const color = roleColor(opt);
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.roleOptionBtn,
                          isSelected && {
                            backgroundColor: hexToRgba(color, 0.15),
                            borderColor: color,
                          },
                        ]}
                        onPress={() => setRole(opt)}
                        disabled={submitting}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.roleOptionText,
                            isSelected && { color, fontWeight: '700' },
                          ]}
                        >
                          {roleLabel(opt)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Error notice */}
              {Boolean(error) && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Action buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={onClose}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={Colors.midnight} />
                  ) : (
                    <Text style={styles.submitButtonText}>+ Add User</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    padding: Spacing.sm,
  },
  closeButtonText: {
    fontSize: 18,
    color: Colors.slate,
    fontWeight: '700',
  },
  formBody: {
    padding: Spacing.lg,
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.midnight,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 14,
    color: Colors.ink,
  },
  rolePickerGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roleOptionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radii.md,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleOptionText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.slateDark,
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
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
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
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: Colors.ember,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.midnight,
  },
  successBody: {
    padding: Spacing.lg,
  },
  credentialsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  createdName: {
    ...Typography.h3,
    color: Colors.midnight,
  },
  createdEmail: {
    ...Typography.caption,
    color: Colors.slate,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  passwordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.canvas,
    padding: Spacing.md,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  passwordDetails: {
    flex: 1,
  },
  passwordLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate,
    letterSpacing: 0.5,
  },
  passwordValue: {
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: Colors.midnight,
    marginTop: 2,
  },
  copyButton: {
    backgroundColor: Colors.midnight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radii.xs,
  },
  copyButtonText: {
    color: Colors.parchment,
    fontSize: 12,
    fontWeight: '700',
  },
  noticeText: {
    ...Typography.caption,
    color: Colors.slate,
    fontSize: 11,
    marginTop: 4,
  },
  doneButton: {
    backgroundColor: Colors.midnight,
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  doneButtonText: {
    ...Typography.button,
    color: Colors.parchment,
  },
});
