/**
 * Modules management page
 * Lists and manages installed modules
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { modulesApi } from '../api/modules';
import { Module, ModuleStatus } from '../types/module.types';
import { getErrorMessage } from '../utils/error.utils';
import { showError, showSuccess, showInfo } from '../utils/toast.utils';
import { SkeletonLoader } from '../components/LoadingSpinner';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import ErrorBoundary from '../components/ErrorBoundary';

function ModulesPageContent() {
  const queryClient = useQueryClient();
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const { confirm, confirmState, handleConfirm, handleClose } = useConfirm();

  const handleInstallModule = () => {
    showInfo('Module installation UI coming soon! For now, modules can be registered via API.');
  };

  // Fetch modules
  const { data: modulesData, isLoading, error, refetch } = useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      console.log('[ModulesPage] Fetching modules from API...');
      const modules = await modulesApi.list();
      console.log('[ModulesPage] Fetched modules:', modules);
      return modules;
    },
    refetchOnWindowFocus: true, // Refetch when window regains focus
    staleTime: 0, // Always refetch to avoid cache issues
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  const modules: Module[] = Array.isArray(modulesData) ? modulesData : [];

  // Memoize module counts to avoid recalculating on every render
  const moduleCounts = useMemo(() => ({
    total: modules.length,
    enabled: modules.filter(m => m.status === ModuleStatus.ENABLED).length,
    disabled: modules.filter(m => m.status === ModuleStatus.DISABLED).length,
    registered: modules.filter(m => m.status === ModuleStatus.REGISTERED).length,
  }), [modules]);

  // Enable module mutation - simplified without optimistic updates
  const enableMutation = useMutation({
    mutationFn: (name: string) => modulesApi.enable(name),
    onSuccess: async (data, name) => {
      // Refetch modules after successful enable
      await queryClient.invalidateQueries({ queryKey: ['modules'] });
      showSuccess(`Module "${name}" enabled successfully`);
      window.dispatchEvent(new CustomEvent('modules-changed'));
    },
    onError: (error: any, name) => {
      console.error('Failed to enable module:', error);
      showError(`Failed to enable module "${name}": ${getErrorMessage(error)}`);
    },
  });

  // Disable module mutation - simplified without optimistic updates
  const disableMutation = useMutation({
    mutationFn: (name: string) => modulesApi.disable(name),
    onSuccess: async (data, name) => {
      // Refetch modules after successful disable
      await queryClient.invalidateQueries({ queryKey: ['modules'] });
      showSuccess(`Module "${name}" disabled successfully`);
      window.dispatchEvent(new CustomEvent('modules-changed'));
    },
    onError: (error: any, name) => {
      console.error('Failed to disable module:', error);
      showError(`Failed to disable module "${name}": ${getErrorMessage(error)}`);
    },
  });

  // Move status styles outside component to avoid recreation
  const STATUS_STYLES = useMemo(() => ({
    [ModuleStatus.ENABLED]: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
    [ModuleStatus.DISABLED]: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    [ModuleStatus.INSTALLED]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
    [ModuleStatus.REGISTERED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
    [ModuleStatus.INSTALLING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    [ModuleStatus.ENABLING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    [ModuleStatus.DISABLING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    [ModuleStatus.UPDATING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
    [ModuleStatus.REMOVING]: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
    [ModuleStatus.ERROR]: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  }), []);

  const getStatusBadge = useCallback((status: ModuleStatus) => {
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_STYLES[status]}`}>
        {status}
      </span>
    );
  }, [STATUS_STYLES]);

  const handleToggleModule = (module: Module) => {
    if (module.status === ModuleStatus.ENABLED) {
      // Disabling - use warning variant
      confirm(
        () => disableMutation.mutateAsync(module.name),
        {
          title: 'Disable Module',
          message: `Are you sure you want to disable "${module.displayName}"? This will remove its routes and features from the sidebar.`,
          confirmText: 'Disable',
          variant: 'warning',
        }
      );
    } else if (module.status === ModuleStatus.DISABLED || module.status === ModuleStatus.INSTALLED || module.status === ModuleStatus.REGISTERED) {
      // Enabling - use info variant (less risky)
      // REGISTERED modules will be auto-installed by the backend
      confirm(
        () => enableMutation.mutateAsync(module.name),
        {
          title: 'Enable Module',
          message: `Enable "${module.displayName}"? Its routes and features will be added to the sidebar.`,
          confirmText: 'Enable',
          variant: 'info',
        }
      );
    } else {
      showError(`Cannot toggle module with status: ${module.status}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <SkeletonLoader lines={3} />
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
            <SkeletonLoader lines={5} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-lg">
            <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error loading modules</h3>
            <p className="text-red-600 dark:text-red-400 text-sm">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
    
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
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{moduleCounts.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Enabled</div>
          <div className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">
            {moduleCounts.enabled}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Disabled</div>
          <div className="mt-1 text-2xl font-semibold text-gray-600 dark:text-gray-400">
            {moduleCounts.disabled}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Registered</div>
          <div className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">
            {moduleCounts.registered}
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
                    {(module.status === ModuleStatus.ENABLED || module.status === ModuleStatus.DISABLED || module.status === ModuleStatus.INSTALLED || module.status === ModuleStatus.REGISTERED) && (
                      <button
                        onClick={() => handleToggleModule(module)}
                        disabled={enableMutation.isPending || disableMutation.isPending}
                        className={`px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          module.status === ModuleStatus.ENABLED
                            ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 focus:ring-red-500'
                            : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 focus:ring-green-500'
                        }`}
                      >
                        {(enableMutation.isPending || disableMutation.isPending) ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {module.status === ModuleStatus.ENABLED ? 'Disabling...' : 'Enabling...'}
                          </span>
                        ) : (
                          module.status === ModuleStatus.ENABLED ? 'Disable' : 'Enable'
                        )}
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

                {selectedModule.manifest?.routes && selectedModule.manifest.routes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Routes</h3>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {selectedModule.manifest.routes.map((route, idx) => (
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

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        variant={confirmState.variant}
        isLoading={confirmState.isLoading}
      />
    </div>
  );
}

// Wrap with ErrorBoundary to prevent module rendering errors from crashing the app
export default function ModulesPage() {
  return (
    <ErrorBoundary
      fallback={
        <div className="p-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              Failed to load modules page
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300 mb-4">
              There was an error loading the modules. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      }
    >
      <ModulesPageContent />
    </ErrorBoundary>
  );
}
