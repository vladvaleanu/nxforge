/**
 * Unit tests for EventBusService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies - use getter functions to work around hoisting
vi.mock('../../lib/redis.js', () => {
  let callCount = 0;
  const mockPublisher = {
    publish: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  };

  const mockSubscriber = {
    subscribe: vi.fn((channel: string, callback: any) => {
      if (typeof callback === 'function') callback(null);
    }),
    unsubscribe: vi.fn((channel: string, callback: any) => {
      if (typeof callback === 'function') callback(null);
    }),
    psubscribe: vi.fn((channel: string, callback: any) => {
      if (typeof callback === 'function') callback(null);
    }),
    on: vi.fn(),
    quit: vi.fn().mockResolvedValue('OK'),
  };

  return {
    createRedisConnection: vi.fn(() => {
      callCount++;
      return callCount % 2 === 1 ? mockPublisher : mockSubscriber;
    }),
    __getMockPublisher: () => mockPublisher,
    __getMockSubscriber: () => mockSubscriber,
    __resetCallCount: () => { callCount = 0; },
  };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    event: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Import after mocks
import { EventBusService } from '../../services/event-bus.service';
import * as redisModule from '../../lib/redis.js';

describe('EventBusService', () => {
  let eventBusService: EventBusService;
  let mockPublisher: any;
  let mockSubscriber: any;

  beforeEach(() => {
    // Get mock instances from the mocked module
    const redisMock = redisModule as any;
    mockPublisher = redisMock.__getMockPublisher();
    mockSubscriber = redisMock.__getMockSubscriber();
    redisMock.__resetCallCount();

    // Clear all mock calls
    vi.clearAllMocks();

    // Create new service instance
    eventBusService = new EventBusService();
  });

  afterEach(async () => {
    if (eventBusService) {
      await eventBusService.disconnect();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await eventBusService.initialize();
      expect(mockSubscriber.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should not initialize twice', async () => {
      await eventBusService.initialize();
      await eventBusService.initialize();
      // Should only set up handler once
      expect(mockSubscriber.on).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Emission', () => {
    beforeEach(async () => {
      await eventBusService.initialize();
    });

    it('should emit an event', async () => {
      const eventName = 'test.event';
      const payload = { message: 'Hello World' };

      await eventBusService.emit(eventName, payload);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        'event:test.event',
        expect.stringContaining(eventName)
      );
    });

    it('should emit event with correct payload structure', async () => {
      const eventName = 'user.created';
      const payload = { userId: '123', email: 'test@example.com' };

      await eventBusService.emit(eventName, payload);

      const publishCall = mockPublisher.publish.mock.calls[0];
      const publishedData = JSON.parse(publishCall[1]);

      expect(publishedData).toMatchObject({
        name: eventName,
        payload,
        source: 'system',
      });
      expect(publishedData.id).toBeDefined();
      expect(publishedData.createdAt).toBeDefined();
    });

    it('should include custom source in emitted event', async () => {
      const eventName = 'module.loaded';
      const payload = { moduleId: 'test-module', source: 'test-service' };

      await eventBusService.emit(eventName, payload);

      const publishCall = mockPublisher.publish.mock.calls[0];
      const publishedData = JSON.parse(publishCall[1]);

      expect(publishedData.source).toBe('test-service');
    });
  });

  describe('Event Subscription', () => {
    beforeEach(async () => {
      await eventBusService.initialize();
    });

    it('should subscribe to specific event', () => {
      const eventName = 'test.event';
      const handler = vi.fn();

      eventBusService.on(eventName, handler);

      expect(mockSubscriber.subscribe).toHaveBeenCalledWith(
        'event:test.event',
        expect.any(Function)
      );
    });

    it('should subscribe to event pattern', () => {
      const pattern = 'module.*';
      const handler = vi.fn();

      eventBusService.onPattern(pattern, handler);

      expect(mockSubscriber.psubscribe).toHaveBeenCalledWith(
        'event:module.*',
        expect.any(Function)
      );
    });
  });

  describe('Unsubscription', () => {
    beforeEach(async () => {
      await eventBusService.initialize();
    });

    it('should unsubscribe from event', () => {
      const eventName = 'test.event';
      const handler = vi.fn();

      eventBusService.on(eventName, handler);
      eventBusService.off(eventName, handler);

      // Should call unsubscribe when no handlers left
      expect(mockSubscriber.unsubscribe).toHaveBeenCalledWith(
        'event:test.event',
        expect.any(Function)
      );
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await eventBusService.initialize();
    });

    it('should disconnect cleanly', async () => {
      await eventBusService.disconnect();

      expect(mockPublisher.quit).toHaveBeenCalled();
      expect(mockSubscriber.quit).toHaveBeenCalled();
    });
  });
});
