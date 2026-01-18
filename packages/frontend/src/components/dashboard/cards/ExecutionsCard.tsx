/**
 * ExecutionsCard - Displays execution statistics
 */

import { Play, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ExecutionsCardProps {
  total: number;
  last24h: number;
  successRate: number;
  isLoading?: boolean;
}

export function ExecutionsCard({ total, last24h, successRate, isLoading }: ExecutionsCardProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
      </div>
    );
  }

  const successColor = successRate >= 90 ? 'text-green-500' : successRate >= 70 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{total}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Executions</p>
        </div>
        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
          <Play className="w-6 h-6 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Last 24h</span>
          <span className="font-medium text-gray-900 dark:text-white">{last24h}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Success Rate</span>
          <div className="flex items-center gap-1">
            <TrendingUp className={`w-4 h-4 ${successColor}`} />
            <span className={`font-medium ${successColor}`}>{successRate}%</span>
          </div>
        </div>
      </div>

      <Link
        to="/executions"
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        View all executions
      </Link>
    </div>
  );
}

export default ExecutionsCard;
