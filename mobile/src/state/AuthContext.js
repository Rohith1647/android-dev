import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  getToken,
  hydrateSession,
  onSessionExpired,
  setSession,
} from '../api/client';
import { STORAGE_KEYS } from '../config';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [expiredNotice, setExpiredNotice] = useState(null);

  // Initial session hydration on app launch
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const { token } = await hydrateSession();
        if (token) {
          const [storedUser, storedMustChange] = await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.user),
            AsyncStorage.getItem(STORAGE_KEYS.mustChangePassword),
          ]);
          if (isMounted && storedUser) {
            setUser(JSON.parse(storedUser));
            setMustChangePassword(storedMustChange === 'true');
          }
        }
      } catch (e) {
        // Fallback to unauthenticated state on corruption
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initializeAuth();

    const unsubscribe = onSessionExpired(() => {
      if (isMounted) {
        setUser(null);
        setMustChangePassword(false);
        setExpiredNotice('Your session expired. Please sign in again.');
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async ({ user: userData, token, refreshToken, mustChange }) => {
    await setSession({ token, refreshToken });
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData));
    if (mustChange) {
      await AsyncStorage.setItem(STORAGE_KEYS.mustChangePassword, 'true');
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.mustChangePassword);
    }
    setUser(userData);
    setMustChangePassword(Boolean(mustChange));
    setExpiredNotice(null);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setUser(null);
    setMustChangePassword(false);
  }, []);

  const completePasswordChange = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.mustChangePassword);
    } catch {
      /* ignore */
    }
    setMustChangePassword(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user && getToken()),
      isLoading,
      mustChangePassword,
      completePasswordChange,
      signIn,
      logout,
      expiredNotice,
      clearExpiredNotice: () => setExpiredNotice(null),
    }),
    [user, isLoading, mustChangePassword, completePasswordChange, signIn, logout, expiredNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
