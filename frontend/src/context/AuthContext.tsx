import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, CSRF_HEADERS, api, onUnauthorized } from '../lib/api';
import type { AuthResponse, Company, User } from '../lib/types';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: User | null;
  company: Company | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Only sends the confirmation e-mail; the account exists after confirmEmail. Returns the API's message. */
  register: (input: { companyName: string; name: string; email: string; password: string }) => Promise<string>;
  confirmEmail: (token: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  acceptInvite: (token: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Earlier versions kept the token in localStorage; drop any copy left behind.
try {
  localStorage.removeItem('vitrine.token');
} catch {
  /* storage unavailable */
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const queryClient = useQueryClient();
  // The cookie is invisible to scripts, so /auth/me is the only way to know whether a session exists.
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);

  const clearSession = useCallback(() => {
    setUser(null);
    setCompany(null);
    setStatus('anonymous');
    // The next login may be another company: never show cached data from this one.
    queryClient.clear();
  }, [queryClient]);

  // Only the server can remove an httpOnly cookie; it also ends the session's other copies.
  const logout = useCallback(() => {
    void fetch('/api/auth/logout', { method: 'POST', headers: CSRF_HEADERS })
      .catch(() => undefined)
      .finally(clearSession);
  }, [clearSession]);

  useEffect(() => onUnauthorized(clearSession), [clearSession]);

  // Only a 401 logs out; network/server errors (e.g. API restarting) are retried.
  useEffect(() => {
    if (status !== 'loading') return;
    let cancelled = false;
    const check = async (attempt: number): Promise<void> => {
      try {
        const me = await api<{ user: User; company: Company }>('/auth/me');
        if (cancelled) return;
        setUser(me.user);
        setCompany(me.company);
        setStatus('authenticated');
      } catch (err) {
        if (cancelled) return;
        const transient = !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
        if (transient && attempt < 5) {
          setTimeout(() => void check(attempt + 1), 500 * 2 ** attempt);
        } else {
          clearSession();
        }
      }
    };
    void check(0);
    return () => {
      cancelled = true;
    };
  }, [status, clearSession]);

  const applyAuth = useCallback(
    (res: AuthResponse) => {
      queryClient.clear();
      setUser(res.user);
      setCompany(res.company);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      applyAuth(await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }));
    },
    [applyAuth],
  );

  const register = useCallback<AuthContextValue['register']>(async (input) => {
    const res = await api<{ message: string }>('/auth/register', { method: 'POST', body: input });
    return res.message;
  }, []);

  const confirmEmail = useCallback(
    async (token: string) => {
      applyAuth(await api<AuthResponse>('/auth/confirm-email', { method: 'POST', body: { token } }));
    },
    [applyAuth],
  );

  const acceptInvite = useCallback(
    async (token: string, password: string) => {
      applyAuth(await api<AuthResponse>('/auth/accept-invite', { method: 'POST', body: { token, password } }));
    },
    [applyAuth],
  );

  // Other sessions end on the server; this one continues with the fresh cookie it sets.
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await api<AuthResponse>('/auth/password', { method: 'PUT', body: { currentPassword, newPassword } });
    setUser(res.user);
    setCompany(res.company);
  }, []);

  const value = useMemo(
    () => ({ status, user, company, isAdmin: user?.role === 'admin', login, register, confirmEmail, logout, changePassword, acceptInvite }),
    [status, user, company, login, register, confirmEmail, logout, changePassword, acceptInvite],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
