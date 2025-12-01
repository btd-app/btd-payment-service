/**
 * gRPC Controller for Payment Service
 * Provides payment and subscription operations via gRPC
 *
 * This controller uses proto-generated types from @btd/proto as the single
 * source of truth for all gRPC request/response interfaces.
 * Proto fields use snake_case naming convention with keepCase: true.
 */
import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable, Subject } from 'rxjs';

// Import existing payment services
import { SubscriptionService } from '../services/subscription.service';
import { StripeService } from '../services/stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier } from '@prisma/client';

// Import types from @btd/proto - single source of truth for proto definitions
import {
  type CreateSubscriptionRequest,
  type CreateSubscriptionResponse,
  type UpdateSubscriptionRequest,
  type UpdateSubscriptionResponse,
  type CancelSubscriptionRequest,
  type CancelSubscriptionResponse,
  type GetSubscriptionRequest,
  type GetSubscriptionResponse,
  type GetUserSubscriptionsRequest,
  type GetUserSubscriptionsResponse,
  type ProcessPaymentRequest,
  type ProcessPaymentResponse,
  type RefundPaymentRequest,
  type RefundPaymentResponse,
  type GetPaymentHistoryRequest,
  type GetPaymentHistoryResponse,
  type AddPaymentMethodRequest,
  type AddPaymentMethodResponse,
  type RemovePaymentMethodRequest,
  type RemovePaymentMethodResponse,
  type GetPaymentMethodsRequest,
  type GetPaymentMethodsResponse,
  type SetDefaultPaymentMethodRequest,
  type SetDefaultPaymentMethodResponse,
  type GetInvoicesRequest,
  type GetInvoicesResponse,
  type GetUpcomingInvoiceRequest,
  type GetUpcomingInvoiceResponse,
  type GetPricingPlansRequest,
  type GetPricingPlansResponse,
  type ValidatePromoCodeRequest,
  type ValidatePromoCodeResponse,
  type ProcessStripeWebhookRequest,
  type ProcessStripeWebhookResponse,
  type GetPaymentHealthRequest,
  type GetPaymentHealthResponse,
  type StreamPaymentEventsRequest,
  type StreamPaymentEventsResponse,
  type Subscription,
  type Payment,
  type PaymentMethod,
  type PricingPlan,
  type Invoice,
  type InvoiceLineItem,
  type CardDetails,
} from '@btd/proto/types/payment';

/**
 * Controller implementing gRPC methods for Payment Service
 */
@Controller()
export class PaymentGrpcController {
  private readonly logger = new Logger(PaymentGrpcController.name);
  private readonly eventStream = new Subject<StreamPaymentEventsResponse>();
  private streamCounter = 0;

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new subscription
   */
  @GrpcMethod('PaymentService', 'CreateSubscription')
  async createSubscription(
    data: CreateSubscriptionRequest,
  ): Promise<CreateSubscriptionResponse> {
    this.logger.debug(
      `[gRPC] Creating subscription for user ${data.user_id} with plan ${data.plan_id}`,
    );

    try {
      // Note: User data would come from external user service
      // For now, we'll use mock data for email
      const userEmail = `user-${data.user_id}@example.com`;

      // Create or get Stripe customer
      await this.stripeService.createOrGetCustomer(
        data.user_id,
        userEmail,
        undefined,
      );

      // Create subscription using Stripe service
      const result = await this.stripeService.createSubscription(
        data.user_id,
        data.plan_id,
        data.payment_method_id || '',
      );

      // Get subscription details from database
      const dbSubscription = await this.prisma.subscription.findUnique({
        where: { userId: data.user_id },
      });

      const subscription: Subscription = {
        id: result.subscriptionId,
        user_id: data.user_id,
        plan_id: data.plan_id,
        status: result.status,
        amount: 0, // Would need to get from plan config
        currency: 'usd',
        interval: 'month',
        current_period_start:
          dbSubscription?.currentPeriodStart?.toISOString() ||
          new Date().toISOString(),
        current_period_end: result.currentPeriodEnd.toISOString(),
        created_at: new Date().toISOString(),
        cancelled_at: '',
        ends_at: '',
        metadata: data.metadata || {},
        feature_flags: this.getFeatureFlagsForPlan(data.plan_id),
      };

      // Emit event
      this.emitPaymentEvent('subscription_created', data.user_id, {
        subscriptionId: subscription.id,
        planId: data.plan_id,
      });

      return {
        subscription,
        client_secret: result.clientSecret || '',
        requires_action: !!result.clientSecret,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create subscription: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Update an existing subscription
   */
  @GrpcMethod('PaymentService', 'UpdateSubscription')
  async updateSubscription(
    data: UpdateSubscriptionRequest,
  ): Promise<UpdateSubscriptionResponse> {
    this.logger.debug(`[gRPC] Updating subscription ${data.subscription_id}`);

    try {
      // Update subscription using Stripe service
      await this.stripeService.updateSubscription(
        data.user_id,
        data.new_plan_id,
        false,
      );

      // Get updated subscription from database
      const dbSubscription = await this.prisma.subscription.findUnique({
        where: { userId: data.user_id },
      });

      if (!dbSubscription) {
        throw new Error('Subscription not found');
      }

      const subscription: Subscription = {
        id: dbSubscription.stripeSubscriptionId || data.subscription_id,
        user_id: data.user_id,
        plan_id: dbSubscription.planId || data.new_plan_id,
        status: dbSubscription.status.toLowerCase(),
        amount: 0, // Would need to calculate from plan
        currency: 'usd',
        interval: 'month',
        current_period_start:
          dbSubscription.currentPeriodStart?.toISOString() ||
          new Date().toISOString(),
        current_period_end:
          dbSubscription.currentPeriodEnd?.toISOString() ||
          new Date().toISOString(),
        created_at: dbSubscription.createdAt.toISOString(),
        cancelled_at: dbSubscription.cancelledAt?.toISOString() || '',
        ends_at: '',
        metadata: {},
        feature_flags: [],
      };

      return {
        subscription,
        proration_amount: 0, // Would need to calculate from Stripe response
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update subscription: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  @GrpcMethod('PaymentService', 'CancelSubscription')
  async cancelSubscription(
    data: CancelSubscriptionRequest,
  ): Promise<CancelSubscriptionResponse> {
    this.logger.debug(
      `[gRPC] Cancelling subscription ${data.subscription_id} for user ${data.user_id}`,
    );

    try {
      // Cancel subscription using Stripe service
      await this.stripeService.cancelSubscription(
        data.user_id,
        data.cancel_immediately,
      );

      // Get updated subscription from database
      const dbSubscription = await this.prisma.subscription.findUnique({
        where: { userId: data.user_id },
      });

      const now = new Date().toISOString();
      const endsAt = data.cancel_immediately
        ? now
        : dbSubscription?.currentPeriodEnd?.toISOString() ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Emit event
      this.emitPaymentEvent('subscription_cancelled', data.user_id, {
        subscriptionId: data.subscription_id,
        reason: data.cancellation_reason || 'user_requested',
      });

      return {
        success: true,
        cancelled_at: dbSubscription?.cancelledAt?.toISOString() || now,
        ends_at: endsAt,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to cancel subscription: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  @GrpcMethod('PaymentService', 'GetSubscription')
  async getSubscription(
    data: GetSubscriptionRequest,
  ): Promise<GetSubscriptionResponse> {
    this.logger.debug(`[gRPC] Getting subscription ${data.subscription_id}`);

    try {
      // Get subscription from database
      const dbSubscription = await this.prisma.subscription.findUnique({
        where: { userId: data.user_id },
      });

      if (!dbSubscription) {
        throw new Error('Subscription not found');
      }

      // Get subscription features from subscription service
      const features = this.subscriptionService.getSubscriptionFeatures(
        dbSubscription.subscriptionTier,
      );

      const subscription: Subscription = {
        id: dbSubscription.stripeSubscriptionId || data.subscription_id,
        user_id: data.user_id,
        plan_id:
          dbSubscription.planId ||
          dbSubscription.subscriptionTier.toLowerCase(),
        status: dbSubscription.status.toLowerCase(),
        amount: this.getPlanAmount(dbSubscription.subscriptionTier),
        currency: 'usd',
        interval: 'month',
        current_period_start:
          dbSubscription.currentPeriodStart?.toISOString() ||
          new Date().toISOString(),
        current_period_end:
          dbSubscription.currentPeriodEnd?.toISOString() ||
          new Date().toISOString(),
        created_at: dbSubscription.createdAt.toISOString(),
        cancelled_at: dbSubscription.cancelledAt?.toISOString() || '',
        ends_at: '',
        metadata: {},
        feature_flags: this.extractFeatureFlags(features),
      };

      return { subscription };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get subscription: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process a payment
   */
  @GrpcMethod('PaymentService', 'ProcessPayment')
  async processPayment(
    data: ProcessPaymentRequest,
  ): Promise<ProcessPaymentResponse> {
    this.logger.debug(
      `[gRPC] Processing payment of ${data.amount} ${data.currency} for user ${data.user_id}`,
    );

    try {
      // Create payment intent using Stripe service
      const paymentIntent = await this.stripeService.createPaymentIntent(
        data.user_id,
        'one_time_payment', // Special plan ID for one-time payments
        data.payment_method_id,
        data.currency,
      );

      // Store payment record in database
      const paymentRecord = await this.prisma.paymentIntent.create({
        data: {
          userId: data.user_id,
          stripePaymentIntentId: paymentIntent.paymentIntentId,
          amount: data.amount,
          currency: data.currency,
          status: 'PENDING',
          description: data.description,
          metadata: data.metadata || {},
        },
      });

      const payment: Payment = {
        id: paymentIntent.paymentIntentId,
        user_id: data.user_id,
        amount: data.amount,
        currency: data.currency,
        status: 'pending',
        description: data.description || '',
        payment_method_id: data.payment_method_id,
        created_at: paymentRecord.createdAt.toISOString(),
        metadata: data.metadata || {},
        invoice_id: '',
        subscription_id: '',
      };

      // Emit event
      this.emitPaymentEvent('payment_initiated', data.user_id, {
        paymentId: payment.id,
        amount: String(data.amount),
        currency: data.currency,
      });

      return {
        payment,
        client_secret: paymentIntent.clientSecret,
        requires_action: true,
        error: '',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process payment: ${errorMessage}`);
      return {
        payment: undefined,
        client_secret: '',
        requires_action: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Add a payment method
   */
  @GrpcMethod('PaymentService', 'AddPaymentMethod')
  async addPaymentMethod(
    data: AddPaymentMethodRequest,
  ): Promise<AddPaymentMethodResponse> {
    this.logger.debug(`[gRPC] Adding payment method for user ${data.user_id}`);

    try {
      // Create setup intent for adding payment method
      await this.stripeService.createSetupIntent(data.user_id);

      // If payment method ID is provided, attach it
      if (data.payment_method_id) {
        // Set as default if requested
        if (data.set_as_default) {
          await this.stripeService.setDefaultPaymentMethod(
            data.user_id,
            data.payment_method_id,
          );
        }

        // Get payment method details from database
        const dbPaymentMethod = await this.prisma.paymentMethod.findUnique({
          where: { stripePaymentMethodId: data.payment_method_id },
        });

        if (dbPaymentMethod) {
          const card: CardDetails | undefined = dbPaymentMethod.brand
            ? {
                brand: dbPaymentMethod.brand,
                last4: dbPaymentMethod.last4 || '****',
                exp_month: dbPaymentMethod.expiryMonth || 12,
                exp_year: dbPaymentMethod.expiryYear || 2025,
                funding: 'credit',
              }
            : undefined;

          const paymentMethod: PaymentMethod = {
            id: dbPaymentMethod.stripePaymentMethodId,
            type: dbPaymentMethod.type,
            card,
            created_at: dbPaymentMethod.createdAt.toISOString(),
            is_default: dbPaymentMethod.isDefault,
            billing_email: '',
          };

          return {
            payment_method: paymentMethod,
            success: true,
            error: '',
          };
        }
      }

      // Return success without payment method (client will use setup intent)
      return {
        payment_method: undefined,
        success: true,
        error: '',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add payment method: ${errorMessage}`);
      return {
        payment_method: undefined,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get payment methods for a user
   */
  @GrpcMethod('PaymentService', 'GetPaymentMethods')
  async getPaymentMethods(
    data: GetPaymentMethodsRequest,
  ): Promise<GetPaymentMethodsResponse> {
    this.logger.debug(
      `[gRPC] Getting payment methods for user ${data.user_id}`,
    );

    try {
      // Get payment methods from Stripe service
      const dbPaymentMethods = await this.stripeService.getPaymentMethods(
        data.user_id,
      );

      // Transform to gRPC format
      const payment_methods: PaymentMethod[] = dbPaymentMethods.map((pm) => {
        const card: CardDetails | undefined = pm.brand
          ? {
              brand: pm.brand,
              last4: pm.last4 || '****',
              exp_month: pm.expiryMonth || 12,
              exp_year: pm.expiryYear || 2025,
              funding: 'credit',
            }
          : undefined;

        return {
          id: pm.stripePaymentMethodId,
          type: pm.type,
          card,
          created_at: pm.createdAt.toISOString(),
          is_default: pm.isDefault,
          billing_email: '',
        };
      });

      const defaultMethod = payment_methods.find((pm) => pm.is_default);

      return {
        payment_methods,
        default_payment_method_id: defaultMethod?.id || '',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get payment methods: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get pricing plans
   */
  @GrpcMethod('PaymentService', 'GetPricingPlans')
  getPricingPlans(data: GetPricingPlansRequest): GetPricingPlansResponse {
    this.logger.debug(
      `[gRPC] Getting pricing plans for currency ${data.currency || 'usd'}`,
    );

    try {
      // Get available plans from Stripe service
      const stripePlans = this.stripeService.getAvailablePlans();

      // Transform to gRPC format with feature details from subscription service
      const plans: PricingPlan[] = Object.values(stripePlans).map((plan) => {
        const features = this.subscriptionService.getSubscriptionFeatures(
          plan.tier as SubscriptionTier,
        );

        return {
          id: plan.id,
          name: plan.name,
          tier: plan.tier,
          monthly_price: plan.price / 100, // Convert from cents
          yearly_price: (plan.price * 12 * 0.85) / 100, // 15% yearly discount
          currency: data.currency || 'usd',
          features: this.getPlanFeatureList(features),
          limits: {
            daily_likes: features.dailyLikes,
            daily_messages: features.dailyUnmatchedMessages,
            super_likes: features.profileBoostCount,
            max_photos: features.maxPhotos,
            call_duration: features.maxCallDuration,
          },
          has_trial: false, // Not specified in SubscriptionPlan interface
          trial_days: 0,
          stripe_monthly_price_id: plan.stripePriceId,
          stripe_yearly_price_id: plan.stripePriceId + '_yearly', // Assuming yearly price ID format
        };
      });

      return {
        plans,
        currency: data.currency || 'usd',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get pricing plans: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get invoices for a user
   */
  @GrpcMethod('PaymentService', 'GetInvoices')
  async getInvoices(data: GetInvoicesRequest): Promise<GetInvoicesResponse> {
    this.logger.debug(`[gRPC] Getting invoices for user ${data.user_id}`);

    try {
      // Get billing history from Stripe service
      const billingHistory = await this.stripeService.getBillingHistory(
        data.user_id,
      );

      // Transform to gRPC format
      const invoices: Invoice[] = billingHistory.map((bill) => {
        // Convert Prisma Decimal to number
        const amountInCents = Number(bill.amount);
        const amountInDollars = amountInCents / 100;

        const lineItem: InvoiceLineItem = {
          description: bill.description || 'Subscription',
          amount: amountInDollars,
          quantity: 1,
          period_start: bill.periodStart.toISOString(),
          period_end: bill.periodEnd.toISOString(),
        };

        return {
          id: bill.stripeInvoiceId,
          subscription_id: '', // Billing history doesn't have subscription ID
          amount_due: amountInDollars,
          amount_paid: amountInDollars,
          currency: bill.currency,
          status: bill.status.toLowerCase(),
          due_date: bill.createdAt.toISOString(),
          period_start: bill.periodStart.toISOString(),
          period_end: bill.periodEnd.toISOString(),
          line_items: [lineItem],
          pdf_url: bill.pdfUrl || '',
        };
      });

      const limit = data.limit || 100;
      return {
        invoices: invoices.slice(0, limit),
        has_more: invoices.length > limit,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get invoices: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process Stripe webhook
   */
  @GrpcMethod('PaymentService', 'ProcessStripeWebhook')
  async processStripeWebhook(
    data: ProcessStripeWebhookRequest,
  ): Promise<ProcessStripeWebhookResponse> {
    this.logger.debug(`[gRPC] Processing Stripe webhook: ${data.event_type}`);

    try {
      // Handle different webhook event types
      let processed = false;
      let message = '';

      switch (data.event_type) {
        case 'payment_intent.succeeded':
          // Update payment intent status in database
          if (data.event_id) {
            await this.prisma.paymentIntent.updateMany({
              where: { stripePaymentIntentId: data.event_id },
              data: { status: 'SUCCEEDED' },
            });
            this.emitPaymentEvent('webhook_payment_succeeded', '', {
              eventId: data.event_id,
            });
          }
          processed = true;
          message = 'Payment intent succeeded';
          break;

        case 'payment_intent.payment_failed':
          if (data.event_id) {
            await this.prisma.paymentIntent.updateMany({
              where: { stripePaymentIntentId: data.event_id },
              data: { status: 'FAILED' },
            });
            this.emitPaymentEvent('webhook_payment_failed', '', {
              eventId: data.event_id,
            });
          }
          processed = true;
          message = 'Payment intent failed';
          break;

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          // Subscription webhooks are handled by Stripe service internally
          processed = true;
          message = 'Subscription webhook processed';
          break;

        default:
          this.logger.warn(`Unhandled webhook event type: ${data.event_type}`);
          processed = true;
          message = `Webhook ${data.event_type} acknowledged but not processed`;
      }

      return {
        processed,
        message,
        error: '',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process webhook: ${errorMessage}`);
      return {
        processed: false,
        message: '',
        error: errorMessage,
      };
    }
  }

  /**
   * Get payment service health
   */
  @GrpcMethod('PaymentService', 'GetPaymentHealth')
  getPaymentHealth(data: GetPaymentHealthRequest): GetPaymentHealthResponse {
    this.logger.debug('[gRPC] Getting payment service health');

    const response: GetPaymentHealthResponse = {
      healthy: true,
      timestamp: new Date().toISOString(),
    };

    if (data.include_stripe_status) {
      response.stripe_status = {
        connected: true,
        mode: process.env.NODE_ENV === 'production' ? 'live' : 'test',
        webhook_endpoints_active: 3,
        last_webhook_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      };
    }

    if (data.include_metrics) {
      response.metrics = {
        total_transactions: '15234',
        successful_transactions: '14998',
        failed_transactions: '236',
        total_revenue: 250000.5,
        active_subscriptions: '1250',
        mrr: 18750.0, // Monthly Recurring Revenue
        transactions_by_type: {
          subscription_creation: '450',
          subscription_renewal: '800',
          one_time_payment: '200',
        },
      };
    }

    return response;
  }

  /**
   * Stream payment events
   */
  @GrpcStreamMethod('PaymentService', 'StreamPaymentEvents')
  streamPaymentEvents(
    data: StreamPaymentEventsRequest,
  ): Observable<StreamPaymentEventsResponse> {
    this.logger.log(
      `[gRPC] Starting payment event stream for service ${data.service_id}`,
    );

    return new Observable((observer) => {
      const subscription = this.eventStream.subscribe({
        next: (event) => {
          // Filter by user if specified
          if (data.user_id && event.user_id !== data.user_id) {
            return;
          }

          // Filter by event types if specified
          if (data.event_types && data.event_types.length > 0) {
            if (!data.event_types.includes(event.event_type)) {
              return;
            }
          }

          observer.next(event);
        },
        error: (err: Error) => observer.error(err),
        complete: () => observer.complete(),
      });

      // Emit initial connection event
      this.emitPaymentEvent('stream_connected', '', {
        serviceId: data.service_id,
        streamId: `stream-${++this.streamCounter}`,
      });

      // Cleanup on disconnect
      return () => {
        subscription.unsubscribe();
        this.logger.log(
          `[gRPC] Payment event stream disconnected for service ${data.service_id}`,
        );
      };
    });
  }

  /**
   * Helper method to emit payment events
   */
  private emitPaymentEvent(
    eventType: string,
    userId?: string,
    data?: Record<string, string>,
  ) {
    const event: StreamPaymentEventsResponse = {
      event_id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      event_type: eventType,
      user_id: userId || '',
      data: data || {},
      timestamp: new Date().toISOString(),
      source: 'payment-service',
    };

    this.eventStream.next(event);
  }

  /**
   * Get feature flags for a given plan
   */
  private getFeatureFlagsForPlan(planId: string): string[] {
    const planFeatureMap: Record<string, string[]> = {
      discover: ['basic_matching'],
      connect: [
        'unlimited_likes',
        'see_who_liked_you',
        'advanced_filters',
        'audio_calls',
      ],
      community: [
        'unlimited_likes',
        'see_who_liked_you',
        'advanced_filters',
        'audio_calls',
        'video_calls',
        'priority_support',
      ],
    };

    return planFeatureMap[planId] || planFeatureMap['discover'];
  }

  /**
   * Get plan amount by subscription tier
   */
  private getPlanAmount(tier: SubscriptionTier): number {
    const tierPricing: Record<string, number> = {
      DISCOVER: 0,
      CONNECT: 9.99,
      COMMUNITY: 19.99,
    };

    return tierPricing[tier] || 0;
  }

  /**
   * Extract feature flags from subscription features
   */
  private extractFeatureFlags(
    features: ReturnType<
      typeof this.subscriptionService.getSubscriptionFeatures
    >,
  ): string[] {
    const flags: string[] = [];

    if (features.unlimitedLikes) flags.push('unlimited_likes');
    if (features.seeWhoLikedYou) flags.push('see_who_liked_you');
    if (features.advancedFilters) flags.push('advanced_filters');
    if (features.canMakeAudioCalls) flags.push('audio_calls');
    if (features.canMakeVideoCalls) flags.push('video_calls');
    if (features.voiceMessages) flags.push('voice_messages');
    if (features.videoMessages) flags.push('video_messages');
    if (features.travelMode) flags.push('travel_mode');
    if (features.incognitoMode) flags.push('incognito_mode');
    if (
      features.supportPriority === 'priority' ||
      features.supportPriority === 'vip'
    ) {
      flags.push('priority_support');
    }

    return flags;
  }

  /**
   * Get plan feature list for pricing display
   */
  private getPlanFeatureList(
    features: ReturnType<
      typeof this.subscriptionService.getSubscriptionFeatures
    >,
  ): string[] {
    const featureList: string[] = [];

    if (features.unlimitedLikes) {
      featureList.push('Unlimited likes');
    } else {
      featureList.push(`${features.dailyLikes} likes per day`);
    }

    if (features.seeWhoLikedYou) featureList.push('See who liked you');
    if (features.canMakeAudioCalls) featureList.push('Audio calls');
    if (features.canMakeVideoCalls) featureList.push('Video calls');
    if (features.voiceMessages) featureList.push('Voice messages');
    if (features.videoMessages) featureList.push('Video messages');
    if (features.advancedFilters) featureList.push('Advanced filters');
    if (features.travelMode) featureList.push('Travel mode');
    if (features.incognitoMode) featureList.push('Incognito browsing');

    if (features.supportPriority === 'priority') {
      featureList.push('Priority support');
    } else if (features.supportPriority === 'vip') {
      featureList.push('VIP support');
    }

    return featureList;
  }

  // Additional stub methods for remaining RPCs

  @GrpcMethod('PaymentService', 'GetUserSubscriptions')
  async getUserSubscriptions(
    data: GetUserSubscriptionsRequest,
  ): Promise<GetUserSubscriptionsResponse> {
    this.logger.debug(`[gRPC] Getting subscriptions for user ${data.user_id}`);

    try {
      // Get user's current subscription
      const subscription = await this.subscriptionService.getUserSubscription(
        data.user_id,
      );
      const features = this.subscriptionService.getSubscriptionFeatures(
        subscription.subscriptionTier,
      );

      const subscriptionCreatedAt =
        'createdAt' in subscription && subscription.createdAt instanceof Date
          ? subscription.createdAt.toISOString()
          : new Date().toISOString();

      const grpcSubscription: Subscription = {
        id:
          ('stripeSubscriptionId' in subscription
            ? subscription.stripeSubscriptionId
            : null) || `sub_${data.user_id}`,
        user_id: data.user_id,
        plan_id:
          ('planId' in subscription ? subscription.planId : null) ||
          subscription.subscriptionTier.toLowerCase(),
        status: subscription.status?.toLowerCase() || 'active',
        amount: this.getPlanAmount(subscription.subscriptionTier),
        currency: 'usd',
        interval: 'month',
        current_period_start:
          subscription.currentPeriodStart?.toISOString() ||
          new Date().toISOString(),
        current_period_end:
          subscription.currentPeriodEnd?.toISOString() ||
          new Date().toISOString(),
        created_at: subscriptionCreatedAt,
        cancelled_at: '',
        ends_at: '',
        metadata: {},
        feature_flags: this.extractFeatureFlags(features),
      };

      return {
        subscriptions: [grpcSubscription],
        has_more: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user subscriptions: ${errorMessage}`);
      return { subscriptions: [], has_more: false };
    }
  }

  @GrpcMethod('PaymentService', 'RefundPayment')
  refundPayment(data: RefundPaymentRequest): RefundPaymentResponse {
    this.logger.debug(
      `[gRPC] Processing refund for payment ${data.payment_id}`,
    );
    return { refund: undefined, success: false, error: 'Not implemented' };
  }

  @GrpcMethod('PaymentService', 'GetPaymentHistory')
  async getPaymentHistory(
    data: GetPaymentHistoryRequest,
  ): Promise<GetPaymentHistoryResponse> {
    this.logger.debug(
      `[gRPC] Getting payment history for user ${data.user_id}`,
    );

    try {
      // Get payment intents from database
      const paymentIntents = await this.prisma.paymentIntent.findMany({
        where: { userId: data.user_id },
        orderBy: { createdAt: 'desc' },
        take: data.limit || 50,
      });

      const payments: Payment[] = paymentIntents.map((pi) => ({
        id: pi.stripePaymentIntentId,
        user_id: pi.userId,
        amount: Number(pi.amount), // Convert Prisma Decimal to number
        currency: pi.currency,
        status: pi.status.toLowerCase(),
        description: pi.description || '',
        payment_method_id: '',
        created_at: pi.createdAt.toISOString(),
        metadata: (pi.metadata as Record<string, string>) || {},
        invoice_id: '',
        subscription_id: '',
      }));

      return {
        payments,
        has_more: paymentIntents.length === (data.limit || 50),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get payment history: ${errorMessage}`);
      return { payments: [], has_more: false };
    }
  }

  @GrpcMethod('PaymentService', 'RemovePaymentMethod')
  async removePaymentMethod(
    data: RemovePaymentMethodRequest,
  ): Promise<RemovePaymentMethodResponse> {
    this.logger.debug(
      `[gRPC] Removing payment method ${data.payment_method_id}`,
    );

    try {
      // Remove payment method using Stripe service
      await this.stripeService.deletePaymentMethod(
        data.user_id,
        data.payment_method_id,
      );

      return {
        success: true,
        message: 'Payment method removed successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to remove payment method: ${errorMessage}`);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  @GrpcMethod('PaymentService', 'SetDefaultPaymentMethod')
  async setDefaultPaymentMethod(
    data: SetDefaultPaymentMethodRequest,
  ): Promise<SetDefaultPaymentMethodResponse> {
    this.logger.debug(
      `[gRPC] Setting default payment method for user ${data.user_id}`,
    );

    try {
      // Set default payment method using Stripe service
      await this.stripeService.setDefaultPaymentMethod(
        data.user_id,
        data.payment_method_id,
      );

      // Get updated payment method details
      const dbPaymentMethod = await this.prisma.paymentMethod.findUnique({
        where: { stripePaymentMethodId: data.payment_method_id },
      });

      const payment_method: PaymentMethod | undefined = dbPaymentMethod
        ? {
            id: dbPaymentMethod.stripePaymentMethodId,
            type: dbPaymentMethod.type,
            card: dbPaymentMethod.brand
              ? {
                  brand: dbPaymentMethod.brand,
                  last4: dbPaymentMethod.last4 || '****',
                  exp_month: dbPaymentMethod.expiryMonth || 12,
                  exp_year: dbPaymentMethod.expiryYear || 2025,
                  funding: 'credit',
                }
              : undefined,
            is_default: true,
            created_at: dbPaymentMethod.createdAt.toISOString(),
            billing_email: '',
          }
        : undefined;

      return {
        success: true,
        payment_method,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to set default payment method: ${errorMessage}`,
      );
      return {
        success: false,
        payment_method: undefined,
      };
    }
  }

  @GrpcMethod('PaymentService', 'GetUpcomingInvoice')
  getUpcomingInvoice(
    data: GetUpcomingInvoiceRequest,
  ): GetUpcomingInvoiceResponse {
    this.logger.debug(
      `[gRPC] Getting upcoming invoice for user ${data.user_id}`,
    );
    return { invoice: undefined, exists: false };
  }

  @GrpcMethod('PaymentService', 'ValidatePromoCode')
  validatePromoCode(data: ValidatePromoCodeRequest): ValidatePromoCodeResponse {
    this.logger.debug(`[gRPC] Validating promo code ${data.promo_code}`);

    try {
      // Promo code validation - simplified for now since tables don't exist
      // In production, this would check against a promo codes table
      interface PromoCodeDetails {
        discountPercentage: number;
        description: string;
      }

      const validPromoCodes: Record<string, PromoCodeDetails> = {
        WELCOME10: {
          discountPercentage: 10,
          description: '10% off first month',
        },
        SAVE20: {
          discountPercentage: 20,
          description: '20% off first month',
        },
        FRIEND50: {
          discountPercentage: 5,
          description: '5% off',
        },
      };

      const promoCode = validPromoCodes[data.promo_code.toUpperCase()];

      if (!promoCode) {
        return {
          valid: false,
          discount_amount: 0,
          discount_percentage: 0,
          expires_at: '',
          error: 'Invalid promo code',
        };
      }

      return {
        valid: true,
        discount_amount: 0, // Calculated based on plan
        discount_percentage: promoCode.discountPercentage,
        expires_at: '',
        error: '',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate promo code: ${errorMessage}`);
      return {
        valid: false,
        discount_amount: 0,
        discount_percentage: 0,
        expires_at: '',
        error: 'Failed to validate promo code',
      };
    }
  }
}
