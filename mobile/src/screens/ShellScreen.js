import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { useAuth } from '../state/AuthContext';
import { useRealtime } from '../state/RealtimeContext';
import { Colors, Radii, Spacing, Typography } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ShellScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, mustChangePassword, completePasswordChange } = useAuth();
  const { status, isOnline } = useRealtime();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'ADMIN':
        return Colors.roleAdmin;
      case 'HR':
        return Colors.roleHr;
      case 'EMPLOYEE':
        return Colors.roleEmployee;
      default:
        return Colors.roleStudent;
    }
  };

  const getStatusBadge = () => {
    if (!isOnline) {
      return { text: 'Offline', bg: Colors.slate, dot: '#EF4444' };
    }
    switch (status) {
      case 'connected':
        return { text: 'Realtime Connected', bg: '#DCFCE7', dot: '#16A34A', textColor: '#15803D' };
      case 'connecting':
        return { text: 'Connecting…', bg: '#FEF3C7', dot: '#D97706', textColor: '#B45309' };
      case 'reconnecting':
        return { text: 'Reconnecting…', bg: '#FEF3C7', dot: '#D97706', textColor: '#B45309' };
      default:
        return { text: 'Disconnected', bg: '#FEE2E2', dot: '#DC2626', textColor: '#B91C1C' };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <View style={styles.container}>
      {/* Top App Bar with safe area padding */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, Spacing.lg) }]}>
        <View style={styles.headerBrand}>
          <Image
            source={require('../../assets/setu-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerTitle}>SETU</Text>
            <Text style={styles.headerSubtitle}>Logged in as {user?.email || 'User'}</Text>
          </View>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(user?.role) }]}>
          <Text style={styles.roleText}>{user?.role || 'GUEST'}</Text>
        </View>
      </View>

      {/* Connection status banner */}
      <View style={[styles.statusBanner, { backgroundColor: statusBadge.bg }]}>
        <View style={[styles.statusDot, { backgroundColor: statusBadge.dot }]} />
        <Text style={[styles.statusText, { color: statusBadge.textColor || Colors.midnight }]}>
          {statusBadge.text}
        </Text>
      </View>

      {/* Main Content / Navigation targets */}
      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, Spacing.xl) }]}>
        <Text style={styles.sectionTitle}>Conversations & Workspace</Text>

        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Chats')}
          activeOpacity={0.7}
        >
          <Text style={styles.cardTitle}>💬 All Chats</Text>
          <Text style={styles.cardDesc}>View your active channels and direct messages</Text>
        </TouchableOpacity>

        {user?.role === 'ADMIN' && (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Admin')}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>⚙️ Admin Console</Text>
            <Text style={styles.cardDesc}>Manage enterprise users and system settings</Text>
          </TouchableOpacity>
        )}

        {user?.role === 'HR' && (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('HR')}
            activeOpacity={0.7}
          >
            <Text style={styles.cardTitle}>👥 HR Portal</Text>
            <Text style={styles.cardDesc}>Manage employees, onboarding, and student cohorts</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.card}
          onPress={() => setChangePasswordOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.cardTitle}>🔑 Change Password</Text>
          <Text style={styles.cardDesc}>Update your account security credentials</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Self-service password change modal */}
      <ChangePasswordModal
        open={changePasswordOpen}
        forced={false}
        onClose={() => setChangePasswordOpen(false)}
        onSuccess={() => setChangePasswordOpen(false)}
      />

      {/* Forced first-time password change modal */}
      {mustChangePassword && (
        <ChangePasswordModal
          open={true}
          forced={true}
          onSuccess={completePasswordChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  header: {
    backgroundColor: Colors.midnight,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
  },
  headerTitle: {
    ...Typography.h2,
    color: Colors.parchment,
  },
  headerSubtitle: {
    ...Typography.caption,
    color: Colors.slateLight,
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  roleText: {
    color: Colors.midnight,
    fontSize: 11,
    fontWeight: '700',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs + 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: '600',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    minHeight: 56,
    justifyContent: 'center',
  },
  cardTitle: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.midnight,
  },
  cardDesc: {
    ...Typography.bodyMuted,
    marginTop: 4,
  },
  logoutButton: {
    marginTop: 'auto',
    backgroundColor: '#FDEDED',
    paddingVertical: Spacing.md,
    minHeight: 48,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  logoutText: {
    ...Typography.button,
    color: Colors.error,
  },
});
