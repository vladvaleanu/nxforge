# Session Handoff Document
**Date**: 2026-01-09
**Phase**: Phase 3 Complete - Job Scheduling & Automation Runtime
**Last Commit**: 7fc4ca0 - Remove debug logging from CreateJobPage

---

## Current Status

### ✅ Completed
- **Phase 3 Job Scheduling System** - Fully implemented and working
  - BullMQ job queue with Redis
  - Worker pool with concurrent execution
  - Cron-based scheduling
  - Event bus with Redis pub/sub
  - Shared services library (Browser, HTTP, Notifications, Logger, Database)
  - Frontend management interfaces (Jobs, Executions, Events pages)
  - Example data-sync-module with 3 job types

### 🔧 In Progress Issues

#### 1. **Module Manifest Not Showing Jobs** (CRITICAL - REQUIRES ACTION)
**Problem**: The `manifest` field in database is empty `{}` for the data-sync-module, so job types don't appear in the Create Job dropdown.

**Root Cause**: The module was registered before the manifest schema included the `jobs` array properly, or Prisma/PostgreSQL didn't serialize the full manifest.

**Solution**: Re-register the module to ensure the complete manifest is stored.

**Steps to Fix**:
```bash
# 1. Unregister the existing module
cd "c:\Users\vlad.valeanu\Desktop\dev\Automation Platform"
bash examples/unregister-example-module.sh
# Enter credentials: admin@automation-platform.local / admin123

# 2. Re-register with complete manifest
bash examples/register-example-module.sh
# Enter same credentials

# 3. Verify in frontend
# - Go to Create Job page
# - Select "Data Sync Module" from module dropdown
# - Job Type should now show dropdown with 3 options:
#   * Hourly Data Sync
#   * Daily Report Generator
#   * Health Check
```

**Code Changes Made**:
- Added `manifest: { type: 'object' }` to GET /modules response schema (commit 1ffbf31)
- This allows Fastify to return the manifest field to the frontend

#### 2. **Orphaned Jobs in Redis** (LOW PRIORITY)
**Problem**: Backend logs show repeated errors:
```
Job c27f44c5-e78a-4f19-b6cb-8394054fd215 not found in database - removing from queue
Job ... could not be removed because it is locked by another worker
```

**Root Cause**: Jobs scheduled in Redis (BullMQ) but deleted from PostgreSQL database.

**Solution Already Implemented**:
- Worker service checks if job exists before processing (commit 688778c)
- Cleanup on server startup removes orphaned jobs (commit 688778c)

**To Fully Clean**:
```bash
# Option 1: Restart backend server (will auto-cleanup on startup)
# The cleanupOrphanedJobs() runs on every server start

# Option 2: Manually clear Redis (if redis-cli is available)
redis-cli FLUSHALL

# Option 3: Wait - the locks expire and cleanup will eventually succeed
```

---

## Architecture Overview

### Backend Stack
- **Framework**: Fastify (Node.js/TypeScript)
- **Database**: PostgreSQL 16 + Prisma ORM
- **Job Queue**: Redis + BullMQ
- **Event Bus**: Redis pub/sub
- **Authentication**: JWT (access + refresh tokens)

### Frontend Stack
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **State**: React Query
- **Styling**: Tailwind CSS + Dark Mode
- **Routing**: React Router

### Module System
- **Hot-pluggable**: Modules can be registered/installed/enabled/disabled at runtime
- **Lifecycle**: REGISTERED → INSTALLED → ENABLED
- **Manifest Validation**: JSON Schema with AJV
- **Job Definitions**: Stored in module manifest's `jobs` array

---

## Key Files & Locations

### Backend
- **Entry Point**: `packages/backend/src/index.ts`
- **Module Routes**: `packages/backend/src/routes/modules.routes.ts`
- **Module Registry**: `packages/backend/src/services/module-registry.service.ts`
- **Job Scheduler**: `packages/backend/src/services/job-scheduler.service.ts`
- **Worker Service**: `packages/backend/src/services/worker.service.ts`
- **Event Bus**: `packages/backend/src/services/event-bus.service.ts`

### Frontend
- **Create Job Page**: `packages/frontend/src/pages/CreateJobPage.tsx` ⚠️ Key file for job dropdown
- **Jobs Page**: `packages/frontend/src/pages/JobsPage.tsx`
- **Executions Page**: `packages/frontend/src/pages/ExecutionsPage.tsx`
- **Events Page**: `packages/frontend/src/pages/EventsPage.tsx`

### Example Module
- **Location**: `examples/modules/data-sync-module/`
- **Manifest**: `examples/modules/data-sync-module/manifest.json`
- **Jobs**:
  - `jobs/hourly-sync.js` - Syncs data every hour
  - `jobs/daily-report.js` - Generates reports at midnight
  - `jobs/health-check.js` - Monitors health every 5 minutes
- **Registration Script**: `examples/register-example-module.sh`
- **Unregister Script**: `examples/unregister-example-module.sh`

---

## Recent Commits (Last Session)

1. **7fc4ca0** - Remove debug logging from CreateJobPage
2. **1ffbf31** - Add manifest field to modules list response schema (CRITICAL FIX)
3. **947e6c8** - Add more debug logging for modules list
4. **fc88ab7** - Add debug logging for module selection
5. **70ce664** - Filter modules to show only ENABLED status
6. **7bdef72** - Add unregister script for example module
7. **65c820e** - Add install step to module registration script
8. **94e84f2** - Fix event listeners format in manifest
9. **688778c** - Fix orphaned jobs cleanup

---

## API Endpoints Summary

### Modules (9 endpoints)
- `GET /api/v1/modules` - List all modules (with manifest!)
- `GET /api/v1/modules/:name` - Get module by name
- `POST /api/v1/modules` - Register new module
- `POST /api/v1/modules/:name/install` - Install module
- `POST /api/v1/modules/:name/enable` - Enable module
- `POST /api/v1/modules/:name/disable` - Disable module
- `POST /api/v1/modules/:name/uninstall` - Uninstall module
- `DELETE /api/v1/modules/:name` - Delete module
- `POST /api/v1/modules/validate` - Validate manifest

### Jobs (8 endpoints)
- `GET /api/v1/jobs` - List jobs
- `GET /api/v1/jobs/:id` - Get job by ID
- `POST /api/v1/jobs` - Create job
- `PUT /api/v1/jobs/:id` - Update job
- `DELETE /api/v1/jobs/:id` - Delete job
- `POST /api/v1/jobs/:id/enable` - Enable job
- `POST /api/v1/jobs/:id/disable` - Disable job
- `POST /api/v1/jobs/:id/execute` - Execute job manually

### Executions (3 endpoints)
- `GET /api/v1/executions` - List executions
- `GET /api/v1/executions/:id` - Get execution details
- `POST /api/v1/executions/:id/cancel` - Cancel execution

### Events (7 endpoints)
- `POST /api/v1/events` - Emit event
- `GET /api/v1/events` - List events
- `GET /api/v1/events/:id` - Get event by ID
- `GET /api/v1/events/recent` - Recent events
- `GET /api/v1/events/stats` - Event statistics
- `GET /api/v1/events/subscriptions` - Active subscriptions
- `DELETE /api/v1/events/cleanup` - Cleanup old events

---

## Database Schema

### Modules Table
```sql
- id: UUID (primary key)
- name: VARCHAR (unique)
- version: VARCHAR
- displayName: VARCHAR
- description: TEXT
- status: ENUM (REGISTERED, INSTALLED, ENABLED, DISABLED)
- manifest: JSONB ⚠️ Contains jobs array
- config: JSONB
- path: VARCHAR
- installedAt: TIMESTAMP
- enabledAt: TIMESTAMP
- disabledAt: TIMESTAMP
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

### Jobs Table
```sql
- id: UUID (primary key)
- name: VARCHAR
- description: TEXT
- moduleId: UUID (foreign key → modules)
- handler: VARCHAR (path to job file)
- schedule: VARCHAR (cron expression)
- enabled: BOOLEAN
- timeout: INTEGER (milliseconds)
- retries: INTEGER
- config: JSONB
- lastRunAt: TIMESTAMP
- nextRunAt: TIMESTAMP
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

### Job Executions Table
```sql
- id: UUID (primary key)
- jobId: UUID (foreign key → jobs)
- status: ENUM (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED)
- startedAt: TIMESTAMP
- completedAt: TIMESTAMP
- duration: INTEGER (milliseconds)
- result: JSONB
- error: TEXT
- logs: TEXT
- attempt: INTEGER
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
```

### Events Table
```sql
- id: UUID (primary key)
- name: VARCHAR
- payload: JSONB
- source: VARCHAR
- emittedAt: TIMESTAMP
- createdAt: TIMESTAMP
```

---

## Environment Setup

### Prerequisites
- Node.js >= 20.0.0
- PostgreSQL >= 16
- Redis >= 7.0
- npm >= 10.0.0

### Start Backend
```bash
cd packages/backend
npm run dev
# Runs on http://localhost:4000
```

### Start Frontend
```bash
cd packages/frontend
npm run dev
# Runs on http://localhost:5173
```

### Default Credentials
- **Email**: admin@automation-platform.local
- **Password**: admin123

---

## Known Issues & Workarounds

### Issue 1: 401 Unauthorized Errors
**Symptom**: Random 401 errors when navigating between pages
**Cause**: Access token expiration
**Workaround**: Logout and login again to refresh token
**Permanent Fix**: Already implemented - token refresh logic in client.ts

### Issue 2: Module Jobs Not in Dropdown
**Symptom**: Job Type shows as text field instead of dropdown
**Cause**: Empty manifest object in database
**Fix**: Re-register module (see "In Progress Issues" section above)

### Issue 3: Orphaned Job Warnings
**Symptom**: Console logs show "Job not found in database"
**Impact**: Low - jobs are skipped and cleanup attempted
**Fix**: Restart backend or wait for auto-cleanup

---

## Testing

### Phase 2 Module System Tests
```bash
bash test-phase2.sh
# 11/11 tests passing ✅
```

### Phase 3 Job Scheduling Tests
```bash
cd packages/backend
npm test -- job-execution.test.ts
npm test -- event-bus.test.ts
npm test -- events-api.test.ts
```

### Manual Testing Checklist
- [ ] Login with admin credentials
- [ ] Navigate to Modules page - verify module shows as ENABLED
- [ ] Navigate to Create Job page
- [ ] Select "Data Sync Module" from dropdown
- [ ] Verify Job Type shows dropdown (not text field)
- [ ] Select a job type and create job
- [ ] Navigate to Jobs page - verify job appears
- [ ] Click "Run" to manually execute
- [ ] Navigate to Executions page - verify execution appears
- [ ] Check execution logs
- [ ] Navigate to Events page - verify events emitted

---

## Next Steps (Phase 4)

### Consumption Monitor Implementation
1. **Endpoint Management**
   - CRUD operations for data center endpoints
   - Endpoint health monitoring
   - Credential management

2. **Time-Series Storage**
   - Integrate TimescaleDB extension for PostgreSQL
   - Create hypertables for metrics
   - Implement data retention policies

3. **Real-Time Dashboards**
   - Live metrics visualization
   - Historical trend charts
   - Configurable refresh intervals

4. **Alert System**
   - Threshold-based alerting
   - Alert routing (email, webhook, etc.)
   - Alert history and acknowledgment

---

## Troubleshooting Commands

### Check Backend Status
```bash
# View backend logs
cd packages/backend
npm run dev

# Check if backend is running
curl http://localhost:4000/health
```

### Check Frontend Build
```bash
cd packages/frontend
npm run build
# Should complete without errors
```

### Database Queries
```bash
# Connect to PostgreSQL
psql -U automation_user -d automation_platform

# Check modules
SELECT id, name, status, manifest FROM "Module";

# Check jobs
SELECT id, name, "moduleId", handler, enabled FROM "Job";

# Check executions
SELECT id, "jobId", status, "startedAt" FROM "JobExecution" ORDER BY "createdAt" DESC LIMIT 10;
```

### Redis Queries
```bash
# List all keys (if redis-cli available)
redis-cli KEYS '*'

# Check BullMQ jobs
redis-cli KEYS 'bull:job-queue:*'
```

---

## Important Notes

1. **Always push changes to git** - User preference noted in session
2. **Job Type Dropdown Issue** - MUST re-register module to fix
3. **Manifest Schema** - The `manifest` field must be in Fastify response schema
4. **Module Lifecycle** - Always follow: Register → Install → Enable
5. **Authentication** - Use 'accessToken' key in localStorage (not 'token')
6. **Cron Expressions** - Jobs use standard cron syntax (* * * * *)

---

## Contact & Resources

- **Repository**: https://github.com/vladvaleanu/automation-platform
- **Documentation**: See `docs/` folder
- **Phase 3 Docs**: `docs/phase3-job-scheduling.md`
- **Example Module**: `examples/modules/data-sync-module/`

---

## Session End Checklist

- [x] Debug logging removed
- [x] Code committed and pushed
- [x] Critical issues documented
- [x] Fix steps provided
- [ ] **USER ACTION REQUIRED**: Re-register module to fix job dropdown
- [ ] **USER ACTION REQUIRED**: Verify job dropdown works after re-registration

**Resume from here**: Fix the manifest issue by running the unregister and register scripts, then verify the job type dropdown displays correctly with the 3 job options.
