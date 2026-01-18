/**
 * Users Management API endpoints (admin only)
 */

import apiClient, { ApiResponse } from './client';

export interface UserListItem {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  roles: Role[];
}

export interface UserDetail extends UserListItem {
  sessions: Session[];
  _count: {
    auditLogs: number;
  };
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface Session {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
}

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  roleId?: string;
}

export interface UpdateUserData {
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface ListUsersQuery {
  search?: string;
  role?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Backend returns { success, data: T[], pagination: {...} }
// We need to transform this for the frontend
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// Raw backend response format for paginated endpoints
interface BackendPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
  error?: { message: string; statusCode: number };
}

export const usersApi = {
  async listUsers(query: ListUsersQuery = {}): Promise<ApiResponse<PaginatedResponse<UserListItem>>> {
    const params = new URLSearchParams();
    if (query.search) params.append('search', query.search);
    if (query.role) params.append('role', query.role);
    if (query.isActive !== undefined) params.append('isActive', query.isActive);
    if (query.page) params.append('page', String(query.page));
    if (query.limit) params.append('limit', String(query.limit));

    // Backend returns { success, data: [], pagination: {} }
    // Transform to { success, data: { data: [], meta: {} } }
    const response = await apiClient.get<UserListItem[]>(`/users?${params}`) as unknown as BackendPaginatedResponse<UserListItem>;

    if (response.success) {
      return {
        success: true,
        data: {
          data: response.data,
          meta: response.pagination,
        },
      };
    }

    return {
      success: false,
      error: response.error,
    } as ApiResponse<PaginatedResponse<UserListItem>>;
  },

  async getRoles(): Promise<ApiResponse<Role[]>> {
    return apiClient.get<Role[]>('/users/roles');
  },

  async getUser(id: string): Promise<ApiResponse<UserDetail>> {
    return apiClient.get<UserDetail>(`/users/${id}`);
  },

  async createUser(data: CreateUserData): Promise<ApiResponse<UserListItem>> {
    return apiClient.post<UserListItem>('/users', data);
  },

  async updateUser(id: string, data: UpdateUserData): Promise<ApiResponse<UserListItem>> {
    return apiClient.put<UserListItem>(`/users/${id}`, data);
  },

  async assignRole(userId: string, roleId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.put<{ message: string }>(`/users/${userId}/role`, { roleId });
  },

  async resetPassword(userId: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.put<{ message: string }>(`/users/${userId}/password`, { newPassword });
  },

  async deleteUser(id: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<{ message: string }>(`/users/${id}`);
  },

  async revokeUserSessions(userId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<{ message: string }>(`/users/${userId}/sessions`);
  },
};
