/**
 * Consumption Monitor Routes
 * API endpoints for querying and aggregating power consumption data
 */

import type { FastifyInstance } from 'fastify';
import { ModuleContext } from '../types/index.js';
import { scrape, type AuthConfig, type ScrapingConfig } from '../lib/scraper.js';

interface ReadingsQuery {
  endpointId?: string;
  from?: string;
  to?: string;
  limit?: number;
  success?: boolean;
}

interface MonthlyParams {
  endpointId: string;
}

interface MonthlyQuery {
  year?: number;
  month?: number;
}

interface SummaryQuery {
  period?: 'hour' | 'day' | 'week' | 'month';
}

/**
 * Register consumption monitoring routes
 */
export async function registerRoutes(fastify: FastifyInstance, context: ModuleContext) {
  const { prisma, logger, browser } = context.services;

  // GET /readings - Query consumption readings
  fastify.get<{ Querystring: ReadingsQuery }>('/readings', async (request) => {
    const { endpointId, from, to, limit: limitStr = '100', success } = request.query;
    const requestedLimit = parseInt(limitStr as any, 10) || 100;

    // Enforce maximum limit to prevent excessive database queries
    const MAX_LIMIT = 1000;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_LIMIT);

    const where: any = {};
    if (endpointId) where.endpointId = endpointId;
    if (success !== undefined) where.success = success;

    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    const [readings, total] = await Promise.all([
      prisma.consumptionReading.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          endpointId: true,
          timestamp: true,
          totalKwh: true,
          currentKwh: true,
          voltage: true,
          current: true,
          power: true,
          powerFactor: true,
          success: true,
          errorMessage: true,
        },
      }),
      prisma.consumptionReading.count({ where }),
    ]);

    return {
      success: true,
      data: readings,
      meta: {
        total,
        from: from || null,
        to: to || null,
      },
    };
  });

  // GET /monthly/:endpointId - Get monthly consumption summary
  fastify.get<{ Params: MonthlyParams; Querystring: MonthlyQuery }>(
    '/monthly/:endpointId',
    async (request) => {
      const { endpointId } = request.params;
      const { year, month } = request.query;

      const targetYear = year || new Date().getFullYear();
      const targetMonth = month !== undefined ? month : new Date().getMonth() + 1;

      // Get first and last day of the month
      const firstDay = new Date(targetYear, targetMonth - 1, 1);
      const lastDay = new Date(targetYear, targetMonth, 0, 23, 59, 59);

      // Get all readings for the month
      const readings = await prisma.consumptionReading.findMany({
        where: {
          endpointId,
          timestamp: {
            gte: firstDay,
            lte: lastDay,
          },
          success: true,
          totalKwh: { not: null },
        },
        orderBy: { timestamp: 'asc' },
        select: {
          timestamp: true,
          totalKwh: true,
        },
      });

      if (readings.length === 0) {
        return {
          success: true,
          data: {
            year: targetYear,
            month: targetMonth,
            startKwh: null,
            endKwh: null,
            consumption: null,
            readingCount: 0,
          },
        };
      }

      const startKwh = readings[0].totalKwh!;
      const endKwh = readings[readings.length - 1].totalKwh!;
      const consumption = endKwh - startKwh;

      return {
        success: true,
        data: {
          year: targetYear,
          month: targetMonth,
          startKwh,
          endKwh,
          consumption,
          readingCount: readings.length,
          firstReading: readings[0].timestamp,
          lastReading: readings[readings.length - 1].timestamp,
        },
      };
    }
  );

  // GET /monthly-summary - Get monthly consumption summary for all endpoints (for reports)
  // OPTIMIZED: Single query instead of N+1 queries (1 query for endpoints + N queries for readings)
  fastify.get('/monthly-summary', async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Get first and last day of current month
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const lastDay = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    // OPTIMIZED: Single query to fetch all endpoints with their readings for the month
    // This replaces the N+1 pattern (1 query for endpoints + N queries for each endpoint's readings)
    const endpointsWithReadings = await prisma.endpoint.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        clientName: true,
        location: true,
        readings: {
          where: {
            timestamp: {
              gte: firstDay,
              lte: lastDay,
            },
            success: true,
            totalKwh: { not: null },
          },
          orderBy: { timestamp: 'asc' },
          select: {
            timestamp: true,
            totalKwh: true,
          },
        },
      },
    });

    // Process the data in application code (O(n) - single pass through endpoints)
    type EndpointWithReadings = (typeof endpointsWithReadings)[number];
    const monthlyData = endpointsWithReadings.map((endpoint: EndpointWithReadings) => {
      const readings = endpoint.readings;

      if (readings.length === 0) {
        return {
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          clientName: endpoint.clientName,
          location: endpoint.location,
          currentKwh: null,
          previousKwh: null,
          consumedKwh: null,
          lastReadingAt: null,
          readingsCount: 0,
        };
      }

      const firstReading = readings[0];
      const lastReading = readings[readings.length - 1];
      const previousKwh = firstReading.totalKwh!;
      const currentKwh = lastReading.totalKwh!;
      const consumedKwh = currentKwh - previousKwh;

      return {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        clientName: endpoint.clientName,
        location: endpoint.location,
        currentKwh,
        previousKwh,
        consumedKwh,
        lastReadingAt: lastReading.timestamp,
        readingsCount: readings.length,
      };
    });

    return {
      success: true,
      data: monthlyData,
    };
  });

  // GET /summary - Get consumption summary for all endpoints
  fastify.get<{ Querystring: SummaryQuery }>('/summary', async (request) => {
    const { period = 'day' } = request.query;

    // Calculate time range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'hour':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get all endpoints with their recent readings
    const endpoints = await prisma.endpoint.findMany({
      where: { enabled: true },
      select: {
        id: true,
        name: true,
        clientName: true,
        location: true,
        readings: {
          where: {
            timestamp: { gte: startDate },
            success: true,
            totalKwh: { not: null },
          },
          orderBy: { timestamp: 'asc' },
          select: {
            timestamp: true,
            totalKwh: true,
            power: true,
          },
        },
      },
    });

    const summary = endpoints.map((endpoint: any) => {
      const readings = endpoint.readings;

      if (readings.length === 0) {
        return {
          endpointId: endpoint.id,
          endpointName: endpoint.name,
          clientName: endpoint.clientName,
          location: endpoint.location,
          consumption: null,
          avgPower: null,
          readingCount: 0,
        };
      }

      const startKwh = readings[0].totalKwh!;
      const endKwh = readings[readings.length - 1].totalKwh!;
      const consumption = endKwh - startKwh;

      // Calculate average power from readings that have power data
      const powerReadings = readings.filter((r: any) => r.power !== null);
      const avgPower =
        powerReadings.length > 0
          ? powerReadings.reduce((sum: number, r: any) => sum + r.power!, 0) / powerReadings.length
          : null;

      return {
        endpointId: endpoint.id,
        endpointName: endpoint.name,
        clientName: endpoint.clientName,
        location: endpoint.location,
        consumption,
        avgPower,
        readingCount: readings.length,
        firstReading: readings[0].timestamp,
        lastReading: readings[readings.length - 1].timestamp,
      };
    });

    return {
      success: true,
      data: {
        period,
        startDate,
        endDate: now,
        endpoints: summary,
        totalConsumption: summary.reduce((sum: number, e: any) => sum + (e.consumption || 0), 0),
      },
    };
  });

  // GET /live - Get latest reading for each endpoint (live dashboard)
  fastify.get('/live', async () => {
    const allEndpoints = await prisma.endpoint.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        clientName: true,
        location: true,
        enabled: true,
        lastReadAt: true,
        readings: {
          take: 1,
          orderBy: { timestamp: 'desc' },
          select: {
            timestamp: true,
            totalKwh: true,
            currentKwh: true,
            voltage: true,
            current: true,
            power: true,
            success: true,
            errorMessage: true,
          },
        },
      },
    });

    const endpointsData = allEndpoints.map((endpoint: any) => {
      const latestReading = endpoint.readings[0] || null;

      return {
        id: endpoint.id,
        name: endpoint.name,
        clientName: endpoint.clientName,
        location: endpoint.location,
        enabled: endpoint.enabled,
        lastReading: latestReading
          ? {
            timestamp: latestReading.timestamp,
            totalKwh: latestReading.totalKwh || 0,
            voltage: latestReading.voltage,
            current: latestReading.current,
            power: latestReading.power,
          }
          : undefined,
        status: latestReading?.success ? 'online' : latestReading ? 'error' : 'offline',
      };
    });

    // Calculate summary
    const activeEndpoints = endpointsData.filter((e: any) => e.status === 'online' && e.enabled);

    const totalKwh = endpointsData.reduce((sum: number, e: any) => sum + (e.lastReading?.totalKwh || 0), 0);

    // Get monthly consumption (simplified - just current readings for now)
    const monthlyConsumption = totalKwh;

    return {
      success: true,
      data: {
        endpoints: endpointsData,
        summary: {
          totalEndpoints: allEndpoints.length,
          activeEndpoints: activeEndpoints.length,
          totalKwh,
          monthlyConsumption,
        },
      },
      timestamp: new Date(),
    };
  });

  // ============================================================================
  // Endpoints CRUD Routes
  // ============================================================================

  // GET /endpoints - List all endpoints
  fastify.get('/endpoints', async () => {
    const endpoints = await prisma.endpoint.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        type: true,
        vendor: true,
        location: true,
        clientName: true,
        authType: true,
        authConfig: true,
        scrapingConfig: true,
        enabled: true,
        pollInterval: true,
        lastReadAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: endpoints,
    };
  });

  // GET /endpoints/:id - Get endpoint by ID
  fastify.get<{ Params: { id: string } }>('/endpoints/:id', async (request, reply) => {
    const { id } = request.params;

    const endpoint = await prisma.endpoint.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        ipAddress: true,
        type: true,
        vendor: true,
        location: true,
        clientName: true,
        authType: true,
        authConfig: true,
        scrapingConfig: true,
        enabled: true,
        pollInterval: true,
        lastReadAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!endpoint) {
      return reply.status(404).send({
        success: false,
        error: { message: 'Endpoint not found', statusCode: 404 },
      });
    }

    return {
      success: true,
      data: endpoint,
    };
  });

  // POST /endpoints - Create new endpoint
  fastify.post<{
    Body: {
      name: string;
      ipAddress: string;
      type: string;
      vendor?: string;
      location?: string;
      clientName?: string;
      authType: 'none' | 'basic' | 'form';
      authConfig?: any;
      scrapingConfig: any;
      enabled?: boolean;
      pollInterval?: number;
    };
  }>('/endpoints', async (request) => {
    const {
      name,
      ipAddress,
      type,
      vendor,
      location,
      clientName,
      authType,
      authConfig,
      scrapingConfig,
      enabled = true,
      pollInterval = 300,
    } = request.body;

    const endpoint = await prisma.endpoint.create({
      data: {
        name,
        ipAddress,
        type,
        vendor,
        location,
        clientName,
        authType,
        authConfig,
        scrapingConfig,
        enabled,
        pollInterval,
      },
    });

    return {
      success: true,
      data: endpoint,
    };
  });

  // PUT /endpoints/:id - Update endpoint
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      ipAddress?: string;
      type?: string;
      vendor?: string;
      location?: string;
      clientName?: string;
      authType?: 'none' | 'basic' | 'form';
      authConfig?: any;
      scrapingConfig?: any;
      enabled?: boolean;
      pollInterval?: number;
    };
  }>('/endpoints/:id', async (request, reply) => {
    const { id } = request.params;
    const updateData = request.body;

    const existing = await prisma.endpoint.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { message: 'Endpoint not found', statusCode: 404 },
      });
    }

    const endpoint = await prisma.endpoint.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      data: endpoint,
    };
  });

  // DELETE /endpoints/:id - Delete endpoint
  fastify.delete<{ Params: { id: string } }>('/endpoints/:id', async (request, reply) => {
    const { id } = request.params;

    const existing = await prisma.endpoint.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({
        success: false,
        error: { message: 'Endpoint not found', statusCode: 404 },
      });
    }

    await prisma.endpoint.delete({ where: { id } });

    return {
      success: true,
      data: { message: 'Endpoint deleted successfully' },
    };
  });

  // POST /endpoints/:id/test - Test endpoint scraping configuration
  fastify.post<{ Params: { id: string } }>('/endpoints/:id/test', async (request, reply) => {
    const { id } = request.params;

    const endpoint = await prisma.endpoint.findUnique({ where: { id } });
    if (!endpoint) {
      return reply.status(404).send({
        success: false,
        error: { message: 'Endpoint not found', statusCode: 404 },
      });
    }

    try {
      // Use the core browserService via the scraper utility
      const result = await scrape(
        browser,
        `http://${endpoint.ipAddress}`,
        endpoint.authType as 'none' | 'basic' | 'form',
        endpoint.authConfig as AuthConfig | null,
        endpoint.scrapingConfig as ScrapingConfig | null,
        { screenshotOnError: true },
        logger
      );

      if (!result.success) {
        return reply.status(400).send({
          success: false,
          error: {
            message: result.error || 'Scraping failed',
            statusCode: 400
          },
          data: {
            success: false,
            error: result.error,
            screenshot: result.screenshot,
          },
        });
      }

      return {
        success: true,
        data: {
          success: true,
          value: result.value,
          unit: 'kWh',
          additionalData: result.additionalData,
          message: 'Scraping successful',
        },
      };
    } catch (error: any) {
      logger.error(`[Test Endpoint] Failed to test endpoint ${endpoint.name}: ${error.message}`);
      return reply.status(500).send({
        success: false,
        error: {
          message: `Test failed: ${error.message}`,
          statusCode: 500
        },
      });
    }
  });

  logger.info('[ConsumptionMonitor] Routes registered successfully');
}
