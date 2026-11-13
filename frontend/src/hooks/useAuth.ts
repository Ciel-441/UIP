'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi } from '@/lib/api';
import { User } from '@/types';
import React from 'react';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      setUser(res.data);
    } catch {
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
      fetchUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const newToken = res.data.access_token;
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    await fetchUser();
  };

  const register = async (email: string, password: string, name: string) => {
    await authApi.register({ email, password, name });
    // Token is no longer returned; user must verify email first
  };

  const logout = () => {
    const performLogout = () => {
      localStorage.removeItem('auth_token');
      setToken(null);
      setUser(null);
      window.location.href = '/login';
    };

    authApi.logout()
      .then(performLogout)
      .catch((err) => {
        console.error('Failed to blacklist token during logout:', err);
        performLogout();
      });
  };

  return React.createElement(
    AuthContext.Provider,
    {
      value: {
        user,
        token,
        loading,
        login,
        register,
        logout,
        fetchUser,
        isAuthenticated: !!token && !!user,
      },
    },
    children
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
