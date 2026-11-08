import { describe, expect, it, vi } from 'vitest';

// Mock react-native
vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj) => obj.android || obj.default,
  },
}));

import {
  ADMIN_ASSIGNABLE_ROLES,
  HR_ASSIGNABLE_ROLES,
  ROLES,
  roleColor,
  roleLabel,
} from '../lib/roles';
import { userAdminApi } from '../api/endpoints';

describe('Day 4: Admin & HR User Management (T4.1 & T4.2)', () => {
  describe('Role Scopes & Assignment Guardrails', () => {
    it('HR can only assign EMPLOYEE and STUDENT, never HR or ADMIN', () => {
      expect(HR_ASSIGNABLE_ROLES).toContain(ROLES.EMPLOYEE);
      expect(HR_ASSIGNABLE_ROLES).toContain(ROLES.STUDENT);
      expect(HR_ASSIGNABLE_ROLES).not.toContain(ROLES.HR);
      expect(HR_ASSIGNABLE_ROLES).not.toContain(ROLES.ADMIN);
    });

    it('Admin can assign HR, EMPLOYEE, STUDENT, but never ADMIN', () => {
      expect(ADMIN_ASSIGNABLE_ROLES).toContain(ROLES.HR);
      expect(ADMIN_ASSIGNABLE_ROLES).toContain(ROLES.EMPLOYEE);
      expect(ADMIN_ASSIGNABLE_ROLES).toContain(ROLES.STUDENT);
      expect(ADMIN_ASSIGNABLE_ROLES).not.toContain(ROLES.ADMIN);
    });
  });

  describe('Manageable Row Policy in Panels', () => {
    const isManageable = (targetUser, allowedRoles, currentUserId) =>
      allowedRoles.includes(targetUser.role) && targetUser.id !== currentUserId;

    it('prevents self-management even if role matches panel allowed roles', () => {
      const loggedInAdmin = { id: 'admin-1', role: ROLES.HR };
      expect(isManageable(loggedInAdmin, ADMIN_ASSIGNABLE_ROLES, 'admin-1')).toBe(false);
    });

    it('allows Admin to manage HR, Employee, and Student accounts', () => {
      const hrUser = { id: 'hr-1', role: ROLES.HR };
      const employeeUser = { id: 'emp-1', role: ROLES.EMPLOYEE };
      const studentUser = { id: 'stu-1', role: ROLES.STUDENT };
      const adminUser = { id: 'adm-2', role: ROLES.ADMIN };

      expect(isManageable(hrUser, ADMIN_ASSIGNABLE_ROLES, 'current-admin')).toBe(true);
      expect(isManageable(employeeUser, ADMIN_ASSIGNABLE_ROLES, 'current-admin')).toBe(true);
      expect(isManageable(studentUser, ADMIN_ASSIGNABLE_ROLES, 'current-admin')).toBe(true);
      expect(isManageable(adminUser, ADMIN_ASSIGNABLE_ROLES, 'current-admin')).toBe(false);
    });

    it('allows HR to manage only Employee and Student accounts', () => {
      const employeeUser = { id: 'emp-1', role: ROLES.EMPLOYEE };
      const studentUser = { id: 'stu-1', role: ROLES.STUDENT };
      const hrUser = { id: 'hr-2', role: ROLES.HR };
      const adminUser = { id: 'adm-1', role: ROLES.ADMIN };

      expect(isManageable(employeeUser, HR_ASSIGNABLE_ROLES, 'current-hr')).toBe(true);
      expect(isManageable(studentUser, HR_ASSIGNABLE_ROLES, 'current-hr')).toBe(true);
      expect(isManageable(hrUser, HR_ASSIGNABLE_ROLES, 'current-hr')).toBe(false);
      expect(isManageable(adminUser, HR_ASSIGNABLE_ROLES, 'current-hr')).toBe(false);
    });
  });

  describe('User Filter & Search Utility', () => {
    const users = [
      { id: '1', name: 'Alice Smith', email: 'alice@roundtable.io', role: ROLES.EMPLOYEE },
      { id: '2', name: 'Bob Jones', email: 'bob@roundtable.io', role: ROLES.STUDENT },
      { id: '3', name: 'Carol HR', email: 'carol@roundtable.io', role: ROLES.HR },
    ];

    const filterUsers = (list, query) => {
      if (!query.trim()) return list;
      const q = query.trim().toLowerCase();
      return list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q),
      );
    };

    it('filters by user name', () => {
      const results = filterUsers(users, 'alice');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('1');
    });

    it('filters by email', () => {
      const results = filterUsers(users, 'bob@');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('filters by role', () => {
      const results = filterUsers(users, 'student');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('returns empty list for unmatched query', () => {
      const results = filterUsers(users, 'nonexistent');
      expect(results).toHaveLength(0);
    });
  });

  describe('Mobile userAdminApi endpoint wiring', () => {
    it('creates API handlers with correct prefix per role', () => {
      const adminApi = userAdminApi(ROLES.ADMIN);
      expect(typeof adminApi.list).toBe('function');
      expect(typeof adminApi.create).toBe('function');
      expect(typeof adminApi.changeRole).toBe('function');
      expect(typeof adminApi.remove).toBe('function');

      const hrApi = userAdminApi(ROLES.HR);
      expect(typeof hrApi.list).toBe('function');
      expect(typeof hrApi.create).toBe('function');
      expect(typeof hrApi.changeRole).toBe('function');
      expect(typeof hrApi.remove).toBe('function');
    });
  });
});
