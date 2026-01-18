/**
 * Standardized Error Handler Middleware
 * Ensures consistent error response format across all endpoints
 */

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants';
import { logger } from '../config/logger';

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: any;
  };
  meta: {
    requestId: string;
    timestamp: string;
    path?: string;
  };
}

/**
 * Standard success response structure
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  request: FastifyRequest,
  error: Error | FastifyError | ZodError,
  statusCode?: number
): ErrorResponse {
  const requestId = request.id;
  const timestamp = new Date().toISOString();
  const path = request.url;

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        details: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      },
      meta: { requestId, timestamp, path },
    };
  }

  // Handle Fastify errors
  if ('statusCode' in error) {
    return {
      success: false,
      error: {
        message: error.message,
        code: (error as FastifyError).code,
        statusCode: (error as FastifyError).statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR,
      },
      meta: { requestId, timestamp, path },
    };
  }

  // Handle generic errors
  const status = statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const isServerError = status >= 500;

  return {
    success: false,
    error: {
      message: isServerError ? ERROR_MESSAGES.INTERNAL_ERROR : error.message,
      statusCode: status,
    },
    meta: { requestId, timestamp, path },
  };
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  request: FastifyRequest,
  data: T,
  pagination?: {
    page: number;
    limit: number;
    total: number;
  }
): SuccessResponse<T> {
  const meta: SuccessResponse<T>['meta'] = {
    requestId: request.id,
    timestamp: new Date().toISOString(),
  };

  if (pagination) {
    meta.pagination = {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    };
  }

  return {
    success: true,
    data,
    meta,
  };
}

/**
 * Global error handler for Fastify
 * Catches all unhandled errors and formats them consistently
 */
export function errorHandler(
  error: Error | FastifyError | ZodError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error with context
  const errorContext = {
    requestId: request.id,
    method: request.method,
    url: request.url,
    statusCode: 'statusCode' in error ? (error.statusCode ?? 500) : 500,
    error: error.message,
    stack: error.stack,
  };

  // Don't log stack traces for 4xx errors (client errors)
  if (errorContext.statusCode >= 500) {
    logger.error('Server error occurred', errorContext);
  } else {
    logger.warn('Client error occurred', {
      ...errorContext,
      stack: undefined, // Don't log stack for client errors
    });
  }

  // Create standardized error response
  const errorResponse = createErrorResponse(request, error);

  // Send response
  reply.status(errorResponse.error.statusCode).send(errorResponse);
}

/**
 * Not Found handler (404 errors)
 */
export function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      message: `Route ${request.method} ${request.url} not found`,
      code: 'NOT_FOUND',
      statusCode: HTTP_STATUS.NOT_FOUND,
    },
    meta: {
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.url,
    },
  };

  logger.warn('Route not found', {
    requestId: request.id,
    method: request.method,
    url: request.url,
  });

  reply.status(HTTP_STATUS.NOT_FOUND).send(errorResponse);
}

/**
 * Helper to throw standardized errors
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code?: string,
    details?: any
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: any) {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = ERROR_MESSAGES.UNAUTHORIZED) {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED, 'UNAUTHORIZED');
  }

  static forbidden(message: string = ERROR_MESSAGES.FORBIDDEN) {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, 'FORBIDDEN');
  }

  static notFound(message: string = ERROR_MESSAGES.NOT_FOUND) {
    return new AppError(message, HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
  }

  static conflict(message: string = ERROR_MESSAGES.CONFLICT) {
    return new AppError(message, HTTP_STATUS.CONFLICT, 'CONFLICT');
  }

  static tooManyRequests(message: string = ERROR_MESSAGES.TOO_MANY_REQUESTS) {
    return new AppError(message, HTTP_STATUS.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS');
  }

  static internal(message: string = ERROR_MESSAGES.INTERNAL_ERROR) {
    return new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR');
  }
}
