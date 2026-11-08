import { useMemo } from 'react';
import { UserManagementPanel } from '../components/users/UserManagementPanel';
import { userAdminApi } from '../api/endpoints';
import { ADMIN_ASSIGNABLE_ROLES, ROLES } from '../lib/roles';
import { useAuth } from '../state/AuthContext';

export function AdminPanel() {
  const { user } = useAuth();
  const api = useMemo(() => userAdminApi(ROLES.ADMIN), []);

  return (
    <UserManagementPanel
      title="Admin panel"
      subtitle="Add and manage HR, employees, and students."
      api={api}
      roleOptions={ADMIN_ASSIGNABLE_ROLES}
      currentUserId={user?.id}
    />
  );
}
