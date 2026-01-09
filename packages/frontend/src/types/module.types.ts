/**
 * Frontend module type definitions
 * Matches backend module types for consistency
 */

export interface ModuleManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author?: string;
  license?: string;
  capabilities?: ModuleCapabilities;
  dependencies?: ModuleDependencies;
  config?: ModuleConfig;
  permissions?: string[];
  metadata?: ModuleMetadata;
}

export interface ModuleCapabilities {
  api?: {
    routes?: RouteDefinition[];
  };
  jobs?: {
    handlers?: JobDefinition[];
  };
  events?: {
    listeners?: EventListener[];
    emitters?: EventEmitter[];
  };
  ui?: {
    pages?: UIPage[];
    components?: UIComponent[];
    navigation?: NavigationItem[];
  };
}

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: string;
  permissions?: string[];
}

export interface JobDefinition {
  name: string;
  handler: string;
  schedule?: string;
  timeout?: number;
  retries?: number;
}

export interface EventListener {
  event: string;
  handler: string;
}

export interface EventEmitter {
  event: string;
}

export interface UIPage {
  path: string;
  component: string;
  title: string;
  icon?: string;
  permissions?: string[];
}

export interface UIComponent {
  name: string;
  component: string;
  slot: string;
}

export interface NavigationItem {
  label: string;
  path: string;
  icon?: string;
  order?: number;
  permissions?: string[];
}

export interface ModuleDependencies {
  modules?: Record<string, string>;
  npm?: Record<string, string>;
  system?: Record<string, string>;
}

export interface ModuleConfig {
  schema?: Record<string, ConfigField>;
  defaults?: Record<string, any>;
}

export interface ConfigField {
  type: 'string' | 'number' | 'boolean' | 'password' | 'select';
  label: string;
  description?: string;
  required?: boolean;
  sensitive?: boolean;
  default?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

export interface ModuleMetadata {
  homepage?: string;
  repository?: string;
  tags?: string[];
  category?: string;
}

export enum ModuleStatus {
  REGISTERED = 'REGISTERED',
  INSTALLING = 'INSTALLING',
  DISABLED = 'DISABLED',
  ENABLED = 'ENABLED',
  UPDATING = 'UPDATING',
  REMOVING = 'REMOVING',
  ERROR = 'ERROR',
}

export interface Module {
  id: string;
  name: string;
  version: string;
  displayName: string;
  description: string;
  status: ModuleStatus;
  manifest: ModuleManifest;
  config?: Record<string, any>;
  installedAt?: string;
  enabledAt?: string;
  disabledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoadedModule {
  manifest: ModuleManifest;
  component?: React.ComponentType<any>;
  error?: Error;
  isLoading: boolean;
}

export interface ModuleComponentProps {
  moduleId: string;
  moduleName: string;
  config?: Record<string, any>;
}
