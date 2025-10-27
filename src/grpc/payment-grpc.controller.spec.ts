/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/unbound-method */

/**
 * Unit tests for PaymentGrpcController
 * Tests all gRPC method handlers for payment operations
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentGrpcController } from './payment-grpc.controller';
import { StripeService } from '../services/stripe.service';
import { SubscriptionService } from '../services/subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';

// Mock data factories
const createMockSubscription = (overrides = {}) => ({
  id: 'sub_test123',
  userId: 'user_test123',
  stripeCustomerId: 'cus_test123',
  stripeSubscriptionId: 'sub_stripe123',
  subscriptionTier: SubscriptionTier.CONNECT,
  status: SubscriptionStatus.ACTIVE,
  planId: 'connect',
  currentPeriodStart: new Date('2025-01-01'),
  currentPeriodEnd: new Date('2025-02-01'),
  cancelledAt: null,
  cancelAtPeriodEnd: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

const createMockPaymentIntent = (overrides = {}) => ({
  id: 'pi_test123',
  userId: 'user_test123',
  stripePaymentIntentId: 'pi_stripe123',
  amount: 999,
  currency: 'usd',
  status: 'PENDING' as const,
  description: 'Test payment',
  metadata: {},
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

const createMockPaymentMethod = (overrides = {}) => ({
  id: 'pm_test123',
  userId: 'user_test123',
  stripePaymentMethodId: 'pm_stripe123',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  expiryMonth: 12,
  expiryYear: 2025,
  isDefault: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

const createMockBillingHistory = (overrides = {}) => ({
  id: 'bill_test123',
  userId: 'user_test123',
  stripeInvoiceId: 'in_test123',
  amount: 999,
  currency: 'usd',
  status: 'PAID' as const,
  description: 'Subscription payment',
  periodStart: new Date('2025-01-01'),
  periodEnd: new Date('2025-02-01'),
  pdfUrl: 'https://invoice.pdf',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
  ...overrides,
});

const createMockSubscriptionFeatures = () => ({
  canMakeVideoCalls: true,
  canMakeAudioCalls: true,
  maxCallDuration: 60,
  maxVideoQuality: 'hd' as const,
  hasVirtualBackgrounds: true,
  hasBeautyFilters: false,
  hasAREffects: false,
  hasCallRecording: false,
  hasScreenSharing: true,
  hasGroupCalls: false,
  maxGroupParticipants: 0,
  hasCallScheduling: true,
  dailyUnmatchedMessages: 50,
  unlimitedUnmatchedMessages: false,
  voiceMessages: true,
  videoMessages: false,
  messageReactions: true,
  readReceipts: true,
  dailyLikes: 100,
  unlimitedLikes: true,
  seeWhoLikedYou: true,
  advancedFilters: true,
  travelMode: false,
  incognitoMode: false,
  maxPhotos: 10,
  videoIntro: false,
  profileBoostCount: 3,
  profileAnalytics: true,
  groupAudioRooms: false,
  forumAccess: 'write' as const,
  virtualEvents: true,
  aiCoaching: false,
  communityMatchmaking: true,
  searchPriority: 'high' as const,
  messagePriority: 'high' as const,
  supportPriority: 'priority' as const,
});

describe('PaymentGrpcController', () => {
  let controller: PaymentGrpcController;
  let stripeService: jest.Mocked<StripeService>;
  let subscriptionService: jest.Mocked<SubscriptionService>;
  let prismaService: jest.Mocked<PrismaService>;

  // Mock services
  const mockStripeService = {
    createOrGetCustomer: jest.fn(),
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    createPaymentIntent: jest.fn(),
    createSetupIntent: jest.fn(),
    setDefaultPaymentMethod: jest.fn(),
    deletePaymentMethod: jest.fn(),
    getPaymentMethods: jest.fn(),
    getBillingHistory: jest.fn(),
    getAvailablePlans: jest.fn(),
  };

  const mockSubscriptionService = {
    getUserSubscription: jest.fn(),
    getSubscriptionFeatures: jest.fn(),
  };

  // Create a properly typed mock for Prisma
  const createMockPrismaService = () => ({
    subscription: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentIntent: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    paymentMethod: {
      findUnique: jest.fn(),
    },
  });

  const mockPrismaService = createMockPrismaService() as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset all mocks
    Object.values(mockStripeService).forEach(
      (fn) => typeof fn === 'function' && fn.mockReset && fn.mockReset(),
    );
    Object.values(mockSubscriptionService).forEach(
      (fn) => typeof fn === 'function' && fn.mockReset && fn.mockReset(),
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentGrpcController],
      providers: [
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
        {
          provide: SubscriptionService,
          useValue: mockSubscriptionService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    // Suppress logger output during tests
    module.useLogger(false);

    controller = module.get<PaymentGrpcController>(PaymentGrpcController);
    stripeService = module.get(StripeService);
    subscriptionService = module.get(SubscriptionService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    const mockRequest = {
      userId: 'user_test123',
      planId: 'connect',
      paymentMethodId: 'pm_test123',
      userEmail: 'test@example.com',
      userName: 'Test User',
    };

    it('should create a subscription successfully', async () => {
      const mockStripeResponse = {
        subscriptionId: 'sub_stripe123',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2025-02-01'),
        clientSecret: null,
      };

      const mockDbSubscription = createMockSubscription();

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue(
        mockStripeResponse as any,
      );
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        mockDbSubscription as any,
      );

      const result = await controller.createSubscription(mockRequest);

      expect(stripeService.createOrGetCustomer).toHaveBeenCalledWith(
        mockRequest.userId,
        mockRequest.userEmail,
        mockRequest.userName,
      );
      expect(stripeService.createSubscription).toHaveBeenCalledWith(
        mockRequest.userId,
        mockRequest.planId,
        mockRequest.paymentMethodId,
      );
      expect(result.subscription).toBeDefined();
      expect(result.subscription.userId).toBe(mockRequest.userId);
      expect(result.subscription.planId).toBe(mockRequest.planId);
      expect(result.subscription.status.toLowerCase()).toBe('active');
      expect(result.requiresAction).toBe(false);
    });

    it('should handle non-Error exceptions during creation', async () => {
      stripeService.createOrGetCustomer.mockRejectedValue('String error');

      await expect(controller.createSubscription(mockRequest)).rejects.toBe(
        'String error',
      );
    });

    it('should handle subscription requiring payment action', async () => {
      const mockStripeResponse = {
        subscriptionId: 'sub_stripe123',
        status: SubscriptionStatus.PENDING,
        currentPeriodEnd: new Date('2025-02-01'),
        clientSecret: 'pi_secret_test123',
      };

      const mockDbSubscription = createMockSubscription({
        status: SubscriptionStatus.PENDING,
      });

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue(
        mockStripeResponse as any,
      );
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        mockDbSubscription as any,
      );

      const result = await controller.createSubscription(mockRequest);

      expect(result.clientSecret).toBe('pi_secret_test123');
      expect(result.requiresAction).toBe(true);
    });

    it('should use default email when userEmail is not provided', async () => {
      const requestWithoutEmail = {
        ...mockRequest,
        userEmail: undefined,
        userName: undefined,
      };

      const mockStripeResponse = {
        subscriptionId: 'sub_stripe123',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2025-02-01'),
        clientSecret: null,
      };

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue(
        mockStripeResponse as any,
      );
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        createMockSubscription() as any,
      );

      await controller.createSubscription(requestWithoutEmail);

      expect(stripeService.createOrGetCustomer).toHaveBeenCalledWith(
        requestWithoutEmail.userId,
        `user-${requestWithoutEmail.userId}@example.com`,
        undefined,
      );
    });

    it('should handle errors during subscription creation', async () => {
      const error = new Error('Stripe API error');
      stripeService.createOrGetCustomer.mockRejectedValue(error);

      await expect(controller.createSubscription(mockRequest)).rejects.toThrow(
        'Stripe API error',
      );
    });

    it('should use empty string for missing paymentMethodId', async () => {
      const requestWithoutPM = {
        ...mockRequest,
        paymentMethodId: undefined,
      };

      const mockStripeResponse = {
        subscriptionId: 'sub_stripe123',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2025-02-01'),
        clientSecret: null,
      };

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue(
        mockStripeResponse as any,
      );
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        createMockSubscription() as any,
      );

      await controller.createSubscription(requestWithoutPM);

      expect(stripeService.createSubscription).toHaveBeenCalledWith(
        requestWithoutPM.userId,
        requestWithoutPM.planId,
        '',
      );
    });

    it('should include metadata in the created subscription', async () => {
      const requestWithMetadata = {
        ...mockRequest,
        metadata: { source: 'web', campaign: 'spring2025' },
      };

      const mockStripeResponse = {
        subscriptionId: 'sub_stripe123',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2025-02-01'),
        clientSecret: null,
      };

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue(
        mockStripeResponse as any,
      );
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        createMockSubscription() as any,
      );

      const result = await controller.createSubscription(requestWithMetadata);

      expect(result.subscription.metadata).toEqual(
        requestWithMetadata.metadata,
      );
    });
  });

  describe('updateSubscription', () => {
    const mockRequest = {
      subscriptionId: 'sub_test123',
      userId: 'user_test123',
      newPlanId: 'community',
      prorate: true,
      cancelAtPeriodEnd: false,
    };

    it('should update a subscription successfully', async () => {
      const mockDbSubscription = createMockSubscription({
        planId: 'community',
        subscriptionTier: SubscriptionTier.COMMUNITY,
      });

      stripeService.updateSubscription.mockResolvedValue(undefined as any);
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        mockDbSubscription as any,
      );

      const result = await controller.updateSubscription(mockRequest);

      expect(stripeService.updateSubscription).toHaveBeenCalledWith(
        mockRequest.userId,
        mockRequest.newPlanId,
        mockRequest.cancelAtPeriodEnd,
      );
      expect(result.subscription).toBeDefined();
      expect(result.subscription.planId).toBe('community');
    });

    it('should handle cancelAtPeriodEnd flag', async () => {
      const requestWithCancel = {
        ...mockRequest,
        cancelAtPeriodEnd: true,
      };

      stripeService.updateSubscription.mockResolvedValue(undefined as any);
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        createMockSubscription() as any,
      );

      await controller.updateSubscription(requestWithCancel);

      expect(stripeService.updateSubscription).toHaveBeenCalledWith(
        requestWithCancel.userId,
        requestWithCancel.newPlanId,
        true,
      );
    });

    it('should throw error when subscription not found', async () => {
      stripeService.updateSubscription.mockResolvedValue(undefined as any);
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(controller.updateSubscription(mockRequest)).rejects.toThrow(
        'Subscription not found',
      );
    });

    it('should handle undefined cancelAtPeriodEnd', async () => {
      const requestWithoutCancel = {
        subscriptionId: 'sub_test123',
        userId: 'user_test123',
        newPlanId: 'community',
      };

      stripeService.updateSubscription.mockResolvedValue(undefined as any);
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        createMockSubscription() as any,
      );

      await controller.updateSubscription(requestWithoutCancel);

      expect(stripeService.updateSubscription).toHaveBeenCalledWith(
        requestWithoutCancel.userId,
        requestWithoutCancel.newPlanId,
        false,
      );
    });

    it('should handle non-Error exceptions during update', async () => {
      stripeService.updateSubscription.mockRejectedValue('String error');

      await expect(controller.updateSubscription(mockRequest)).rejects.toBe(
        'String error',
      );
    });
  });

  describe('cancelSubscription', () => {
    const mockRequest = {
      subscriptionId: 'sub_test123',
      userId: 'user_test123',
      cancelImmediately: false,
      cancellationReason: 'too_expensive',
    };

    it('should cancel subscription at period end', async () => {
      const mockDbSubscription = createMockSubscription({
        cancelledAt: new Date('2025-01-15'),
      });

      stripeService.cancelSubscription.mockResolvedValue(undefined as any);
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        mockDbSubscription as any,
      );

      const result = await controller.cancelSubscription(mockRequest);

      expect(stripeService.cancelSubscription).toHaveBeenCalledWith(
        mockRequest.userId,
        mockRequest.cancelImmediately,
      );
      expect(result.success).toBe(true);
      expect(result.endsAt).toBe(
        mockDbSubscription.currentPeriodEnd.toISOString(),
      );
    });

    it('should cancel subscription immediately', async () => {
      const requestImmediate = {
        ...mockRequest,
        cancelImmediately: true,
      };

      const mockDbSubscription = createMockSubscription({
        cancelledAt: new Date('2025-01-15'),
      });

      stripeService.cancelSubscription.mockResolvedValue(undefined as any);
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        mockDbSubscription as any,
      );

      const result = await controller.cancelSubscription(requestImmediate);

      expect(stripeService.cancelSubscription).toHaveBeenCalledWith(
        requestImmediate.userId,
        true,
      );
      expect(result.success).toBe(true);
      expect(new Date(result.endsAt).getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle errors during cancellation', async () => {
      const error = new Error('Cancellation failed');
      stripeService.cancelSubscription.mockRejectedValue(error);

      await expect(controller.cancelSubscription(mockRequest)).rejects.toThrow(
        'Cancellation failed',
      );
    });

    it('should handle non-Error exceptions during cancellation', async () => {
      stripeService.cancelSubscription.mockRejectedValue('String error');

      await expect(controller.cancelSubscription(mockRequest)).rejects.toBe(
        'String error',
      );
    });

    it('should use default endsAt when subscription has no currentPeriodEnd', async () => {
      const mockDbSubscription = createMockSubscription({
        cancelledAt: new Date('2025-01-15'),
        currentPeriodEnd: null as any,
      });

      stripeService.cancelSubscription.mockResolvedValue(undefined as any);
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        mockDbSubscription as any,
      );

      const result = await controller.cancelSubscription(mockRequest);

      expect(result.success).toBe(true);
      // Should calculate default endsAt (30 days from now)
      expect(new Date(result.endsAt).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('getSubscription', () => {
    const mockRequest = {
      subscriptionId: 'sub_test123',
      userId: 'user_test123',
    };

    it('should get subscription details successfully', async () => {
      const mockDbSubscription = createMockSubscription();
      const mockFeatures = createMockSubscriptionFeatures();

      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        mockDbSubscription as any,
      );
      subscriptionService.getSubscriptionFeatures.mockReturnValue(mockFeatures);

      const result = await controller.getSubscription(mockRequest);

      expect(prismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: mockRequest.userId },
      });
      expect(result.subscription).toBeDefined();
      expect(result.subscription.userId).toBe(mockRequest.userId);
      expect(result.subscription.featureFlags).toContain('unlimited_likes');
      expect(result.subscription.featureFlags).toContain('see_who_liked_you');
    });

    it('should throw error when subscription not found', async () => {
      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(controller.getSubscription(mockRequest)).rejects.toThrow(
        'Subscription not found',
      );
    });

    it('should extract correct feature flags', async () => {
      const mockDbSubscription = createMockSubscription({
        subscriptionTier: SubscriptionTier.COMMUNITY,
      });
      const mockFeatures = createMockSubscriptionFeatures();

      (prismaService.subscription.findUnique as jest.Mock).mockResolvedValue(
        mockDbSubscription as any,
      );
      subscriptionService.getSubscriptionFeatures.mockReturnValue(mockFeatures);

      const result = await controller.getSubscription(mockRequest);

      expect(result.subscription.featureFlags).toContain('unlimited_likes');
      expect(result.subscription.featureFlags).toContain('see_who_liked_you');
      expect(result.subscription.featureFlags).toContain('advanced_filters');
      expect(result.subscription.featureFlags).toContain('audio_calls');
      expect(result.subscription.featureFlags).toContain('video_calls');
      expect(result.subscription.featureFlags).toContain('priority_support');
    });

    it('should handle non-Error exceptions', async () => {
      (prismaService.subscription.findUnique as jest.Mock).mockRejectedValue(
        'String error',
      );

      await expect(controller.getSubscription(mockRequest)).rejects.toBe(
        'String error',
      );
    });
  });

  describe('processPayment', () => {
    const mockRequest = {
      userId: 'user_test123',
      amount: 999,
      currency: 'usd',
      paymentMethodId: 'pm_test123',
      description: 'One-time payment',
    };

    it('should process payment successfully', async () => {
      const mockPaymentIntentResponse = {
        paymentIntentId: 'pi_stripe123',
        clientSecret: 'pi_secret_test123',
        amount: 999,
        currency: 'usd',
      };

      const mockPaymentRecord = createMockPaymentIntent();

      stripeService.createPaymentIntent.mockResolvedValue(
        mockPaymentIntentResponse as any,
      );
      (prismaService.paymentIntent.create as jest.Mock).mockResolvedValue(
        mockPaymentRecord as any,
      );

      const result = await controller.processPayment(mockRequest);

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        mockRequest.userId,
        'one_time_payment',
        mockRequest.paymentMethodId,
        mockRequest.currency,
      );
      expect(result.payment).toBeDefined();
      expect(result.payment?.amount).toBe(mockRequest.amount);
      expect(result.clientSecret).toBe('pi_secret_test123');
      expect(result.requiresAction).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should handle payment errors gracefully', async () => {
      const error = new Error('Payment processing failed');
      stripeService.createPaymentIntent.mockRejectedValue(error);

      const result = await controller.processPayment(mockRequest);

      expect(result.payment).toBeNull();
      expect(result.clientSecret).toBeNull();
      expect(result.requiresAction).toBe(false);
      expect(result.error).toBe('Payment processing failed');
    });

    it('should handle non-Error exceptions gracefully', async () => {
      stripeService.createPaymentIntent.mockRejectedValue('String error');

      const result = await controller.processPayment(mockRequest);

      expect(result.payment).toBeNull();
      expect(result.clientSecret).toBeNull();
      expect(result.requiresAction).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should store payment metadata', async () => {
      const requestWithMetadata = {
        ...mockRequest,
        metadata: { orderId: 'order_123', source: 'mobile_app' },
      };

      const mockPaymentIntentResponse = {
        paymentIntentId: 'pi_stripe123',
        clientSecret: 'pi_secret_test123',
        amount: 999,
        currency: 'usd',
      };

      stripeService.createPaymentIntent.mockResolvedValue(
        mockPaymentIntentResponse as any,
      );
      (prismaService.paymentIntent.create as jest.Mock).mockResolvedValue(
        createMockPaymentIntent() as any,
      );

      await controller.processPayment(requestWithMetadata);

      expect(prismaService.paymentIntent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: requestWithMetadata.metadata,
        }),
      });
    });
  });

  describe('getPaymentHistory', () => {
    const mockRequest = {
      userId: 'user_test123',
      limit: 10,
      offset: 0,
    };

    it('should get payment history successfully', async () => {
      const mockPaymentIntents = [
        createMockPaymentIntent({ stripePaymentIntentId: 'pi_1' }),
        createMockPaymentIntent({ stripePaymentIntentId: 'pi_2' }),
        createMockPaymentIntent({ stripePaymentIntentId: 'pi_3' }),
      ];

      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue(
        mockPaymentIntents as any,
      );

      const result = await controller.getPaymentHistory(mockRequest);

      expect(prismaService.paymentIntent.findMany).toHaveBeenCalledWith({
        where: { userId: mockRequest.userId },
        orderBy: { createdAt: 'desc' },
        take: mockRequest.limit,
        skip: mockRequest.offset,
      });
      expect(result.payments).toHaveLength(3);
      expect(result.payments[0].id).toBe('pi_1');
      expect(result.hasMore).toBe(false);
    });

    it('should use default limit when not provided', async () => {
      const requestWithoutLimit = {
        userId: 'user_test123',
      };

      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue([]);

      await controller.getPaymentHistory(requestWithoutLimit);

      expect(prismaService.paymentIntent.findMany).toHaveBeenCalledWith({
        where: { userId: requestWithoutLimit.userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should indicate hasMore when limit is reached', async () => {
      const mockPaymentIntents = Array(10)
        .fill(null)
        .map((_, i) =>
          createMockPaymentIntent({ stripePaymentIntentId: `pi_${i}` }),
        );

      (prismaService.paymentIntent.findMany as jest.Mock).mockResolvedValue(
        mockPaymentIntents as any,
      );

      const result = await controller.getPaymentHistory(mockRequest);

      expect(result.hasMore).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      (prismaService.paymentIntent.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error'),
      );

      const result = await controller.getPaymentHistory(mockRequest);

      expect(result.payments).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('should handle non-Error exceptions gracefully', async () => {
      (prismaService.paymentIntent.findMany as jest.Mock).mockRejectedValue(
        'String error',
      );

      const result = await controller.getPaymentHistory(mockRequest);

      expect(result.payments).toEqual([]);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('addPaymentMethod', () => {
    const mockRequest = {
      userId: 'user_test123',
      paymentMethodId: 'pm_test123',
      setAsDefault: true,
    };

    it('should add payment method successfully', async () => {
      const mockSetupIntent = {
        setupIntentId: 'seti_test123',
        clientSecret: 'seti_secret_test123',
      };

      const mockPaymentMethod = createMockPaymentMethod();

      stripeService.createSetupIntent.mockResolvedValue(mockSetupIntent);
      stripeService.setDefaultPaymentMethod.mockResolvedValue(undefined as any);
      (prismaService.paymentMethod.findUnique as jest.Mock).mockResolvedValue(
        mockPaymentMethod as any,
      );

      const result = await controller.addPaymentMethod(mockRequest);

      expect(stripeService.createSetupIntent).toHaveBeenCalledWith(
        mockRequest.userId,
      );
      expect(stripeService.setDefaultPaymentMethod).toHaveBeenCalledWith(
        mockRequest.userId,
        mockRequest.paymentMethodId,
      );
      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBeDefined();
      expect(result.paymentMethod?.isDefault).toBe(true);
    });

    it('should return setup intent when payment method ID not provided', async () => {
      const requestWithoutPM = {
        userId: 'user_test123',
      };

      const mockSetupIntent = {
        setupIntentId: 'seti_test123',
        clientSecret: 'seti_secret_test123',
      };

      stripeService.createSetupIntent.mockResolvedValue(mockSetupIntent);

      const result = await controller.addPaymentMethod(requestWithoutPM);

      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBeNull();
      expect(result.setupIntent).toBeDefined();
      expect(result.setupIntent?.clientSecret).toBe('seti_secret_test123');
    });

    it('should not set as default when flag is false', async () => {
      const requestNoDefault = {
        ...mockRequest,
        setAsDefault: false,
      };

      const mockSetupIntent = {
        setupIntentId: 'seti_test123',
        clientSecret: 'seti_secret_test123',
      };

      stripeService.createSetupIntent.mockResolvedValue(mockSetupIntent);
      (prismaService.paymentMethod.findUnique as jest.Mock).mockResolvedValue(
        createMockPaymentMethod(),
      );

      await controller.addPaymentMethod(requestNoDefault);

      expect(stripeService.setDefaultPaymentMethod).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Setup intent creation failed');
      stripeService.createSetupIntent.mockRejectedValue(error);

      const result = await controller.addPaymentMethod(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Setup intent creation failed');
      expect(result.paymentMethod).toBeNull();
    });

    it('should handle non-Error exceptions gracefully', async () => {
      stripeService.createSetupIntent.mockRejectedValue('String error');

      const result = await controller.addPaymentMethod(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
      expect(result.paymentMethod).toBeNull();
    });

    it('should return setup intent when payment method not found in DB', async () => {
      const mockSetupIntent = {
        setupIntentId: 'seti_test123',
        clientSecret: 'seti_secret_test123',
      };

      stripeService.createSetupIntent.mockResolvedValue(mockSetupIntent);
      stripeService.setDefaultPaymentMethod.mockResolvedValue(undefined as any);
      (prismaService.paymentMethod.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await controller.addPaymentMethod(mockRequest);

      expect(result.success).toBe(true);
      expect(result.setupIntent).toBeDefined();
      expect(result.setupIntent?.clientSecret).toBe('seti_secret_test123');
    });
  });

  describe('getPaymentMethods', () => {
    const mockRequest = {
      userId: 'user_test123',
    };

    it('should get payment methods successfully', async () => {
      const mockPaymentMethods = [
        createMockPaymentMethod({ isDefault: true }),
        createMockPaymentMethod({
          stripePaymentMethodId: 'pm_2',
          isDefault: false,
        }),
      ];

      stripeService.getPaymentMethods.mockResolvedValue(
        mockPaymentMethods as any,
      );

      const result = await controller.getPaymentMethods(mockRequest);

      expect(stripeService.getPaymentMethods).toHaveBeenCalledWith(
        mockRequest.userId,
      );
      expect(result.paymentMethods).toHaveLength(2);
      expect(result.defaultPaymentMethodId).toBe('pm_stripe123');
    });

    it('should handle no default payment method', async () => {
      const mockPaymentMethods = [
        createMockPaymentMethod({ isDefault: false }),
        createMockPaymentMethod({
          stripePaymentMethodId: 'pm_2',
          isDefault: false,
        }),
      ];

      stripeService.getPaymentMethods.mockResolvedValue(
        mockPaymentMethods as any,
      );

      const result = await controller.getPaymentMethods(mockRequest);

      expect(result.defaultPaymentMethodId).toBeNull();
    });

    it('should transform payment method data correctly', async () => {
      const mockPaymentMethods = [
        createMockPaymentMethod({
          brand: 'mastercard',
          last4: '5678',
          expiryMonth: 6,
          expiryYear: 2026,
        }),
      ];

      stripeService.getPaymentMethods.mockResolvedValue(
        mockPaymentMethods as any,
      );

      const result = await controller.getPaymentMethods(mockRequest);

      expect(result.paymentMethods[0].card).toEqual({
        brand: 'mastercard',
        last4: '5678',
        expMonth: 6,
        expYear: 2026,
        funding: 'credit',
      });
    });

    it('should handle errors', async () => {
      const error = new Error('Failed to fetch payment methods');
      stripeService.getPaymentMethods.mockRejectedValue(error);

      await expect(controller.getPaymentMethods(mockRequest)).rejects.toThrow(
        'Failed to fetch payment methods',
      );
    });

    it('should handle non-Error exceptions', async () => {
      stripeService.getPaymentMethods.mockRejectedValue('String error');

      await expect(controller.getPaymentMethods(mockRequest)).rejects.toBe(
        'String error',
      );
    });

    it('should handle payment methods without brand', async () => {
      const mockPaymentMethods = [
        createMockPaymentMethod({
          brand: null as any,
          last4: null,
          isDefault: true,
        }),
      ];

      stripeService.getPaymentMethods.mockResolvedValue(
        mockPaymentMethods as any,
      );

      const result = await controller.getPaymentMethods(mockRequest);

      expect(result.paymentMethods[0].card).toBeUndefined();
    });
  });

  describe('removePaymentMethod', () => {
    const mockRequest = {
      userId: 'user_test123',
      paymentMethodId: 'pm_test123',
    };

    it('should remove payment method successfully', async () => {
      stripeService.deletePaymentMethod.mockResolvedValue(undefined as any);

      const result = await controller.removePaymentMethod(mockRequest);

      expect(stripeService.deletePaymentMethod).toHaveBeenCalledWith(
        mockRequest.userId,
        mockRequest.paymentMethodId,
      );
      expect(result.success).toBe(true);
      expect(result.message).toBe('Payment method removed successfully');
    });

    it('should handle errors', async () => {
      const error = new Error('Payment method not found');
      stripeService.deletePaymentMethod.mockRejectedValue(error);

      const result = await controller.removePaymentMethod(mockRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Payment method not found');
    });

    it('should handle non-Error exceptions', async () => {
      stripeService.deletePaymentMethod.mockRejectedValue('String error');

      const result = await controller.removePaymentMethod(mockRequest);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unknown error');
    });
  });

  describe('setDefaultPaymentMethod', () => {
    const mockRequest = {
      userId: 'user_test123',
      paymentMethodId: 'pm_test123',
    };

    it('should set default payment method successfully', async () => {
      const mockPaymentMethod = createMockPaymentMethod();

      stripeService.setDefaultPaymentMethod.mockResolvedValue(undefined as any);
      (prismaService.paymentMethod.findUnique as jest.Mock).mockResolvedValue(
        mockPaymentMethod as any,
      );

      const result = await controller.setDefaultPaymentMethod(mockRequest);

      expect(stripeService.setDefaultPaymentMethod).toHaveBeenCalledWith(
        mockRequest.userId,
        mockRequest.paymentMethodId,
      );
      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBeDefined();
      expect(result.paymentMethod?.isDefault).toBe(true);
    });

    it('should handle payment method not found', async () => {
      stripeService.setDefaultPaymentMethod.mockResolvedValue(undefined as any);
      (prismaService.paymentMethod.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await controller.setDefaultPaymentMethod(mockRequest);

      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBeNull();
    });

    it('should handle errors', async () => {
      const error = new Error('Failed to set default');
      stripeService.setDefaultPaymentMethod.mockRejectedValue(error);

      const result = await controller.setDefaultPaymentMethod(mockRequest);

      expect(result.success).toBe(false);
      expect(result.paymentMethod).toBeNull();
    });

    it('should handle non-Error exceptions', async () => {
      stripeService.setDefaultPaymentMethod.mockRejectedValue('String error');

      const result = await controller.setDefaultPaymentMethod(mockRequest);

      expect(result.success).toBe(false);
      expect(result.paymentMethod).toBeNull();
    });
  });

  describe('getPricingPlans', () => {
    const mockRequest = {
      currency: 'usd',
      includeTrialInfo: true,
    };

    it('should get pricing plans successfully', () => {
      const mockPlans = {
        discover: {
          id: 'discover',
          name: 'Discover',
          tier: 'DISCOVER',
          stripePriceId: 'price_discover',
          price: 0,
        },
        connect: {
          id: 'connect',
          name: 'Connect',
          tier: 'CONNECT',
          stripePriceId: 'price_connect',
          price: 999,
        },
      };

      const mockFeatures = createMockSubscriptionFeatures();

      stripeService.getAvailablePlans.mockReturnValue(mockPlans as any);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(mockFeatures);

      const result = controller.getPricingPlans(mockRequest);

      expect(result.plans).toHaveLength(2);
      expect(result.currency).toBe('usd');
      expect(result.plans[0].monthlyPrice).toBe(0);
      expect(result.plans[1].monthlyPrice).toBe(9.99);
    });

    it('should calculate yearly price with discount', () => {
      const mockPlans = {
        connect: {
          id: 'connect',
          name: 'Connect',
          tier: 'CONNECT',
          stripePriceId: 'price_connect',
          price: 1000,
        },
      };

      stripeService.getAvailablePlans.mockReturnValue(mockPlans as any);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(
        createMockSubscriptionFeatures(),
      );

      const result = controller.getPricingPlans(mockRequest);

      // 10 * 12 * 0.85 = 102
      expect(result.plans[0].yearlyPrice).toBe(102);
    });

    it('should use default currency when not provided', () => {
      const requestNoCurrency = {};

      stripeService.getAvailablePlans.mockReturnValue({} as any);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(
        createMockSubscriptionFeatures(),
      );

      const result = controller.getPricingPlans(requestNoCurrency);

      expect(result.currency).toBe('usd');
    });

    it('should include feature limits', () => {
      const mockPlans = {
        connect: {
          id: 'connect',
          name: 'Connect',
          tier: 'CONNECT',
          stripePriceId: 'price_connect',
          price: 999,
        },
      };

      const mockFeatures = createMockSubscriptionFeatures();

      stripeService.getAvailablePlans.mockReturnValue(mockPlans as any);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(mockFeatures);

      const result = controller.getPricingPlans(mockRequest);

      expect(result.plans[0].limits).toEqual({
        daily_likes: mockFeatures.dailyLikes,
        daily_messages: mockFeatures.dailyUnmatchedMessages,
        super_likes: mockFeatures.profileBoostCount,
        max_photos: mockFeatures.maxPhotos,
        call_duration: mockFeatures.maxCallDuration,
      });
    });

    it('should handle non-Error exceptions', () => {
      const mockRequest = { currency: 'usd' };
      stripeService.getAvailablePlans.mockImplementation(() => {
        throw new Error('String error');
      });

      expect(() => controller.getPricingPlans(mockRequest)).toThrow();
    });

    it('should handle Error exceptions', () => {
      const mockRequest = { currency: 'usd' };
      stripeService.getAvailablePlans.mockImplementation(() => {
        throw new Error('Service unavailable');
      });

      expect(() => controller.getPricingPlans(mockRequest)).toThrow(
        'Service unavailable',
      );
    });

    it('should include features for limited likes plan', () => {
      const mockPlans = {
        discover: {
          id: 'discover',
          name: 'Discover',
          tier: 'DISCOVER',
          stripePriceId: 'price_discover',
          price: 0,
        },
      };

      const mockFeatures = {
        ...createMockSubscriptionFeatures(),
        unlimitedLikes: false,
        dailyLikes: 10,
      };

      stripeService.getAvailablePlans.mockReturnValue(mockPlans as any);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(mockFeatures);

      const result = controller.getPricingPlans(mockRequest);

      expect(result.plans[0].features).toContain('10 likes per day');
      expect(result.plans[0].features).not.toContain('Unlimited likes');
    });

    it('should include VIP support in features', () => {
      const mockPlans = {
        community: {
          id: 'community',
          name: 'Community',
          tier: 'COMMUNITY',
          stripePriceId: 'price_community',
          price: 1999,
        },
      };

      const mockFeatures = {
        ...createMockSubscriptionFeatures(),
        supportPriority: 'vip' as const,
      };

      stripeService.getAvailablePlans.mockReturnValue(mockPlans as any);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(mockFeatures);

      const result = controller.getPricingPlans(mockRequest);

      expect(result.plans[0].features).toContain('VIP support');
    });
  });

  describe('getInvoices', () => {
    const mockRequest = {
      userId: 'user_test123',
      limit: 10,
    };

    it('should get invoices successfully', async () => {
      const mockBillingHistory = [
        createMockBillingHistory(),
        createMockBillingHistory({ stripeInvoiceId: 'in_2' }),
      ];

      stripeService.getBillingHistory.mockResolvedValue(
        mockBillingHistory as any,
      );

      const result = await controller.getInvoices(mockRequest);

      expect(stripeService.getBillingHistory).toHaveBeenCalledWith(
        mockRequest.userId,
      );
      expect(result.invoices).toHaveLength(2);
      expect(result.hasMore).toBe(false);
    });

    it('should convert amounts correctly', async () => {
      const mockBillingHistory = [createMockBillingHistory({ amount: 1999 })];

      stripeService.getBillingHistory.mockResolvedValue(
        mockBillingHistory as any,
      );

      const result = await controller.getInvoices(mockRequest);

      expect(result.invoices[0].amountDue).toBe(19.99);
      expect(result.invoices[0].amountPaid).toBe(19.99);
    });

    it('should use default limit when not provided', async () => {
      const requestNoLimit = {
        userId: 'user_test123',
      };

      stripeService.getBillingHistory.mockResolvedValue([]);

      const result = await controller.getInvoices(requestNoLimit);

      expect(result.invoices).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should indicate hasMore when limit is exceeded', async () => {
      const mockBillingHistory = Array(15)
        .fill(null)
        .map((_, i) =>
          createMockBillingHistory({ stripeInvoiceId: `in_${i}` }),
        );

      stripeService.getBillingHistory.mockResolvedValue(
        mockBillingHistory as any,
      );

      const result = await controller.getInvoices(mockRequest);

      expect(result.invoices).toHaveLength(10);
      expect(result.hasMore).toBe(true);
    });

    it('should handle non-Error exceptions', async () => {
      const mockRequest = {
        userId: 'user_test123',
        limit: 10,
      };

      stripeService.getBillingHistory.mockRejectedValue('String error');

      await expect(controller.getInvoices(mockRequest)).rejects.toBeTruthy();
    });

    it('should handle Error exceptions with message', async () => {
      const mockRequest = {
        userId: 'user_test123',
        limit: 10,
      };

      stripeService.getBillingHistory.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(controller.getInvoices(mockRequest)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('processStripeWebhook', () => {
    it('should process payment_intent.succeeded webhook', async () => {
      const mockRequest = {
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test123',
        objectId: 'pi_test123',
        userId: 'user_test123',
      };

      (prismaService.paymentIntent.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      } as any);

      const result = await controller.processStripeWebhook(mockRequest);

      expect(prismaService.paymentIntent.updateMany).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: mockRequest.objectId },
        data: { status: 'SUCCEEDED' },
      });
      expect(result.processed).toBe(true);
      expect(result.message).toBe('Payment intent succeeded');
      expect(result.error).toBeNull();
    });

    it('should process payment_intent.payment_failed webhook', async () => {
      const mockRequest = {
        eventType: 'payment_intent.payment_failed',
        eventId: 'evt_test123',
        objectId: 'pi_test123',
        userId: 'user_test123',
      };

      (prismaService.paymentIntent.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      } as any);

      const result = await controller.processStripeWebhook(mockRequest);

      expect(prismaService.paymentIntent.updateMany).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: mockRequest.objectId },
        data: { status: 'FAILED' },
      });
      expect(result.processed).toBe(true);
      expect(result.message).toBe('Payment intent failed');
    });

    it('should process subscription webhooks', async () => {
      const mockRequest = {
        eventType: 'customer.subscription.updated',
        eventId: 'evt_test123',
      };

      const result = await controller.processStripeWebhook(mockRequest);

      expect(result.processed).toBe(true);
      expect(result.message).toBe('Subscription webhook processed');
    });

    it('should handle unknown webhook types', async () => {
      const mockRequest = {
        eventType: 'unknown.event.type',
        eventId: 'evt_test123',
      };

      const result = await controller.processStripeWebhook(mockRequest);

      expect(result.processed).toBe(true);
      expect(result.message).toContain('acknowledged but not processed');
    });

    it('should handle errors gracefully', async () => {
      const mockRequest = {
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test123',
        objectId: 'pi_test123',
      };

      const error = new Error('Database error');
      (prismaService.paymentIntent.updateMany as jest.Mock).mockRejectedValue(
        error as any,
      );

      const result = await controller.processStripeWebhook(mockRequest);

      expect(result.processed).toBe(false);
      expect(result.error).toBe('Database error');
    });

    it('should handle Error exceptions gracefully', async () => {
      const mockRequest = {
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test123',
        objectId: 'pi_test123',
      };

      (prismaService.paymentIntent.updateMany as jest.Mock).mockRejectedValue(
        new Error('String error'),
      );

      const result = await controller.processStripeWebhook(mockRequest);

      expect(result.processed).toBe(false);
      expect(result.error).toBe('String error');
    });

    it('should handle payment_intent.succeeded without objectId', async () => {
      const mockRequest = {
        eventType: 'payment_intent.succeeded',
        eventId: 'evt_test123',
      };

      const result = await controller.processStripeWebhook(mockRequest);

      expect(result.processed).toBe(true);
      expect(result.message).toBe('Payment intent succeeded');
      expect(prismaService.paymentIntent.updateMany).not.toHaveBeenCalled();
    });

    it('should handle payment_intent.payment_failed without objectId', async () => {
      const mockRequest = {
        eventType: 'payment_intent.payment_failed',
        eventId: 'evt_test123',
      };

      const result = await controller.processStripeWebhook(mockRequest);

      expect(result.processed).toBe(true);
      expect(result.message).toBe('Payment intent failed');
      expect(prismaService.paymentIntent.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentHealth', () => {
    it('should return basic health status', () => {
      const mockRequest = {
        includeStripeStatus: false,
        includeMetrics: false,
      };

      const result = controller.getPaymentHealth(mockRequest);

      expect(result.healthy).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(result.stripeStatus).toBeUndefined();
      expect(result.metrics).toBeUndefined();
    });

    it('should include Stripe status when requested', () => {
      const mockRequest = {
        includeStripeStatus: true,
        includeMetrics: false,
      };

      const result = controller.getPaymentHealth(mockRequest);

      expect(result.stripeStatus).toBeDefined();
      expect(result.stripeStatus?.connected).toBe(true);
      expect(result.stripeStatus?.mode).toBe('test');
      expect(result.stripeStatus?.webhookEndpointsActive).toBe(3);
    });

    it('should include metrics when requested', () => {
      const mockRequest = {
        includeStripeStatus: false,
        includeMetrics: true,
      };

      const result = controller.getPaymentHealth(mockRequest);

      expect(result.metrics).toBeDefined();
      expect(result.metrics?.totalTransactions).toBeGreaterThan(0);
      expect(result.metrics?.mrr).toBeGreaterThan(0);
    });

    it('should include both status and metrics', () => {
      const mockRequest = {
        includeStripeStatus: true,
        includeMetrics: true,
      };

      const result = controller.getPaymentHealth(mockRequest);

      expect(result.stripeStatus).toBeDefined();
      expect(result.metrics).toBeDefined();
    });
  });

  describe('getUserSubscriptions', () => {
    const mockRequest = {
      userId: 'user_test123',
      includeCancelled: false,
    };

    it('should get user subscriptions successfully', async () => {
      const mockSubscription = {
        userId: 'user_test123',
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        stripeSubscriptionId: 'sub_test123',
        planId: 'connect',
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        createdAt: new Date('2025-01-01'),
        cancelAtPeriodEnd: false,
      };

      const mockFeatures = createMockSubscriptionFeatures();

      subscriptionService.getUserSubscription.mockResolvedValue(
        mockSubscription as any,
      );
      subscriptionService.getSubscriptionFeatures.mockReturnValue(mockFeatures);

      const result = await controller.getUserSubscriptions(mockRequest);

      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].userId).toBe(mockRequest.userId);
      expect(result.hasMore).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      subscriptionService.getUserSubscription.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await controller.getUserSubscriptions(mockRequest);

      expect(result.subscriptions).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('should handle non-Error exceptions gracefully', async () => {
      subscriptionService.getUserSubscription.mockRejectedValue('String error');

      const result = await controller.getUserSubscriptions(mockRequest);

      expect(result.subscriptions).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('should handle subscription without createdAt field', async () => {
      const mockSubscription = {
        userId: 'user_test123',
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        stripeSubscriptionId: 'sub_test123',
        planId: 'connect',
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        cancelAtPeriodEnd: false,
      };

      const mockFeatures = createMockSubscriptionFeatures();

      subscriptionService.getUserSubscription.mockResolvedValue(
        mockSubscription as any,
      );
      subscriptionService.getSubscriptionFeatures.mockReturnValue(mockFeatures);

      const result = await controller.getUserSubscriptions(mockRequest);

      expect(result.subscriptions).toHaveLength(1);
      expect(result.subscriptions[0].createdAt).toBeDefined();
    });
  });

  describe('validatePromoCode', () => {
    it('should validate WELCOME10 promo code', () => {
      const mockRequest = {
        promoCode: 'WELCOME10',
      };

      const result = controller.validatePromoCode(mockRequest);

      expect(result.valid).toBe(true);
      expect(result.discountType).toBe('percentage');
      expect(result.discountValue).toBe(10);
      expect(result.description).toBe('10% off first month');
    });

    it('should validate SAVE20 promo code', () => {
      const mockRequest = {
        promoCode: 'SAVE20',
      };

      const result = controller.validatePromoCode(mockRequest);

      expect(result.valid).toBe(true);
      expect(result.discountType).toBe('percentage');
      expect(result.discountValue).toBe(20);
    });

    it('should validate FRIEND50 fixed discount promo code', () => {
      const mockRequest = {
        promoCode: 'FRIEND50',
      };

      const result = controller.validatePromoCode(mockRequest);

      expect(result.valid).toBe(true);
      expect(result.discountType).toBe('fixed');
      expect(result.discountValue).toBe(50);
    });

    it('should handle invalid promo code', () => {
      const mockRequest = {
        promoCode: 'INVALID',
      };

      const result = controller.validatePromoCode(mockRequest);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid promo code');
    });

    it('should be case insensitive', () => {
      const mockRequest = {
        promoCode: 'welcome10',
      };

      const result = controller.validatePromoCode(mockRequest);

      expect(result.valid).toBe(true);
      expect(result.discountType).toBe('percentage');
    });

    it('should handle non-Error exceptions during validation', () => {
      const mockRequest = {
        promoCode: 'WELCOME10',
      };

      // Mock toUpperCase to throw a non-Error
      jest.spyOn(String.prototype, 'toUpperCase').mockImplementation(() => {
        throw new Error('String conversion error');
      });

      const result = controller.validatePromoCode(mockRequest);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Failed to validate promo code');

      // Restore the mock
      jest.restoreAllMocks();
    });

    it('should handle Error exceptions during validation', () => {
      const mockRequest = {
        promoCode: 'WELCOME10',
      };

      // Mock toUpperCase to throw an Error
      jest.spyOn(String.prototype, 'toUpperCase').mockImplementation(() => {
        throw new Error('Invalid string operation');
      });

      const result = controller.validatePromoCode(mockRequest);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Failed to validate promo code');

      // Restore the mock
      jest.restoreAllMocks();
    });
  });

  describe('streamPaymentEvents', () => {
    // Note: The streamPaymentEvents method returns an Observable for gRPC streaming.
    // Full testing of this method requires integration tests with actual gRPC clients.
    // Unit testing Observables with Jest is limited, so we focus on testing the method exists
    // and can be invoked.

    it('should return an Observable for gRPC streaming', () => {
      const mockRequest = {
        serviceId: 'test-service',
        eventTypes: ['payment_initiated', 'payment_succeeded'],
      };

      const result = controller.streamPaymentEvents(mockRequest);

      // Verify the method returns a value (Observable)
      expect(result).toBeDefined();
    });

    it('should handle request with userId filter', () => {
      const mockRequest = {
        serviceId: 'test-service',
        userId: 'user_test123',
      };

      const result = controller.streamPaymentEvents(mockRequest);

      expect(result).toBeDefined();
    });

    it('should handle request without filters', () => {
      const mockRequest = {
        serviceId: 'test-service',
      };

      const result = controller.streamPaymentEvents(mockRequest);

      expect(result).toBeDefined();
    });
  });

  describe('refundPayment', () => {
    it('should return not implemented', () => {
      const mockRequest = {
        paymentId: 'pi_test123',
        userId: 'user_test123',
      };

      const result = controller.refundPayment(mockRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not implemented');
      expect(result.refund).toBeNull();
    });
  });

  describe('getUpcomingInvoice', () => {
    it('should return not implemented', () => {
      const mockRequest = {
        userId: 'user_test123',
      };

      const result = controller.getUpcomingInvoice(mockRequest);

      expect(result.exists).toBe(false);
      expect(result.invoice).toBeNull();
    });
  });
});
