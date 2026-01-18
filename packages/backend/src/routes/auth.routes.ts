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

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  username: z.string().min(3).max(50).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app);

  /**
   * POST /api/v1/auth/register
   * Register new user
   * Rate limit: 3 registrations per hour per IP
   */
  app.post('/register', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: 60 * 60 * 1000, // 1 hour
      },
    },
  }, async (request, reply) => {
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
   * Stricter rate limit: 5 attempts per minute per IP
   */
  app.post('/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 60 * 1000, // 1 minute
      },
    },
  }, async (request, reply) => {
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
   * Get current user profile (basic)
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

  /**
   * GET /api/v1/auth/profile
   * Get current user profile with full details including sessions
   */
  app.get('/profile', { onRequest: [requireAuth] }, async (request, reply) => {
    try {
      const user = request.user as { userId: string };
      const profile = await authService.getProfile(user.userId);

      reply.status(200).send({
        success: true,
        data: profile,
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
   * PUT /api/v1/auth/profile
   * Update current user profile
   */
  app.put('/profile', { onRequest: [requireAuth] }, async (request, reply) => {
    try {
      const user = request.user as { userId: string };
      const data = updateProfileSchema.parse(request.body);

      const result = await authService.updateProfile(user.userId, data);

      reply.status(200).send({
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
   * PUT /api/v1/auth/password
   * Change current user password
   */
  app.put('/password', { onRequest: [requireAuth] }, async (request, reply) => {
    try {
      const user = request.user as { userId: string };
      const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);

      await authService.changePassword(user.userId, currentPassword, newPassword);

      reply.status(200).send({
        success: true,
        data: { message: 'Password changed successfully. All other sessions have been revoked.' },
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
   * DELETE /api/v1/auth/sessions/:sessionId
   * Revoke a specific session
   */
  app.delete('/sessions/:sessionId', { onRequest: [requireAuth] }, async (request, reply) => {
    try {
      const user = request.user as { userId: string };
      const { sessionId } = request.params as { sessionId: string };

      await authService.revokeSession(user.userId, sessionId);

      reply.status(200).send({
        success: true,
        data: { message: 'Session revoked successfully' },
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
   * DELETE /api/v1/auth/sessions
   * Revoke all other sessions (logout everywhere else)
   */
  app.delete('/sessions', { onRequest: [requireAuth] }, async (request, reply) => {
    try {
      const user = request.user as { userId: string };
      const { refreshToken } = refreshSchema.parse(request.body);

      const count = await authService.revokeOtherSessions(user.userId, refreshToken);

      reply.status(200).send({
        success: true,
        data: { message: `${count} other session(s) revoked successfully` },
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
}
