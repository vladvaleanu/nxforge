/**
 * Module API client
 */

import { apiClient } from './client';
import { Module, ModuleManifest, ModuleStatus } from '../types/module.types';

export interface ListModulesParams {
  status?: ModuleStatus;
  search?: string;
}

export interface ModuleResponse {
  success: boolean;
  data: Module;
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export interface ModulesResponse {
  success: boolean;
  data: Module[];
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export const modulesApi = {
  /**
   * List all modules
   */
  list: async (params?: ListModulesParams): Promise<Module[]> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);

    const query = searchParams.toString();
    const url = `/api/v1/modules${query ? `?${query}` : ''}`;

    const response = await apiClient.get<ModulesResponse>(url);
    return response.data;
  },

  /**
   * Get module details by name
   */
  get: async (name: string): Promise<Module> => {
    const response = await apiClient.get<ModuleResponse>(`/api/v1/modules/${name}`);
    return response.data;
  },

  /**
   * Register a new module
   */
  register: async (manifest: ModuleManifest): Promise<Module> => {
    const response = await apiClient.post<ModuleResponse>('/api/v1/modules', {
      manifest,
    });
    return response.data;
  },

  /**
   * Update module status
   */
  updateStatus: async (name: string, status: ModuleStatus): Promise<Module> => {
    const response = await apiClient.put<ModuleResponse>(
      `/api/v1/modules/${name}/status`,
      { status }
    );
    return response.data;
  },

  /**
   * Enable a module
   */
  enable: async (name: string): Promise<Module> => {
    const response = await apiClient.post<ModuleResponse>(
      `/api/v1/modules/${name}/enable`
    );
    return response.data;
  },

  /**
   * Disable a module
   */
  disable: async (name: string): Promise<Module> => {
    const response = await apiClient.post<ModuleResponse>(
      `/api/v1/modules/${name}/disable`
    );
    return response.data;
  },

  /**
   * Update module configuration
   */
  updateConfig: async (name: string, config: Record<string, any>): Promise<Module> => {
    const response = await apiClient.put<ModuleResponse>(
      `/api/v1/modules/${name}/config`,
      { config }
    );
    return response.data;
  },

  /**
   * Remove a module
   */
  remove: async (name: string): Promise<void> => {
    await apiClient.delete(`/api/v1/modules/${name}`);
  },

  /**
   * Validate a module manifest
   */
  validate: async (manifest: ModuleManifest): Promise<{ valid: boolean; errors?: string[] }> => {
    const response = await apiClient.post<{ success: boolean; data: { valid: boolean; errors?: string[] } }>(
      '/api/v1/modules/validate',
      { manifest }
    );
    return response.data;
  },
};
