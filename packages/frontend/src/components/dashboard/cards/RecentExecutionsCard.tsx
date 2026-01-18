/**
 * RecentExecutionsCard - Displays recent execution activity
 */

import { CheckCircle, XCircle, Clock, Loader } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RecentExecution } from '../../../api/dashboard';

interface RecentExecutionsCardProps {
  executions: RecentExecution[];
  isLoading?: boolean;
}

export function RecentExecutionsCard({ executions, isLoading }: RecentExecutionsCardProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-200 dark:bg-gray-700 rounded" />
        ))}
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">No recent executions</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Recent Activity</h4>
        <Link
          to="/executions"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="space-y-2">
        {executions.slice(0, 5).map((execution) => (
          <div
            key={execution.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            {getStatusIcon(execution.status)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {execution.jobName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {execution.moduleName}
              </p>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
              {formatTime(execution.startedAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentExecutionsCard;
