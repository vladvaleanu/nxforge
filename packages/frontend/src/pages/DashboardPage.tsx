/**
 * Dashboard page
 */

import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Automation Platform
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>

              {/* User menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.username}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {user?.roles.join(', ')}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to the Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This is your automation platform control panel. Modules will appear here once Phase 2 is complete.
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

            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Phase 2
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                🔄 Module System (Next)
              </p>
              <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li>○ Module registry</li>
                <li>○ Lifecycle management</li>
                <li>○ Dynamic routing</li>
                <li>○ Frontend module loading</li>
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
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Modules</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Install and manage automation modules
                </p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Jobs</h4>
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
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Users</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage users and permissions
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
