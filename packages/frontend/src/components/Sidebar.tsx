/**
 * Sidebar Navigation Component
 * Hierarchical menu structure with user section at bottom
 * Dynamically builds menu from enabled module manifests via backend API
 */

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Settings,
  Package,
  Clock,
  Play,
  Radio,
  User,
  Users,
  Wrench,
  ChevronRight,
  LogOut,
  Moon,
  Sun,
  Activity,
  Briefcase,
  PenTool,
  Box,
  Bell,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { navigationApi } from '../api/navigation';

interface MenuItem {
  label: string;
  path?: string;
  icon: any;
  children?: MenuItem[];
  badge?: string;
  isModule?: boolean;
  exact?: boolean;
}

// Icon mapper for dynamic categories
const CATEGORY_ICONS: Record<string, any> = {
  monitoring: Activity,
  power: Activity,  // Power monitoring (consumption module)
  forge: Sparkles,  // Forge AI Copilot
  operations: Briefcase,
  tools: PenTool,
  settings: Settings,
};

// Core platform menu items
const CORE_MENU: MenuItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Incidents',
    path: '/incidents',
    icon: Bell,
  },
  {
    label: 'Automation',
    icon: Settings,
    children: [
      { label: 'Modules', path: '/modules', icon: Package, exact: true },
      { label: 'Jobs', path: '/jobs', icon: Clock },
      { label: 'Executions', path: '/executions', icon: Play },
      { label: 'Events', path: '/events', icon: Radio },
      { label: 'Alert Rules', path: '/incidents/rules', icon: Bell },
    ],
  },
];

const SETTINGS_MENU: MenuItem[] = [
  {
    label: 'Settings',
    icon: Settings,
    children: [
      { label: 'Profile', path: '/settings/profile', icon: User },
      { label: 'Users', path: '/settings/users', icon: Users },
      { label: 'System', path: '/settings/system', icon: Wrench },
    ],
  },
];

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // State for expanded menus
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Automation', 'Monitoring', 'Operations', 'Forge']);

  // Fetch navigation structure
  const { data: navStructure } = useQuery({
    queryKey: ['navigation-structure'],
    queryFn: async () => {
      const response = await navigationApi.getStructure();
      return response.success ? response.data : null;
    },
    // Refresh infrequently as navigation changes rarely
    staleTime: 60000,
  });

  // Build the complete menu
  const menuItems: MenuItem[] = [...CORE_MENU];

  if (navStructure) {
    // Process categories
    Object.entries(navStructure.categories).forEach(([category, items]) => {
      if (items.length === 0) return;

      // Map backend items to MenuItem
      const children: MenuItem[] = items.map(item => ({
        label: item.label,
        path: item.path,
        icon: Box, // Default icon, assuming icon string handling needs a mapper if complex
        isModule: true,
      }));

      // Find icon
      const Icon = CATEGORY_ICONS[category] || Box;
      const Label = category.charAt(0).toUpperCase() + category.slice(1);

      menuItems.push({
        label: Label,
        icon: Icon,
        children,
        isModule: true // Mark category as module-related
      });
    });

    // Handle uncategorized if any (append to Automation or create new section)
    if (navStructure.uncategorized.length > 0) {
      menuItems.push({
        label: 'Modules',
        icon: Package,
        children: navStructure.uncategorized.map(item => ({
          label: item.label,
          path: item.path,
          icon: Box,
          isModule: true
        })),
        isModule: true
      });
    }
  }

  // Append settings at the end
  menuItems.push(...SETTINGS_MENU);

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const isActive = (path?: string, exact?: boolean) => {
    if (!path) return false;
    if (exact) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-800">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6">
        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">NXFORGE</h1>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto px-4 py-6">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.label}>
              {item.children ? (
                // Parent menu item with children
                <div>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${item.isModule
                      ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                    <span className="flex items-center gap-3">
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </span>
                    <ChevronRight
                      size={16}
                      className={`transform transition-transform ${expandedMenus.includes(item.label) ? 'rotate-90' : ''
                        }`}
                    />
                  </button>

                  {/* Submenu */}
                  {expandedMenus.includes(item.label) && (
                    <ul className={`ml-4 mt-2 space-y-1 border-l-2 pl-4 ${item.isModule ? 'border-indigo-200 dark:border-indigo-800' : 'border-gray-200 dark:border-gray-800'
                      }`}>
                      {item.children.map((child) => (
                        <li key={child.path || child.label}>
                          <Link
                            to={child.path || '#'}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${isActive(child.path, child.exact)
                              ? 'bg-blue-600 text-white font-medium'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                              }`}
                          >
                            <child.icon size={16} />
                            <span className="flex-1">{child.label}</span>
                            {child.badge && (
                              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                                {child.badge}
                              </span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                // Single menu item without children
                <Link
                  to={item.path!}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive(item.path, item.exact)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* User Section */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
              {user?.username || 'User'}
            </p>
            <p className="truncate text-xs text-gray-600 dark:text-gray-400">{user?.email || ''}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
