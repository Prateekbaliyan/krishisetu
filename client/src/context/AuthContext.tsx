import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';
import { SyncManager } from '../services/syncManager';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  switchDemoRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('krishisetu_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('krishisetu_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('krishisetu_token');
      if (storedToken) {
        try {
          const res = await api.getMe();
          if (res.user) {
            setUser(res.user);
            localStorage.setItem('krishisetu_user', JSON.stringify(res.user));
            // Trigger offline caches refresh on login
            SyncManager.refreshOfflineCaches();
          }
        } catch (err) {
          console.warn('Session verification failed, using cached session if available');
        }
      }
      setIsLoading(false);
    };

    initAuth();

    const handleAuthExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login({ email, password });
      if (res.token && res.user) {
        setToken(res.token);
        setUser(res.user);
        localStorage.setItem('krishisetu_token', res.token);
        localStorage.setItem('krishisetu_user', JSON.stringify(res.user));
        // Refresh Dexie caches for offline capability
        SyncManager.refreshOfflineCaches();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('krishisetu_token');
    localStorage.removeItem('krishisetu_user');
  };

  const switchDemoRole = async (targetRole: UserRole) => {
    if (targetRole === 'OPERATOR') {
      await login('operator.c07@krishisetu.in', 'password123');
    } else {
      await login('manager@krishisetu.in', 'password123');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, switchDemoRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

