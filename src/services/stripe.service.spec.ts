/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/unbound-method */

/**
 * Unit Tests for StripeService
 * Comprehensive test suite covering all Stripe payment and subscription operations
 *
 * Last Updated On: 2025-10-25
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import {
  SubscriptionTier,
  SubscriptionStatus,
  InvoiceStatus,
} from '@prisma/client';

// Mock Stripe
jest.mock('stripe');

describe('StripeService', () => {
  let service: StripeService;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let stripeMock: any;

  // Mock data factories
  const mockUserId = 'user-123';
  const mockEmail = 'test@example.com';
  const mockName = 'Test User';
  const mockCustomerId = 'cus_123';
  const mockSubscriptionId = 'sub_123';
  const mockPaymentMethodId = 'pm_123';
  const mockPlanId = 'connect_monthly';
  const mockInvoiceId = 'in_123';

  const mockStripeConfig = {
    secretKey: 'sk_test_123',
    webhookSecret: 'whsec_123',
    publishableKey: 'pk_test_123',
    currency: 'usd',
    apiVersion: '2025-07-30.basil' as const,
    webhookEvents: ['customer.subscription.created'],
    plans: {
      connect_monthly: {
        id: 'connect_monthly',
        name: 'Connect Monthly',
        description: 'Enhanced features',
        price: 1999,
        interval: 'month' as const,
        tier: 'CONNECT',
        features: ['Feature 1', 'Feature 2'],
        stripePriceId: 'price_123',
        stripeProductId: 'prod_123',
      },
      discover_monthly: {
        id: 'discover_monthly',
        name: 'Discover Monthly',
        description: 'Basic features',
        price: 999,
        interval: 'month' as const,
        tier: 'DISCOVER',
        features: ['Feature 1'],
        stripePriceId: 'price_456',
        stripeProductId: 'prod_456',
      },
    },
  };

  const mockSubscription = {
    id: 'db-sub-123',
    userId: mockUserId,
    stripeCustomerId: mockCustomerId,
    stripeSubscriptionId: mockSubscriptionId,
    subscriptionTier: SubscriptionTier.CONNECT,
    status: SubscriptionStatus.ACTIVE,
    planId: mockPlanId,
    currentPeriodStart: new Date('2025-01-01'),
    currentPeriodEnd: new Date('2025-02-01'),
    cancelAtPeriodEnd: false,
    autoRenew: true,
    isTrial: false,
    isIntroOffer: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    cancelledAt: null,
    lastRenewedAt: null,
    trialEnd: null,
    appleProductId: null,
    appleTransactionId: null,
    appleOriginalTransactionId: null,
  };

  // Mock Stripe customer
  const mockStripeCustomer = {
    id: mockCustomerId,
    object: 'customer',
    email: mockEmail,
    name: mockName,
    metadata: { userId: mockUserId },
    invoice_settings: {
      default_payment_method: mockPaymentMethodId,
    },
    created: Math.floor(Date.now() / 1000),
    livemode: false,
  } as any;

  // Mock Stripe subscription
  const mockStripeSubscription = {
    id: mockSubscriptionId,
    object: 'subscription',
    customer: mockCustomerId,
    status: 'active',
    current_period_start: Math.floor(new Date('2025-01-01').getTime() / 1000),
    current_period_end: Math.floor(new Date('2025-02-01').getTime() / 1000),
    cancel_at_period_end: false,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_123',
          object: 'subscription_item',
          price: {
            id: 'price_123',
            object: 'price',
            product: 'prod_123',
          },
        },
      ],
    },
    latest_invoice: {
      id: mockInvoiceId,
      payment_intent: {
        id: 'pi_123',
        client_secret: 'pi_123_secret_abc',
      },
    },
    metadata: { userId: mockUserId, planId: mockPlanId },
  } as unknown as Stripe.Subscription;

  // Mock Stripe payment intent
  const mockStripePaymentIntent = {
    id: 'pi_123',
    object: 'payment_intent',
    amount: 1999,
    currency: 'usd',
    status: 'succeeded',
    client_secret: 'pi_123_secret_abc',
    metadata: { userId: mockUserId, planId: mockPlanId },
  } as any;

  // Mock Stripe invoice
  const mockStripeInvoice = {
    id: mockInvoiceId,
    object: 'invoice',
    customer: mockCustomerId,
    amount_paid: 1999,
    currency: 'usd',
    status: 'paid',
    description: 'Subscription payment',
    period_start: Math.floor(new Date('2025-01-01').getTime() / 1000),
    period_end: Math.floor(new Date('2025-02-01').getTime() / 1000),
    hosted_invoice_url: 'https://invoice.stripe.com/i/123',
    invoice_pdf: 'https://invoice.stripe.com/i/123.pdf',
  } as any;

  // Mock Stripe payment method
  const mockStripePaymentMethod = {
    id: mockPaymentMethodId,
    object: 'payment_method',
    type: 'card',
    card: {
      brand: 'visa',
      last4: '4242',
      exp_month: 12,
      exp_year: 2027,
    },
  } as any;

  beforeEach(async () => {
    // Create mock Stripe instance
    stripeMock = {
      customers: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
      },
      subscriptions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
      },
      paymentIntents: {
        create: jest.fn(),
      },
      paymentMethods: {
        attach: jest.fn(),
        detach: jest.fn(),
        list: jest.fn(),
      },
      invoices: {
        list: jest.fn(),
      },
      setupIntents: {
        create: jest.fn(),
      },
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
      billingPortal: {
        sessions: {
          create: jest.fn(),
        },
      },
    };

    // Mock Stripe constructor
    (Stripe as any).mockImplementation(() => stripeMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'stripe') return mockStripeConfig;
              return undefined;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            subscription: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              update: jest.fn(),
            },
            paymentIntent: {
              create: jest.fn(),
            },
            billingHistory: {
              upsert: jest.fn(),
            },
            paymentMethod: {
              findUnique: jest.fn(),
              upsert: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize Stripe client with correct configuration', () => {
      expect(Stripe).toHaveBeenCalledWith('sk_test_123', {
        apiVersion: '2025-07-30.basil',
        typescript: true,
      });
    });

    it('should throw error if Stripe configuration is missing', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);

      expect(() => {
        new StripeService(configService, prismaService);
      }).toThrow('Stripe configuration is missing');
    });
  });

  describe('createOrGetCustomer', () => {
    it('should return existing customer ID if user already has one', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);

      const result = await service.createOrGetCustomer(mockUserId, mockEmail);

      expect(result).toBe(mockCustomerId);
      expect(prismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        select: { stripeCustomerId: true },
      });
      expect(stripeMock.customers.create).not.toHaveBeenCalled();
    });

    it('should create new Stripe customer if user does not have one', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);
      stripeMock.customers.create.mockResolvedValue(mockStripeCustomer);
      jest
        .spyOn(prismaService.subscription, 'upsert')
        .mockResolvedValue(mockSubscription);

      const result = await service.createOrGetCustomer(
        mockUserId,
        mockEmail,
        mockName,
      );

      expect(result).toBe(mockCustomerId);
      expect(stripeMock.customers.create).toHaveBeenCalledWith({
        email: mockEmail,
        name: mockName,
        metadata: { userId: mockUserId },
      });
      expect(prismaService.subscription.upsert).toHaveBeenCalled();
    });

    it('should create customer without name if not provided', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);
      stripeMock.customers.create.mockResolvedValue(mockStripeCustomer);
      jest
        .spyOn(prismaService.subscription, 'upsert')
        .mockResolvedValue(mockSubscription);

      await service.createOrGetCustomer(mockUserId, mockEmail);

      expect(stripeMock.customers.create).toHaveBeenCalledWith({
        email: mockEmail,
        name: undefined,
        metadata: { userId: mockUserId },
      });
    });

    it('should update subscription record with customer ID', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);
      stripeMock.customers.create.mockResolvedValue(mockStripeCustomer);
      jest
        .spyOn(prismaService.subscription, 'upsert')
        .mockResolvedValue(mockSubscription);

      await service.createOrGetCustomer(mockUserId, mockEmail);

      expect(prismaService.subscription.upsert).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        create: expect.objectContaining({
          userId: mockUserId,
          stripeCustomerId: mockCustomerId,
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.PENDING,
        }),
        update: {
          stripeCustomerId: mockCustomerId,
        },
      });
    });

    it('should throw InternalServerErrorException on Stripe API error', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);
      stripeMock.customers.create.mockRejectedValue(
        new Error('Stripe API error'),
      );

      await expect(
        service.createOrGetCustomer(mockUserId, mockEmail),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent for valid plan', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentIntents.create.mockResolvedValue(
        mockStripePaymentIntent,
      );
      jest
        .spyOn(prismaService.paymentIntent, 'create')
        .mockResolvedValue({} as any);

      const result = await service.createPaymentIntent(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
      );

      expect(result).toEqual({
        clientSecret: 'pi_123_secret_abc',
        paymentIntentId: 'pi_123',
        amount: 1999,
        currency: 'usd',
      });
      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1999,
        currency: 'usd',
        customer: mockCustomerId,
        payment_method: mockPaymentMethodId,
        confirm: true,
        metadata: { userId: mockUserId, planId: mockPlanId },
        description: 'Subscription: Connect Monthly',
      });
    });

    it('should throw BadRequestException for invalid plan ID', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);

      await expect(
        service.createPaymentIntent(mockUserId, 'invalid_plan'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if customer not found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.createPaymentIntent(mockUserId, mockPlanId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use custom currency if provided', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentIntents.create.mockResolvedValue(
        mockStripePaymentIntent,
      );
      jest
        .spyOn(prismaService.paymentIntent, 'create')
        .mockResolvedValue({} as any);

      await service.createPaymentIntent(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
        'eur',
      );

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'eur' }),
      );
    });

    it('should confirm payment intent when payment method provided', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentIntents.create.mockResolvedValue(
        mockStripePaymentIntent,
      );
      jest
        .spyOn(prismaService.paymentIntent, 'create')
        .mockResolvedValue({} as any);

      await service.createPaymentIntent(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
      );

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ confirm: true }),
      );
    });

    it('should not confirm payment intent when no payment method', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentIntents.create.mockResolvedValue(
        mockStripePaymentIntent,
      );
      jest
        .spyOn(prismaService.paymentIntent, 'create')
        .mockResolvedValue({} as any);

      await service.createPaymentIntent(mockUserId, mockPlanId);

      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ confirm: false }),
      );
    });

    it('should store payment intent in database', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentIntents.create.mockResolvedValue(
        mockStripePaymentIntent,
      );
      jest
        .spyOn(prismaService.paymentIntent, 'create')
        .mockResolvedValue({} as any);

      await service.createPaymentIntent(mockUserId, mockPlanId);

      expect(prismaService.paymentIntent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          stripePaymentIntentId: 'pi_123',
          amount: 1999,
          currency: 'usd',
          status: 'succeeded',
        }),
      });
    });
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentMethods.attach.mockResolvedValue(
        mockStripePaymentMethod,
      );
      stripeMock.customers.update.mockResolvedValue(mockStripeCustomer);
      stripeMock.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
      );

      expect(result).toEqual({
        subscriptionId: mockSubscriptionId,
        clientSecret: 'pi_123_secret_abc',
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2025-02-01'),
      });
    });

    it('should throw BadRequestException for invalid plan', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);

      await expect(
        service.createSubscription(
          mockUserId,
          'invalid_plan',
          mockPaymentMethodId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if customer not found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.createSubscription(mockUserId, mockPlanId, mockPaymentMethodId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should attach payment method to customer', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentMethods.attach.mockResolvedValue(
        mockStripePaymentMethod,
      );
      stripeMock.customers.update.mockResolvedValue(mockStripeCustomer);
      stripeMock.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.createSubscription(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
      );

      expect(stripeMock.paymentMethods.attach).toHaveBeenCalledWith(
        mockPaymentMethodId,
        { customer: mockCustomerId },
      );
    });

    it('should set payment method as default', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentMethods.attach.mockResolvedValue(
        mockStripePaymentMethod,
      );
      stripeMock.customers.update.mockResolvedValue(mockStripeCustomer);
      stripeMock.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.createSubscription(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
      );

      expect(stripeMock.customers.update).toHaveBeenCalledWith(mockCustomerId, {
        invoice_settings: {
          default_payment_method: mockPaymentMethodId,
        },
      });
    });

    it('should create subscription in Stripe with correct parameters', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentMethods.attach.mockResolvedValue(
        mockStripePaymentMethod,
      );
      stripeMock.customers.update.mockResolvedValue(mockStripeCustomer);
      stripeMock.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.createSubscription(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
      );

      expect(stripeMock.subscriptions.create).toHaveBeenCalledWith({
        customer: mockCustomerId,
        items: [{ price: 'price_123' }],
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: { userId: mockUserId, planId: mockPlanId },
      });
    });

    it('should update subscription in database', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentMethods.attach.mockResolvedValue(
        mockStripePaymentMethod,
      );
      stripeMock.customers.update.mockResolvedValue(mockStripeCustomer);
      stripeMock.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.createSubscription(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
      );

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          subscriptionTier: SubscriptionTier.CONNECT,
          stripeSubscriptionId: mockSubscriptionId,
          status: SubscriptionStatus.ACTIVE,
          planId: mockPlanId,
        }),
      });
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription plan successfully', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.retrieve.mockResolvedValue(
        mockStripeSubscription,
      );
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      const result = await service.updateSubscription(
        mockUserId,
        'discover_monthly',
      );

      expect(result).toEqual(mockStripeSubscription);
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
        mockSubscriptionId,
        expect.objectContaining({
          items: [
            {
              id: 'si_123',
              price: 'price_456',
            },
          ],
          proration_behavior: 'create_prorations',
        }),
      );
    });

    it('should throw BadRequestException if no active subscription', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue({ ...mockSubscription, stripeSubscriptionId: null });

      await expect(
        service.updateSubscription(mockUserId, 'discover_monthly'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid plan ID', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.retrieve.mockResolvedValue(
        mockStripeSubscription,
      );

      await expect(
        service.updateSubscription(mockUserId, 'invalid_plan'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update cancel at period end flag', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.retrieve.mockResolvedValue(
        mockStripeSubscription,
      );
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.updateSubscription(mockUserId, undefined, true);

      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
        mockSubscriptionId,
        expect.objectContaining({
          cancel_at_period_end: true,
        }),
      );
    });

    it('should update both plan and cancel flag', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.retrieve.mockResolvedValue(
        mockStripeSubscription,
      );
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.updateSubscription(mockUserId, 'discover_monthly', false);

      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
        mockSubscriptionId,
        expect.objectContaining({
          items: expect.any(Array),
          cancel_at_period_end: false,
        }),
      );
    });

    it('should update database after successful Stripe update', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.retrieve.mockResolvedValue(
        mockStripeSubscription,
      );
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.updateSubscription(mockUserId, 'discover_monthly', true);

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          planId: 'discover_monthly',
          subscriptionTier: SubscriptionTier.DISCOVER,
          cancelAtPeriodEnd: true,
        }),
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription immediately when requested', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.cancel.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.cancelSubscription(mockUserId, true);

      expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith(
        mockSubscriptionId,
      );
      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          subscriptionTier: SubscriptionTier.DISCOVER,
        },
      });
    });

    it('should cancel at period end when not immediate', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.cancelSubscription(mockUserId, false);

      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
        mockSubscriptionId,
        { cancel_at_period_end: true },
      );
      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          cancelAtPeriodEnd: true,
        },
      });
    });

    it('should throw BadRequestException if no active subscription', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.cancelSubscription(mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should default to cancel at period end', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.cancelSubscription(mockUserId);

      expect(stripeMock.subscriptions.update).toHaveBeenCalled();
      expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled();
    });
  });

  describe('getBillingHistory', () => {
    it('should return billing history for user', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.invoices.list.mockResolvedValue({
        object: 'list',
        data: [mockStripeInvoice],
        has_more: false,
        url: '/v1/invoices',
      } as Stripe.ApiList<Stripe.Invoice>);

      const mockBillingRecord = {
        id: 'billing-123',
        userId: mockUserId,
        stripeInvoiceId: mockInvoiceId,
        type: 'subscription_payment',
        amount: 1999,
        currency: 'usd',
        status: InvoiceStatus.PAID,
        description: 'Subscription payment',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-02-01'),
        invoiceUrl: 'https://invoice.stripe.com/i/123',
        pdfUrl: 'https://invoice.stripe.com/i/123.pdf',
        createdAt: new Date(),
        referenceId: null,
      } as any;

      jest
        .spyOn(prismaService.billingHistory, 'upsert')
        .mockResolvedValue(mockBillingRecord);

      const result = await service.getBillingHistory(mockUserId);

      expect(result).toEqual([mockBillingRecord]);
      expect(stripeMock.invoices.list).toHaveBeenCalledWith({
        customer: mockCustomerId,
        limit: 100,
      });
    });

    it('should return empty array if no customer found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      const result = await service.getBillingHistory(mockUserId);

      expect(result).toEqual([]);
      expect(stripeMock.invoices.list).not.toHaveBeenCalled();
    });

    it('should store invoices in database', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.invoices.list.mockResolvedValue({
        object: 'list',
        data: [mockStripeInvoice],
        has_more: false,
        url: '/v1/invoices',
      } as Stripe.ApiList<Stripe.Invoice>);

      jest
        .spyOn(prismaService.billingHistory, 'upsert')
        .mockResolvedValue({} as any);

      await service.getBillingHistory(mockUserId);

      expect(prismaService.billingHistory.upsert).toHaveBeenCalledWith({
        where: { stripeInvoiceId: mockInvoiceId },
        create: expect.objectContaining({
          userId: mockUserId,
          stripeInvoiceId: mockInvoiceId,
          amount: 1999,
          status: 'paid',
        }),
        update: {
          status: 'paid',
        },
      });
    });

    it('should handle invoices with missing optional fields', async () => {
      const incompleteInvoice = {
        ...mockStripeInvoice,
        amount_paid: 0,
        status: null,
        description: null,
      } as Stripe.Invoice;

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.invoices.list.mockResolvedValue({
        object: 'list',
        data: [incompleteInvoice],
        has_more: false,
        url: '/v1/invoices',
      } as Stripe.ApiList<Stripe.Invoice>);

      jest
        .spyOn(prismaService.billingHistory, 'upsert')
        .mockResolvedValue({} as any);

      await service.getBillingHistory(mockUserId);

      expect(prismaService.billingHistory.upsert).toHaveBeenCalledWith({
        where: { stripeInvoiceId: mockInvoiceId },
        create: expect.objectContaining({
          amount: 0,
          status: 'draft',
          description: 'Subscription payment',
        }),
        update: {
          status: 'draft',
        },
      });
    });
  });

  describe('getPaymentMethods', () => {
    it('should return payment methods for user', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentMethods.list.mockResolvedValue({
        object: 'list',
        data: [mockStripePaymentMethod],
        has_more: false,
        url: '/v1/payment_methods',
      } as Stripe.ApiList<Stripe.PaymentMethod>);
      stripeMock.customers.retrieve.mockResolvedValue(mockStripeCustomer);

      const mockDbPaymentMethod = {
        id: 'db-pm-123',
        userId: mockUserId,
        stripePaymentMethodId: mockPaymentMethodId,
        type: 'card',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2027,
        isDefault: true,
        createdAt: new Date(),
      };

      jest
        .spyOn(prismaService.paymentMethod, 'upsert')
        .mockResolvedValue(mockDbPaymentMethod);

      const result = await service.getPaymentMethods(mockUserId);

      expect(result).toEqual([mockDbPaymentMethod]);
      expect(stripeMock.paymentMethods.list).toHaveBeenCalledWith({
        customer: mockCustomerId,
        type: 'card',
      });
    });

    it('should return empty array if no customer found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      const result = await service.getPaymentMethods(mockUserId);

      expect(result).toEqual([]);
      expect(stripeMock.paymentMethods.list).not.toHaveBeenCalled();
    });

    it('should mark default payment method correctly', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentMethods.list.mockResolvedValue({
        object: 'list',
        data: [mockStripePaymentMethod],
        has_more: false,
        url: '/v1/payment_methods',
      } as Stripe.ApiList<Stripe.PaymentMethod>);
      stripeMock.customers.retrieve.mockResolvedValue(mockStripeCustomer);

      jest
        .spyOn(prismaService.paymentMethod, 'upsert')
        .mockResolvedValue({} as any);

      await service.getPaymentMethods(mockUserId);

      expect(prismaService.paymentMethod.upsert).toHaveBeenCalledWith({
        where: { stripePaymentMethodId: mockPaymentMethodId },
        create: expect.objectContaining({
          isDefault: true,
        }),
        update: {
          isDefault: true,
        },
      });
    });

    it('should handle customer without default payment method', async () => {
      const customerWithoutDefault = {
        ...mockStripeCustomer,
        invoice_settings: { default_payment_method: null },
      } as Stripe.Customer;

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentMethods.list.mockResolvedValue({
        object: 'list',
        data: [mockStripePaymentMethod],
        has_more: false,
        url: '/v1/payment_methods',
      } as Stripe.ApiList<Stripe.PaymentMethod>);
      stripeMock.customers.retrieve.mockResolvedValue(customerWithoutDefault);

      jest
        .spyOn(prismaService.paymentMethod, 'upsert')
        .mockResolvedValue({} as any);

      await service.getPaymentMethods(mockUserId);

      expect(prismaService.paymentMethod.upsert).toHaveBeenCalledWith({
        where: { stripePaymentMethodId: mockPaymentMethodId },
        create: expect.objectContaining({
          isDefault: false,
        }),
        update: {
          isDefault: false,
        },
      });
    });
  });

  describe('getCurrentSubscription', () => {
    it('should return current subscription for user', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);

      const result = await service.getCurrentSubscription(mockUserId);

      expect(result).toEqual(mockSubscription);
      expect(prismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });

    it('should throw NotFoundException if no subscription found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.getCurrentSubscription(mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reactivateSubscription', () => {
    it('should reactivate cancelled subscription', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      const result = await service.reactivateSubscription(
        mockUserId,
        mockSubscriptionId,
      );

      expect(result).toEqual({
        subscriptionId: mockSubscriptionId,
        clientSecret: null,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date('2025-02-01'),
      });
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
        mockSubscriptionId,
        { cancel_at_period_end: false },
      );
    });

    it('should throw NotFoundException if subscription not found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.reactivateSubscription(mockUserId, mockSubscriptionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if subscription ID mismatch', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);

      await expect(
        service.reactivateSubscription(mockUserId, 'wrong_sub_id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update database after reactivation', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.update.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.reactivateSubscription(mockUserId, mockSubscriptionId);

      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          cancelAtPeriodEnd: false,
          status: SubscriptionStatus.ACTIVE,
        },
      });
    });
  });

  describe('deletePaymentMethod', () => {
    it('should delete payment method successfully', async () => {
      const mockDbPaymentMethod = {
        id: 'db-pm-123',
        userId: mockUserId,
        stripePaymentMethodId: mockPaymentMethodId,
        type: 'card',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2027,
        isDefault: false,
        createdAt: new Date(),
      };

      jest
        .spyOn(prismaService.paymentMethod, 'findUnique')
        .mockResolvedValue(mockDbPaymentMethod);
      stripeMock.paymentMethods.detach.mockResolvedValue(
        mockStripePaymentMethod,
      );
      jest
        .spyOn(prismaService.paymentMethod, 'delete')
        .mockResolvedValue(mockDbPaymentMethod);

      const result = await service.deletePaymentMethod(
        mockUserId,
        mockPaymentMethodId,
      );

      expect(result).toEqual({ success: true });
      expect(stripeMock.paymentMethods.detach).toHaveBeenCalledWith(
        mockPaymentMethodId,
      );
      expect(prismaService.paymentMethod.delete).toHaveBeenCalledWith({
        where: { stripePaymentMethodId: mockPaymentMethodId },
      });
    });

    it('should throw BadRequestException if payment method not found', async () => {
      jest
        .spyOn(prismaService.paymentMethod, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.deletePaymentMethod(mockUserId, mockPaymentMethodId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user does not own payment method', async () => {
      const mockDbPaymentMethod = {
        id: 'db-pm-123',
        userId: 'other-user',
        stripePaymentMethodId: mockPaymentMethodId,
        type: 'card',
        brand: 'visa',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2027,
        isDefault: false,
        createdAt: new Date(),
      };

      jest
        .spyOn(prismaService.paymentMethod, 'findUnique')
        .mockResolvedValue(mockDbPaymentMethod);

      await expect(
        service.deletePaymentMethod(mockUserId, mockPaymentMethodId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should set default payment method successfully', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.customers.update.mockResolvedValue(mockStripeCustomer);
      jest
        .spyOn(prismaService.paymentMethod, 'updateMany')
        .mockResolvedValue({ count: 2 });
      jest
        .spyOn(prismaService.paymentMethod, 'update')
        .mockResolvedValue({} as any);

      const result = await service.setDefaultPaymentMethod(
        mockUserId,
        mockPaymentMethodId,
      );

      expect(result).toEqual({ success: true });
      expect(stripeMock.customers.update).toHaveBeenCalledWith(mockCustomerId, {
        invoice_settings: {
          default_payment_method: mockPaymentMethodId,
        },
      });
    });

    it('should throw BadRequestException if customer not found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.setDefaultPaymentMethod(mockUserId, mockPaymentMethodId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should unset all payment methods as default first', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.customers.update.mockResolvedValue(mockStripeCustomer);
      jest
        .spyOn(prismaService.paymentMethod, 'updateMany')
        .mockResolvedValue({ count: 2 });
      jest
        .spyOn(prismaService.paymentMethod, 'update')
        .mockResolvedValue({} as any);

      await service.setDefaultPaymentMethod(mockUserId, mockPaymentMethodId);

      expect(prismaService.paymentMethod.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: { isDefault: false },
      });
    });

    it('should set specified payment method as default', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.customers.update.mockResolvedValue(mockStripeCustomer);
      jest
        .spyOn(prismaService.paymentMethod, 'updateMany')
        .mockResolvedValue({ count: 2 });
      jest
        .spyOn(prismaService.paymentMethod, 'update')
        .mockResolvedValue({} as any);

      await service.setDefaultPaymentMethod(mockUserId, mockPaymentMethodId);

      expect(prismaService.paymentMethod.update).toHaveBeenCalledWith({
        where: { stripePaymentMethodId: mockPaymentMethodId },
        data: { isDefault: true },
      });
    });
  });

  describe('createSetupIntent', () => {
    it('should create setup intent for saving payment method', async () => {
      const mockSetupIntent = {
        id: 'seti_123',
        object: 'setup_intent',
        client_secret: 'seti_123_secret_abc',
        customer: mockCustomerId,
      } as any;

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.setupIntents.create.mockResolvedValue(mockSetupIntent);

      const result = await service.createSetupIntent(mockUserId);

      expect(result).toEqual({
        clientSecret: 'seti_123_secret_abc',
        setupIntentId: 'seti_123',
      });
      expect(stripeMock.setupIntents.create).toHaveBeenCalledWith({
        customer: mockCustomerId,
        payment_method_types: ['card'],
        metadata: { userId: mockUserId },
      });
    });

    it('should throw BadRequestException if customer not found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.createSetupIntent(mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getAvailablePlans', () => {
    it('should return all available plans', () => {
      const result = service.getAvailablePlans();

      expect(result).toEqual(Object.values(mockStripeConfig.plans));
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('price');
      expect(result[0]).toHaveProperty('tier');
    });
  });

  describe('cancelSubscriptionImmediately', () => {
    it('should cancel subscription immediately with correct subscription ID', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.subscriptions.cancel.mockResolvedValue(mockStripeSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      await service.cancelSubscriptionImmediately(
        mockUserId,
        mockSubscriptionId,
      );

      expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith(
        mockSubscriptionId,
      );
      expect(prismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          status: SubscriptionStatus.CANCELLED,
          subscriptionTier: SubscriptionTier.DISCOVER,
          cancelledAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if subscription not found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.cancelSubscriptionImmediately(mockUserId, mockSubscriptionId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if subscription ID mismatch', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);

      await expect(
        service.cancelSubscriptionImmediately(mockUserId, 'wrong_sub_id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCheckoutSession', () => {
    it('should create checkout session successfully', async () => {
      const mockCheckoutSession = {
        id: 'cs_123',
        object: 'checkout.session',
        url: 'https://checkout.stripe.com/pay/cs_123',
      } as any;

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);
      stripeMock.customers.create.mockResolvedValue(mockStripeCustomer);
      jest
        .spyOn(prismaService.subscription, 'upsert')
        .mockResolvedValue(mockSubscription);
      stripeMock.checkout.sessions.create.mockResolvedValue(
        mockCheckoutSession,
      );

      const result = await service.createCheckoutSession(
        mockUserId,
        mockEmail,
        'price_123',
        'https://example.com/success',
        'https://example.com/cancel',
      );

      expect(result).toEqual({
        sessionId: 'cs_123',
        url: 'https://checkout.stripe.com/pay/cs_123',
      });
      expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith({
        customer: mockCustomerId,
        payment_method_types: ['card'],
        line_items: [{ price: 'price_123', quantity: 1 }],
        mode: 'subscription',
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
        metadata: { userId: mockUserId },
      });
    });

    it('should handle session without URL', async () => {
      const mockCheckoutSession = {
        id: 'cs_123',
        object: 'checkout.session',
        url: null,
      } as any;

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.checkout.sessions.create.mockResolvedValue(
        mockCheckoutSession,
      );

      const result = await service.createCheckoutSession(
        mockUserId,
        mockEmail,
        'price_123',
        'https://example.com/success',
        'https://example.com/cancel',
      );

      expect(result.url).toBe('');
    });
  });

  describe('createPortalSession', () => {
    it('should create portal session successfully', async () => {
      const mockPortalSession = {
        id: 'bps_123',
        object: 'billing_portal.session',
        url: 'https://billing.stripe.com/session/123',
      } as any;

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.billingPortal.sessions.create.mockResolvedValue(
        mockPortalSession,
      );

      const result = await service.createPortalSession(
        mockUserId,
        'https://example.com/return',
      );

      expect(result).toEqual({
        url: 'https://billing.stripe.com/session/123',
      });
      expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: mockCustomerId,
        return_url: 'https://example.com/return',
      });
    });

    it('should throw NotFoundException if no customer found', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(null);

      await expect(
        service.createPortalSession(mockUserId, 'https://example.com/return'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle Stripe API errors gracefully in createPaymentIntent', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentIntents.create.mockRejectedValue(
        new BadRequestException('Invalid payment method'),
      );

      await expect(
        service.createPaymentIntent(
          mockUserId,
          mockPlanId,
          mockPaymentMethodId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle database errors in getBillingHistory', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.invoices.list.mockResolvedValue({
        object: 'list',
        data: [mockStripeInvoice],
        has_more: false,
        url: '/v1/invoices',
      } as Stripe.ApiList<Stripe.Invoice>);
      jest
        .spyOn(prismaService.billingHistory, 'upsert')
        .mockRejectedValue(new Error('Database error'));

      await expect(service.getBillingHistory(mockUserId)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle subscription with null stripeCustomerId', async () => {
      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue({ ...mockSubscription, stripeCustomerId: null });

      const result = await service.getBillingHistory(mockUserId);

      expect(result).toEqual([]);
    });

    it('should handle subscription status conversion correctly', async () => {
      const incompleteSubscription = {
        ...mockStripeSubscription,
        status: 'incomplete',
      } as unknown as Stripe.Subscription;

      jest
        .spyOn(prismaService.subscription, 'findUnique')
        .mockResolvedValue(mockSubscription);
      stripeMock.paymentMethods.attach.mockResolvedValue(
        mockStripePaymentMethod,
      );
      stripeMock.customers.update.mockResolvedValue(mockStripeCustomer);
      stripeMock.subscriptions.create.mockResolvedValue(incompleteSubscription);
      jest
        .spyOn(prismaService.subscription, 'update')
        .mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(
        mockUserId,
        mockPlanId,
        mockPaymentMethodId,
      );

      expect(result.status).toBe('INCOMPLETE' as SubscriptionStatus);
    });
  });
});
