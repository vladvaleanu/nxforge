/**
 * Sidebar Navigation Component
 * Hierarchical menu structure with user section at bottom
 * Dynamically builds menu from enabled module manifests
 */

import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Box,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { moduleLoaderService } from '../services/module-loader.service';

interface MenuItem {
  label: string;
  path?: string;
  icon: any;
  children?: MenuItem[];
  badge?: string;
}

// Core platform menu items (always shown)
const coreMenuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Automation',
    icon: Settings,
    children: [
      { label: 'Modules', path: '/modules', icon: Package },
      { label: 'Jobs', path: '/jobs', icon: Clock },
      { label: 'Executions', path: '/executions', icon: Play },
      { label: 'Events', path: '/events', icon: Radio },
    ],
  },
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

/**
 * Build complete menu from core items + module items
 */
function buildMenu(): MenuItem[] {
  const menu = [...coreMenuItems];

  // Get module sidebar configs
  const moduleSidebarConfigs = moduleLoaderService.getSidebarConfig();

  // Add each module's sidebar items
  for (const config of moduleSidebarConfigs) {
    menu.push({
      label: config.label,
      icon: Box, // Default icon for modules (can be enhanced to parse icon strings)
      children: config.children.map((child) => ({
        label: child.label,
        path: child.path,
        icon: Box, // Default icon for module children
        badge: child.badge,
      })),
    });
  }

  return menu;
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuItems, setMenuItems] = useState<MenuItem[]>(buildMenu());
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Automation']);

  // Initialize module loader on mount
  useEffect(() => {
    moduleLoaderService.initialize()
      .then(() => {
        // Rebuild menu after modules are loaded
        setMenuItems(buildMenu());
      })
      .catch((err) => {
        console.error('[Sidebar] Failed to initialize module loader:', err);
      });
  }, []);

  // Rebuild menu when modules are loaded/changed
  useEffect(() => {
    const updateMenu = () => {
      setMenuItems(buildMenu());
    };

    // Initial build
    updateMenu();

    // Listen for module changes event (event-driven updates only)
    const handleModulesChanged = () => {
      moduleLoaderService.reload().then(() => {
        updateMenu();
      });
    };

    window.addEventListener('modules-changed', handleModulesChanged);

    // Removed polling - rely on event-driven updates only
    // This eliminates 720 unnecessary requests per day (30 seconds × 24 hours)

    return () => {
      window.removeEventListener('modules-changed', handleModulesChanged);
    };
  }, []);

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((item) => item !== label) : [...prev, label]
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
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
        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">NxForge</h1>

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
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                  >
                    <span className="flex items-center gap-3">
                      <item.icon size={18} />
                      <span>{item.label}</span>
                    </span>
                    <ChevronRight
                      size={16}
                      className={`transform transition-transform ${
                        expandedMenus.includes(item.label) ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {/* Submenu */}
                  {expandedMenus.includes(item.label) && (
                    <ul className="ml-4 mt-2 space-y-1 border-l-2 border-gray-200 dark:border-gray-800 pl-4">
                      {item.children.map((child) => (
                        <li key={child.path}>
                          <Link
                            to={child.path!}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                              isActive(child.path)
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
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.path)
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
