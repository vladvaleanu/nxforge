/**
 * Job Management API Routes
 * Handles CRUD operations for jobs and schedules
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { parseExpression } from 'cron-parser';
import { prisma } from '../lib/prisma.js';
import { jobService } from '../services/job.service.js';
import { jobExecutorService } from '../services/job-executor.service.js';
import { ERROR_MESSAGES, JOB_CONFIG, TIMEOUTS, PAGINATION } from '../config/constants.js';
import { parsePagination, createPaginationMeta } from '../utils/pagination.utils.js';
import { createPaginatedResponse } from '../utils/response.utils.js';
import { buildWhereClause, parseBoolean } from '../utils/query.utils.js';
import type { Job } from '../types/job.types.js';

// Validation schemas
const createJobSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  moduleId: z.string().uuid(),
  handler: z.string().min(1),
  schedule: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  timeout: z.number().int().positive().optional().default(TIMEOUTS.JOB_DEFAULT),
  retries: z.number().int().nonnegative().optional().default(JOB_CONFIG.DEFAULT_RETRIES),
  config: z.record(z.any()).optional(),
});

const updateJobSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  handler: z.string().min(1).optional(),
  schedule: z.string().nullable().optional(), // nullable to allow removing schedule
  enabled: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
  retries: z.number().int().nonnegative().optional(),
  config: z.record(z.any()).optional(),
});

const listJobsSchema = z.object({
  moduleId: z.string().uuid().optional(),
  enabled: z.enum(['true', 'false']).optional(),
  page: z.string().regex(/^\d+$/).optional().default(String(PAGINATION.DEFAULT_PAGE)),
  limit: z.string().regex(/^\d+$/).optional().default(String(PAGINATION.DEFAULT_LIMIT)),
});

// Helper function to validate cron expression
function validateCronExpression(expression: string): boolean {
  try {
    parseExpression(expression);
    return true;
  } catch (error) {
    return false;
  }
}

export const jobsRoutes: FastifyPluginAsync = async (fastify) => {
  // List all jobs
  fastify.get('/', async (request, reply) => {
    const query = listJobsSchema.parse(request.query);
    const { page, limit, skip } = parsePagination(query);

    const where = buildWhereClause({
      moduleId: query.moduleId,
      enabled: parseBoolean(query.enabled),
    });

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          schedules: true,
          module: {
            select: {
              name: true,
              displayName: true,
            },
          },
          _count: {
            select: { executions: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.job.count({ where }),
    ]);

    return reply.send(
      createPaginatedResponse(jobs, createPaginationMeta(page, limit, total))
    );
  });

  // Get job by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        schedules: true,
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 10, // Last 10 executions
        },
        _count: {
          select: { executions: true },
        },
      },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
      });
    }

    return reply.send({
      success: true,
      data: job,
    });
  });

  // Create new job
  fastify.post('/', async (request, reply) => {
    const body = createJobSchema.parse(request.body);

    // Validate module exists
    const module = await prisma.module.findUnique({
      where: { id: body.moduleId },
    });

    if (!module) {
      return reply.status(404).send({
        success: false,
        error: ERROR_MESSAGES.MODULE_NOT_FOUND,
      });
    }

    // Validate cron expression if provided
    if (body.schedule && !validateCronExpression(body.schedule)) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid cron expression', // TODO: Add to ERROR_MESSAGES constant
      });
    }

    // Create job
    const job = await prisma.job.create({
      data: {
        name: body.name,
        description: body.description,
        moduleId: body.moduleId,
        handler: body.handler,
        schedule: body.schedule,
        enabled: body.enabled ?? true,
        timeout: body.timeout ?? 300000,
        retries: body.retries ?? 3,
        config: body.config || {},
        createdBy: request.user?.userId,
      },
      include: {
        schedules: true,
      },
    });

    // Schedule the job if cron expression provided
    if (body.schedule && job.enabled) {
      await jobService.scheduleJob(job as unknown as Job, body.schedule);
    }

    return reply.status(201).send({
      success: true,
      data: job,
    });
  });

  // Update job
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateJobSchema.parse(request.body);

    // Check job exists
    const existingJob = await prisma.job.findUnique({
      where: { id },
      include: { schedules: true },
    });

    if (!existingJob) {
      return reply.status(404).send({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
      });
    }

    // Check if job is currently running (warn but allow update)
    const runningExecution = await prisma.jobExecution.findFirst({
      where: {
        jobId: id,
        status: 'RUNNING',
      },
    });

    // Validate cron expression if provided (and not null - null means remove schedule)
    if (body.schedule && !validateCronExpression(body.schedule)) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid cron expression',
      });
    }

    // Update job
    const job = await prisma.job.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        handler: body.handler,
        schedule: body.schedule,
        enabled: body.enabled,
        timeout: body.timeout,
        retries: body.retries,
        config: body.config,
      },
      include: {
        schedules: true,
      },
    });

    // Determine if we need to update the BullMQ schedule
    const scheduleChanged = body.schedule !== undefined;
    const enabledChanged = body.enabled !== undefined && body.enabled !== existingJob.enabled;
    const newEnabled = body.enabled ?? existingJob.enabled;
    const newSchedule = body.schedule !== undefined ? body.schedule : existingJob.schedule;

    // Update BullMQ schedule when schedule or enabled status changes
    if (scheduleChanged || enabledChanged) {
      // First, unschedule the existing job
      await jobService.unscheduleJob(job.id);

      // Then reschedule if job is enabled and has a valid schedule
      if (newEnabled && newSchedule) {
        await jobService.scheduleJob(job as unknown as Job, newSchedule);
      }
    }

    return reply.send({
      success: true,
      data: job,
      warning: runningExecution
        ? 'Job is currently running. Changes will apply to future executions.'
        : undefined,
    });
  });

  // Delete job
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    // Check job exists
    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
      });
    }

    // Unschedule the job
    await jobService.unscheduleJob(id);

    // Delete job (cascades to schedules and executions)
    await prisma.job.delete({
      where: { id },
    });

    return reply.send({
      success: true,
      message: 'Job deleted successfully',
    });
  });

  // Execute job manually
  fastify.post('/:id/execute', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      return reply.status(404).send({
        success: false,
        error: ERROR_MESSAGES.JOB_NOT_FOUND,
      });
    }

    if (!job.enabled) {
      return reply.status(400).send({
        success: false,
        error: 'Job is disabled',
      });
    }

    // Trigger job execution
    const bullJobId = await jobService.triggerJob(job as unknown as Job);

    return reply.send({
      success: true,
      message: 'Job queued for execution',
      bullJobId,
    });
  });

  // Enable job
  fastify.put('/:id/enable', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.update({
      where: { id },
      data: { enabled: true },
      include: { schedules: true },
    });

    // Schedule the job
    if (job.schedule) {
      await jobService.scheduleJob(job as unknown as Job, job.schedule);
    }

    return reply.send({
      success: true,
      data: job,
    });
  });

  // Disable job
  fastify.put('/:id/disable', async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.job.update({
      where: { id },
      data: { enabled: false },
    });

    // Unschedule the job
    await jobService.unscheduleJob(id);

    return reply.send({
      success: true,
      data: job,
    });
  });

  // Get queue metrics
  fastify.get('/metrics/queue', async (_request, reply) => {
    const metrics = await jobService.getMetrics();

    return reply.send({
      success: true,
      data: metrics,
    });
  });

  // Get worker status
  fastify.get('/metrics/worker', async (_request, reply) => {
    const metrics = await jobService.getMetrics();

    return reply.send({
      success: true,
      data: metrics,
    });
  });

  // Clear handler cache (useful after module updates)
  fastify.post('/cache/clear', async (request, reply) => {
    const { moduleId } = request.body as { moduleId?: string };

    jobExecutorService.clearCache(moduleId);

    return reply.send({
      success: true,
      message: moduleId
        ? `Cache cleared for module ${moduleId}`
        : 'Cache cleared for all modules',
    });
  });
};
