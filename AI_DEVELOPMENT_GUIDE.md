# NxForge AI Development Guidelines

> **Purpose**: This document provides comprehensive guidelines for AI assistants working on the NxForge codebase. Follow these rules strictly to maintain code quality, avoid redundancy, and respect architectural principles.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture Principles](#2-architecture-principles)
3. [Codebase Structure](#3-codebase-structure)
4. [Existing Services Reference](#4-existing-services-reference)
5. [Type System Rules](#5-type-system-rules)
6. [Backend Development](#6-backend-development)
7. [Frontend Development](#7-frontend-development)
8. [Module Development](#8-module-development)
9. [Anti-Patterns to Avoid](#9-anti-patterns-to-avoid)
10. [Code Examples](#10-code-examples)

---

## 1. Project Overview

**NxForge** is a modular data center automation platform for colocation providers. It uses a three-layer architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Control Plane                        │
│                    (React Frontend)                         │
├─────────────────────────────────────────────────────────────┤
│                  Core Platform Services                     │
│           (Fastify Backend + Prisma + BullMQ)               │
├─────────────────────────────────────────────────────────────┤
│                     Execution Layer                         │
│              (Job Workers + Playwright + Redis)             │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack
| Layer | Technology |
|-------|------------|
| Backend Runtime | Node.js 20+ with TypeScript |
| Backend Framework | Fastify |
| Database | PostgreSQL with Prisma ORM |
| Job Queue | BullMQ + Redis |
| Browser Automation | Playwright |
| Frontend | React 18 + Vite + TanStack Query |
| State Management | Zustand |
| Styling | Tailwind CSS |

---

## 2. Architecture Principles

### CRITICAL: Core Immutability
```
⚠️ THE CORE IS FROZEN - DO NOT MODIFY CORE SERVICES
```

The core platform provides foundational services. All new functionality MUST be implemented as **modules**, not by modifying core services.

### What is CORE (DO NOT MODIFY):
```
packages/backend/src/
├── services/           # Core services - FROZEN
├── routes/             # Core API routes - FROZEN  
├── middleware/         # Auth, error handling - FROZEN
├── lib/                # Database, Redis connections - FROZEN
├── types/              # Core type definitions - FROZEN
└── config/             # Configuration - FROZEN
```

### What is MODULE (Where new features go):
```
modules/{module-name}/
├── manifest.json       # Module definition
├── src/
│   └── index.ts       # Backend entry point
└── dist/              # Compiled output

packages/frontend/src/modules/{module-name}/
├── pages/             # Module UI pages
├── components/        # Module-specific components
├── hooks/             # Module-specific hooks
└── api.ts             # API client
```

### Key Principles

1. **No Code Duplication**
   - Before creating anything, CHECK if it already exists
   - Use existing utilities, types, and services

2. **Single Source of Truth**
   - Each type/interface is defined in ONE place
   - Prisma schema is the source of truth for data models

3. **Module Isolation**
   - Modules cannot import from other modules
   - Modules can only use core services through context

4. **Type Safety First**
   - No `any` types (use proper typing or `unknown`)
   - Use Prisma.$Enums for database enums
   - Use `Prisma.InputJsonValue` for JSON fields

---

## 3. Codebase Structure

### Backend (`packages/backend/`)
```
src/
├── config/
│   ├── constants.ts      # All constants (timeouts, limits, messages)
│   ├── env.ts            # Environment variables (typed)
│   └── logger.ts         # Pino logger configuration
│
├── lib/
│   ├── prisma.ts         # Prisma client + $Enums export
│   └── redis.ts          # Redis connection factory
│
├── middleware/
│   ├── auth.middleware.ts     # JWT authentication
│   └── error-handler.middleware.ts
│
├── routes/               # API routes (DO NOT ADD NEW FILES HERE)
│   ├── auth.routes.ts
│   ├── dashboard.routes.ts
│   ├── events.routes.ts
│   ├── executions.routes.ts
│   ├── jobs.routes.ts
│   ├── modules.routes.ts
│   ├── settings.routes.ts
│   └── users.routes.ts
│
├── services/             # Core services (DO NOT ADD NEW FILES HERE)
│   ├── auth.service.ts
│   ├── browser.service.ts      # Playwright automation
│   ├── event-bus.service.ts    # Redis pub/sub
│   ├── http.service.ts         # HTTP client for modules
│   ├── job.service.ts          # BullMQ job scheduling
│   ├── job-executor.service.ts # Job execution with context
│   ├── module-lifecycle.service.ts
│   ├── module-loader.service.ts
│   ├── module-registry.service.ts
│   ├── module-validator.service.ts
│   └── notification.service.ts  # Email/SMS/Webhook
│
├── types/
│   ├── job.types.ts      # Job, execution, context types
│   ├── module.types.ts   # Module manifest, registry types
│   └── fastify.d.ts      # Fastify type augmentations
│
└── utils/
    ├── pagination.utils.ts
    ├── query.utils.ts
    └── response.utils.ts
```

### Frontend (`packages/frontend/`)
```
src/
├── components/           # Shared UI components
│   ├── ui/              # Base components (Button, Card, etc.)
│   └── layout/          # Layout components
│
├── hooks/               # Shared hooks
│   ├── useAuth.ts
│   └── useModules.ts
│
├── pages/               # Core pages
│   ├── Dashboard.tsx
│   ├── Jobs.tsx
│   ├── Modules.tsx
│   └── Settings.tsx
│
├── modules/             # MODULE UI CODE GOES HERE
│   └── {module-name}/
│
├── services/            # API clients
│   └── api.ts           # Axios instance with auth
│
├── stores/              # Zustand stores
│   ├── authStore.ts
│   └── uiStore.ts
│
└── lib/
    └── utils.ts         # Shared utilities
```

---

## 4. Existing Services Reference

### BEFORE creating anything, CHECK if these services provide what you need:

#### `browserService` - Playwright Automation
```typescript
const session = await browserService.createSession({ headless: true });
const page = await session.newPage();
await page.goto('https://example.com');
await session.close();
```

#### `httpService` - HTTP Requests
```typescript
const response = await httpService.get('https://api.example.com/data');
const data = await httpService.post(url, { body: payload });
```

#### `notificationService` - Notifications
```typescript
await notificationService.email({ to: 'user@example.com', subject: 'Alert', body: '...' });
await notificationService.webhook({ url: 'https://...', payload: {...} });
```

#### `eventBusService` - Event Pub/Sub
```typescript
// Emit event
await eventBusService.emit('module.action', { data: '...' });

// Subscribe to event
eventBusService.on('module.action', async (context) => {
  // Handle event
});
```

#### `jobService` - Job Scheduling
```typescript
await jobService.scheduleJob(job, '0 */5 * * *'); // Every 5 minutes
await jobService.triggerJob(job); // Manual trigger
```

---

## 5. Type System Rules

### ❌ NEVER USE:
```typescript
// BAD - Never use 'as any'
const data = response.data as any;

// BAD - Never create duplicate types
interface MyModuleStatus { ... } // Already exists as $Enums.ModuleStatus
```

### ✅ ALWAYS USE:

#### For Prisma Enums:
```typescript
import { $Enums } from '../lib/prisma';

// Use Prisma's generated enum
const status: $Enums.ModuleStatus = $Enums.ModuleStatus.ENABLED;

// When filtering/updating
where.status = status as unknown as $Enums.ModuleStatus;
```

#### For JSON Fields:
```typescript
import { Prisma } from '../lib/prisma';

// Storing JSON in database
await prisma.event.create({
  data: {
    payload: eventPayload as Prisma.InputJsonValue,
  }
});
```

#### For Type Conversion:
```typescript
// When Prisma model ≠ TypeScript interface
const job = prismaJob as unknown as Job;
```

#### For Extending Library Types:
```typescript
// In types/fastify.d.ts
declare module 'fastify' {
  interface FastifySchema {
    description?: string;
    tags?: string[];
  }
}
```

---

## 6. Backend Development

### Route Patterns

```typescript
// All routes follow this pattern
app.get<{ Params: ParamsType; Querystring: QueryType }>(
  '/path/:id',
  {
    schema: {
      description: 'Route description for docs',
      tags: ['category'],
      params: { /* JSON Schema */ },
      response: { 200: { /* JSON Schema */ } }
    }
  },
  async (request, reply) => {
    // Handler implementation
  }
);
```

### Error Handling

```typescript
import { ERROR_MESSAGES } from '../config/constants';

// Use predefined error messages
if (!resource) {
  return reply.status(404).send({
    success: false,
    error: {
      message: ERROR_MESSAGES.RESOURCE_NOT_FOUND,
      statusCode: 404
    }
  });
}
```

### Response Format

```typescript
// Success response
return reply.send({
  success: true,
  data: result,
  meta: { total: count }
});

// Error response
return reply.status(400).send({
  success: false,
  error: {
    message: 'Error description',
    statusCode: 400,
    details: validationErrors // optional
  }
});
```

---

## 7. Frontend Development

### API Calls with TanStack Query

```typescript
// Define query
const { data, isLoading, error } = useQuery({
  queryKey: ['jobs', filters],
  queryFn: () => api.get('/api/v1/jobs', { params: filters })
});

// Define mutation
const mutation = useMutation({
  mutationFn: (data) => api.post('/api/v1/jobs', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['jobs'] });
    toast.success('Job created');
  }
});
```

### Component Patterns

```typescript
// Prefer functional components with TypeScript interfaces
interface JobCardProps {
  job: Job;
  onEdit: (id: string) => void;
}

export function JobCard({ job, onEdit }: JobCardProps) {
  return (
    <Card>
      {/* Implementation */}
    </Card>
  );
}
```

### State Management

```typescript
// Use Zustand for global state
import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
```

---

## 8. Module Development

### Module Structure

Every new feature MUST be a module:

```
modules/my-module/
├── manifest.json        # Required - Module definition
├── src/
│   └── index.ts        # Backend entry point (Fastify plugin)
├── package.json        # Module dependencies
└── tsconfig.json       # TypeScript config

packages/frontend/src/modules/my-module/
├── pages/
│   └── Dashboard.tsx   # Module pages
├── components/         # Module-specific components
├── hooks/              # Module-specific hooks
└── api.ts              # API client for module endpoints
```

### manifest.json Template

```json
{
  "name": "my-module",
  "version": "1.0.0",
  "displayName": "My Module",
  "description": "Module description",
  "author": "NxForge Team",
  "backend": {
    "entry": "./dist/index.js"
  },
  "jobs": [
    {
      "name": "my-job",
      "handler": "handleMyJob",
      "schedule": "0 */5 * * *",
      "description": "Job description"
    }
  ],
  "ui": {
    "entry": "./dist/index.js",
    "sidebar": [
      {
        "label": "My Module",
        "icon": "Monitor",
        "path": "/my-module"
      }
    ]
  },
  "permissions": ["read:data", "write:data"],
  "settings": {
    "apiKey": {
      "type": "password",
      "label": "API Key",
      "required": true
    }
  }
}
```

### Backend Module Entry Point

```typescript
// modules/my-module/src/index.ts
import type { FastifyPluginAsync } from 'fastify';
import type { JobContext } from '@nxforge/backend/types/job.types';

// Job handler - receives full context with services
export async function handleMyJob(context: JobContext): Promise<void> {
  const { services, module, job } = context;
  const { browser, http, notifications, prisma, logger } = services;
  
  // Use provided services - DO NOT create new instances
  const session = await browser.createSession();
  const page = await session.newPage();
  
  try {
    // Job implementation
    await page.goto('https://example.com');
    
    logger.info('Job completed', { jobId: job.id });
  } finally {
    await session.close();
  }
}

// API routes plugin
const plugin: FastifyPluginAsync = async (app) => {
  // Routes are automatically prefixed with /api/v1/m/my-module/
  
  app.get('/status', async (request, reply) => {
    return { status: 'ok' };
  });
  
  app.post('/action', async (request, reply) => {
    // Implementation
    return { success: true };
  });
};

export default plugin;
```

### Frontend Module API Client

```typescript
// packages/frontend/src/modules/my-module/api.ts
import { api } from '@/services/api';

const BASE_URL = '/api/v1/m/my-module';

export const myModuleApi = {
  getStatus: () => api.get(`${BASE_URL}/status`),
  
  performAction: (data: ActionData) => 
    api.post(`${BASE_URL}/action`, data),
    
  // ... other endpoints
};
```

---

## 9. Anti-Patterns to Avoid

### ❌ DO NOT:

1. **Create new core services**
   ```typescript
   // BAD - Don't add new services to core
   // packages/backend/src/services/my-new-service.ts
   ```

2. **Duplicate existing functionality**
   ```typescript
   // BAD - browserService already exists (uses Playwright internally)
   import { chromium } from 'playwright';
   const browser = await chromium.launch();
   ```

3. **Create database connections**
   ```typescript
   // BAD - Use existing prisma instance
   const prisma = new PrismaClient();
   ```

4. **Define duplicate types**
   ```typescript
   // BAD - ModuleStatus already exists in $Enums
   enum ModuleStatus { ENABLED = 'ENABLED', ... }
   ```

5. **Use `as any`**
   ```typescript
   // BAD
   const data = response as any;
   
   // GOOD
   const data = response as unknown as ExpectedType;
   ```

6. **Import between modules**
   ```typescript
   // BAD - Modules must be isolated
   import { helper } from '../other-module/utils';
   ```

7. **Modify Prisma schema for module data**
   ```typescript
   // BAD - Don't add module tables to core schema
   // Use the module's own migrations directory
   ```

### ✅ DO:

1. **Check existing services first**
2. **Use JobContext services in job handlers**
3. **Export Fastify plugin from module entry**
4. **Use Prisma types from `@prisma/client`**
5. **Follow existing patterns in codebase**

---

## 10. Code Examples

### Creating a New Module (Complete Example)

#### 1. Create manifest
```json
// modules/ups-monitor/manifest.json
{
  "name": "ups-monitor",
  "version": "1.0.0",
  "displayName": "UPS Monitor",
  "description": "Monitor UPS battery status and alerts",
  "author": "NxForge Team",
  "backend": {
    "entry": "./dist/index.js"
  },
  "jobs": [
    {
      "name": "check-ups-status",
      "handler": "checkUpsStatus",
      "schedule": "*/5 * * * *",
      "description": "Check UPS status every 5 minutes"
    }
  ],
  "ui": {
    "sidebar": [
      {
        "label": "UPS Monitor",
        "icon": "Battery",
        "path": "/ups-monitor"
      }
    ]
  }
}
```

#### 2. Create backend entry
```typescript
// modules/ups-monitor/src/index.ts
import type { FastifyPluginAsync } from 'fastify';
import type { JobContext } from '@nxforge/backend/types/job.types';

export async function checkUpsStatus(context: JobContext): Promise<void> {
  const { services, module, logger } = context;
  const { http, notifications, prisma } = services;
  
  // Get UPS endpoints from module config
  const config = module.config as { endpoints: string[] };
  
  for (const endpoint of config.endpoints) {
    try {
      const status = await http.get(endpoint);
      
      // Store in module's own table (via module migrations)
      // Process status...
      
      if (status.data.battery < 20) {
        await notifications.email({
          to: 'admin@example.com',
          subject: 'UPS Battery Low',
          body: `UPS at ${endpoint} has ${status.data.battery}% battery`
        });
      }
    } catch (error) {
      logger.error('Failed to check UPS', { endpoint, error });
    }
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => {
    // Return current UPS statuses
  });
};

export default plugin;
```

#### 3. Create frontend page
```typescript
// packages/frontend/src/modules/ups-monitor/pages/Dashboard.tsx
import { useQuery } from '@tanstack/react-query';
import { upsMonitorApi } from '../api';

export function UpsMonitorDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['ups-status'],
    queryFn: upsMonitorApi.getStatus,
    refetchInterval: 30000
  });
  
  if (isLoading) return <Spinner />;
  
  return (
    <div className="grid gap-4">
      {data?.devices.map(device => (
        <UpsCard key={device.id} device={device} />
      ))}
    </div>
  );
}
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│                    BEFORE YOU CODE                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Is this a module feature?      → modules/{name}/         │
│ 2. Does a service exist?          → Check Section 4         │
│ 3. Does a type exist?             → Check types/*.ts        │
│ 4. Does a utility exist?          → Check utils/*.ts        │
├─────────────────────────────────────────────────────────────┤
│                    TYPE SAFETY                              │
├─────────────────────────────────────────────────────────────┤
│ • Prisma enums      → $Enums.ModuleStatus                   │
│ • JSON storage      → Prisma.InputJsonValue                 │
│ • Type conversion   → as unknown as TargetType              │
│ • No `any`          → Use proper types or unknown           │
├─────────────────────────────────────────────────────────────┤
│                    FILE LOCATIONS                           │
├─────────────────────────────────────────────────────────────┤
│ • New module backend:  modules/{name}/src/index.ts          │
│ • New module frontend: packages/frontend/src/modules/{name} │
│ • Core is FROZEN:      packages/backend/src/*               │
└─────────────────────────────────────────────────────────────┘
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-18 | Initial document |

---

*This document should be provided at the start of every AI development session.*
