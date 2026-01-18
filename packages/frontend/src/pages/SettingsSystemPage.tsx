/**
 * Settings System Page - System information and maintenance (admin only)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, SystemInfo, ModuleStats, AuditLog } from '../api/settings';
import { showError, showSuccess } from '../utils/toast.utils';
import { getErrorMessage } from '../utils/error.utils';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonLoader } from '../components/LoadingSpinner';

export default function SettingsSystemPage() {
  const queryClient = useQueryClient();
  const { confirm, confirmState, handleConfirm, handleClose } = useConfirm();
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'audit'>('overview');
  const [auditPage, setAuditPage] = useState(1);

  // Fetch system info
  const { data: systemData, isLoading: systemLoading, error: systemError } = useQuery({
    queryKey: ['system-info'],
    queryFn: async () => {
      const response = await settingsApi.getSystemInfo();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load system info');
      }
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch module stats
  const { data: modulesData, isLoading: modulesLoading } = useQuery({
    queryKey: ['module-stats'],
    queryFn: async () => {
      const response = await settingsApi.getModuleStats();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load module stats');
      }
      return response.data;
    },
    enabled: activeTab === 'modules',
  });

  // Fetch audit logs
  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['audit-logs', auditPage],
    queryFn: async () => {
      const response = await settingsApi.getAuditLogs(auditPage, 20);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load audit logs');
      }
      return response.data;
    },
    enabled: activeTab === 'audit',
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
      const response = await settingsApi.clearCache();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to clear cache');
      }
      return response.data;
    },
    onSuccess: () => {
      showSuccess('Cache cleared successfully');
    },
    onError: (error: Error) => {
      showError(getErrorMessage(error));
    },
  });

  // Cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await settingsApi.runCleanup();
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to run cleanup');
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['system-info'] });
      const results = data?.results;
      showSuccess(
        `Cleanup completed: ${results?.deletedExecutions || 0} executions, ${results?.deletedSessions || 0} sessions, ${results?.deletedAuditLogs || 0} audit logs removed`
      );
    },
    onError: (error: Error) => {
      showError(getErrorMessage(error));
    },
  });

  const handleClearCache = () => {
    confirm(
      () => clearCacheMutation.mutateAsync(),
      {
        title: 'Clear Cache',
        message: 'Are you sure you want to clear all caches? This may temporarily affect performance.',
        confirmText: 'Clear',
        variant: 'warning',
      }
    );
  };

  const handleRunCleanup = () => {
    confirm(
      () => cleanupMutation.mutateAsync(),
      {
        title: 'Run Maintenance Cleanup',
        message: 'This will delete old job executions (>30 days), expired sessions, and old audit logs (>90 days). Continue?',
        confirmText: 'Run Cleanup',
        variant: 'warning',
      }
    );
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.join(' ') || '< 1m';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const system = systemData as SystemInfo | undefined;
  const modules = modulesData as ModuleStats[] | undefined;

  if (systemError) {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              Failed to load system info: {(systemError as Error).message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Settings</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Monitor system health and perform maintenance tasks
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClearCache}
              disabled={clearCacheMutation.isPending}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {clearCacheMutation.isPending ? 'Clearing...' : 'Clear Cache'}
            </button>
            <button
              onClick={handleRunCleanup}
              disabled={cleanupMutation.isPending}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white rounded-md"
            >
              {cleanupMutation.isPending ? 'Running...' : 'Run Cleanup'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {(['overview', 'modules', 'audit'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'audit' ? 'Audit Logs' : tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {systemLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
                <SkeletonLoader lines={8} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* System Info */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    System Information
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Environment</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {system?.environment}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Version</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {system?.version}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Node Version</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {system?.nodeVersion}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Platform</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                        {system?.platform}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Uptime</dt>
                      <dd className="text-sm font-medium text-green-600 dark:text-green-400">
                        {system?.uptime ? formatUptime(system.uptime) : 'N/A'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Memory Usage */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Memory Usage
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Heap Used</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {system?.memory?.heapUsed} MB
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Heap Total</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {system?.memory?.heapTotal} MB
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">RSS</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {system?.memory?.rss} MB
                      </dd>
                    </div>
                    {system?.memory && (
                      <div className="mt-4">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Heap Usage ({Math.round((system.memory.heapUsed / system.memory.heapTotal) * 100)}%)
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(system.memory.heapUsed / system.memory.heapTotal) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Database Stats */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Database Statistics
                  </h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Users</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {system?.database?.users}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Modules</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {system?.database?.modules}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Jobs</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {system?.database?.jobs}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm text-gray-500 dark:text-gray-400">Executions</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white">
                        {system?.database?.executions?.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Queue Status */}
                {system?.queue && (
                  <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Job Queue Status
                    </h3>
                    <dl className="space-y-3">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Workers</dt>
                        <dd className="text-sm font-medium text-gray-900 dark:text-white">
                          {system.queue.workers}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Waiting</dt>
                        <dd className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                          {system.queue.waiting}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Active</dt>
                        <dd className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          {system.queue.active}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Completed</dt>
                        <dd className="text-sm font-medium text-green-600 dark:text-green-400">
                          {system.queue.completed}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400">Failed</dt>
                        <dd className="text-sm font-medium text-red-600 dark:text-red-400">
                          {system.queue.failed}
                        </dd>
                      </div>
                    </dl>
                  </div>
                )}

                {/* Recent Executions (Last 24h) */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Executions (24h)
                  </h3>
                  <dl className="space-y-3">
                    {Object.entries(system?.recentExecutions || {}).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <dt className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {status}
                        </dt>
                        <dd className={`text-sm font-medium ${
                          status === 'completed' ? 'text-green-600 dark:text-green-400' :
                          status === 'failed' ? 'text-red-600 dark:text-red-400' :
                          status === 'running' ? 'text-blue-600 dark:text-blue-400' :
                          'text-gray-900 dark:text-white'
                        }`}>
                          {count}
                        </dd>
                      </div>
                    ))}
                    {Object.keys(system?.recentExecutions || {}).length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No executions in the last 24 hours</p>
                    )}
                  </dl>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modules Tab */}
        {activeTab === 'modules' && (
          <>
            {modulesLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
                <SkeletonLoader lines={6} />
              </div>
            ) : !modules || modules.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">No modules installed</p>
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
                        Jobs
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {modules.map((module) => (
                      <tr key={module.id}>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {module.displayName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {module.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {module.version}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            module.status === 'ENABLED'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {module.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {module._count.jobs}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(module.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit' && (
          <>
            {auditLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
                <SkeletonLoader lines={10} />
              </div>
            ) : !auditData?.data || auditData.data.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">No audit logs found</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Resource
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Outcome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        IP Address
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {auditData.data.map((log: AuditLog) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {log.user?.username || 'System'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {log.action}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {log.resource}
                          {log.resourceId && <span className="text-xs ml-1">({log.resourceId.slice(0, 8)}...)</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            log.outcome === 'success'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {log.outcome}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {log.ipAddress || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination */}
                {auditData.meta && auditData.meta.totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <button
                      onClick={() => setAuditPage(Math.max(1, auditPage - 1))}
                      disabled={auditPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Page {auditPage} of {auditData.meta.totalPages}
                    </span>
                    <button
                      onClick={() => setAuditPage(Math.min(auditData.meta.totalPages, auditPage + 1))}
                      disabled={auditPage === auditData.meta.totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
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
