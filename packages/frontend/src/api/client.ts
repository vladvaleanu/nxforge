/**
 * API client for backend communication
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { formatErrorForLogging } from '../utils/error.utils';
import { tokenStorage } from '../utils/token-storage.utils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

/**
 * Success response from backend
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    requestId?: string;
    timestamp?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Error response from backend
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: any;
  };
  meta: {
    requestId: string;
    timestamp: string;
    path?: string;
  };
}

/**
 * Union type for API responses
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = tokenStorage.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh and logging
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Log error for debugging (only in development)
        if (import.meta.env.DEV) {
          console.error('[API Error]', formatErrorForLogging(error));
        }

        const originalRequest = error.config as any;

        // If 401 and not already retried, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const refreshToken = tokenStorage.getRefreshToken();
          if (refreshToken) {
            try {
              const response = await axios.post<ApiResponse>(`${API_BASE_URL}/auth/refresh`, {
                refreshToken,
              });

              const { accessToken, refreshToken: newRefreshToken } = response.data.data;

              tokenStorage.setAccessToken(accessToken);
              tokenStorage.setRefreshToken(newRefreshToken);

              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.client(originalRequest);
            } catch (refreshError) {
              // Refresh failed, clear tokens and redirect to login
              tokenStorage.clearTokens();

              // Prevent multiple redirects
              if (window.location.pathname !== '/login') {
                window.location.href = '/login';
              }
              return Promise.reject(refreshError);
            }
          } else {
            // No refresh token, clear everything and redirect
            tokenStorage.clearTokens();

            // Prevent multiple redirects
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string): Promise<ApiSuccessResponse<T>> {
    const response = await this.client.get<ApiSuccessResponse<T>>(url);
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<ApiSuccessResponse<T>> {
    const response = await this.client.post<ApiSuccessResponse<T>>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<ApiSuccessResponse<T>> {
    const response = await this.client.put<ApiSuccessResponse<T>>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<ApiSuccessResponse<T>> {
    const response = await this.client.delete<ApiSuccessResponse<T>>(url);
    return response.data;
  }

  /**
   * Get the Axios instance for advanced usage
   */
  getClient(): AxiosInstance {
    return this.client;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
