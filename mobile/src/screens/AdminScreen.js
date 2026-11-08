import React, { useMemo } from 'react';
import { userAdminApi } from '../api/endpoints';
import { UserManagementPanel } from '../components/UserManagementPanel';
import { ADMIN_ASSIGNABLE_ROLES, ROLES } from '../lib/roles';
import { useAuth } from '../state/AuthContext';

export function AdminScreen() {
  const { user } = useAuth();
  const api = useMemo(() => userAdminApi(ROLES.ADMIN), []);

  return (
    <UserManagementPanel
      title="Admin Console"
      subtitle="Add and manage HR, employees, and students."
      api={api}
      roleOptions={ADMIN_ASSIGNABLE_ROLES}
      currentUserId={user?.id}
    />
  );
}
