/**
 * Jobs Page - List and manage automation jobs
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

interface Job {
  id: string;
  name: string;
  description?: string;
  moduleId: string;
  handler: string;
  schedule?: string;
  enabled: boolean;
  timeout: number;
  retries: number;
  config?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface Module {
  id: string;
  name: string;
}

export default function JobsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  // Fetch jobs
  const { data: jobsData, isLoading, error } = useQuery({
    queryKey: ['jobs', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter === 'enabled') params.append('enabled', 'true');
      if (filter === 'disabled') params.append('enabled', 'false');

      const response = await axios.get(`${API_URL}/jobs?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      return response.data;
    },
  });

  // Fetch modules for display
  const { data: modulesData } = useQuery({
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

  // Execute job mutation
  const executeJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await axios.post(`${API_URL}/jobs/${jobId}/execute`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Job queued for execution');
    },
    onError: (error: any) => {
      toast.error(`Failed to execute job: ${error.response?.data?.error || error.message}`);
    },
  });

  // Toggle job enabled/disabled
  const toggleJobMutation = useMutation({
    mutationFn: async ({ jobId, enabled }: { jobId: string; enabled: boolean }) => {
      const endpoint = enabled ? 'disable' : 'enable';
      const response = await axios.put(`${API_URL}/jobs/${jobId}/${endpoint}`, {}, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(`Job ${variables.enabled ? 'disabled' : 'enabled'} successfully`);
    },
    onError: (error: any) => {
      toast.error(`Failed to toggle job: ${error.response?.data?.error || error.message}`);
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await axios.delete(`${API_URL}/jobs/${jobId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete job: ${error.response?.data?.error || error.message}`);
    },
  });

  const jobs: Job[] = jobsData?.data || [];
  const modules: Module[] = modulesData?.data || [];

  const getModuleName = (moduleId: string) => {
    return modules.find(m => m.id === moduleId)?.name || moduleId;
  };

  const handleExecute = (jobId: string) => {
    if (confirm('Execute this job now?')) {
      executeJobMutation.mutate(jobId);
    }
  };

  const handleToggle = (job: Job) => {
    toggleJobMutation.mutate({ jobId: job.id, enabled: job.enabled });
  };

  const handleDelete = (jobId: string, jobName: string) => {
    if (confirm(`Delete job "${jobName}"? This action cannot be undone.`)) {
      deleteJobMutation.mutate(jobId);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Jobs</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage automation jobs and schedules
            </p>
          </div>
          <Link
            to="/jobs/new"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
          >
            Create Job
          </Link>
        </div>

        {/* Filters */}
        <div className="flex space-x-2">
          {(['all', 'enabled', 'disabled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading jobs...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
            <p className="text-sm text-red-800 dark:text-red-200">
              Failed to load jobs: {(error as any).message}
            </p>
          </div>
        )}

        {/* Jobs List */}
        {!isLoading && !error && jobs.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">No jobs found</p>
            <Link
              to="/jobs/new"
              className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline"
            >
              Create your first job
            </Link>
          </div>
        )}

        {!isLoading && !error && jobs.length > 0 && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Module
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {job.name}
                      </div>
                      {job.description && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {job.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {getModuleName(job.moduleId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {job.schedule || 'Manual'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          job.enabled
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                      >
                        {job.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleExecute(job.id)}
                        disabled={!job.enabled}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Run
                      </button>
                      <button
                        onClick={() => handleToggle(job)}
                        className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                      >
                        {job.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <Link
                        to={`/jobs/${job.id}/executions`}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        History
                      </Link>
                      <button
                        onClick={() => handleDelete(job.id, job.name)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
