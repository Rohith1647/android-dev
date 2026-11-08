import { describe, expect, it } from 'vitest';
import { ADMIN_ASSIGNABLE_ROLES, HR_ASSIGNABLE_ROLES, ROLES, canCreateChat, roleColor, roleLabel } from './roles';

describe('canCreateChat', () => {
  it('blocks Students from creating chats', () => {
    expect(canCreateChat(ROLES.STUDENT)).toBe(false);
  });

  it.each([ROLES.ADMIN, ROLES.HR, ROLES.EMPLOYEE])('allows %s to create chats', (role) => {
    expect(canCreateChat(role)).toBe(true);
  });
});

describe('assignable roles', () => {
  it('never offers Admin as an assignable role from either panel', () => {
    expect(ADMIN_ASSIGNABLE_ROLES).not.toContain(ROLES.ADMIN);
    expect(HR_ASSIGNABLE_ROLES).not.toContain(ROLES.ADMIN);
  });

  it('keeps HR scoped to Employee/Student only, so HR can never grant its own role', () => {
    expect(HR_ASSIGNABLE_ROLES).toEqual([ROLES.EMPLOYEE, ROLES.STUDENT]);
    expect(HR_ASSIGNABLE_ROLES).not.toContain(ROLES.HR);
  });

  it('lets Admin assign HR in addition to Employee/Student', () => {
    expect(ADMIN_ASSIGNABLE_ROLES).toEqual([ROLES.HR, ROLES.EMPLOYEE, ROLES.STUDENT]);
  });
});

describe('roleColor / roleLabel', () => {
  it('falls back to a neutral tone for an unrecognized role', () => {
    expect(roleColor('UNKNOWN')).toBe('#5C6572');
  });

  it('echoes back an unrecognized role as its own label', () => {
    expect(roleLabel('UNKNOWN')).toBe('UNKNOWN');
  });
});
