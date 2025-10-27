/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/**
 * Unit tests for PaymentController (Apple IAP gRPC)
 * Tests all gRPC method handlers that wrap PaymentService
 *
 * This controller is a thin gRPC wrapper around PaymentService for Apple In-App Purchase operations.
 * Each method logs the gRPC call and delegates to the corresponding PaymentService method.
 *
 * Coverage Target: 95%+
 * Test Count: ~35 tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('PaymentController (Apple IAP gRPC)', () => {
  let controller: PaymentController;
  let _paymentService: jest.Mocked<PaymentService>;
  let loggerDebugSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  // Mock PaymentService with all methods
  const mockPaymentService = {
    validateAppleReceipt: jest.fn(),
    processAppleWebhook: jest.fn(),
    processConsumablePurchase: jest.fn(),
    getUserSubscription: jest.fn(),
    updateSubscriptionStatus: jest.fn(),
    cancelSubscription: jest.fn(),
    prisma: {
      appleTransaction: {
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      $queryRaw: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    _paymentService = module.get(PaymentService);

    // Spy on logger methods
    loggerDebugSpy = jest
      .spyOn((Logger as any).prototype, 'debug')
      .mockImplementation();
    loggerErrorSpy = jest
      .spyOn((Logger as any).prototype, 'error')
      .mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    loggerDebugSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });

  describe('validateAppleReceipt', () => {
    const mockRequest = {
      receipt_data: 'base64_encoded_receipt',
      user_id: 'user_test123',
      source: 'ios_app',
    };

    it('should call PaymentService.validateAppleReceipt with correct parameters', async () => {
      const mockResponse = {
        success: true,
        subscription: {
          id: 'sub_123',
          user_id: 'user_test123',
          tier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        },
      };

      mockPaymentService.validateAppleReceipt.mockResolvedValue(mockResponse);

      const result = await controller.validateAppleReceipt(mockRequest);

      expect(mockPaymentService.validateAppleReceipt).toHaveBeenCalledWith(
        mockRequest,
      );
      expect(mockPaymentService.validateAppleReceipt).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should log debug message with user ID', async () => {
      mockPaymentService.validateAppleReceipt.mockResolvedValue({
        success: true,
      });

      await controller.validateAppleReceipt(mockRequest);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        `[gRPC] ValidateAppleReceipt called for user: ${mockRequest.user_id}`,
      );
    });

    it('should return result from PaymentService', async () => {
      const mockResponse = {
        success: true,
        subscription: {
          id: 'sub_123',
          user_id: 'user_test123',
        },
      };

      mockPaymentService.validateAppleReceipt.mockResolvedValue(mockResponse);

      const result = await controller.validateAppleReceipt(mockRequest);

      expect(result).toBe(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should propagate errors from PaymentService', async () => {
      const mockError = new Error('Apple verification failed');
      mockPaymentService.validateAppleReceipt.mockRejectedValue(mockError);

      await expect(
        controller.validateAppleReceipt(mockRequest),
      ).rejects.toThrow('Apple verification failed');
    });

    it('should handle validation failure response', async () => {
      const mockResponse = {
        success: false,
        error_message: 'Invalid receipt',
      };

      mockPaymentService.validateAppleReceipt.mockResolvedValue(mockResponse);

      const result = await controller.validateAppleReceipt(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error_message).toBe('Invalid receipt');
    });
  });

  describe('processAppleWebhook', () => {
    const mockRequest = {
      signed_payload: 'jwt_signed_payload',
      headers: {
        'x-apple-signature': 'signature',
        'content-type': 'application/json',
      },
    };

    it('should call PaymentService.processAppleWebhook with correct parameters', async () => {
      const mockResponse = {
        success: true,
        notification_type: 'DID_RENEW',
        action_taken: 'subscription_renewed',
      };

      mockPaymentService.processAppleWebhook.mockResolvedValue(mockResponse);

      const result = await controller.processAppleWebhook(mockRequest);

      expect(mockPaymentService.processAppleWebhook).toHaveBeenCalledWith(
        mockRequest,
      );
      expect(mockPaymentService.processAppleWebhook).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should log debug message', async () => {
      mockPaymentService.processAppleWebhook.mockResolvedValue({
        success: true,
      });

      await controller.processAppleWebhook(mockRequest);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        '[gRPC] ProcessAppleWebhook called',
      );
    });

    it('should return result from PaymentService', async () => {
      const mockResponse = {
        success: true,
        notification_type: 'DID_CHANGE_RENEWAL_STATUS',
        action_taken: 'renewal_disabled',
      };

      mockPaymentService.processAppleWebhook.mockResolvedValue(mockResponse);

      const result = await controller.processAppleWebhook(mockRequest);

      expect(result).toBe(mockResponse);
      expect(result.success).toBe(true);
      expect(result.notification_type).toBe('DID_CHANGE_RENEWAL_STATUS');
    });

    it('should propagate errors from PaymentService', async () => {
      const mockError = new Error('JWT verification failed');
      mockPaymentService.processAppleWebhook.mockRejectedValue(mockError);

      await expect(controller.processAppleWebhook(mockRequest)).rejects.toThrow(
        'JWT verification failed',
      );
    });

    it('should handle webhook processing failure', async () => {
      const mockResponse = {
        success: false,
        error_message: 'Invalid signature',
      };

      mockPaymentService.processAppleWebhook.mockResolvedValue(mockResponse);

      const result = await controller.processAppleWebhook(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error_message).toBe('Invalid signature');
    });
  });

  describe('processConsumablePurchase', () => {
    const mockRequest = {
      user_id: 'user_test123',
      product_id: 'com.btd.consumable.boost',
      transaction_id: 'txn_abc123',
      receipt_data: 'base64_receipt',
    };

    it('should call PaymentService.processConsumablePurchase with correct parameters', async () => {
      const mockResponse = {
        success: true,
        granted: {
          item_type: 'boost',
          quantity: 5,
        },
      };

      mockPaymentService.processConsumablePurchase.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.processConsumablePurchase(mockRequest);

      expect(mockPaymentService.processConsumablePurchase).toHaveBeenCalledWith(
        mockRequest,
      );
      expect(
        mockPaymentService.processConsumablePurchase,
      ).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should log debug message with product ID', async () => {
      mockPaymentService.processConsumablePurchase.mockResolvedValue({
        success: true,
      });

      await controller.processConsumablePurchase(mockRequest);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        `[gRPC] ProcessConsumablePurchase called for product: ${mockRequest.product_id}`,
      );
    });

    it('should return result from PaymentService', async () => {
      const mockResponse = {
        success: true,
        granted: {
          item_type: 'super_like',
          quantity: 10,
        },
      };

      mockPaymentService.processConsumablePurchase.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.processConsumablePurchase(mockRequest);

      expect(result).toBe(mockResponse);
      expect(result.success).toBe(true);
      expect(result.granted.quantity).toBe(10);
    });

    it('should propagate errors from PaymentService', async () => {
      const mockError = new Error('Transaction already processed');
      mockPaymentService.processConsumablePurchase.mockRejectedValue(mockError);

      await expect(
        controller.processConsumablePurchase(mockRequest),
      ).rejects.toThrow('Transaction already processed');
    });

    it('should handle duplicate transaction failure', async () => {
      const mockResponse = {
        success: false,
        error_message: 'Transaction already processed',
      };

      mockPaymentService.processConsumablePurchase.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.processConsumablePurchase(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error_message).toBe('Transaction already processed');
    });
  });

  describe('getUserSubscription', () => {
    const mockRequest = {
      user_id: 'user_test123',
    };

    it('should call PaymentService.getUserSubscription with correct parameters', async () => {
      const mockResponse = {
        has_subscription: true,
        subscription: {
          id: 'sub_123',
          user_id: 'user_test123',
          tier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        },
        features: {},
        usage: {},
      };

      mockPaymentService.getUserSubscription.mockResolvedValue(mockResponse);

      const result = await controller.getUserSubscription(mockRequest);

      expect(mockPaymentService.getUserSubscription).toHaveBeenCalledWith(
        mockRequest,
      );
      expect(mockPaymentService.getUserSubscription).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should log debug message with user ID', async () => {
      mockPaymentService.getUserSubscription.mockResolvedValue({
        has_subscription: false,
      });

      await controller.getUserSubscription(mockRequest);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        `[gRPC] GetUserSubscription called for user: ${mockRequest.user_id}`,
      );
    });

    it('should return result from PaymentService', async () => {
      const mockResponse = {
        has_subscription: true,
        subscription: {
          id: 'sub_123',
          user_id: 'user_test123',
        },
      };

      mockPaymentService.getUserSubscription.mockResolvedValue(mockResponse);

      const result = await controller.getUserSubscription(mockRequest);

      expect(result).toBe(mockResponse);
      expect(result.has_subscription).toBe(true);
    });

    it('should propagate errors from PaymentService', async () => {
      const mockError = new Error('Database query failed');
      mockPaymentService.getUserSubscription.mockRejectedValue(mockError);

      await expect(controller.getUserSubscription(mockRequest)).rejects.toThrow(
        'Database query failed',
      );
    });

    it('should handle user with no subscription', async () => {
      const mockResponse = {
        has_subscription: false,
      };

      mockPaymentService.getUserSubscription.mockResolvedValue(mockResponse);

      const result = await controller.getUserSubscription(mockRequest);

      expect(result.has_subscription).toBe(false);
      expect(result.subscription).toBeUndefined();
    });
  });

  describe('updateSubscriptionStatus', () => {
    const mockRequest = {
      user_id: 'user_test123',
      status: 'CANCELLED',
      reason: 'user_requested',
    };

    it('should call PaymentService.updateSubscriptionStatus with correct parameters', async () => {
      const mockResponse = {
        success: true,
        subscription: {
          id: 'sub_123',
          user_id: 'user_test123',
          status: SubscriptionStatus.CANCELLED,
        },
      };

      mockPaymentService.updateSubscriptionStatus.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.updateSubscriptionStatus(mockRequest);

      expect(mockPaymentService.updateSubscriptionStatus).toHaveBeenCalledWith(
        mockRequest,
      );
      expect(mockPaymentService.updateSubscriptionStatus).toHaveBeenCalledTimes(
        1,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should log debug message with user ID', async () => {
      mockPaymentService.updateSubscriptionStatus.mockResolvedValue({
        success: true,
      });

      await controller.updateSubscriptionStatus(mockRequest);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        `[gRPC] UpdateSubscriptionStatus called for user: ${mockRequest.user_id}`,
      );
    });

    it('should return result from PaymentService', async () => {
      const mockResponse = {
        success: true,
        subscription: {
          id: 'sub_123',
          status: SubscriptionStatus.CANCELLED,
        },
      };

      mockPaymentService.updateSubscriptionStatus.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.updateSubscriptionStatus(mockRequest);

      expect(result).toBe(mockResponse);
      expect(result.success).toBe(true);
    });

    it('should propagate errors from PaymentService', async () => {
      const mockError = new Error('No active subscription found');
      mockPaymentService.updateSubscriptionStatus.mockRejectedValue(mockError);

      await expect(
        controller.updateSubscriptionStatus(mockRequest),
      ).rejects.toThrow('No active subscription found');
    });

    it('should handle update failure', async () => {
      const mockResponse = {
        success: false,
      };

      mockPaymentService.updateSubscriptionStatus.mockResolvedValue(
        mockResponse,
      );

      const result = await controller.updateSubscriptionStatus(mockRequest);

      expect(result.success).toBe(false);
    });
  });

  describe('cancelSubscription', () => {
    const mockRequest = {
      user_id: 'user_test123',
      reason: 'too_expensive',
      immediate: false,
    };

    it('should call PaymentService.cancelSubscription with correct parameters', async () => {
      const mockResponse = {
        success: true,
        cancellation_date: '2025-02-01T00:00:00.000Z',
      };

      mockPaymentService.cancelSubscription.mockResolvedValue(mockResponse);

      const result = await controller.cancelSubscription(mockRequest);

      expect(mockPaymentService.cancelSubscription).toHaveBeenCalledWith(
        mockRequest,
      );
      expect(mockPaymentService.cancelSubscription).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });

    it('should log debug message with user ID', async () => {
      mockPaymentService.cancelSubscription.mockResolvedValue({
        success: true,
      });

      await controller.cancelSubscription(mockRequest);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        `[gRPC] CancelSubscription called for user: ${mockRequest.user_id}`,
      );
    });

    it('should return result from PaymentService', async () => {
      const mockResponse = {
        success: true,
        cancellation_date: '2025-02-01T00:00:00.000Z',
      };

      mockPaymentService.cancelSubscription.mockResolvedValue(mockResponse);

      const result = await controller.cancelSubscription(mockRequest);

      expect(result).toBe(mockResponse);
      expect(result.success).toBe(true);
      expect(result.cancellation_date).toBeDefined();
    });

    it('should propagate errors from PaymentService', async () => {
      const mockError = new Error('No active subscription found');
      mockPaymentService.cancelSubscription.mockRejectedValue(mockError);

      await expect(controller.cancelSubscription(mockRequest)).rejects.toThrow(
        'No active subscription found',
      );
    });

    it('should handle immediate cancellation', async () => {
      const immediateRequest = {
        ...mockRequest,
        immediate: true,
      };

      const mockResponse = {
        success: true,
        cancellation_date: new Date().toISOString(),
      };

      mockPaymentService.cancelSubscription.mockResolvedValue(mockResponse);

      const result = await controller.cancelSubscription(immediateRequest);

      expect(result.success).toBe(true);
      expect(mockPaymentService.cancelSubscription).toHaveBeenCalledWith(
        immediateRequest,
      );
    });

    it('should handle cancellation failure', async () => {
      const mockResponse = {
        success: false,
      };

      mockPaymentService.cancelSubscription.mockResolvedValue(mockResponse);

      const result = await controller.cancelSubscription(mockRequest);

      expect(result.success).toBe(false);
    });
  });

  describe('getTransactionHistory', () => {
    const mockRequest = {
      user_id: 'user_test123',
      limit: 10,
      offset: 0,
    };

    const mockTransactions = [
      {
        id: 'txn_1',
        userId: 'user_test123',
        transactionId: 'apple_txn_1',
        originalTransactionId: 'apple_orig_1',
        productId: 'com.btd.subscription.connect',
        type: 'subscription',
        amount: new Decimal(9.99),
        currency: 'USD',
        status: 'completed',
        processedAt: new Date('2025-01-15'),
        createdAt: new Date('2025-01-15'),
      },
      {
        id: 'txn_2',
        userId: 'user_test123',
        transactionId: 'apple_txn_2',
        originalTransactionId: 'apple_orig_2',
        productId: 'com.btd.consumable.boost',
        type: 'consumable',
        amount: new Decimal(4.99),
        currency: 'USD',
        status: 'completed',
        processedAt: new Date('2025-01-10'),
        createdAt: new Date('2025-01-10'),
      },
    ];

    it('should fetch transaction history from Prisma', async () => {
      mockPaymentService.prisma.appleTransaction.findMany.mockResolvedValue(
        mockTransactions,
      );
      mockPaymentService.prisma.appleTransaction.count.mockResolvedValue(2);

      const result = await controller.getTransactionHistory(mockRequest);

      expect(
        mockPaymentService.prisma.appleTransaction.findMany,
      ).toHaveBeenCalledWith({
        where: { userId: mockRequest.user_id },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should log debug message with user ID', async () => {
      mockPaymentService.prisma.appleTransaction.findMany.mockResolvedValue([]);
      mockPaymentService.prisma.appleTransaction.count.mockResolvedValue(0);

      await controller.getTransactionHistory(mockRequest);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        `[gRPC] GetTransactionHistory called for user: ${mockRequest.user_id}`,
      );
    });

    it('should format transactions correctly', async () => {
      mockPaymentService.prisma.appleTransaction.findMany.mockResolvedValue(
        mockTransactions,
      );
      mockPaymentService.prisma.appleTransaction.count.mockResolvedValue(2);

      const result = await controller.getTransactionHistory(mockRequest);

      expect(result.transactions[0]).toEqual({
        id: 'txn_1',
        user_id: 'user_test123',
        transaction_id: 'apple_txn_1',
        original_transaction_id: 'apple_orig_1',
        product_id: 'com.btd.subscription.connect',
        type: 'subscription',
        amount: 9.99,
        currency: 'USD',
        status: 'completed',
        processed_at: mockTransactions[0].processedAt?.toISOString(),
        created_at: mockTransactions[0].createdAt.toISOString(),
      });
    });

    it('should use default limit when provided as 0', async () => {
      const requestWithZeroLimit = {
        user_id: 'user_test123',
        limit: 0,
        offset: 0,
      };

      mockPaymentService.prisma.appleTransaction.findMany.mockResolvedValue([]);
      mockPaymentService.prisma.appleTransaction.count.mockResolvedValue(0);

      await controller.getTransactionHistory(requestWithZeroLimit);

      expect(
        mockPaymentService.prisma.appleTransaction.findMany,
      ).toHaveBeenCalledWith({
        where: { userId: requestWithZeroLimit.user_id },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle errors gracefully', async () => {
      mockPaymentService.prisma.appleTransaction.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await controller.getTransactionHistory(mockRequest);

      expect(result.transactions).toEqual([]);
      expect(result.total).toBe(0);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Get transaction history failed'),
      );
    });

    it('should handle null amount and currency', async () => {
      const transactionWithNulls = [
        {
          ...mockTransactions[0],
          amount: null,
          currency: null,
        },
      ];

      mockPaymentService.prisma.appleTransaction.findMany.mockResolvedValue(
        transactionWithNulls,
      );
      mockPaymentService.prisma.appleTransaction.count.mockResolvedValue(1);

      const result = await controller.getTransactionHistory(mockRequest);

      expect(result.transactions[0].amount).toBe(0);
      expect(result.transactions[0].currency).toBe('USD');
    });
  });

  describe('recordTransaction', () => {
    const mockRequest = {
      user_id: 'user_test123',
      transaction_id: 'apple_txn_new',
      product_id: 'com.btd.consumable.boost',
      type: 'consumable',
      amount: 4.99,
      currency: 'USD',
    };

    const mockCreatedTransaction = {
      id: 'txn_new',
      userId: 'user_test123',
      transactionId: 'apple_txn_new',
      productId: 'com.btd.consumable.boost',
      type: 'consumable',
      amount: new Decimal(4.99),
      currency: 'USD',
      status: 'completed',
      processedAt: new Date('2025-01-20'),
      createdAt: new Date('2025-01-20'),
    };

    it('should create transaction in Prisma', async () => {
      mockPaymentService.prisma.appleTransaction.create.mockResolvedValue(
        mockCreatedTransaction,
      );

      const result = await controller.recordTransaction(mockRequest);

      expect(
        mockPaymentService.prisma.appleTransaction.create,
      ).toHaveBeenCalledWith({
        data: {
          userId: mockRequest.user_id,
          transactionId: mockRequest.transaction_id,
          productId: mockRequest.product_id,
          type: mockRequest.type,
          amount: mockRequest.amount,
          currency: mockRequest.currency,
          status: 'completed',
          processedAt: expect.any(Date),
        },
      });
      expect(result.success).toBe(true);
    });

    it('should log debug message with transaction ID', async () => {
      mockPaymentService.prisma.appleTransaction.create.mockResolvedValue(
        mockCreatedTransaction,
      );

      await controller.recordTransaction(mockRequest);

      expect(loggerDebugSpy).toHaveBeenCalledWith(
        `[gRPC] RecordTransaction called for transaction: ${mockRequest.transaction_id}`,
      );
    });

    it('should format transaction response correctly', async () => {
      mockPaymentService.prisma.appleTransaction.create.mockResolvedValue(
        mockCreatedTransaction,
      );

      const result = await controller.recordTransaction(mockRequest);

      expect(result.success).toBe(true);
      expect(result.transaction).toEqual({
        id: 'txn_new',
        user_id: 'user_test123',
        transaction_id: 'apple_txn_new',
        product_id: 'com.btd.consumable.boost',
        type: 'consumable',
        amount: 4.99,
        currency: 'USD',
        status: 'completed',
        processed_at: mockCreatedTransaction.processedAt?.toISOString(),
        created_at: mockCreatedTransaction.createdAt.toISOString(),
      });
    });

    it('should handle errors gracefully', async () => {
      mockPaymentService.prisma.appleTransaction.create.mockRejectedValue(
        new Error('Duplicate transaction'),
      );

      const result = await controller.recordTransaction(mockRequest);

      expect(result.success).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Record transaction failed'),
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockPaymentService.prisma.appleTransaction.create.mockRejectedValue(
        'String error',
      );

      const result = await controller.recordTransaction(mockRequest);

      expect(result.success).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Record transaction failed: Unknown error',
      );
    });
  });

  describe('getHealth', () => {
    it('should check database connection and return healthy status', async () => {
      mockPaymentService.prisma.$queryRaw.mockResolvedValue([
        { '?column?': 1 },
      ]);

      const result = await controller.getHealth();

      expect(mockPaymentService.prisma.$queryRaw).toHaveBeenCalled();
      expect(result.healthy).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(result.version).toBe('1.0.0');
    });

    it('should log debug message', async () => {
      mockPaymentService.prisma.$queryRaw.mockResolvedValue([
        { '?column?': 1 },
      ]);

      await controller.getHealth();

      expect(loggerDebugSpy).toHaveBeenCalledWith('[gRPC] GetHealth called');
    });

    it('should return unhealthy status on database error', async () => {
      mockPaymentService.prisma.$queryRaw.mockRejectedValue(
        new Error('Connection refused'),
      );

      const result = await controller.getHealth();

      expect(result.healthy).toBe(false);
      expect(result.timestamp).toBeDefined();
      expect(result.version).toBe('1.0.0');
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Health check failed'),
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockPaymentService.prisma.$queryRaw.mockRejectedValue('String error');

      const result = await controller.getHealth();

      expect(result.healthy).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Health check failed: Unknown error',
      );
    });
  });
});
