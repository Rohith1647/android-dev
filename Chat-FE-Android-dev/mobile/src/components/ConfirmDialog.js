import React from 'react';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../theme';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  loading = false,
  error = null,
}) {
  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent={true}
      onRequestClose={loading ? () => {} : onCancel}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.centered}>
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            {Boolean(description) && <Text style={styles.description}>{description}</Text>}

            {Boolean(error) && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}
                onPress={onConfirm}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmText}>{confirmLabel}</Text>
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
  overlay: {
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
    marginBottom: Spacing.sm,
  },
  description: {
    ...Typography.bodyMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.lg,
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
  cancelButton: {
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
  confirmButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radii.md,
    backgroundColor: Colors.error,
    minWidth: 100,
    alignItems: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
