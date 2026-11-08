import { API_BASE_URL, REQUEST_TIMEOUT_MS, STORAGE_KEYS } from '../config';

/**
 * HTTP client for the Roundtable API.
 *
 * Responsibilities: attach the bearer token, time out stalled requests, turn
 * backend `{ error }` payloads into typed errors the UI can render directly,
 * and transparently refresh an expired access token exactly once per burst.
 */

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Raised when the request never reached the server (offline, DNS, CORS, timeout). */
export class NetworkError extends Error {
  constructor(message = 'Cannot reach the server. Check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

// --- session -------------------------------------------------------------

const readStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); stay in memory.
    return null;
  }
};

const writeStorage = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* memory-only session */
  }
};

const session = {
  token: readStorage(STORAGE_KEYS.token),
  refreshToken: readStorage(STORAGE_KEYS.refreshToken),
};

const expiryListeners = new Set();

/** Notified when the session cannot be recovered and the user must sign in. */
export function onSessionExpired(listener) {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}

export function setSession({ token, refreshToken }) {
  session.token = token ?? null;
  session.refreshToken = refreshToken ?? null;
  writeStorage(STORAGE_KEYS.token, session.token);
  writeStorage(STORAGE_KEYS.refreshToken, session.refreshToken);
}

export const getToken = () => session.token;

export function clearSession() {
  setSession({ token: null, refreshToken: null });
  writeStorage(STORAGE_KEYS.user, null);
}

// --- transport -----------------------------------------------------------

async function send(path, { method = 'GET', body, auth = true, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  // Honour both the caller's cancellation and our timeout.
  const onCallerAbort = () => timeout.abort();
  signal?.addEventListener('abort', onCallerAbort, { once: true });

  const init = { method, headers, signal: timeout.signal };
  if (body !== undefined) init.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch (error) {
    // A caller-initiated abort must stay an abort so effects can ignore it.
    if (signal?.aborted) throw error;
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null);

  return { response, payload };
}

// --- refresh -------------------------------------------------------------

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

    setSession({
      token: payload.token,
      refreshToken: payload.refreshToken ?? session.refreshToken,
    });
    return payload;
  })();

  refreshInFlight
    .catch((error) => {
      // A network blip should not sign the user out; only a rejected refresh does.
      if (error instanceof NetworkError) return;
      clearSession();
      expiryListeners.forEach((listener) => listener());
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

// --- request -------------------------------------------------------------

/**
 * Performs an API call and returns the parsed body. Backend failures throw an
 * ApiError carrying the server's `error` string, which views render as-is.
 */
export async function request(path, options = {}) {
  const { retryOnUnauthorized = true, ...rest } = options;
  let { response, payload } = await send(path, rest);

  // Access token expired mid-session: refresh once, then replay the request.
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

/** True for errors caused by a caller cancelling (unmount, chat switch). */
export const isAbortError = (error) => error?.name === 'AbortError';
