import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, REQUEST_TIMEOUT_MS, STORAGE_KEYS } from '../config';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Cannot reach the server. Check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

// In-memory cache synced with AsyncStorage
const session = {
  token: null,
  refreshToken: null,
  isHydrated: false,
};

const expiryListeners = new Set();

/** Notified when the session cannot be recovered and the user must sign in. */
export function onSessionExpired(listener) {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}

/**
 * Hydrates tokens from AsyncStorage into memory at app start.
 * Safe against race conditions and non-blocking callers.
 */
export async function hydrateSession() {
  try {
    const [token, refreshToken] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.token),
      AsyncStorage.getItem(STORAGE_KEYS.refreshToken),
    ]);
    session.token = token ?? null;
    session.refreshToken = refreshToken ?? null;
  } catch {
    session.token = null;
    session.refreshToken = null;
  } finally {
    session.isHydrated = true;
  }
  return { token: session.token, refreshToken: session.refreshToken };
}

export async function setSession({ token, refreshToken }) {
  session.token = token ?? null;
  session.refreshToken = refreshToken ?? null;

  try {
    const operations = [];
    if (session.token) {
      operations.push(AsyncStorage.setItem(STORAGE_KEYS.token, session.token));
    } else {
      operations.push(AsyncStorage.removeItem(STORAGE_KEYS.token));
    }

    if (session.refreshToken) {
      operations.push(AsyncStorage.setItem(STORAGE_KEYS.refreshToken, session.refreshToken));
    } else {
      operations.push(AsyncStorage.removeItem(STORAGE_KEYS.refreshToken));
    }

    await Promise.all(operations);
  } catch {
    // Retain in-memory session if storage fails
  }
}

export const getToken = () => session.token;
export const getRefreshToken = () => session.refreshToken;
export const isSessionHydrated = () => session.isHydrated;

export async function clearSession() {
  await setSession({ token: null, refreshToken: null });
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.user);
    await AsyncStorage.removeItem(STORAGE_KEYS.mustChangePassword);
  } catch {
    /* ignore */
  }
}

// --- transport -----------------------------------------------------------

async function send(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => timeout.abort();
  signal?.addEventListener('abort', onCallerAbort, { once: true });

  const init = { method, headers, signal: timeout.signal };
  if (body !== undefined) init.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, payload };
}

// --- refresh queue singleton ----------------------------------------------

let refreshInFlight = null;

/**
 * Exchanges the refresh token for a new access token. Concurrent callers share
 * one in-flight request, so a burst of 401s triggers a single refresh.
 */
export function refreshSession() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    if (!session.refreshToken) throw new ApiError('No refresh token', 401, null);

    const { response, payload } = await send('/api/auth/refresh', {
      method: 'POST',
      auth: false,
      body: { refreshToken: session.refreshToken },
    });

    if (!response.ok) {
      throw new ApiError(payload?.error ?? 'Could not refresh session', response.status, payload);
    }

    await setSession({
      token: payload.token,
      refreshToken: payload.refreshToken ?? session.refreshToken,
    });
    return payload;
  })();

  refreshInFlight
    .catch(async (error) => {
      // Network blips should not log user out
      if (error instanceof NetworkError) return;
      await clearSession();
      expiryListeners.forEach((listener) => listener());
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

// --- request -------------------------------------------------------------

/**
 * Performs an API call and returns the parsed body.
 * Transparently refreshes on 401 and replays once.
 */
export async function request(path, options = {}) {
  const { retryOnUnauthorized = true, ...rest } = options;
  let { response, payload } = await send(path, rest);

  if (
    response.status === 401 &&
    retryOnUnauthorized &&
    rest.auth !== false &&
    session.refreshToken
  ) {
    try {
      await refreshSession();
    } catch (error) {
      if (error instanceof NetworkError) throw error;
      throw new ApiError('Your session expired. Please sign in again.', 401, null);
    }
    ({ response, payload } = await send(path, rest));
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error ?? `Request failed (${response.status})`,
      response.status,
      payload,
    );
  }

  return payload;
}

export const isAbortError = (error) => error?.name === 'AbortError';
