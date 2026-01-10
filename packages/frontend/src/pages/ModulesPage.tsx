/**
 * Modules management page
 * Lists and manages installed modules
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modulesApi } from '../api/modules';
import { Module, ModuleStatus } from '../types/module.types';
import Layout from '../components/Layout';

export default function ModulesPage() {
  const queryClient = useQueryClient();
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);

  const handleInstallModule = () => {
    toast.success('Module installation UI coming soon! For now, modules can be registered via API.');
  };

  // Fetch modules
  const { data: modulesData, isLoading, error } = useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      try {
        const result = await modulesApi.list();
        console.log('Modules loaded:', result);
        return result;
      } catch (err) {
        console.error('Failed to load modules:', err);
        throw err;
      }
    },
  });

  const modules: Module[] = Array.isArray(modulesData) ? modulesData : [];

  // Enable module mutation
  const enableMutation = useMutation({
    mutationFn: (name: string) => modulesApi.enable(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    },
  });

  // Disable module mutation
  const disableMutation = useMutation({
    mutationFn: (name: string) => modulesApi.disable(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    },
  });

  const getStatusBadge = (status: ModuleStatus) => {
    const styles = {
      [ModuleStatus.ENABLED]: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      [ModuleStatus.DISABLED]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      [ModuleStatus.REGISTERED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      [ModuleStatus.INSTALLING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      [ModuleStatus.UPDATING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      [ModuleStatus.REMOVING]: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      [ModuleStatus.ERROR]: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {status}
      </span>
    );
  };

  const handleToggleModule = async (module: Module) => {
    if (module.status === ModuleStatus.ENABLED) {
      await disableMutation.mutateAsync(module.name);
    } else if (module.status === ModuleStatus.DISABLED) {
      await enableMutation.mutateAsync(module.name);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading modules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-lg">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error loading modules</h3>
          <p className="text-red-600 dark:text-red-400 text-sm">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Modules</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage installed automation modules
          </p>
        </div>
        <button
          onClick={handleInstallModule}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Install Module
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Modules</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{modules.length}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Enabled</div>
          <div className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">
            {modules.filter(m => m.status === ModuleStatus.ENABLED).length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Disabled</div>
          <div className="mt-1 text-2xl font-semibold text-gray-600 dark:text-gray-400">
            {modules.filter(m => m.status === ModuleStatus.DISABLED).length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Registered</div>
          <div className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {modules.filter(m => m.status === ModuleStatus.REGISTERED).length}
          </div>
        </div>
      </div>

      {/* Modules list */}
      {modules.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No modules</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by installing your first module.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Module
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Installed
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {modules.map((module) => (
                <tr key={module.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {module.displayName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {module.description}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{module.version}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(module.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {module.installedAt
                      ? new Date(module.installedAt).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    {(module.status === ModuleStatus.ENABLED || module.status === ModuleStatus.DISABLED) && (
                      <button
                        onClick={() => handleToggleModule(module)}
                        disabled={enableMutation.isPending || disableMutation.isPending}
                        className={`px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          module.status === ModuleStatus.ENABLED
                            ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 focus:ring-red-500'
                            : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 focus:ring-green-500'
                        }`}
                      >
                        {module.status === ModuleStatus.ENABLED ? 'Disable' : 'Enable'}
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedModule(module)}
                      className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Module details modal (simplified) */}
      {selectedModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedModule.displayName}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    v{selectedModule.version}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedModule(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{selectedModule.description}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</h3>
                  {getStatusBadge(selectedModule.status)}
                </div>

                {selectedModule.manifest?.capabilities?.api?.routes && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Routes</h3>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {selectedModule.manifest.capabilities.api.routes.map((route, idx) => (
                        <li key={idx} className="font-mono">
                          {route.method} {route.path}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </Layout>
  );
}
