import { Platform } from 'react-native';

/**
 * Android emulator host loopback is 10.0.2.2.
 * Physical device or other environments can be configured via process.env or fallback.
 */
const getDefaultApiBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8080';
  }
  return 'http://localhost:8080';
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || getDefaultApiBaseUrl();

export const REQUEST_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS || 15000);

export const STORAGE_KEYS = {
  token: 'roundtable.token',
  refreshToken: 'roundtable.refreshToken',
  user: 'roundtable.user',
  mustChangePassword: 'roundtable.mustChangePassword',
};

export const ROLES = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  EMPLOYEE: 'EMPLOYEE',
  STUDENT: 'STUDENT',
};

/** WebSocket / STOMP broker URL */
const getDefaultWsUrl = () => {
  const base = API_BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws`;
};

export const WS_URL = process.env.EXPO_PUBLIC_WS_URL || getDefaultWsUrl();

/** Publish at most one typing event per this interval while typing. */
export const TYPING_THROTTLE_MS = 2000;

/** Messages fetched per page in a thread. */
export const MESSAGE_PAGE_SIZE = 50;

/** How long a typing indicator survives without a refresh from the sender. */
export const TYPING_TTL_MS = 4500;

/** Realtime reconnect backoff bounds. */
export const WS_RECONNECT_MIN_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30000;
