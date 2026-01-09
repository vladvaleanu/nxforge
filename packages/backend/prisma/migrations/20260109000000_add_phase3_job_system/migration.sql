-- Phase 3: Job Scheduling System
-- Drop old job table if exists
DROP TABLE IF EXISTS "jobs";
DROP TYPE IF EXISTS "JobStatus";

-- Create new enum for job execution status
CREATE TYPE "JobExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED');

-- CreateTable: jobs (job definitions)
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "moduleId" TEXT NOT NULL,
    "handler" TEXT NOT NULL,
    "schedule" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timeout" INTEGER NOT NULL DEFAULT 300000,
    "retries" INTEGER NOT NULL DEFAULT 3,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: job_executions (execution history)
CREATE TABLE "job_executions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" "JobExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "result" JSONB,
    "error" TEXT,
    "logs" TEXT,

    CONSTRAINT "job_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: job_schedules (cron schedules)
CREATE TABLE "job_schedules" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "nextRun" TIMESTAMP(3),
    "lastRun" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: events (event system for module communication)
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_moduleId_idx" ON "jobs"("moduleId");
CREATE INDEX "jobs_enabled_idx" ON "jobs"("enabled");

CREATE INDEX "job_executions_jobId_idx" ON "job_executions"("jobId");
CREATE INDEX "job_executions_status_idx" ON "job_executions"("status");
CREATE INDEX "job_executions_startedAt_idx" ON "job_executions"("startedAt");

CREATE INDEX "job_schedules_jobId_idx" ON "job_schedules"("jobId");
CREATE INDEX "job_schedules_enabled_idx" ON "job_schedules"("enabled");
CREATE INDEX "job_schedules_nextRun_idx" ON "job_schedules"("nextRun");

CREATE INDEX "events_name_idx" ON "events"("name");
CREATE INDEX "events_source_idx" ON "events"("source");
CREATE INDEX "events_createdAt_idx" ON "events"("createdAt");

-- AddForeignKey
ALTER TABLE "job_executions" ADD CONSTRAINT "job_executions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_schedules" ADD CONSTRAINT "job_schedules_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
