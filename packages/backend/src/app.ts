/**
 * Fastify application setup
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { logger } from './config/logger';
import { authRoutes } from './routes/auth.routes';
import { prisma } from './lib/prisma';
import { browserService } from './services/browser.service';
import { ModuleLoaderService } from './services/module-loader.service';
import { errorHandler, notFoundHandler } from './middleware/error-handler.middleware';

export async function buildApp(): Promise<FastifyInstance> {
  logger.info('Building Fastify app...');

  const app = Fastify({
    logger: logger as any, // Use our configured Pino logger
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    trustProxy: true,
    // Request size limits
    bodyLimit: 5 * 1024 * 1024, // 5MB max body size
    connectionTimeout: 30000, // 30 seconds
    keepAliveTimeout: 5000,
  });

  logger.info('Fastify instance created');

  // Decorate app with services for modules
  app.decorate('prisma', prisma);
  app.decorate('browserService', browserService);

  // CORS configuration with origin validation
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin;

    // In development, allow all origins. In production, validate against whitelist
    const allowedOrigins = env.NODE_ENV === 'development'
      ? [origin || '*']  // Dev: allow any origin
      : (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean); // Prod: whitelist

    const isAllowed = env.NODE_ENV === 'development' ||
      (origin && allowedOrigins.includes(origin));

    if (isAllowed) {
      reply.header('Access-Control-Allow-Origin', origin || '*');
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    reply.header('Access-Control-Expose-Headers', 'Content-Type, Authorization');
    reply.header('Access-Control-Max-Age', '86400');

    // Security headers
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return reply.status(204).send();
    }
  });

  // Register rate limiting
  await app.register(rateLimit, {
    max: env.NODE_ENV === 'development' ? 1000 : 100, // Requests per timeWindow
    timeWindow: 60 * 1000, // 1 minute window
    cache: 10000, // Store rate limit info for 10k IPs
    allowList: env.NODE_ENV === 'development' ? ['127.0.0.1'] : [], // Exempt localhost in dev
    redis: null, // Use in-memory store (can switch to Redis later for distributed)
    skipOnError: false, // Block requests if rate limiter fails to prevent DoS bypass
    // Custom key generator (use IP address)
    keyGenerator: (request) => {
      return request.ip || request.headers['x-real-ip'] as string || request.headers['x-forwarded-for'] as string || 'unknown';
    },
    // Error response when rate limit exceeded
    errorResponseBuilder: (_request, context) => {
      return {
        success: false,
        error: 'Too many requests. Please try again later.',
        statusCode: 429,
        retryAfter: context.after,
      };
    },
    // Add custom headers
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });

  logger.info('Rate limiting configured');

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

    // Register module registry routes
    try {
      app.log.info('Attempting to import module routes...');
      const { modulesRoutes } = await import('./routes/modules.routes.js');
      app.log.info('Module routes imported successfully');

      app.log.info('Registering module routes...');
      await instance.register(modulesRoutes, { prefix: '/modules' });
      app.log.info('Module routes registered successfully');
    } catch (error) {
      app.log.error(error, 'Failed to load/register module routes');
      throw error;
    }

    // Register job management routes (Phase 3)
    try {
      app.log.info('Attempting to import job routes...');
      const { jobsRoutes } = await import('./routes/jobs.routes.js');
      app.log.info('Job routes imported successfully');

      app.log.info('Registering job routes...');
      await instance.register(jobsRoutes, { prefix: '/jobs' });
      app.log.info('Job routes registered successfully');
    } catch (error) {
      app.log.error(error, 'Failed to load/register job routes');
      throw error;
    }

    // Register execution routes (Phase 3)
    try {
      app.log.info('Attempting to import execution routes...');
      const { executionsRoutes } = await import('./routes/executions.routes.js');
      app.log.info('Execution routes imported successfully');

      app.log.info('Registering execution routes...');
      await instance.register(executionsRoutes, { prefix: '/executions' });
      app.log.info('Execution routes registered successfully');
    } catch (error) {
      app.log.error(error, 'Failed to load/register execution routes');
      throw error;
    }

    // Register event routes (Phase 3)
    try {
      app.log.info('Attempting to import event routes...');
      const { eventsRoutes } = await import('./routes/events.routes.js');
      app.log.info('Event routes imported successfully');

      app.log.info('Registering event routes...');
      await instance.register(eventsRoutes, { prefix: '/events' });
      app.log.info('Event routes registered successfully');
    } catch (error) {
      app.log.error(error, 'Failed to load/register event routes');
      throw error;
    }

    // NOTE: Endpoints and consumption routes have been moved to the consumption-monitor module
    // They are now loaded dynamically via the module system (see ModuleLoaderService)

    // Register user management routes (admin only)
    try {
      app.log.info('Attempting to import users routes...');
      const { usersRoutes } = await import('./routes/users.routes.js');
      app.log.info('Users routes imported successfully');

      app.log.info('Registering users routes...');
      await instance.register(usersRoutes, { prefix: '/users' });
      app.log.info('Users routes registered successfully');
    } catch (error) {
      app.log.error(error, 'Failed to load/register users routes');
      throw error;
    }

    // Register system settings routes (admin only)
    try {
      app.log.info('Attempting to import settings routes...');
      const { settingsRoutes } = await import('./routes/settings.routes.js');
      app.log.info('Settings routes imported successfully');

      app.log.info('Registering settings routes...');
      await instance.register(settingsRoutes, { prefix: '/settings' });
      app.log.info('Settings routes registered successfully');
    } catch (error) {
      app.log.error(error, 'Failed to load/register settings routes');
      throw error;
    }

    // Register dashboard routes (authenticated users)
    try {
      app.log.info('Attempting to import dashboard routes...');
      const { dashboardRoutes } = await import('./routes/dashboard.routes.js');
      app.log.info('Dashboard routes imported successfully');

      app.log.info('Registering dashboard routes...');
      await instance.register(dashboardRoutes, { prefix: '/dashboard' });
      app.log.info('Dashboard routes registered successfully');
    } catch (error) {
      app.log.error(error, 'Failed to load/register dashboard routes');
      throw error;
    }

  }, { prefix: '/api/v1' });

  // Register standardized error handlers (must be after all routes)
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  logger.info('Error handlers registered');
  logger.info('App build complete, returning Fastify instance');
  logger.info(`Registered routes: ${app.printRoutes()}`);

  // Initialize module loader service with Fastify instance
  ModuleLoaderService.initialize(app);

  // Load all enabled modules
  try {
    await ModuleLoaderService.loadEnabledModules();
  } catch (error) {
    logger.error(error, 'Failed to load enabled modules on startup');
    // Don't throw - allow server to start even if module loading fails
  }

  return app;
}
