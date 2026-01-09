/**
 * Job Scheduler Service
 * Manages cron-based job scheduling
 */

import { parseExpression } from 'cron-parser';
import { prisma } from '../lib/prisma.js';
import { jobQueueService } from './job-queue.service.js';
import type { Job, JobSchedule } from '../types/job.types.js';

export class JobSchedulerService {
  /**
   * Parse and validate cron expression
   */
  validateCronExpression(expression: string): boolean {
    try {
      parseExpression(expression);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate next run time for cron expression
   */
  getNextRunTime(expression: string, timezone: string = 'UTC'): Date {
    const interval = parseExpression(expression, {
      currentDate: new Date(),
      tz: timezone,
    });
    return interval.next().toDate();
  }

  /**
   * Create or update job schedule
   */
  async createSchedule(
    jobId: string,
    cronExpression: string,
    timezone: string = 'UTC'
  ): Promise<JobSchedule> {
    // Validate cron expression
    if (!this.validateCronExpression(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    // Calculate next run time
    const nextRun = this.getNextRunTime(cronExpression, timezone);

    // Check if schedule already exists
    const existingSchedule = await prisma.jobSchedule.findFirst({
      where: { jobId },
    });

    if (existingSchedule) {
      // Update existing schedule
      return prisma.jobSchedule.update({
        where: { id: existingSchedule.id },
        data: {
          schedule: cronExpression,
          timezone,
          nextRun,
          enabled: true,
        },
      });
    }

    // Create new schedule
    return prisma.jobSchedule.create({
      data: {
        jobId,
        schedule: cronExpression,
        timezone,
        nextRun,
        enabled: true,
      },
    });
  }

  /**
   * Enable all schedules for a job
   */
  async enableJobSchedules(jobId: string): Promise<void> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { schedules: true },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Add to BullMQ with cron schedule
    for (const schedule of job.schedules) {
      if (schedule.enabled) {
        await jobQueueService.addRecurringJob(job as any, schedule.schedule);
      }
    }
  }

  /**
   * Disable all schedules for a job
   */
  async disableJobSchedules(jobId: string): Promise<void> {
    await jobQueueService.removeRecurringJob(jobId);

    // Update database
    await prisma.jobSchedule.updateMany({
      where: { jobId },
      data: { enabled: false },
    });
  }

  /**
   * Clean up orphaned jobs in Redis that don't exist in database
   */
  async cleanupOrphanedJobs(): Promise<{ removed: number }> {
    try {
      // Get all jobs from database
      const dbJobs = await prisma.job.findMany({
        select: { id: true },
      });
      const dbJobIds = new Set(dbJobs.map(j => j.id));

      // Get all repeatable jobs from Redis
      const repeatableJobs = await jobQueueService.queue.getRepeatableJobs();

      let removed = 0;
      for (const job of repeatableJobs) {
        // Extract job ID from the job key or name
        const jobId = job.id;

        if (jobId && !dbJobIds.has(jobId)) {
          // Job exists in Redis but not in database - remove it
          await jobQueueService.queue.removeRepeatableByKey(job.key);
          removed++;
        }
      }

      return { removed };
    } catch (error: any) {
      throw new Error(`Failed to cleanup orphaned jobs: ${error.message}`);
    }
  }

  /**
   * Update schedule's next run time after execution
   */
  async updateScheduleAfterRun(scheduleId: string): Promise<void> {
    const schedule = await prisma.jobSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) return;

    const nextRun = this.getNextRunTime(schedule.schedule, schedule.timezone);

    await prisma.jobSchedule.update({
      where: { id: scheduleId },
      data: {
        lastRun: new Date(),
        nextRun,
      },
    });
  }

  /**
   * Get all active schedules that need to run
   */
  async getDueSchedules(): Promise<JobSchedule[]> {
    const now = new Date();

    return prisma.jobSchedule.findMany({
      where: {
        enabled: true,
        nextRun: {
          lte: now,
        },
      },
      include: {
        job: true,
      },
    });
  }

  /**
   * Initialize all enabled job schedules on startup
   */
  async initializeSchedules(): Promise<void> {
    const jobs = await prisma.job.findMany({
      where: { enabled: true },
      include: { schedules: true },
    });

    console.log(`Initializing ${jobs.length} enabled jobs with schedules`);

    for (const job of jobs) {
      for (const schedule of job.schedules) {
        if (schedule.enabled) {
          try {
            await jobQueueService.addRecurringJob(job as any, schedule.schedule);
            console.log(`Scheduled job ${job.name} with cron: ${schedule.schedule}`);
          } catch (error) {
            console.error(`Failed to schedule job ${job.name}:`, error);
          }
        }
      }
    }
  }

  /**
   * Remove schedule
   */
  async removeSchedule(scheduleId: string): Promise<void> {
    const schedule = await prisma.jobSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (schedule) {
      await jobQueueService.removeRecurringJob(schedule.jobId);
      await prisma.jobSchedule.delete({
        where: { id: scheduleId },
      });
    }
  }

  /**
   * Get schedule statistics
   */
  async getScheduleStats() {
    const [total, enabled, disabled] = await Promise.all([
      prisma.jobSchedule.count(),
      prisma.jobSchedule.count({ where: { enabled: true } }),
      prisma.jobSchedule.count({ where: { enabled: false } }),
    ]);

    return {
      total,
      enabled,
      disabled,
    };
  }
}

// Singleton instance
export const jobSchedulerService = new JobSchedulerService();
