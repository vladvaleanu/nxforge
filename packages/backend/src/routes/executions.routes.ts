/**
 * Job Execution API Routes
 * Handles job execution history and logs
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { PAGINATION } from '../config/constants.js';
import { parsePagination, createPaginationMeta } from '../utils/pagination.utils.js';
import { createPaginatedResponse } from '../utils/response.utils.js';
import { buildWhereClause } from '../utils/query.utils.js';

// Validation schemas
const listExecutionsSchema = z.object({
  jobId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELLED']).optional(),
  page: z.string().regex(/^\d+$/).optional().default(String(PAGINATION.DEFAULT_PAGE)),
  limit: z.string().regex(/^\d+$/).optional().default(String(PAGINATION.DEFAULT_LIMIT)),
});

export const executionsRoutes: FastifyPluginAsync = async (fastify) => {
  // List job executions for a specific job
  fastify.get('/jobs/:jobId/executions', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const query = listExecutionsSchema.parse(request.query);
    const { page, limit, skip } = parsePagination(query);

    const where = buildWhereClause({
      jobId,
      status: query.status,
    });

    const [executions, total] = await Promise.all([
      prisma.jobExecution.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              name: true,
              moduleId: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.jobExecution.count({ where }),
    ]);

    return reply.send(
      createPaginatedResponse(executions, createPaginationMeta(page, limit, total))
    );
  });

  // List all executions (across all jobs)
  fastify.get('/', async (request, reply) => {
    const query = listExecutionsSchema.parse(request.query);
    const { page, limit, skip } = parsePagination(query);

    const where = buildWhereClause({
      jobId: query.jobId,
      status: query.status,
    });

    const [executions, total] = await Promise.all([
      prisma.jobExecution.findMany({
        where,
        include: {
          job: {
            select: {
              id: true,
              name: true,
              moduleId: true,
              handler: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.jobExecution.count({ where }),
    ]);

    return reply.send(
      createPaginatedResponse(executions, createPaginationMeta(page, limit, total))
    );
  });

  // Get execution by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const execution = await prisma.jobExecution.findUnique({
      where: { id },
      include: {
        job: true,
      },
    });

    if (!execution) {
      return reply.status(404).send({
        success: false,
        error: 'Execution not found', // TODO: Add to ERROR_MESSAGES constant
      });
    }

    return reply.send({
      success: true,
      data: execution,
    });
  });

  // Get execution logs
  fastify.get('/:id/logs', async (request, reply) => {
    const { id } = request.params as { id: string };

    const execution = await prisma.jobExecution.findUnique({
      where: { id },
      select: {
        id: true,
        logs: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!execution) {
      return reply.status(404).send({
        success: false,
        error: 'Execution not found', // TODO: Add to ERROR_MESSAGES constant
      });
    }

    return reply.send({
      success: true,
      data: {
        id: execution.id,
        logs: execution.logs || '',
        status: execution.status,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
      },
    });
  });

  // Delete execution
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const execution = await prisma.jobExecution.findUnique({
      where: { id },
    });

    if (!execution) {
      return reply.status(404).send({
        success: false,
        error: 'Execution not found', // TODO: Add to ERROR_MESSAGES constant
      });
    }

    await prisma.jobExecution.delete({
      where: { id },
    });

    return reply.send({
      success: true,
      message: 'Execution deleted successfully',
    });
  });

  // Get execution statistics
  fastify.get('/stats/summary', async (_request, reply) => {
    // Use groupBy to get all status counts in a single query instead of 7 separate queries
    const statusStats = await prisma.jobExecution.groupBy({
      by: ['status'],
      _count: {
        _all: true,
      },
    });

    // Build status counts object
    const statusCounts = statusStats.reduce((acc, stat) => {
      acc[stat.status.toLowerCase()] = stat._count._all;
      return acc;
    }, {} as Record<string, number>);

    // Calculate total
    const total = statusStats.reduce((sum, stat) => sum + stat._count._all, 0);

    // Extract individual status counts with defaults
    const pending = statusCounts.pending || 0;
    const running = statusCounts.running || 0;
    const completed = statusCounts.completed || 0;
    const failed = statusCounts.failed || 0;
    const timeout = statusCounts.timeout || 0;
    const cancelled = statusCounts.cancelled || 0;

    // Get average duration for completed jobs
    const avgDuration = await prisma.jobExecution.aggregate({
      where: {
        status: 'COMPLETED',
        duration: { not: null },
      },
      _avg: {
        duration: true,
      },
    });

    return reply.send({
      success: true,
      data: {
        total,
        byStatus: {
          pending,
          running,
          completed,
          failed,
          timeout,
          cancelled,
        },
        averageDuration: avgDuration._avg.duration || 0,
        successRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0,
      },
    });
  });

  // Get recent executions (last 24 hours)
  fastify.get('/stats/recent', async (_request, reply) => {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const executions = await prisma.jobExecution.findMany({
      where: {
        startedAt: {
          gte: last24Hours,
        },
      },
      include: {
        job: {
          select: {
            id: true,
            name: true,
            moduleId: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    return reply.send({
      success: true,
      data: executions,
    });
  });
};
