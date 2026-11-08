import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from './endpoints';
import { clearSession, getToken, setSession } from './client';

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

describe('changePassword API endpoint', () => {
  beforeEach(() => {
    clearSession();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('sends POST /api/auth/password with auth and updates token in session', async () => {
    setSession({ token: 'initial-jwt' });

    let requestedUrl = null;
    let requestOptions = null;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url, opts) => {
        requestedUrl = url;
        requestOptions = opts;
        return jsonResponse(200, { token: 'new-jwt-token' });
      }),
    );

    const result = await changePassword({
      currentPassword: 'old-secret-password',
      newPassword: 'new-secret-password-12',
    });

    expect(result.token).toBe('new-jwt-token');
    expect(getToken()).toBe('new-jwt-token');
    expect(requestedUrl).toContain('/api/auth/password');
    expect(requestOptions.method).toBe('POST');
    expect(requestOptions.headers['Authorization']).toBe('Bearer initial-jwt');
    expect(JSON.parse(requestOptions.body)).toEqual({
      currentPassword: 'old-secret-password',
      newPassword: 'new-secret-password-12',
    });
  });
});
