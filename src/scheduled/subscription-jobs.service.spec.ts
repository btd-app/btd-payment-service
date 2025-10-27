/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/unbound-method */

/**
 * SubscriptionJobsService Unit Tests
 * Comprehensive test suite for scheduled cron jobs managing subscription lifecycle
 *
 * Coverage Target: 95%+
 * Last Updated: 2025-10-26
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SubscriptionJobsService } from './subscription-jobs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SubscriptionJobsService', () => {
  let service: SubscriptionJobsService;
  let _prismaService: PrismaService;

  // Mock PrismaService with all required models
  const mockPrismaService = {
    userPremiumFeatures: {
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    appleWebhookLog: {
      deleteMany: jest.fn(),
    },
    appleTransaction: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionJobsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionJobsService>(SubscriptionJobsService);
    _prismaService = module.get<PrismaService>(PrismaService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resetDailyLimits', () => {
    describe('successful reset', () => {
      it('should call prisma.userPremiumFeatures.updateMany', async () => {
        mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
          count: 100,
        });

        await service.resetDailyLimits();

        expect(
          mockPrismaService.userPremiumFeatures.updateMany,
        ).toHaveBeenCalled();
      });

      it('should reset dailyLikesUsed to 0', async () => {
        mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
          count: 50,
        });

        await service.resetDailyLimits();

        const callArgs =
          mockPrismaService.userPremiumFeatures.updateMany.mock.calls[0][0];
        expect(callArgs.data.dailyLikesUsed).toBe(0);
      });

      it('should reset dailySuperLikesUsed to 0', async () => {
        mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
          count: 50,
        });

        await service.resetDailyLimits();

        const callArgs =
          mockPrismaService.userPremiumFeatures.updateMany.mock.calls[0][0];
        expect(callArgs.data.dailySuperLikesUsed).toBe(0);
      });

      it('should update lastResetAt to current date', async () => {
        const beforeTest = new Date();
        mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
          count: 50,
        });

        await service.resetDailyLimits();

        const callArgs =
          mockPrismaService.userPremiumFeatures.updateMany.mock.calls[0][0];
        const lastResetAt = callArgs.data.lastResetAt;
        const afterTest = new Date();

        expect(lastResetAt).toBeInstanceOf(Date);
        expect(lastResetAt.getTime()).toBeGreaterThanOrEqual(
          beforeTest.getTime(),
        );
        expect(lastResetAt.getTime()).toBeLessThanOrEqual(afterTest.getTime());
      });

      it('should log starting message', async () => {
        mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
          count: 100,
        });

        await service.resetDailyLimits();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Starting daily limits reset job',
        );
      });

      it('should log success with count', async () => {
        mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
          count: 250,
        });

        await service.resetDailyLimits();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Reset daily limits for 250 users',
        );
      });
    });

    describe('error handling', () => {
      it('should log error when database operation fails', async () => {
        const mockError = new Error('Database connection failed');
        mockPrismaService.userPremiumFeatures.updateMany.mockRejectedValue(
          mockError,
        );

        await service.resetDailyLimits();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Daily limits reset failed: Database connection failed',
        );
      });

      it('should handle Error instances', async () => {
        const mockError = new Error('Test error');
        mockPrismaService.userPremiumFeatures.updateMany.mockRejectedValue(
          mockError,
        );

        await service.resetDailyLimits();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Daily limits reset failed: Test error',
        );
      });

      it('should handle non-Error exceptions', async () => {
        mockPrismaService.userPremiumFeatures.updateMany.mockRejectedValue(
          'String error',
        );

        await service.resetDailyLimits();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Daily limits reset failed: Unknown error',
        );
      });

      it('should not throw error when database fails', async () => {
        mockPrismaService.userPremiumFeatures.updateMany.mockRejectedValue(
          new Error('Database error'),
        );

        await expect(service.resetDailyLimits()).resolves.not.toThrow();
      });
    });
  });

  describe('checkExpiredSubscriptions', () => {
    describe('with expired subscriptions', () => {
      it('should find ACTIVE subscriptions with currentPeriodEnd < now', async () => {
        const mockExpiredSubs = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-01'),
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockExpiredSubs,
        );
        mockPrismaService.subscription.update.mockResolvedValue({});
        mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

        await service.checkExpiredSubscriptions();

        expect(mockPrismaService.subscription.findMany).toHaveBeenCalledWith({
          where: {
            status: 'ACTIVE',
            currentPeriodEnd: {
              lt: expect.any(Date),
            },
          },
        });
      });

      it('should update each expired subscription to EXPIRED status', async () => {
        const mockExpiredSubs = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-01'),
          },
          {
            id: 'sub-2',
            userId: 'user-2',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-02'),
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockExpiredSubs,
        );
        mockPrismaService.subscription.update.mockResolvedValue({});
        mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

        await service.checkExpiredSubscriptions();

        expect(mockPrismaService.subscription.update).toHaveBeenCalledTimes(2);
        expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-1' },
          data: { status: 'EXPIRED' },
        });
        expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-2' },
          data: { status: 'EXPIRED' },
        });
      });

      it('should reset user premium features to free tier', async () => {
        const mockExpiredSubs = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-01'),
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockExpiredSubs,
        );
        mockPrismaService.subscription.update.mockResolvedValue({});
        mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

        await service.checkExpiredSubscriptions();

        expect(
          mockPrismaService.userPremiumFeatures.update,
        ).toHaveBeenCalledWith({
          where: { userId: 'user-1' },
          data: expect.objectContaining({
            unlimitedLikes: false,
            whoLikedMe: false,
            topPicks: false,
            rewind: false,
            passport: false,
            incognito: false,
            boostsRemaining: 0,
            superLikesRemaining: 0,
          }),
        });
      });

      it('should set all premium flags to false', async () => {
        const mockExpiredSubs = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-01'),
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockExpiredSubs,
        );
        mockPrismaService.subscription.update.mockResolvedValue({});
        mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

        await service.checkExpiredSubscriptions();

        const callArgs =
          mockPrismaService.userPremiumFeatures.update.mock.calls[0][0];
        expect(callArgs.data.unlimitedLikes).toBe(false);
        expect(callArgs.data.whoLikedMe).toBe(false);
        expect(callArgs.data.topPicks).toBe(false);
        expect(callArgs.data.rewind).toBe(false);
        expect(callArgs.data.passport).toBe(false);
        expect(callArgs.data.incognito).toBe(false);
      });

      it('should set boostsRemaining and superLikesRemaining to 0', async () => {
        const mockExpiredSubs = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-01'),
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockExpiredSubs,
        );
        mockPrismaService.subscription.update.mockResolvedValue({});
        mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

        await service.checkExpiredSubscriptions();

        const callArgs =
          mockPrismaService.userPremiumFeatures.update.mock.calls[0][0];
        expect(callArgs.data.boostsRemaining).toBe(0);
        expect(callArgs.data.superLikesRemaining).toBe(0);
      });

      it('should log each expired subscription', async () => {
        const mockExpiredSubs = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-01'),
          },
          {
            id: 'sub-2',
            userId: 'user-2',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-02'),
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockExpiredSubs,
        );
        mockPrismaService.subscription.update.mockResolvedValue({});
        mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

        await service.checkExpiredSubscriptions();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Expired subscription for user: user-1',
        );
        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Expired subscription for user: user-2',
        );
      });

      it('should log total count when subscriptions processed', async () => {
        const mockExpiredSubs = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-01'),
          },
          {
            id: 'sub-2',
            userId: 'user-2',
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2025-01-02'),
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockExpiredSubs,
        );
        mockPrismaService.subscription.update.mockResolvedValue({});
        mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

        await service.checkExpiredSubscriptions();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Processed 2 expired subscriptions',
        );
      });

      it('should log starting message', async () => {
        mockPrismaService.subscription.findMany.mockResolvedValue([]);

        await service.checkExpiredSubscriptions();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Starting expired subscriptions check',
        );
      });
    });

    describe('with no expired subscriptions', () => {
      it('should not log when no expired subscriptions found', async () => {
        mockPrismaService.subscription.findMany.mockResolvedValue([]);

        await service.checkExpiredSubscriptions();

        // Should log the starting message, but not the processed message
        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Starting expired subscriptions check',
        );
        expect(Logger.prototype.log).not.toHaveBeenCalledWith(
          expect.stringContaining('Processed'),
        );
      });

      it('should not update any subscriptions', async () => {
        mockPrismaService.subscription.findMany.mockResolvedValue([]);

        await service.checkExpiredSubscriptions();

        expect(mockPrismaService.subscription.update).not.toHaveBeenCalled();
        expect(
          mockPrismaService.userPremiumFeatures.update,
        ).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should log error when database operation fails', async () => {
        const mockError = new Error('Database connection lost');
        mockPrismaService.subscription.findMany.mockRejectedValue(mockError);

        await service.checkExpiredSubscriptions();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Expired subscriptions check failed: Database connection lost',
        );
      });

      it('should handle Error instances', async () => {
        const mockError = new Error('Timeout error');
        mockPrismaService.subscription.findMany.mockRejectedValue(mockError);

        await service.checkExpiredSubscriptions();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Expired subscriptions check failed: Timeout error',
        );
      });

      it('should handle non-Error exceptions', async () => {
        mockPrismaService.subscription.findMany.mockRejectedValue({
          code: 'P2021',
        });

        await service.checkExpiredSubscriptions();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Expired subscriptions check failed: Unknown error',
        );
      });

      it('should not throw error when database fails', async () => {
        mockPrismaService.subscription.findMany.mockRejectedValue(
          new Error('Database error'),
        );

        await expect(
          service.checkExpiredSubscriptions(),
        ).resolves.not.toThrow();
      });
    });
  });

  describe('checkBillingRetrySubscriptions', () => {
    describe('with retry subscriptions', () => {
      it('should find subscriptions with status BILLING_RETRY', async () => {
        const mockRetrySubscriptions = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'BILLING_RETRY',
            currentPeriodEnd: new Date(Date.now() + 86400000), // Tomorrow
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockRetrySubscriptions,
        );

        await service.checkBillingRetrySubscriptions();

        expect(mockPrismaService.subscription.findMany).toHaveBeenCalledWith({
          where: {
            status: 'BILLING_RETRY',
            currentPeriodEnd: {
              gt: expect.any(Date),
            },
          },
        });
      });

      it('should find subscriptions where currentPeriodEnd > now', async () => {
        const mockRetrySubscriptions = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'BILLING_RETRY',
            currentPeriodEnd: new Date(Date.now() + 86400000), // Tomorrow
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockRetrySubscriptions,
        );

        await service.checkBillingRetrySubscriptions();

        const callArgs =
          mockPrismaService.subscription.findMany.mock.calls[0][0];
        const gtDate = callArgs.where.currentPeriodEnd.gt;
        expect(gtDate).toBeInstanceOf(Date);
        expect(gtDate.getTime()).toBeLessThanOrEqual(Date.now());
      });

      it('should log count of subscriptions in billing retry', async () => {
        const mockRetrySubscriptions = [
          {
            id: 'sub-1',
            userId: 'user-1',
            status: 'BILLING_RETRY',
            currentPeriodEnd: new Date(Date.now() + 86400000),
          },
          {
            id: 'sub-2',
            userId: 'user-2',
            status: 'BILLING_RETRY',
            currentPeriodEnd: new Date(Date.now() + 86400000),
          },
        ];

        mockPrismaService.subscription.findMany.mockResolvedValue(
          mockRetrySubscriptions,
        );

        await service.checkBillingRetrySubscriptions();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Found 2 subscriptions in billing retry',
        );
      });

      it('should log starting message', async () => {
        mockPrismaService.subscription.findMany.mockResolvedValue([]);

        await service.checkBillingRetrySubscriptions();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Starting billing retry check',
        );
      });
    });

    describe('with no retry subscriptions', () => {
      it('should not log when no retry subscriptions found', async () => {
        mockPrismaService.subscription.findMany.mockResolvedValue([]);

        await service.checkBillingRetrySubscriptions();

        // Should log the starting message, but not the found message
        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Starting billing retry check',
        );
        expect(Logger.prototype.log).not.toHaveBeenCalledWith(
          expect.stringContaining('Found'),
        );
      });

      it('should not perform any updates', async () => {
        mockPrismaService.subscription.findMany.mockResolvedValue([]);

        await service.checkBillingRetrySubscriptions();

        expect(mockPrismaService.subscription.update).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should log error when database operation fails', async () => {
        const mockError = new Error('Connection timeout');
        mockPrismaService.subscription.findMany.mockRejectedValue(mockError);

        await service.checkBillingRetrySubscriptions();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Billing retry check failed: Connection timeout',
        );
      });

      it('should handle Error instances', async () => {
        const mockError = new Error('Query failed');
        mockPrismaService.subscription.findMany.mockRejectedValue(mockError);

        await service.checkBillingRetrySubscriptions();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Billing retry check failed: Query failed',
        );
      });

      it('should handle non-Error exceptions', async () => {
        mockPrismaService.subscription.findMany.mockRejectedValue(
          'Unexpected error',
        );

        await service.checkBillingRetrySubscriptions();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Billing retry check failed: Unknown error',
        );
      });

      it('should not throw error when database fails', async () => {
        mockPrismaService.subscription.findMany.mockRejectedValue(
          new Error('Database error'),
        );

        await expect(
          service.checkBillingRetrySubscriptions(),
        ).resolves.not.toThrow();
      });
    });
  });

  describe('cleanupOldWebhookLogs', () => {
    describe('with old logs', () => {
      it('should calculate date 30 days ago', async () => {
        mockPrismaService.appleWebhookLog.deleteMany.mockResolvedValue({
          count: 100,
        });

        const before = new Date();
        before.setDate(before.getDate() - 30);

        await service.cleanupOldWebhookLogs();

        const callArgs =
          mockPrismaService.appleWebhookLog.deleteMany.mock.calls[0][0];
        const thirtyDaysAgoFromCall = callArgs.where.createdAt.lt;

        const after = new Date();
        after.setDate(after.getDate() - 30);

        expect(thirtyDaysAgoFromCall).toBeInstanceOf(Date);
        expect(thirtyDaysAgoFromCall.getTime()).toBeGreaterThanOrEqual(
          before.getTime() - 1000,
        ); // 1 second tolerance
        expect(thirtyDaysAgoFromCall.getTime()).toBeLessThanOrEqual(
          after.getTime() + 1000,
        ); // 1 second tolerance
      });

      it('should delete appleWebhookLog records older than 30 days', async () => {
        mockPrismaService.appleWebhookLog.deleteMany.mockResolvedValue({
          count: 50,
        });

        await service.cleanupOldWebhookLogs();

        expect(
          mockPrismaService.appleWebhookLog.deleteMany,
        ).toHaveBeenCalledWith({
          where: {
            createdAt: {
              lt: expect.any(Date),
            },
          },
        });
      });

      it('should log count of deleted logs', async () => {
        mockPrismaService.appleWebhookLog.deleteMany.mockResolvedValue({
          count: 75,
        });

        await service.cleanupOldWebhookLogs();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Deleted 75 old webhook logs',
        );
      });

      it('should log starting message', async () => {
        mockPrismaService.appleWebhookLog.deleteMany.mockResolvedValue({
          count: 0,
        });

        await service.cleanupOldWebhookLogs();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Starting webhook log cleanup',
        );
      });
    });

    describe('with no old logs', () => {
      it('should not log when no logs deleted', async () => {
        mockPrismaService.appleWebhookLog.deleteMany.mockResolvedValue({
          count: 0,
        });

        await service.cleanupOldWebhookLogs();

        // Should log the starting message, but not the deleted message
        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Starting webhook log cleanup',
        );
        expect(Logger.prototype.log).not.toHaveBeenCalledWith(
          expect.stringContaining('Deleted'),
        );
      });

      it('should still call deleteMany even when no logs exist', async () => {
        mockPrismaService.appleWebhookLog.deleteMany.mockResolvedValue({
          count: 0,
        });

        await service.cleanupOldWebhookLogs();

        expect(mockPrismaService.appleWebhookLog.deleteMany).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should log error when database operation fails', async () => {
        const mockError = new Error('Delete operation failed');
        mockPrismaService.appleWebhookLog.deleteMany.mockRejectedValue(
          mockError,
        );

        await service.cleanupOldWebhookLogs();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Webhook log cleanup failed: Delete operation failed',
        );
      });

      it('should handle Error instances', async () => {
        const mockError = new Error('Permission denied');
        mockPrismaService.appleWebhookLog.deleteMany.mockRejectedValue(
          mockError,
        );

        await service.cleanupOldWebhookLogs();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Webhook log cleanup failed: Permission denied',
        );
      });

      it('should handle non-Error exceptions', async () => {
        mockPrismaService.appleWebhookLog.deleteMany.mockRejectedValue(null);

        await service.cleanupOldWebhookLogs();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Webhook log cleanup failed: Unknown error',
        );
      });

      it('should not throw error when database fails', async () => {
        mockPrismaService.appleWebhookLog.deleteMany.mockRejectedValue(
          new Error('Database error'),
        );

        await expect(service.cleanupOldWebhookLogs()).resolves.not.toThrow();
      });
    });
  });

  describe('syncPendingTransactions', () => {
    describe('with pending transactions', () => {
      it('should find appleTransaction with status null', async () => {
        const mockPendingTransactions = [
          {
            id: 'txn-1',
            status: null,
            processedAt: null,
          },
        ];

        mockPrismaService.appleTransaction.findMany.mockResolvedValue(
          mockPendingTransactions,
        );

        await service.syncPendingTransactions();

        expect(
          mockPrismaService.appleTransaction.findMany,
        ).toHaveBeenCalledWith({
          where: {
            status: null,
            processedAt: null,
          },
          take: 10,
        });
      });

      it('should find appleTransaction with processedAt null', async () => {
        const mockPendingTransactions = [
          {
            id: 'txn-1',
            status: null,
            processedAt: null,
          },
        ];

        mockPrismaService.appleTransaction.findMany.mockResolvedValue(
          mockPendingTransactions,
        );

        await service.syncPendingTransactions();

        const callArgs =
          mockPrismaService.appleTransaction.findMany.mock.calls[0][0];
        expect(callArgs.where.processedAt).toBe(null);
      });

      it('should limit query to 10 transactions', async () => {
        const mockPendingTransactions = Array(10)
          .fill(null)
          .map((_, i) => ({
            id: `txn-${i}`,
            status: null,
            processedAt: null,
          }));

        mockPrismaService.appleTransaction.findMany.mockResolvedValue(
          mockPendingTransactions,
        );

        await service.syncPendingTransactions();

        const callArgs =
          mockPrismaService.appleTransaction.findMany.mock.calls[0][0];
        expect(callArgs.take).toBe(10);
      });

      it('should log count of pending transactions', async () => {
        const mockPendingTransactions = [
          {
            id: 'txn-1',
            status: null,
            processedAt: null,
          },
          {
            id: 'txn-2',
            status: null,
            processedAt: null,
          },
          {
            id: 'txn-3',
            status: null,
            processedAt: null,
          },
        ];

        mockPrismaService.appleTransaction.findMany.mockResolvedValue(
          mockPendingTransactions,
        );

        await service.syncPendingTransactions();

        expect(Logger.prototype.log).toHaveBeenCalledWith(
          'Found 3 pending transactions to process',
        );
      });

      it('should use debug level for checking message', async () => {
        mockPrismaService.appleTransaction.findMany.mockResolvedValue([]);

        await service.syncPendingTransactions();

        expect(Logger.prototype.debug).toHaveBeenCalledWith(
          'Checking for pending transactions',
        );
      });
    });

    describe('with no pending transactions', () => {
      it('should not log when no pending transactions', async () => {
        mockPrismaService.appleTransaction.findMany.mockResolvedValue([]);

        await service.syncPendingTransactions();

        // Should log the debug message, but not the 'Found X pending' message
        expect(Logger.prototype.debug).toHaveBeenCalledWith(
          'Checking for pending transactions',
        );
        expect(Logger.prototype.log).not.toHaveBeenCalledWith(
          expect.stringContaining('Found'),
        );
      });

      it('should still call findMany even when no transactions exist', async () => {
        mockPrismaService.appleTransaction.findMany.mockResolvedValue([]);

        await service.syncPendingTransactions();

        expect(mockPrismaService.appleTransaction.findMany).toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it('should log error when database operation fails', async () => {
        const mockError = new Error('Query timeout');
        mockPrismaService.appleTransaction.findMany.mockRejectedValue(
          mockError,
        );

        await service.syncPendingTransactions();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Pending transactions sync failed: Query timeout',
        );
      });

      it('should handle Error instances', async () => {
        const mockError = new Error('Connection lost');
        mockPrismaService.appleTransaction.findMany.mockRejectedValue(
          mockError,
        );

        await service.syncPendingTransactions();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Pending transactions sync failed: Connection lost',
        );
      });

      it('should handle non-Error exceptions', async () => {
        mockPrismaService.appleTransaction.findMany.mockRejectedValue(12345);

        await service.syncPendingTransactions();

        expect(Logger.prototype.error).toHaveBeenCalledWith(
          'Pending transactions sync failed: Unknown error',
        );
      });

      it('should not throw error when database fails', async () => {
        mockPrismaService.appleTransaction.findMany.mockRejectedValue(
          new Error('Database error'),
        );

        await expect(service.syncPendingTransactions()).resolves.not.toThrow();
      });
    });
  });

  describe('cron job integration', () => {
    it('should have all cron methods defined', () => {
      expect(service.resetDailyLimits).toBeDefined();
      expect(service.checkExpiredSubscriptions).toBeDefined();
      expect(service.checkBillingRetrySubscriptions).toBeDefined();
      expect(service.cleanupOldWebhookLogs).toBeDefined();
      expect(service.syncPendingTransactions).toBeDefined();
    });

    it('should have methods that are callable', async () => {
      mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.subscription.findMany.mockResolvedValue([]);
      mockPrismaService.appleWebhookLog.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.appleTransaction.findMany.mockResolvedValue([]);

      await expect(service.resetDailyLimits()).resolves.not.toThrow();
      await expect(service.checkExpiredSubscriptions()).resolves.not.toThrow();
      await expect(
        service.checkBillingRetrySubscriptions(),
      ).resolves.not.toThrow();
      await expect(service.cleanupOldWebhookLogs()).resolves.not.toThrow();
      await expect(service.syncPendingTransactions()).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple expired subscriptions for same user', async () => {
      // This shouldn't happen in practice, but test defensive coding
      const mockExpiredSubs = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2025-01-01'),
        },
        {
          id: 'sub-2',
          userId: 'user-1',
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2025-01-02'),
        },
      ];

      mockPrismaService.subscription.findMany.mockResolvedValue(
        mockExpiredSubs,
      );
      mockPrismaService.subscription.update.mockResolvedValue({});
      mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

      await service.checkExpiredSubscriptions();

      expect(mockPrismaService.subscription.update).toHaveBeenCalledTimes(2);
      expect(
        mockPrismaService.userPremiumFeatures.update,
      ).toHaveBeenCalledTimes(2);
    });

    it('should handle very large batch of expired subscriptions', async () => {
      const mockExpiredSubs = Array(1000)
        .fill(null)
        .map((_, i) => ({
          id: `sub-${i}`,
          userId: `user-${i}`,
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2025-01-01'),
        }));

      mockPrismaService.subscription.findMany.mockResolvedValue(
        mockExpiredSubs,
      );
      mockPrismaService.subscription.update.mockResolvedValue({});
      mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

      await service.checkExpiredSubscriptions();

      expect(mockPrismaService.subscription.update).toHaveBeenCalledTimes(1000);
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Processed 1000 expired subscriptions',
      );
    });

    it('should handle date boundaries correctly for cleanup', async () => {
      mockPrismaService.appleWebhookLog.deleteMany.mockResolvedValue({
        count: 1,
      });

      await service.cleanupOldWebhookLogs();

      const callArgs =
        mockPrismaService.appleWebhookLog.deleteMany.mock.calls[0][0];
      const thirtyDaysAgo = callArgs.where.createdAt.lt;

      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - 30);

      // Should be approximately 30 days ago (within 2 seconds tolerance)
      expect(
        Math.abs(thirtyDaysAgo.getTime() - expectedDate.getTime()),
      ).toBeLessThan(2000);
    });

    it('should handle concurrent job execution gracefully', async () => {
      mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
        count: 100,
      });
      mockPrismaService.subscription.findMany.mockResolvedValue([]);
      mockPrismaService.appleWebhookLog.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.appleTransaction.findMany.mockResolvedValue([]);

      // Simulate concurrent execution of all jobs
      const promises = [
        service.resetDailyLimits(),
        service.checkExpiredSubscriptions(),
        service.checkBillingRetrySubscriptions(),
        service.cleanupOldWebhookLogs(),
        service.syncPendingTransactions(),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle zero count results properly', async () => {
      mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
        count: 0,
      });

      await service.resetDailyLimits();

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Reset daily limits for 0 users',
      );
    });

    it('should handle partial update failures in batch processing', async () => {
      const mockExpiredSubs = [
        {
          id: 'sub-1',
          userId: 'user-1',
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2025-01-01'),
        },
        {
          id: 'sub-2',
          userId: 'user-2',
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2025-01-02'),
        },
      ];

      mockPrismaService.subscription.findMany.mockResolvedValue(
        mockExpiredSubs,
      );

      // First update succeeds, second fails
      mockPrismaService.subscription.update
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Update failed'));
      mockPrismaService.userPremiumFeatures.update.mockResolvedValue({});

      // The service catches errors in try-catch, so it should not throw
      // but it should log an error
      await service.checkExpiredSubscriptions();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Expired subscriptions check failed'),
      );
    });
  });

  describe('date precision tests', () => {
    it('should use consistent date for all updates in resetDailyLimits', async () => {
      mockPrismaService.userPremiumFeatures.updateMany.mockResolvedValue({
        count: 1,
      });

      await service.resetDailyLimits();

      const callArgs =
        mockPrismaService.userPremiumFeatures.updateMany.mock.calls[0][0];
      const lastResetAt = callArgs.data.lastResetAt;

      expect(lastResetAt).toBeInstanceOf(Date);
      expect(lastResetAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(lastResetAt.getTime()).toBeGreaterThan(Date.now() - 5000); // Within 5 seconds
    });

    it('should use current time for expired subscriptions check', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([]);

      const beforeCall = Date.now();
      await service.checkExpiredSubscriptions();
      const afterCall = Date.now();

      const callArgs = mockPrismaService.subscription.findMany.mock.calls[0][0];
      const queryDate = callArgs.where.currentPeriodEnd.lt;

      expect(queryDate.getTime()).toBeGreaterThanOrEqual(beforeCall);
      expect(queryDate.getTime()).toBeLessThanOrEqual(afterCall);
    });

    it('should use current time for billing retry check', async () => {
      mockPrismaService.subscription.findMany.mockResolvedValue([]);

      const beforeCall = Date.now();
      await service.checkBillingRetrySubscriptions();
      const afterCall = Date.now();

      const callArgs = mockPrismaService.subscription.findMany.mock.calls[0][0];
      const queryDate = callArgs.where.currentPeriodEnd.gt;

      expect(queryDate.getTime()).toBeGreaterThanOrEqual(beforeCall);
      expect(queryDate.getTime()).toBeLessThanOrEqual(afterCall);
    });
  });
});
