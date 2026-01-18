# NxForge Development Guidelines

> **Version**: 5.1.0  
> **Last Updated**: 2026-01-18  
> **Purpose**: Core architectural principles and development standards for NxForge platform

---

## Project Overview

**NxForge** is a modular data center automation platform for colocation providers. It automates operations through independent, hot-pluggable modules that can interact when needed.

### Core Philosophy

> [!IMPORTANT]
> The core platform architecture must be **impeccable and stable**. All development, debugging, and modifications should happen **at the module level**, never in the core.

---

## Architecture Principles

### 1. Single Source of Truth

| Type of Code | Location | Description |
|--------------|----------|-------------|
| **Types** | `packages/backend/src/types/` | All TypeScript type definitions |
| **Services** | `packages/backend/src/services/` | Core platform services |
| **Database Schema** | `packages/backend/prisma/schema.prisma` | Prisma schema is authoritative |
| **Module Backend** | `modules/{name}/backend/` | Module-specific backend code |
| **Module Frontend** | `packages/frontend/src/modules/{name}/` | Module-specific frontend code |

### 2. Module Isolation Guarantees

```
┌─────────────────────────────────────────────────────────┐
│                    CORE PLATFORM                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Services: auth, jobs, events, modules           │   │
│  │  Database: Prisma + PostgreSQL                   │   │
│  │  API: Fastify routes                             │   │
│  └──────────────────────────────────────────────────┘   │
│                         │                               │
│                   ModuleContext                         │
│                         ▼                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ Module A │    │ Module B │    │ Module C │          │
│  └──────────┘    └──────────┘    └──────────┘          │
└─────────────────────────────────────────────────────────┘
```

**Rules:**
- Modules receive services via `ModuleContext` - never import directly
- Modules export a Fastify plugin as default from `backend/index.ts`
- Module routes are prefixed at `/api/v1/m/{module-name}/`
- Frontend code MUST be in `packages/frontend/src/modules/{name}/`

### 3. Type Organization

```typescript
// packages/backend/src/types/
├── module.types.ts    // Module manifest, context, lifecycle
├── job.types.ts       // Job execution, scheduling, events
└── internal.types.ts  // Backend-only types (if needed)

// packages/frontend/src/types/
└── module.types.ts    // Frontend subset of module types
```

**DO NOT:**
- ❌ Duplicate type definitions
- ❌ Create types in multiple locations
- ❌ Define database enums separately from Prisma

**DO:**
- ✅ Import from single source
- ✅ Use re-exports for convenience: `export type { X } from './other.js'`
- ✅ Keep Prisma schema as source of truth for DB types

---

## Development Workflow

### Adding a New Module

1. **Create module structure:**
```bash
modules/
└── my-module/
    ├── manifest.json
    ├── backend/
    │   ├── index.ts      # Exports Fastify plugin
    │   └── routes/       # Route handlers
    └── migrations/       # SQL migrations (if needed)

packages/frontend/src/modules/
└── my-module/
    ├── pages/            # Page components
    ├── components/       # Module components
    └── api/              # API client
```

2. **Create manifest.json:**
```json
{
  "name": "my-module",
  "version": "1.0.0",
  "displayName": "My Module",
  "description": "Module description",
  "author": "NxForge Team",
  "entry": "backend/index.ts",
  "routes": [],
  "jobs": {},
  "ui": {
    "sidebar": { "label": "My Module", "icon": "Star", "children": [] },
    "routes": []
  }
}
```

3. **Export Fastify plugin:**
```typescript
// backend/index.ts
import { FastifyInstance, FastifyPluginCallback } from 'fastify';

const plugin: FastifyPluginCallback = async (app: FastifyInstance) => {
  app.get('/health', async () => ({ status: 'ok' }));
  console.log('[My Module] Initialized');
};

export default plugin;
```

### Modifying Core Platform

> [!CAUTION]
> Only modify core when absolutely necessary. Document all changes thoroughly.

**Before modifying core:**
1. Verify the change cannot be done at module level
2. Consider backward compatibility
3. Update this guidelines document if patterns change
4. Add tests for any new functionality

---

## Database Guidelines

### Schema Changes

1. **Always use Prisma migrations:**
```bash
cd packages/backend
npx prisma migrate dev --name descriptive_name
```

2. **Enum changes require special handling:**
```sql
-- Adding values to existing enum
ALTER TYPE "EnumName" ADD VALUE IF NOT EXISTS 'NEW_VALUE';
```

3. **Never manually define DB enums in TypeScript** - let Prisma generate them

### Module Migrations

- Place in `modules/{name}/migrations/`
- Name format: `001_description.sql`, `002_next_change.sql`
- Core runs these automatically on module enable

---

## API Design Standards

### Route Structure

```
/api/v1/                          # Core API prefix
├── auth/                         # Authentication
├── modules/                      # Module management
├── jobs/                         # Job scheduling
├── events/                       # Event system
└── m/{module-name}/              # Module-specific routes
    └── {module-routes}
```

### Response Format

```typescript
// Success
{ data: T, meta?: { count, page, ... } }

// Error
{ error: string, message: string, statusCode: number }
```

---

## Frontend Standards

### Component Organization

```
packages/frontend/src/
├── components/           # Shared UI components
├── pages/                # Core platform pages
├── modules/              # Module frontends (isolated)
│   └── {module-name}/
├── api/                  # API clients
├── hooks/                # Shared hooks
└── utils/                # Utilities
```

### Module Frontend Rules

- Use relative imports: `import { apiClient } from '../../../api/client'`
- Export pages as default for lazy loading
- API calls use `/m/{module-name}/` prefix

---

## Performance Requirements

| Metric | Target |
|--------|--------|
| API Response Time (p95) | < 50ms |
| Route Resolution | O(1) via Map |
| Concurrent Users | ~50 |
| Endpoints Monitored | ~500 |

---

## Testing Requirements

### Before Merging

- [ ] TypeScript compiles without errors
- [ ] Existing tests pass
- [ ] New functionality has tests
- [ ] Manual testing of affected features

### Test Commands

```bash
# Backend
cd packages/backend
npm test

# Frontend
cd packages/frontend
npm test

# Type checking
npm run typecheck
```

---

## Quick Reference

### Key Files

| Purpose | Location |
|---------|----------|
| Prisma Schema | `packages/backend/prisma/schema.prisma` |
| Backend Types | `packages/backend/src/types/` |
| Module Loader | `packages/backend/src/services/module-loader.service.ts` |
| App Entry | `packages/backend/src/app.ts` |
| Frontend App | `packages/frontend/src/App.tsx` |

### Commands

```bash
# Start development
docker-compose up -d          # Start DB & Redis
cd packages/backend && npm run dev
cd packages/frontend && npm run dev

# Database
npm run prisma:migrate        # Create migration
npm run prisma:push           # Push schema (dev)
npm run prisma:studio         # Open GUI

# Build
npm run build                 # Build all packages
npm run typecheck             # Type check all
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.1.0 | 2026-01-18 | Removed unused packages, consolidated types, added missing ModuleStatus values |
| 5.0.0 | 2026-01-15 | Phase 5 complete - Frontend polish |
| 4.0.0 | 2026-01-10 | Phase 4 complete - Consumption Monitor |
