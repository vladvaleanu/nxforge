/**
 * JobsCard - Displays job statistics
 */

import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface JobsCardProps {
  total: number;
  enabled: number;
  disabled: number;
  isLoading?: boolean;
}

export function JobsCard({ total, enabled, disabled, isLoading }: JobsCardProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Jobs</p>
        </div>
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
          <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-gray-600 dark:text-gray-400">{enabled} enabled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="w-4 h-4 text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">{disabled} disabled</span>
        </div>
      </div>

      <Link
        to="/jobs"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        View all jobs
      </Link>
    </div>
  );
}

export default JobsCard;
