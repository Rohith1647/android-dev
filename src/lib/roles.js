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

/** Roles an ADMIN may assign. Admin is never assignable from the UI. */
export const ADMIN_ASSIGNABLE_ROLES = [ROLES.HR, ROLES.EMPLOYEE, ROLES.STUDENT];

/** Roles an HR user may assign. */
export const HR_ASSIGNABLE_ROLES = [ROLES.EMPLOYEE, ROLES.STUDENT];

/** Converts hex color code to RGBA string for universal cross-browser opacity support. */
export function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(92, 101, 114, ${alpha})`;
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Falls back to a neutral tone so an unknown role never reads as Admin gold. */
export const roleColor = (role, fallback = '#5C6572') => ROLE_COLORS[role] ?? fallback;
export const roleLabel = (role) => ROLE_LABELS[role] ?? role;

/** Only students are blocked from creating chats. */
export const canCreateChat = (role) => role !== ROLES.STUDENT;
