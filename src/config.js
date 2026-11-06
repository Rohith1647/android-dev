/**
 * Runtime configuration, supplied at build time by Vite env vars.
 *
 * Local development proxies /api and /ws through the dev server (see
 * vite.config.js), so the defaults below are correct with no .env file. For a
 * deployed build set VITE_API_BASE_URL and VITE_SOCKJS_URL to the gateway that
 * serves the API, or leave them empty when the SPA is served from the same
 * origin as the backend.
 */
const env = import.meta.env;

const trimSlash = (value) => (value ?? '').replace(/\/+$/, '');

/** Base URL that `/api/...` paths are appended to. Empty means same origin. */
export const API_BASE_URL = trimSlash(env.VITE_API_BASE_URL);

/** SockJS endpoint exposing the STOMP broker. */
export const SOCKJS_URL = trimSlash(env.VITE_SOCKJS_URL) || `${API_BASE_URL}/ws`;

/** Abort any HTTP request that has not responded within this window. */
export const REQUEST_TIMEOUT_MS = Number(env.VITE_REQUEST_TIMEOUT_MS ?? 15000);

/** Session storage keys. */
export const STORAGE_KEYS = {
  token: 'roundtable.token',
  refreshToken: 'roundtable.refreshToken',
  user: 'roundtable.user',
  mustChangePassword: 'roundtable.mustChangePassword',
};

/** Publish at most one typing event per this interval while typing. */
export const TYPING_THROTTLE_MS = 2000;

/** Messages fetched per page in a thread. */
export const MESSAGE_PAGE_SIZE = 50;

/** How long a typing indicator survives without a refresh from the sender. */
export const TYPING_TTL_MS = 4500;

/** Realtime reconnect backoff bounds. */
export const WS_RECONNECT_MIN_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30000;
