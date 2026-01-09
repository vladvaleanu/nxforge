/**
 * Create Job Page - Form to create new automation jobs
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

interface Module {
  id: string;
  name: string;
  description?: string;
  manifest: {
    jobs?: Array<{
      name: string;
      handler: string;
      description?: string;
      schedule?: string;
      timeout?: number;
      retries?: number;
    }>;
  };
}

const cronPresets = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at noon', value: '0 12 * * *' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' },
  { label: 'Manual (no schedule)', value: '' },
];

export default function CreateJobPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    moduleId: '',
    handler: '',
    schedule: '',
    enabled: true,
    timeout: 300000,
    retries: 3,
    config: '{}',
  });
  const [showCronBuilder, setShowCronBuilder] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedModuleHandlers, setSelectedModuleHandlers] = useState<any[]>([]);

  // Fetch modules
  const { data: modulesData, isLoading: modulesLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      const response = await axios.get(`${API_URL}/modules`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      return response.data;
    },
  });

  const modules: Module[] = (modulesData?.data || []).filter((m: Module) => m.status === 'ENABLED');

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await axios.post(`${API_URL}/jobs`, data, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      alert('Job created successfully');
      navigate('/jobs');
    },
    onError: (error: any) => {
      alert(`Failed to create job: ${error.response?.data?.error || error.message}`);
    },
  });

  const handleModuleChange = (moduleId: string) => {
    setFormData({ ...formData, moduleId, handler: '' });
    const module = modules.find(m => m.id === moduleId);
    console.log('Selected module:', module);
    console.log('Module manifest:', module?.manifest);
    console.log('Module jobs:', module?.manifest?.jobs);
    setSelectedModuleHandlers(module?.manifest?.jobs || []);
  };

  const handleHandlerChange = (handler: string) => {
    setFormData({ ...formData, handler });

    // Auto-fill from manifest if available
    const jobDef = selectedModuleHandlers.find(j => j.handler === handler);
    if (jobDef) {
      setFormData(prev => ({
        ...prev,
        handler,
        name: prev.name || jobDef.name,
        description: prev.description || jobDef.description || '',
        schedule: prev.schedule || jobDef.schedule || '',
        timeout: prev.timeout || jobDef.timeout || 300000,
        retries: prev.retries !== undefined ? prev.retries : (jobDef.retries !== undefined ? jobDef.retries : 3),
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate config JSON
    try {
      JSON.parse(formData.config);
    } catch (err) {
      alert('Invalid JSON in config field');
      return;
    }

    const payload = {
      ...formData,
      config: formData.config ? JSON.parse(formData.config) : {},
      schedule: formData.schedule || undefined,
    };

    createJobMutation.mutate(payload);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Job</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create a new automation job
          </p>
        </div>

        {/* No Modules Warning */}
        {!modulesLoading && modules.length === 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
              No Modules Available
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-4">
              You need to register and enable at least one module before creating jobs.
            </p>
            <div className="space-y-2 text-sm text-yellow-700 dark:text-yellow-400">
              <p><strong>To get started:</strong></p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to the <a href="/modules" className="underline font-medium">Modules page</a></li>
                <li>Register a new module with a manifest that includes job definitions</li>
                <li>Enable the module</li>
                <li>Return here to create jobs</li>
              </ol>
            </div>
          </div>
        )}

        {/* Form */}
        {modules.length > 0 && (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 space-y-6">
            {/* Module Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Module <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.moduleId}
                onChange={(e) => handleModuleChange(e.target.value)}
                required
                disabled={modulesLoading}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select a module...</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
            </div>

          {/* Job Type Selection */}
          {formData.moduleId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Job Type <span className="text-red-500">*</span>
              </label>
              {selectedModuleHandlers.length > 0 ? (
                <>
                  <select
                    value={formData.handler}
                    onChange={(e) => handleHandlerChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a job type...</option>
                    {selectedModuleHandlers.map((job, idx) => (
                      <option key={idx} value={job.handler}>
                        {job.name}
                      </option>
                    ))}
                  </select>
                  {formData.handler && (
                    <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {selectedModuleHandlers.find(j => j.handler === formData.handler)?.description || 'No description available'}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={formData.handler}
                    onChange={(e) => setFormData({ ...formData, handler: e.target.value })}
                    placeholder="e.g., jobs/monitor.js"
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    This module doesn't have predefined jobs. Enter the path to your job handler file.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Job Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Job Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Automation Job"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this job do?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Schedule (Cron Expression)
            </label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  placeholder="* * * * * (or leave empty for manual only)"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCronBuilder(!showCronBuilder)}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
                >
                  {showCronBuilder ? 'Hide' : 'Presets'}
                </button>
              </div>
              {showCronBuilder && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                  {cronPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormData({ ...formData, schedule: preset.value })}
                      className="px-3 py-2 text-sm bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 text-left"
                    >
                      <div className="font-medium">{preset.label}</div>
                      {preset.value && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {preset.value}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Leave empty for manual execution only. Format: minute hour day month weekday
            </p>
          </div>

          {/* Advanced Settings Toggle */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <span>{showAdvanced ? '▼' : '▶'}</span>
              <span className="ml-2">Advanced Settings</span>
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(optional)</span>
            </button>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-6 pl-4 border-l-2 border-blue-500">
              {/* Timeout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timeout
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={formData.timeout / 1000}
                    onChange={(e) => setFormData({ ...formData, timeout: parseInt(e.target.value) * 1000 })}
                    min="1"
                    step="1"
                    className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">seconds</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Maximum time the job can run (default: 300 seconds / 5 minutes)
                </p>
              </div>

              {/* Retries */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Retry Attempts
                </label>
                <input
                  type="number"
                  value={formData.retries}
                  onChange={(e) => setFormData({ ...formData, retries: parseInt(e.target.value) })}
                  min="0"
                  max="10"
                  className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  How many times to retry if the job fails (0-10, default: 3)
                </p>
              </div>

              {/* Config */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Configuration (JSON)
                </label>
                <textarea
                  value={formData.config}
                  onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                  placeholder='{"apiKey": "xxx", "endpoint": "https://..."}&#10;&#10;Optional: Add job-specific settings here'
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Job-specific configuration in JSON format (optional)
                </p>
              </div>
            </div>
          )}

          {/* Enabled */}
          <div className="flex items-center pt-4">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Enable and start scheduling immediately after creation
            </label>
          </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => navigate('/jobs')}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createJobMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
