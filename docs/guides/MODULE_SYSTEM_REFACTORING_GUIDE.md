NxForge Module System Refactoring Guide
Version: 5.0.0

Status: Architecture Transition Plan

Document Purpose: Step-by-step guide for converting NxForge to a true modular plugin architecture

Table of Contents
Architecture Overview
Phase 5: Core Services Foundation
Phase 6: Dynamic Module System
Phase 7: Consumption Monitor Extraction
Phase 8: Validation & Polish
Critical Issues to Fix First
Reference Implementations
Architecture Overview
Current State (v4.0.0)

NxForge Core (monolithic)
├── Authentication & RBAC
├── Module Registry (metadata only)
├── Consumption Monitor (hardcoded)
│   ├── Database tables in core schema
│   ├── Routes in core backend
│   └── UI pages in core frontend
└── Job/Execution/Events (incomplete)
Target State (v5.0.0)

NxForge Core (minimal)
├── Authentication & RBAC
├── Module Lifecycle Manager
├── Core Services (shared toolkit)
│   ├── Scraping Service
│   ├── HTTP Client
│   ├── Storage Service
│   └── Notification Service
├── Job Scheduler (BullMQ)
├── Execution Engine
└── Event System

Modules (pluggable)
├── consumption-monitor/
│   ├── manifest.json
│   ├── migrations/
│   ├── src/ (backend)
│   └── ui/ (frontend)
└── [future modules]/
Phase 5: Core Services Foundation
Goal: Extract shared utilities from hardcoded consumption monitor into reusable core services.

Step 5.1: Create Core Package
Objective: Set up packages/core as shared service library

Tasks:

Create new package structure:


mkdir -p packages/core/src/services
cd packages/core
npm init -y
Update package.json:


{
  "name": "@nxforge/core",
  "version": "5.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    "./services": "./dist/services/index.js"
  }
}
Add TypeScript configuration

Add to workspace in root package.json

Success Criteria:

 packages/core directory exists
 Package builds successfully with npm run build
 Backend can import: import { ... } from '@nxforge/core/services'
Step 5.2: Extract Scraping Service
Objective: Move web scraping logic from consumption routes to reusable core service

Current Location:

packages/backend/src/routes/consumption.routes.ts (inline Puppeteer code)
Target Location:

packages/core/src/services/scraping.service.ts
Interface Design:


export interface ScrapingConfig {
  url: string;
  waitForSelector?: string;
  timeout?: number;
  auth?: {
    type: 'basic' | 'form' | 'cookie';
    credentials: Record<string, string>;
  };
}

export interface ScrapingResult {
  success: boolean;
  data?: any;
  screenshot?: Buffer;
  error?: string;
  duration: number;
}

export class ScrapingService {
  // Browser pool management
  static async createBrowser(): Promise<Browser>;
  static async closeBrowser(browser: Browser): Promise<void>;
  
  // Core scraping methods
  static async scrape(config: ScrapingConfig): Promise<ScrapingResult>;
  static async extractText(page: Page, selector: string): Promise<string>;
  static async extractNumber(page: Page, selector: string): Promise<number>;
  static async screenshot(page: Page): Promise<Buffer>;
  
  // Authentication helpers
  static async loginBasicAuth(page: Page, username: string, password: string): Promise<void>;
  static async loginFormAuth(page: Page, config: FormAuthConfig): Promise<void>;
}
Tasks:

Create packages/core/src/services/scraping.service.ts
Move Puppeteer browser initialization logic
Implement browser pool (reuse browser instances)
Add authentication strategy handlers
Add error handling and retries
Export from packages/core/src/services/index.ts
Migration Path:

Create service in core
Update consumption routes to use service
Test existing scraping functionality
Remove inline Puppeteer code from routes
Success Criteria:

 Service exports all methods with TypeScript types
 Consumption monitor uses service for scraping
 Browser instances are reused efficiently
 Authentication works for basic/form/cookie types
 Screenshots captured on errors
Step 5.3: Extract HTTP Service
Objective: Create reusable HTTP client wrapper

Target Location: packages/core/src/services/http.service.ts

Interface Design:


export interface HttpConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export class HttpService {
  static createClient(config: HttpConfig): AxiosInstance;
  static async get<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
  static async post<T>(url: string, data: any, config?: AxiosRequestConfig): Promise<T>;
  static async put<T>(url: string, data: any, config?: AxiosRequestConfig): Promise<T>;
  static async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>;
}
Tasks:

Create HTTP service with Axios
Add retry logic with exponential backoff
Add request/response interceptors
Add timeout handling
Export from core services
Success Criteria:

 HTTP client has retry logic
 Timeouts properly handled
 Can be used by modules for API calls
Step 5.4: Extract Storage Service
Objective: Manage file uploads, screenshots, and module assets

Target Location: packages/core/src/services/storage.service.ts

Interface Design:


export class StorageService {
  static async saveFile(path: string, content: Buffer | string): Promise<string>;
  static async readFile(path: string): Promise<Buffer>;
  static async deleteFile(path: string): Promise<void>;
  static async saveScreenshot(name: string, buffer: Buffer): Promise<string>;
  static async getModuleAssetPath(moduleName: string, asset: string): Promise<string>;
}
Tasks:

Create storage service
Implement file system operations
Add screenshot storage for debugging
Create directory structure for modules
Export from core services
Success Criteria:

 Files can be saved/read/deleted
 Screenshots stored in organized structure
 Module assets isolated by module name
Step 5.5: Extract Notification Service
Objective: Unified notification system for alerts

Target Location: packages/core/src/services/notification.service.ts

Interface Design:


export interface NotificationChannel {
  type: 'email' | 'webhook' | 'slack';
  config: Record<string, any>;
}

export interface Notification {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  data?: Record<string, any>;
}

export class NotificationService {
  static async send(notification: Notification, channels: NotificationChannel[]): Promise<void>;
  static async sendEmail(to: string, subject: string, body: string): Promise<void>;
  static async sendWebhook(url: string, payload: any): Promise<void>;
}
Tasks:

Move email logic from existing notification service
Add webhook support
Add Slack integration (optional)
Export from core services
Success Criteria:

 Email notifications work
 Webhook notifications work
 Modules can send notifications via core
Phase 6: Dynamic Module System
Goal: Enable runtime module loading/unloading

Step 6.1: Module Manifest Schema v2
Objective: Define comprehensive module manifest format

File: packages/core/src/types/module.types.ts

Schema:


export interface ModuleManifest {
  // Identity
  name: string;              // kebab-case unique identifier
  version: string;           // semver
  displayName: string;
  description: string;
  author: string;
  license?: string;
  
  // Module structure
  entry: string;             // Backend entry point (e.g., "./dist/index.js")
  
  // Backend
  routes: RouteDefinition[];
  jobs: Record<string, JobDefinition>;
  migrations: string;        // Path to migrations directory
  
  // Frontend
  ui: {
    entry: string;           // UI entry point (e.g., "./ui/index.js")
    sidebar: SidebarConfig;
    routes: UIRouteDefinition[];
  };
  
  // Dependencies
  dependencies: {
    [packageName: string]: string;  // semver range
  };
  
  // Permissions
  permissions: string[];     // e.g., ["database:read", "network:outbound"]
  
  // Settings schema
  settings: Record<string, SettingDefinition>;
}

export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;              // Relative path (will be prefixed with /api/v1/m/{module-name})
  handler: string;           // Path to handler file
  middleware?: string[];     // Optional middleware
}

export interface JobDefinition {
  name: string;
  description: string;
  handler: string;           // Path to job handler
  schedule: string | null;   // Cron expression or null for manual
  timeout?: number;
  retries?: number;
  config?: Record<string, any>;
}

export interface SidebarConfig {
  label: string;
  icon: string;              // Emoji or icon name
  order?: number;
  children: SidebarItem[];
}

export interface SidebarItem {
  label: string;
  path: string;              // Full path (e.g., "/consumption/live")
  icon?: string;
}

export interface UIRouteDefinition {
  path: string;              // React Router path pattern
  component: string;         // Path to component file
}

export interface SettingDefinition {
  type: 'string' | 'number' | 'boolean' | 'select';
  label: string;
  description?: string;
  default?: any;
  required?: boolean;
  options?: Array<{ label: string; value: any }>;
}
Tasks:

Create TypeScript types
Create JSON schema for validation
Add schema validator using Ajv
Export from core types
Success Criteria:

 Manifest schema documented
 JSON validation works
 TypeScript types available
Step 6.2: Module Loader Service
Objective: Dynamically load and unload modules at runtime

File: packages/backend/src/services/module-loader.service.ts

Interface Design:


export class ModuleLoaderService {
  // Lifecycle methods
  static async loadModule(moduleName: string): Promise<void>;
  static async unloadModule(moduleName: string): Promise<void>;
  static async reloadModule(moduleName: string): Promise<void>;
  
  // Internal methods
  private static async readManifest(moduleName: string): Promise<ModuleManifest>;
  private static async validateManifest(manifest: ModuleManifest): Promise<void>;
  private static async registerRoutes(app: FastifyInstance, manifest: ModuleManifest): Promise<void>;
  private static async unregisterRoutes(app: FastifyInstance, moduleName: string): Promise<void>;
  private static async registerJobs(manifest: ModuleManifest): Promise<void>;
  private static async unregisterJobs(moduleName: string): Promise<void>;
  private static async runMigrations(moduleName: string, migrationsPath: string): Promise<void>;
  private static async rollbackMigrations(moduleName: string): Promise<void>;
}
Tasks:

Create module loader service
Implement manifest reading and validation
Implement dynamic route registration (Fastify plugins)
Implement job registration
Implement migration runner
Add error handling and rollback
Success Criteria:

 Can load module from disk
 Routes registered dynamically
 Jobs registered dynamically
 Migrations applied on load
 Can unload module cleanly
Step 6.3: Dynamic Frontend Route Loading
Objective: Load module UI components at runtime

File: packages/frontend/src/services/module-loader.service.ts

Interface Design:


export class ModuleLoaderService {
  // Fetch enabled modules from backend
  static async getEnabledModules(): Promise<ModuleManifest[]>;
  
  // Register module UI routes
  static registerModuleRoutes(manifest: ModuleManifest): RouteObject[];
  
  // Build sidebar from modules
  static buildSidebar(modules: ModuleManifest[]): MenuItem[];
}
Implementation Pattern:


// In App.tsx
const { data: modules } = useQuery({
  queryKey: ['modules', 'enabled'],
  queryFn: () => ModuleLoaderService.getEnabledModules()
});

const moduleRoutes = modules?.flatMap(m => 
  ModuleLoaderService.registerModuleRoutes(m)
) || [];

// Dynamic routes with lazy loading
<Route path="/modules/:moduleName/*" element={
  <Suspense fallback={<Loading />}>
    <ModuleRouteLoader />
  </Suspense>
} />
Tasks:

Create frontend module loader service
Implement API call to get enabled modules
Create ModuleRouteLoader component
Implement React.lazy() for module components
Update Sidebar to build from module manifests
Add loading states and error boundaries
Success Criteria:

 Sidebar built from enabled modules
 Module routes loaded lazily
 Module components render correctly
 Disabling module removes from sidebar
Step 6.4: Migration Runner
Objective: Apply database migrations per module

File: packages/backend/src/services/migration-runner.service.ts

Schema for Tracking:


CREATE TABLE module_migrations (
  id UUID PRIMARY KEY,
  module_name VARCHAR(255) NOT NULL,
  migration_name VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(module_name, migration_name)
);
Interface Design:


export class MigrationRunnerService {
  static async runMigrations(moduleName: string, migrationsPath: string): Promise<void>;
  static async rollbackMigrations(moduleName: string): Promise<void>;
  static async getAppliedMigrations(moduleName: string): Promise<string[]>;
  static async applyMigration(moduleName: string, migrationFile: string): Promise<void>;
}
Migration File Format:


-- Module: consumption-monitor
-- Migration: 001_create_endpoints_table.sql
-- Up migration

CREATE TABLE cm_endpoint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  -- ... other fields
  created_at TIMESTAMP DEFAULT NOW()
);

-- Down migration (optional, for rollback)
-- DROP TABLE cm_endpoint;
Tasks:

Create migration runner service
Add migration tracking table
Implement migration file parsing
Apply migrations in order
Track applied migrations
Implement rollback (optional)
Success Criteria:

 Migrations applied on module install
 Applied migrations tracked in DB
 Can rollback migrations on uninstall
 Migrations are idempotent
Step 6.5: Module Lifecycle API
Objective: REST API for module management

File: packages/backend/src/routes/module-management.routes.ts

Endpoints:


// List all modules
GET /api/v1/modules
Response: { modules: ModuleInfo[] }

// Get specific module
GET /api/v1/modules/:name
Response: { module: ModuleInfo, manifest: ModuleManifest }

// Install module (upload ZIP)
POST /api/v1/modules/install
Body: multipart/form-data { file: module.zip }
Response: { moduleId: string, status: 'INSTALLED' }

// Enable module
POST /api/v1/modules/:name/enable
Response: { status: 'ENABLED' }

// Disable module
POST /api/v1/modules/:name/disable
Response: { status: 'DISABLED' }

// Uninstall module
DELETE /api/v1/modules/:name
Response: { status: 'UNINSTALLED' }

// Get module logs
GET /api/v1/modules/:name/logs
Response: { logs: LogEntry[] }
Status Workflow:


UPLOADING → VALIDATING → INSTALLING → INSTALLED → ENABLED
                ↓                                      ↓
             INVALID                               DISABLED → UNINSTALLING → REMOVED
Tasks:

Create module management routes
Implement ZIP upload and extraction
Implement manifest validation
Wire up module loader service
Add status tracking
Add audit logging
Success Criteria:

 Can upload module ZIP
 Module extracted to correct directory
 Enable/disable works end-to-end
 Uninstall cleans up files
 Status tracked correctly
Phase 7: Consumption Monitor Extraction
Goal: Convert hardcoded consumption monitor to true plugin module

Step 7.1: Create Module Directory Structure
Objective: Set up consumption monitor as standalone module

Tasks:

Create module directory:


mkdir -p modules/consumption-monitor/{src,ui,migrations}
cd modules/consumption-monitor
npm init -y
Create manifest.json (updated for v2 schema)

Set up TypeScript project

Add build scripts

Directory Structure:


modules/consumption-monitor/
├── manifest.json
├── package.json
├── tsconfig.json
├── migrations/
│   └── 001_create_tables.sql
├── src/
│   ├── index.ts           (module entry point)
│   ├── routes/
│   │   ├── endpoints.routes.ts
│   │   └── consumption.routes.ts
│   ├── services/
│   │   ├── scraping.service.ts
│   │   └── consumption.service.ts
│   └── jobs/
│       └── collect-consumption.ts
└── ui/
    ├── index.tsx
    ├── pages/
    │   ├── LiveDashboardPage.tsx
    │   ├── EndpointsPage.tsx
    │   ├── ReportsPage.tsx
    │   └── HistoryPage.tsx
    ├── components/
    │   └── EndpointFormModal.tsx
    └── api/
        ├── endpoints.ts
        └── consumption.ts
Success Criteria:

 Module directory structure created
 Module builds successfully
 Manifest validates against schema
Step 7.2: Database Schema Migration
Objective: Move consumption tables to module ownership with prefix

Current Tables:

endpoint
consumption_reading
Target Tables:

cm_endpoint
cm_reading
Migration Strategy:


-- Migration: rename_consumption_tables.sql

-- Rename tables
ALTER TABLE endpoint RENAME TO cm_endpoint;
ALTER TABLE consumption_reading RENAME TO cm_reading;

-- Update foreign keys
ALTER TABLE cm_reading 
  DROP CONSTRAINT IF EXISTS consumption_reading_endpoint_id_fkey;

ALTER TABLE cm_reading 
  ADD CONSTRAINT cm_reading_endpoint_id_fkey 
  FOREIGN KEY (endpoint_id) REFERENCES cm_endpoint(id) 
  ON DELETE CASCADE;

-- Update indexes
ALTER INDEX endpoint_pkey RENAME TO cm_endpoint_pkey;
ALTER INDEX consumption_reading_pkey RENAME TO cm_reading_pkey;
Tasks:

Create migration SQL file
Run migration manually (one-time)
Verify data integrity
Update Prisma schema to remove old models
Create module-specific Prisma schema (optional)
Success Criteria:

 Tables renamed with cm_ prefix
 All data preserved
 Foreign keys working
 Core schema no longer has consumption models
Step 7.3: Backend Route Extraction
Objective: Move consumption routes to module

Current Location:

packages/backend/src/routes/endpoints.routes.ts
packages/backend/src/routes/consumption.routes.ts
Target Location:

modules/consumption-monitor/src/routes/endpoints.routes.ts
modules/consumption-monitor/src/routes/consumption.routes.ts
Tasks:

Copy route files to module
Update imports to use @nxforge/core/services
Update database queries to use cm_ prefixed tables
Test routes work from module
Delete original routes from core
Remove route registration from core app.ts
Module Entry Point:


// modules/consumption-monitor/src/index.ts
import { FastifyInstance } from 'fastify';
import endpointsRoutes from './routes/endpoints.routes';
import consumptionRoutes from './routes/consumption.routes';

export default async function consumptionMonitorPlugin(
  app: FastifyInstance,
  options: any
) {
  // Register routes
  app.register(endpointsRoutes, { prefix: '/endpoints' });
  app.register(consumptionRoutes, { prefix: '/consumption' });
}
Success Criteria:

 Module routes work when loaded
 Routes removed from core
 API endpoints still functional
 Module uses core scraping service
Step 7.4: Frontend Component Extraction
Objective: Move consumption UI to module

Current Location:

packages/frontend/src/pages/LiveDashboardPage.tsx
packages/frontend/src/pages/EndpointsPage.tsx
packages/frontend/src/pages/ReportsPage.tsx
packages/frontend/src/pages/HistoryPage.tsx
packages/frontend/src/components/EndpointFormModal.tsx
packages/frontend/src/api/endpoints.ts
packages/frontend/src/api/consumption.ts
Target Location:

modules/consumption-monitor/ui/pages/*
modules/consumption-monitor/ui/components/*
modules/consumption-monitor/ui/api/*
Tasks:

Copy UI files to module
Update imports (relative paths)
Create module UI entry point
Test components render correctly
Delete original files from core
Remove hardcoded routes from App.tsx
Remove hardcoded sidebar items from Sidebar.tsx
Module UI Entry Point:


// modules/consumption-monitor/ui/index.tsx
import { RouteObject } from 'react-router-dom';
import { lazy } from 'react';

const LiveDashboardPage = lazy(() => import('./pages/LiveDashboardPage'));
const EndpointsPage = lazy(() => import('./pages/EndpointsPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));

export const routes: RouteObject[] = [
  { path: '/consumption/live', element: <LiveDashboardPage /> },
  { path: '/consumption/endpoints', element: <EndpointsPage /> },
  { path: '/consumption/reports', element: <ReportsPage /> },
  { path: '/consumption/history', element: <HistoryPage /> },
];
Success Criteria:

 Module UI components work
 Components removed from core
 Sidebar built dynamically from manifest
 Routes loaded lazily
 Module appears/disappears based on status
Step 7.5: Job Handler Extraction
Objective: Move job logic to module

Current Location:

Job handler doesn't exist yet (needs to be created)
Target Location:

modules/consumption-monitor/src/jobs/collect-consumption.ts
Interface:


// Job handler interface
export async function handler(context: JobContext): Promise<JobResult> {
  const { config, logger } = context;
  
  // Job logic here
  logger.info('Starting consumption collection...');
  
  return {
    success: true,
    data: { processed: 10 },
  };
}
Tasks:

Create job handler in module
Implement consumption collection logic
Use core scraping service
Test job execution
Register job in manifest
Success Criteria:

 Job handler created
 Job registered by module loader
 Job executes successfully
 Execution logged properly
Step 7.6: Final Integration Test
Objective: Verify consumption monitor works as standalone module

Test Checklist:

 Install: Module loads successfully
 Enable: Sidebar items appear
 Routes: All pages accessible
 Endpoints: CRUD operations work
 Scraping: Test scraping functionality
 Jobs: Manual job execution works
 Disable: Sidebar items disappear, routes return 403
 Uninstall: Module removed cleanly
Phase 8: Validation & Polish
Goal: Fix critical issues and validate architecture

Step 8.1: Implement Job Execution System
Objective: Make job scheduling actually work

File: packages/backend/src/services/scheduler.service.ts

Dependencies:


npm install bullmq ioredis
Interface Design:


export class SchedulerService {
  private static queues: Map<string, Queue> = new Map();
  private static workers: Map<string, Worker> = new Map();
  
  static async initialize(): Promise<void>;
  static async registerJob(jobName: string, handler: Function, schedule?: string): Promise<void>;
  static async executeJob(jobId: string, data?: any): Promise<void>;
  static async pauseJob(jobName: string): Promise<void>;
  static async resumeJob(jobName: string): Promise<void>;
  static async getJobStatus(jobId: string): Promise<JobStatus>;
}
Tasks:

Set up BullMQ with Redis connection
Create job queue and worker
Implement cron scheduling
Add job execution logging
Wire up with module loader
Test job execution
Success Criteria:

 Jobs can be scheduled with cron
 Jobs execute on schedule
 Manual job execution works
 Job status tracked in database
Step 8.2: Implement Execution Logging
Objective: Track execution history properly

File: packages/backend/src/services/execution-tracker.service.ts

Interface Design:


export class ExecutionTrackerService {
  static async startExecution(jobName: string, data?: any): Promise<string>;
  static async updateExecution(executionId: string, update: Partial<Execution>): Promise<void>;
  static async completeExecution(executionId: string, result: JobResult): Promise<void>;
  static async failExecution(executionId: string, error: Error): Promise<void>;
  static async getExecutions(filters: ExecutionFilters): Promise<Execution[]>;
}
Tasks:

Create execution tracker service
Wrap job execution with tracking
Store execution logs (stdout/stderr)
Store execution duration
Store execution result/error
Add screenshot storage on error
Success Criteria:

 Every job execution logged
 ExecutionsPage shows real data
 Can view execution logs
 Screenshots available for failed scrapes
Step 8.3: Implement Event System
Objective: Enable event-driven notifications

File: packages/backend/src/services/events.service.ts

Interface Design:


export class EventsService {
  private static emitter: EventEmitter;
  
  static async emit(event: string, data: any): Promise<void>;
  static subscribe(event: string, handler: Function): void;
  static unsubscribe(event: string, handler: Function): void;
  
  // Built-in events
  static async emitJobStarted(jobName: string): Promise<void>;
  static async emitJobCompleted(jobName: string, result: any): Promise<void>;
  static async emitJobFailed(jobName: string, error: Error): Promise<void>;
  static async emitScrapingFailed(endpoint: Endpoint, error: Error): Promise<void>;
}
Tasks:

Create event service
Add event storage (optional, for history)
Integrate with job execution
Integrate with scraping service
Wire up notification service
Test event flow
Success Criteria:

 Events emitted for key actions
 EventsPage shows events
 Notifications sent for critical events
 Modules can subscribe to events
Step 8.4: Create Second Example Module
Objective: Validate architecture with different use case

Module: Temperature Monitor

Features:

Scrape IPMI interfaces for sensor data
Store temperature readings
Alert on threshold violations
Dashboard showing temp trends
Tasks:

Create module structure
Implement backend routes/jobs
Implement frontend UI
Install and test
Verify both modules coexist
Success Criteria:

 Two modules installed simultaneously
 Both appear in sidebar
 No conflicts between modules
 Each module has isolated data
Critical Issues to Fix First
Before starting Phase 5, these must work:

Issue 1: BullMQ Job Queue
Status: Not implemented

Priority: Critical

Estimated Effort: 1-2 days

Steps:

Add BullMQ and Redis dependencies
Create scheduler.service.ts
Set up Redis connection
Create queue and worker
Test job execution
Integrate with module loader
Issue 2: Execution Tracking
Status: Partially implemented (table exists, not used)

Priority: High

Estimated Effort: 1 day

Steps:

Create execution tracker service
Wrap job handlers with tracking
Store execution logs
Update ExecutionsPage to show data
Issue 3: Event System
Status: Not implemented

Priority: Medium

Estimated Effort: 1 day

Steps:

Create events service (Node EventEmitter)
Integrate with job execution
Store events in database (optional)
Update EventsPage to show events
Reference Implementations
Example: Module Manifest (Consumption Monitor v2)

{
  "name": "consumption-monitor",
  "version": "2.0.0",
  "displayName": "Consumption Monitor",
  "description": "Automated power consumption monitoring for colocation racks",
  "author": "NxForge",
  "license": "MIT",
  
  "entry": "./dist/index.js",
  
  "routes": [
    {
      "method": "GET",
      "path": "/endpoints",
      "handler": "./routes/endpoints.routes"
    },
    {
      "method": "POST",
      "path": "/endpoints",
      "handler": "./routes/endpoints.routes"
    },
    {
      "method": "GET",
      "path": "/endpoints/:id",
      "handler": "./routes/endpoints.routes"
    },
    {
      "method": "PUT",
      "path": "/endpoints/:id",
      "handler": "./routes/endpoints.routes"
    },
    {
      "method": "DELETE",
      "path": "/endpoints/:id",
      "handler": "./routes/endpoints.routes"
    },
    {
      "method": "POST",
      "path": "/endpoints/:id/test",
      "handler": "./routes/endpoints.routes"
    },
    {
      "method": "GET",
      "path": "/consumption/live",
      "handler": "./routes/consumption.routes"
    },
    {
      "method": "GET",
      "path": "/consumption/readings",
      "handler": "./routes/consumption.routes"
    },
    {
      "method": "GET",
      "path": "/consumption/monthly-summary",
      "handler": "./routes/consumption.routes"
    }
  ],
  
  "ui": {
    "entry": "./ui/index.js",
    "sidebar": {
      "label": "Consumption Monitor",
      "icon": "⚡",
      "order": 10,
      "children": [
        {
          "label": "Live Dashboard",
          "path": "/consumption/live",
          "icon": "📊"
        },
        {
          "label": "Endpoints",
          "path": "/consumption/endpoints",
          "icon": "🔌"
        },
        {
          "label": "Reports",
          "path": "/consumption/reports",
          "icon": "📋"
        },
        {
          "label": "History",
          "path": "/consumption/history",
          "icon": "📈"
        }
      ]
    },
    "routes": [
      {
        "path": "/consumption/*",
        "component": "./ui/index"
      }
    ]
  },
  
  "migrations": "./migrations",
  
  "jobs": {
    "collect-consumption": {
      "name": "Collect Consumption Data",
      "description": "Scrapes power meters and collects kWh consumption data from rack endpoints",
      "handler": "./jobs/collect-consumption",
      "schedule": "*/15 * * * *",
      "timeout": 300000,
      "retries": 2,
      "config": {
        "batchSize": {
          "type": "number",
          "label": "Batch Size",
          "description": "Number of endpoints to process concurrently",
          "default": 5
        },
        "screenshotOnError": {
          "type": "boolean",
          "label": "Screenshot on Error",
          "description": "Capture screenshot when scraping fails",
          "default": true
        }
      }
    }
  },
  
  "dependencies": {
    "@nxforge/core": "^5.0.0"
  },
  
  "permissions": [
    "database:read",
    "database:write",
    "network:outbound",
    "storage:write"
  ],
  
  "settings": {
    "defaultPollInterval": {
      "type": "number",
      "label": "Default Poll Interval (minutes)",
      "description": "Default interval for polling endpoints",
      "default": 15,
      "required": false
    },
    "alertThreshold": {
      "type": "number",
      "label": "Alert Threshold (kWh)",
      "description": "Send alert when consumption exceeds this value",
      "default": 1000,
      "required": false
    }
  }
}
Usage Instructions
This document should be used as follows:

User provides instruction: "Start with Step 5.1: Create Core Package"
Claude implements: Complete tasks, report results, ask for next step
User confirms/corrects: Either proceed to next step or fix issues
Repeat: Continue through phases sequentially
Each step is designed to be:

Atomic: Can be completed independently
Testable: Has clear success criteria
Reversible: Can be rolled back if needed
Documented: Includes interface definitions and examples
End of Document