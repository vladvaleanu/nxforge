/**
 * Fastify application setup
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { env } from './config/env';
import { logger } from './config/logger';
import { authRoutes } from './routes/auth.routes';
import { prisma } from './lib/prisma';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    trustProxy: true,
  });

  // Register CORS
  await app.register(cors, {
    origin: true, // Allow all origins for now (development)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Register JWT
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
    };
  });

  // Liveness probe (k8s)
  app.get('/health/live', async () => {
    return { status: 'ok' };
  });

  // Readiness probe (k8s) - check dependencies
  app.get('/health/ready', async (request: any, reply: any) => {
    const checks: Record<string, string> = {};

    // Check database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch (err) {
      checks.database = 'error';
      request.log.error(err, 'Database health check failed');
    }

    // Check Redis (placeholder for future implementation)
    checks.redis = 'not_configured';

    const allHealthy = Object.values(checks).every(status => status === 'ok' || status === 'not_configured');
    const statusCode = allHealthy ? 200 : 503;

    reply.status(statusCode).send({
      status: allHealthy ? 'ok' : 'degraded',
      checks,
    });
  });

  // API version prefix
  await app.register(async (instance) => {
    // Register authentication routes
    await instance.register(authRoutes, { prefix: '/auth' });
  }, { prefix: '/api/v1' });

  // Global error handler
  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;

    request.log.error({
      error: {
        message: error.message,
        stack: error.stack,
        statusCode,
      },
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
      },
    });

    reply.status(statusCode).send({
      success: false,
      error: {
        message: error.message,
        statusCode,
        ...(env.NODE_ENV === 'development' && { stack: error.stack }),
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        message: 'Route not found',
        statusCode: 404,
        path: request.url,
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  return app;
}
