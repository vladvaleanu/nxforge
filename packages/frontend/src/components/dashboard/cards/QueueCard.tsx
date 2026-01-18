/**
 * QueueCard - Displays queue statistics
 */

import { Activity, AlertCircle } from 'lucide-react';

interface QueueCardProps {
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    workers: number;
  } | null;
  isLoading?: boolean;
}

export function QueueCard({ queue, isLoading }: QueueCardProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <AlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-500 mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Queue not available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{queue.active}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Active Jobs</p>
        </div>
        <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full">
          <Activity className="w-6 h-6 text-orange-600 dark:text-orange-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Waiting</span>
          <span className="font-medium text-gray-900 dark:text-white">{queue.waiting}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Delayed</span>
          <span className="font-medium text-gray-900 dark:text-white">{queue.delayed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Failed</span>
          <span className="font-medium text-red-600 dark:text-red-400">{queue.failed}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Workers</span>
          <span className="font-medium text-gray-900 dark:text-white">{queue.workers}</span>
        </div>
      </div>
    </div>
  );
}

export default QueueCard;
