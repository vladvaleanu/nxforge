/**
 * Authentication service
 * Handles user authentication, token generation, and session management
 */

import * as bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { FastifyInstance } from 'fastify';
import { env } from '../config/env';
import { SECURITY, ERROR_MESSAGES } from '../config/constants';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class AuthService {
  constructor(private app: FastifyInstance) { }

  /**
   * Authenticate user with email and password
   */
  async login(credentials: LoginCredentials, userAgent?: string, ipAddress?: string): Promise<AuthTokens> {
    const { email, password } = credentials;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error(ERROR_MESSAGES.INVALID_CREDENTIALS);
    }

    // Extract roles and permissions
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = user.roles.flatMap(ur => ur.role.permissions as string[]);

    // Generate tokens
    const tokens = await this.generateTokens({
      userId: user.id,
      email: user.email,
      username: user.username,
      roles,
      permissions,
    }, userAgent, ipAddress);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return tokens;
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < SECURITY.PASSWORD_MIN_LENGTH) {
      throw new Error(`Password must be at least ${SECURITY.PASSWORD_MIN_LENGTH} characters long`);
    }

    if (password.length > SECURITY.PASSWORD_MAX_LENGTH) {
      throw new Error(`Password must not exceed ${SECURITY.PASSWORD_MAX_LENGTH} characters`);
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    // Check for at least one number
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', 'password123', '12345678', 'qwerty', 'abc123',
      'admin', 'admin123', 'letmein', 'welcome', 'monkey'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      throw new Error('Password is too common. Please choose a stronger password');
    }
  }

  /**
   * Register new user
   */
  async register(data: RegisterData): Promise<{ userId: string }> {
    const { email, username, password, firstName, lastName } = data;

    // Validate password strength
    this.validatePassword(password);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new Error('User with this email or username already exists');
    }

    // Hash password with higher cost factor for better security
    const hashedPassword = await bcrypt.hash(password, SECURITY.BCRYPT_ROUNDS);

    // Create user and assign role in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          email,
          username,
          password: hashedPassword,
          firstName,
          lastName,
        },
      });

      // Assign default 'viewer' role
      const viewerRole = await tx.role.findUnique({
        where: { name: 'viewer' },
      });

      if (!viewerRole) {
        throw new Error('Default viewer role not found. Please run database migrations.');
      }

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: viewerRole.id,
        },
      });

      return newUser;
    });

    return { userId: user.id };
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    payload: TokenPayload,
    userAgent?: string,
    ipAddress?: string
  ): Promise<AuthTokens> {
    // Generate access token
    const accessToken = this.app.jwt.sign(payload);

    // Generate refresh token with custom secret
    // Type assertion needed because @fastify/jwt doesn't expose the secret override option in types
    const jwtSign = this.app.jwt.sign as unknown as (
      payload: object,
      options?: { secret?: string; expiresIn?: string }
    ) => string;
    const refreshToken = jwtSign(
      { userId: payload.userId },
      { secret: env.REFRESH_TOKEN_SECRET, expiresIn: env.REFRESH_TOKEN_EXPIRES_IN }
    );

    // Store refresh token in database
    const expiresIn = this.parseExpiration(env.REFRESH_TOKEN_EXPIRES_IN);
    await prisma.session.create({
      data: {
        userId: payload.userId,
        refreshToken,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + expiresIn),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiration(env.JWT_EXPIRES_IN),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshTokens(refreshToken: string, userAgent?: string, ipAddress?: string): Promise<AuthTokens> {
    // Verify refresh token with custom secret
    // Type assertion needed because @fastify/jwt doesn't expose the secret override option in types
    let decoded: { userId: string };
    try {
      const jwtVerify = this.app.jwt.verify as unknown as (
        token: string,
        options?: { secret?: string }
      ) => { userId: string };
      decoded = jwtVerify(refreshToken, { secret: env.REFRESH_TOKEN_SECRET });
    } catch (err) {
      throw new Error('Invalid refresh token');
    }

    // Check if session exists and is valid
    const session = await prisma.session.findUnique({
      where: { refreshToken },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new Error('Invalid or expired session');
    }

    // Get user with roles
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    // Revoke old refresh token
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = user.roles.flatMap(ur => ur.role.permissions as string[]);

    return this.generateTokens({
      userId: user.id,
      email: user.email,
      username: user.username,
      roles,
      permissions,
    }, userAgent, ipAddress);
  }

  /**
   * Revoke refresh token (logout)
   */
  async revokeToken(refreshToken: string): Promise<void> {
    await prisma.session.updateMany({
      where: { refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Parse expiration time string to milliseconds
   */
  private parseExpiration(exp: string): number {
    const match = exp.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000; // Default 15 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; username?: string }
  ): Promise<{ user: any }> {
    // Check if username is being changed and if it's already taken
    if (data.username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username: data.username,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new Error('Username is already taken');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
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
                name: true,
                permissions: true,
              },
            },
          },
        },
      },
    });

    return { user };
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get current user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password strength
    this.validatePassword(newPassword);

    // Ensure new password is different
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new Error('New password must be different from current password');
    }

    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, SECURITY.BCRYPT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all other sessions for security
    await prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Get user profile with full details
   */
  async getProfile(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      ...user,
      roles: user.roles.map(ur => ur.role.name),
      permissions: user.roles.flatMap(ur => ur.role.permissions as string[]),
    };
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Revoke all sessions except current
   */
  async revokeOtherSessions(userId: string, currentRefreshToken: string): Promise<number> {
    const result = await prisma.session.updateMany({
      where: {
        userId,
        refreshToken: { not: currentRefreshToken },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return result.count;
  }
}
