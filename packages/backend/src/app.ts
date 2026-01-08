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
    origin: env.NODE_ENV === 'development' ? '*' : false,
    credentials: true,
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
  app.get('/health/ready', async () => {
    // TODO: Add database and Redis connection checks
    return {
      status: 'ok',
      checks: {
        database: 'ok',
        redis: 'ok',
      },
    };
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
