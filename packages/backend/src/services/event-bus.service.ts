/**
 * Event Bus Service
 * Provides Redis-based pub/sub for cross-module communication
 */

import { Redis } from 'ioredis';
import { createRedisConnection } from '../lib/redis.js';
import { prisma, Prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import type { EventBusService as IEventBusService, EventHandler, Event } from '../types/job.types.js';

interface EventSubscription {
  eventName: string;
  handler: EventHandler;
  moduleName?: string;
}

export class EventBusService implements IEventBusService {
  private publisher: Redis;
  private subscriber: Redis;
  private subscriptions = new Map<string, EventSubscription[]>();
  private isInitialized = false;

  constructor() {
    this.publisher = createRedisConnection();
    this.subscriber = createRedisConnection();
  }

  /**
   * Initialize the event bus
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Set up Redis subscriber message handler
    this.subscriber.on('message', async (channel: string, message: string) => {
      await this.handleEvent(channel, message);
    });

    this.isInitialized = true;
    logger.info('Event bus initialized');
  }

  /**
   * Emit an event
   */
  async emit(name: string, payload: Record<string, any>): Promise<void> {
    const event: Event = {
      id: this.generateEventId(),
      name,
      source: payload.source || 'system',
      payload,
      createdAt: new Date(),
    };

    // Store event in database for history
    try {
      await prisma.event.create({
        data: {
          id: event.id,
          name: event.name,
          source: event.source,
          payload: event.payload as Prisma.InputJsonValue,
          createdAt: event.createdAt,
        },
      });
    } catch (error: any) {
      logger.error('Failed to store event in database:', error);
    }

    // Publish event to Redis
    const channel = `event:${name}`;
    const message = JSON.stringify(event);

    try {
      await this.publisher.publish(channel, message);
      logger.debug(`Event emitted: ${name}`, { eventId: event.id, source: event.source });
    } catch (error: any) {
      logger.error(`Failed to publish event: ${name}`, error);
      throw new Error(`Failed to publish event: ${error.message}`);
    }
  }

  /**
   * Subscribe to an event
   */
  on(name: string, handler: EventHandler): void {
    if (!this.subscriptions.has(name)) {
      this.subscriptions.set(name, []);

      // Subscribe to Redis channel
      const channel = `event:${name}`;
      this.subscriber.subscribe(channel, (error) => {
        if (error) {
          logger.error(`Failed to subscribe to channel: ${channel}`, error);
        } else {
          logger.debug(`Subscribed to event: ${name}`);
        }
      });
    }

    this.subscriptions.get(name)!.push({ eventName: name, handler });
  }

  /**
   * Unsubscribe from an event
   */
  off(name: string, handler: EventHandler): void {
    const handlers = this.subscriptions.get(name);
    if (!handlers) {
      return;
    }

    const index = handlers.findIndex((sub) => sub.handler === handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }

    // If no more handlers for this event, unsubscribe from Redis
    if (handlers.length === 0) {
      this.subscriptions.delete(name);
      const channel = `event:${name}`;
      this.subscriber.unsubscribe(channel, (error) => {
        if (error) {
          logger.error(`Failed to unsubscribe from channel: ${channel}`, error);
        } else {
          logger.debug(`Unsubscribed from event: ${name}`);
        }
      });
    }
  }

  /**
   * Subscribe to a wildcard pattern
   * Example: "module.*" will match "module.started", "module.stopped", etc.
   */
  onPattern(pattern: string, handler: EventHandler): void {
    const channel = `event:${pattern}`;

    // Add to subscriptions with pattern flag
    if (!this.subscriptions.has(pattern)) {
      this.subscriptions.set(pattern, []);

      // Use psubscribe for pattern matching
      this.subscriber.psubscribe(channel, (error) => {
        if (error) {
          logger.error(`Failed to subscribe to pattern: ${pattern}`, error);
        } else {
          logger.debug(`Subscribed to pattern: ${pattern}`);
        }
      });
    }

    this.subscriptions.get(pattern)!.push({ eventName: pattern, handler });
  }

  /**
   * Handle incoming event from Redis
   */
  private async handleEvent(channel: string, message: string): Promise<void> {
    try {
      const event: Event = JSON.parse(message);
      const eventName = channel.replace('event:', '');

      const handlers = this.subscriptions.get(eventName);
      if (!handlers || handlers.length === 0) {
        return;
      }

      logger.debug(`Processing event: ${eventName}`, { eventId: event.id, handlers: handlers.length });

      // Execute all handlers for this event
      const promises = handlers.map(async (subscription) => {
        try {
          // Build event context (simplified for now - full context in module handlers)
          const context: any = {
            event,
            module: {
              id: 'system',
              name: 'system',
              config: {},
            },
            services: {}, // Services will be added when called from job context
          };

          await subscription.handler(context);
        } catch (error: any) {
          logger.error(`Event handler failed for ${eventName}:`, error);
        }
      });

      await Promise.all(promises);
    } catch (error: any) {
      logger.error('Failed to handle event:', error);
    }
  }

  /**
   * Get all subscribed events
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get subscription count for an event
   */
  getSubscriptionCount(eventName: string): number {
    return this.subscriptions.get(eventName)?.length || 0;
  }

  /**
   * Get event statistics
   */
  getStats() {
    return {
      totalSubscriptions: this.subscriptions.size,
      subscriptionDetails: Array.from(this.subscriptions.entries()).map(([name, handlers]) => ({
        eventName: name,
        handlerCount: handlers.length,
      })),
    };
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting event bus...');

    // Unsubscribe from all channels
    if (this.subscriber) {
      await this.subscriber.quit();
    }

    if (this.publisher) {
      await this.publisher.quit();
    }

    this.isInitialized = false;
    logger.info('Event bus disconnected');
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get recent events from database
   */
  async getRecentEvents(limit = 100, eventName?: string): Promise<Event[]> {
    const where: any = {};
    if (eventName) {
      where.name = eventName;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      id: e.id,
      name: e.name,
      source: e.source,
      payload: e.payload as Record<string, any>,
      createdAt: e.createdAt,
    }));
  }

  /**
   * Clear old events from database
   */
  async clearOldEvents(olderThanDays = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.event.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(`Cleared ${result.count} events older than ${olderThanDays} days`);
    return result.count;
  }
}

// Singleton instance
export const eventBusService = new EventBusService();
