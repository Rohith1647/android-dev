import './polyfills';
import NetInfo from '@react-native-community/netinfo';
import { Client } from '@stomp/stompjs';
import { AppState } from 'react-native';
import { WS_RECONNECT_MAX_MS, WS_RECONNECT_MIN_MS, WS_URL } from '../config';

/**
 * Native STOMP Client for React Native (Android / iOS).
 *
 * Built on @stomp/stompjs using React Native's native WebSocket engine.
 * Key enhancements for mobile:
 *  - Polyfills TextEncoder/Decoder for @stomp/stompjs frame serialization.
 *  - AppState integration: gracefully disconnects/suspends on background, auto-reconnects on foreground.
 *  - NetInfo integration: immediate reconnect attempt when device comes online, avoiding long backoff waits.
 *  - Declarative subscriptions that persist and auto-rebind across reconnects.
 *  - Per-connection fresh JWT token injection via `beforeConnect`.
 *  - Automatic 401 token refresh on STOMP auth rejection with exponential backoff retry.
 */
export function createStompClient({
  getToken,
  onStatusChange,
  onAuthFailure,
  onNetworkChange,
  url = WS_URL,
}) {
  /** destination -> Set<callback>; the intent, re-applied after every connect. */
  const desired = new Map();
  /** destination -> StompSubscription; the live handles. */
  const live = new Map();

  let client = null;
  let connected = false;
  let backoff = WS_RECONNECT_MIN_MS;
  let refreshing = false;
  let netInfoUnsubscribe = null;
  let appStateSubscription = null;
  let isBackgrounded = false;

  const setStatus = (status) => onStatusChange?.(status);

  /** Widen the retry gap; called for both dropped and refused connections. */
  const widenBackoff = () => {
    backoff = Math.min(backoff * 2, WS_RECONNECT_MAX_MS);
    if (client) client.reconnectDelay = backoff;
  };

  /**
   * Device network or AppState restored.
   * Cancel pending backoff and reconnect immediately.
   */
  const triggerReconnect = () => {
    if (!client || connected || isBackgrounded) return;
    backoff = WS_RECONNECT_MIN_MS;
    client.reconnectDelay = WS_RECONNECT_MIN_MS;
    setStatus('connecting');
    const current = client;
    Promise.resolve(current.deactivate())
      .then(() => {
        if (client === current && !isBackgrounded) {
          current.activate();
        }
      })
      .catch(() => {});
  };

  const bind = (destination) => {
    if (!client?.connected || live.has(destination)) return;
    try {
      const subscription = client.subscribe(destination, (frame) => {
        let payload;
        try {
          payload = JSON.parse(frame.body);
        } catch {
          payload = frame.body;
        }
        // Copy first: a handler may unsubscribe while iterating.
        [...(desired.get(destination) ?? [])].forEach((callback) => {
          try {
            callback(payload);
          } catch {
            /* a bad handler must not kill the socket */
          }
        });
      });
      live.set(destination, subscription);
    } catch {
      /* subscription failed */
    }
  };

  const isAuthFailure = (frame) => {
    const detail = `${frame?.headers?.message ?? ''} ${frame?.body ?? ''}`.toLowerCase();
    return (
      detail.includes('unauthorized') ||
      detail.includes('expired') ||
      detail.includes('invalid token') ||
      detail.includes('access denied') ||
      detail.includes('401')
    );
  };

  const build = () => {
    return new Client({
      // React Native provides a global WebSocket object
      brokerURL: url,
      reconnectDelay: WS_RECONNECT_MIN_MS,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},

      // Evaluated before each connection attempt
      beforeConnect: () => {
        const token = getToken ? getToken() : null;
        client.connectHeaders = {
          Authorization: token ? `Bearer ${token}` : '',
        };
      },

      onConnect: () => {
        connected = true;
        backoff = WS_RECONNECT_MIN_MS;
        client.reconnectDelay = WS_RECONNECT_MIN_MS;
        setStatus('connected');
        desired.forEach((_, destination) => bind(destination));
      },

      onWebSocketClose: () => {
        connected = false;
        live.clear();
        widenBackoff();
        setStatus(client?.active && !isBackgrounded ? 'reconnecting' : 'disconnected');
      },

      onWebSocketError: () => {
        connected = false;
        widenBackoff();
        setStatus(client?.active && !isBackgrounded ? 'reconnecting' : 'disconnected');
      },

      onStompError: async (frame) => {
        connected = false;
        if (!isAuthFailure(frame) || !onAuthFailure || refreshing) {
          setStatus('reconnecting');
          return;
        }

        refreshing = true;
        setStatus('reconnecting');
        try {
          const refreshed = await onAuthFailure();
          if (!refreshed) {
            setStatus('disconnected');
            client?.deactivate();
          }
        } finally {
          refreshing = false;
        }
      },
    });
  };

  // Setup NetInfo network monitor
  const setupNetworkListener = () => {
    if (netInfoUnsubscribe) return;
    netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      const isOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      onNetworkChange?.(isOnline);

      if (isOnline) {
        triggerReconnect();
      } else {
        if (!connected) {
          setStatus('disconnected');
        }
      }
    });
  };

  // Setup AppState lifecycle monitor
  const setupAppStateListener = () => {
    if (appStateSubscription) return;
    appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        isBackgrounded = false;
        if (client && !connected) {
          triggerReconnect();
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        isBackgrounded = true;
        // Cleanly disconnect when entering background to preserve Android resources
        if (client) {
          client.deactivate();
          connected = false;
          live.clear();
          setStatus('disconnected');
        }
      }
    });
  };

  return {
    get connected() {
      return connected;
    },

    activate() {
      if (client) return;
      isBackgrounded = AppState.currentState ? AppState.currentState !== 'active' : false;
      client = build();
      setupNetworkListener();
      setupAppStateListener();

      if (!isBackgrounded) {
        setStatus('connecting');
        client.activate();
      } else {
        setStatus('disconnected');
      }
    },

    deactivate() {
      if (netInfoUnsubscribe) {
        netInfoUnsubscribe();
        netInfoUnsubscribe = null;
      }
      if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
      }

      connected = false;
      live.forEach((sub) => {
        try {
          sub.unsubscribe();
        } catch {
          /* socket closed */
        }
      });
      live.clear();
      desired.clear();

      client?.deactivate();
      client = null;
      setStatus('disconnected');
    },

    subscribe(destination, callback) {
      if (!desired.has(destination)) {
        desired.set(destination, new Set());
      }
      desired.get(destination).add(callback);
      bind(destination);

      return () => {
        const handlers = desired.get(destination);
        handlers?.delete(callback);
        if (handlers && handlers.size === 0) {
          desired.delete(destination);
          try {
            live.get(destination)?.unsubscribe();
          } catch {
            /* socket gone */
          }
          live.delete(destination);
        }
      };
    },

    publish(destination, payload) {
      if (!client?.connected) return false;
      try {
        client.publish({
          destination,
          body: JSON.stringify(payload),
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}
