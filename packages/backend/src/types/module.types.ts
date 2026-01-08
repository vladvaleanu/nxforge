/**
 * Module system type definitions
 */

/**
 * Module manifest structure
 * This defines what a module must provide in its manifest.json
 */
export interface ModuleManifest {
  // Core module information
  name: string; // kebab-case identifier (e.g., "vmware-vcenter")
  version: string; // Semantic version (e.g., "1.0.0")
  displayName: string; // Human-readable name
  description: string;
  author: string;
  license?: string;

  // Module capabilities
  capabilities: {
    // Backend capabilities
    api?: {
      routes: RouteDefinition[];
      middleware?: string[];
    };
    jobs?: {
      handlers: JobHandlerDefinition[];
    };
    events?: {
      listeners: EventListenerDefinition[];
      emitters?: string[];
    };

    // Frontend capabilities
    ui?: {
      pages: PageDefinition[];
      components?: ComponentDefinition[];
      navigation?: NavigationItem[];
    };
  };

  // Module dependencies
  dependencies?: {
    modules?: Record<string, string>; // Other modules (name: version)
    npm?: Record<string, string>; // NPM packages
    system?: {
      node?: string; // Node.js version
      database?: string[]; // Required DB features
    };
  };

  // Configuration schema
  config?: {
    schema: Record<string, ConfigFieldDefinition>;
    defaults?: Record<string, any>;
  };

  // Permissions required
  permissions?: string[];

  // Module metadata
  metadata?: {
    homepage?: string;
    repository?: string;
    bugs?: string;
    tags?: string[];
    category?: string;
  };
}

/**
 * API Route definition
 */
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string; // Relative to /api/v1/modules/:moduleName
  handler: string; // Path to handler file
  permissions?: string[];
  schema?: {
    body?: Record<string, any>;
    querystring?: Record<string, any>;
    params?: Record<string, any>;
    response?: Record<string, any>;
  };
}

/**
 * Job handler definition
 */
export interface JobHandlerDefinition {
  name: string;
  handler: string; // Path to handler file
  schedule?: string; // Cron expression for scheduled jobs
  timeout?: number; // Max execution time in ms
  retries?: number;
}

/**
 * Event listener definition
 */
export interface EventListenerDefinition {
  event: string; // Event name to listen for
  handler: string; // Path to handler file
  priority?: number;
}

/**
 * UI Page definition
 */
export interface PageDefinition {
  path: string; // Route path (e.g., "/settings")
  component: string; // Path to React component
  title: string;
  permissions?: string[];
  icon?: string;
}

/**
 * UI Component definition
 */
export interface ComponentDefinition {
  name: string;
  component: string; // Path to React component
  slot?: string; // Where to inject (e.g., "dashboard-widget")
}

/**
 * Navigation item definition
 */
export interface NavigationItem {
  label: string;
  path: string;
  icon?: string;
  permissions?: string[];
  order?: number;
  children?: NavigationItem[];
}

/**
 * Configuration field definition
 */
export interface ConfigFieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'password';
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
  sensitive?: boolean; // Should be encrypted in storage
}

/**
 * Module validation result
 */
export interface ModuleValidationResult {
  valid: boolean;
  errors: ModuleValidationError[];
  warnings?: string[];
}

/**
 * Module validation error
 */
export interface ModuleValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Module registry entry
 */
export interface ModuleRegistryEntry {
  id: string;
  name: string;
  version: string;
  displayName: string;
  description: string | null;
  status: ModuleStatus;
  manifest: ModuleManifest;
  installedAt: Date | null;
  enabledAt: Date | null;
  disabledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Module status enum
 */
export enum ModuleStatus {
  REGISTERED = 'REGISTERED',
  INSTALLING = 'INSTALLING',
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
  UPDATING = 'UPDATING',
  REMOVING = 'REMOVING',
}

/**
 * Module installation options
 */
export interface ModuleInstallOptions {
  autoEnable?: boolean;
  skipDependencies?: boolean;
  config?: Record<string, any>;
}
