/**
 * Authentication middleware
 * Protects routes and validates JWT tokens
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { TokenPayload } from '../services/auth.service';

// Extend fastify-jwt module to include our custom user type
declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: TokenPayload;
  }
}

/**
 * Require authentication
 * Verifies JWT token and attaches user to request
 * Returns true if authenticated, false otherwise
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await request.jwtVerify();
    request.user = request.user as TokenPayload;
    return true;
  } catch (err) {
    reply.status(401).send({
      success: false,
      error: {
        message: 'Unauthorized - Invalid or missing token',
        statusCode: 401,
      },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
    return false;
  }
}

/**
 * Require specific role(s)
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const isAuthenticated = await requireAuth(request, reply);
    if (!isAuthenticated) {
      return; // Response already sent by requireAuth
    }

    const userRoles = request.user?.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role) || userRoles.includes('admin'));

    if (!hasRole) {
      reply.status(403).send({
        success: false,
        error: {
          message: `Forbidden - Requires one of: ${roles.join(', ')}`,
          statusCode: 403,
        },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
      return; // Stop execution after sending response
    }
  };
}

/**
 * Require specific permission(s)
 */
export function requirePermission(...permissions: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const isAuthenticated = await requireAuth(request, reply);
    if (!isAuthenticated) {
      return; // Response already sent by requireAuth
    }

    const userPermissions = request.user?.permissions || [];

    // Admin has all permissions
    if (userPermissions.includes('*:*')) {
      return;
    }

    const hasPermission = permissions.some(permission => {
      // Check exact match
      if (userPermissions.includes(permission)) return true;

      // Check wildcard match (e.g., "modules:*" matches "modules:read")
      const [resource] = permission.split(':');
      return userPermissions.includes(`${resource}:*`);
    });

    if (!hasPermission) {
      reply.status(403).send({
        success: false,
        error: {
          message: `Forbidden - Requires one of: ${permissions.join(', ')}`,
          statusCode: 403,
        },
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
      return; // Stop execution after sending response
    }
  };
}
