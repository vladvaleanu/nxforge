/**
 * Test setup file for backend tests
 * Configures global test environment
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Skip integration tests by default (require real database)
// Set SKIP_INTEGRATION_TESTS=false to run integration tests with a real test DB
process.env.SKIP_INTEGRATION_TESTS = process.env.SKIP_INTEGRATION_TESTS || 'true';

// Global test timeout
vi.setConfig({ testTimeout: 10000 });

// Clean up after all tests
afterAll(() => {
  // Add any global cleanup here
});
