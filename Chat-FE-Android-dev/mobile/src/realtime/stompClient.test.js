import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock react-native
let currentAppState = 'active';
let appStateListeners = new Set();
vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj) => obj.android || obj.default,
  },
  AppState: {
    get currentState() {
      return currentAppState;
    },
    addEventListener: vi.fn((event, callback) => {
      appStateListeners.add(callback);
      return {
        remove: () => appStateListeners.delete(callback),
      };
    }),
  },
}));

// Mock NetInfo
let netInfoListeners = new Set();
vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: vi.fn((callback) => {
      netInfoListeners.add(callback);
      return () => netInfoListeners.delete(callback);
    }),
  },
}));

// Mock @stomp/stompjs
let capturedConfig;
let mockInstance;
vi.mock('@stomp/stompjs', () => ({
  Client: vi.fn().mockImplementation(function (config) {
    capturedConfig = config;
    mockInstance = {
      activate: vi.fn(),
      deactivate: vi.fn(),
      connected: false,
      active: true,
      reconnectDelay: config.reconnectDelay,
      connectHeaders: {},
      subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
      publish: vi.fn(),
    };
    return mockInstance;
  }),
}));

import { createStompClient } from './stompClient';

function authFailureFrame() {
  return { headers: { message: 'Unauthorized' }, body: 'Token expired' };
}

let activeClient;

function createTestClient(options) {
  activeClient = createStompClient(options);
  return activeClient;
}

beforeEach(() => {
  currentAppState = 'active';
  appStateListeners.clear();
  netInfoListeners.clear();
  capturedConfig = undefined;
  mockInstance = undefined;
  activeClient = undefined;
});

afterEach(() => {
  activeClient?.deactivate();
  vi.clearAllMocks();
});

describe('Mobile Native STOMP Client: Auth & Lifecycle', () => {
  it('reads token fresh before connect and handles auth failure with refresh retry', async () => {
    let token = 'initial-token';
    const onAuthFailure = vi.fn().mockImplementation(async () => {
      token = 'refreshed-token';
      return true;
    });
    const onStatusChange = vi.fn();

    const client = createTestClient({
      getToken: () => token,
      onStatusChange,
      onAuthFailure,
    });
    client.activate();

    capturedConfig.beforeConnect();
    expect(mockInstance.connectHeaders).toEqual({ Authorization: 'Bearer initial-token' });

    // Simulate auth rejection from broker
    await capturedConfig.onStompError(authFailureFrame());
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenLastCalledWith('reconnecting');

    // Subsequent connection attempt picks up refreshed token
    capturedConfig.beforeConnect();
    expect(mockInstance.connectHeaders).toEqual({ Authorization: 'Bearer refreshed-token' });
  });

  it('deactivates and disconnects if token refresh fails', async () => {
    const onAuthFailure = vi.fn().mockResolvedValue(false);
    const onStatusChange = vi.fn();

    const client = createTestClient({
      getToken: () => 'token',
      onStatusChange,
      onAuthFailure,
    });
    client.activate();

    await capturedConfig.onStompError(authFailureFrame());

    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(mockInstance.deactivate).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenLastCalledWith('disconnected');
  });

  it('widens reconnect backoff exponentially on websocket close', () => {
    const onStatusChange = vi.fn();
    const client = createTestClient({
      getToken: () => 'token',
      onStatusChange,
    });
    client.activate();

    const initialDelay = mockInstance.reconnectDelay;
    capturedConfig.onWebSocketClose();

    expect(mockInstance.reconnectDelay).toBeGreaterThan(initialDelay);
    expect(onStatusChange).toHaveBeenLastCalledWith('reconnecting');
  });

  it('cleans up connection when app transitions to background to save resources', () => {
    const client = createTestClient({
      getToken: () => 'token',
      onStatusChange: vi.fn(),
    });
    client.activate();

    // Trigger background transition
    appStateListeners.forEach((listener) => listener('background'));

    expect(mockInstance.deactivate).toHaveBeenCalled();
  });

  it('triggers immediate reconnect when device comes back online from airplane mode', () => {
    const onStatusChange = vi.fn();
    const onNetworkChange = vi.fn();
    const client = createTestClient({
      getToken: () => 'token',
      onStatusChange,
      onNetworkChange,
    });
    client.activate();

    // Emulate offline drop
    netInfoListeners.forEach((listener) => listener({ isConnected: false, isInternetReachable: false }));
    expect(onNetworkChange).toHaveBeenCalledWith(false);

    // Emulate coming back online (e.g. airplane mode toggled off)
    netInfoListeners.forEach((listener) => listener({ isConnected: true, isInternetReachable: true }));
    expect(onNetworkChange).toHaveBeenCalledWith(true);
    expect(onStatusChange).toHaveBeenCalledWith('connecting');
  });

  it('persists declarative subscriptions and binds them when connected', () => {
    const client = createTestClient({
      getToken: () => 'token',
      onStatusChange: vi.fn(),
    });
    client.activate();

    const callback = vi.fn();
    const unsubscribe = client.subscribe('/topic/messages', callback);

    // Simulate successful connect
    mockInstance.connected = true;
    capturedConfig.onConnect();

    expect(mockInstance.subscribe).toHaveBeenCalledWith('/topic/messages', expect.any(Function));

    unsubscribe();
  });
});
