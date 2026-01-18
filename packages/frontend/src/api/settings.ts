/**
 * System Settings API endpoints (admin only)
 */

import apiClient, { ApiResponse } from './client';

export interface SystemInfo {
  environment: string;
  version: string;
  uptime: number;
  nodeVersion: string;
  platform: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  database: {
    users: number;
    modules: number;
    jobs: number;
    executions: number;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    workers: number;
  } | null;
  recentExecutions: Record<string, number>;
}

export interface ModuleStats {
  id: string;
  name: string;
  displayName: string;
  status: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    jobs: number;
  };
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  outcome: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

export interface CleanupResult {
  message: string;
  results: {
    deletedExecutions: number;
    deletedSessions: number;
    deletedAuditLogs: number;
    orphanedJobs: number;
  };
}

export const settingsApi = {
  async getSystemInfo(): Promise<ApiResponse<SystemInfo>> {
    return apiClient.get<SystemInfo>('/settings/system');
  },

  async getModuleStats(): Promise<ApiResponse<ModuleStats[]>> {
    return apiClient.get<ModuleStats[]>('/settings/modules');
  },

  async clearCache(type?: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>('/settings/cache/clear', { type });
  },

  async runCleanup(): Promise<ApiResponse<CleanupResult>> {
    return apiClient.post<CleanupResult>('/settings/maintenance/cleanup', {});
  },

  async getAuditLogs(page = 1, limit = 50): Promise<ApiResponse<{
    data: AuditLog[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>> {
    return apiClient.get(`/settings/audit-logs?page=${page}&limit=${limit}`);
  },
};
