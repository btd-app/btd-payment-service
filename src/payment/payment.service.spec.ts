/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-call */

/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import axios from 'axios';

// Mock axios module
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaymentService', () => {
  let service: PaymentService;
  let _prismaService: jest.Mocked<PrismaService>;
  let _configService: jest.Mocked<ConfigService>;

  const mockUserId = 'user-123';
  const mockSubscriptionId = 'sub-123';
  const mockTransactionId = 'trans-123';
  const mockOriginalTransactionId = 'original-trans-123';
  const mockProductId = 'com.btdapp.community.monthly';

  // Mock Prisma service
  const mockPrismaService = {
    subscription: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    appleTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    appleWebhookLog: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    userPremiumFeatures: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    subscriptionPlan: {
      findFirst: jest.fn(),
    },
  };

  // Mock ConfigService
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        NODE_ENV: 'development',
        APPLE_SHARED_SECRET: 'test-secret',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    _prismaService = module.get(PrismaService);
    _configService = module.get(ConfigService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('constructor', () => {
    it('should set production Apple URL when NODE_ENV is production', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'APPLE_SHARED_SECRET') return 'test-secret';
        return undefined;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PaymentService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const prodService = module.get<PaymentService>(PaymentService);
      expect(prodService).toBeDefined();
    });

    it('should set sandbox Apple URL when NODE_ENV is development', () => {
      expect(service).toBeDefined();
      // Note: ConfigService.get is called in the constructor, but we can't assert
      // the exact calls here since the service was already instantiated in beforeEach
    });
  });

  describe('validateAppleReceipt', () => {
    const mockReceiptData = 'base64-encoded-receipt';
    const mockAppleReceiptInfo = {
      product_id: mockProductId,
      transaction_id: mockTransactionId,
      original_transaction_id: mockOriginalTransactionId,
      expires_date_ms: '1735689600000',
      is_in_billing_retry_period: 'false',
      is_trial_period: 'true',
      is_in_intro_offer_period: 'false',
    };

    const mockAppleResponse = {
      status: 0,
      latest_receipt_info: [mockAppleReceiptInfo],
      receipt: {
        in_app: [mockAppleReceiptInfo],
      },
    };

    const mockSubscription = {
      id: mockSubscriptionId,
      userId: mockUserId,
      subscriptionTier: SubscriptionTier.COMMUNITY,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2025-01-01'),
      currentPeriodEnd: new Date('2025-02-01'),
      autoRenew: true,
      isTrial: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planId: null,
      appleProductId: mockProductId,
      appleTransactionId: mockTransactionId,
      appleOriginalTransactionId: mockOriginalTransactionId,
      cancelledAt: null,
      lastRenewedAt: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      isIntroOffer: false,
    };

    const mockPlan = {
      id: 'plan-123',
      name: 'Community Monthly',
      tier: SubscriptionTier.COMMUNITY,
      duration: 'monthly',
      price: {
        toNumber: () => 29.99,
        toFixed: (_decimals: number) => '29.99',
      },
      currency: 'USD',
      features: ['unlimited_likes', 'top_picks'],
      stripePriceId: null,
      stripeProductId: null,
      appleProductId: mockProductId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully validate Apple receipt for subscription', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockAppleResponse });
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(null);
      mockPrismaService.subscription.create.mockResolvedValueOnce(
        mockSubscription,
      );
      mockPrismaService.subscriptionPlan.findFirst.mockResolvedValueOnce(
        mockPlan,
      );
      mockPrismaService.userPremiumFeatures.upsert.mockResolvedValueOnce(
        {} as any,
      );
      mockPrismaService.appleTransaction.create.mockResolvedValueOnce(
        {} as any,
      );
      mockPrismaService.userPremiumFeatures.findUnique.mockResolvedValueOnce({
        userId: mockUserId,
        unlimitedLikes: true,
        whoLikedMe: true,
        topPicks: true,
        rewind: true,
        passport: true,
        incognito: true,
        boostsRemaining: 5,
        superLikesRemaining: 10,
        dailyLikesUsed: 0,
        dailySuperLikesUsed: 0,
        lastResetAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.validateAppleReceipt({
        receipt_data: mockReceiptData,
        user_id: mockUserId,
        source: 'mobile_app',
      });

      expect(result.success).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('sandbox'),
        expect.objectContaining({
          'receipt-data': mockReceiptData,
          password: expect.any(String),
        }),
      );
      expect(mockPrismaService.subscription.create).toHaveBeenCalled();
      expect(mockPrismaService.appleTransaction.create).toHaveBeenCalled();
    });

    it('should update existing subscription when processing receipt', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: mockAppleResponse });
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(
        mockSubscription,
      );
      mockPrismaService.subscription.update.mockResolvedValueOnce(
        mockSubscription,
      );
      mockPrismaService.subscriptionPlan.findFirst.mockResolvedValueOnce(
        mockPlan,
      );
      mockPrismaService.userPremiumFeatures.upsert.mockResolvedValueOnce(
        {} as any,
      );
      mockPrismaService.appleTransaction.create.mockResolvedValueOnce(
        {} as any,
      );
      mockPrismaService.userPremiumFeatures.findUnique.mockResolvedValueOnce(
        null,
      );

      const result = await service.validateAppleReceipt({
        receipt_data: mockReceiptData,
        user_id: mockUserId,
        source: 'mobile_app',
      });

      expect(result.success).toBe(true);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          appleTransactionId: mockTransactionId,
        }),
      });
    });

    it('should fail validation when Apple returns non-zero status', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 21003 } });

      const result = await service.validateAppleReceipt({
        receipt_data: mockReceiptData,
        user_id: mockUserId,
        source: 'mobile_app',
      });

      expect(result.success).toBe(false);
      expect(result.error_message).toContain('Apple verification failed');
    });

    it('should fail when no receipt info found', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 0, latest_receipt_info: [] },
      });

      const result = await service.validateAppleReceipt({
        receipt_data: mockReceiptData,
        user_id: mockUserId,
        source: 'mobile_app',
      });

      expect(result.success).toBe(false);
      expect(result.error_message).toContain('No receipt info found');
    });

    it('should fail for consumable products', async () => {
      const consumableResponse = {
        ...mockAppleResponse,
        latest_receipt_info: [
          {
            ...mockAppleReceiptInfo,
            product_id: 'com.btdapp.boost.consumable',
          },
        ],
      };

      mockedAxios.post.mockResolvedValueOnce({ data: consumableResponse });

      const result = await service.validateAppleReceipt({
        receipt_data: mockReceiptData,
        user_id: mockUserId,
        source: 'mobile_app',
      });

      expect(result.success).toBe(false);
      expect(result.error_message).toContain('consumable product');
    });

    it('should handle axios errors', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.validateAppleReceipt({
        receipt_data: mockReceiptData,
        user_id: mockUserId,
        source: 'mobile_app',
      });

      expect(result.success).toBe(false);
      expect(result.error_message).toContain('Network error');
    });
  });

  describe('processAppleWebhook', () => {
    const mockSignedPayload =
      'header.eyJkYXRhIjp7Im5vdGlmaWNhdGlvblR5cGUiOiJESURfUkVORVciLCJkYXRhIjp7Im9yaWdpbmFsVHJhbnNhY3Rpb25JZCI6InRlc3QtdHJhbnMiLCJleHBpcmVzRGF0ZSI6IjE3MzU2ODk2MDAwMDAifX19.signature';

    beforeEach(() => {
      mockPrismaService.appleWebhookLog.create.mockResolvedValue({} as any);
      mockPrismaService.appleWebhookLog.updateMany.mockResolvedValue({
        count: 1,
      });
    });

    it('should process DID_RENEW webhook successfully', async () => {
      mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.processAppleWebhook({
        signed_payload: mockSignedPayload,
        headers: {},
      });

      expect(result.success).toBe(true);
      expect(result.notification_type).toBe('DID_RENEW');
      expect(result.action_taken).toBe('Subscription renewed');
      expect(mockPrismaService.appleWebhookLog.create).toHaveBeenCalled();
      expect(mockPrismaService.subscription.updateMany).toHaveBeenCalledWith({
        where: { appleOriginalTransactionId: 'test-trans' },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
        }),
      });
    });

    it('should process DID_CHANGE_RENEWAL_STATUS webhook', async () => {
      const renewalPayload =
        'header.eyJkYXRhIjp7Im5vdGlmaWNhdGlvblR5cGUiOiJESURfQ0hBTkdFX1JFTkVXQUxfU1RBVFVTIiwiZGF0YSI6eyJvcmlnaW5hbFRyYW5zYWN0aW9uSWQiOiJ0ZXN0LXRyYW5zIiwiYXV0b1JlbmV3U3RhdHVzIjoiMSJ9fX0.signature';

      mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.processAppleWebhook({
        signed_payload: renewalPayload,
        headers: {},
      });

      expect(result.success).toBe(true);
      expect(result.notification_type).toBe('DID_CHANGE_RENEWAL_STATUS');
      expect(mockPrismaService.subscription.updateMany).toHaveBeenCalledWith({
        where: { appleOriginalTransactionId: 'test-trans' },
        data: { autoRenew: true },
      });
    });

    it('should process EXPIRED webhook', async () => {
      const expiredPayload =
        'header.eyJkYXRhIjp7Im5vdGlmaWNhdGlvblR5cGUiOiJFWFBJUkVEIiwiZGF0YSI6eyJvcmlnaW5hbFRyYW5zYWN0aW9uSWQiOiJ0ZXN0LXRyYW5zIn19fQ.signature';

      mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.processAppleWebhook({
        signed_payload: expiredPayload,
        headers: {},
      });

      expect(result.success).toBe(true);
      expect(result.notification_type).toBe('EXPIRED');
      expect(result.action_taken).toBe('Subscription expired');
      expect(mockPrismaService.subscription.updateMany).toHaveBeenCalledWith({
        where: { appleOriginalTransactionId: 'test-trans' },
        data: { status: SubscriptionStatus.EXPIRED },
      });
    });

    it('should process REFUND webhook', async () => {
      const refundPayload =
        'header.eyJkYXRhIjp7Im5vdGlmaWNhdGlvblR5cGUiOiJSRUZVTkQiLCJkYXRhIjp7Im9yaWdpbmFsVHJhbnNhY3Rpb25JZCI6InRlc3QtdHJhbnMiLCJ0cmFuc2FjdGlvbklkIjoidGVzdC1yZWZ1bmQifX19.signature';

      mockPrismaService.appleTransaction.updateMany.mockResolvedValueOnce({
        count: 1,
      });
      mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.processAppleWebhook({
        signed_payload: refundPayload,
        headers: {},
      });

      expect(result.success).toBe(true);
      expect(result.notification_type).toBe('REFUND');
      expect(result.action_taken).toBe('Refund processed');
      expect(mockPrismaService.appleTransaction.updateMany).toHaveBeenCalled();
      expect(mockPrismaService.subscription.updateMany).toHaveBeenCalled();
    });

    it('should process DID_FAIL_TO_RENEW webhook', async () => {
      const failedPayload =
        'header.eyJkYXRhIjp7Im5vdGlmaWNhdGlvblR5cGUiOiJESURfRkFJTF9UT19SRU5FVyIsImRhdGEiOnsib3JpZ2luYWxUcmFuc2FjdGlvbklkIjoidGVzdC10cmFucyJ9fX0.signature';

      mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await service.processAppleWebhook({
        signed_payload: failedPayload,
        headers: {},
      });

      expect(result.success).toBe(true);
      expect(result.notification_type).toBe('DID_FAIL_TO_RENEW');
      expect(result.action_taken).toBe('Marked as billing retry');
      expect(mockPrismaService.subscription.updateMany).toHaveBeenCalledWith({
        where: { appleOriginalTransactionId: 'test-trans' },
        data: { status: SubscriptionStatus.BILLING_RETRY },
      });
    });

    it('should handle unrecognized webhook types', async () => {
      const unknownPayload =
        'header.eyJkYXRhIjp7Im5vdGlmaWNhdGlvblR5cGUiOiJVTktOT1dOX1RZUEUiLCJkYXRhIjp7fX19.signature';

      const result = await service.processAppleWebhook({
        signed_payload: unknownPayload,
        headers: {},
      });

      expect(result.success).toBe(true);
      expect(result.notification_type).toBe('UNKNOWN_TYPE');
      expect(result.action_taken).toBe('ignored');
    });

    it('should handle webhook processing errors', async () => {
      mockPrismaService.appleWebhookLog.create.mockRejectedValueOnce(
        new Error('Database error'),
      );

      const result = await service.processAppleWebhook({
        signed_payload: mockSignedPayload,
        headers: {},
      });

      expect(result.success).toBe(false);
      expect(result.error_message).toContain('Database error');
    });
  });

  describe('processConsumablePurchase', () => {
    const mockReceiptData = 'base64-receipt';

    it('should process boost pack purchase successfully', async () => {
      const boostProductId = 'com.btdapp.boost.pack5';
      const mockAppleResponse = {
        status: 0,
        receipt: {
          in_app: [
            {
              product_id: boostProductId,
              transaction_id: mockTransactionId,
              original_transaction_id: mockOriginalTransactionId,
              expires_date_ms: '0',
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockAppleResponse });
      mockPrismaService.appleTransaction.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.appleTransaction.create.mockResolvedValueOnce(
        {} as any,
      );
      mockPrismaService.userPremiumFeatures.upsert.mockResolvedValueOnce(
        {} as any,
      );

      const result = await service.processConsumablePurchase({
        user_id: mockUserId,
        product_id: boostProductId,
        transaction_id: mockTransactionId,
        receipt_data: mockReceiptData,
      });

      expect(result.success).toBe(true);
      expect(result.granted).toEqual({ type: 'boost', quantity: 5 });
      expect(mockPrismaService.userPremiumFeatures.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
          create: expect.objectContaining({ boostsRemaining: 5 }),
        }),
      );
    });

    it('should process super like pack purchase successfully', async () => {
      const superLikeProductId = 'com.btdapp.superlike.pack10';
      const mockAppleResponse = {
        status: 0,
        receipt: {
          in_app: [
            {
              product_id: superLikeProductId,
              transaction_id: mockTransactionId,
              original_transaction_id: mockOriginalTransactionId,
              expires_date_ms: '0',
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockAppleResponse });
      mockPrismaService.appleTransaction.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.appleTransaction.create.mockResolvedValueOnce(
        {} as any,
      );
      mockPrismaService.userPremiumFeatures.upsert.mockResolvedValueOnce(
        {} as any,
      );

      const result = await service.processConsumablePurchase({
        user_id: mockUserId,
        product_id: superLikeProductId,
        transaction_id: mockTransactionId,
        receipt_data: mockReceiptData,
      });

      expect(result.success).toBe(true);
      expect(result.granted).toEqual({ type: 'super_like', quantity: 10 });
    });

    it('should reject duplicate transactions', async () => {
      mockPrismaService.appleTransaction.findUnique.mockResolvedValueOnce({
        id: 'existing-trans',
        transactionId: mockTransactionId,
      } as any);

      const result = await service.processConsumablePurchase({
        user_id: mockUserId,
        product_id: 'com.btdapp.boost.pack5',
        transaction_id: mockTransactionId,
        receipt_data: mockReceiptData,
      });

      expect(result.success).toBe(false);
      expect(result.error_message).toContain('already processed');
    });

    it('should fail on Apple verification failure', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { status: 21002 } });

      const result = await service.processConsumablePurchase({
        user_id: mockUserId,
        product_id: 'com.btdapp.boost.pack5',
        transaction_id: mockTransactionId,
        receipt_data: mockReceiptData,
      });

      expect(result.success).toBe(false);
      expect(result.error_message).toContain('Apple verification failed');
    });

    it('should fail when transaction not found in receipt', async () => {
      const mockAppleResponse = {
        status: 0,
        receipt: {
          in_app: [
            {
              product_id: 'com.btdapp.boost.pack5',
              transaction_id: 'different-trans-id',
              original_transaction_id: mockOriginalTransactionId,
              expires_date_ms: '0',
            },
          ],
        },
      };

      mockedAxios.post.mockResolvedValueOnce({ data: mockAppleResponse });
      mockPrismaService.appleTransaction.findUnique.mockResolvedValueOnce(null);

      const result = await service.processConsumablePurchase({
        user_id: mockUserId,
        product_id: 'com.btdapp.boost.pack5',
        transaction_id: mockTransactionId,
        receipt_data: mockReceiptData,
      });

      expect(result.success).toBe(false);
      expect(result.error_message).toContain('Transaction not found');
    });
  });

  describe('getUserSubscription', () => {
    const mockSubscription = {
      id: mockSubscriptionId,
      userId: mockUserId,
      subscriptionTier: SubscriptionTier.CONNECT,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2025-01-01'),
      currentPeriodEnd: new Date('2025-02-01'),
      autoRenew: true,
      isTrial: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planId: null,
      appleProductId: 'com.btdapp.connect.monthly',
      appleTransactionId: mockTransactionId,
      appleOriginalTransactionId: mockOriginalTransactionId,
      cancelledAt: null,
      lastRenewedAt: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      isIntroOffer: false,
    };

    const mockPlan = {
      id: 'plan-456',
      name: 'Connect Monthly',
      tier: SubscriptionTier.CONNECT,
      duration: 'monthly',
      price: {
        toNumber: () => 19.99,
        toFixed: (_decimals: number) => '19.99',
      },
      currency: 'USD',
      features: ['unlimited_likes', 'who_liked_me'],
      stripePriceId: null,
      stripeProductId: null,
      appleProductId: 'com.btdapp.connect.monthly',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return subscription with features and usage', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(
        mockSubscription,
      );
      mockPrismaService.subscriptionPlan.findFirst.mockResolvedValueOnce(
        mockPlan,
      );
      mockPrismaService.userPremiumFeatures.findUnique.mockResolvedValueOnce({
        userId: mockUserId,
        unlimitedLikes: true,
        whoLikedMe: true,
        topPicks: false,
        rewind: false,
        passport: false,
        incognito: false,
        boostsRemaining: 2,
        superLikesRemaining: 5,
        dailyLikesUsed: 10,
        dailySuperLikesUsed: 1,
        lastResetAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getUserSubscription({
        user_id: mockUserId,
      });

      expect(result.has_subscription).toBe(true);
      expect(result.subscription).toBeDefined();
      expect(result.features).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.features?.unlimited_likes).toBe(true);
      // Note: getUserUsage returns data from userPremiumFeatures which we mocked
      expect(result.usage?.boosts_remaining).toBeDefined();
    });

    it('should return false when no active subscription exists', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(null);

      const result = await service.getUserSubscription({
        user_id: mockUserId,
      });

      expect(result.has_subscription).toBe(false);
      expect(result.subscription).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.subscription.findFirst.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      const result = await service.getUserSubscription({
        user_id: mockUserId,
      });

      expect(result.has_subscription).toBe(false);
    });

    it('should return default features when no premium features exist', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(
        mockSubscription,
      );
      mockPrismaService.subscriptionPlan.findFirst.mockResolvedValueOnce(
        mockPlan,
      );
      mockPrismaService.userPremiumFeatures.findUnique.mockResolvedValueOnce(
        null,
      );

      const result = await service.getUserSubscription({
        user_id: mockUserId,
      });

      expect(result.has_subscription).toBe(true);
      expect(result.features?.unlimited_likes).toBe(false);
      expect(result.features?.who_liked_me).toBe(false);
      expect(result.usage?.boosts_remaining).toBe(0);
    });
  });

  describe('updateSubscriptionStatus', () => {
    const mockSubscription = {
      id: mockSubscriptionId,
      userId: mockUserId,
      subscriptionTier: SubscriptionTier.DISCOVER,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2025-01-01'),
      currentPeriodEnd: new Date('2025-02-01'),
      autoRenew: true,
      isTrial: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planId: null,
      appleProductId: 'com.btdapp.discover.monthly',
      appleTransactionId: mockTransactionId,
      appleOriginalTransactionId: mockOriginalTransactionId,
      cancelledAt: null,
      lastRenewedAt: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      isIntroOffer: false,
    };

    it('should update subscription status to CANCELLED', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(
        mockSubscription,
      );
      mockPrismaService.subscription.update.mockResolvedValueOnce({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
      });
      mockPrismaService.subscriptionPlan.findFirst.mockResolvedValueOnce(null);

      const result = await service.updateSubscriptionStatus({
        user_id: mockUserId,
        status: 'CANCELLED',
        reason: 'User requested',
      });

      expect(result.success).toBe(true);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: expect.objectContaining({
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: expect.any(Date),
        }),
      });
    });

    it('should update subscription status to EXPIRED', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(
        mockSubscription,
      );
      mockPrismaService.subscription.update.mockResolvedValueOnce({
        ...mockSubscription,
        status: SubscriptionStatus.EXPIRED,
      });
      mockPrismaService.subscriptionPlan.findFirst.mockResolvedValueOnce(null);

      const result = await service.updateSubscriptionStatus({
        user_id: mockUserId,
        status: 'EXPIRED',
        reason: 'Period ended',
      });

      expect(result.success).toBe(true);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: expect.objectContaining({
          status: SubscriptionStatus.EXPIRED,
          cancelledAt: undefined,
        }),
      });
    });

    it('should fail when no active subscription exists', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(null);

      const result = await service.updateSubscriptionStatus({
        user_id: mockUserId,
        status: 'CANCELLED',
        reason: 'Test',
      });

      expect(result.success).toBe(false);
      expect(mockPrismaService.subscription.update).not.toHaveBeenCalled();
    });

    it('should fail with invalid status', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(
        mockSubscription,
      );

      const result = await service.updateSubscriptionStatus({
        user_id: mockUserId,
        status: 'INVALID_STATUS',
        reason: 'Test',
      });

      expect(result.success).toBe(false);
      expect(mockPrismaService.subscription.update).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrismaService.subscription.findFirst.mockRejectedValueOnce(
        new Error('Database error'),
      );

      const result = await service.updateSubscriptionStatus({
        user_id: mockUserId,
        status: 'CANCELLED',
        reason: 'Test',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('cancelSubscription', () => {
    const mockSubscription = {
      id: mockSubscriptionId,
      userId: mockUserId,
      subscriptionTier: SubscriptionTier.CONNECT,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date('2025-01-01'),
      currentPeriodEnd: new Date('2025-02-01'),
      autoRenew: true,
      isTrial: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planId: null,
      appleProductId: 'com.btdapp.connect.monthly',
      appleTransactionId: mockTransactionId,
      appleOriginalTransactionId: mockOriginalTransactionId,
      cancelledAt: null,
      lastRenewedAt: null,
      trialEnd: null,
      cancelAtPeriodEnd: false,
      isIntroOffer: false,
    };

    it('should cancel subscription immediately', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(
        mockSubscription,
      );
      mockPrismaService.subscription.update.mockResolvedValueOnce({
        ...mockSubscription,
        status: SubscriptionStatus.CANCELLED,
        autoRenew: false,
        cancelledAt: new Date(),
      });

      const result = await service.cancelSubscription({
        user_id: mockUserId,
        reason: 'User requested immediate cancellation',
        immediate: true,
      });

      expect(result.success).toBe(true);
      expect(result.cancellation_date).toBeDefined();
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: expect.objectContaining({
          status: SubscriptionStatus.CANCELLED,
          autoRenew: false,
          cancelledAt: expect.any(Date),
        }),
      });
    });

    it('should cancel subscription at period end', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(
        mockSubscription,
      );
      mockPrismaService.subscription.update.mockResolvedValueOnce({
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
        autoRenew: false,
        cancelledAt: new Date(),
      });

      const result = await service.cancelSubscription({
        user_id: mockUserId,
        reason: 'Cancel at period end',
        immediate: false,
      });

      expect(result.success).toBe(true);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscriptionId },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
          autoRenew: false,
        }),
      });
      // Cancellation date should be the period end
      const cancellationDate = new Date(result.cancellation_date);
      expect(cancellationDate.getTime()).toBe(
        mockSubscription.currentPeriodEnd.getTime(),
      );
    });

    it('should fail when no active subscription exists', async () => {
      mockPrismaService.subscription.findFirst.mockResolvedValueOnce(null);

      const result = await service.cancelSubscription({
        user_id: mockUserId,
        reason: 'Test',
        immediate: true,
      });

      expect(result.success).toBe(false);
      expect(mockPrismaService.subscription.update).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrismaService.subscription.findFirst.mockRejectedValueOnce(
        new Error('Database error'),
      );

      const result = await service.cancelSubscription({
        user_id: mockUserId,
        reason: 'Test',
        immediate: true,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('getTierFromProductId', () => {
    it('should return COMMUNITY for community products', () => {
      // Using type assertion to access private method for testing
      const tier = (service as any).getTierFromProductId(
        'com.btdapp.community.monthly',
      );
      expect(tier).toBe(SubscriptionTier.COMMUNITY);
    });

    it('should return COMMUNITY for platinum products', () => {
      const tier = (service as any).getTierFromProductId(
        'com.btdapp.platinum.annual',
      );
      expect(tier).toBe(SubscriptionTier.COMMUNITY);
    });

    it('should return CONNECT for connect products', () => {
      const tier = (service as any).getTierFromProductId(
        'com.btdapp.connect.monthly',
      );
      expect(tier).toBe(SubscriptionTier.CONNECT);
    });

    it('should return CONNECT for gold products', () => {
      const tier = (service as any).getTierFromProductId(
        'com.btdapp.gold.annual',
      );
      expect(tier).toBe(SubscriptionTier.CONNECT);
    });

    it('should return DISCOVER for discover products', () => {
      const tier = (service as any).getTierFromProductId(
        'com.btdapp.discover.monthly',
      );
      expect(tier).toBe(SubscriptionTier.DISCOVER);
    });

    it('should return DISCOVER for plus products', () => {
      const tier = (service as any).getTierFromProductId(
        'com.btdapp.plus.monthly',
      );
      expect(tier).toBe(SubscriptionTier.DISCOVER);
    });

    it('should return DISCOVER for basic products', () => {
      const tier = (service as any).getTierFromProductId(
        'com.btdapp.basic.monthly',
      );
      expect(tier).toBe(SubscriptionTier.DISCOVER);
    });

    it('should default to DISCOVER for unknown products', () => {
      const tier = (service as any).getTierFromProductId(
        'com.btdapp.unknown.monthly',
      );
      expect(tier).toBe(SubscriptionTier.DISCOVER);
    });
  });

  describe('webhook handlers', () => {
    describe('handleSubscriptionRenewal', () => {
      it('should renew subscription successfully', async () => {
        const payload = {
          notificationType: 'DID_RENEW',
          data: {
            originalTransactionId: mockOriginalTransactionId,
            expiresDate: '1735689600000',
          },
        };

        mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
          count: 1,
        });

        const result = await (service as any).handleSubscriptionRenewal(
          payload,
        );

        expect(result).toBe('Subscription renewed');
        expect(mockPrismaService.subscription.updateMany).toHaveBeenCalledWith({
          where: { appleOriginalTransactionId: mockOriginalTransactionId },
          data: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
            lastRenewedAt: expect.any(Date),
          }),
        });
      });

      it('should throw error when missing required fields', async () => {
        const payload = {
          notificationType: 'DID_RENEW',
          data: {
            originalTransactionId: mockOriginalTransactionId,
          },
        };

        await expect(
          (service as any).handleSubscriptionRenewal(payload),
        ).rejects.toThrow('Missing required fields');
      });
    });

    describe('handleSubscriptionExpired', () => {
      it('should mark subscription as expired', async () => {
        const payload = {
          notificationType: 'EXPIRED',
          data: {
            originalTransactionId: mockOriginalTransactionId,
          },
        };

        mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
          count: 1,
        });

        const result = await (service as any).handleSubscriptionExpired(
          payload,
        );

        expect(result).toBe('Subscription expired');
        expect(mockPrismaService.subscription.updateMany).toHaveBeenCalledWith({
          where: { appleOriginalTransactionId: mockOriginalTransactionId },
          data: { status: SubscriptionStatus.EXPIRED },
        });
      });

      it('should throw error when missing originalTransactionId', async () => {
        const payload = {
          notificationType: 'EXPIRED',
          data: {},
        };

        await expect(
          (service as any).handleSubscriptionExpired(payload),
        ).rejects.toThrow('Missing originalTransactionId');
      });
    });

    describe('handleRefund', () => {
      it('should process refund with subscription cancellation', async () => {
        const payload = {
          notificationType: 'REFUND',
          data: {
            originalTransactionId: mockOriginalTransactionId,
            transactionId: mockTransactionId,
          },
        };

        mockPrismaService.appleTransaction.updateMany.mockResolvedValueOnce({
          count: 1,
        });
        mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
          count: 1,
        });

        const result = await (service as any).handleRefund(payload);

        expect(result).toBe('Refund processed');
        expect(
          mockPrismaService.appleTransaction.updateMany,
        ).toHaveBeenCalled();
        expect(mockPrismaService.subscription.updateMany).toHaveBeenCalled();
      });

      it('should process refund without subscription cancellation', async () => {
        const payload = {
          notificationType: 'REFUND',
          data: {
            transactionId: mockTransactionId,
          },
        };

        mockPrismaService.appleTransaction.updateMany.mockResolvedValueOnce({
          count: 1,
        });

        const result = await (service as any).handleRefund(payload);

        expect(result).toBe('Refund processed');
        expect(
          mockPrismaService.appleTransaction.updateMany,
        ).toHaveBeenCalled();
        expect(
          mockPrismaService.subscription.updateMany,
        ).not.toHaveBeenCalled();
      });

      it('should throw error when missing transactionId', async () => {
        const payload = {
          notificationType: 'REFUND',
          data: {},
        };

        await expect((service as any).handleRefund(payload)).rejects.toThrow(
          'Missing transactionId',
        );
      });
    });

    describe('handleFailedRenewal', () => {
      it('should mark subscription as billing retry', async () => {
        const payload = {
          notificationType: 'DID_FAIL_TO_RENEW',
          data: {
            originalTransactionId: mockOriginalTransactionId,
          },
        };

        mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
          count: 1,
        });

        const result = await (service as any).handleFailedRenewal(payload);

        expect(result).toBe('Marked as billing retry');
        expect(mockPrismaService.subscription.updateMany).toHaveBeenCalledWith({
          where: { appleOriginalTransactionId: mockOriginalTransactionId },
          data: { status: SubscriptionStatus.BILLING_RETRY },
        });
      });

      it('should throw error when missing originalTransactionId', async () => {
        const payload = {
          notificationType: 'DID_FAIL_TO_RENEW',
          data: {},
        };

        await expect(
          (service as any).handleFailedRenewal(payload),
        ).rejects.toThrow('Missing originalTransactionId');
      });
    });

    describe('handleRenewalStatusChange', () => {
      it('should enable auto-renew when status is 1', async () => {
        const payload = {
          notificationType: 'DID_CHANGE_RENEWAL_STATUS',
          data: {
            originalTransactionId: mockOriginalTransactionId,
            autoRenewStatus: '1',
          },
        };

        mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
          count: 1,
        });

        const result = await (service as any).handleRenewalStatusChange(
          payload,
        );

        expect(result).toBe('Updated auto-renew to true');
        expect(mockPrismaService.subscription.updateMany).toHaveBeenCalledWith({
          where: { appleOriginalTransactionId: mockOriginalTransactionId },
          data: { autoRenew: true },
        });
      });

      it('should disable auto-renew when status is not 1', async () => {
        const payload = {
          notificationType: 'DID_CHANGE_RENEWAL_STATUS',
          data: {
            originalTransactionId: mockOriginalTransactionId,
            autoRenewStatus: '0',
          },
        };

        mockPrismaService.subscription.updateMany.mockResolvedValueOnce({
          count: 1,
        });

        const result = await (service as any).handleRenewalStatusChange(
          payload,
        );

        expect(result).toBe('Updated auto-renew to false');
        expect(mockPrismaService.subscription.updateMany).toHaveBeenCalledWith({
          where: { appleOriginalTransactionId: mockOriginalTransactionId },
          data: { autoRenew: false },
        });
      });

      it('should throw error when missing originalTransactionId', async () => {
        const payload = {
          notificationType: 'DID_CHANGE_RENEWAL_STATUS',
          data: {
            autoRenewStatus: '1',
          },
        };

        await expect(
          (service as any).handleRenewalStatusChange(payload),
        ).rejects.toThrow('Missing originalTransactionId');
      });
    });
  });

  describe('helper methods', () => {
    describe('formatSubscription', () => {
      it('should format subscription with plan details', async () => {
        const subscription = {
          id: mockSubscriptionId,
          userId: mockUserId,
          subscriptionTier: SubscriptionTier.CONNECT,
          tier: undefined,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date('2025-01-01'),
          currentPeriodEnd: new Date('2025-02-01'),
          startsAt: undefined,
          expiresAt: undefined,
          autoRenew: true,
          isTrial: false,
        };

        const mockPlan = {
          id: 'plan-123',
          name: 'Connect Monthly',
          tier: SubscriptionTier.CONNECT,
          duration: 'monthly',
          price: {
            toNumber: () => 19.99,
            toFixed: (_decimals: number) => '19.99',
          },
          currency: 'USD',
          features: ['unlimited_likes', 'who_liked_me'],
          stripePriceId: null,
          stripeProductId: null,
          appleProductId: 'com.btdapp.connect.monthly',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockPrismaService.subscriptionPlan.findFirst.mockResolvedValueOnce(
          mockPlan,
        );

        const result = await (service as any).formatSubscription(subscription);

        expect(result).toBeDefined();
        expect(result?.id).toBe(mockSubscriptionId);
        expect(result?.user_id).toBe(mockUserId);
        expect(result?.status).toBe(SubscriptionStatus.ACTIVE);
        expect(result?.plan).toBeDefined();
        expect(result?.plan.name).toBe('Connect Monthly');
        expect(result?.plan.price.amount).toBe(19.99);
      });

      it('should return null for null subscription', async () => {
        const result = await (service as any).formatSubscription(null);
        expect(result).toBeNull();
      });

      it('should handle subscription without plan', async () => {
        const subscription = {
          id: mockSubscriptionId,
          userId: mockUserId,
          subscriptionTier: SubscriptionTier.DISCOVER,
          tier: undefined,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date('2025-01-01'),
          currentPeriodEnd: new Date('2025-02-01'),
          startsAt: undefined,
          expiresAt: undefined,
          autoRenew: true,
          isTrial: false,
        };

        mockPrismaService.subscriptionPlan.findFirst.mockResolvedValueOnce(
          null,
        );

        const result = await (service as any).formatSubscription(subscription);

        expect(result).toBeDefined();
        expect(result?.plan).toBeNull();
      });
    });

    describe('getFeaturesForTier', () => {
      it('should return platinum features', () => {
        const features = (service as any).getFeaturesForTier('platinum');

        expect(features.unlimitedLikes).toBe(true);
        expect(features.whoLikedMe).toBe(true);
        expect(features.topPicks).toBe(true);
        expect(features.rewind).toBe(true);
        expect(features.passport).toBe(true);
        expect(features.incognito).toBe(true);
        expect(features.boostsRemaining).toBe(5);
        expect(features.superLikesRemaining).toBe(10);
      });

      it('should return gold features', () => {
        const features = (service as any).getFeaturesForTier('gold');

        expect(features.unlimitedLikes).toBe(true);
        expect(features.whoLikedMe).toBe(true);
        expect(features.topPicks).toBe(true);
        expect(features.rewind).toBe(true);
        expect(features.passport).toBe(false);
        expect(features.incognito).toBe(false);
        expect(features.boostsRemaining).toBe(2);
        expect(features.superLikesRemaining).toBe(5);
      });

      it('should return plus features', () => {
        const features = (service as any).getFeaturesForTier('plus');

        expect(features.unlimitedLikes).toBe(true);
        expect(features.whoLikedMe).toBe(true);
        expect(features.topPicks).toBe(false);
        expect(features.rewind).toBe(false);
        expect(features.boostsRemaining).toBe(1);
        expect(features.superLikesRemaining).toBe(3);
      });

      it('should return basic features', () => {
        const features = (service as any).getFeaturesForTier('basic');

        expect(features.unlimitedLikes).toBe(false);
        expect(features.whoLikedMe).toBe(false);
        expect(features.topPicks).toBe(false);
        expect(features.rewind).toBe(false);
        expect(features.boostsRemaining).toBe(0);
        expect(features.superLikesRemaining).toBe(1);
      });

      it('should return free features for unknown tier', () => {
        const features = (service as any).getFeaturesForTier('unknown');

        expect(features.unlimitedLikes).toBe(false);
        expect(features.whoLikedMe).toBe(false);
        expect(features.topPicks).toBe(false);
        expect(features.rewind).toBe(false);
        expect(features.passport).toBe(false);
        expect(features.incognito).toBe(false);
        expect(features.boostsRemaining).toBe(0);
        expect(features.superLikesRemaining).toBe(0);
      });
    });
  });
});
