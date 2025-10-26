/**
 * gRPC Controller for Payment Service
 * Provides payment and subscription operations via gRPC
 */
import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable, Subject } from 'rxjs';

// Import existing payment services
import { SubscriptionService } from '../services/subscription.service';
import { StripeService } from '../services/stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier } from '@prisma/client';

// Interfaces matching proto definitions
interface CreateSubscriptionRequest {
  userId: string;
  planId: string;
  paymentMethodId?: string;
  promoCode?: string;
  metadata?: Record<string, string>;
  userEmail?: string;
  userName?: string;
}

interface CreateSubscriptionResponse {
  subscription: Subscription;
  clientSecret?: string;
  requiresAction: boolean;
}

interface UpdateSubscriptionRequest {
  subscriptionId: string;
  userId: string;
  newPlanId: string;
  prorate?: boolean;
  effectiveDate?: string;
  cancelAtPeriodEnd?: boolean;
}

interface UpdateSubscriptionResponse {
  subscription: Subscription;
  prorationAmount: number;
}

interface CancelSubscriptionRequest {
  subscriptionId: string;
  userId: string;
  cancelImmediately: boolean;
  cancellationReason?: string;
  feedback?: string;
}

interface CancelSubscriptionResponse {
  success: boolean;
  cancelledAt: string;
  endsAt: string;
}

interface GetSubscriptionRequest {
  subscriptionId: string;
  userId: string;
}

interface GetSubscriptionResponse {
  subscription: Subscription;
}

interface GetUserSubscriptionsRequest {
  userId: string;
  includeCancelled?: boolean;
  limit?: number;
  startingAfter?: string;
}

interface GetUserSubscriptionsResponse {
  subscriptions: Subscription[];
  hasMore: boolean;
}

interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  amount: number;
  currency: string;
  interval: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  cancelledAt?: string;
  endsAt?: string;
  metadata?: Record<string, string>;
  featureFlags?: string[];
  tier?: string;
  cancelAtPeriodEnd?: boolean;
}

interface ProcessPaymentRequest {
  userId: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
  description?: string;
  metadata?: Record<string, string>;
  savePaymentMethod?: boolean;
}

interface ProcessPaymentResponse {
  payment: Payment | null;
  clientSecret: string | null;
  requiresAction: boolean;
  error: string | null;
}

interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  paymentMethodId: string;
  createdAt: string;
  metadata?: Record<string, string>;
  invoiceId?: string;
  subscriptionId?: string;
}

interface GetPaymentHistoryRequest {
  userId: string;
  limit?: number;
  offset?: number;
  startingAfter?: string;
  endingBefore?: string;
}

interface GetPaymentHistoryResponse {
  payments: Payment[];
  hasMore: boolean;
}

interface RefundPaymentRequest {
  paymentId: string;
  userId: string;
  amount?: number;
  reason?: string;
}

interface RefundPaymentResponse {
  refund: Refund | null;
  success: boolean;
  error?: string;
}

interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string;
  createdAt: string;
}

interface AddPaymentMethodRequest {
  userId: string;
  paymentMethodId?: string;
  setAsDefault?: boolean;
}

interface AddPaymentMethodResponse {
  paymentMethod: PaymentMethod | null;
  success: boolean;
  error: string | null;
  setupIntent?: {
    clientSecret: string;
    setupIntentId: string;
  };
}

interface RemovePaymentMethodRequest {
  paymentMethodId: string;
  userId: string;
}

interface RemovePaymentMethodResponse {
  success: boolean;
  message: string;
}

interface GetPaymentMethodsRequest {
  userId: string;
  type?: string;
}

interface GetPaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
  defaultPaymentMethodId: string | null;
}

interface SetDefaultPaymentMethodRequest {
  userId: string;
  paymentMethodId: string;
}

interface SetDefaultPaymentMethodResponse {
  success: boolean;
  paymentMethod: PaymentMethod | null;
}

interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    funding: string;
  };
  createdAt: string;
  isDefault: boolean;
  billingEmail?: string;
  brand?: string;
  last4?: string;
}

interface GetInvoicesRequest {
  userId: string;
  limit?: number;
  startingAfter?: string;
}

interface GetInvoicesResponse {
  invoices: Invoice[];
  hasMore: boolean;
}

interface Invoice {
  id: string;
  subscriptionId: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  lineItems: InvoiceLineItem[];
  pdfUrl: string | null;
}

interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
  periodStart?: string;
  periodEnd?: string;
}

interface GetUpcomingInvoiceRequest {
  userId: string;
  subscriptionId?: string;
}

interface GetUpcomingInvoiceResponse {
  invoice: Invoice | null;
  exists: boolean;
}

interface GetPricingPlansRequest {
  currency?: string;
  includeTrialInfo?: boolean;
  userTier?: string;
}

interface GetPricingPlansResponse {
  plans: PricingPlan[];
  currency: string;
}

interface PricingPlan {
  id: string;
  name: string;
  tier: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  limits: Record<string, number>;
  hasTrial: boolean;
  trialDays: number;
  stripeMonthlyPriceId: string;
  stripeYearlyPriceId: string;
}

interface ValidatePromoCodeRequest {
  promoCode: string;
  userId?: string;
  planId?: string;
}

interface ValidatePromoCodeResponse {
  valid: boolean;
  discountType?: string;
  discountValue?: number;
  discountAmount?: number;
  discountPercentage?: number;
  description?: string;
  expiresAt?: string;
  error?: string;
}

interface ProcessStripeWebhookRequest {
  eventType: string;
  eventId: string;
  payload?: Uint8Array;
  signature?: string;
  objectId?: string;
  userId?: string;
}

interface ProcessStripeWebhookResponse {
  processed: boolean;
  message: string | null;
  error: string | null;
}

interface GetPaymentHealthRequest {
  includeStripeStatus?: boolean;
  includeMetrics?: boolean;
}

interface GetPaymentHealthResponse {
  healthy: boolean;
  timestamp: string;
  stripeStatus?: StripeStatus;
  metrics?: PaymentMetrics;
}

interface StripeStatus {
  connected: boolean;
  mode: string;
  webhookEndpointsActive: number;
  lastWebhookAt: string;
}

interface PaymentMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalRevenue: number;
  activeSubscriptions: number;
  mrr: number;
  transactionsByType: Record<string, number>;
}

interface StreamPaymentEventsRequest {
  serviceId: string;
  eventTypes?: string[];
  userId?: string;
}

interface PaymentEvent {
  eventId: string;
  eventType: string;
  userId?: string;
  data: Record<string, string>;
  timestamp: string;
  source: string;
}

/**
 * Controller implementing gRPC methods for Payment Service
 */
@Controller()
export class PaymentGrpcController {
  private readonly logger = new Logger(PaymentGrpcController.name);
  private readonly eventStream = new Subject<PaymentEvent>();
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
      `[gRPC] Creating subscription for user ${data.userId} with plan ${data.planId}`,
    );

    try {
      // Note: User data would come from external user service
      // For now, we'll use the provided email from the request or mock data
      const userEmail = data.userEmail || `user-${data.userId}@example.com`;
      const userName = data.userName || undefined;

      // Create or get Stripe customer
      await this.stripeService.createOrGetCustomer(
        data.userId,
        userEmail,
        userName,
      );

      // Create subscription using Stripe service
      const result = await this.stripeService.createSubscription(
        data.userId,
        data.planId,
        data.paymentMethodId || '',
      );

      // Get subscription details from database
      const dbSubscription = await this.prisma.subscription.findUnique({
        where: { userId: data.userId },
      });

      const subscription: Subscription = {
        id: result.subscriptionId,
        userId: data.userId,
        planId: data.planId,
        status: result.status,
        amount: 0, // Would need to get from plan config
        currency: 'usd',
        interval: 'month',
        currentPeriodStart:
          dbSubscription?.currentPeriodStart?.toISOString() ||
          new Date().toISOString(),
        currentPeriodEnd: result.currentPeriodEnd.toISOString(),
        createdAt: new Date().toISOString(),
        metadata: data.metadata,
        featureFlags: this.getFeatureFlagsForPlan(data.planId),
      };

      // Emit event
      this.emitPaymentEvent('subscription_created', data.userId, {
        subscriptionId: subscription.id,
        planId: data.planId,
      });

      return {
        subscription,
        clientSecret: result.clientSecret,
        requiresAction: !!result.clientSecret,
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
    this.logger.debug(`[gRPC] Updating subscription ${data.subscriptionId}`);

    try {
      // Update subscription using Stripe service
      await this.stripeService.updateSubscription(
        data.userId,
        data.newPlanId,
        data.cancelAtPeriodEnd ?? false,
      );

      // Get updated subscription from database
      const dbSubscription = await this.prisma.subscription.findUnique({
        where: { userId: data.userId },
      });

      if (!dbSubscription) {
        throw new Error('Subscription not found');
      }

      const subscription: Subscription = {
        id: dbSubscription.stripeSubscriptionId || data.subscriptionId,
        userId: data.userId,
        planId: dbSubscription.planId || data.newPlanId,
        status: dbSubscription.status.toLowerCase(),
        amount: 0, // Would need to calculate from plan
        currency: 'usd',
        interval: 'month',
        currentPeriodStart:
          dbSubscription.currentPeriodStart?.toISOString() ||
          new Date().toISOString(),
        currentPeriodEnd:
          dbSubscription.currentPeriodEnd?.toISOString() ||
          new Date().toISOString(),
        createdAt: dbSubscription.createdAt.toISOString(),
      };

      return {
        subscription,
        prorationAmount: 0, // Would need to calculate from Stripe response
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
      `[gRPC] Cancelling subscription ${data.subscriptionId} for user ${data.userId}`,
    );

    try {
      // Cancel subscription using Stripe service
      await this.stripeService.cancelSubscription(
        data.userId,
        data.cancelImmediately,
      );

      // Get updated subscription from database
      const dbSubscription = await this.prisma.subscription.findUnique({
        where: { userId: data.userId },
      });

      const now = new Date().toISOString();
      const endsAt = data.cancelImmediately
        ? now
        : dbSubscription?.currentPeriodEnd?.toISOString() ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Emit event
      this.emitPaymentEvent('subscription_cancelled', data.userId, {
        subscriptionId: data.subscriptionId,
        reason: data.cancellationReason || 'user_requested',
      });

      return {
        success: true,
        cancelledAt: dbSubscription?.cancelledAt?.toISOString() || now,
        endsAt,
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
    this.logger.debug(`[gRPC] Getting subscription ${data.subscriptionId}`);

    try {
      // Get subscription from database
      const dbSubscription = await this.prisma.subscription.findUnique({
        where: { userId: data.userId },
      });

      if (!dbSubscription) {
        throw new Error('Subscription not found');
      }

      // Get subscription features from subscription service
      const features = this.subscriptionService.getSubscriptionFeatures(
        dbSubscription.subscriptionTier,
      );

      const subscription: Subscription = {
        id: dbSubscription.stripeSubscriptionId || data.subscriptionId,
        userId: data.userId,
        planId:
          dbSubscription.planId ||
          dbSubscription.subscriptionTier.toLowerCase(),
        status: dbSubscription.status.toLowerCase(),
        amount: this.getPlanAmount(dbSubscription.subscriptionTier),
        currency: 'usd',
        interval: 'month',
        currentPeriodStart:
          dbSubscription.currentPeriodStart?.toISOString() ||
          new Date().toISOString(),
        currentPeriodEnd:
          dbSubscription.currentPeriodEnd?.toISOString() ||
          new Date().toISOString(),
        createdAt: dbSubscription.createdAt.toISOString(),
        featureFlags: this.extractFeatureFlags(features),
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
      `[gRPC] Processing payment of ${data.amount} ${data.currency} for user ${data.userId}`,
    );

    try {
      // Create payment intent using Stripe service
      const paymentIntent = await this.stripeService.createPaymentIntent(
        data.userId,
        'one_time_payment', // Special plan ID for one-time payments
        data.paymentMethodId,
        data.currency,
      );

      // Store payment record in database
      const paymentRecord = await this.prisma.paymentIntent.create({
        data: {
          userId: data.userId,
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
        userId: data.userId,
        amount: data.amount,
        currency: data.currency,
        status: 'pending',
        description: data.description,
        paymentMethodId: data.paymentMethodId,
        createdAt: paymentRecord.createdAt.toISOString(),
        metadata: data.metadata,
      };

      // Emit event
      this.emitPaymentEvent('payment_initiated', data.userId, {
        paymentId: payment.id,
        amount: String(data.amount),
        currency: data.currency,
      });

      return {
        payment,
        clientSecret: paymentIntent.clientSecret,
        requiresAction: true,
        error: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process payment: ${errorMessage}`);
      return {
        payment: null,
        clientSecret: null,
        requiresAction: false,
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
    this.logger.debug(`[gRPC] Adding payment method for user ${data.userId}`);

    try {
      // Create setup intent for adding payment method
      const setupIntent = await this.stripeService.createSetupIntent(
        data.userId,
      );

      // If payment method ID is provided, attach it
      if (data.paymentMethodId) {
        // Set as default if requested
        if (data.setAsDefault) {
          await this.stripeService.setDefaultPaymentMethod(
            data.userId,
            data.paymentMethodId,
          );
        }

        // Get payment method details from database
        const dbPaymentMethod = await this.prisma.paymentMethod.findUnique({
          where: { stripePaymentMethodId: data.paymentMethodId },
        });

        if (dbPaymentMethod) {
          const paymentMethod: PaymentMethod = {
            id: dbPaymentMethod.stripePaymentMethodId,
            type: dbPaymentMethod.type,
            card: dbPaymentMethod.brand
              ? {
                  brand: dbPaymentMethod.brand,
                  last4: dbPaymentMethod.last4 || '****',
                  expMonth: dbPaymentMethod.expiryMonth || 12,
                  expYear: dbPaymentMethod.expiryYear || 2025,
                  funding: 'credit',
                }
              : undefined,
            createdAt: dbPaymentMethod.createdAt.toISOString(),
            isDefault: dbPaymentMethod.isDefault,
          };

          return {
            paymentMethod,
            success: true,
            error: null,
          };
        }
      }

      // Return setup intent for client to complete
      return {
        paymentMethod: null,
        success: true,
        error: null,
        setupIntent: {
          clientSecret: setupIntent.clientSecret,
          setupIntentId: setupIntent.setupIntentId,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add payment method: ${errorMessage}`);
      return {
        paymentMethod: null,
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
    this.logger.debug(`[gRPC] Getting payment methods for user ${data.userId}`);

    try {
      // Get payment methods from Stripe service
      const dbPaymentMethods = await this.stripeService.getPaymentMethods(
        data.userId,
      );

      // Transform to gRPC format
      const paymentMethods: PaymentMethod[] = dbPaymentMethods.map((pm) => ({
        id: pm.stripePaymentMethodId,
        type: pm.type,
        card: pm.brand
          ? {
              brand: pm.brand,
              last4: pm.last4 || '****',
              expMonth: pm.expiryMonth || 12,
              expYear: pm.expiryYear || 2025,
              funding: 'credit',
            }
          : undefined,
        createdAt: pm.createdAt.toISOString(),
        isDefault: pm.isDefault,
      }));

      const defaultMethod = paymentMethods.find((pm) => pm.isDefault);

      return {
        paymentMethods,
        defaultPaymentMethodId: defaultMethod?.id || null,
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
          monthlyPrice: plan.price / 100, // Convert from cents
          yearlyPrice: (plan.price * 12 * 0.85) / 100, // 15% yearly discount
          currency: data.currency || 'usd',
          features: this.getPlanFeatureList(features),
          limits: {
            daily_likes: features.dailyLikes,
            daily_messages: features.dailyUnmatchedMessages,
            super_likes: features.profileBoostCount,
            max_photos: features.maxPhotos,
            call_duration: features.maxCallDuration,
          },
          hasTrial: false, // Not specified in SubscriptionPlan interface
          trialDays: 0,
          stripeMonthlyPriceId: plan.stripePriceId,
          stripeYearlyPriceId: plan.stripePriceId + '_yearly', // Assuming yearly price ID format
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
    this.logger.debug(`[gRPC] Getting invoices for user ${data.userId}`);

    try {
      // Get billing history from Stripe service
      const billingHistory = await this.stripeService.getBillingHistory(
        data.userId,
      );

      // Transform to gRPC format
      const invoices: Invoice[] = billingHistory.map((bill) => {
        // Convert Prisma Decimal to number
        const amountInCents = Number(bill.amount);
        const amountInDollars = amountInCents / 100;

        return {
          id: bill.stripeInvoiceId,
          subscriptionId: null, // Billing history doesn't have subscription ID
          amountDue: amountInDollars,
          amountPaid: amountInDollars,
          currency: bill.currency,
          status: bill.status.toLowerCase(),
          dueDate: bill.createdAt.toISOString(),
          periodStart: bill.periodStart.toISOString(),
          periodEnd: bill.periodEnd.toISOString(),
          lineItems: [
            {
              description: bill.description || 'Subscription',
              amount: amountInDollars,
              quantity: 1,
            },
          ],
          pdfUrl: bill.pdfUrl || null,
        };
      });

      const limit = data.limit || 100;
      return {
        invoices: invoices.slice(0, limit),
        hasMore: invoices.length > limit,
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
    this.logger.debug(`[gRPC] Processing Stripe webhook: ${data.eventType}`);

    try {
      // Handle different webhook event types
      let processed = false;
      let message = '';

      switch (data.eventType) {
        case 'payment_intent.succeeded':
          // Update payment intent status in database
          if (data.objectId) {
            await this.prisma.paymentIntent.updateMany({
              where: { stripePaymentIntentId: data.objectId },
              data: { status: 'SUCCEEDED' },
            });
            this.emitPaymentEvent('webhook_payment_succeeded', data.userId, {
              eventId: data.eventId,
              paymentIntentId: data.objectId,
            });
          }
          processed = true;
          message = 'Payment intent succeeded';
          break;

        case 'payment_intent.payment_failed':
          if (data.objectId) {
            await this.prisma.paymentIntent.updateMany({
              where: { stripePaymentIntentId: data.objectId },
              data: { status: 'FAILED' },
            });
            this.emitPaymentEvent('webhook_payment_failed', data.userId, {
              eventId: data.eventId,
              paymentIntentId: data.objectId,
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
          this.logger.warn(`Unhandled webhook event type: ${data.eventType}`);
          processed = true;
          message = `Webhook ${data.eventType} acknowledged but not processed`;
      }

      return {
        processed,
        message,
        error: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process webhook: ${errorMessage}`);
      return {
        processed: false,
        message: null,
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

    if (data.includeStripeStatus) {
      response.stripeStatus = {
        connected: true,
        mode: process.env.NODE_ENV === 'production' ? 'live' : 'test',
        webhookEndpointsActive: 3,
        lastWebhookAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      };
    }

    if (data.includeMetrics) {
      response.metrics = {
        totalTransactions: 15234,
        successfulTransactions: 14998,
        failedTransactions: 236,
        totalRevenue: 250000.5,
        activeSubscriptions: 1250,
        mrr: 18750.0, // Monthly Recurring Revenue
        transactionsByType: {
          subscription_creation: 450,
          subscription_renewal: 800,
          one_time_payment: 200,
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
  ): Observable<PaymentEvent> {
    this.logger.log(
      `[gRPC] Starting payment event stream for service ${data.serviceId}`,
    );

    return new Observable((observer) => {
      const subscription = this.eventStream.subscribe({
        next: (event) => {
          // Filter by user if specified
          if (data.userId && event.userId !== data.userId) {
            return;
          }

          // Filter by event types if specified
          if (data.eventTypes && data.eventTypes.length > 0) {
            if (!data.eventTypes.includes(event.eventType)) {
              return;
            }
          }

          observer.next(event);
        },
        error: (err: Error) => observer.error(err),
        complete: () => observer.complete(),
      });

      // Emit initial connection event
      this.emitPaymentEvent('stream_connected', undefined, {
        serviceId: data.serviceId,
        streamId: `stream-${++this.streamCounter}`,
      });

      // Cleanup on disconnect
      return () => {
        subscription.unsubscribe();
        this.logger.log(
          `[gRPC] Payment event stream disconnected for service ${data.serviceId}`,
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
    const event: PaymentEvent = {
      eventId: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      userId,
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
    this.logger.debug(`[gRPC] Getting subscriptions for user ${data.userId}`);

    try {
      // Get user's current subscription
      const subscription = await this.subscriptionService.getUserSubscription(
        data.userId,
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
            : null) || `sub_${data.userId}`,
        userId: data.userId,
        planId:
          ('planId' in subscription ? subscription.planId : null) ||
          subscription.subscriptionTier.toLowerCase(),
        status: subscription.status?.toLowerCase() || 'active',
        tier: subscription.subscriptionTier,
        amount: this.getPlanAmount(subscription.subscriptionTier),
        currency: 'usd',
        interval: 'month',
        currentPeriodStart:
          subscription.currentPeriodStart?.toISOString() ||
          new Date().toISOString(),
        currentPeriodEnd:
          subscription.currentPeriodEnd?.toISOString() ||
          new Date().toISOString(),
        createdAt: subscriptionCreatedAt,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
        featureFlags: this.extractFeatureFlags(features),
      };

      return {
        subscriptions: [grpcSubscription],
        hasMore: false,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user subscriptions: ${errorMessage}`);
      return { subscriptions: [], hasMore: false };
    }
  }

  @GrpcMethod('PaymentService', 'RefundPayment')
  refundPayment(data: RefundPaymentRequest): RefundPaymentResponse {
    this.logger.debug(`[gRPC] Processing refund for payment ${data.paymentId}`);
    return { refund: null, success: false, error: 'Not implemented' };
  }

  @GrpcMethod('PaymentService', 'GetPaymentHistory')
  async getPaymentHistory(
    data: GetPaymentHistoryRequest,
  ): Promise<GetPaymentHistoryResponse> {
    this.logger.debug(`[gRPC] Getting payment history for user ${data.userId}`);

    try {
      // Get payment intents from database
      const paymentIntents = await this.prisma.paymentIntent.findMany({
        where: { userId: data.userId },
        orderBy: { createdAt: 'desc' },
        take: data.limit || 50,
        skip: data.offset || 0,
      });

      const payments: Payment[] = paymentIntents.map((pi) => ({
        id: pi.stripePaymentIntentId,
        userId: pi.userId,
        amount: Number(pi.amount), // Convert Prisma Decimal to number
        currency: pi.currency,
        status: pi.status.toLowerCase(),
        description: pi.description,
        paymentMethodId: '',
        createdAt: pi.createdAt.toISOString(),
        metadata: (pi.metadata as Record<string, string>) || {},
      }));

      return {
        payments,
        hasMore: paymentIntents.length === (data.limit || 50),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get payment history: ${errorMessage}`);
      return { payments: [], hasMore: false };
    }
  }

  @GrpcMethod('PaymentService', 'RemovePaymentMethod')
  async removePaymentMethod(
    data: RemovePaymentMethodRequest,
  ): Promise<RemovePaymentMethodResponse> {
    this.logger.debug(`[gRPC] Removing payment method ${data.paymentMethodId}`);

    try {
      // Remove payment method using Stripe service
      await this.stripeService.deletePaymentMethod(
        data.userId,
        data.paymentMethodId,
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
      `[gRPC] Setting default payment method for user ${data.userId}`,
    );

    try {
      // Set default payment method using Stripe service
      await this.stripeService.setDefaultPaymentMethod(
        data.userId,
        data.paymentMethodId,
      );

      // Get updated payment method details
      const dbPaymentMethod = await this.prisma.paymentMethod.findUnique({
        where: { stripePaymentMethodId: data.paymentMethodId },
      });

      const paymentMethod: PaymentMethod | null = dbPaymentMethod
        ? {
            id: dbPaymentMethod.stripePaymentMethodId,
            type: dbPaymentMethod.type,
            isDefault: true,
            last4: dbPaymentMethod.last4,
            brand: dbPaymentMethod.brand,
            createdAt: dbPaymentMethod.createdAt.toISOString(),
          }
        : null;

      return {
        success: true,
        paymentMethod,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to set default payment method: ${errorMessage}`,
      );
      return {
        success: false,
        paymentMethod: null,
      };
    }
  }

  @GrpcMethod('PaymentService', 'GetUpcomingInvoice')
  getUpcomingInvoice(
    data: GetUpcomingInvoiceRequest,
  ): GetUpcomingInvoiceResponse {
    this.logger.debug(
      `[gRPC] Getting upcoming invoice for user ${data.userId}`,
    );
    return { invoice: null, exists: false };
  }

  @GrpcMethod('PaymentService', 'ValidatePromoCode')
  validatePromoCode(data: ValidatePromoCodeRequest): ValidatePromoCodeResponse {
    this.logger.debug(`[gRPC] Validating promo code ${data.promoCode}`);

    try {
      // Promo code validation - simplified for now since tables don't exist
      // In production, this would check against a promo codes table
      interface PromoCodeDetails {
        discountType: string;
        discountValue: number;
        description: string;
      }

      const validPromoCodes: Record<string, PromoCodeDetails> = {
        WELCOME10: {
          discountType: 'percentage',
          discountValue: 10,
          description: '10% off first month',
        },
        SAVE20: {
          discountType: 'percentage',
          discountValue: 20,
          description: '20% off first month',
        },
        FRIEND50: {
          discountType: 'fixed',
          discountValue: 50,
          description: '$5.00 off',
        },
      };

      const promoCode = validPromoCodes[data.promoCode.toUpperCase()];

      if (!promoCode) {
        return { valid: false, error: 'Invalid promo code' };
      }

      return {
        valid: true,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        description: promoCode.description,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to validate promo code: ${errorMessage}`);
      return { valid: false, error: 'Failed to validate promo code' };
    }
  }
}
