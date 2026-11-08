import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { isAbortError } from '../api/client';
import { Avatar } from './Avatar';
import { RoleBadge } from './RoleBadge';
import { AddUserModal } from './AddUserModal';
import { ChangeRoleModal } from './ChangeRoleModal';
import { ConfirmDialog } from './ConfirmDialog';
import { roleLabel } from '../lib/roles';
import { Colors, Radii, Spacing, Typography } from '../theme';

/**
 * Shared User Management component for Admin and HR screens.
 * Provides user search, listing, role assignment, user creation,
 * removal confirmation, and permission-isolated actions.
 */
export function UserManagementPanel({
  title,
  subtitle,
  api,
  roleOptions,
  currentUserId,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [addOpen, setAddOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(null);

  // Active action menu per user row
  const [menuUserId, setMenuUserId] = useState(null);

  const fetchUsers = useCallback(async (isPull = false) => {
    if (isPull) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await api.list();
      setUsers(data?.users ?? (Array.isArray(data) ? data : []));
    } catch (err) {
      if (!isAbortError(err)) {
        setError(err.message || 'Failed to load users');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Manageability guard: user must have a role in the panel's scope and not be current user
  const isManageable = (user) => roleOptions.includes(user.role) && user.id !== currentUserId;

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q),
    );
  }, [users, searchQuery]);

  const handleChangeRoleSubmit = async (newRole) => {
    if (!roleTarget) return;
    await api.changeRole(roleTarget.id, newRole);
    setUsers((current) =>
      current.map((u) => (u.id === roleTarget.id ? { ...u, role: newRole } : u)),
    );
    setRoleTarget(null);
  };

  const handleRemoveSubmit = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await api.remove(removeTarget.id);
      setUsers((current) => current.filter((u) => u.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch (err) {
      setRemoveError(err.message || 'Failed to remove user');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        {/* Top Banner & Action */}
        <View style={styles.topBar}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.addUserBtn}
            onPress={() => setAddOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.addUserBtnText}>+ Add User</Text>
          </TouchableOpacity>
        </View>

        {/* Search Filter Toolbar */}
        <View style={styles.toolbar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, or role…"
            placeholderTextColor={Colors.slateLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.counterRow}>
            <Text style={styles.counterText}>
            Showing {filteredUsers.length} of {users.length} members
          </Text>
        </View>
      </View>

      {/* Users List */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.ember} />
          <Text style={styles.loadingText}>Loading directory…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchUsers()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredUsers.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>
            {searchQuery.trim() ? 'No matching users found' : 'No users registered yet'}
          </Text>
          <Text style={styles.emptyDesc}>
            {searchQuery.trim()
              ? `No user records match "${searchQuery}".`
              : 'Tap "+ Add User" above to create an account and assign roles.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchUsers(true)}
              colors={[Colors.ember, Colors.midnight]}
              tintColor={Colors.ember}
            />
          }
          renderItem={({ item }) => {
            const manageable = isManageable(item);
            const isMenuOpen = menuUserId === item.id;
            const isSelf = item.id === currentUserId;

            return (
              <View style={styles.userCard}>
                <View style={styles.userCardMain}>
                  <Avatar name={item.name} role={item.role} size={42} />

                  <View style={styles.userInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isSelf && <Text style={styles.selfTag}>(you)</Text>}
                    </View>
                    <Text style={styles.userEmail} numberOfLines={1}>
                      {item.email}
                    </Text>
                  </View>

                  <View style={styles.badgeWrapper}>
                    <RoleBadge role={item.role} />
                  </View>

                  {manageable ? (
                    <TouchableOpacity
                      style={styles.moreBtn}
                      onPress={() => setMenuUserId(isMenuOpen ? null : item.id)}
                      activeOpacity={0.7}
                      accessibilityLabel={`Actions for ${item.name}`}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.moreBtnText}>•••</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.unmanageablePlaceholder}>
                      <Text style={styles.unmanageableText}>—</Text>
                    </View>
                  )}
                </View>

                {/* Inline Expanded Actions Menu */}
                {isMenuOpen && manageable && (
                  <View style={styles.actionMenuRow}>
                    <TouchableOpacity
                      style={styles.actionItem}
                      onPress={() => {
                        setMenuUserId(null);
                        setRoleTarget(item);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionItemRoleText}>⚙️ Change Role</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionItem, styles.actionItemRemove]}
                      onPress={() => {
                        setMenuUserId(null);
                        setRemoveError(null);
                        setRemoveTarget(item);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.actionItemRemoveText}>🗑 Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
      </View>

      {/* Add User Modal */}
      <AddUserModal
        open={addOpen}
        roleOptions={roleOptions}
        onClose={() => setAddOpen(false)}
        onCreate={(payload) => api.create(payload)}
        onCreated={(newUser) => {
          if (newUser) {
            setUsers((curr) => [newUser, ...curr]);
          }
          fetchUsers();
        }}
      />

      {/* Change Role Modal */}
      <ChangeRoleModal
        open={Boolean(roleTarget)}
        user={roleTarget}
        roleOptions={roleOptions}
        onClose={() => setRoleTarget(null)}
        onSubmit={handleChangeRoleSubmit}
      />

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove User"
        description={
          removeTarget
            ? `${removeTarget.name} (${roleLabel(removeTarget.role)}) will lose access immediately. This action cannot be undone.`
            : ''
        }
        confirmLabel="Remove User"
        loading={removing}
        error={removeError}
        onCancel={() => {
          setRemoveTarget(null);
          setRemoveError(null);
        }}
        onConfirm={handleRemoveSubmit}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  headerInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  title: {
    ...Typography.h3,
    color: Colors.midnight,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.slate,
    marginTop: 2,
  },
  addUserBtn: {
    backgroundColor: Colors.midnight,
    paddingHorizontal: Spacing.md + 4,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.full,
  },
  addUserBtnText: {
    color: Colors.parchment,
    fontSize: 13,
    fontWeight: '700',
  },
  toolbar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    backgroundColor: Colors.canvas,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    minHeight: 44,
    fontSize: 16,
    color: Colors.ink,
    marginBottom: Spacing.xs,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 2,
  },
  counterText: {
    ...Typography.caption,
    color: Colors.slate,
    fontSize: 11,
  },
  listContent: {
    padding: Spacing.md,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  userCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userName: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.midnight,
  },
  selfTag: {
    ...Typography.caption,
    color: Colors.slateLight,
    fontStyle: 'italic',
  },
  userEmail: {
    ...Typography.caption,
    color: Colors.slate,
    marginTop: 2,
  },
  badgeWrapper: {
    marginRight: Spacing.sm,
  },
  moreBtn: {
    paddingHorizontal: Spacing.md,
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.sm,
    backgroundColor: Colors.canvas,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  moreBtnText: {
    color: Colors.slate,
    fontSize: 15,
    fontWeight: '700',
  },
  unmanageablePlaceholder: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unmanageableText: {
    color: Colors.slateLight,
    fontSize: 14,
  },
  actionMenuRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.canvas,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  actionItem: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  actionItemRoleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.midnight,
  },
  actionItemRemove: {
    backgroundColor: '#FEE2E2',
  },
  actionItemRemoveText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.error,
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
    paddingVertical: Spacing.sm,
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
