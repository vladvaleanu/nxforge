/**
 * Event API Routes
 * Handles event emission, history, and statistics
 */

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { eventBusService } from '../services/event-bus.service.js';
import { PAGINATION } from '../config/constants.js';
import { parsePagination, createPaginationMeta } from '../utils/pagination.utils.js';
import { createPaginatedResponse } from '../utils/response.utils.js';
import { buildWhereClause } from '../utils/query.utils.js';

// Validation schemas
const emitEventSchema = z.object({
  name: z.string().min(1),
  source: z.string().optional().default('api'),
  payload: z.record(z.any()).optional().default({}),
});

const listEventsSchema = z.object({
  name: z.string().optional(),
  source: z.string().optional(),
  since: z.string().datetime().optional(),
  page: z.string().regex(/^\d+$/).optional().default(String(PAGINATION.DEFAULT_PAGE)),
  limit: z.string().regex(/^\d+$/).optional().default(String(PAGINATION.DEFAULT_LIMIT)),
});

export const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  // Emit a new event
  fastify.post('/', async (request, reply) => {
    const body = emitEventSchema.parse(request.body);

    await eventBusService.emit(body.name, {
      ...body.payload,
      source: body.source,
    });

    return reply.send({
      success: true,
      message: 'Event emitted successfully',
    });
  });

  // List events
  fastify.get('/', async (request, reply) => {
    const query = listEventsSchema.parse(request.query);
    const { page, limit, skip } = parsePagination(query);

    const where = buildWhereClause({
      name: query.name,
      source: query.source,
      createdAt: query.since ? { gte: new Date(query.since) } : undefined,
    });

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.event.count({ where }),
    ]);

    return reply.send(
      createPaginatedResponse(events, createPaginationMeta(page, limit, total))
    );
  });

  // Get event by ID
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return reply.status(404).send({
        success: false,
        error: 'Event not found', // TODO: Add to ERROR_MESSAGES constant
      });
    }

    return reply.send({
      success: true,
      data: event,
    });
  });

  // Get recent events (last 100)
  fastify.get('/recent', async (request, reply) => {
    const { name } = request.query as { name?: string };
    const events = await eventBusService.getRecentEvents(100, name);

    return reply.send({
      success: true,
      data: events,
    });
  });

  // Get event statistics
  fastify.get('/stats/summary', async (_request, reply) => {
    const [total, last24h, last7d] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.event.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get top event names
    const topEvents = await prisma.event.groupBy({
      by: ['name'],
      _count: {
        name: true,
      },
      orderBy: {
        _count: {
          name: 'desc',
        },
      },
      take: 10,
    });

    // Get top sources
    const topSources = await prisma.event.groupBy({
      by: ['source'],
      _count: {
        source: true,
      },
      orderBy: {
        _count: {
          source: 'desc',
        },
      },
      take: 10,
    });

    return reply.send({
      success: true,
      data: {
        total,
        last24h,
        last7d,
        topEvents: topEvents.map((e) => ({
          name: e.name,
          count: e._count.name,
        })),
        topSources: topSources.map((s) => ({
          source: s.source,
          count: s._count.source,
        })),
      },
    });
  });

  // Get event subscriptions
  fastify.get('/subscriptions', async (_request, reply) => {
    const stats = eventBusService.getStats();

    return reply.send({
      success: true,
      data: stats,
    });
  });

  // Clear old events
  fastify.delete('/cleanup', async (request, reply) => {
    const { days } = request.query as { days?: string };
    const olderThanDays = days ? parseInt(days) : 30;

    const deletedCount = await eventBusService.clearOldEvents(olderThanDays);

    return reply.send({
      success: true,
      message: `Cleared ${deletedCount} events older than ${olderThanDays} days`,
      data: {
        deletedCount,
        olderThanDays,
      },
    });
  });
};
