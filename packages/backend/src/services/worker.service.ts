/**
 * Worker Service
 * Processes jobs from BullMQ queue
 */

import { Worker, Job as BullJob } from 'bullmq';
import { createRedisConnection } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { JobExecutionStatus } from '../types/job.types.js';
import type { JobExecutorService } from './job-executor.service.js';

interface WorkerServiceConfig {
  concurrency?: number;
  maxStalledCount?: number;
  stalledInterval?: number;
}

export class WorkerService {
  private worker: Worker | null = null;
  private executor: JobExecutorService | null = null;
  private isRunning = false;

  constructor(
    private config: WorkerServiceConfig = {
      concurrency: 5,
      maxStalledCount: 3,
      stalledInterval: 30000,
    }
  ) {}

  /**
   * Set the job executor service
   */
  setExecutor(executor: JobExecutorService) {
    this.executor = executor;
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Worker already running');
      return;
    }

    if (!this.executor) {
      throw new Error('JobExecutorService not set. Call setExecutor() first.');
    }

    logger.info('Starting worker pool...');

    this.worker = new Worker(
      'automation-jobs',
      async (job: BullJob) => {
        return this.processJob(job);
      },
      {
        connection: createRedisConnection(),
        concurrency: this.config.concurrency,
        maxStalledCount: this.config.maxStalledCount,
        stalledInterval: this.config.stalledInterval,
        autorun: true,
      }
    );

    // Worker event listeners
    this.worker.on('completed', async (job: BullJob, result: any) => {
      logger.info(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', async (job: BullJob | undefined, error: Error) => {
      if (job) {
        logger.error(`Job ${job.id} failed: ${error.message}`, error);
      } else {
        logger.error('Job failed without job information', error);
      }
    });

    this.worker.on('stalled', (jobId: string) => {
      logger.warn(`Job ${jobId} stalled - will be retried`);
    });

    this.worker.on('error', (error: Error) => {
      logger.error('Worker error:', error);
    });

    this.worker.on('ready', () => {
      logger.info('Worker is ready to process jobs');
    });

    this.isRunning = true;
    logger.info(`Worker pool started with concurrency: ${this.config.concurrency}`);
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.worker) {
      logger.warn('Worker not running');
      return;
    }

    logger.info('Stopping worker pool...');
    await this.worker.close();
    this.worker = null;
    this.isRunning = false;
    logger.info('Worker pool stopped');
  }

  /**
   * Process a job from the queue
   */
  private async processJob(bullJob: BullJob): Promise<any> {
    const { jobId, moduleId, handler, config } = bullJob.data;

    logger.info(`Processing job: ${jobId}`, {
      jobId,
      moduleId,
      handler,
      bullJobId: bullJob.id,
    });

    // Check if job still exists in database
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      logger.warn(`Job ${jobId} not found in database - removing from queue`, {
        jobId,
        bullJobId: bullJob.id,
      });

      // Remove this orphaned job from the queue
      await bullJob.remove();

      throw new Error(`Job ${jobId} no longer exists in database`);
    }

    // Create execution record
    const execution = await prisma.jobExecution.create({
      data: {
        jobId,
        status: JobExecutionStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    const startTime = Date.now();

    try {
      // Execute the job using the executor service
      const result = await this.executor!.executeJob(
        jobId,
        moduleId,
        handler,
        config || {},
        execution.id
      );

      const duration = Date.now() - startTime;

      // Update execution record with success
      await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status: JobExecutionStatus.COMPLETED,
          completedAt: new Date(),
          duration,
          result: result || {},
        },
      });

      logger.info(`Job ${jobId} completed in ${duration}ms`);
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Determine status based on error type
      let status = JobExecutionStatus.FAILED;
      if (error.message?.includes('timeout') || error.name === 'TimeoutError') {
        status = JobExecutionStatus.TIMEOUT;
      }

      // Update execution record with failure
      await prisma.jobExecution.update({
        where: { id: execution.id },
        data: {
          status,
          completedAt: new Date(),
          duration,
          error: error.message || 'Unknown error',
        },
      });

      logger.error(`Job ${jobId} failed after ${duration}ms: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      running: this.isRunning,
      concurrency: this.config.concurrency,
      hasExecutor: this.executor !== null,
    };
  }

  /**
   * Get worker metrics
   */
  async getMetrics() {
    if (!this.worker) {
      return {
        running: false,
        processed: 0,
        failed: 0,
      };
    }

    // BullMQ doesn't expose processed/failed counts directly on worker
    // We need to query Redis or use QueueEvents for this
    return {
      running: this.isRunning,
      concurrency: this.config.concurrency,
    };
  }

  /**
   * Pause the worker
   */
  async pause(): Promise<void> {
    if (this.worker) {
      await this.worker.pause();
      logger.info('Worker paused');
    }
  }

  /**
   * Resume the worker
   */
  async resume(): Promise<void> {
    if (this.worker) {
      await this.worker.resume();
      logger.info('Worker resumed');
    }
  }
}

// Singleton instance
export const workerService = new WorkerService();
