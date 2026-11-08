import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStompClient } from './stompClient';

let capturedConfig;
let mockInstance;

vi.mock('sockjs-client/dist/sockjs', () => ({ default: vi.fn() }));

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

function authFailureFrame() {
  return { headers: { message: 'Unauthorized' }, body: 'Token expired' };
}

function otherErrorFrame() {
  return { headers: { message: 'Broker error' }, body: 'Malformed frame' };
}

let activeClient;

/** Creates a client and remembers it so the test's `online`/`offline` listeners get torn down. */
function createTestClient(options) {
  activeClient = createStompClient(options);
  return activeClient;
}

beforeEach(() => {
  capturedConfig = undefined;
  mockInstance = undefined;
  activeClient = undefined;
});

afterEach(() => {
  activeClient?.deactivate();
  vi.clearAllMocks();
});

describe('WebSocket auth edge cases', () => {
  it('refreshes the token on an auth-failure STOMP error and reconnects rather than giving up', async () => {
    const onAuthFailure = vi.fn().mockResolvedValue(true);
    const onStatusChange = vi.fn();
    const client = createTestClient({ getToken: () => 'stale', onStatusChange, onAuthFailure });
    client.activate();

    await capturedConfig.onStompError(authFailureFrame());

    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(mockInstance.deactivate).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith('reconnecting');
  });

  it('gives up and disconnects when the token refresh itself fails', async () => {
    const onAuthFailure = vi.fn().mockResolvedValue(false);
    const onStatusChange = vi.fn();
    const client = createTestClient({ getToken: () => 'stale', onStatusChange, onAuthFailure });
    client.activate();

    await capturedConfig.onStompError(authFailureFrame());

    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(mockInstance.deactivate).toHaveBeenCalledTimes(1);
    expect(onStatusChange).toHaveBeenLastCalledWith('disconnected');
  });

  it('does not attempt a token refresh for a non-auth STOMP error', async () => {
    const onAuthFailure = vi.fn();
    const onStatusChange = vi.fn();
    const client = createTestClient({ getToken: () => 'stale', onStatusChange, onAuthFailure });
    client.activate();

    await capturedConfig.onStompError(otherErrorFrame());

    expect(onAuthFailure).not.toHaveBeenCalled();
    expect(onStatusChange).toHaveBeenLastCalledWith('reconnecting');
  });

  it('reads the token fresh on every connect attempt, including reconnects', () => {
    let token = 'token-v1';
    const client = createTestClient({ getToken: () => token, onStatusChange: vi.fn() });
    client.activate();

    capturedConfig.beforeConnect();
    expect(mockInstance.connectHeaders).toEqual({ Authorization: 'Bearer token-v1' });

    token = 'token-v2';
    capturedConfig.beforeConnect();
    expect(mockInstance.connectHeaders).toEqual({ Authorization: 'Bearer token-v2' });
  });

  it('widens the reconnect backoff on a dropped connection so an outage does not hammer the server', () => {
    const onStatusChange = vi.fn();
    const client = createTestClient({ getToken: () => 'token', onStatusChange });
    client.activate();
    const initialDelay = mockInstance.reconnectDelay;

    capturedConfig.onWebSocketClose();

    expect(mockInstance.reconnectDelay).toBeGreaterThan(initialDelay);
    expect(onStatusChange).toHaveBeenLastCalledWith('reconnecting');
  });
});
