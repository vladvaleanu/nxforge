/**
 * Job Executor Service
 * Handles loading and executing job handlers from modules
 */

import { pathToFileURL } from 'url';
import * as path from 'path';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import type { JobContext, JobHandler } from '../types/job.types.js';
import { browserService } from './browser.service.js';
import { notificationService } from './notification.service.js';
import { httpService } from './http.service.js';
import { LoggerService } from './logger.service.js';
import { databaseService } from './database.service.js';
import { eventBusService } from './event-bus.service.js';

// Type for Prisma Job with all fields
type PrismaJob = Awaited<ReturnType<typeof prisma.job.findUnique>> & {};
type PrismaModule = Awaited<ReturnType<typeof prisma.module.findUnique>> & {};

export class JobExecutorService {
  private handlerCache = new Map<string, JobHandler>();
  private logBuffers = new Map<string, string[]>();

  /**
   * Execute a job handler
   */
  async executeJob(
    jobId: string,
    moduleId: string,
    handlerPath: string,
    config: Record<string, unknown>,
    executionId: string
  ): Promise<unknown> {
    // Get job and module details
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const module = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new Error(`Module ${moduleId} not found`);
    }

    // Load the job handler
    const handler = await this.loadHandler(moduleId, handlerPath);

    // Build job context
    const context = this.buildJobContext(job, module, config, executionId);

    // Emit job started event
    await eventBusService.emit('job.started', {
      jobId: job.id,
      jobName: job.name,
      executionId: executionId,
      moduleName: module.name,
      source: 'system',
    });

    // Execute with timeout
    const timeoutMs = job.timeout || 300000; // Default 5 minutes
    let result;
    try {
      result = await this.executeWithTimeout(
        handler,
        context,
        timeoutMs,
        executionId
      );

      // Save logs to database
      await this.saveLogs(executionId);

      // Emit job completed event
      await eventBusService.emit('job.completed', {
        jobId: job.id,
        jobName: job.name,
        executionId: executionId,
        moduleName: module.name,
        duration: Date.now() - new Date(executionId.split('-')[1] || Date.now()).getTime(), // Approximate if not passed
        source: 'system',
      });

      return result;
    } catch (error) {
      // Save logs to database even on failure
      await this.saveLogs(executionId);

      // Emit job failed event
      await eventBusService.emit('job.failed', {
        jobId: job.id,
        jobName: job.name,
        executionId: executionId,
        moduleName: module.name,
        error: error instanceof Error ? error.message : String(error),
        source: 'system',
      });

      throw error;
    }
  }

  /**
   * Load a job handler from a module
   */
  private async loadHandler(
    moduleId: string,
    handlerPath: string
  ): Promise<JobHandler> {
    const cacheKey = `${moduleId}:${handlerPath}`;

    // Check cache first
    if (this.handlerCache.has(cacheKey)) {
      return this.handlerCache.get(cacheKey)!;
    }

    // Construct the full path to the handler
    // Modules are stored in: data/modules/{moduleName}/
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new Error(`Module ${moduleId} not found`);
    }

    // Use module path from database, or fall back to data/modules/{name}
    const moduleDir = module.path || path.resolve(process.cwd(), 'data', 'modules', module.name);

    // Validate handler path to prevent directory traversal attacks
    this.validatePath(moduleDir, handlerPath);

    const modulePath = path.join(moduleDir, handlerPath);

    try {
      // Dynamic import of the handler
      const fileUrl = pathToFileURL(modulePath).href;
      const handlerModule = await import(fileUrl);

      // Handler should export a default function or named 'handler' function
      const handler = handlerModule.default || handlerModule.handler;

      if (typeof handler !== 'function') {
        throw new Error(`Handler at ${handlerPath} is not a function`);
      }

      // Cache the handler
      this.handlerCache.set(cacheKey, handler);

      return handler;
    } catch (error) {
      logger.error(`Failed to load handler: ${modulePath}`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to load handler: ${errorMessage}`);
    }
  }

  /**
   * Build the job context with all services
   */
  private buildJobContext(
    job: NonNullable<PrismaJob>,
    module: NonNullable<PrismaModule>,
    config: Record<string, unknown>,
    executionId: string
  ): JobContext {
    // Initialize log buffer
    if (!this.logBuffers.has(executionId)) {
      this.logBuffers.set(executionId, []);
    }

    const logBuffer = this.logBuffers.get(executionId)!;

    return {
      config,
      module: {
        id: module.id,
        name: module.name,
        config: (module.config as Record<string, unknown>) || {},
      },
      services: {
        // Prisma client for database access
        prisma,
        // Browser service with Playwright
        browser: browserService,
        // Notification service (email, SMS, webhooks)
        notifications: notificationService,
        // HTTP service with retry logic
        http: httpService,
        // Logger service with execution tracking
        logger: LoggerService.createJobLogger(
          {
            jobId: job.id,
            executionId,
            moduleName: module.name,
          },
          logBuffer
        ),
        // Database service with helpers
        database: databaseService,
        // Event bus service for cross-module communication
        events: eventBusService,
      },
    };
  }

  /**
   * Execute handler with timeout
   */
  private async executeWithTimeout<T>(
    handler: JobHandler,
    context: JobContext,
    timeoutMs: number,
    _executionId: string
  ): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Job execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        const result = await handler(context);
        clearTimeout(timeoutHandle);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutHandle);
        reject(error);
      }
    });
  }

  /**
   * Save accumulated logs to the execution record
   */
  private async saveLogs(executionId: string): Promise<void> {
    const logs = this.logBuffers.get(executionId);

    // Always delete the buffer to prevent memory leaks, even if save fails
    this.logBuffers.delete(executionId);

    if (!logs || logs.length === 0) {
      return;
    }

    const logsText = logs.join('\n');

    try {
      await prisma.jobExecution.update({
        where: { id: executionId },
        data: { logs: logsText },
      });
    } catch (error) {
      logger.error(`Failed to save job logs for execution ${executionId}`, { error });
      // Buffer already deleted, so no memory leak even on failure
    }
  }

  /**
   * Clean up stale log buffers (call periodically to prevent memory leaks)
   * @param maxBuffers - Maximum number of buffers to retain (default: 1000)
   */
  cleanupStaleBuffers(maxBuffers: number = 1000): number {
    // This is a safety net - in normal operation, buffers are cleaned up after each job
    // This method can be called periodically to clean up any orphaned buffers
    let cleaned = 0;

    if (this.logBuffers.size > maxBuffers) {
      const toDelete = this.logBuffers.size - maxBuffers;
      const keys = Array.from(this.logBuffers.keys()).slice(0, toDelete);
      for (const key of keys) {
        this.logBuffers.delete(key);
        cleaned++;
      }
      logger.warn(`Cleaned up ${cleaned} stale log buffers (exceeded max of ${maxBuffers})`);
    }

    return cleaned;
  }

  /**
   * Clear handler cache (useful when modules are updated)
   */
  clearCache(moduleId?: string): void {
    if (moduleId) {
      // Clear cache for specific module
      for (const [key] of this.handlerCache.entries()) {
        if (key.startsWith(`${moduleId}:`)) {
          this.handlerCache.delete(key);
        }
      }
    } else {
      // Clear entire cache
      this.handlerCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedHandlers: this.handlerCache.size,
      activeLogBuffers: this.logBuffers.size,
    };
  }

  /**
   * Validate path to prevent directory traversal attacks
   */
  private validatePath(basePath: string, targetPath: string): void {
    const resolvedBase = path.resolve(basePath);
    const resolvedTarget = path.resolve(basePath, targetPath);

    // Ensure the resolved target path starts with the base path
    if (!resolvedTarget.startsWith(resolvedBase + path.sep) && resolvedTarget !== resolvedBase) {
      throw new Error(`Path traversal detected: ${targetPath} attempts to access outside module directory`);
    }

    // Additional check: ensure no '..' in the normalized path
    const normalizedPath = path.normalize(targetPath);
    if (normalizedPath.includes('..')) {
      throw new Error(`Invalid path: ${targetPath} contains directory traversal sequences`);
    }
  }
}

// Singleton instance
export const jobExecutorService = new JobExecutorService();
