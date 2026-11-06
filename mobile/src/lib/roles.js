export const ROLES = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
  STUDENT: 'STUDENT',
};

export const ROLE_COLORS = {
  ADMIN: '#C9A227',
  HR: '#5B8A72',
  EMPLOYEE: '#4C7EA8',
  STUDENT: '#9B6BA8',
};

export const ROLE_LABELS = {
  ADMIN: 'Admin',
  HR: 'HR',
  EMPLOYEE: 'Employee',
  STUDENT: 'Student',
};

export const ADMIN_ASSIGNABLE_ROLES = [ROLES.HR, ROLES.EMPLOYEE, ROLES.STUDENT];
export const HR_ASSIGNABLE_ROLES = [ROLES.EMPLOYEE, ROLES.STUDENT];

export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(92, 101, 114, ${alpha})`;
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const roleColor = (role, fallback = '#5C6572') => ROLE_COLORS[role] ?? fallback;
export const roleLabel = (role) => ROLE_LABELS[role] ?? role ?? 'User';
export const canCreateChat = (role) => role !== ROLES.STUDENT;
