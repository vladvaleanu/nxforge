/**
 * Dashboard Routes
 * /api/v1/dashboard/*
 * Provides dashboard statistics for all authenticated users
 */

import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { jobService } from '../services/job.service';
import { requireAuth } from '../middleware/auth.middleware';

export async function dashboardRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('onRequest', requireAuth);

  /**
   * GET /api/v1/dashboard/stats
   * Get dashboard statistics
   */
  app.get('/stats', async (_request, reply) => {
    try {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get counts in parallel
      const [
        totalModules,
        activeModules,
        totalJobs,
        enabledJobs,
        totalExecutions,
        recentExecutions,
        executionsByStatus,
        recentExecutionsList,
      ] = await Promise.all([
        prisma.module.count(),
        prisma.module.count({ where: { status: 'ENABLED' } }),
        prisma.job.count(),
        prisma.job.count({ where: { enabled: true } }),
        prisma.jobExecution.count(),
        prisma.jobExecution.count({
          where: { startedAt: { gte: last24h } },
        }),
        prisma.jobExecution.groupBy({
          by: ['status'],
          _count: true,
          where: { startedAt: { gte: last24h } },
        }),
        prisma.jobExecution.findMany({
          take: 10,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            job: {
              select: {
                id: true,
                name: true,
                module: {
                  select: {
                    name: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        }),
      ]);

      // Get queue metrics
      let queueMetrics = null;
      try {
        queueMetrics = await jobService.getMetrics();
      } catch {
        // Queue might not be available
      }

      // Calculate success rate
      const statusCounts = executionsByStatus.reduce((acc, item) => {
        acc[item.status.toLowerCase()] = item._count;
        return acc;
      }, {} as Record<string, number>);

      const successCount = statusCounts['completed'] || 0;
      const failedCount = statusCounts['failed'] || 0;
      const totalRecent = successCount + failedCount;
      const successRate = totalRecent > 0 ? Math.round((successCount / totalRecent) * 100) : 100;

      // Get executions over last 7 days for chart
      const executionTrend = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
        SELECT DATE("startedAt") as date, COUNT(*) as count
        FROM job_executions
        WHERE "startedAt" >= ${last7d}
        GROUP BY DATE("startedAt")
        ORDER BY date ASC
      `;

      reply.send({
        success: true,
        data: {
          modules: {
            total: totalModules,
            active: activeModules,
            inactive: totalModules - activeModules,
          },
          jobs: {
            total: totalJobs,
            enabled: enabledJobs,
            disabled: totalJobs - enabledJobs,
          },
          executions: {
            total: totalExecutions,
            last24h: recentExecutions,
            successRate,
            byStatus: statusCounts,
          },
          queue: queueMetrics,
          recentExecutions: recentExecutionsList.map((exec) => ({
            id: exec.id,
            status: exec.status,
            startedAt: exec.startedAt,
            completedAt: exec.completedAt,
            jobName: exec.job.name,
            jobId: exec.job.id,
            moduleName: exec.job.module?.displayName || exec.job.module?.name || 'Unknown',
          })),
          executionTrend: executionTrend.map((item) => ({
            date: item.date,
            count: Number(item.count),
          })),
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
   * GET /api/v1/dashboard/layout
   * Get user's dashboard layout preferences
   */
  app.get('/layout', async (request, reply) => {
    try {
      const user = request.user as { userId: string };

      const preferences = await prisma.userPreference.findUnique({
        where: {
          userId_key: {
            userId: user.userId,
            key: 'dashboard_layout',
          },
        },
      });

      reply.send({
        success: true,
        data: preferences?.value ? JSON.parse(preferences.value) : null,
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
   * PUT /api/v1/dashboard/layout
   * Save user's dashboard layout preferences
   */
  app.put('/layout', async (request, reply) => {
    try {
      const user = request.user as { userId: string };
      const { layout, locked } = request.body as { layout: any[]; locked: boolean };

      await prisma.userPreference.upsert({
        where: {
          userId_key: {
            userId: user.userId,
            key: 'dashboard_layout',
          },
        },
        update: {
          value: JSON.stringify({ layout, locked }),
        },
        create: {
          userId: user.userId,
          key: 'dashboard_layout',
          value: JSON.stringify({ layout, locked }),
        },
      });

      reply.send({
        success: true,
        data: { message: 'Layout saved successfully' },
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
