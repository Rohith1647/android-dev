import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS } from '../config';
import { clearSession, getToken, onSessionExpired } from '../api/client';
import { login as loginRequest } from '../api/endpoints';

const AuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readStoredMustChangePassword = () => {
  try {
    return localStorage.getItem(STORAGE_KEYS.mustChangePassword) === 'true';
  } catch {
    return false;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (getToken() ? readStoredUser() : null));
  const [mustChangePassword, setMustChangePassword] = useState(() =>
    getToken() ? readStoredMustChangePassword() : false,
  );
  const [expiredNotice, setExpiredNotice] = useState(null);

  const logout = useCallback(() => {
    clearSession();
    try {
      localStorage.removeItem(STORAGE_KEYS.mustChangePassword);
    } catch {
      /* ignore */
    }
    setUser(null);
    setMustChangePassword(false);
  }, []);

  // A refresh that could not be recovered drops us back to the login page.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setMustChangePassword(false);
        setExpiredNotice('Your session expired. Please sign in again.');
      }),
    [],
  );

  const signIn = useCallback(async ({ email, password }) => {
    const data = await loginRequest({ email, password });
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
    const requiresChange = Boolean(data.mustChangePassword);
    if (requiresChange) {
      localStorage.setItem(STORAGE_KEYS.mustChangePassword, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEYS.mustChangePassword);
    }
    setUser(data.user);
    setMustChangePassword(requiresChange);
    setExpiredNotice(null);
    return data.user;
  }, []);

  const completePasswordChange = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.mustChangePassword);
    } catch {
      /* ignore */
    }
    setMustChangePassword(false);
  }, []);

  const value = useMemo(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      mustChangePassword,
      completePasswordChange,
      signIn,
      logout,
      expiredNotice,
      clearExpiredNotice: () => setExpiredNotice(null),
    }),
    [user, mustChangePassword, completePasswordChange, signIn, logout, expiredNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
