# Module Development Guide

## Overview

NxForge uses a modular architecture that allows you to extend the platform with custom functionality. Modules can provide backend APIs, frontend UI, background jobs, and database migrations.

## Module Structure

```
modules/
└── your-module/
    ├── manifest.json           # Module metadata and configuration
    ├── backend/
    │   ├── index.ts           # Entry point (MUST export Fastify plugin as default)
    │   ├── routes/            # Route handlers
    │   └── services/          # Business logic
    └── migrations/            # Database migration SQL files

packages/frontend/src/modules/
└── your-module/               # Frontend code (separate location!)
    ├── components/
    ├── pages/
    └── api/
```

**CRITICAL**: Frontend code MUST be placed in `packages/frontend/src/modules/{module-name}/` (NOT in the `modules/` directory). This is the ONLY location for frontend code. Do not create duplicate frontend directories inside `modules/` as it will cause confusion and deployment issues.

**Why separate locations?**
- Backend code in `modules/` is dynamically loaded at runtime
- Frontend code in `packages/frontend/src/modules/` is bundled by Vite and has access to shared React dependencies
- This architecture prevents code duplication and ensures proper dependency resolution

## Plugin-Based Route Registration

All modules MUST use the plugin-based approach. The entry point must export a Fastify plugin as the default export.

**manifest.json:**
```json
{
  "name": "my-module",
  "version": "1.0.0",
  "displayName": "My Module",
  "description": "Module description",
  "author": "Your Name",
  "entry": "backend/index.ts",
  "routes": [],
  "jobs": {},
  ...
}
```

**backend/index.ts:**
```typescript
import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { myRoutes } from './routes/my.routes';
import { otherRoutes } from './routes/other.routes';

const plugin: FastifyPluginCallback = async (app: FastifyInstance) => {
  // Register routes with internal prefixes
  // Routes will be available at /api/v1/m/my-module/{prefix}/*
  await app.register(myRoutes, { prefix: '/my-feature' });
  await app.register(otherRoutes, { prefix: '/other' });

  console.log('[My Module] Initialized');
};

export default plugin;
```

**Routes registered at:** `/api/v1/m/my-module/*`

For example:
- Plugin registered at: `/api/v1/m/my-module`
- Routes with `/my-feature` prefix: `/api/v1/m/my-module/my-feature/*`
- Routes with `/other` prefix: `/api/v1/m/my-module/other/*`

## Why Plugin-Based Only?

The plugin-based approach provides:
- **Full control** over route organization and structure
- **Access to Fastify features** like decorators, hooks, and nested plugins
- **Better scalability** for modules with multiple features
- **Consistent architecture** across all modules
- **Type safety** with proper TypeScript support

## Module Loader Behavior

The module loader:

1. **Loads entry point**: Imports the file specified in `manifest.entry`
2. **Validates plugin export**: Checks that the default export is a function (Fastify plugin)
3. **Registers plugin**: Calls `app.register(plugin, { prefix: '/api/v1/m/{module-name}' })`
4. **Throws error if invalid**: If no plugin is exported, throws a clear error message

The `routes` field in manifest.json must be an empty array `[]` (required by schema, but not used).

## Best Practices

### Route Organization
- ✅ Organize routes into logical groups (e.g., `/documents`, `/categories`, `/settings`)
- ✅ Use Fastify's plugin system for modularity
- ✅ Keep route handlers focused and testable
- ✅ Use TypeScript for type safety

### Frontend Code
- ✅ Place frontend code in `packages/frontend/src/modules/{module-name}/`
- ✅ This ensures access to shared dependencies (React, React Query, etc.)
- ✅ Use relative imports for API clients: `import { apiClient } from '../../../api/client'`
- ✅ Export pages as default for lazy loading: `export default MyPage;`

### API Paths
- ✅ Frontend API calls should use `/m/{module-name}/...` prefix
- ✅ Example: `apiClient.get('/m/documentation-manager/categories')`
- ❌ Don't hardcode full URLs with domain
- ❌ Don't use absolute `/api/v1/` prefix (apiClient handles this automatically)

## Example: Documentation Manager Module

See [modules/documentation-manager/](../modules/documentation-manager/) for a complete working example.

**Key files:**
- [manifest.json](../modules/documentation-manager/manifest.json) - Module metadata with `routes: []`
- [backend/index.ts](../modules/documentation-manager/backend/index.ts) - Exports Fastify plugin
- [backend/routes/*.routes.ts](../modules/documentation-manager/backend/routes/) - Route handlers organized by resource
- [packages/frontend/src/modules/documentation-manager/](../packages/frontend/src/modules/documentation-manager/) - Frontend code

**Route structure:**
```
/api/v1/m/documentation-manager
  ├── /documents (GET, POST, PUT, DELETE)
  ├── /categories (GET, POST, PUT, DELETE)
  └── /folders (GET, POST, PUT, DELETE)
```

## Manifest Schema

See [packages/backend/src/types/module.types.ts](../packages/backend/src/types/module.types.ts) for the complete TypeScript interface and detailed field documentation.

**Required fields:**
- `name` - Unique module identifier (kebab-case)
- `version` - Semantic version (e.g., "1.0.0")
- `displayName` - Human-readable name
- `description` - Short description
- `author` - Author name or organization
- `entry` - Path to backend entry point
- `routes` - Must be `[]` (empty array)
- `jobs` - Job definitions or `{}` (empty object)

## Module Lifecycle

1. **Registration**: Module manifest validated and added to database
2. **Installation**: Database migrations executed (if defined in `migrations` field)
3. **Loading**: Module loader imports entry point on server start
4. **Validation**: Checks that entry point exports a Fastify plugin as default
5. **Activation**: Plugin registered at `/api/v1/m/{module-name}`
6. **Runtime**: Module handles incoming requests
7. **Disabling**: Module status changed to disabled (routes inactive)

## Troubleshooting

**Error: "Module entry point must export a Fastify plugin as default"**
- Ensure `backend/index.ts` has `export default plugin;`
- Verify the plugin follows the `FastifyPluginCallback` signature
- Check there are no syntax errors in the entry point file

**Routes return 404:**
- Check backend logs for module loading errors
- Verify the module status is `ENABLED` in the database
- Restart backend server after making changes
- Check that API paths in frontend use `/m/{module-name}/` prefix

**Frontend can't import dependencies:**
- Ensure frontend code is in `packages/frontend/src/modules/{module-name}/`
- Check relative import paths (e.g., `'../../../api/client'`)
- Verify dependencies are installed in the frontend package
- Run `npm install` in the frontend directory if needed

**Module not in sidebar:**
- Check `manifest.ui.sidebar` configuration includes required fields
- Verify `manifest.ui.sidebar.children` is an array (even if empty)
- Ensure module status is `ENABLED` in the database
- Clear browser cache and reload the frontend

**TypeScript errors in module code:**
- Ensure your module's TypeScript config extends the main config
- Check that shared types are properly imported
- Verify all dependencies have type definitions installed
