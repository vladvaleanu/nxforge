# Phase 3: Automation Runtime - Implementation Plan

**Status**: 🚀 Ready to Start
**Duration**: 4 weeks
**Prerequisites**: ✅ Phase 2 Complete

## 📋 Overview

Phase 3 builds the automation runtime that allows modules to schedule and execute jobs, communicate via events, and run automated tasks in the data center environment.

## 🎯 Objectives

1. **Job Scheduling** - Schedule and execute module jobs with cron expressions
2. **Worker Pool** - Isolated job execution with resource management
3. **Event System** - Pub/sub communication between modules
4. **Job Monitoring** - Track job execution, logs, and history

## 🏗️ Architecture Components

### 1. Job Scheduling System

**Technology**: BullMQ (Redis-based job queue)

**Components**:
- Job Queue Management
- Cron-based Scheduling
- Priority Queues
- Job Retry Logic
- Dead Letter Queue

**Database Tables**:
- `Job` - Job definitions and configurations
- `JobExecution` - Execution history and logs
- `JobSchedule` - Cron schedules

### 2. Worker Pool

**Components**:
- Worker Manager
- Job Executor
- Resource Limits
- Concurrency Control
- Health Monitoring

**Features**:
- Isolated execution per job
- Timeout handling
- Error recovery
- Resource cleanup

### 3. Event System

**Technology**: EventEmitter / Redis Pub/Sub

**Components**:
- Event Bus Service
- Event Registry
- Event Listeners
- Event History

**Features**:
- Module-to-module communication
- Event subscriptions
- Event replay
- Event filtering

## 📅 Implementation Timeline

### Week 1: Job Scheduling Foundation
**Days 1-2**: Database schema and types
- Create Job, JobExecution, JobSchedule tables
- Define TypeScript types
- Create Prisma migrations

**Days 3-4**: BullMQ integration
- Install and configure BullMQ
- Create JobQueueService
- Implement job queue management

**Day 5**: Job scheduling
- Create JobSchedulerService
- Implement cron-based scheduling
- Add job creation API

### Week 2: Job Execution & Workers
**Days 1-2**: Worker pool implementation
- Create WorkerService
- Implement job executor
- Add resource limits

**Days 3-4**: Job execution
- Dynamic job handler loading
- Timeout and retry logic
- Error handling

**Day 5**: Job monitoring
- Create job status tracking
- Add execution logs
- Implement job history

### Week 3: Event System
**Days 1-2**: Event bus foundation
- Create EventBusService
- Implement event registry
- Add pub/sub mechanism

**Days 3-4**: Module integration
- Connect modules to event bus
- Implement event listeners
- Add event emitters

**Day 5**: Event monitoring
- Create event history
- Add event logging
- Implement event replay

### Week 4: Frontend & Testing
**Days 1-2**: Jobs UI
- Create JobsPage component
- Job list and details
- Job creation form
- Schedule management

**Days 3-4**: Monitoring UI
- Job execution logs
- Event history viewer
- Real-time updates

**Day 5**: Testing & documentation
- End-to-end tests
- API documentation
- User guide

## 📊 Detailed Implementation Steps

### Step 1: Database Schema

**New Tables**:

```prisma
model Job {
  id          String   @id @default(uuid())
  name        String
  description String?
  moduleId    String
  module      Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  handler     String   // Path to handler function
  schedule    String?  // Cron expression
  enabled     Boolean  @default(true)
  timeout     Int      @default(300000) // 5 minutes
  retries     Int      @default(3)
  config      Json?    // Job-specific configuration
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  executions  JobExecution[]
  schedules   JobSchedule[]

  @@index([moduleId])
  @@index([enabled])
}

model JobExecution {
  id          String   @id @default(uuid())
  jobId       String
  job         Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  status      JobExecutionStatus
  startedAt   DateTime @default(now())
  completedAt DateTime?
  duration    Int?     // milliseconds
  result      Json?    // Execution result
  error       String?  // Error message if failed
  logs        String?  // Execution logs

  @@index([jobId])
  @@index([status])
  @@index([startedAt])
}

model JobSchedule {
  id          String   @id @default(uuid())
  jobId       String
  job         Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  schedule    String   // Cron expression
  timezone    String   @default("UTC")
  nextRun     DateTime?
  lastRun     DateTime?
  enabled     Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([jobId])
  @@index([enabled])
  @@index([nextRun])
}

model Event {
  id        String   @id @default(uuid())
  name      String
  source    String   // Module name or system
  payload   Json
  createdAt DateTime @default(now())

  @@index([name])
  @@index([source])
  @@index([createdAt])
}

enum JobExecutionStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  TIMEOUT
  CANCELLED
}
```

### Step 2: Backend Services

**Services to Create**:

1. **JobQueueService** (`services/job-queue.service.ts`)
   - BullMQ queue management
   - Job enqueueing
   - Queue monitoring

2. **JobSchedulerService** (`services/job-scheduler.service.ts`)
   - Cron-based scheduling
   - Schedule management
   - Next run calculation

3. **JobExecutorService** (`services/job-executor.service.ts`)
   - Job handler loading
   - Execution management
   - Timeout handling

4. **WorkerService** (`services/worker.service.ts`)
   - Worker pool management
   - Job processing
   - Resource cleanup

5. **EventBusService** (`services/event-bus.service.ts`)
   - Event publishing
   - Event subscription
   - Event history

### Step 3: API Endpoints

**Job Management**:
- `GET /api/v1/jobs` - List jobs
- `GET /api/v1/jobs/:id` - Get job details
- `POST /api/v1/jobs` - Create job
- `PUT /api/v1/jobs/:id` - Update job
- `DELETE /api/v1/jobs/:id` - Delete job
- `POST /api/v1/jobs/:id/execute` - Trigger job manually
- `PUT /api/v1/jobs/:id/enable` - Enable job
- `PUT /api/v1/jobs/:id/disable` - Disable job

**Job Execution**:
- `GET /api/v1/jobs/:id/executions` - List executions
- `GET /api/v1/executions/:id` - Get execution details
- `GET /api/v1/executions/:id/logs` - Get execution logs
- `DELETE /api/v1/executions/:id` - Delete execution

**Events**:
- `GET /api/v1/events` - List events
- `GET /api/v1/events/:name` - Get events by name
- `POST /api/v1/events` - Publish event (internal)

### Step 4: Frontend Components

**Pages**:
1. **JobsPage** (`pages/JobsPage.tsx`)
   - Job list with status
   - Create/edit job modal
   - Job details view

2. **JobExecutionsPage** (`pages/JobExecutionsPage.tsx`)
   - Execution history
   - Logs viewer
   - Status filtering

3. **EventsPage** (`pages/EventsPage.tsx`)
   - Event stream
   - Event filtering
   - Event details

**Components**:
1. **JobCard** - Display job information
2. **JobForm** - Create/edit job
3. **ExecutionLogs** - Display execution logs
4. **CronBuilder** - Visual cron expression builder
5. **JobStatusBadge** - Status indicators

### Step 5: Module Integration

**Module Manifest Updates**:

```json
{
  "capabilities": {
    "jobs": {
      "handlers": [
        {
          "name": "sync-inventory",
          "handler": "jobs/sync-inventory.ts",
          "schedule": "0 */6 * * *",
          "timeout": 300000,
          "retries": 3,
          "description": "Sync VMware inventory"
        }
      ]
    },
    "events": {
      "listeners": [
        {
          "event": "vm.created",
          "handler": "events/on-vm-created.ts"
        }
      ],
      "emitters": [
        {
          "event": "inventory.synced",
          "description": "Fired when inventory sync completes"
        }
      ]
    }
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
- JobQueueService tests
- JobSchedulerService tests
- EventBusService tests
- Job execution tests

### Integration Tests
- End-to-end job execution
- Event publishing and subscription
- Schedule trigger tests

### Manual Tests
- Create and execute jobs
- View execution logs
- Test event flow
- Verify cron scheduling

## 📦 Dependencies to Add

**Backend**:
```json
{
  "bullmq": "^5.0.0",
  "ioredis": "^5.3.0",
  "cron-parser": "^4.9.0",
  "node-cron": "^3.0.3"
}
```

**Frontend**:
```json
{
  "react-syntax-highlighter": "^15.5.0",
  "date-fns": "^3.0.0"
}
```

## 🔒 Security Considerations

1. **Job Isolation** - Execute jobs in isolated contexts
2. **Resource Limits** - Prevent resource exhaustion
3. **Permission Checks** - Verify user can create/execute jobs
4. **Input Validation** - Validate cron expressions and configs
5. **Log Sanitization** - Remove sensitive data from logs

## 📈 Success Metrics

- ✅ Jobs can be scheduled with cron expressions
- ✅ Jobs execute automatically on schedule
- ✅ Manual job execution works
- ✅ Job logs are captured and viewable
- ✅ Events can be published and consumed
- ✅ UI shows job status and history
- ✅ Failed jobs are retried correctly
- ✅ Timeout handling works

## 🎯 Phase 3 Deliverables

### Backend
- [ ] Job scheduling system with BullMQ
- [ ] Worker pool for job execution
- [ ] Event bus for module communication
- [ ] 12+ API endpoints for jobs and events
- [ ] Database schema with 4 new tables

### Frontend
- [ ] Jobs management page
- [ ] Job execution logs viewer
- [ ] Event stream viewer
- [ ] Cron schedule builder
- [ ] Real-time status updates

### Testing
- [ ] Automated test suite
- [ ] Example job handlers
- [ ] End-to-end verification
- [ ] Performance tests

### Documentation
- [ ] API documentation
- [ ] Job handler guide
- [ ] Event system guide
- [ ] Operator manual

## 🔄 Integration with Phase 2

Jobs and events integrate with the existing module system:
- Modules define jobs in their manifest
- Jobs are registered when module is enabled
- Jobs are unregistered when module is disabled
- Events allow modules to communicate
- Module routes can trigger events

## 🚀 Next Steps After Phase 3

**Phase 4: Consumption Monitor**
- Specific use case: Monitor data center metrics
- Endpoint management
- Time-series data storage
- Real-time dashboards

**Phase 5: Production Hardening**
- Security audit
- Performance optimization
- High availability
- Comprehensive monitoring

---

## ✅ Ready to Start?

Phase 3 will add the automation engine that makes this a true automation platform. All groundwork from Phase 1 and 2 is in place.

**Estimated Completion**: 4 weeks
**Complexity**: Medium-High
**Impact**: High (enables core automation features)

Let's build it! 🚀
