import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';
import { SOCKJS_URL, WS_RECONNECT_MAX_MS, WS_RECONNECT_MIN_MS } from '../config';

/**
 * STOMP-over-SockJS client.
 *
 * Wraps @stomp/stompjs behind activate / deactivate / subscribe / publish, and
 * adds three things the app relies on:
 *   - subscriptions are declarative, so they survive a reconnect
 *   - the JWT is read fresh on every CONNECT attempt
 *   - a rejected CONNECT triggers a token refresh before the next attempt,
 *     with exponential backoff so a hard outage does not hammer the server
 */
export function createStompClient({ getToken, onStatusChange, onAuthFailure }) {
  /** destination -> Set<callback>; the intent, re-applied after every connect. */
  const desired = new Map();
  /** destination -> StompSubscription; the live handles. */
  const live = new Map();

  let client = null;
  let connected = false;
  let backoff = WS_RECONNECT_MIN_MS;
  let refreshing = false;

  const setStatus = (status) => onStatusChange?.(status);

  /** Widen the retry gap; called for both dropped and refused connections. */
  const widenBackoff = () => {
    backoff = Math.min(backoff * 2, WS_RECONNECT_MAX_MS);
    if (client) client.reconnectDelay = backoff;
  };

  /**
   * The network came back. Cancel whatever long backoff is pending and retry
   * now, rather than leaving the user offline for up to WS_RECONNECT_MAX_MS.
   */
  const handleOnline = () => {
    if (!client || connected) return;
    backoff = WS_RECONNECT_MIN_MS;
    client.reconnectDelay = WS_RECONNECT_MIN_MS;
    setStatus('connecting');
    const current = client;
    Promise.resolve(current.deactivate())
      .then(() => {
        if (client === current) current.activate();
      })
      .catch(() => {});
  };

  const handleOffline = () => {
    if (connected) return;
    setStatus('disconnected');
  };

  const bind = (destination) => {
    if (!client?.connected || live.has(destination)) return;
    const subscription = client.subscribe(destination, (frame) => {
      let payload;
      try {
        payload = JSON.parse(frame.body);
      } catch {
        payload = frame.body;
      }
      // Copy first: a handler may unsubscribe while we iterate.
      [...(desired.get(destination) ?? [])].forEach((callback) => {
        try {
          callback(payload);
        } catch {
          /* a bad handler must not kill the socket */
        }
      });
    });
    live.set(destination, subscription);
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

  const build = () =>
    new Client({
      webSocketFactory: () => new SockJS(SOCKJS_URL),
      reconnectDelay: WS_RECONNECT_MIN_MS,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      // The library logs every frame by default; keep the console clean.
      debug: () => {},

      // Runs before every connect attempt, including reconnects.
      beforeConnect: () => {
        client.connectHeaders = { Authorization: `Bearer ${getToken() ?? ''}` };
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
        setStatus(client?.active ? 'reconnecting' : 'disconnected');
      },

      // Fires when the socket never opened (server down, refused, DNS). Without
      // this the retry gap would stay at its floor and poll the server forever.
      onWebSocketError: () => {
        connected = false;
        widenBackoff();
        setStatus(client?.active ? 'reconnecting' : 'disconnected');
      },

      onStompError: async (frame) => {
        connected = false;
        if (!isAuthFailure(frame) || !onAuthFailure || refreshing) {
          setStatus('reconnecting');
          return;
        }
        // Refresh the token; beforeConnect picks up the new one on the retry.
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

  return {
    get connected() {
      return connected;
    },

    activate() {
      if (client) return;
      client = build();
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      setStatus('connecting');
      client.activate();
    },

    deactivate() {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      connected = false;
      live.forEach((subscription) => {
        try {
          subscription.unsubscribe();
        } catch {
          /* socket already gone */
        }
      });
      live.clear();
      desired.clear();
      client?.deactivate();
      client = null;
      setStatus('disconnected');
    },

    subscribe(destination, callback) {
      if (!desired.has(destination)) desired.set(destination, new Set());
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
            /* socket already gone */
          }
          live.delete(destination);
        }
      };
    },

    /** Returns false when the socket is down; REST remains the source of truth. */
    publish(destination, payload) {
      if (!client?.connected) return false;
      client.publish({ destination, body: JSON.stringify(payload) });
      return true;
    },
  };
}
