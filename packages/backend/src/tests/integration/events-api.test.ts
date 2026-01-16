/**
 * Integration tests for Events API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';

// Skip integration tests if no database is available
const skipIntegrationTests = process.env.SKIP_INTEGRATION_TESTS === 'true' || !process.env.DATABASE_URL;

describe.skipIf(skipIntegrationTests)('Events API Integration Tests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testEventId: string;

  beforeAll(async () => {
    // Initialize app
    app = await buildApp();
    await app.ready();

    // Register test user and get auth token
    await request(app.server)
      .post('/api/v1/auth/register')
      .send({
        email: 'test-events@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      });

    const loginResponse = await request(app.server)
      .post('/api/v1/auth/login')
      .send({
        email: 'test-events@example.com',
        password: 'TestPassword123!',
      });

    authToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Event Emission', () => {
    it('should emit a new event', async () => {
      const response = await request(app.server)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test.event',
          payload: { message: 'Hello World', value: 123 },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('test.event');
      expect(response.body.data.payload).toEqual({ message: 'Hello World', value: 123 });

      testEventId = response.body.data.id;
    });

    it('should emit event with source', async () => {
      const response = await request(app.server)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'test.sourced',
          payload: { data: 'test' },
          source: 'custom-service',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.source).toBe('custom-service');
    });

    it('should reject event without name', async () => {
      const response = await request(app.server)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          payload: { data: 'test' },
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Event Listing', () => {
    it('should list all events', async () => {
      const response = await request(app.server)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('pagination');
    });

    it('should filter events by name', async () => {
      const response = await request(app.server)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ name: 'test.event' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.every((e: any) => e.name === 'test.event')).toBe(true);
    });

    it('should filter events by source', async () => {
      const response = await request(app.server)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ source: 'custom-service' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.every((e: any) => e.source === 'custom-service')).toBe(true);
    });

    it('should paginate events', async () => {
      const response = await request(app.server)
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });
  });

  describe('Event Details', () => {
    it('should get event by ID', async () => {
      const response = await request(app.server)
        .get(`/api/v1/events/${testEventId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testEventId);
      expect(response.body.data.name).toBe('test.event');
    });

    it('should return 404 for non-existent event', async () => {
      const response = await request(app.server)
        .get('/api/v1/events/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Recent Events', () => {
    it('should get recent events', async () => {
      const response = await request(app.server)
        .get('/api/v1/events/recent')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(10);

      // Events should be sorted by createdAt descending
      if (response.body.data.length > 1) {
        const first = new Date(response.body.data[0].createdAt).getTime();
        const second = new Date(response.body.data[1].createdAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });
  });

  describe('Event Statistics', () => {
    beforeAll(async () => {
      // Emit some test events for statistics
      await request(app.server)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'stats.test.1', payload: {} });

      await request(app.server)
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'stats.test.2', payload: {} });
    });

    it('should get event statistics summary', async () => {
      const response = await request(app.server)
        .get('/api/v1/events/stats/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('last24h');
      expect(response.body.data).toHaveProperty('last7d');
      expect(response.body.data).toHaveProperty('topEvents');
      expect(response.body.data).toHaveProperty('topSources');
      expect(Array.isArray(response.body.data.topEvents)).toBe(true);
      expect(Array.isArray(response.body.data.topSources)).toBe(true);
    });

    it('should have positive event counts', async () => {
      const response = await request(app.server)
        .get('/api/v1/events/stats/summary')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.body.data.total).toBeGreaterThan(0);
      expect(response.body.data.last24h).toBeGreaterThan(0);
    });
  });

  describe('Event Cleanup', () => {
    it('should cleanup old events', async () => {
      const response = await request(app.server)
        .delete('/api/v1/events/cleanup')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ olderThan: 30 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('deleted');
      expect(typeof response.body.data.deleted).toBe('number');
    });

    it('should require olderThan parameter', async () => {
      const response = await request(app.server)
        .delete('/api/v1/events/cleanup')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Authorization', () => {
    it('should reject requests without auth token', async () => {
      const response = await request(app.server)
        .get('/api/v1/events');

      expect(response.status).toBe(401);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app.server)
        .get('/api/v1/events')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });
});
