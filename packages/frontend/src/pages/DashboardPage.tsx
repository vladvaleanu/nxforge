/**
 * Dashboard page
 */

import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to the Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your automation platform control panel
          </p>

          {/* Status cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Phase 1
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                ✅ Foundation Complete
              </p>
              <ul className="mt-2 text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <li>✓ Project scaffolding</li>
                <li>✓ Core API</li>
                <li>✓ Database</li>
                <li>✓ Frontend shell</li>
              </ul>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                Phase 2
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                ✅ Module System Complete
              </p>
              <ul className="mt-2 text-xs text-green-600 dark:text-green-400 space-y-1">
                <li>✓ Module registry</li>
                <li>✓ Lifecycle management</li>
                <li>✓ Dynamic routing</li>
                <li>✓ Frontend module loading</li>
              </ul>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                User Info
              </h3>
              <dl className="text-xs space-y-1">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Email:</dt>
                  <dd className="text-gray-900 dark:text-gray-100 font-medium">{user?.email}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">User ID:</dt>
                  <dd className="text-gray-900 dark:text-gray-100 font-mono text-xs">{user?.userId}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Permissions:</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{user?.permissions.length} granted</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Coming soon */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Coming Soon
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Jobs & Scheduling</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Schedule and monitor automation tasks
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Monitoring</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Real-time metrics and dashboards
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Event System</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Pub/sub event bus for module communication
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Users & Roles</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage users and permissions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
