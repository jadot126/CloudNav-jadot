import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AuthContextType {
  authToken: string | null;
  isAuthenticated: boolean;
  requiresAuth: boolean | null;
  isCheckingAuth: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  setRequiresAuth: (value: boolean) => void;
  setIsCheckingAuth: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'cloudnav_auth_token';

interface AuthProviderProps {
  children: ReactNode;
  passwordExpiryDays?: number;
}

export function AuthProvider({ children, passwordExpiryDays = 7 }: AuthProviderProps) {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 初始化时检查本地存储的 token
  useEffect(() => {
    const savedToken = localStorage.getItem(AUTH_KEY);
    const lastLoginTime = localStorage.getItem('lastLoginTime');

    if (savedToken) {
      const currentTime = Date.now();

      if (lastLoginTime) {
        const lastLogin = parseInt(lastLoginTime);
        const timeDiff = currentTime - lastLogin;
        const expiryTimeMs = passwordExpiryDays > 0 ? passwordExpiryDays * 24 * 60 * 60 * 1000 : 0;

        if (expiryTimeMs > 0 && timeDiff > expiryTimeMs) {
          // Token 已过期
          localStorage.removeItem(AUTH_KEY);
          localStorage.removeItem('lastLoginTime');
          setAuthToken(null);
        } else {
          setAuthToken(savedToken);
        }
      } else {
        setAuthToken(savedToken);
      }
    }
  }, [passwordExpiryDays]);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const authResponse = await fetch('/api/storage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': password
        },
        body: JSON.stringify({ authOnly: true })
      });

      if (authResponse.ok) {
        setAuthToken(password);
        localStorage.setItem(AUTH_KEY, password);
        localStorage.setItem('lastLoginTime', Date.now().toString());
        return true;
      }
      return false;
    } catch (e) {
      console.error('Login failed:', e);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('lastLoginTime');
  }, []);

  const value: AuthContextType = {
    authToken,
    isAuthenticated: !!authToken,
    requiresAuth,
    isCheckingAuth,
    login,
    logout,
    setRequiresAuth,
    setIsCheckingAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
