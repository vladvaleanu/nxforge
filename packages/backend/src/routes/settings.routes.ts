/**
 * System Settings Routes (Admin only)
 * /api/v1/settings/*
 */

import { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth.middleware';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { jobService } from '../services/job.service';

export async function settingsRoutes(app: FastifyInstance) {
  // All routes require admin role
  app.addHook('onRequest', requireRole('admin'));

  /**
   * GET /api/v1/settings/system
   * Get system information and settings
   */
  app.get('/system', async (_request, reply) => {
    try {
      // Get database stats
      const [userCount, moduleCount, jobCount, executionCount] = await Promise.all([
        prisma.user.count(),
        prisma.module.count(),
        prisma.job.count(),
        prisma.jobExecution.count(),
      ]);

      // Get job queue metrics
      let queueMetrics = null;
      try {
        queueMetrics = await jobService.getMetrics();
      } catch (e) {
        // Queue might not be available
      }

      // Get recent execution stats
      const recentExecutions = await prisma.jobExecution.groupBy({
        by: ['status'],
        _count: true,
        where: {
          startedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      const executionStats = recentExecutions.reduce((acc, item) => {
        acc[item.status.toLowerCase()] = item._count;
        return acc;
      }, {} as Record<string, number>);

      reply.send({
        success: true,
        data: {
          environment: env.NODE_ENV,
          version: process.env.npm_package_version || '4.0.0',
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          memory: {
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
          database: {
            users: userCount,
            modules: moduleCount,
            jobs: jobCount,
            executions: executionCount,
          },
          queue: queueMetrics,
          recentExecutions: executionStats,
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });

  /**
   * GET /api/v1/settings/modules
   * Get module statistics
   */
  app.get('/modules', async (_request, reply) => {
    try {
      const modules = await prisma.module.findMany({
        select: {
          id: true,
          name: true,
          displayName: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              jobs: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      reply.send({
        success: true,
        data: modules,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });

  /**
   * POST /api/v1/settings/cache/clear
   * Clear various caches
   */
  app.post('/cache/clear', async (request, reply) => {
    try {
      const { type } = request.body as { type?: string };

      // For now, we can clear the job handler cache
      if (!type || type === 'jobs') {
        const { jobExecutorService } = await import('../services/job-executor.service.js');
        jobExecutorService.clearCache();
      }

      reply.send({
        success: true,
        data: { message: 'Cache cleared successfully' },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });

  /**
   * POST /api/v1/settings/maintenance/cleanup
   * Run maintenance cleanup tasks
   */
  app.post('/maintenance/cleanup', async (_request, reply) => {
    try {
      const results: Record<string, number> = {};

      // Clean up old job executions (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deletedExecutions = await prisma.jobExecution.deleteMany({
        where: {
          completedAt: { lt: thirtyDaysAgo },
        },
      });
      results.deletedExecutions = deletedExecutions.count;

      // Clean up expired sessions
      const deletedSessions = await prisma.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { revokedAt: { not: null } },
          ],
        },
      });
      results.deletedSessions = deletedSessions.count;

      // Clean up old audit logs (older than 90 days)
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deletedAuditLogs = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: ninetyDaysAgo },
        },
      });
      results.deletedAuditLogs = deletedAuditLogs.count;

      // Clean up orphaned jobs in Redis
      try {
        const orphanedResult = await jobService.cleanupOrphanedJobs();
        results.orphanedJobs = orphanedResult.removed;
      } catch (e) {
        results.orphanedJobs = 0;
      }

      reply.send({
        success: true,
        data: {
          message: 'Cleanup completed',
          results,
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });

  /**
   * GET /api/v1/settings/audit-logs
   * Get recent audit logs
   */
  app.get('/audit-logs', async (request, reply) => {
    try {
      const { page = '1', limit = '50' } = request.query as { page?: string; limit?: string };
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma.auditLog.count(),
      ]);

      reply.send({
        success: true,
        data: logs,
        meta: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(500).send({
        success: false,
        error: { message: error.message, statusCode: 500 },
      });
    }
  });
}
