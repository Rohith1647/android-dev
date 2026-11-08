import React, { useMemo } from 'react';
import { userAdminApi } from '../api/endpoints';
import { UserManagementPanel } from '../components/UserManagementPanel';
import { HR_ASSIGNABLE_ROLES, ROLES } from '../lib/roles';
import { useAuth } from '../state/AuthContext';

export function HrScreen() {
  const { user } = useAuth();
  // GET /api/hr/users is limited to employees and students server-side
  const api = useMemo(() => userAdminApi(ROLES.HR), []);

  return (
    <UserManagementPanel
      title="HR Management"
      subtitle="Add and manage employees and students."
      api={api}
      roleOptions={HR_ASSIGNABLE_ROLES}
      currentUserId={user?.id}
    />
  );
}
