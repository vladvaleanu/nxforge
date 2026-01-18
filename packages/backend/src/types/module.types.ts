/**
 * Module System Types (V2 Schema)
 * Unified with @nxforge/core types
 */

// ============================================================================
// Module Manifest Types (V2)
// ============================================================================

export interface ModuleManifest {
  // Identity
  name: string;                    // kebab-case unique identifier (e.g., "consumption-monitor")
  version: string;                 // semver (e.g., "1.0.0")
  displayName: string;             // Human-readable name
  description: string;             // Short description
  author: string;                  // Author name or organization
  license?: string;                // License type (e.g., "MIT")

  // Module structure
  entry: string;                   // Backend entry point - MUST export a Fastify plugin as default
  // The plugin will be registered at /api/v1/m/{module-name}

  // Backend configuration
  routes?: RouteDefinition[];      // Legacy route definitions (deprecated, use plugin-based approach)
  jobs?: Record<string, JobDefinition>;  // Job handlers (keyed by job ID)
  migrations?: string;             // Path to migrations directory

  // Frontend configuration
  ui?: UIConfiguration;            // Frontend UI configuration

  // Dependencies
  dependencies?: Record<string, string>; // Package name -> semver range

  // Permissions
  permissions?: string[];          // Required permissions (e.g., ["database:read", "network:outbound"])

  // Settings schema
  settings?: Record<string, SettingDefinition>;  // Module-specific settings

  // Configuration schema (for runtime config validation)
  config?: {
    schema?: Record<string, SettingDefinition>;  // Config field definitions
    defaults?: Record<string, any>;              // Default values
  };

  // Metadata
  metadata?: {
    homepage?: string;
    repository?: string;
    bugs?: string;
    tags?: string[];
    category?: string;
  };
}

// ============================================================================
// Backend Route Configuration
// ============================================================================

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;                    // Relative path (will be prefixed with /api/v1/m/{module-name})
  handler?: string;                // Path to handler file (relative to module root)
  middleware?: string[];           // Optional middleware names
  description?: string;            // Route description for documentation
  permissions?: string[];          // Required permissions for this route
}

// ============================================================================
// Job Configuration
// ============================================================================

export interface JobDefinition {
  name: string;                    // Display name
  description?: string;            // Job description
  handler: string;                 // Path to job handler file
  schedule?: string | null;        // Cron expression or null for manual execution
  timeout?: number;                // Timeout in milliseconds (default: 300000)
  retries?: number;                // Number of retry attempts (default: 3)
  config?: Record<string, JobConfigField>;  // Job-specific configuration schema
}

export interface JobConfigField {
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  default?: any;
  required?: boolean;
  options?: Array<{ label: string; value: any }>;  // For 'select' type
  min?: number;                    // For 'number' type
  max?: number;                    // For 'number' type
  pattern?: string;                // For 'string' type validation
}

// ============================================================================
// Frontend UI Configuration
// ============================================================================

export interface UIConfiguration {
  entry: string;                   // UI entry point (e.g., "./ui/index.js")
  sidebar: SidebarConfig;          // Sidebar menu configuration
  routes: UIRouteDefinition[];     // Frontend routes
}

export interface SidebarConfig {
  label: string;                   // Menu item label
  icon: string;                    // Icon (emoji or icon name)
  order?: number;                  // Display order (lower = higher in menu)
  children?: SidebarItem[];        // Child menu items
}

export interface SidebarItem {
  label: string;                   // Menu item label
  path: string;                    // Full path (e.g., "/consumption/live")
  icon?: string;                   // Optional icon
  badge?: string;                  // Optional badge text
}

export interface UIRouteDefinition {
  path: string;                    // React Router path pattern (e.g., "/consumption/*")
  component: string;               // Path to component file
  exact?: boolean;                 // Exact path matching
}

// ============================================================================
// Module Settings
// ============================================================================

export interface SettingDefinition {
  type: 'string' | 'number' | 'boolean' | 'select' | 'json' | 'password';
  label: string;
  description?: string;
  default?: any;
  required?: boolean;
  options?: Array<{ label: string; value: any }>;  // For 'select' type
  min?: number;                    // For 'number' type
  max?: number;                    // For 'number' type
  pattern?: string;                // For 'string' type validation
  placeholder?: string;            // UI placeholder text
  sensitive?: boolean;             // Should be encrypted in storage
}

// ============================================================================
// Module Metadata (Database representation)
// ============================================================================

export interface ModuleRegistryEntry {
  id: string;
  name: string;
  version: string;
  displayName: string;
  description: string | null;
  author: string;
  status: ModuleStatus;
  manifest: ModuleManifest;
  config?: Record<string, any>;    // User-provided configuration values
  path?: string;                   // File system path to module
  installedAt: Date | null;
  enabledAt: Date | null;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum ModuleStatus {
  REGISTERED = 'REGISTERED',       // Manifest registered but not installed
  INSTALLING = 'INSTALLING',       // Installation in progress
  INSTALLED = 'INSTALLED',         // Installed but not enabled
  ENABLING = 'ENABLING',           // Being enabled
  ENABLED = 'ENABLED',             // Active and running
  DISABLING = 'DISABLING',         // Being disabled
  DISABLED = 'DISABLED',           // Installed but inactive
  UPDATING = 'UPDATING',           // Update in progress
  REMOVING = 'REMOVING',           // Uninstall in progress
  ERROR = 'ERROR',                 // Error state
}

// ============================================================================
// Module Runtime Context
// ============================================================================

/**
 * Context provided to modules at runtime
 * Contains access to services, configuration, and utilities
 */
export interface ModuleContext {
  module: {
    id: string;
    name: string;
    version: string;
    config?: Record<string, any>;
  };
  services: ModuleServices;
}

/**
 * Context provided to job handlers
 * Re-exported from job.types.ts for convenience - DO NOT DUPLICATE
 */
export type { JobContext } from './job.types.js';

/**
 * Services available to modules
 */
export interface ModuleServices {
  logger: any;          // LoggerService
  prisma: any;          // PrismaClient
  browser?: any;        // BrowserService
  http?: any;           // HttpService
  storage?: any;        // StorageService
  notifications?: any;  // NotificationService
  events?: any;         // EventBusService
  database?: any;       // DatabaseService
}

// ============================================================================
// Module Validation
// ============================================================================

export interface ModuleValidationResult {
  valid: boolean;
  errors: ModuleValidationError[];
  warnings?: string[];
}

export interface ModuleValidationError {
  field: string;
  message: string;
  code: string;
  severity?: 'error' | 'warning';
}

// ============================================================================
// Module Installation
// ============================================================================

export interface ModuleInstallOptions {
  autoEnable?: boolean;            // Auto-enable after installation
  skipMigrations?: boolean;        // Skip running database migrations
  skipDependencies?: boolean;      // Skip dependency installation
  force?: boolean;                 // Force installation even if validation fails
  config?: Record<string, any>;    // Initial configuration
}

export interface ModuleInstallResult {
  success: boolean;
  moduleId?: string;
  errors?: string[];
  warnings?: string[];
  migrationsApplied?: number;
  dependenciesInstalled?: string[];
}

// ============================================================================
// Module Lifecycle Events
// ============================================================================

export interface ModuleLifecycleEvent {
  moduleId: string;
  moduleName: string;
  event: ModuleLifecycleEventType;
  timestamp: Date;
  details?: any;
  error?: string;
}

export enum ModuleLifecycleEventType {
  INSTALL_START = 'INSTALL_START',
  INSTALL_SUCCESS = 'INSTALL_SUCCESS',
  INSTALL_ERROR = 'INSTALL_ERROR',
  ENABLE_START = 'ENABLE_START',
  ENABLE_SUCCESS = 'ENABLE_SUCCESS',
  ENABLE_ERROR = 'ENABLE_ERROR',
  DISABLE_START = 'DISABLE_START',
  DISABLE_SUCCESS = 'DISABLE_SUCCESS',
  DISABLE_ERROR = 'DISABLE_ERROR',
  UNINSTALL_START = 'UNINSTALL_START',
  UNINSTALL_SUCCESS = 'UNINSTALL_SUCCESS',
  UNINSTALL_ERROR = 'UNINSTALL_ERROR',
  UPDATE_START = 'UPDATE_START',
  UPDATE_SUCCESS = 'UPDATE_SUCCESS',
  UPDATE_ERROR = 'UPDATE_ERROR',
}

// ============================================================================
// Permission System
// ============================================================================

export type ModulePermission =
  | 'database:read'
  | 'database:write'
  | 'network:outbound'
  | 'network:inbound'
  | 'storage:read'
  | 'storage:write'
  | 'system:execute'
  | string;  // Allow custom permissions

// ============================================================================
// Module Query Filters
// ============================================================================

export interface ModuleQueryFilter {
  status?: ModuleStatus | ModuleStatus[];
  name?: string;
  search?: string;              // Search in name, displayName, description
  author?: string;
  hasUI?: boolean;
  hasJobs?: boolean;
}
