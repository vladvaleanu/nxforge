/**
 * Main entry point for the Automation Platform Backend
 */

import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { workerService } from './services/worker.service.js';
import { jobExecutorService } from './services/job-executor.service.js';
import { jobSchedulerService } from './services/job-scheduler.service.js';
import { browserService } from './services/browser.service.js';
import { databaseService } from './services/database.service.js';
import { eventBusService } from './services/event-bus.service.js';

async function start() {
  try {
    const app = await buildApp();

    // Initialize event bus
    logger.info('Initializing event bus...');
    await eventBusService.initialize();
    logger.info('Event bus initialized');

    // Start worker pool for job execution
    logger.info('Initializing job execution services...');
    workerService.setExecutor(jobExecutorService);
    await workerService.start();
    logger.info('Worker pool started');

    // Clean up orphaned jobs from Redis
    logger.info('Cleaning up orphaned jobs...');
    const cleanup = await jobSchedulerService.cleanupOrphanedJobs();
    if (cleanup.removed > 0) {
      logger.info(`Removed ${cleanup.removed} orphaned job(s) from queue`);
    } else {
      logger.info('No orphaned jobs found');
    }

    // Initialize scheduled jobs
    logger.info('Initializing job schedules...');
    await jobSchedulerService.initializeSchedules();
    logger.info('Job schedules initialized');

    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    logger.info(`Server listening on ${env.HOST}:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Health check: http://${env.HOST}:${env.PORT}/health`);
    logger.info(`API base: http://${env.HOST}:${env.PORT}/api/v1`);

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);

        // Stop worker pool
        await workerService.stop();

        // Disconnect event bus
        await eventBusService.disconnect();

        // Close all browser sessions
        await browserService.closeAllSessions();

        // Disconnect database
        await databaseService.disconnect();

        // Close Fastify
        await app.close();

        process.exit(0);
      });
    });
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

start();
