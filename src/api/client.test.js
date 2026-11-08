import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, getToken, onSessionExpired, refreshSession, request, setSession } from './client';

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

let unsubscribers = [];

/** Registers a session-expiry listener and arranges for it to be removed after the test. */
function trackSessionExpired(listener) {
  unsubscribers.push(onSessionExpired(listener));
}

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('refreshSession — JWT expiry edge cases', () => {
  it('exchanges the refresh token for a new access token', async () => {
    setSession({ token: 'old', refreshToken: 'refresh-1' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { token: 'new-token', refreshToken: 'refresh-2' })),
    );

    const payload = await refreshSession();

    expect(payload.token).toBe('new-token');
    expect(getToken()).toBe('new-token');
  });

  it('shares one in-flight request across concurrent callers', async () => {
    setSession({ token: 'old', refreshToken: 'refresh-1' });
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, { token: 'new-token' }));
    vi.stubGlobal('fetch', fetchSpy);

    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('clears the session and notifies listeners when the refresh token is rejected', async () => {
    setSession({ token: 'old', refreshToken: 'bad-refresh' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Invalid refresh token' })));
    const listener = vi.fn();
    trackSessionExpired(listener);

    await expect(refreshSession()).rejects.toThrow('Invalid refresh token');

    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not sign the user out on a network blip during refresh', async () => {
    setSession({ token: 'old', refreshToken: 'refresh-1' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')));
    const listener = vi.fn();
    trackSessionExpired(listener);

    await expect(refreshSession()).rejects.toThrow();

    expect(getToken()).toBe('old');
    expect(listener).not.toHaveBeenCalled();
  });

  it('rejects immediately when there is no refresh token to exchange', async () => {
    setSession({ token: 'old', refreshToken: null });
    vi.stubGlobal('fetch', vi.fn());

    await expect(refreshSession()).rejects.toThrow('No refresh token');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('request — silent refresh-and-retry on an expired access token', () => {
  it('refreshes once and replays the original request on a 401', async () => {
    setSession({ token: 'expiring', refreshToken: 'refresh-1' });
    let chatsCallCount = 0;
    const fetchSpy = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/api/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, { token: 'fresh-token' }));
      }
      chatsCallCount += 1;
      // First call (stale token) fails; the replay after refresh succeeds.
      return Promise.resolve(
        chatsCallCount === 1 ? jsonResponse(401, { error: 'expired' }) : jsonResponse(200, { ok: true }),
      );
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await request('/api/chats');

    expect(result).toEqual({ ok: true });
    expect(getToken()).toBe('fresh-token');
    expect(chatsCallCount).toBe(2);
  });

  it('surfaces a friendly session-expired error when the refresh itself fails', async () => {
    setSession({ token: 'expiring', refreshToken: 'bad-refresh' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url) =>
        String(url).includes('/api/auth/refresh')
          ? Promise.resolve(jsonResponse(401, { error: 'invalid' }))
          : Promise.resolve(jsonResponse(401, { error: 'expired' })),
      ),
    );

    await expect(request('/api/chats')).rejects.toMatchObject({
      message: 'Your session expired. Please sign in again.',
      status: 401,
    });
  });

  it('does not attempt a refresh for an unauthenticated request', async () => {
    setSession({ token: null, refreshToken: null });
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(401, { error: 'expired' }));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(request('/api/public-endpoint', { auth: false })).rejects.toThrow('expired');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
