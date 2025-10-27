/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/**
 * Webhook Controller Unit Tests
 * Comprehensive test suite for Stripe webhook event handling
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';

// Import from local testing utilities
import {
  PaymentPrismaServiceStub,
  createPaymentPrismaServiceStub,
} from '../testing/stubs/payment-prisma.stub';

import {
  createStripeMock,
  createSubscriptionCreatedEventMock,
  createSubscriptionUpdatedEventMock,
  createSubscriptionDeletedEventMock,
  createInvoicePaymentSucceededEventMock,
  createInvoicePaymentFailedEventMock,
  createPaymentIntentSucceededEventMock,
  createPaymentIntentFailedEventMock,
  createPaymentMethodAttachedEventMock,
  createPaymentMethodDetachedEventMock,
  createDisputeCreatedEventMock,
  createDisputeClosedEventMock,
  createTrialWillEndEventMock,
} from '../testing/mocks/stripe.mock';

describe('WebhookController', () => {
  let controller: WebhookController;
  let prismaStub: PaymentPrismaServiceStub;
  let stripeMock: ReturnType<typeof createStripeMock>;

  const mockStripeSecretKey = 'sk_test_mock_key';
  const mockWebhookSecret = 'whsec_test_mock_secret';

  beforeEach(async () => {
    // Create fresh instances for each test
    prismaStub = createPaymentPrismaServiceStub();
    stripeMock = createStripeMock();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaStub,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return mockStripeSecretKey;
              if (key === 'STRIPE_WEBHOOK_SECRET') return mockWebhookSecret;
              return null;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);

    // Mock Stripe instance on the controller

    (controller as any)['stripe'] = stripeMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
    prismaStub.reset();
  });

  describe('handleStripeWebhook', () => {
    describe('signature verification', () => {
      it('should throw BadRequestException when signature is missing', async () => {
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        await expect(
          controller.handleStripeWebhook('', req as any),
        ).rejects.toThrow(BadRequestException);

        await expect(
          controller.handleStripeWebhook('', req as any),
        ).rejects.toThrow('Missing stripe-signature header');
      });

      it('should throw BadRequestException when signature verification fails', async () => {
        const signature = 't=1234567890,v1=invalid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockImplementation(() => {
          throw new Error('Signature verification failed');
        });

        await expect(
          controller.handleStripeWebhook(signature, req as any),
        ).rejects.toThrow(BadRequestException);

        await expect(
          controller.handleStripeWebhook(signature, req as any),
        ).rejects.toThrow('Invalid webhook signature');
      });

      it('should verify webhook signature with raw body', async () => {
        const signature = 't=1234567890,v1=valid_signature';
        const rawBody = Buffer.from(JSON.stringify({ test: 'data' }));
        const event = createSubscriptionCreatedEventMock();

        const req = {
          rawBody,
          body: rawBody,
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        await controller.handleStripeWebhook(signature, req as any);

        expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
          rawBody,
          signature,
          mockWebhookSecret,
        );
      });

      it('should handle raw body from req.body when rawBody is undefined', async () => {
        const signature = 't=1234567890,v1=valid_signature';
        const bodyBuffer = Buffer.from(JSON.stringify({ test: 'data' }));
        const event = createSubscriptionCreatedEventMock();

        const req = {
          rawBody: undefined,
          body: bodyBuffer,
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        await controller.handleStripeWebhook(signature, req as any);

        expect(stripeMock.webhooks.constructEvent).toHaveBeenCalled();
      });

      it('should convert string body to Buffer', async () => {
        const signature = 't=1234567890,v1=valid_signature';
        const bodyString = JSON.stringify({ test: 'data' });
        const event = createSubscriptionCreatedEventMock();

        const req = {
          rawBody: bodyString as unknown as Buffer,
          body: bodyString as unknown as Buffer,
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        await controller.handleStripeWebhook(signature, req as any);

        const calledWith = stripeMock.webhooks.constructEvent.mock.calls[0][0];
        expect(Buffer.isBuffer(calledWith)).toBe(true);
      });
    });

    describe('webhook event storage', () => {
      it('should store webhook event in database', async () => {
        const signature = 't=1234567890,v1=valid_signature';
        const event = createSubscriptionCreatedEventMock();
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.webhookEvent.create).toHaveBeenCalledWith({
          data: {
            eventId: event.id,
            stripeEventId: event.id,
            type: event.type,
            data: expect.any(Object),
            processedAt: expect.any(Date),
          },
        });
      });

      it('should mark event as processed after successful handling', async () => {
        const signature = 't=1234567890,v1=valid_signature';
        const event = createSubscriptionCreatedEventMock();
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        // Mock subscription found
        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-123',
          userId: 'user-123',
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.ACTIVE,

          stripeCustomerId: (event.data.object as any).customer,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.webhookEvent.updateMany).toHaveBeenCalledWith({
          where: { stripeEventId: event.id },
          data: { status: 'processed' },
        });
      });

      it('should mark event as failed when processing throws error', async () => {
        const signature = 't=1234567890,v1=valid_signature';
        const event = createSubscriptionCreatedEventMock();
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        // Make subscription update throw error
        prismaStub.subscription.findFirst.mockRejectedValueOnce(
          new Error('Database error'),
        );

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        // Should still return success (don't throw to Stripe)
        expect(result).toEqual({ received: true });

        expect(prismaStub.webhookEvent.updateMany).toHaveBeenCalledWith({
          where: { stripeEventId: event.id },
          data: {
            status: 'failed',
            error: 'Database error',
          },
        });
      });
    });

    describe('unhandled event types', () => {
      it('should log unhandled event types without throwing', async () => {
        const signature = 't=1234567890,v1=valid_signature';
        const event = {
          id: 'evt_unhandled',
          type: 'unhandled.event.type',
          data: { object: {} },
        } as any;
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
        expect(prismaStub.webhookEvent.updateMany).toHaveBeenCalledWith({
          where: { stripeEventId: event.id },
          data: { status: 'processed' },
        });
      });
    });
  });

  describe('subscription event handlers', () => {
    describe('handleSubscriptionCreated', () => {
      it('should create subscription record for new subscription', async () => {
        const customerId = 'cus_test123';
        const event = createSubscriptionCreatedEventMock({
          customer: customerId,
          status: 'active',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        // Mock existing subscription
        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-123',
          userId: 'user-123',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.PENDING,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.findFirst).toHaveBeenCalledWith({
          where: { stripeCustomerId: customerId },
        });

        expect(prismaStub.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-123' },
          data: expect.objectContaining({
            stripeSubscriptionId: (event.data.object as any).id,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodStart: expect.any(Date),
            currentPeriodEnd: expect.any(Date),
          }),
        });
      });

      it('should handle subscription created when no user found', async () => {
        const customerId = 'cus_nonexistent';
        const event = createSubscriptionCreatedEventMock({
          customer: customerId,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        // Mock no subscription found
        prismaStub.subscription.findFirst.mockResolvedValueOnce(null);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        // Should still succeed without updating
        expect(result).toEqual({ received: true });
        expect(prismaStub.subscription.update).not.toHaveBeenCalled();
      });

      it('should extract customer ID from object when customer is not a string', async () => {
        const customerId = 'cus_test456';
        const event = createSubscriptionCreatedEventMock({
          customer: { id: customerId } as any,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-456',
          userId: 'user-456',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.PENDING,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.findFirst).toHaveBeenCalledWith({
          where: { stripeCustomerId: customerId },
        });
      });

      it('should handle subscription created with empty items array', async () => {
        const customerId = 'cus_empty_items';
        const event = createSubscriptionCreatedEventMock({
          customer: customerId,
          status: 'active',
          items: {
            object: 'list',
            data: [],
            has_more: false,
            url: '/v1/subscription_items',
          },
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-empty-items',
          userId: 'user-empty-items',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.PENDING,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-empty-items' },
          data: expect.objectContaining({
            planId: undefined,
          }),
        });
      });

      it('should handle subscription created with incomplete_expired status', async () => {
        const customerId = 'cus_expired';
        const event = createSubscriptionCreatedEventMock({
          customer: customerId,
          status: 'incomplete_expired',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-expired',
          userId: 'user-expired',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.PENDING,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-expired' },
          data: expect.objectContaining({
            status: SubscriptionStatus.EXPIRED,
          }),
        });
      });
    });

    describe('handleSubscriptionUpdated', () => {
      it('should update subscription when tier changes', async () => {
        const subscriptionId = 'sub_test123';
        const event = createSubscriptionUpdatedEventMock({
          id: subscriptionId,
          status: 'active',
          items: {
            object: 'list',
            data: [
              {
                id: 'si_test',
                price: {
                  id: 'price_connect_monthly',
                } as any,
              } as any,
            ],
            has_more: false,
            url: '/v1/subscription_items',
          },
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-123',
          userId: 'user-123',
          stripeSubscriptionId: subscriptionId,
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-123' },
          data: expect.objectContaining({
            subscriptionTier: SubscriptionTier.CONNECT,
            status: SubscriptionStatus.ACTIVE,
            planId: 'price_connect_monthly',
          }),
        });
      });

      it('should handle subscription not found', async () => {
        const subscriptionId = 'sub_nonexistent';
        const event = createSubscriptionUpdatedEventMock({
          id: subscriptionId,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce(null);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
        expect(prismaStub.subscription.update).not.toHaveBeenCalled();
      });

      it('should handle cancel_at_period_end flag', async () => {
        const subscriptionId = 'sub_test789';
        const event = createSubscriptionUpdatedEventMock({
          id: subscriptionId,
          cancel_at_period_end: true,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-789',
          userId: 'user-789',
          stripeSubscriptionId: subscriptionId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-789' },
          data: expect.objectContaining({
            cancelAtPeriodEnd: true,
          }),
        });
      });

      it('should handle subscription updated with empty items', async () => {
        const subscriptionId = 'sub_empty_items';
        const event = createSubscriptionUpdatedEventMock({
          id: subscriptionId,
          items: {
            object: 'list',
            data: [],
            has_more: false,
            url: '/v1/subscription_items',
          },
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-empty',
          userId: 'user-empty',
          stripeSubscriptionId: subscriptionId,
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        // Should use empty string for planId when items array is empty
        expect(prismaStub.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-empty' },
          data: expect.objectContaining({
            planId: '',
            subscriptionTier: SubscriptionTier.DISCOVER,
          }),
        });
      });

      it('should handle subscription updated with incomplete status', async () => {
        const subscriptionId = 'sub_incomplete';
        const event = createSubscriptionUpdatedEventMock({
          id: subscriptionId,
          status: 'incomplete',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-inc',
          userId: 'user-inc',
          stripeSubscriptionId: subscriptionId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-inc' },
          data: expect.objectContaining({
            status: SubscriptionStatus.PENDING,
          }),
        });
      });
    });

    describe('handleSubscriptionDeleted', () => {
      it('should cancel subscription and downgrade to DISCOVER tier', async () => {
        const subscriptionId = 'sub_cancelled';
        const event = createSubscriptionDeletedEventMock({
          id: subscriptionId,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-999',
          userId: 'user-999',
          stripeSubscriptionId: subscriptionId,
          subscriptionTier: SubscriptionTier.COMMUNITY,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.update).toHaveBeenCalledWith({
          where: { id: 'sub-999' },
          data: {
            status: SubscriptionStatus.CANCELLED,
            subscriptionTier: SubscriptionTier.DISCOVER,
            cancelledAt: expect.any(Date),
          },
        });
      });

      it('should handle subscription not found on deletion', async () => {
        const subscriptionId = 'sub_nonexistent';
        const event = createSubscriptionDeletedEventMock({
          id: subscriptionId,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce(null);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
        expect(prismaStub.subscription.update).not.toHaveBeenCalled();
      });
    });

    describe('handleTrialWillEnd', () => {
      it('should log trial ending notification', async () => {
        const subscriptionId = 'sub_trial_ending';
        const event = createTrialWillEndEventMock({
          id: subscriptionId,
          status: 'trialing',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
        expect(prismaStub.webhookEvent.updateMany).toHaveBeenCalledWith({
          where: { stripeEventId: event.id },
          data: { status: 'processed' },
        });
      });

      it('should handle trial ending with custom trial end date', async () => {
        const now = Math.floor(Date.now() / 1000);
        const event = createTrialWillEndEventMock({
          trial_end: now + 86400 * 2, // 2 days from now
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
      });

      it('should handle trial ending with null customer', async () => {
        const event = createTrialWillEndEventMock({
          customer: null as any,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
      });
    });
  });

  describe('invoice event handlers', () => {
    describe('handleInvoicePaymentSucceeded', () => {
      it('should create billing history record for successful payment', async () => {
        const customerId = 'cus_invoice_test';
        const invoiceId = 'in_success';
        const event = createInvoicePaymentSucceededEventMock({
          id: invoiceId,
          customer: customerId,
          amount_paid: 1999,
          currency: 'usd',
          description: 'Subscription renewal',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-invoice',
          userId: 'user-invoice',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: 'user-invoice',
            stripeInvoiceId: invoiceId,
            type: 'subscription_payment',
            amount: 1999,
            currency: 'usd',
            status: 'PAID',
            description: 'Subscription renewal',
          }),
        });
      });

      it('should handle invoice with object customer', async () => {
        const customerId = 'cus_object_test';
        const event = createInvoicePaymentSucceededEventMock({
          customer: { id: customerId } as any,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-obj',
          userId: 'user-obj',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.findFirst).toHaveBeenCalledWith({
          where: { stripeCustomerId: customerId },
        });
      });

      it('should handle customer not found for invoice', async () => {
        const event = createInvoicePaymentSucceededEventMock({
          customer: 'cus_notfound',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce(null);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
        expect(prismaStub.billingHistory.create).not.toHaveBeenCalled();
      });

      it('should handle invoice with null optional fields', async () => {
        const customerId = 'cus_null_fields';
        const event = createInvoicePaymentSucceededEventMock({
          customer: customerId,
          amount_paid: null,
          currency: null,
          description: null,
          period_start: null,
          period_end: null,
          hosted_invoice_url: null,
          invoice_pdf: null,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-null-fields',
          userId: 'user-null-fields',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            amount: 0,
            currency: 'usd',
            description: 'Subscription payment',
            invoiceUrl: undefined,
            pdfUrl: undefined,
          }),
        });
      });

      it('should handle invoice with zero period timestamps', async () => {
        const customerId = 'cus_zero_period';
        const event = createInvoicePaymentSucceededEventMock({
          customer: customerId,
          period_start: 0,
          period_end: 0,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-zero',
          userId: 'user-zero',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            periodStart: new Date(0),
            periodEnd: new Date(0),
          }),
        });
      });
    });

    describe('handleInvoicePaymentFailed', () => {
      it('should create billing history record for failed payment', async () => {
        const customerId = 'cus_failed';
        const invoiceId = 'in_failed';
        const event = createInvoicePaymentFailedEventMock({
          id: invoiceId,
          customer: customerId,
          amount_due: 999,
          currency: 'usd',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-failed',
          userId: 'user-failed',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: 'user-failed',
            stripeInvoiceId: invoiceId,
            type: 'subscription_payment',
            amount: 999,
            status: 'UNCOLLECTIBLE',
            description: expect.stringContaining('Payment failed'),
          }),
        });
      });

      it('should handle failed payment with custom description', async () => {
        const event = createInvoicePaymentFailedEventMock({
          customer: 'cus_custom',
          description: 'Custom payment',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-custom',
          userId: 'user-custom',
          stripeCustomerId: 'cus_custom',
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            description: 'Payment failed - Custom payment',
          }),
        });
      });

      it('should handle customer not found for failed invoice', async () => {
        const event = createInvoicePaymentFailedEventMock({
          customer: 'cus_not_found_failed',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce(null);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
        expect(prismaStub.billingHistory.create).not.toHaveBeenCalled();
      });

      it('should handle failed invoice with object customer', async () => {
        const customerId = 'cus_obj_failed';
        const event = createInvoicePaymentFailedEventMock({
          customer: { id: customerId } as any,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-obj-failed',
          userId: 'user-obj-failed',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.findFirst).toHaveBeenCalledWith({
          where: { stripeCustomerId: customerId },
        });
      });

      it('should handle failed invoice with null description', async () => {
        const event = createInvoicePaymentFailedEventMock({
          customer: 'cus_null_desc',
          description: null,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-null-desc',
          userId: 'user-null-desc',
          stripeCustomerId: 'cus_null_desc',
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            description: 'Payment failed - Subscription payment',
          }),
        });
      });

      it('should handle failed invoice with null amount and currency', async () => {
        const event = createInvoicePaymentFailedEventMock({
          customer: 'cus_null_amount',
          amount_due: null,
          currency: null,
          period_start: null,
          period_end: null,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-null-amount',
          userId: 'user-null-amount',
          stripeCustomerId: 'cus_null_amount',
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.billingHistory.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            amount: 0,
            currency: 'usd',
            periodStart: new Date(0),
            periodEnd: new Date(0),
          }),
        });
      });
    });
  });

  describe('payment intent event handlers', () => {
    describe('handlePaymentIntentSucceeded', () => {
      it('should update payment intent status to SUCCEEDED', async () => {
        const paymentIntentId = 'pi_success';
        const event = createPaymentIntentSucceededEventMock({
          id: paymentIntentId,
          status: 'succeeded',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.paymentIntent.updateMany).toHaveBeenCalledWith({
          where: { stripePaymentIntentId: paymentIntentId },
          data: {
            status: 'SUCCEEDED',
            updatedAt: expect.any(Date),
          },
        });
      });
    });

    describe('handlePaymentIntentFailed', () => {
      it('should update payment intent status to FAILED', async () => {
        const paymentIntentId = 'pi_failed';
        const event = createPaymentIntentFailedEventMock({
          id: paymentIntentId,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.paymentIntent.updateMany).toHaveBeenCalledWith({
          where: { stripePaymentIntentId: paymentIntentId },
          data: {
            status: 'FAILED',
            updatedAt: expect.any(Date),
          },
        });
      });
    });
  });

  describe('payment method event handlers', () => {
    describe('handlePaymentMethodAttached', () => {
      it('should create payment method record when attached', async () => {
        const customerId = 'cus_pm_test';
        const paymentMethodId = 'pm_attached';
        const event = createPaymentMethodAttachedEventMock({
          id: paymentMethodId,
          customer: customerId,
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025,
          } as any,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-pm',
          userId: 'user-pm',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.paymentMethod.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: 'user-pm',
            stripePaymentMethodId: paymentMethodId,
            type: 'card',
            brand: 'visa',
            last4: '4242',
            expiryMonth: 12,
            expiryYear: 2025,
            isDefault: false,
          }),
        });
      });

      it('should create payment method without card details', async () => {
        const customerId = 'cus_pm_no_card';
        const paymentMethodId = 'pm_no_card';
        const event = createPaymentMethodAttachedEventMock({
          id: paymentMethodId,
          customer: customerId,
          card: undefined,
          type: 'us_bank_account',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-pm-no-card',
          userId: 'user-pm-no-card',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.paymentMethod.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: 'user-pm-no-card',
            stripePaymentMethodId: paymentMethodId,
            type: 'us_bank_account',
            brand: undefined,
            last4: undefined,
            expiryMonth: undefined,
            expiryYear: undefined,
          }),
        });
      });

      it('should handle payment method with object customer', async () => {
        const customerId = 'cus_pm_obj';
        const event = createPaymentMethodAttachedEventMock({
          customer: { id: customerId } as any,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-pm-obj',
          userId: 'user-pm-obj',
          stripeCustomerId: customerId,
          subscriptionTier: SubscriptionTier.CONNECT,
          status: SubscriptionStatus.ACTIVE,
        } as unknown as {
          id: string;
          userId: string;
          stripeCustomerId?: string;
          stripeSubscriptionId?: string;
          subscriptionTier: SubscriptionTier;
          status: SubscriptionStatus;
        });

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.subscription.findFirst).toHaveBeenCalledWith({
          where: { stripeCustomerId: customerId },
        });
      });

      it('should handle customer not found for payment method', async () => {
        const event = createPaymentMethodAttachedEventMock({
          customer: 'cus_notfound',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        prismaStub.subscription.findFirst.mockResolvedValueOnce(null);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
        expect(prismaStub.paymentMethod.create).not.toHaveBeenCalled();
      });
    });

    describe('handlePaymentMethodDetached', () => {
      it('should delete payment method record when detached', async () => {
        const paymentMethodId = 'pm_detached';
        const event = createPaymentMethodDetachedEventMock({
          id: paymentMethodId,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        await controller.handleStripeWebhook(signature, req as any);

        expect(prismaStub.paymentMethod.deleteMany).toHaveBeenCalledWith({
          where: { stripePaymentMethodId: paymentMethodId },
        });
      });
    });
  });

  describe('dispute event handlers', () => {
    describe('handleDisputeCreated', () => {
      it('should log warning when dispute is created', async () => {
        const chargeId = 'ch_disputed';
        const event = createDisputeCreatedEventMock({
          charge: chargeId,
          reason: 'fraudulent',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
      });

      it('should handle dispute with object charge', async () => {
        const chargeId = 'ch_obj';
        const event = createDisputeCreatedEventMock({
          charge: { id: chargeId } as any,
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
      });
    });

    describe('handleDisputeClosed', () => {
      it('should log dispute closure', async () => {
        const event = createDisputeClosedEventMock({
          status: 'won',
        });

        const signature = 't=1234567890,v1=valid_signature';
        const req = {
          rawBody: Buffer.from('test'),
          body: Buffer.from('test'),
        };

        stripeMock.webhooks.constructEvent.mockReturnValue(event);

        const result = await controller.handleStripeWebhook(
          signature,
          req as any,
        );

        expect(result).toEqual({ received: true });
      });
    });
  });

  describe('status mapping helpers', () => {
    it('should map Stripe status "active" to ACTIVE', async () => {
      const event = createSubscriptionCreatedEventMock({
        status: 'active',
      });

      const signature = 't=1234567890,v1=valid_signature';
      const req = {
        rawBody: Buffer.from('test'),
        body: Buffer.from('test'),
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      prismaStub.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-status',
        userId: 'user-status',

        stripeCustomerId: (event.data.object as any).customer,
        subscriptionTier: SubscriptionTier.DISCOVER,
        status: SubscriptionStatus.PENDING,
      } as unknown as {
        id: string;
        userId: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionTier: SubscriptionTier;
        status: SubscriptionStatus;
      });

      await controller.handleStripeWebhook(signature, req as any);

      expect(prismaStub.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-status' },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
        }),
      });
    });

    it('should map Stripe status "trialing" to ACTIVE', async () => {
      const event = createSubscriptionCreatedEventMock({
        status: 'trialing',
      });

      const signature = 't=1234567890,v1=valid_signature';
      const req = {
        rawBody: Buffer.from('test'),
        body: Buffer.from('test'),
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      prismaStub.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-trial',
        userId: 'user-trial',

        stripeCustomerId: (event.data.object as any).customer,
        subscriptionTier: SubscriptionTier.DISCOVER,
        status: SubscriptionStatus.PENDING,
      } as unknown as {
        id: string;
        userId: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionTier: SubscriptionTier;
        status: SubscriptionStatus;
      });

      await controller.handleStripeWebhook(signature, req as any);

      expect(prismaStub.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-trial' },
        data: expect.objectContaining({
          status: SubscriptionStatus.ACTIVE,
        }),
      });
    });

    it('should map Stripe status "canceled" to CANCELLED', async () => {
      const event = createSubscriptionUpdatedEventMock({
        status: 'canceled',
      });

      const signature = 't=1234567890,v1=valid_signature';
      const req = {
        rawBody: Buffer.from('test'),
        body: Buffer.from('test'),
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      prismaStub.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-cancel',
        userId: 'user-cancel',

        stripeSubscriptionId: (event.data.object as any).id,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
      } as unknown as {
        id: string;
        userId: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionTier: SubscriptionTier;
        status: SubscriptionStatus;
      });

      await controller.handleStripeWebhook(signature, req as any);

      expect(prismaStub.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-cancel' },
        data: expect.objectContaining({
          status: SubscriptionStatus.CANCELLED,
        }),
      });
    });

    it('should map Stripe status "unpaid" to BILLING_RETRY', async () => {
      const event = createSubscriptionUpdatedEventMock({
        status: 'unpaid',
      });

      const signature = 't=1234567890,v1=valid_signature';
      const req = {
        rawBody: Buffer.from('test'),
        body: Buffer.from('test'),
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      prismaStub.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-unpaid',
        userId: 'user-unpaid',

        stripeSubscriptionId: (event.data.object as any).id,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
      } as unknown as {
        id: string;
        userId: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionTier: SubscriptionTier;
        status: SubscriptionStatus;
      });

      await controller.handleStripeWebhook(signature, req as any);

      expect(prismaStub.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-unpaid' },
        data: expect.objectContaining({
          status: SubscriptionStatus.BILLING_RETRY,
        }),
      });
    });

    it('should map Stripe status "past_due" to BILLING_RETRY', async () => {
      const event = createSubscriptionUpdatedEventMock({
        status: 'past_due',
      });

      const signature = 't=1234567890,v1=valid_signature';
      const req = {
        rawBody: Buffer.from('test'),
        body: Buffer.from('test'),
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      prismaStub.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-pastdue',
        userId: 'user-pastdue',

        stripeSubscriptionId: (event.data.object as any).id,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
      } as unknown as {
        id: string;
        userId: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionTier: SubscriptionTier;
        status: SubscriptionStatus;
      });

      await controller.handleStripeWebhook(signature, req as any);

      expect(prismaStub.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-pastdue' },
        data: expect.objectContaining({
          status: SubscriptionStatus.BILLING_RETRY,
        }),
      });
    });

    it('should default unknown status to PENDING', async () => {
      const event = createSubscriptionUpdatedEventMock({
        status: 'unknown_status' as any,
      });

      const signature = 't=1234567890,v1=valid_signature';
      const req = {
        rawBody: Buffer.from('test'),
        body: Buffer.from('test'),
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      prismaStub.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-unknown',
        userId: 'user-unknown',

        stripeSubscriptionId: (event.data.object as any).id,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
      } as unknown as {
        id: string;
        userId: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionTier: SubscriptionTier;
        status: SubscriptionStatus;
      });

      await controller.handleStripeWebhook(signature, req as any);

      expect(prismaStub.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-unknown' },
        data: expect.objectContaining({
          status: SubscriptionStatus.PENDING,
        }),
      });
    });
  });

  describe('tier mapping helpers', () => {
    it('should map price_connect_monthly to CONNECT tier', async () => {
      const event = createSubscriptionUpdatedEventMock({
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test',
              price: {
                id: 'price_connect_monthly',
              } as any,
            } as any,
          ],
          has_more: false,
          url: '/v1/subscription_items',
        },
      });

      const signature = 't=1234567890,v1=valid_signature';
      const req = {
        rawBody: Buffer.from('test'),
        body: Buffer.from('test'),
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      prismaStub.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-tier',
        userId: 'user-tier',

        stripeSubscriptionId: (event.data.object as any).id,
        subscriptionTier: SubscriptionTier.DISCOVER,
        status: SubscriptionStatus.ACTIVE,
      } as unknown as {
        id: string;
        userId: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionTier: SubscriptionTier;
        status: SubscriptionStatus;
      });

      await controller.handleStripeWebhook(signature, req as any);

      expect(prismaStub.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-tier' },
        data: expect.objectContaining({
          subscriptionTier: SubscriptionTier.CONNECT,
        }),
      });
    });

    it('should map price_community_yearly to COMMUNITY tier', async () => {
      const event = createSubscriptionUpdatedEventMock({
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test',
              price: {
                id: 'price_community_yearly',
              } as any,
            } as any,
          ],
          has_more: false,
          url: '/v1/subscription_items',
        },
      });

      const signature = 't=1234567890,v1=valid_signature';
      const req = {
        rawBody: Buffer.from('test'),
        body: Buffer.from('test'),
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      prismaStub.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-community',
        userId: 'user-community',

        stripeSubscriptionId: (event.data.object as any).id,
        subscriptionTier: SubscriptionTier.DISCOVER,
        status: SubscriptionStatus.ACTIVE,
      } as unknown as {
        id: string;
        userId: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionTier: SubscriptionTier;
        status: SubscriptionStatus;
      });

      await controller.handleStripeWebhook(signature, req as any);

      expect(prismaStub.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-community' },
        data: expect.objectContaining({
          subscriptionTier: SubscriptionTier.COMMUNITY,
        }),
      });
    });

    it('should default unknown price to DISCOVER tier', async () => {
      const event = createSubscriptionUpdatedEventMock({
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test',
              price: {
                id: 'price_unknown',
              } as any,
            } as any,
          ],
          has_more: false,
          url: '/v1/subscription_items',
        },
      });

      const signature = 't=1234567890,v1=valid_signature';
      const req = {
        rawBody: Buffer.from('test'),
        body: Buffer.from('test'),
      };

      stripeMock.webhooks.constructEvent.mockReturnValue(event);

      prismaStub.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-default',
        userId: 'user-default',

        stripeSubscriptionId: (event.data.object as any).id,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
      } as unknown as {
        id: string;
        userId: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        subscriptionTier: SubscriptionTier;
        status: SubscriptionStatus;
      });

      await controller.handleStripeWebhook(signature, req as any);

      expect(prismaStub.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-default' },
        data: expect.objectContaining({
          subscriptionTier: SubscriptionTier.DISCOVER,
        }),
      });
    });
  });
});
