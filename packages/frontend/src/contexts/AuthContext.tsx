/**
 * Authentication context
 * Manages user authentication state and token storage
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User } from '../api/auth';
import { moduleLoaderService } from '../services/module-loader.service';
import { tokenStorage } from '../utils/token-storage.utils';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = tokenStorage.getAccessToken();
      if (token) {
        try {
          const response = await authApi.getCurrentUser();
          setUser(response.data.user);

          // Load modules after successful authentication
          try {
            await moduleLoaderService.initialize();
            console.log('[Auth] Modules loaded successfully');
          } catch (moduleError) {
            console.error('[Auth] Failed to load modules:', moduleError);
            // Don't block authentication if module loading fails
          }
        } catch (error) {
          tokenStorage.clearTokens();
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    const { accessToken, refreshToken } = response.data;

    tokenStorage.setAccessToken(accessToken);
    tokenStorage.setRefreshToken(refreshToken);

    const userResponse = await authApi.getCurrentUser();
    setUser(userResponse.data.user);

    // Load modules after successful login
    try {
      await moduleLoaderService.initialize();
      console.log('[Auth] Modules loaded after login');
    } catch (moduleError) {
      console.error('[Auth] Failed to load modules after login:', moduleError);
      // Don't block login if module loading fails
    }
  };

  const register = async (
    email: string,
    username: string,
    password: string,
    firstName?: string,
    lastName?: string
  ) => {
    await authApi.register({ email, username, password, firstName, lastName });
    // After registration, log in automatically
    await login(email, password);
  };

  const logout = async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch (error) {
        // Ignore errors on logout
      }
    }

    tokenStorage.clearTokens();
    setUser(null);

    // Reset modules on logout
    moduleLoaderService.reset();
    console.log('[Auth] Modules reset after logout');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
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
