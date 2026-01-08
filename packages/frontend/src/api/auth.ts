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
};
