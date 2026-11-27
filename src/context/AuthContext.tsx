import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, setCsrfToken } from '../utils/apiClient';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  roleId: string;
  roleSlug: string;
  roleName: string;
  role: 'master' | 'adjunto';
  permissions: string[];
  customPermissions?: {
    grant: string[];
    deny: string[];
  };
  avatar: string;
  status: 'active' | 'suspended' | 'disabled';
  lockedUntil?: string | null;
  mustChangePassword?: boolean;
  totpEnabled?: boolean;
  lastLoginAt?: string | null;
  activeSessions?: number;
  createdAt?: string;
}

interface AuthContextValue {
  authChecked: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  username: string;
  env: 'development' | 'staging' | 'production';
  isMaster: boolean;
  isSuperAdmin: boolean;
  hasPermission: (required: string | string[]) => boolean;
  editMode: boolean;
  setEditMode: (next: boolean) => void;
  toggleEditMode: () => void;
  refreshAuth: () => Promise<void>;
  setAuthSession: (user: AuthUser | null, csrfToken?: string | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [env, setEnv] = useState<'development' | 'staging' | 'production'>('development');
  const [editMode, setEditMode] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.env === 'staging' || data.env === 'production' || data.env === 'development') {
          setEnv(data.env);
        }
        if (data.authenticated && data.user) {
          setCsrfToken(data.csrfToken || null);
          setUser(data.user);
        } else {
          setCsrfToken(null);
          setUser(null);
          setEditMode(false);
        }
      }
    } catch {
      setCsrfToken(null);
      setUser(null);
      setEditMode(false);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const setAuthSession = useCallback((nextUser: AuthUser | null, csrfToken?: string | null) => {
    if (csrfToken !== undefined) {
      setCsrfToken(csrfToken);
    }
    setUser(nextUser);
    if (!nextUser) {
      setCsrfToken(null);
      setEditMode(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setCsrfToken(null);
      setUser(null);
      setEditMode(false);
    }
  }, []);

  const hasPermission = useCallback(
    (required: string | string[]) => {
      if (!user || !Array.isArray(user.permissions)) return false;
      if (user.permissions.includes('*')) return true;
      if (Array.isArray(required)) {
        return required.some((perm) => user.permissions.includes(perm));
      }
      return user.permissions.includes(required);
    },
    [user],
  );

  const toggleEditMode = useCallback(() => {
    setEditMode((v) => !v);
  }, []);

  const authenticated = Boolean(user);
  const isSuperAdmin = user?.roleSlug === 'superadmin';
  const canDesign = hasPermission(['site.design', 'site.pages', 'site.menus']);

  return (
    <AuthContext.Provider
      value={{
        authChecked,
        authenticated,
        user,
        username: user?.username || '',
        env,
        isMaster: canDesign,
        isSuperAdmin,
        hasPermission,
        editMode: canDesign && editMode,
        setEditMode,
        toggleEditMode,
        refreshAuth,
        setAuthSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
