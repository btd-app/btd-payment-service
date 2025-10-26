/**
 * Redis Service
 * Handles event publishing to Redis for inter-service communication
 *
 * Last Updated On: 2025-08-06
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface PaymentEvent {
  type: string;
  userId: string;
  data: Record<string, unknown>;
  timestamp: Date;
  correlationId?: string;
}

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  /**
   * Publish payment event to Redis
   */
  async publishPaymentEvent(event: PaymentEvent): Promise<void> {
    try {
      const channel = `payment:${event.type}`;
      const message = JSON.stringify({
        ...event,
        timestamp: event.timestamp || new Date(),
      });

      await this.redis.publish(channel, message);
      this.logger.debug(`Published event to ${channel}: ${event.type}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to publish event: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Publish subscription created event
   */
  async publishSubscriptionCreated(
    userId: string,
    subscriptionData: Record<string, unknown>,
  ): Promise<void> {
    await this.publishPaymentEvent({
      type: 'subscription.created',
      userId,
      data: subscriptionData,
      timestamp: new Date(),
    });
  }

  /**
   * Publish subscription updated event
   */
  async publishSubscriptionUpdated(
    userId: string,
    subscriptionData: Record<string, unknown>,
  ): Promise<void> {
    await this.publishPaymentEvent({
      type: 'subscription.updated',
      userId,
      data: subscriptionData,
      timestamp: new Date(),
    });
  }

  /**
   * Publish subscription cancelled event
   */
  async publishSubscriptionCancelled(
    userId: string,
    subscriptionData: Record<string, unknown>,
  ): Promise<void> {
    await this.publishPaymentEvent({
      type: 'subscription.cancelled',
      userId,
      data: subscriptionData,
      timestamp: new Date(),
    });
  }

  /**
   * Publish payment succeeded event
   */
  async publishPaymentSucceeded(
    userId: string,
    paymentData: Record<string, unknown>,
  ): Promise<void> {
    await this.publishPaymentEvent({
      type: 'payment.succeeded',
      userId,
      data: paymentData,
      timestamp: new Date(),
    });
  }

  /**
   * Publish payment failed event
   */
  async publishPaymentFailed(
    userId: string,
    paymentData: Record<string, unknown>,
  ): Promise<void> {
    await this.publishPaymentEvent({
      type: 'payment.failed',
      userId,
      data: paymentData,
      timestamp: new Date(),
    });
  }

  /**
   * Publish feature access granted event
   */
  async publishFeatureAccessGranted(
    userId: string,
    feature: string,
    tier: string,
  ): Promise<void> {
    await this.publishPaymentEvent({
      type: 'feature.access_granted',
      userId,
      data: { feature, tier },
      timestamp: new Date(),
    });
  }

  /**
   * Publish feature access revoked event
   */
  async publishFeatureAccessRevoked(
    userId: string,
    feature: string,
    reason: string,
  ): Promise<void> {
    await this.publishPaymentEvent({
      type: 'feature.access_revoked',
      userId,
      data: { feature, reason },
      timestamp: new Date(),
    });
  }

  /**
   * Publish trial ending event
   */
  async publishTrialEnding(
    userId: string,
    daysRemaining: number,
  ): Promise<void> {
    await this.publishPaymentEvent({
      type: 'trial.ending',
      userId,
      data: { daysRemaining },
      timestamp: new Date(),
    });
  }

  /**
   * Get cached subscription data
   */
  async getCachedSubscription(
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const key = `subscription:${userId}`;
      const data: string | null = await this.redis.get(key);
      return data ? (JSON.parse(data) as Record<string, unknown>) : null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get cached subscription: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Cache subscription data
   */
  async cacheSubscription(
    userId: string,
    subscriptionData: Record<string, unknown>,
    ttl = 3600,
  ): Promise<void> {
    try {
      const key = `subscription:${userId}`;
      await this.redis.setex(key, ttl, JSON.stringify(subscriptionData));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to cache subscription: ${errorMessage}`);
    }
  }

  /**
   * Invalidate subscription cache
   */
  async invalidateSubscriptionCache(userId: string): Promise<void> {
    try {
      const key = `subscription:${userId}`;
      await this.redis.del(key);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to invalidate subscription cache: ${errorMessage}`,
      );
    }
  }
}
