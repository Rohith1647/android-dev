import { useMemo } from 'react';
import { UserManagementPanel } from '../components/users/UserManagementPanel';
import { userAdminApi } from '../api/endpoints';
import { HR_ASSIGNABLE_ROLES, ROLES } from '../lib/roles';
import { useAuth } from '../state/AuthContext';

export function HrPanel() {
  const { user } = useAuth();
  // GET /api/hr/users is already limited to employees and students server-side,
  // so the table renders exactly what the backend returns.
  const api = useMemo(() => userAdminApi(ROLES.HR), []);

  return (
    <UserManagementPanel
      title="HR panel"
      subtitle="Add and manage employees and students."
      api={api}
      roleOptions={HR_ASSIGNABLE_ROLES}
      currentUserId={user?.id}
    />
  );
}
