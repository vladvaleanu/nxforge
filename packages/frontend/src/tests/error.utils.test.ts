import { describe, it, expect } from 'vitest';
import {
  getErrorMessage,
  isNetworkError,
  getErrorStatusCode,
  isErrorStatus,
  isValidationError,
  isAuthError,
  isForbiddenError,
  isNotFoundError,
  isConflictError,
  isServerError,
  getValidationDetails,
  getUserFriendlyMessage,
  formatErrorForLogging,
  ERROR_MESSAGES
} from '../utils/error.utils';

describe('Error Utils', () => {
  describe('getErrorMessage', () => {
    it('should extract message from API error response', () => {
      const error = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Invalid credentials',
              statusCode: 401,
            },
          },
        },
      };

      expect(getErrorMessage(error)).toBe('Invalid credentials');
    });

    it('should extract message from old error format', () => {
      const error = {
        isAxiosError: true,
        response: {
          data: {
            error: 'Not found',
          },
        },
      };

      expect(getErrorMessage(error)).toBe('Not found');
    });

    it('should handle ERR_NETWORK error', () => {
      const error = {
        isAxiosError: true,
        code: 'ERR_NETWORK',
        message: 'Network Error',
      };

      expect(getErrorMessage(error)).toBe('Network error. Please check your connection and try again.');
    });

    it('should handle ECONNABORTED error', () => {
      const error = {
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      };

      expect(getErrorMessage(error)).toBe('Request timeout. Please try again.');
    });

    it('should use Axios error message if no specific code', () => {
      const error = {
        isAxiosError: true,
        message: 'Request failed with status code 500',
      };

      expect(getErrorMessage(error)).toBe('Request failed with status code 500');
    });

    it('should use error.message for standard Error', () => {
      const error = new Error('Something failed');

      expect(getErrorMessage(error)).toBe('Something failed');
    });

    it('should handle string errors', () => {
      const error = 'Something failed';

      expect(getErrorMessage(error)).toBe('Something failed');
    });

    it('should use default message for unknown errors', () => {
      const error = null;

      expect(getErrorMessage(error)).toBe('An unexpected error occurred. Please try again.');
    });

    it('should use default message for objects without message', () => {
      const error = { foo: 'bar' };

      expect(getErrorMessage(error)).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('isNetworkError', () => {
    it('should return true for ERR_NETWORK errors', () => {
      const error = {
        isAxiosError: true,
        code: 'ERR_NETWORK',
      };

      expect(isNetworkError(error)).toBe(true);
    });

    it('should return true for Axios errors without response', () => {
      const error = {
        isAxiosError: true,
        request: {},
      };

      expect(isNetworkError(error)).toBe(true);
    });

    it('should return false for API errors with responses', () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Not found' },
        },
      };

      expect(isNetworkError(error)).toBe(false);
    });

    it('should return false for regular errors', () => {
      const error = new Error('Something failed');

      expect(isNetworkError(error)).toBe(false);
    });

    it('should return false for null', () => {
      expect(isNetworkError(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isNetworkError(undefined)).toBe(false);
    });
  });

  describe('getErrorStatusCode', () => {
    it('should extract status code from Axios error', () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 404,
        },
      };

      expect(getErrorStatusCode(error)).toBe(404);
    });

    it('should return undefined for errors without response', () => {
      const error = {
        isAxiosError: true,
      };

      expect(getErrorStatusCode(error)).toBeUndefined();
    });

    it('should return undefined for non-Axios errors', () => {
      const error = new Error('Test');

      expect(getErrorStatusCode(error)).toBeUndefined();
    });
  });

  describe('isErrorStatus', () => {
    it('should return true when status matches', () => {
      const error = {
        isAxiosError: true,
        response: { status: 404 },
      };

      expect(isErrorStatus(error, 404)).toBe(true);
    });

    it('should return false when status does not match', () => {
      const error = {
        isAxiosError: true,
        response: { status: 500 },
      };

      expect(isErrorStatus(error, 404)).toBe(false);
    });
  });

  describe('Status code helpers', () => {
    it('should detect validation errors (400)', () => {
      const error = {
        isAxiosError: true,
        response: { status: 400 },
      };

      expect(isValidationError(error)).toBe(true);
    });

    it('should detect auth errors (401)', () => {
      const error = {
        isAxiosError: true,
        response: { status: 401 },
      };

      expect(isAuthError(error)).toBe(true);
    });

    it('should detect forbidden errors (403)', () => {
      const error = {
        isAxiosError: true,
        response: { status: 403 },
      };

      expect(isForbiddenError(error)).toBe(true);
    });

    it('should detect not found errors (404)', () => {
      const error = {
        isAxiosError: true,
        response: { status: 404 },
      };

      expect(isNotFoundError(error)).toBe(true);
    });

    it('should detect conflict errors (409)', () => {
      const error = {
        isAxiosError: true,
        response: { status: 409 },
      };

      expect(isConflictError(error)).toBe(true);
    });

    it('should detect server errors (5xx)', () => {
      const error500 = {
        isAxiosError: true,
        response: { status: 500 },
      };

      const error503 = {
        isAxiosError: true,
        response: { status: 503 },
      };

      expect(isServerError(error500)).toBe(true);
      expect(isServerError(error503)).toBe(true);
    });

    it('should not detect 4xx as server errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 404 },
      };

      expect(isServerError(error)).toBe(false);
    });
  });

  describe('getValidationDetails', () => {
    it('should extract validation details from error', () => {
      const error = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Validation failed',
              details: {
                email: 'Invalid email format',
              },
            },
          },
        },
      };

      expect(getValidationDetails(error)).toEqual({
        email: 'Invalid email format',
      });
    });

    it('should return undefined when no details', () => {
      const error = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Error',
            },
          },
        },
      };

      expect(getValidationDetails(error)).toBeUndefined();
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return network message for network errors', () => {
      const error = {
        isAxiosError: true,
        code: 'ERR_NETWORK',
      };

      expect(getUserFriendlyMessage(error)).toBe(ERROR_MESSAGES.NETWORK);
    });

    it('should return auth message for 401 errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 401 },
      };

      expect(getUserFriendlyMessage(error)).toBe(ERROR_MESSAGES.UNAUTHORIZED);
    });

    it('should return forbidden message for 403 errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 403 },
      };

      expect(getUserFriendlyMessage(error)).toBe(ERROR_MESSAGES.FORBIDDEN);
    });

    it('should return not found message for 404 errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 404 },
      };

      expect(getUserFriendlyMessage(error)).toBe(ERROR_MESSAGES.NOT_FOUND);
    });

    it('should return conflict message for 409 errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 409 },
      };

      expect(getUserFriendlyMessage(error)).toBe(ERROR_MESSAGES.CONFLICT);
    });

    it('should return server error message for 5xx errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 500 },
      };

      expect(getUserFriendlyMessage(error)).toBe(ERROR_MESSAGES.SERVER_ERROR);
    });

    it('should return validation message for 400 errors', () => {
      const error = {
        isAxiosError: true,
        response: { status: 400 },
      };

      expect(getUserFriendlyMessage(error)).toBe(ERROR_MESSAGES.VALIDATION);
    });

    it('should fall back to getErrorMessage', () => {
      const error = {
        isAxiosError: true,
        response: {
          data: {
            error: {
              message: 'Custom error',
            },
          },
        },
      };

      expect(getUserFriendlyMessage(error)).toBe('Custom error');
    });
  });

  describe('formatErrorForLogging', () => {
    it('should format Axios errors', () => {
      const error = {
        isAxiosError: true,
        response: {
          status: 404,
          data: {
            error: {
              message: 'Not found',
              code: 'NOT_FOUND',
            },
            meta: {
              requestId: '123',
            },
          },
        },
        config: {
          url: '/api/test',
          method: 'get',
        },
      };

      const formatted = formatErrorForLogging(error);

      expect(formatted.type).toBe('API Error');
      expect(formatted.statusCode).toBe(404);
      expect(formatted.url).toBe('/api/test');
      expect(formatted.method).toBe('GET');
      expect(formatted.requestId).toBe('123');
      expect(formatted.code).toBe('NOT_FOUND');
      expect(formatted.timestamp).toBeDefined();
    });

    it('should format standard errors', () => {
      const error = new Error('Test error');

      const formatted = formatErrorForLogging(error);

      expect(formatted.type).toBe('Error');
      expect(formatted.message).toBe('Test error');
      expect(formatted.stack).toBeDefined();
      expect(formatted.timestamp).toBeDefined();
    });

    it('should format unknown errors', () => {
      const error = 'String error';

      const formatted = formatErrorForLogging(error);

      expect(formatted.message).toBe('String error');
      expect(formatted.timestamp).toBeDefined();
    });
  });
});
