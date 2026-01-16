/**
 * Integration tests for job execution flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../app';
import { DatabaseService } from '../../services/database.service';
import { jobService } from '../../services/job.service';
import path from 'path';

// Skip integration tests if no database is available
const skipIntegrationTests = process.env.SKIP_INTEGRATION_TESTS === 'true' || !process.env.DATABASE_URL;

describe.skipIf(skipIntegrationTests)('Job Execution Integration Tests', () => {
  let app: FastifyInstance;
  let authToken: string;
  let testModuleId: string;
  let testJobId: string;

  beforeAll(async () => {
    // Initialize app
    app = await buildApp();
    await app.ready();

    // Register test user and get auth token
    const registerResponse = await request(app.server)
      .post('/api/v1/auth/register')
      .send({
        email: 'test-job@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
      });

    const loginResponse = await request(app.server)
      .post('/api/v1/auth/login')
      .send({
        email: 'test-job@example.com',
        password: 'TestPassword123!',
      });

    authToken = loginResponse.body.data.accessToken;

    // Register a test module
    const moduleResponse = await request(app.server)
      .post('/api/v1/modules')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        manifest: {
          name: 'test-job-module',
          version: '1.0.0',
          displayName: 'Test Job Module',
          description: 'Module for testing job execution',
          main: 'index.js',
          capabilities: {
            jobs: true,
          },
        },
      });

    testModuleId = moduleResponse.body.data.id;

    // Enable the module
    await request(app.server)
      .post(`/api/v1/modules/test-job-module/enable`)
      .set('Authorization', `Bearer ${authToken}`);
  });

  afterAll(async () => {
    // Cleanup
    if (testJobId) {
      await request(app.server)
        .delete(`/api/v1/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }

    if (testModuleId) {
      await request(app.server)
        .delete(`/api/v1/modules/test-job-module`)
        .set('Authorization', `Bearer ${authToken}`);
    }

    await app.close();
  });

  describe('Job Creation and Management', () => {
    it('should create a new job', async () => {
      const response = await request(app.server)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Job',
          description: 'A test job',
          moduleId: testModuleId,
          handler: 'jobs/test-handler.js',
          schedule: '*/5 * * * *',
          enabled: true,
          timeout: 60000,
          retries: 3,
          config: { test: true },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe('Test Job');
      expect(response.body.data.schedule).toBe('*/5 * * * *');

      testJobId = response.body.data.id;
    });

    it('should list all jobs', async () => {
      const response = await request(app.server)
        .get('/api/v1/jobs')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get job details', async () => {
      const response = await request(app.server)
        .get(`/api/v1/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testJobId);
      expect(response.body.data.name).toBe('Test Job');
    });

    it('should disable a job', async () => {
      const response = await request(app.server)
        .put(`/api/v1/jobs/${testJobId}/disable`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(false);
    });

    it('should enable a job', async () => {
      const response = await request(app.server)
        .put(`/api/v1/jobs/${testJobId}/enable`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.enabled).toBe(true);
    });
  });

  describe('Job Execution', () => {
    it('should manually execute a job', async () => {
      const response = await request(app.server)
        .post(`/api/v1/jobs/${testJobId}/execute`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('executionId');
    });

    it('should list job executions', async () => {
      // Wait a bit for execution to start
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(app.server)
        .get('/api/v1/executions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ jobId: testJobId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get execution details', async () => {
      // Get the latest execution
      const listResponse = await request(app.server)
        .get('/api/v1/executions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ jobId: testJobId, limit: 1 });

      const executionId = listResponse.body.data[0].id;

      const response = await request(app.server)
        .get(`/api/v1/executions/${executionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(executionId);
      expect(response.body.data.jobId).toBe(testJobId);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('startedAt');
    });

    it('should filter executions by status', async () => {
      const response = await request(app.server)
        .get('/api/v1/executions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'COMPLETED' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Job Validation', () => {
    it('should reject job with invalid cron expression', async () => {
      const response = await request(app.server)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Cron Job',
          moduleId: testModuleId,
          handler: 'jobs/handler.js',
          schedule: 'invalid cron',
          enabled: true,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject job with non-existent module', async () => {
      const response = await request(app.server)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Module Job',
          moduleId: 'non-existent-module-id',
          handler: 'jobs/handler.js',
          enabled: true,
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should reject job with missing required fields', async () => {
      const response = await request(app.server)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Incomplete Job',
          // Missing moduleId and handler
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Job Updates', () => {
    it('should update job configuration', async () => {
      const response = await request(app.server)
        .put(`/api/v1/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description',
          timeout: 120000,
          config: { updated: true },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.timeout).toBe(120000);
      expect(response.body.data.config.updated).toBe(true);
    });

    it('should update job schedule', async () => {
      const response = await request(app.server)
        .put(`/api/v1/jobs/${testJobId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          schedule: '0 * * * *',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.schedule).toBe('0 * * * *');
    });
  });
});
