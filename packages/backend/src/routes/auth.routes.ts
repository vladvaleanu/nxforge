/**
 * Authentication routes
 * /api/v1/auth/*
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { requireAuth } from '../middleware/auth.middleware';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app);

  /**
   * POST /api/v1/auth/register
   * Register new user
   */
  app.post('/register', async (request, reply) => {
    try {
      const data = registerSchema.parse(request.body);

      const result = await authService.register(data);

      reply.status(201).send({
        success: true,
        data: result,
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: {
          message: error.message,
          statusCode: 400,
        },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * POST /api/v1/auth/login
   * Authenticate user and get tokens
   */
  app.post('/login', async (request, reply) => {
    try {
      const credentials = loginSchema.parse(request.body);

      const tokens = await authService.login(
        credentials,
        request.headers['user-agent'],
        request.ip
      );

      reply.status(200).send({
        success: true,
        data: tokens,
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(401).send({
        success: false,
        error: {
          message: error.message,
          statusCode: 401,
        },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token
   */
  app.post('/refresh', async (request, reply) => {
    try {
      const { refreshToken } = refreshSchema.parse(request.body);

      const tokens = await authService.refreshTokens(
        refreshToken,
        request.headers['user-agent'],
        request.ip
      );

      reply.status(200).send({
        success: true,
        data: tokens,
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(401).send({
        success: false,
        error: {
          message: error.message,
          statusCode: 401,
        },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * POST /api/v1/auth/logout
   * Revoke refresh token (logout)
   */
  app.post('/logout', { onRequest: [requireAuth] }, async (request, reply) => {
    try {
      const { refreshToken } = refreshSchema.parse(request.body);

      await authService.revokeToken(refreshToken);

      reply.status(200).send({
        success: true,
        data: { message: 'Logged out successfully' },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: {
          message: error.message,
          statusCode: 400,
        },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * GET /api/v1/auth/me
   * Get current user profile
   */
  app.get('/me', { onRequest: [requireAuth] }, async (request, reply) => {
    reply.status(200).send({
      success: true,
      data: {
        user: request.user,
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
