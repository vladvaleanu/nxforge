/**
 * Error Handling Utilities
 * Provides consistent error handling and user-friendly error messages
 */

import { AxiosError } from 'axios';

/**
 * Standardized error response from backend
 */
export interface ApiError {
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
 * Extract error message from various error types
 * @param error Error from API call or other source
 * @returns User-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  // Axios error with response
  if (isAxiosError(error) && error.response?.data) {
    const apiError = error.response.data as ApiError;

    // New standardized error format
    if (apiError.error?.message) {
      return apiError.error.message;
    }

    // Old error format (for backwards compatibility)
    if (typeof apiError.error === 'string') {
      return apiError.error;
    }
  }

  // Axios error without response (network error)
  if (isAxiosError(error)) {
    if (error.code === 'ERR_NETWORK') {
      return 'Network error. Please check your connection and try again.';
    }
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout. Please try again.';
    }
    if (error.message) {
      return error.message;
    }
  }

  // Standard Error object
  if (error instanceof Error) {
    return error.message;
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  // Unknown error
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if error is an Axios error
 */
function isAxiosError(error: unknown): error is AxiosError {
  return error != null && (error as AxiosError).isAxiosError === true;
}

/**
 * Get HTTP status code from error
 * @param error Error from API call
 * @returns Status code or undefined
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (isAxiosError(error) && error.response) {
    return error.response.status;
  }
  return undefined;
}

/**
 * Check if error is a specific status code
 * @param error Error from API call
 * @param statusCode Status code to check
 * @returns True if error matches status code
 */
export function isErrorStatus(error: unknown, statusCode: number): boolean {
  return getErrorStatusCode(error) === statusCode;
}

/**
 * Check if error is a validation error (400)
 */
export function isValidationError(error: unknown): boolean {
  return isErrorStatus(error, 400);
}

/**
 * Check if error is an authentication error (401)
 */
export function isAuthError(error: unknown): boolean {
  return isErrorStatus(error, 401);
}

/**
 * Check if error is a forbidden error (403)
 */
export function isForbiddenError(error: unknown): boolean {
  return isErrorStatus(error, 403);
}

/**
 * Check if error is a not found error (404)
 */
export function isNotFoundError(error: unknown): boolean {
  return isErrorStatus(error, 404);
}

/**
 * Check if error is a conflict error (409)
 */
export function isConflictError(error: unknown): boolean {
  return isErrorStatus(error, 409);
}

/**
 * Check if error is a server error (5xx)
 */
export function isServerError(error: unknown): boolean {
  const status = getErrorStatusCode(error);
  return status !== undefined && status >= 500 && status < 600;
}

/**
 * Check if error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  if (isAxiosError(error)) {
    return error.code === 'ERR_NETWORK' || !error.response;
  }
  return false;
}

/**
 * Get validation details from error
 * @param error Validation error
 * @returns Validation details or undefined
 */
export function getValidationDetails(error: unknown): any | undefined {
  if (isAxiosError(error) && error.response?.data) {
    const apiError = error.response.data as ApiError;
    return apiError.error?.details;
  }
  return undefined;
}

/**
 * Format error for logging
 * @param error Error to format
 * @returns Formatted error object
 */
export function formatErrorForLogging(error: unknown): Record<string, any> {
  const errorInfo: Record<string, any> = {
    message: getErrorMessage(error),
    timestamp: new Date().toISOString(),
  };

  if (isAxiosError(error)) {
    errorInfo.type = 'API Error';
    errorInfo.statusCode = getErrorStatusCode(error);
    errorInfo.url = error.config?.url;
    errorInfo.method = error.config?.method?.toUpperCase();

    if (error.response?.data) {
      const apiError = error.response.data as ApiError;
      errorInfo.requestId = apiError.meta?.requestId;
      errorInfo.code = apiError.error?.code;
    }
  } else if (error instanceof Error) {
    errorInfo.type = error.constructor.name;
    errorInfo.stack = error.stack;
  }

  return errorInfo;
}

/**
 * User-friendly error messages for common scenarios
 */
export const ERROR_MESSAGES = {
  NETWORK: 'Unable to connect to the server. Please check your internet connection.',
  TIMEOUT: 'The request took too long. Please try again.',
  UNAUTHORIZED: 'Your session has expired. Please log in again.',
  FORBIDDEN: 'You don\'t have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'This operation conflicts with existing data.',
  SERVER_ERROR: 'A server error occurred. Please try again later.',
  VALIDATION: 'Please check your input and try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
} as const;

/**
 * Get user-friendly error message based on error type
 * @param error Error object
 * @returns User-friendly message
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return ERROR_MESSAGES.NETWORK;
  }
  if (isAuthError(error)) {
    return ERROR_MESSAGES.UNAUTHORIZED;
  }
  if (isForbiddenError(error)) {
    return ERROR_MESSAGES.FORBIDDEN;
  }
  if (isNotFoundError(error)) {
    return ERROR_MESSAGES.NOT_FOUND;
  }
  if (isConflictError(error)) {
    return ERROR_MESSAGES.CONFLICT;
  }
  if (isServerError(error)) {
    return ERROR_MESSAGES.SERVER_ERROR;
  }
  if (isValidationError(error)) {
    return ERROR_MESSAGES.VALIDATION;
  }

  return getErrorMessage(error);
}
