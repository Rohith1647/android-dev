import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getToken, refreshSession } from '../api/client';
import { createStompClient } from '../realtime/stompClient';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);

/**
 * Owns the single STOMP connection for the session: opened after login, torn
 * down on logout, and re-authenticated through /api/auth/refresh if the access
 * token expires while the socket is open.
 */
export function RealtimeProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState('disconnected');
  const clientRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      clientRef.current?.deactivate();
      clientRef.current = null;
      setStatus('disconnected');
      return undefined;
    }

    const client = createStompClient({
      getToken,
      onStatusChange: setStatus,
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

  const value = useMemo(
    () => ({
      status,
      isConnected: status === 'connected',
      subscribe: (destination, callback) =>
        clientRef.current?.subscribe(destination, callback) ?? (() => {}),
      publish: (destination, payload) => clientRef.current?.publish(destination, payload) ?? false,
    }),
    [status],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (!context) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return context;
}
