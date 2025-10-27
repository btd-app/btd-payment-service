/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/**
 * SubscriptionController Unit Tests
 * Comprehensive test suite for subscription management endpoints
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionController } from './subscription.controller';
import { StripeService } from '../services/stripe.service';
import { SubscriptionService } from '../services/subscription.service';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
import { Request } from 'express';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CreateCheckoutSessionDto,
  CreatePortalSessionDto,
  ValidateFeatureAccessDto,
} from '../dto/subscription.dto';

/**
 * Mock type for AuthenticatedRequest
 * Matches the interface from auth.guard.ts
 */
interface _AuthenticatedRequest extends Partial<Request> {
  user: {
    id: string;
    email: string;
  };
}

// Mock types
type MockStripeService = {
  [K in keyof StripeService]: jest.Mock;
};

type MockSubscriptionService = {
  [K in keyof SubscriptionService]: jest.Mock;
};

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let stripeService: MockStripeService;
  let subscriptionService: MockSubscriptionService;

  // Test user data
  const mockUserId = 'test-user-123';
  const mockUserEmail = 'test@example.com';
  const mockSubscriptionId = 'sub_test123';
  const mockPlanId = 'price_connect_monthly';
  const mockPaymentMethodId = 'pm_test123';

  // Mock authenticated request
  const createMockRequest = (userId = mockUserId, email = mockUserEmail) => ({
    user: {
      id: userId,
      email: email,
    },
  });

  // Mock subscription data
  const createMockSubscription = (overrides = {}) => ({
    id: 'subscription-123',
    userId: mockUserId,
    subscriptionTier: SubscriptionTier.CONNECT,
    stripeSubscriptionId: mockSubscriptionId,
    stripeCustomerId: 'cus_test123',
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: new Date('2025-01-01'),
    currentPeriodEnd: new Date('2025-02-01'),
    cancelAtPeriodEnd: false,
    planId: mockPlanId,
    trialEnd: null,
    cancelledAt: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  });

  beforeEach(async () => {
    // Create mock services
    const mockStripeServiceMethods: MockStripeService = {
      getCurrentSubscription: jest.fn(),
      createOrGetCustomer: jest.fn(),
      createSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      cancelSubscriptionImmediately: jest.fn(),
      createCheckoutSession: jest.fn(),
      createPortalSession: jest.fn(),
      // Add other methods as jest.fn() to satisfy type
      createPaymentIntent: jest.fn(),
      getBillingHistory: jest.fn(),
      getPaymentMethods: jest.fn(),
      createSetupIntent: jest.fn(),
      deletePaymentMethod: jest.fn(),
      setDefaultPaymentMethod: jest.fn(),
      getAvailablePlans: jest.fn(),
    } as unknown as MockStripeService;

    const mockSubscriptionServiceMethods: MockSubscriptionService = {
      getSubscriptionFeatures: jest.fn(),
      validateFeatureAccess: jest.fn(),
      getCallUsageStats: jest.fn(),
      trackFeatureUsage: jest.fn(),
      // Add other methods as jest.fn() to satisfy type
      getUserSubscription: jest.fn(),
      validateVideoCallAccess: jest.fn(),
      validateCallDuration: jest.fn(),
      getMonthlyCallUsage: jest.fn(),
      updateCallUsage: jest.fn(),
      canScheduleCalls: jest.fn(),
      getMaxVideoQuality: jest.fn(),
      getTierLevel: jest.fn(),
      hasTierAccess: jest.fn(),
    } as unknown as MockSubscriptionService;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionController],
      providers: [
        {
          provide: StripeService,
          useValue: mockStripeServiceMethods,
        },
        {
          provide: SubscriptionService,
          useValue: mockSubscriptionServiceMethods,
        },
      ],
    }).compile();

    controller = module.get<SubscriptionController>(SubscriptionController);
    stripeService = module.get(StripeService);
    subscriptionService = module.get(SubscriptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentSubscription', () => {
    it('should return current user subscription', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const mockSubscription = createMockSubscription();
      stripeService.getCurrentSubscription.mockResolvedValue(mockSubscription);

      // Act
      const result = await controller.getCurrentSubscription(mockRequest);

      // Assert
      expect(result).toEqual(mockSubscription);
      expect(stripeService.getCurrentSubscription).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(stripeService.getCurrentSubscription).toHaveBeenCalledTimes(1);
    });

    it('should use fallback user ID when user is not authenticated', async () => {
      // Arrange
      const mockRequest = {
        user: undefined as unknown as { id: string; email: string },
      } as any;
      const mockSubscription = createMockSubscription({
        userId: 'test-user',
      });
      stripeService.getCurrentSubscription.mockResolvedValue(mockSubscription);

      // Act
      const result = await controller.getCurrentSubscription(mockRequest);

      // Assert
      expect(result).toEqual(mockSubscription);
      expect(stripeService.getCurrentSubscription).toHaveBeenCalledWith(
        'test-user',
      );
    });

    it('should use fallback user ID when user.id is null', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: null as unknown as string,
          email: mockUserEmail,
        },
      } as any;
      const mockSubscription = createMockSubscription({
        userId: 'test-user',
      });
      stripeService.getCurrentSubscription.mockResolvedValue(mockSubscription);

      // Act
      const result = await controller.getCurrentSubscription(mockRequest);

      // Assert
      expect(result).toEqual(mockSubscription);
      expect(stripeService.getCurrentSubscription).toHaveBeenCalledWith(
        'test-user',
      );
    });

    it('should use fallback user ID when user.id is empty string', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: '',
          email: mockUserEmail,
        },
      } as any;
      const mockSubscription = createMockSubscription({
        userId: 'test-user',
      });
      stripeService.getCurrentSubscription.mockResolvedValue(mockSubscription);

      // Act
      const result = await controller.getCurrentSubscription(mockRequest);

      // Assert
      expect(result).toEqual(mockSubscription);
      expect(stripeService.getCurrentSubscription).toHaveBeenCalledWith(
        'test-user',
      );
    });

    it('should propagate errors from StripeService', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const error = new Error('Subscription not found');
      stripeService.getCurrentSubscription.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getCurrentSubscription(mockRequest),
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('createSubscription', () => {
    it('should create a new subscription successfully', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: CreateSubscriptionDto = {
        planId: mockPlanId,
        paymentMethodId: mockPaymentMethodId,
      };
      const mockResponse = {
        subscriptionId: mockSubscriptionId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2025-02-01'),
      };

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.createSubscription(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(stripeService.createOrGetCustomer).toHaveBeenCalledWith(
        mockUserId,
        mockUserEmail,
      );
      expect(stripeService.createSubscription).toHaveBeenCalledWith(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
      );
    });

    it('should use fallback email when user email is not available', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: mockUserId,
          email: undefined,
        },
      } as any;
      const dto: CreateSubscriptionDto = {
        planId: mockPlanId,
        paymentMethodId: mockPaymentMethodId,
      };

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue({
        subscriptionId: mockSubscriptionId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(),
      });

      // Act
      await controller.createSubscription(dto, mockRequest);

      // Assert
      expect(stripeService.createOrGetCustomer).toHaveBeenCalledWith(
        mockUserId,
        'test@example.com',
      );
    });

    it('should use fallback user ID when user.id is null', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: null as unknown as string,
          email: mockUserEmail,
        },
      } as any;
      const dto: CreateSubscriptionDto = {
        planId: mockPlanId,
        paymentMethodId: mockPaymentMethodId,
      };

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue({
        subscriptionId: mockSubscriptionId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(),
      });

      // Act
      await controller.createSubscription(dto, mockRequest);

      // Assert
      expect(stripeService.createOrGetCustomer).toHaveBeenCalledWith(
        'test-user',
        mockUserEmail,
      );
    });

    it('should use fallback email when user.email is null', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: mockUserId,
          email: null as unknown as string,
        },
      } as any;
      const dto: CreateSubscriptionDto = {
        planId: mockPlanId,
        paymentMethodId: mockPaymentMethodId,
      };

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue({
        subscriptionId: mockSubscriptionId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(),
      });

      // Act
      await controller.createSubscription(dto, mockRequest);

      // Assert
      expect(stripeService.createOrGetCustomer).toHaveBeenCalledWith(
        mockUserId,
        'test@example.com',
      );
    });

    it('should use both fallbacks when user object is undefined', async () => {
      // Arrange
      const mockRequest = {
        user: undefined as unknown as { id: string; email: string },
      } as any;
      const dto: CreateSubscriptionDto = {
        planId: mockPlanId,
        paymentMethodId: mockPaymentMethodId,
      };

      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockResolvedValue({
        subscriptionId: mockSubscriptionId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(),
      });

      // Act
      await controller.createSubscription(dto, mockRequest);

      // Assert
      expect(stripeService.createOrGetCustomer).toHaveBeenCalledWith(
        'test-user',
        'test@example.com',
      );
    });

    it('should propagate errors from customer creation', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: CreateSubscriptionDto = {
        planId: mockPlanId,
        paymentMethodId: mockPaymentMethodId,
      };
      const error = new Error('Customer creation failed');
      stripeService.createOrGetCustomer.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.createSubscription(dto, mockRequest),
      ).rejects.toThrow('Customer creation failed');
      expect(stripeService.createSubscription).not.toHaveBeenCalled();
    });

    it('should propagate errors from subscription creation', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: CreateSubscriptionDto = {
        planId: mockPlanId,
        paymentMethodId: mockPaymentMethodId,
      };
      const error = new Error('Invalid payment method');
      stripeService.createOrGetCustomer.mockResolvedValue('cus_test123');
      stripeService.createSubscription.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.createSubscription(dto, mockRequest),
      ).rejects.toThrow('Invalid payment method');
    });
  });

  describe('updateSubscription', () => {
    describe('when cancelAtPeriodEnd is true', () => {
      it('should cancel subscription at period end', async () => {
        // Arrange
        const mockRequest = createMockRequest() as any;
        const dto: UpdateSubscriptionDto = {
          cancelAtPeriodEnd: true,
        };
        const mockSubscription = createMockSubscription({
          cancelAtPeriodEnd: true,
        });

        stripeService.cancelSubscription.mockResolvedValue(undefined);
        stripeService.getCurrentSubscription.mockResolvedValue(
          mockSubscription,
        );

        // Act
        const result = await controller.updateSubscription(
          mockSubscriptionId,
          dto,
          mockRequest,
        );

        // Assert
        expect(result).toEqual({
          subscriptionId: mockSubscriptionId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: mockSubscription.currentPeriodEnd,
        });
        expect(stripeService.cancelSubscription).toHaveBeenCalledWith(
          mockUserId,
          true,
        );
        expect(stripeService.getCurrentSubscription).toHaveBeenCalledWith(
          mockUserId,
        );
      });

      it('should handle subscription without stripeSubscriptionId', async () => {
        // Arrange
        const mockRequest = createMockRequest() as any;
        const dto: UpdateSubscriptionDto = {
          cancelAtPeriodEnd: true,
        };
        const mockSubscription = createMockSubscription({
          stripeSubscriptionId: null,
        });

        stripeService.cancelSubscription.mockResolvedValue(undefined);
        stripeService.getCurrentSubscription.mockResolvedValue(
          mockSubscription,
        );

        // Act
        const result = await controller.updateSubscription(
          mockSubscriptionId,
          dto,
          mockRequest,
        );

        // Assert
        expect(result.subscriptionId).toBe('');
      });
    });

    describe('when cancelAtPeriodEnd is false', () => {
      it('should reactivate subscription', async () => {
        // Arrange
        const mockRequest = createMockRequest() as any;
        const dto: UpdateSubscriptionDto = {
          cancelAtPeriodEnd: false,
        };
        const mockResponse = {
          subscriptionId: mockSubscriptionId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date('2025-02-01'),
        };

        stripeService.reactivateSubscription.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.updateSubscription(
          mockSubscriptionId,
          dto,
          mockRequest,
        );

        // Assert
        expect(result).toEqual(mockResponse);
        expect(stripeService.reactivateSubscription).toHaveBeenCalledWith(
          mockUserId,
          mockSubscriptionId,
        );
      });
    });

    describe('when planId is provided', () => {
      it('should update subscription plan', async () => {
        // Arrange
        const mockRequest = createMockRequest() as any;
        const newPlanId = 'price_community_monthly';
        const dto: UpdateSubscriptionDto = {
          planId: newPlanId,
        };
        const mockSubscription = createMockSubscription({
          planId: newPlanId,
          subscriptionTier: SubscriptionTier.COMMUNITY,
        });

        stripeService.updateSubscription.mockResolvedValue(undefined);
        stripeService.getCurrentSubscription.mockResolvedValue(
          mockSubscription,
        );

        // Act
        const result = await controller.updateSubscription(
          mockSubscriptionId,
          dto,
          mockRequest,
        );

        // Assert
        expect(result).toEqual({
          subscriptionId: mockSubscriptionId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: mockSubscription.currentPeriodEnd,
        });
        expect(stripeService.updateSubscription).toHaveBeenCalledWith(
          mockUserId,
          newPlanId,
          undefined,
        );
        expect(stripeService.getCurrentSubscription).toHaveBeenCalledWith(
          mockUserId,
        );
      });

      it('should handle planId with cancelAtPeriodEnd', async () => {
        // Arrange
        const mockRequest = createMockRequest() as any;
        const newPlanId = 'price_community_monthly';
        const dto: UpdateSubscriptionDto = {
          planId: newPlanId,
          cancelAtPeriodEnd: true,
        };
        const mockSubscription = createMockSubscription({
          planId: newPlanId,
          cancelAtPeriodEnd: true,
        });

        stripeService.cancelSubscription.mockResolvedValue(undefined);
        stripeService.getCurrentSubscription.mockResolvedValue(
          mockSubscription,
        );

        // Act
        await controller.updateSubscription(
          mockSubscriptionId,
          dto,
          mockRequest,
        );

        // Assert
        // When cancelAtPeriodEnd is true, it takes precedence
        expect(stripeService.cancelSubscription).toHaveBeenCalledWith(
          mockUserId,
          true,
        );
        expect(stripeService.updateSubscription).not.toHaveBeenCalled();
      });

      it('should handle subscription without stripeSubscriptionId when updating plan', async () => {
        // Arrange
        const mockRequest = createMockRequest() as any;
        const newPlanId = 'price_community_monthly';
        const dto: UpdateSubscriptionDto = {
          planId: newPlanId,
        };
        const mockSubscription = createMockSubscription({
          stripeSubscriptionId: null,
          planId: newPlanId,
        });

        stripeService.updateSubscription.mockResolvedValue(undefined);
        stripeService.getCurrentSubscription.mockResolvedValue(
          mockSubscription,
        );

        // Act
        const result = await controller.updateSubscription(
          mockSubscriptionId,
          dto,
          mockRequest,
        );

        // Assert
        expect(result.subscriptionId).toBe('');
        expect(stripeService.updateSubscription).toHaveBeenCalledWith(
          mockUserId,
          newPlanId,
          undefined,
        );
      });
    });

    describe('when no valid parameters provided', () => {
      it('should throw error for empty update', async () => {
        // Arrange
        const mockRequest = createMockRequest() as any;
        const dto: UpdateSubscriptionDto = {};

        // Act & Assert
        await expect(
          controller.updateSubscription(mockSubscriptionId, dto, mockRequest),
        ).rejects.toThrow('No valid update parameters provided');
      });

      it('should throw error when cancelAtPeriodEnd is undefined and no planId', async () => {
        // Arrange
        const mockRequest = createMockRequest() as any;
        const dto: UpdateSubscriptionDto = {
          cancelAtPeriodEnd: undefined,
        };

        // Act & Assert
        await expect(
          controller.updateSubscription(mockSubscriptionId, dto, mockRequest),
        ).rejects.toThrow('No valid update parameters provided');
      });
    });

    describe('fallback user ID scenarios', () => {
      it('should use fallback user ID when user.id is null during cancellation', async () => {
        // Arrange
        const mockRequest = {
          user: {
            id: null as unknown as string,
            email: mockUserEmail,
          },
        } as any;
        const dto: UpdateSubscriptionDto = {
          cancelAtPeriodEnd: true,
        };
        const mockSubscription = createMockSubscription({
          userId: 'test-user',
          cancelAtPeriodEnd: true,
        });

        stripeService.cancelSubscription.mockResolvedValue(undefined);
        stripeService.getCurrentSubscription.mockResolvedValue(
          mockSubscription,
        );

        // Act
        const result = await controller.updateSubscription(
          mockSubscriptionId,
          dto,
          mockRequest,
        );

        // Assert
        expect(stripeService.cancelSubscription).toHaveBeenCalledWith(
          'test-user',
          true,
        );
        expect(result.subscriptionId).toBe(mockSubscriptionId);
      });

      it('should use fallback user ID when user.id is empty string during reactivation', async () => {
        // Arrange
        const mockRequest = {
          user: {
            id: '',
            email: mockUserEmail,
          },
        } as any;
        const dto: UpdateSubscriptionDto = {
          cancelAtPeriodEnd: false,
        };
        const mockResponse = {
          subscriptionId: mockSubscriptionId,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date('2025-02-01'),
        };

        stripeService.reactivateSubscription.mockResolvedValue(mockResponse);

        // Act
        const result = await controller.updateSubscription(
          mockSubscriptionId,
          dto,
          mockRequest,
        );

        // Assert
        expect(stripeService.reactivateSubscription).toHaveBeenCalledWith(
          'test-user',
          mockSubscriptionId,
        );
        expect(result).toEqual(mockResponse);
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription immediately', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      stripeService.cancelSubscriptionImmediately.mockResolvedValue(undefined);

      // Act
      const result = await controller.cancelSubscription(
        mockSubscriptionId,
        mockRequest,
      );

      // Assert
      expect(result).toBeUndefined();
      expect(stripeService.cancelSubscriptionImmediately).toHaveBeenCalledWith(
        mockUserId,
        mockSubscriptionId,
      );
      expect(stripeService.cancelSubscriptionImmediately).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should use fallback user ID when user is not authenticated', async () => {
      // Arrange
      const mockRequest = {
        user: undefined as unknown as { id: string; email: string },
      } as any;
      stripeService.cancelSubscriptionImmediately.mockResolvedValue(undefined);

      // Act
      await controller.cancelSubscription(mockSubscriptionId, mockRequest);

      // Assert
      expect(stripeService.cancelSubscriptionImmediately).toHaveBeenCalledWith(
        'test-user',
        mockSubscriptionId,
      );
    });

    it('should propagate errors from StripeService', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const error = new Error('Subscription not found');
      stripeService.cancelSubscriptionImmediately.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.cancelSubscription(mockSubscriptionId, mockRequest),
      ).rejects.toThrow('Subscription not found');
    });
  });

  describe('createCheckoutSession', () => {
    it('should create Stripe Checkout session successfully', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: CreateCheckoutSessionDto = {
        priceId: mockPlanId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };
      const mockSession = {
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/session/cs_test123',
      };

      stripeService.createCheckoutSession.mockResolvedValue(mockSession);

      // Act
      const result = await controller.createCheckoutSession(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockSession);
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        mockUserId,
        mockUserEmail,
        mockPlanId,
        'https://example.com/success',
        'https://example.com/cancel',
      );
      expect(stripeService.createCheckoutSession).toHaveBeenCalledTimes(1);
    });

    it('should use fallback email when user email is not available', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: mockUserId,
          email: undefined,
        },
      } as any;
      const dto: CreateCheckoutSessionDto = {
        priceId: mockPlanId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      stripeService.createCheckoutSession.mockResolvedValue({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/session',
      });

      // Act
      await controller.createCheckoutSession(dto, mockRequest);

      // Assert
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        mockUserId,
        'test@example.com',
        mockPlanId,
        'https://example.com/success',
        'https://example.com/cancel',
      );
    });

    it('should use fallback user ID when user.id is null', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: null as unknown as string,
          email: mockUserEmail,
        },
      } as any;
      const dto: CreateCheckoutSessionDto = {
        priceId: mockPlanId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      stripeService.createCheckoutSession.mockResolvedValue({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/session',
      });

      // Act
      await controller.createCheckoutSession(dto, mockRequest);

      // Assert
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        'test-user',
        mockUserEmail,
        mockPlanId,
        'https://example.com/success',
        'https://example.com/cancel',
      );
    });

    it('should use fallback email when user.email is empty string', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: mockUserId,
          email: '',
        },
      } as any;
      const dto: CreateCheckoutSessionDto = {
        priceId: mockPlanId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      stripeService.createCheckoutSession.mockResolvedValue({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/session',
      });

      // Act
      await controller.createCheckoutSession(dto, mockRequest);

      // Assert
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        mockUserId,
        'test@example.com',
        mockPlanId,
        'https://example.com/success',
        'https://example.com/cancel',
      );
    });

    it('should use both fallbacks when user object is undefined', async () => {
      // Arrange
      const mockRequest = {
        user: undefined as unknown as { id: string; email: string },
      } as any;
      const dto: CreateCheckoutSessionDto = {
        priceId: mockPlanId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };

      stripeService.createCheckoutSession.mockResolvedValue({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/session',
      });

      // Act
      await controller.createCheckoutSession(dto, mockRequest);

      // Assert
      expect(stripeService.createCheckoutSession).toHaveBeenCalledWith(
        'test-user',
        'test@example.com',
        mockPlanId,
        'https://example.com/success',
        'https://example.com/cancel',
      );
    });

    it('should propagate errors from StripeService', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: CreateCheckoutSessionDto = {
        priceId: mockPlanId,
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      };
      const error = new Error('Invalid price ID');
      stripeService.createCheckoutSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.createCheckoutSession(dto, mockRequest),
      ).rejects.toThrow('Invalid price ID');
    });
  });

  describe('createPortalSession', () => {
    it('should create Stripe Portal session successfully', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: CreatePortalSessionDto = {
        returnUrl: 'https://example.com/account',
      };
      const mockPortalSession = {
        url: 'https://billing.stripe.com/session/bps_test123',
      };

      stripeService.createPortalSession.mockResolvedValue(mockPortalSession);

      // Act
      const result = await controller.createPortalSession(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockPortalSession);
      expect(stripeService.createPortalSession).toHaveBeenCalledWith(
        mockUserId,
        'https://example.com/account',
      );
      expect(stripeService.createPortalSession).toHaveBeenCalledTimes(1);
    });

    it('should use fallback user ID when user is not authenticated', async () => {
      // Arrange
      const mockRequest = {
        user: undefined as unknown as { id: string; email: string },
      } as any;
      const dto: CreatePortalSessionDto = {
        returnUrl: 'https://example.com/account',
      };

      stripeService.createPortalSession.mockResolvedValue({
        url: 'https://billing.stripe.com/session',
      });

      // Act
      await controller.createPortalSession(dto, mockRequest);

      // Assert
      expect(stripeService.createPortalSession).toHaveBeenCalledWith(
        'test-user',
        'https://example.com/account',
      );
    });

    it('should propagate errors from StripeService', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: CreatePortalSessionDto = {
        returnUrl: 'https://example.com/account',
      };
      const error = new Error('Customer not found');
      stripeService.createPortalSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.createPortalSession(dto, mockRequest),
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('getSubscriptionFeatures', () => {
    it('should return subscription features for user', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const mockSubscription = createMockSubscription({
        subscriptionTier: SubscriptionTier.COMMUNITY,
      });
      const mockFeatures = {
        canMakeVideoCalls: true,
        canMakeAudioCalls: true,
        maxCallDuration: 120,
        maxVideoQuality: 'fhd' as const,
        hasVirtualBackgrounds: true,
        hasBeautyFilters: true,
        hasAREffects: true,
        hasCallRecording: true,
        hasScreenSharing: true,
        hasGroupCalls: true,
        maxGroupParticipants: 8,
        hasCallScheduling: true,
        dailyUnmatchedMessages: -1,
        unlimitedUnmatchedMessages: true,
        voiceMessages: true,
        videoMessages: true,
        messageReactions: true,
        readReceipts: true,
        dailyLikes: -1,
        unlimitedLikes: true,
        seeWhoLikedYou: true,
        advancedFilters: true,
        travelMode: true,
        incognitoMode: true,
        maxPhotos: 10,
        videoIntro: true,
        profileBoostCount: 10,
        profileAnalytics: true,
        groupAudioRooms: true,
        forumAccess: 'vip' as const,
        virtualEvents: true,
        aiCoaching: true,
        communityMatchmaking: true,
        searchPriority: 'ultra' as const,
        messagePriority: 'vip' as const,
        supportPriority: 'vip' as const,
      };

      stripeService.getCurrentSubscription.mockResolvedValue(mockSubscription);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(mockFeatures);

      // Act
      const result = await controller.getSubscriptionFeatures(mockRequest);

      // Assert
      expect(result).toEqual(mockFeatures);
      expect(stripeService.getCurrentSubscription).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(subscriptionService.getSubscriptionFeatures).toHaveBeenCalledWith(
        SubscriptionTier.COMMUNITY,
      );
    });

    it('should handle DISCOVER tier features', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const mockSubscription = createMockSubscription({
        subscriptionTier: SubscriptionTier.DISCOVER,
      });
      const mockFeatures = {
        canMakeVideoCalls: false,
        canMakeAudioCalls: false,
        maxCallDuration: 0,
        // ... other DISCOVER tier features
      };

      stripeService.getCurrentSubscription.mockResolvedValue(mockSubscription);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(
        mockFeatures as any,
      );

      // Act
      const result = await controller.getSubscriptionFeatures(mockRequest);

      // Assert
      expect(subscriptionService.getSubscriptionFeatures).toHaveBeenCalledWith(
        SubscriptionTier.DISCOVER,
      );
      expect(result.canMakeVideoCalls).toBe(false);
    });

    it('should use fallback user ID when user.id is null', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: null as unknown as string,
          email: mockUserEmail,
        },
      } as any;
      const mockSubscription = createMockSubscription({
        userId: 'test-user',
        subscriptionTier: SubscriptionTier.CONNECT,
      });
      const mockFeatures = {
        canMakeVideoCalls: true,
        canMakeAudioCalls: true,
        maxCallDuration: 60,
      };

      stripeService.getCurrentSubscription.mockResolvedValue(mockSubscription);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(
        mockFeatures as any,
      );

      // Act
      const result = await controller.getSubscriptionFeatures(mockRequest);

      // Assert
      expect(stripeService.getCurrentSubscription).toHaveBeenCalledWith(
        'test-user',
      );
      expect(result).toEqual(mockFeatures);
    });

    it('should use fallback user ID when user.id is empty string', async () => {
      // Arrange
      const mockRequest = {
        user: {
          id: '',
          email: mockUserEmail,
        },
      } as any;
      const mockSubscription = createMockSubscription({
        userId: 'test-user',
        subscriptionTier: SubscriptionTier.CONNECT,
      });
      const mockFeatures = {
        canMakeVideoCalls: true,
        canMakeAudioCalls: true,
        maxCallDuration: 60,
      };

      stripeService.getCurrentSubscription.mockResolvedValue(mockSubscription);
      subscriptionService.getSubscriptionFeatures.mockReturnValue(
        mockFeatures as any,
      );

      // Act
      const result = await controller.getSubscriptionFeatures(mockRequest);

      // Assert
      expect(stripeService.getCurrentSubscription).toHaveBeenCalledWith(
        'test-user',
      );
      expect(result).toEqual(mockFeatures);
    });

    it('should propagate errors from services', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const error = new Error('Failed to get subscription');
      stripeService.getCurrentSubscription.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.getSubscriptionFeatures(mockRequest),
      ).rejects.toThrow('Failed to get subscription');
    });
  });

  describe('validateFeatureAccess', () => {
    it('should validate feature access successfully', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: ValidateFeatureAccessDto = {
        feature: 'canMakeVideoCalls',
      };
      const mockResponse = {
        allowed: true,
      };

      subscriptionService.validateFeatureAccess.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.validateFeatureAccess(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(subscriptionService.validateFeatureAccess).toHaveBeenCalledWith(
        mockUserId,
        'canMakeVideoCalls',
      );
      expect(subscriptionService.validateFeatureAccess).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should return access denied for insufficient tier', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: ValidateFeatureAccessDto = {
        feature: 'hasAREffects',
      };
      const mockResponse = {
        allowed: false,
        reason: 'AR effects requires a higher subscription tier',
      };

      subscriptionService.validateFeatureAccess.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.validateFeatureAccess(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('higher subscription tier');
    });

    it('should handle feature as keyof SubscriptionFeatures type', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: ValidateFeatureAccessDto = {
        feature: 'hasScreenSharing',
      };

      subscriptionService.validateFeatureAccess.mockResolvedValue({
        allowed: true,
      });

      // Act
      await controller.validateFeatureAccess(dto, mockRequest);

      // Assert
      // Verify the feature string is properly cast to keyof SubscriptionFeatures
      expect(subscriptionService.validateFeatureAccess).toHaveBeenCalledWith(
        mockUserId,
        'hasScreenSharing',
      );
    });

    it('should use fallback user ID when user is not authenticated', async () => {
      // Arrange
      const mockRequest = {
        user: undefined as unknown as { id: string; email: string },
      } as any;
      const dto: ValidateFeatureAccessDto = {
        feature: 'canMakeVideoCalls',
      };

      subscriptionService.validateFeatureAccess.mockResolvedValue({
        allowed: false,
      });

      // Act
      await controller.validateFeatureAccess(dto, mockRequest);

      // Assert
      expect(subscriptionService.validateFeatureAccess).toHaveBeenCalledWith(
        'test-user',
        'canMakeVideoCalls',
      );
    });
  });

  describe('getCallUsageStats', () => {
    it('should return call usage statistics', () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const mockStats = {
        totalCalls: 15,
        totalMinutes: 320,
        videoCalls: 8,
        audioCalls: 7,
      };

      subscriptionService.getCallUsageStats.mockReturnValue(mockStats);

      // Act
      const result = controller.getCallUsageStats(mockRequest);

      // Assert
      expect(result).toEqual(mockStats);
      expect(subscriptionService.getCallUsageStats).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(subscriptionService.getCallUsageStats).toHaveBeenCalledTimes(1);
    });

    it('should use fallback user ID when user is not authenticated', () => {
      // Arrange
      const mockRequest = {
        user: undefined as unknown as { id: string; email: string },
      } as any;
      const mockStats = {
        totalCalls: 0,
        totalMinutes: 0,
        videoCalls: 0,
        audioCalls: 0,
      };

      subscriptionService.getCallUsageStats.mockReturnValue(mockStats);

      // Act
      const result = controller.getCallUsageStats(mockRequest);

      // Assert
      expect(subscriptionService.getCallUsageStats).toHaveBeenCalledWith(
        'test-user',
      );
      expect(result).toEqual(mockStats);
    });

    it('should handle zero usage', () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const mockStats = {
        totalCalls: 0,
        totalMinutes: 0,
        videoCalls: 0,
        audioCalls: 0,
      };

      subscriptionService.getCallUsageStats.mockReturnValue(mockStats);

      // Act
      const result = controller.getCallUsageStats(mockRequest);

      // Assert
      expect(result.totalCalls).toBe(0);
      expect(result.totalMinutes).toBe(0);
    });
  });

  describe('trackFeatureUsage', () => {
    it('should track feature usage without metadata', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto = {
        feature: 'video_call_started',
      };

      subscriptionService.trackFeatureUsage.mockResolvedValue(undefined);

      // Act
      const result = await controller.trackFeatureUsage(dto, mockRequest);

      // Assert
      expect(result).toEqual({ success: true });
      expect(subscriptionService.trackFeatureUsage).toHaveBeenCalledWith(
        mockUserId,
        'video_call_started',
        undefined,
      );
      expect(subscriptionService.trackFeatureUsage).toHaveBeenCalledTimes(1);
    });

    it('should track feature usage with metadata', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto = {
        feature: 'video_call_started',
        metadata: {
          duration: 300,
          quality: 'hd',
          participants: 2,
        },
      };

      subscriptionService.trackFeatureUsage.mockResolvedValue(undefined);

      // Act
      const result = await controller.trackFeatureUsage(dto, mockRequest);

      // Assert
      expect(result).toEqual({ success: true });
      expect(subscriptionService.trackFeatureUsage).toHaveBeenCalledWith(
        mockUserId,
        'video_call_started',
        {
          duration: 300,
          quality: 'hd',
          participants: 2,
        },
      );
    });

    it('should use fallback user ID when user is not authenticated', async () => {
      // Arrange
      const mockRequest = {
        user: undefined as unknown as { id: string; email: string },
      } as any;
      const dto = {
        feature: 'profile_viewed',
      };

      subscriptionService.trackFeatureUsage.mockResolvedValue(undefined);

      // Act
      const result = await controller.trackFeatureUsage(dto, mockRequest);

      // Assert
      expect(result).toEqual({ success: true });
      expect(subscriptionService.trackFeatureUsage).toHaveBeenCalledWith(
        'test-user',
        'profile_viewed',
        undefined,
      );
    });

    it('should handle empty metadata object', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto = {
        feature: 'message_sent',
        metadata: {},
      };

      subscriptionService.trackFeatureUsage.mockResolvedValue(undefined);

      // Act
      const result = await controller.trackFeatureUsage(dto, mockRequest);

      // Assert
      expect(result).toEqual({ success: true });
      expect(subscriptionService.trackFeatureUsage).toHaveBeenCalledWith(
        mockUserId,
        'message_sent',
        {},
      );
    });

    it('should return success even if tracking fails silently', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto = {
        feature: 'feature_test',
      };

      // Service doesn't throw, just logs error
      subscriptionService.trackFeatureUsage.mockResolvedValue(undefined);

      // Act
      const result = await controller.trackFeatureUsage(dto, mockRequest);

      // Assert
      expect(result).toEqual({ success: true });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle malformed user object', async () => {
      // Arrange
      const mockRequest = {
        user: { id: null as unknown as string, email: 'test@example.com' },
      } as any;
      const mockSubscription = createMockSubscription({
        userId: 'test-user',
      });
      stripeService.getCurrentSubscription.mockResolvedValue(mockSubscription);

      // Act
      const result = await controller.getCurrentSubscription(mockRequest);

      // Assert
      expect(result).toEqual(mockSubscription);
    });

    it('should handle updateSubscription with both cancelAtPeriodEnd false and planId', async () => {
      // Arrange
      const mockRequest = createMockRequest() as any;
      const dto: UpdateSubscriptionDto = {
        cancelAtPeriodEnd: false,
        planId: 'price_new_plan',
      };
      const mockResponse = {
        subscriptionId: mockSubscriptionId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2025-02-01'),
      };

      stripeService.reactivateSubscription.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.updateSubscription(
        mockSubscriptionId,
        dto,
        mockRequest,
      );

      // Assert
      // cancelAtPeriodEnd=false should take precedence
      expect(stripeService.reactivateSubscription).toHaveBeenCalled();
      expect(stripeService.updateSubscription).not.toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });
  });
});
