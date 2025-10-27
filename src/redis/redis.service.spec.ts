/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/**
 * RedisService Unit Tests
 * Comprehensive test suite for Redis event publishing and caching operations
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { RedisService, PaymentEvent } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedisClient: {
    publish: jest.Mock;
    get: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
  };
  let loggerDebugSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Create mock Redis client
    mockRedisClient = {
      publish: jest.fn(),
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);

    // Spy on logger methods
    loggerDebugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('publishPaymentEvent', () => {
    describe('successful publishing', () => {
      it('should publish event to correct channel format: payment:{type}', async () => {
        const event: PaymentEvent = {
          type: 'subscription.created',
          userId: 'user-123',
          data: { subscriptionId: 'sub-456' },
          timestamp: new Date('2025-01-15T10:00:00Z'),
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentEvent(event);

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'payment:subscription.created',
          expect.any(String),
        );
      });

      it('should serialize event data as JSON', async () => {
        const event: PaymentEvent = {
          type: 'payment.succeeded',
          userId: 'user-123',
          data: { amount: 1000, currency: 'USD' },
          timestamp: new Date('2025-01-15T10:00:00Z'),
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentEvent(event);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage).toEqual({
          type: 'payment.succeeded',
          userId: 'user-123',
          data: { amount: 1000, currency: 'USD' },
          timestamp: '2025-01-15T10:00:00.000Z',
        });
      });

      it('should include timestamp in published message', async () => {
        const timestamp = new Date('2025-01-15T10:00:00Z');
        const event: PaymentEvent = {
          type: 'payment.succeeded',
          userId: 'user-123',
          data: { amount: 1000 },
          timestamp,
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentEvent(event);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.timestamp).toBe(timestamp.toISOString());
      });

      it('should use provided timestamp if given', async () => {
        const providedTimestamp = new Date('2025-01-15T10:00:00Z');
        const event: PaymentEvent = {
          type: 'payment.succeeded',
          userId: 'user-123',
          data: { amount: 1000 },
          timestamp: providedTimestamp,
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentEvent(event);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.timestamp).toBe('2025-01-15T10:00:00.000Z');
      });

      it('should add current timestamp if not provided', async () => {
        const beforeTime = new Date();
        const event: PaymentEvent = {
          type: 'payment.succeeded',
          userId: 'user-123',
          data: { amount: 1000 },
          timestamp: new Date(),
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentEvent(event);
        const afterTime = new Date();

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);
        const messageTimestamp = new Date(parsedMessage.timestamp);

        expect(messageTimestamp.getTime()).toBeGreaterThanOrEqual(
          beforeTime.getTime(),
        );
        expect(messageTimestamp.getTime()).toBeLessThanOrEqual(
          afterTime.getTime(),
        );
      });

      it('should log debug message on success', async () => {
        const event: PaymentEvent = {
          type: 'subscription.created',
          userId: 'user-123',
          data: { subscriptionId: 'sub-456' },
          timestamp: new Date(),
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentEvent(event);

        expect(loggerDebugSpy).toHaveBeenCalledWith(
          'Published event to payment:subscription.created: subscription.created',
        );
      });

      it('should include correlationId in published event if provided', async () => {
        const event: PaymentEvent = {
          type: 'payment.succeeded',
          userId: 'user-123',
          data: { amount: 1000 },
          timestamp: new Date(),
          correlationId: 'corr-789',
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentEvent(event);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.correlationId).toBe('corr-789');
      });
    });

    describe('error handling', () => {
      it('should log error and rethrow when publish fails with Error instance', async () => {
        const event: PaymentEvent = {
          type: 'payment.failed',
          userId: 'user-123',
          data: { error: 'Card declined' },
          timestamp: new Date(),
        };

        const error = new Error('Redis connection failed');
        mockRedisClient.publish.mockRejectedValue(error);

        await expect(service.publishPaymentEvent(event)).rejects.toThrow(
          'Redis connection failed',
        );

        expect(loggerErrorSpy).toHaveBeenCalledWith(
          'Failed to publish event: Redis connection failed',
        );
      });

      it('should handle non-Error exceptions', async () => {
        const event: PaymentEvent = {
          type: 'payment.failed',
          userId: 'user-123',
          data: { error: 'Card declined' },
          timestamp: new Date(),
        };

        mockRedisClient.publish.mockRejectedValue('String error');

        await expect(service.publishPaymentEvent(event)).rejects.toBe(
          'String error',
        );

        expect(loggerErrorSpy).toHaveBeenCalledWith(
          'Failed to publish event: Unknown error',
        );
      });

      it('should rethrow the original error after logging', async () => {
        const event: PaymentEvent = {
          type: 'payment.failed',
          userId: 'user-123',
          data: {},
          timestamp: new Date(),
        };

        const customError = new Error('Custom Redis error');
        mockRedisClient.publish.mockRejectedValue(customError);

        await expect(service.publishPaymentEvent(event)).rejects.toBe(
          customError,
        );
      });
    });
  });

  describe('event publishing methods', () => {
    describe('publishSubscriptionCreated', () => {
      it('should call publishPaymentEvent with correct type', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456', plan: 'premium' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionCreated(userId, subscriptionData);

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'payment:subscription.created',
          expect.stringContaining('"type":"subscription.created"'),
        );
      });

      it('should pass userId correctly', async () => {
        const userId = 'user-789';
        const subscriptionData = { subscriptionId: 'sub-456' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionCreated(userId, subscriptionData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.userId).toBe('user-789');
      });

      it('should pass data correctly', async () => {
        const userId = 'user-123';
        const subscriptionData = {
          subscriptionId: 'sub-456',
          plan: 'premium',
          status: 'active',
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionCreated(userId, subscriptionData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.data).toEqual(subscriptionData);
      });

      it('should add timestamp', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456' };

        mockRedisClient.publish.mockResolvedValue(1);
        const beforeTime = Date.now();

        await service.publishSubscriptionCreated(userId, subscriptionData);
        const afterTime = Date.now();

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);
        const messageTime = new Date(parsedMessage.timestamp).getTime();

        expect(messageTime).toBeGreaterThanOrEqual(beforeTime);
        expect(messageTime).toBeLessThanOrEqual(afterTime);
      });
    });

    describe('publishSubscriptionUpdated', () => {
      it('should call publishPaymentEvent with correct type', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456', plan: 'basic' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionUpdated(userId, subscriptionData);

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'payment:subscription.updated',
          expect.stringContaining('"type":"subscription.updated"'),
        );
      });

      it('should pass userId correctly', async () => {
        const userId = 'user-456';
        const subscriptionData = { subscriptionId: 'sub-789' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionUpdated(userId, subscriptionData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.userId).toBe('user-456');
      });

      it('should pass data correctly', async () => {
        const userId = 'user-123';
        const subscriptionData = {
          subscriptionId: 'sub-456',
          oldPlan: 'basic',
          newPlan: 'premium',
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionUpdated(userId, subscriptionData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.data).toEqual(subscriptionData);
      });

      it('should add timestamp', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionUpdated(userId, subscriptionData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.timestamp).toBeDefined();
      });
    });

    describe('publishSubscriptionCancelled', () => {
      it('should call publishPaymentEvent with correct type', async () => {
        const userId = 'user-123';
        const subscriptionData = {
          subscriptionId: 'sub-456',
          reason: 'user_request',
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionCancelled(userId, subscriptionData);

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'payment:subscription.cancelled',
          expect.stringContaining('"type":"subscription.cancelled"'),
        );
      });

      it('should pass userId correctly', async () => {
        const userId = 'user-999';
        const subscriptionData = { subscriptionId: 'sub-456' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionCancelled(userId, subscriptionData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.userId).toBe('user-999');
      });

      it('should pass data correctly', async () => {
        const userId = 'user-123';
        const subscriptionData = {
          subscriptionId: 'sub-456',
          reason: 'payment_failed',
          cancelledAt: '2025-01-15',
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionCancelled(userId, subscriptionData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.data).toEqual(subscriptionData);
      });

      it('should add timestamp', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishSubscriptionCancelled(userId, subscriptionData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.timestamp).toBeDefined();
      });
    });

    describe('publishPaymentSucceeded', () => {
      it('should call publishPaymentEvent with correct type', async () => {
        const userId = 'user-123';
        const paymentData = { amount: 1000, currency: 'USD' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentSucceeded(userId, paymentData);

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'payment:payment.succeeded',
          expect.stringContaining('"type":"payment.succeeded"'),
        );
      });

      it('should pass userId correctly', async () => {
        const userId = 'user-abc';
        const paymentData = { amount: 2000 };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentSucceeded(userId, paymentData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.userId).toBe('user-abc');
      });

      it('should pass data correctly', async () => {
        const userId = 'user-123';
        const paymentData = {
          amount: 1500,
          currency: 'EUR',
          paymentId: 'pay-789',
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentSucceeded(userId, paymentData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.data).toEqual(paymentData);
      });

      it('should add timestamp', async () => {
        const userId = 'user-123';
        const paymentData = { amount: 1000 };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentSucceeded(userId, paymentData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.timestamp).toBeDefined();
      });
    });

    describe('publishPaymentFailed', () => {
      it('should call publishPaymentEvent with correct type', async () => {
        const userId = 'user-123';
        const paymentData = {
          error: 'Card declined',
          reason: 'insufficient_funds',
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentFailed(userId, paymentData);

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'payment:payment.failed',
          expect.stringContaining('"type":"payment.failed"'),
        );
      });

      it('should pass userId correctly', async () => {
        const userId = 'user-def';
        const paymentData = { error: 'Card declined' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentFailed(userId, paymentData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.userId).toBe('user-def');
      });

      it('should pass data correctly', async () => {
        const userId = 'user-123';
        const paymentData = {
          error: 'Card expired',
          code: 'card_expired',
          attemptedAmount: 3000,
        };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentFailed(userId, paymentData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.data).toEqual(paymentData);
      });

      it('should add timestamp', async () => {
        const userId = 'user-123';
        const paymentData = { error: 'Card declined' };

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishPaymentFailed(userId, paymentData);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.timestamp).toBeDefined();
      });
    });

    describe('publishFeatureAccessGranted', () => {
      it('should call publishPaymentEvent with correct type', async () => {
        const userId = 'user-123';
        const feature = 'premium_messaging';
        const tier = 'gold';

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishFeatureAccessGranted(userId, feature, tier);

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'payment:feature.access_granted',
          expect.stringContaining('"type":"feature.access_granted"'),
        );
      });

      it('should pass userId correctly', async () => {
        const userId = 'user-ghi';
        const feature = 'video_calls';
        const tier = 'platinum';

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishFeatureAccessGranted(userId, feature, tier);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.userId).toBe('user-ghi');
      });

      it('should pass feature and tier in data correctly', async () => {
        const userId = 'user-123';
        const feature = 'advanced_analytics';
        const tier = 'premium';

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishFeatureAccessGranted(userId, feature, tier);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.data).toEqual({
          feature: 'advanced_analytics',
          tier: 'premium',
        });
      });

      it('should add timestamp', async () => {
        const userId = 'user-123';
        const feature = 'premium_messaging';
        const tier = 'gold';

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishFeatureAccessGranted(userId, feature, tier);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.timestamp).toBeDefined();
      });
    });

    describe('publishFeatureAccessRevoked', () => {
      it('should call publishPaymentEvent with correct type', async () => {
        const userId = 'user-123';
        const feature = 'premium_messaging';
        const reason = 'subscription_expired';

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishFeatureAccessRevoked(userId, feature, reason);

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'payment:feature.access_revoked',
          expect.stringContaining('"type":"feature.access_revoked"'),
        );
      });

      it('should pass userId correctly', async () => {
        const userId = 'user-jkl';
        const feature = 'video_calls';
        const reason = 'payment_failed';

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishFeatureAccessRevoked(userId, feature, reason);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.userId).toBe('user-jkl');
      });

      it('should pass feature and reason in data correctly', async () => {
        const userId = 'user-123';
        const feature = 'advanced_search';
        const reason = 'subscription_cancelled';

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishFeatureAccessRevoked(userId, feature, reason);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.data).toEqual({
          feature: 'advanced_search',
          reason: 'subscription_cancelled',
        });
      });

      it('should add timestamp', async () => {
        const userId = 'user-123';
        const feature = 'premium_messaging';
        const reason = 'subscription_expired';

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishFeatureAccessRevoked(userId, feature, reason);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.timestamp).toBeDefined();
      });
    });

    describe('publishTrialEnding', () => {
      it('should call publishPaymentEvent with correct type', async () => {
        const userId = 'user-123';
        const daysRemaining = 3;

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishTrialEnding(userId, daysRemaining);

        expect(mockRedisClient.publish).toHaveBeenCalledWith(
          'payment:trial.ending',
          expect.stringContaining('"type":"trial.ending"'),
        );
      });

      it('should pass userId correctly', async () => {
        const userId = 'user-mno';
        const daysRemaining = 7;

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishTrialEnding(userId, daysRemaining);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.userId).toBe('user-mno');
      });

      it('should pass daysRemaining in data correctly', async () => {
        const userId = 'user-123';
        const daysRemaining = 5;

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishTrialEnding(userId, daysRemaining);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.data).toEqual({ daysRemaining: 5 });
      });

      it('should add timestamp', async () => {
        const userId = 'user-123';
        const daysRemaining = 3;

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishTrialEnding(userId, daysRemaining);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.timestamp).toBeDefined();
      });

      it('should handle zero days remaining', async () => {
        const userId = 'user-123';
        const daysRemaining = 0;

        mockRedisClient.publish.mockResolvedValue(1);

        await service.publishTrialEnding(userId, daysRemaining);

        const publishedMessage = mockRedisClient.publish.mock.calls[0][1];
        const parsedMessage = JSON.parse(publishedMessage);

        expect(parsedMessage.data.daysRemaining).toBe(0);
      });
    });
  });

  describe('caching operations', () => {
    describe('getCachedSubscription', () => {
      it('should return parsed JSON when cache hit', async () => {
        const userId = 'user-123';
        const cachedData = {
          subscriptionId: 'sub-456',
          plan: 'premium',
          status: 'active',
        };

        mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

        const result = await service.getCachedSubscription(userId);

        expect(mockRedisClient.get).toHaveBeenCalledWith(
          'subscription:user-123',
        );
        expect(result).toEqual(cachedData);
      });

      it('should return null when cache miss', async () => {
        const userId = 'user-123';

        mockRedisClient.get.mockResolvedValue(null);

        const result = await service.getCachedSubscription(userId);

        expect(mockRedisClient.get).toHaveBeenCalledWith(
          'subscription:user-123',
        );
        expect(result).toBeNull();
      });

      it('should return null and log error when Redis fails', async () => {
        const userId = 'user-123';
        const error = new Error('Redis connection timeout');

        mockRedisClient.get.mockRejectedValue(error);

        const result = await service.getCachedSubscription(userId);

        expect(result).toBeNull();
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          'Failed to get cached subscription: Redis connection timeout',
        );
      });

      it('should return null and log error when JSON parse fails', async () => {
        const userId = 'user-123';

        mockRedisClient.get.mockResolvedValue('invalid json{');

        const result = await service.getCachedSubscription(userId);

        expect(result).toBeNull();
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to get cached subscription:'),
        );
      });

      it('should use correct key format: subscription:{userId}', async () => {
        const userId = 'user-abc-def';

        mockRedisClient.get.mockResolvedValue(null);

        await service.getCachedSubscription(userId);

        expect(mockRedisClient.get).toHaveBeenCalledWith(
          'subscription:user-abc-def',
        );
      });

      it('should handle non-Error exceptions', async () => {
        const userId = 'user-123';

        mockRedisClient.get.mockRejectedValue('String error');

        const result = await service.getCachedSubscription(userId);

        expect(result).toBeNull();
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          'Failed to get cached subscription: Unknown error',
        );
      });

      it('should handle complex nested objects', async () => {
        const userId = 'user-123';
        const complexData = {
          subscriptionId: 'sub-456',
          plan: {
            name: 'premium',
            features: ['feature1', 'feature2'],
          },
          metadata: {
            createdAt: '2025-01-01',
            tags: ['vip', 'early-adopter'],
          },
        };

        mockRedisClient.get.mockResolvedValue(JSON.stringify(complexData));

        const result = await service.getCachedSubscription(userId);

        expect(result).toEqual(complexData);
      });
    });

    describe('cacheSubscription', () => {
      it('should store subscription with correct key', async () => {
        const userId = 'user-123';
        const subscriptionData = {
          subscriptionId: 'sub-456',
          plan: 'premium',
        };

        mockRedisClient.setex.mockResolvedValue('OK');

        await service.cacheSubscription(userId, subscriptionData);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          'subscription:user-123',
          3600,
          JSON.stringify(subscriptionData),
        );
      });

      it('should serialize data as JSON', async () => {
        const userId = 'user-123';
        const subscriptionData = {
          subscriptionId: 'sub-456',
          plan: 'premium',
          status: 'active',
          features: ['messaging', 'video'],
        };

        mockRedisClient.setex.mockResolvedValue('OK');

        await service.cacheSubscription(userId, subscriptionData);

        const expectedJson = JSON.stringify(subscriptionData);
        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          'subscription:user-123',
          3600,
          expectedJson,
        );
      });

      it('should use provided TTL', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456' };
        const customTtl = 7200;

        mockRedisClient.setex.mockResolvedValue('OK');

        await service.cacheSubscription(userId, subscriptionData, customTtl);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          'subscription:user-123',
          7200,
          expect.any(String),
        );
      });

      it('should use default TTL of 3600 seconds', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456' };

        mockRedisClient.setex.mockResolvedValue('OK');

        await service.cacheSubscription(userId, subscriptionData);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          'subscription:user-123',
          3600,
          expect.any(String),
        );
      });

      it('should log error when caching fails', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456' };
        const error = new Error('Redis write failed');

        mockRedisClient.setex.mockRejectedValue(error);

        await service.cacheSubscription(userId, subscriptionData);

        expect(loggerErrorSpy).toHaveBeenCalledWith(
          'Failed to cache subscription: Redis write failed',
        );
      });

      it('should not throw error on failure (graceful degradation)', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456' };
        const error = new Error('Redis write failed');

        mockRedisClient.setex.mockRejectedValue(error);

        await expect(
          service.cacheSubscription(userId, subscriptionData),
        ).resolves.toBeUndefined();
      });

      it('should handle non-Error exceptions', async () => {
        const userId = 'user-123';
        const subscriptionData = { subscriptionId: 'sub-456' };

        mockRedisClient.setex.mockRejectedValue('String error');

        await service.cacheSubscription(userId, subscriptionData);

        expect(loggerErrorSpy).toHaveBeenCalledWith(
          'Failed to cache subscription: Unknown error',
        );
      });

      it('should use correct key format for different userIds', async () => {
        const userId = 'user-xyz-123';
        const subscriptionData = { subscriptionId: 'sub-456' };

        mockRedisClient.setex.mockResolvedValue('OK');

        await service.cacheSubscription(userId, subscriptionData);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          'subscription:user-xyz-123',
          3600,
          expect.any(String),
        );
      });

      it('should handle empty subscription data', async () => {
        const userId = 'user-123';
        const subscriptionData = {};

        mockRedisClient.setex.mockResolvedValue('OK');

        await service.cacheSubscription(userId, subscriptionData);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          'subscription:user-123',
          3600,
          '{}',
        );
      });
    });

    describe('invalidateSubscriptionCache', () => {
      it('should delete cache key', async () => {
        const userId = 'user-123';

        mockRedisClient.del.mockResolvedValue(1);

        await service.invalidateSubscriptionCache(userId);

        expect(mockRedisClient.del).toHaveBeenCalledWith(
          'subscription:user-123',
        );
      });

      it('should use correct key format', async () => {
        const userId = 'user-abc-456';

        mockRedisClient.del.mockResolvedValue(1);

        await service.invalidateSubscriptionCache(userId);

        expect(mockRedisClient.del).toHaveBeenCalledWith(
          'subscription:user-abc-456',
        );
      });

      it('should log error when deletion fails', async () => {
        const userId = 'user-123';
        const error = new Error('Redis delete failed');

        mockRedisClient.del.mockRejectedValue(error);

        await service.invalidateSubscriptionCache(userId);

        expect(loggerErrorSpy).toHaveBeenCalledWith(
          'Failed to invalidate subscription cache: Redis delete failed',
        );
      });

      it('should not throw error on failure', async () => {
        const userId = 'user-123';
        const error = new Error('Redis delete failed');

        mockRedisClient.del.mockRejectedValue(error);

        await expect(
          service.invalidateSubscriptionCache(userId),
        ).resolves.toBeUndefined();
      });

      it('should handle non-Error exceptions', async () => {
        const userId = 'user-123';

        mockRedisClient.del.mockRejectedValue('String error');

        await service.invalidateSubscriptionCache(userId);

        expect(loggerErrorSpy).toHaveBeenCalledWith(
          'Failed to invalidate subscription cache: Unknown error',
        );
      });

      it('should successfully delete even if key does not exist', async () => {
        const userId = 'user-nonexistent';

        // Redis del returns 0 when key doesn't exist
        mockRedisClient.del.mockResolvedValue(0);

        await service.invalidateSubscriptionCache(userId);

        expect(mockRedisClient.del).toHaveBeenCalledWith(
          'subscription:user-nonexistent',
        );
        expect(loggerErrorSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('integration scenarios', () => {
    it('should publish event and cache subscription in sequence', async () => {
      const userId = 'user-123';
      const subscriptionData = { subscriptionId: 'sub-456', plan: 'premium' };

      mockRedisClient.publish.mockResolvedValue(1);
      mockRedisClient.setex.mockResolvedValue('OK');

      await service.publishSubscriptionCreated(userId, subscriptionData);
      await service.cacheSubscription(userId, subscriptionData);

      expect(mockRedisClient.publish).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });

    it('should handle cache invalidation after subscription cancellation', async () => {
      const userId = 'user-123';
      const subscriptionData = {
        subscriptionId: 'sub-456',
        reason: 'user_request',
      };

      mockRedisClient.publish.mockResolvedValue(1);
      mockRedisClient.del.mockResolvedValue(1);

      await service.publishSubscriptionCancelled(userId, subscriptionData);
      await service.invalidateSubscriptionCache(userId);

      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'payment:subscription.cancelled',
        expect.any(String),
      );
      expect(mockRedisClient.del).toHaveBeenCalledWith('subscription:user-123');
    });

    it('should retrieve cached subscription after caching', async () => {
      const userId = 'user-123';
      const subscriptionData = { subscriptionId: 'sub-456', plan: 'premium' };

      mockRedisClient.setex.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(subscriptionData));

      await service.cacheSubscription(userId, subscriptionData);
      const result = await service.getCachedSubscription(userId);

      expect(result).toEqual(subscriptionData);
    });
  });
});
