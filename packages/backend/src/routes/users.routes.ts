/**
 * User Management Routes (Admin only)
 * /api/v1/users/*
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { requireRole } from '../middleware/auth.middleware';
import { SECURITY, PAGINATION } from '../config/constants';
import { parsePagination, createPaginationMeta } from '../utils/pagination.utils';
import { createPaginatedResponse } from '../utils/response.utils';

// Validation schemas
const listUsersSchema = z.object({
  search: z.string().optional(),
  role: z.string().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.string().regex(/^\d+$/).optional().default(String(PAGINATION.DEFAULT_PAGE)),
  limit: z.string().regex(/^\d+$/).optional().default(String(PAGINATION.DEFAULT_LIMIT)),
});

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  roleId: z.string().uuid().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(50).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

const assignRoleSchema = z.object({
  roleId: z.string().uuid(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

export async function usersRoutes(app: FastifyInstance) {
  // All routes require admin role
  app.addHook('onRequest', requireRole('admin'));

  /**
   * GET /api/v1/users
   * List all users with pagination and filters
   */
  app.get('/', async (request, reply) => {
    try {
      const query = listUsersSchema.parse(request.query);
      const { page, limit, skip } = parsePagination(query);

      // Build where clause
      const where: any = {};

      if (query.search) {
        where.OR = [
          { email: { contains: query.search, mode: 'insensitive' } },
          { username: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      if (query.isActive !== undefined) {
        where.isActive = query.isActive === 'true';
      }

      if (query.role) {
        where.roles = {
          some: {
            role: {
              name: query.role,
            },
          },
        };
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            lastLogin: true,
            roles: {
              include: {
                role: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      // Transform roles for easier consumption
      const transformedUsers = users.map(user => ({
        ...user,
        roles: user.roles.map(ur => ur.role),
      }));

      reply.send(
        createPaginatedResponse(transformedUsers, createPaginationMeta(page, limit, total))
      );
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * GET /api/v1/users/roles
   * List all available roles
   */
  app.get('/roles', async (_request, reply) => {
    try {
      const roles = await prisma.role.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          permissions: true,
        },
        orderBy: { name: 'asc' },
      });

      reply.send({
        success: true,
        data: roles,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * GET /api/v1/users/:id
   * Get user by ID
   */
  app.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  permissions: true,
                },
              },
            },
          },
          sessions: {
            where: {
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            select: {
              id: true,
              userAgent: true,
              ipAddress: true,
              createdAt: true,
              expiresAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              auditLogs: true,
            },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { message: 'User not found', statusCode: 404 },
        });
      }

      reply.send({
        success: true,
        data: {
          ...user,
          roles: user.roles.map(ur => ur.role),
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * POST /api/v1/users
   * Create a new user (admin)
   */
  app.post('/', async (request, reply) => {
    try {
      const data = createUserSchema.parse(request.body);

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: data.email }, { username: data.username }],
        },
      });

      if (existingUser) {
        return reply.status(400).send({
          success: false,
          error: { message: 'User with this email or username already exists', statusCode: 400 },
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, SECURITY.BCRYPT_ROUNDS);

      // Create user in transaction
      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: data.email,
            username: data.username,
            password: hashedPassword,
            firstName: data.firstName,
            lastName: data.lastName,
          },
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            isActive: true,
            createdAt: true,
          },
        });

        // Assign role if provided, otherwise use viewer
        const roleId = data.roleId || (await tx.role.findUnique({
          where: { name: 'viewer' },
        }))?.id;

        if (roleId) {
          await tx.userRole.create({
            data: {
              userId: newUser.id,
              roleId,
            },
          });
        }

        return newUser;
      });

      reply.status(201).send({
        success: true,
        data: user,
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * PUT /api/v1/users/:id
   * Update user
   */
  app.put('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const data = updateUserSchema.parse(request.body);

      // Check user exists
      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        return reply.status(404).send({
          success: false,
          error: { message: 'User not found', statusCode: 404 },
        });
      }

      // Check for email/username conflicts
      if (data.email || data.username) {
        const conflict = await prisma.user.findFirst({
          where: {
            OR: [
              data.email ? { email: data.email } : {},
              data.username ? { username: data.username } : {},
            ].filter(obj => Object.keys(obj).length > 0),
            NOT: { id },
          },
        });

        if (conflict) {
          return reply.status(400).send({
            success: false,
            error: { message: 'Email or username already in use', statusCode: 400 },
          });
        }
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          email: data.email,
          username: data.username,
          firstName: data.firstName,
          lastName: data.lastName,
          isActive: data.isActive,
        },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLogin: true,
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      reply.send({
        success: true,
        data: {
          ...user,
          roles: user.roles.map(ur => ur.role),
        },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * PUT /api/v1/users/:id/role
   * Assign role to user
   */
  app.put('/:id/role', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { roleId } = assignRoleSchema.parse(request.body);

      // Check user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { message: 'User not found', statusCode: 404 },
        });
      }

      // Check role exists
      const role = await prisma.role.findUnique({
        where: { id: roleId },
      });

      if (!role) {
        return reply.status(404).send({
          success: false,
          error: { message: 'Role not found', statusCode: 404 },
        });
      }

      // Remove existing roles and assign new one
      await prisma.$transaction([
        prisma.userRole.deleteMany({
          where: { userId: id },
        }),
        prisma.userRole.create({
          data: {
            userId: id,
            roleId,
          },
        }),
      ]);

      reply.send({
        success: true,
        data: { message: `Role '${role.name}' assigned to user` },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * PUT /api/v1/users/:id/password
   * Reset user password (admin)
   */
  app.put('/:id/password', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { newPassword } = resetPasswordSchema.parse(request.body);

      // Check user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { message: 'User not found', statusCode: 404 },
        });
      }

      // Hash and update password
      const hashedPassword = await bcrypt.hash(newPassword, SECURITY.BCRYPT_ROUNDS);
      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });

      // Revoke all user sessions
      await prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      reply.send({
        success: true,
        data: { message: 'Password reset successfully. All user sessions have been revoked.' },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * DELETE /api/v1/users/:id
   * Delete user
   */
  app.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const currentUser = request.user as { userId: string };

      // Prevent self-deletion
      if (id === currentUser.userId) {
        return reply.status(400).send({
          success: false,
          error: { message: 'Cannot delete your own account', statusCode: 400 },
        });
      }

      // Check user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { message: 'User not found', statusCode: 404 },
        });
      }

      // Delete user (cascades to sessions, roles, audit logs)
      await prisma.user.delete({
        where: { id },
      });

      reply.send({
        success: true,
        data: { message: 'User deleted successfully' },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });

  /**
   * DELETE /api/v1/users/:id/sessions
   * Revoke all sessions for a user
   */
  app.delete('/:id/sessions', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Check user exists
      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { message: 'User not found', statusCode: 404 },
        });
      }

      const result = await prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      reply.send({
        success: true,
        data: { message: `${result.count} session(s) revoked` },
      });
    } catch (err) {
      const error = err as Error;
      reply.status(400).send({
        success: false,
        error: { message: error.message, statusCode: 400 },
      });
    }
  });
}
