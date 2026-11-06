import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getToken, refreshSession } from '../api/client';
import { createStompClient } from '../realtime/stompClient';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);

/**
 * Provides real-time messaging capabilities to the React Native app.
 *
 * Automatically connects to STOMP broker when authenticated.
 * Listens to AppState and NetInfo to manage reconnects.
 * Provides subscribe, publish, and status helpers.
 */
export function RealtimeProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState('disconnected');
  const [isOnline, setIsOnline] = useState(true);
  const clientRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      if (clientRef.current) {
        clientRef.current.deactivate();
        clientRef.current = null;
      }
      setStatus('disconnected');
      return undefined;
    }

    const client = createStompClient({
      getToken,
      onStatusChange: setStatus,
      onNetworkChange: setIsOnline,
      onAuthFailure: async () => {
        try {
          await refreshSession();
          return true;
        } catch {
          return false;
        }
      },
    });

    clientRef.current = client;
    client.activate();

    return () => {
      client.deactivate();
      clientRef.current = null;
    };
  }, [isAuthenticated]);

  const subscribe = useCallback((destination, callback) => {
    if (!clientRef.current) return () => {};
    return clientRef.current.subscribe(destination, callback);
  }, []);

  const publish = useCallback((destination, payload) => {
    if (!clientRef.current) return false;
    return clientRef.current.publish(destination, payload);
  }, []);

  const value = useMemo(
    () => ({
      status,
      isConnected: status === 'connected',
      isConnecting: status === 'connecting' || status === 'reconnecting',
      isOnline,
      subscribe,
      publish,
    }),
    [status, isOnline, subscribe, publish],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used inside <RealtimeProvider>');
  }
  return context;
}
