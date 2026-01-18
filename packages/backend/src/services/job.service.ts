/**
 * Unified Job Service
 * Consolidates job queueing, scheduling, and worker management into one service
 * Uses BullMQ for all job operations (replaces JobQueueService, JobSchedulerService, WorkerService)
 */

import { Queue, Worker, QueueEvents, Job as BullJob, JobsOptions } from 'bullmq';
import { parseExpression } from 'cron-parser';
import { createRedisConnection } from '../lib/redis.js';
import { prisma, Prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { jobExecutorService } from './job-executor.service.js';
import { JOB_CONFIG, TIMEOUTS } from '../config/constants.js';
import type { Job } from '../types/job.types.js';

export class JobService {
  private queue: Queue;
  private worker: Worker;
  private queueEvents: QueueEvents;
  private readonly queueName = JOB_CONFIG.QUEUE_NAME;
  private readonly concurrency = JOB_CONFIG.DEFAULT_CONCURRENCY;

  constructor() {
    const connection = createRedisConnection();

    // Create BullMQ queue
    this.queue = new Queue(this.queueName, {
      connection,
      defaultJobOptions: {
        attempts: JOB_CONFIG.DEFAULT_RETRIES,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5 seconds initial delay
        },
        removeOnComplete: {
          age: TIMEOUTS.QUEUE_COMPLETED / 1000, // Convert ms to seconds
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: TIMEOUTS.QUEUE_FAILED / 1000, // Convert ms to seconds
        },
      },
    });

    // Create worker to process jobs
    this.worker = new Worker(
      this.queueName,
      async (job) => {
        return this.processJob(job);
      },
      {
        connection,
        concurrency: this.concurrency,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      }
    );

    // Queue events for monitoring
    this.queueEvents = new QueueEvents(this.queueName, { connection });

    // Setup event listeners
    this.setupEventListeners();

    logger.info('JobService initialized', {
      queueName: this.queueName,
      concurrency: this.concurrency,
    });
  }

  /**
   * Process a job from the queue
   */
  private async processJob(bullJob: BullJob): Promise<any> {
    const { jobId, moduleId, handler, config } = bullJob.data;

    logger.info(`Processing job ${jobId}`, {
      jobId,
      moduleId,
      handler,
      attemptsMade: bullJob.attemptsMade,
    });

    try {
      // Create execution record
      const execution = await prisma.jobExecution.create({
        data: {
          jobId,
          status: 'RUNNING',
          startedAt: new Date(),
        },
      });

      // Execute the job handler
      const result = await jobExecutorService.executeJob(
        jobId,
        moduleId,
        handler,
        config,
        execution.id
      );

      // Update execution record
      const completedAt = new Date();
      await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          completedAt,
          result: result as Prisma.InputJsonValue,
        },
      });

      // Update job schedule's lastRun and calculate nextRun
      const schedule = await prisma.jobSchedule.findFirst({
        where: { jobId, enabled: true },
      });
      if (schedule) {
        const nextRun = this.calculateNextRun(schedule.schedule, schedule.timezone);
        await prisma.jobSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRun: completedAt,
            nextRun,
          },
        });
        logger.debug(`Updated job schedule: lastRun=${completedAt.toISOString()}, nextRun=${nextRun.toISOString()}`);
      }

      logger.info(`Job ${jobId} completed successfully`, { executionId: execution.id });
      return result;
    } catch (error: any) {
      logger.error(`Job ${jobId} failed`, {
        error: error.message,
        stack: error.stack,
      });

      // Update execution record with failure
      const execution = await prisma.jobExecution.findFirst({
        where: {
          jobId,
          status: 'RUNNING',
        },
        orderBy: { startedAt: 'desc' },
      });

      if (execution) {
        await prisma.jobExecution.update({
          where: { id: execution.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: error.message,
          },
        });
      }

      throw error;
    }
  }

  /**
   * Setup event listeners for queue monitoring
   */
  private setupEventListeners(): void {
    this.queueEvents.on('completed', ({ jobId }) => {
      logger.info(`Job completed: ${jobId}`);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job failed: ${jobId}`, { reason: failedReason });
    });

    this.queueEvents.on('stalled', ({ jobId }) => {
      logger.warn(`Job stalled: ${jobId}`);
    });

    this.worker.on('error', (error) => {
      logger.error('Worker error', { error: error.message });
    });
  }

  /**
   * Calculate the next run time from a cron expression
   */
  private calculateNextRun(cronExpression: string, timezone: string = 'UTC'): Date {
    try {
      const interval = parseExpression(cronExpression, {
        currentDate: new Date(),
        tz: timezone,
      });
      return interval.next().toDate();
    } catch (error) {
      logger.warn(`Invalid cron expression: ${cronExpression}`, { error });
      // Return a far future date if parsing fails
      return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Schedule a recurring job using cron expression
   */
  async scheduleJob(job: Job, cronExpression: string): Promise<void> {
    logger.info(`Scheduling job ${job.id}`, {
      jobId: job.id,
      cron: cronExpression,
      handler: job.handler,
    });

    await this.queue.add(
      job.name,
      {
        jobId: job.id,
        moduleId: job.moduleId,
        handler: job.handler,
        config: job.config,
      },
      {
        jobId: job.id,
        repeat: {
          pattern: cronExpression,
        },
        attempts: job.retries,
      } satisfies JobsOptions
    );

    // Calculate the next run time using cron-parser
    const nextRun = this.calculateNextRun(cronExpression);

    // Update job schedule in database
    // First, try to find existing schedule for this job
    const existingSchedule = await prisma.jobSchedule.findFirst({
      where: { jobId: job.id },
    });

    if (existingSchedule) {
      // Update existing schedule
      await prisma.jobSchedule.update({
        where: { id: existingSchedule.id },
        data: {
          schedule: cronExpression,
          enabled: true,
          nextRun,
        },
      });
    } else {
      // Create new schedule
      await prisma.jobSchedule.create({
        data: {
          jobId: job.id,
          schedule: cronExpression,
          enabled: true,
          timezone: 'UTC',
          nextRun,
        },
      });
    }

    logger.info(`Job scheduled: ${job.id}`, { nextRun: nextRun.toISOString() });
  }

  /**
   * Unschedule a recurring job
   */
  async unscheduleJob(jobId: string): Promise<void> {
    logger.info(`Unscheduling job ${jobId}`);

    // Remove all repeatable jobs with this ID
    const repeatableJobs = await this.queue.getRepeatableJobs();
    for (const repeatableJob of repeatableJobs) {
      if (repeatableJob.id === jobId || repeatableJob.name === jobId) {
        await this.queue.removeRepeatableByKey(repeatableJob.key);
      }
    }

    // Update database
    await prisma.jobSchedule.updateMany({
      where: { jobId },
      data: { enabled: false },
    });

    logger.info(`Job unscheduled: ${jobId}`);
  }

  /**
   * Manually trigger a job (run once immediately)
   */
  async triggerJob(job: Job): Promise<string> {
    logger.info(`Manually triggering job ${job.id}`);

    const bullJob = await this.queue.add(
      job.name,
      {
        jobId: job.id,
        moduleId: job.moduleId,
        handler: job.handler,
        config: job.config,
      },
      {
        attempts: job.retries,
      } satisfies JobsOptions
    );

    return bullJob.id!;
  }

  /**
   * Cancel a running or queued job
   */
  async cancelJob(bullJobId: string): Promise<void> {
    logger.info(`Cancelling job ${bullJobId}`);

    const job = await this.queue.getJob(bullJobId);
    if (job) {
      // Get the jobId from the BullMQ job data to find the correct execution record
      const { jobId } = job.data;

      try {
        await job.remove();
      } catch (error) {
        logger.error(`Failed to remove job from queue: ${bullJobId}`, { error });
      }

      // Update execution record if it exists - use jobId to find the correct record
      if (jobId) {
        const execution = await prisma.jobExecution.findFirst({
          where: {
            jobId,
            status: 'RUNNING',
          },
          orderBy: { startedAt: 'desc' },
        });

        if (execution) {
          await prisma.jobExecution.update({
            where: { id: execution.id },
            data: {
              status: 'CANCELLED',
              completedAt: new Date(),
              error: 'Job cancelled by user',
            },
          });
        }
      }
    }

    logger.info(`Job cancelled: ${bullJobId}`);
  }

  /**
   * Get job metrics for monitoring
   */
  async getMetrics() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      workers: this.concurrency,
    };
  }

  /**
   * Clean up orphaned jobs (exist in Redis but not in database)
   */
  async cleanupOrphanedJobs(): Promise<{ removed: number }> {
    logger.info('Cleaning up orphaned jobs');

    try {
      // Get all jobs from database
      const dbJobs = await prisma.job.findMany({
        select: { id: true },
      });
      const dbJobIds = new Set(dbJobs.map((j) => j.id));

      // Get all repeatable jobs from Redis
      const repeatableJobs = await this.queue.getRepeatableJobs();

      let removed = 0;
      for (const job of repeatableJobs) {
        const jobId = job.id;

        if (jobId && !dbJobIds.has(jobId)) {
          // Job exists in Redis but not in database - remove it
          await this.queue.removeRepeatableByKey(job.key);
          removed++;
          logger.info(`Removed orphaned job: ${jobId}`);
        }
      }

      logger.info(`Cleanup complete: ${removed} orphaned jobs removed`);
      return { removed };
    } catch (error: any) {
      logger.error('Failed to cleanup orphaned jobs', { error: error.message });
      throw new Error(`Failed to cleanup orphaned jobs: ${error.message}`);
    }
  }

  /**
   * Initialize all enabled jobs from database
   */
  async initializeJobs(): Promise<void> {
    logger.info('Initializing enabled jobs from database');

    const jobs = await prisma.job.findMany({
      where: {
        enabled: true,
        schedule: { not: null },
      },
    });

    logger.info(`Found ${jobs.length} enabled jobs with schedules`);

    for (const job of jobs) {
      if (job.schedule) {
        // Check if the module is enabled
        const module = await prisma.module.findUnique({
          where: { id: job.moduleId },
          select: { status: true },
        });

        if (module && module.status === 'ENABLED') {
          try {
            await this.scheduleJob(job as Job, job.schedule);
            logger.info(`Initialized job: ${job.name}`);
          } catch (error: any) {
            logger.error(`Failed to initialize job ${job.name}`, {
              error: error.message,
            });
          }
        } else {
          logger.warn(`Skipping job ${job.name} - module is not enabled`);
        }
      }
    }

    // Clean up orphaned jobs
    await this.cleanupOrphanedJobs();

    logger.info('Job initialization complete');
  }

  /**
   * Shutdown the job service gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down JobService');

    await this.worker.close();
    await this.queue.close();
    await this.queueEvents.close();

    logger.info('JobService shutdown complete');
  }
}

// Export singleton instance
export const jobService = new JobService();
