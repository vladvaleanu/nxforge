# Phase 2: Module Registry - Setup Instructions

## What We've Built

### 1. Module System Architecture ✅

**Type Definitions** - [packages/backend/src/types/module.types.ts](packages/backend/src/types/module.types.ts)
- Complete TypeScript types for module manifests
- Route, job, event, and UI component definitions
- Configuration schema with validation rules
- Module dependency tracking

**Manifest Validator** - [packages/backend/src/services/module-validator.service.ts](packages/backend/src/services/module-validator.service.ts)
- JSON Schema validation using AJV
- Semantic version validation
- Dependency version range validation
- Route conflict detection
- Config type validation

**Module Registry Service** - [packages/backend/src/services/module-registry.service.ts](packages/backend/src/services/module-registry.service.ts)
- Module registration and storage
- Version management
- Dependency tracking
- Status management (REGISTERED, ENABLED, DISABLED, etc.)
- Configuration management

**API Routes** - [packages/backend/src/routes/modules.routes.ts](packages/backend/src/routes/modules.routes.ts)
- `GET /api/v1/modules` - List all modules
- `GET /api/v1/modules/:name` - Get module details
- `POST /api/v1/modules` - Register a new module
- `PUT /api/v1/modules/:name/status` - Update module status
- `PUT /api/v1/modules/:name/config` - Update module configuration
- `DELETE /api/v1/modules/:name` - Remove a module
- `POST /api/v1/modules/validate` - Validate a manifest

### 2. Database Schema Updates ✅

**Enhanced Module Table** - [packages/backend/prisma/schema.prisma](packages/backend/prisma/schema.prisma)
- Added `author` field
- Added `config` JSON field for user configuration
- Added `path` field for module file location
- Added dependency relations

**New ModuleDependency Table**
- Tracks module-to-module dependencies
- Version range support for semantic versioning
- Cascade delete on dependent module removal
- Restrict delete if other modules depend on it

## Setup Steps (Run in Codespaces)

### Step 1: Install Dependencies

```bash
cd packages/backend
npm install
```

This will install the new packages:
- `ajv` - JSON Schema validator
- `ajv-formats` - Format validators for AJV
- `semver` - Semantic versioning utilities
- `@types/semver` - TypeScript types for semver

### Step 2: Create and Run Database Migration

```bash
# Generate the migration
npx prisma migrate dev --name add_module_registry_enhancements

# This will:
# 1. Create a new migration file
# 2. Apply it to the database
# 3. Regenerate Prisma client
```

### Step 3: Restart Backend Server

```bash
# If backend is already running, restart it
# Press Ctrl+C to stop
npm run dev
```

### Step 4: Test the Module Registry API

#### Test 1: Validate a Module Manifest

```bash
curl -X POST https://literate-space-funicular-76q945w7qjcx5xp-4000.app.github.dev/api/v1/modules/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "manifest": {
      "name": "example-module",
      "version": "1.0.0",
      "displayName": "Example Module",
      "description": "A test module",
      "author": "Test Author",
      "capabilities": {
        "api": {
          "routes": [
            {
              "method": "GET",
              "path": "/hello",
              "handler": "handlers/hello.ts"
            }
          ]
        }
      }
    }
  }'
```

#### Test 2: Register a Module

```bash
curl -X POST https://literate-space-funicular-76q945w7qjcx5xp-4000.app.github.dev/api/v1/modules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "manifest": {
      "name": "example-module",
      "version": "1.0.0",
      "displayName": "Example Module",
      "description": "A test module for demonstration",
      "author": "Automation Platform Team",
      "capabilities": {
        "api": {
          "routes": [
            {
              "method": "GET",
              "path": "/status",
              "handler": "handlers/status.ts"
            }
          ]
        }
      }
    }
  }'
```

#### Test 3: List All Modules

```bash
curl -X GET https://literate-space-funicular-76q945w7qjcx5xp-4000.app.github.dev/api/v1/modules \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Test 4: Get Module Details

```bash
curl -X GET https://literate-space-funicular-76q945w7qjcx5xp-4000.app.github.dev/api/v1/modules/example-module \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Test 5: Update Module Status

```bash
curl -X PUT https://literate-space-funicular-76q945w7qjcx5xp-4000.app.github.dev/api/v1/modules/example-module/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "status": "ENABLED"
  }'
```

## Module Manifest Structure

Here's a complete example of a module manifest:

```json
{
  "name": "vmware-vcenter",
  "version": "1.0.0",
  "displayName": "VMware vCenter Module",
  "description": "Manage VMware vCenter infrastructure",
  "author": "Automation Platform Team",
  "license": "MIT",

  "capabilities": {
    "api": {
      "routes": [
        {
          "method": "GET",
          "path": "/vms",
          "handler": "handlers/list-vms.ts",
          "permissions": ["vmware:read"]
        },
        {
          "method": "POST",
          "path": "/vms",
          "handler": "handlers/create-vm.ts",
          "permissions": ["vmware:write"]
        }
      ]
    },

    "jobs": {
      "handlers": [
        {
          "name": "sync-inventory",
          "handler": "jobs/sync-inventory.ts",
          "schedule": "0 */6 * * *",
          "timeout": 300000,
          "retries": 3
        }
      ]
    },

    "ui": {
      "pages": [
        {
          "path": "/vmware",
          "component": "pages/VMwareDashboard.tsx",
          "title": "VMware vCenter",
          "icon": "server",
          "permissions": ["vmware:read"]
        }
      ],
      "navigation": [
        {
          "label": "VMware",
          "path": "/vmware",
          "icon": "server",
          "order": 10
        }
      ]
    }
  },

  "dependencies": {
    "modules": {
      "core-auth": "^1.0.0"
    },
    "npm": {
      "vmware-rest-api": "^2.0.0"
    },
    "system": {
      "node": ">=20.0.0"
    }
  },

  "config": {
    "schema": {
      "vcenterHost": {
        "type": "string",
        "label": "vCenter Host",
        "description": "vCenter server hostname or IP",
        "required": true
      },
      "vcenterUsername": {
        "type": "string",
        "label": "vCenter Username",
        "required": true
      },
      "vcenterPassword": {
        "type": "password",
        "label": "vCenter Password",
        "required": true,
        "sensitive": true
      },
      "syncInterval": {
        "type": "number",
        "label": "Sync Interval (hours)",
        "default": 6,
        "validation": {
          "min": 1,
          "max": 24
        }
      }
    },
    "defaults": {
      "syncInterval": 6
    }
  },

  "permissions": [
    "vmware:read",
    "vmware:write",
    "vmware:delete"
  ],

  "metadata": {
    "homepage": "https://github.com/yourorg/vmware-module",
    "repository": "https://github.com/yourorg/vmware-module",
    "tags": ["vmware", "virtualization", "infrastructure"],
    "category": "infrastructure"
  }
}
```

## Module Status Flow

Modules go through these states:

1. **REGISTERED** - Manifest validated and stored in registry
2. **INSTALLING** - Dependencies being installed (Phase 2, next step)
3. **ENABLED** - Module is active and routes/jobs are registered
4. **DISABLED** - Module installed but not active
5. **UPDATING** - New version being installed
6. **REMOVING** - Module being uninstalled

## What's Next

Phase 2 continues with:
- **Module lifecycle management** - Install, enable, disable, remove
- **Dynamic route registration** - Load module API routes at runtime
- **Frontend module loading** - Lazy load module UI components
- **Module sandboxing** - Isolate module execution

## API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/modules` | List all modules | ✅ |
| GET | `/api/v1/modules/:name` | Get module details | ✅ |
| POST | `/api/v1/modules` | Register new module | ✅ |
| POST | `/api/v1/modules/validate` | Validate manifest | ✅ |
| PUT | `/api/v1/modules/:name/status` | Update module status | ✅ |
| PUT | `/api/v1/modules/:name/config` | Update module config | ✅ |
| DELETE | `/api/v1/modules/:name` | Remove module | ✅ |

## Files Created

```
packages/backend/
├── src/
│   ├── types/
│   │   └── module.types.ts          # Module type definitions
│   ├── services/
│   │   ├── module-validator.service.ts   # Manifest validation
│   │   └── module-registry.service.ts    # Module registry logic
│   └── routes/
│       └── modules.routes.ts         # Module API endpoints
├── prisma/
│   └── schema.prisma                 # Updated with ModuleDependency
└── package.json                      # Added ajv, semver packages
```

---

**Status**: Phase 2 - Step 1 (Module Registry) Complete ✅

Next: Install dependencies and run migration in Codespaces.
