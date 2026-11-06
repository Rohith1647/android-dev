import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-native
vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj) => obj.android || obj.default,
  },
}));

// Mock AsyncStorage
const mockStorage = new Map();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key) => mockStorage.get(key) ?? null),
    setItem: vi.fn(async (key, val) => {
      mockStorage.set(key, String(val));
    }),
    removeItem: vi.fn(async (key) => {
      mockStorage.delete(key);
    }),
    clear: vi.fn(async () => {
      mockStorage.clear();
    }),
  },
}));

import {
  clearSession,
  getRefreshToken,
  getToken,
  hydrateSession,
  onSessionExpired,
  refreshSession,
  request,
  setSession,
} from './client';

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

let unsubscribers = [];
function trackSessionExpired(listener) {
  unsubscribers.push(onSessionExpired(listener));
}

beforeEach(async () => {
  mockStorage.clear();
  await clearSession();
});

afterEach(() => {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Mobile Client: Session & AsyncStorage Hydration', () => {
  it('hydrates tokens from AsyncStorage into memory', async () => {
    mockStorage.set('roundtable.token', 'stored-access-token');
    mockStorage.set('roundtable.refreshToken', 'stored-refresh-token');

    const result = await hydrateSession();

    expect(result.token).toBe('stored-access-token');
    expect(result.refreshToken).toBe('stored-refresh-token');
    expect(getToken()).toBe('stored-access-token');
    expect(getRefreshToken()).toBe('stored-refresh-token');
  });

  it('updates AsyncStorage when setSession is called', async () => {
    await setSession({ token: 'new-token', refreshToken: 'new-refresh' });

    expect(mockStorage.get('roundtable.token')).toBe('new-token');
    expect(mockStorage.get('roundtable.refreshToken')).toBe('new-refresh');
    expect(getToken()).toBe('new-token');
  });

  it('clears storage and memory when clearSession is called', async () => {
    await setSession({ token: 'active-token', refreshToken: 'active-refresh' });
    await clearSession();

    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(mockStorage.get('roundtable.token')).toBeUndefined();
    expect(mockStorage.get('roundtable.refreshToken')).toBeUndefined();
  });
});

describe('Mobile Client: Refresh & Concurrency', () => {
  it('exchanges refresh token and updates both memory and AsyncStorage', async () => {
    await setSession({ token: 'old', refreshToken: 'refresh-1' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { token: 'new-token', refreshToken: 'refresh-2' })),
    );

    const payload = await refreshSession();

    expect(payload.token).toBe('new-token');
    expect(getToken()).toBe('new-token');
    expect(mockStorage.get('roundtable.token')).toBe('new-token');
  });

  it('deduplicates concurrent refresh calls into one in-flight request', async () => {
    await setSession({ token: 'old', refreshToken: 'refresh-1' });
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, { token: 'new-token' }));
    vi.stubGlobal('fetch', fetchSpy);

    const [resA, resB] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(resA).toBe(resB);
  });

  it('clears session and notifies expiry listeners on rejected refresh token', async () => {
    await setSession({ token: 'old', refreshToken: 'bad-refresh' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { error: 'Invalid refresh token' })));
    const listener = vi.fn();
    trackSessionExpired(listener);

    await expect(refreshSession()).rejects.toThrow('Invalid refresh token');

    expect(getToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('Mobile Client: request auto-retry on 401', () => {
  it('automatically refreshes token and replays original request on 401', async () => {
    await setSession({ token: 'expiring', refreshToken: 'refresh-1' });
    let apiCallCount = 0;

    const fetchSpy = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/api/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, { token: 'fresh-token' }));
      }
      apiCallCount += 1;
      return Promise.resolve(
        apiCallCount === 1 ? jsonResponse(401, { error: 'token_expired' }) : jsonResponse(200, { data: 'success' }),
      );
    });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await request('/api/chats');

    expect(result).toEqual({ data: 'success' });
    expect(getToken()).toBe('fresh-token');
    expect(apiCallCount).toBe(2);
  });
});
