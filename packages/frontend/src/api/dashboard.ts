/**
 * Dashboard API endpoints
 */

import apiClient, { ApiResponse } from './client';

export interface DashboardStats {
  modules: {
    total: number;
    active: number;
    inactive: number;
  };
  jobs: {
    total: number;
    enabled: number;
    disabled: number;
  };
  executions: {
    total: number;
    last24h: number;
    successRate: number;
    byStatus: Record<string, number>;
  };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    workers: number;
  } | null;
  recentExecutions: RecentExecution[];
  executionTrend: { date: string; count: number }[];
}

export interface RecentExecution {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  jobName: string;
  jobId: string;
  moduleName: string;
}

export interface DashboardLayout {
  layout: DashboardCardConfig[];
  locked: boolean;
}

export interface DashboardCardConfig {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

export const dashboardApi = {
  async getStats(): Promise<ApiResponse<DashboardStats>> {
    return apiClient.get<DashboardStats>('/dashboard/stats');
  },

  async getLayout(): Promise<ApiResponse<DashboardLayout | null>> {
    return apiClient.get<DashboardLayout | null>('/dashboard/layout');
  },

  async saveLayout(layout: DashboardCardConfig[], locked: boolean): Promise<ApiResponse<{ message: string }>> {
    return apiClient.put<{ message: string }>('/dashboard/layout', { layout, locked });
  },
};
