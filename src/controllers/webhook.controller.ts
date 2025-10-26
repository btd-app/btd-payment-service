/**
 * Webhook Controller
 * Handles Stripe webhook events
 *
 * Last Updated On: 2025-08-06
 */

import {
  Controller,
  Post,
  Body,
  Headers,
  HttpStatus,
  HttpCode,
  BadRequestException,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import '../types/external';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import {
  SubscriptionStatus,
  SubscriptionTier,
  InvoiceStatus,
} from '@prisma/client';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private stripe: Stripe;
  private endpointSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.configService.get('STRIPE_SECRET_KEY') || '',
      {
        apiVersion: '2025-08-27.basil',
      },
    );
    this.endpointSecret = this.configService.get('STRIPE_WEBHOOK_SECRET') || '';
  }

  /**
   * Handle Stripe webhook events
   */
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      // Get raw body - try different ways NestJS might provide it
      const rawBody = req.rawBody || req.body || Buffer.from('');

      this.logger.debug(
        `Processing webhook with signature: ${signature.substring(0, 20)}...`,
      );
      this.logger.debug(
        `Raw body type: ${typeof rawBody}, length: ${Buffer.isBuffer(rawBody) ? rawBody.length : 'unknown'}`,
      );

      // Ensure rawBody is a Buffer
      const bodyBuffer = Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(rawBody as unknown as string);

      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        bodyBuffer,
        signature,
        this.endpointSecret,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(
        `Webhook signature verification failed: ${errorMessage}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    // Store webhook event for auditing
    await this.prisma.webhookEvent.create({
      data: {
        eventId: event.id,
        stripeEventId: event.id,
        type: event.type,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: JSON.parse(JSON.stringify(event)), // Store full event - Prisma JSON type quirk
        processedAt: new Date(),
      },
    });

    // Process the event
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event);
          break;

        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event);
          break;

        case 'customer.subscription.trial_will_end':
          this.handleTrialWillEnd(event);
          break;

        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event);
          break;

        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event);
          break;

        case 'payment_method.attached':
          await this.handlePaymentMethodAttached(event);
          break;

        case 'payment_method.detached':
          await this.handlePaymentMethodDetached(event);
          break;

        case 'charge.dispute.created':
          this.handleDisputeCreated(event);
          break;

        case 'charge.dispute.closed':
          this.handleDisputeClosed(event);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      // Mark event as processed
      await this.prisma.webhookEvent.updateMany({
        where: { stripeEventId: event.id },
        data: { status: 'processed' },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error processing webhook event ${event.id}: ${errorMessage}`,
      );

      // Mark event as failed
      await this.prisma.webhookEvent.updateMany({
        where: { stripeEventId: event.id },
        data: {
          status: 'failed',
          error: errorMessage,
        },
      });

      // Don't throw - we don't want Stripe to retry
      // Log to monitoring system instead
    }

    return { received: true };
  }

  /**
   * Handle subscription created event
   */
  private async handleSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    // Find user by Stripe customer ID
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;

    const userSub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!userSub) {
      this.logger.error(`No user found for customer ${customerId}`);
      return;
    }

    // Extract subscription data with proper types
    const subscriptionData = subscription as unknown as {
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
    };

    // Update subscription details
    await this.prisma.subscription.update({
      where: { id: userSub.id },
      data: {
        stripeSubscriptionId: subscription.id,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(
          subscriptionData.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
        cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
        planId: subscription.items.data[0]?.price?.id,
      },
    });

    this.logger.log(`Subscription created for user ${userSub.userId}`);

    // TODO: Publish event to Redis for other services
  }

  /**
   * Handle subscription updated event
   */
  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    const userSub = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!userSub) {
      this.logger.error(`No subscription found for ${subscription.id}`);
      return;
    }

    // Determine tier from price ID
    const priceId = subscription.items.data[0]?.price?.id ?? '';
    const tier = this.getTierFromPriceId(priceId);

    // Extract subscription data with proper types
    const subscriptionData = subscription as unknown as {
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
    };

    await this.prisma.subscription.update({
      where: { id: userSub.id },
      data: {
        subscriptionTier: tier,
        status: this.mapStripeStatus(subscription.status),
        currentPeriodStart: new Date(
          subscriptionData.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
        cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
        planId: priceId,
      },
    });

    this.logger.log(`Subscription updated for user ${userSub.userId}`);

    // TODO: Publish event to Redis for other services
  }

  /**
   * Handle subscription deleted event
   */
  private async handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    const userSub = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!userSub) {
      this.logger.error(`No subscription found for ${subscription.id}`);
      return;
    }

    await this.prisma.subscription.update({
      where: { id: userSub.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        subscriptionTier: SubscriptionTier.DISCOVER,
        cancelledAt: new Date(),
      },
    });

    this.logger.log(`Subscription cancelled for user ${userSub.userId}`);

    // TODO: Publish event to Redis for other services
  }

  /**
   * Handle trial will end event
   */
  private handleTrialWillEnd(event: Stripe.Event): void {
    const subscription = event.data.object as Stripe.Subscription;

    this.logger.log(`Trial ending soon for subscription ${subscription.id}`);

    // TODO: Send email notification to user
    // TODO: Publish event to notification service
  }

  /**
   * Handle invoice payment succeeded event
   */
  private async handleInvoicePaymentSucceeded(
    event: Stripe.Event,
  ): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    // Find user by customer ID
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    const userSub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!userSub) {
      this.logger.error(`No user found for customer ${customerId}`);
      return;
    }

    // Store billing history
    await this.prisma.billingHistory.create({
      data: {
        userId: userSub.userId,
        stripeInvoiceId: invoice.id,
        type: 'subscription_payment',
        amount: invoice.amount_paid ?? 0,
        currency: invoice.currency ?? 'usd',
        status: InvoiceStatus.PAID,
        description: invoice.description ?? 'Subscription payment',
        periodStart: new Date((invoice.period_start ?? 0) * 1000),
        periodEnd: new Date((invoice.period_end ?? 0) * 1000),
        invoiceUrl: invoice.hosted_invoice_url ?? undefined,
        pdfUrl: invoice.invoice_pdf ?? undefined,
      },
    });

    this.logger.log(`Payment succeeded for user ${userSub.userId}`);

    // TODO: Send receipt email
  }

  /**
   * Handle invoice payment failed event
   */
  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as Stripe.Invoice;

    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    const userSub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!userSub) {
      this.logger.error(`No user found for customer ${customerId}`);
      return;
    }

    // Store failed payment attempt
    await this.prisma.billingHistory.create({
      data: {
        userId: userSub.userId,
        stripeInvoiceId: invoice.id,
        type: 'subscription_payment',
        amount: invoice.amount_due ?? 0,
        currency: invoice.currency ?? 'usd',
        status: InvoiceStatus.UNCOLLECTIBLE,
        description: `Payment failed - ${invoice.description ?? 'Subscription payment'}`,
        periodStart: new Date((invoice.period_start ?? 0) * 1000),
        periodEnd: new Date((invoice.period_end ?? 0) * 1000),
      },
    });

    this.logger.log(`Payment failed for user ${userSub.userId}`);

    // TODO: Send payment failed email
    // TODO: Publish event for subscription degradation
  }

  /**
   * Handle payment intent succeeded event
   */
  private async handlePaymentIntentSucceeded(
    event: Stripe.Event,
  ): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    // Update payment intent record
    await this.prisma.paymentIntent.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'SUCCEEDED',
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Payment intent succeeded: ${paymentIntent.id}`);
  }

  /**
   * Handle payment intent failed event
   */
  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    await this.prisma.paymentIntent.updateMany({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: 'FAILED',
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Payment intent failed: ${paymentIntent.id}`);
  }

  /**
   * Handle payment method attached event
   */
  private async handlePaymentMethodAttached(
    event: Stripe.Event,
  ): Promise<void> {
    const paymentMethod = event.data.object as Stripe.PaymentMethod;

    // Find user by customer ID
    const customerId =
      typeof paymentMethod.customer === 'string'
        ? paymentMethod.customer
        : paymentMethod.customer?.id;

    const userSub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!userSub) {
      this.logger.error(`No user found for customer ${customerId}`);
      return;
    }

    // Store payment method
    await this.prisma.paymentMethod.create({
      data: {
        userId: userSub.userId,
        stripePaymentMethodId: paymentMethod.id,
        type: paymentMethod.type,
        brand: paymentMethod.card?.brand ?? undefined,
        last4: paymentMethod.card?.last4 ?? undefined,
        expiryMonth: paymentMethod.card?.exp_month ?? undefined,
        expiryYear: paymentMethod.card?.exp_year ?? undefined,
        isDefault: false,
      },
    });

    this.logger.log(`Payment method attached for user ${userSub.userId}`);
  }

  /**
   * Handle payment method detached event
   */
  private async handlePaymentMethodDetached(
    event: Stripe.Event,
  ): Promise<void> {
    const paymentMethod = event.data.object as Stripe.PaymentMethod;

    // Delete payment method record
    await this.prisma.paymentMethod.deleteMany({
      where: { stripePaymentMethodId: paymentMethod.id },
    });

    this.logger.log(`Payment method detached: ${paymentMethod.id}`);
  }

  /**
   * Handle dispute created event
   */
  private handleDisputeCreated(event: Stripe.Event): void {
    const dispute = event.data.object as Stripe.Dispute;

    const chargeId =
      typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;

    this.logger.warn(`Dispute created: ${dispute.id} for charge ${chargeId}`);

    // TODO: Notify admin
    // TODO: Temporarily restrict user account
  }

  /**
   * Handle dispute closed event
   */
  private handleDisputeClosed(event: Stripe.Event): void {
    const dispute = event.data.object as Stripe.Dispute;

    this.logger.log(
      `Dispute closed: ${dispute.id} - Status: ${dispute.status}`,
    );

    // TODO: Update user account status based on dispute outcome
  }

  /**
   * Map Stripe subscription status to our enum
   */
  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      canceled: SubscriptionStatus.CANCELLED,
      incomplete: SubscriptionStatus.PENDING,
      incomplete_expired: SubscriptionStatus.EXPIRED,
      trialing: SubscriptionStatus.ACTIVE,
      unpaid: SubscriptionStatus.BILLING_RETRY,
      past_due: SubscriptionStatus.BILLING_RETRY,
    };

    return statusMap[stripeStatus] || SubscriptionStatus.PENDING;
  }

  /**
   * Determine subscription tier from Stripe price ID
   */
  private getTierFromPriceId(priceId: string): SubscriptionTier {
    // These should match your Stripe price IDs
    const priceToTierMap: Record<string, SubscriptionTier> = {
      price_discover_monthly: SubscriptionTier.DISCOVER,
      price_discover_yearly: SubscriptionTier.DISCOVER,
      price_connect_monthly: SubscriptionTier.CONNECT,
      price_connect_yearly: SubscriptionTier.CONNECT,
      price_community_monthly: SubscriptionTier.COMMUNITY,
      price_community_yearly: SubscriptionTier.COMMUNITY,
    };

    return priceToTierMap[priceId] || SubscriptionTier.DISCOVER;
  }
}
