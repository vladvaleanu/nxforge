/**
 * Authentication API endpoints
 */

import apiClient, { ApiResponse } from './client';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface User {
  userId: string;
  email: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  roles: string[];
  permissions: string[];
  sessions: Session[];
}

export interface Session {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  username?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export const authApi = {
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthTokens>> {
    return apiClient.post<AuthTokens>('/auth/login', credentials);
  },

  async register(data: RegisterData): Promise<ApiResponse<{ userId: string }>> {
    return apiClient.post<{ userId: string }>('/auth/register', data);
  },

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return apiClient.get<{ user: User }>('/auth/me');
  },

  async logout(refreshToken: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>('/auth/logout', { refreshToken });
  },

  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthTokens>> {
    return apiClient.post<AuthTokens>('/auth/refresh', { refreshToken });
  },

  async getProfile(): Promise<ApiResponse<UserProfile>> {
    return apiClient.get<UserProfile>('/auth/profile');
  },

  async updateProfile(data: UpdateProfileData): Promise<ApiResponse<{ user: UserProfile }>> {
    return apiClient.put<{ user: UserProfile }>('/auth/profile', data);
  },

  async changePassword(data: ChangePasswordData): Promise<ApiResponse<{ message: string }>> {
    return apiClient.put<{ message: string }>('/auth/password', data);
  },

  async revokeSession(sessionId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<{ message: string }>(`/auth/sessions/${sessionId}`);
  },

  async revokeOtherSessions(refreshToken: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<{ message: string }>('/auth/sessions', { refreshToken });
  },
};
