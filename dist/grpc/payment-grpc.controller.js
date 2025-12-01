"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PaymentGrpcController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentGrpcController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const rxjs_1 = require("rxjs");
const subscription_service_1 = require("../services/subscription.service");
const stripe_service_1 = require("../services/stripe.service");
const prisma_service_1 = require("../prisma/prisma.service");
let PaymentGrpcController = PaymentGrpcController_1 = class PaymentGrpcController {
    constructor(subscriptionService, stripeService, prisma) {
        this.subscriptionService = subscriptionService;
        this.stripeService = stripeService;
        this.prisma = prisma;
        this.logger = new common_1.Logger(PaymentGrpcController_1.name);
        this.eventStream = new rxjs_1.Subject();
        this.streamCounter = 0;
    }
    async createSubscription(data) {
        this.logger.debug(`[gRPC] Creating subscription for user ${data.user_id} with plan ${data.plan_id}`);
        try {
            const userEmail = `user-${data.user_id}@example.com`;
            await this.stripeService.createOrGetCustomer(data.user_id, userEmail, undefined);
            const result = await this.stripeService.createSubscription(data.user_id, data.plan_id, data.payment_method_id || '');
            const dbSubscription = await this.prisma.subscription.findUnique({
                where: { userId: data.user_id },
            });
            const subscription = {
                id: result.subscriptionId,
                user_id: data.user_id,
                plan_id: data.plan_id,
                status: result.status,
                amount: 0,
                currency: 'usd',
                interval: 'month',
                current_period_start: dbSubscription?.currentPeriodStart?.toISOString() ||
                    new Date().toISOString(),
                current_period_end: result.currentPeriodEnd.toISOString(),
                created_at: new Date().toISOString(),
                cancelled_at: '',
                ends_at: '',
                metadata: data.metadata || {},
                feature_flags: this.getFeatureFlagsForPlan(data.plan_id),
            };
            this.emitPaymentEvent('subscription_created', data.user_id, {
                subscriptionId: subscription.id,
                planId: data.plan_id,
            });
            return {
                subscription,
                client_secret: result.clientSecret || '',
                requires_action: !!result.clientSecret,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to create subscription: ${errorMessage}`);
            throw error;
        }
    }
    async updateSubscription(data) {
        this.logger.debug(`[gRPC] Updating subscription ${data.subscription_id}`);
        try {
            await this.stripeService.updateSubscription(data.user_id, data.new_plan_id, false);
            const dbSubscription = await this.prisma.subscription.findUnique({
                where: { userId: data.user_id },
            });
            if (!dbSubscription) {
                throw new Error('Subscription not found');
            }
            const subscription = {
                id: dbSubscription.stripeSubscriptionId || data.subscription_id,
                user_id: data.user_id,
                plan_id: dbSubscription.planId || data.new_plan_id,
                status: dbSubscription.status.toLowerCase(),
                amount: 0,
                currency: 'usd',
                interval: 'month',
                current_period_start: dbSubscription.currentPeriodStart?.toISOString() ||
                    new Date().toISOString(),
                current_period_end: dbSubscription.currentPeriodEnd?.toISOString() ||
                    new Date().toISOString(),
                created_at: dbSubscription.createdAt.toISOString(),
                cancelled_at: dbSubscription.cancelledAt?.toISOString() || '',
                ends_at: '',
                metadata: {},
                feature_flags: [],
            };
            return {
                subscription,
                proration_amount: 0,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to update subscription: ${errorMessage}`);
            throw error;
        }
    }
    async cancelSubscription(data) {
        this.logger.debug(`[gRPC] Cancelling subscription ${data.subscription_id} for user ${data.user_id}`);
        try {
            await this.stripeService.cancelSubscription(data.user_id, data.cancel_immediately);
            const dbSubscription = await this.prisma.subscription.findUnique({
                where: { userId: data.user_id },
            });
            const now = new Date().toISOString();
            const endsAt = data.cancel_immediately
                ? now
                : dbSubscription?.currentPeriodEnd?.toISOString() ||
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            this.emitPaymentEvent('subscription_cancelled', data.user_id, {
                subscriptionId: data.subscription_id,
                reason: data.cancellation_reason || 'user_requested',
            });
            return {
                success: true,
                cancelled_at: dbSubscription?.cancelledAt?.toISOString() || now,
                ends_at: endsAt,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to cancel subscription: ${errorMessage}`);
            throw error;
        }
    }
    async getSubscription(data) {
        this.logger.debug(`[gRPC] Getting subscription ${data.subscription_id}`);
        try {
            const dbSubscription = await this.prisma.subscription.findUnique({
                where: { userId: data.user_id },
            });
            if (!dbSubscription) {
                throw new Error('Subscription not found');
            }
            const features = this.subscriptionService.getSubscriptionFeatures(dbSubscription.subscriptionTier);
            const subscription = {
                id: dbSubscription.stripeSubscriptionId || data.subscription_id,
                user_id: data.user_id,
                plan_id: dbSubscription.planId ||
                    dbSubscription.subscriptionTier.toLowerCase(),
                status: dbSubscription.status.toLowerCase(),
                amount: this.getPlanAmount(dbSubscription.subscriptionTier),
                currency: 'usd',
                interval: 'month',
                current_period_start: dbSubscription.currentPeriodStart?.toISOString() ||
                    new Date().toISOString(),
                current_period_end: dbSubscription.currentPeriodEnd?.toISOString() ||
                    new Date().toISOString(),
                created_at: dbSubscription.createdAt.toISOString(),
                cancelled_at: dbSubscription.cancelledAt?.toISOString() || '',
                ends_at: '',
                metadata: {},
                feature_flags: this.extractFeatureFlags(features),
            };
            return { subscription };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to get subscription: ${errorMessage}`);
            throw error;
        }
    }
    async processPayment(data) {
        this.logger.debug(`[gRPC] Processing payment of ${data.amount} ${data.currency} for user ${data.user_id}`);
        try {
            const paymentIntent = await this.stripeService.createPaymentIntent(data.user_id, 'one_time_payment', data.payment_method_id, data.currency);
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
            const payment = {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to process payment: ${errorMessage}`);
            return {
                payment: undefined,
                client_secret: '',
                requires_action: false,
                error: errorMessage,
            };
        }
    }
    async addPaymentMethod(data) {
        this.logger.debug(`[gRPC] Adding payment method for user ${data.user_id}`);
        try {
            await this.stripeService.createSetupIntent(data.user_id);
            if (data.payment_method_id) {
                if (data.set_as_default) {
                    await this.stripeService.setDefaultPaymentMethod(data.user_id, data.payment_method_id);
                }
                const dbPaymentMethod = await this.prisma.paymentMethod.findUnique({
                    where: { stripePaymentMethodId: data.payment_method_id },
                });
                if (dbPaymentMethod) {
                    const card = dbPaymentMethod.brand
                        ? {
                            brand: dbPaymentMethod.brand,
                            last4: dbPaymentMethod.last4 || '****',
                            exp_month: dbPaymentMethod.expiryMonth || 12,
                            exp_year: dbPaymentMethod.expiryYear || 2025,
                            funding: 'credit',
                        }
                        : undefined;
                    const paymentMethod = {
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
            return {
                payment_method: undefined,
                success: true,
                error: '',
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to add payment method: ${errorMessage}`);
            return {
                payment_method: undefined,
                success: false,
                error: errorMessage,
            };
        }
    }
    async getPaymentMethods(data) {
        this.logger.debug(`[gRPC] Getting payment methods for user ${data.user_id}`);
        try {
            const dbPaymentMethods = await this.stripeService.getPaymentMethods(data.user_id);
            const payment_methods = dbPaymentMethods.map((pm) => {
                const card = pm.brand
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to get payment methods: ${errorMessage}`);
            throw error;
        }
    }
    getPricingPlans(data) {
        this.logger.debug(`[gRPC] Getting pricing plans for currency ${data.currency || 'usd'}`);
        try {
            const stripePlans = this.stripeService.getAvailablePlans();
            const plans = Object.values(stripePlans).map((plan) => {
                const features = this.subscriptionService.getSubscriptionFeatures(plan.tier);
                return {
                    id: plan.id,
                    name: plan.name,
                    tier: plan.tier,
                    monthly_price: plan.price / 100,
                    yearly_price: (plan.price * 12 * 0.85) / 100,
                    currency: data.currency || 'usd',
                    features: this.getPlanFeatureList(features),
                    limits: {
                        daily_likes: features.dailyLikes,
                        daily_messages: features.dailyUnmatchedMessages,
                        super_likes: features.profileBoostCount,
                        max_photos: features.maxPhotos,
                        call_duration: features.maxCallDuration,
                    },
                    has_trial: false,
                    trial_days: 0,
                    stripe_monthly_price_id: plan.stripePriceId,
                    stripe_yearly_price_id: plan.stripePriceId + '_yearly',
                };
            });
            return {
                plans,
                currency: data.currency || 'usd',
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to get pricing plans: ${errorMessage}`);
            throw error;
        }
    }
    async getInvoices(data) {
        this.logger.debug(`[gRPC] Getting invoices for user ${data.user_id}`);
        try {
            const billingHistory = await this.stripeService.getBillingHistory(data.user_id);
            const invoices = billingHistory.map((bill) => {
                const amountInCents = Number(bill.amount);
                const amountInDollars = amountInCents / 100;
                const lineItem = {
                    description: bill.description || 'Subscription',
                    amount: amountInDollars,
                    quantity: 1,
                    period_start: bill.periodStart.toISOString(),
                    period_end: bill.periodEnd.toISOString(),
                };
                return {
                    id: bill.stripeInvoiceId,
                    subscription_id: '',
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to get invoices: ${errorMessage}`);
            throw error;
        }
    }
    async processStripeWebhook(data) {
        this.logger.debug(`[gRPC] Processing Stripe webhook: ${data.event_type}`);
        try {
            let processed = false;
            let message = '';
            switch (data.event_type) {
                case 'payment_intent.succeeded':
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to process webhook: ${errorMessage}`);
            return {
                processed: false,
                message: '',
                error: errorMessage,
            };
        }
    }
    getPaymentHealth(data) {
        this.logger.debug('[gRPC] Getting payment service health');
        const response = {
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
                mrr: 18750.0,
                transactions_by_type: {
                    subscription_creation: '450',
                    subscription_renewal: '800',
                    one_time_payment: '200',
                },
            };
        }
        return response;
    }
    streamPaymentEvents(data) {
        this.logger.log(`[gRPC] Starting payment event stream for service ${data.service_id}`);
        return new rxjs_1.Observable((observer) => {
            const subscription = this.eventStream.subscribe({
                next: (event) => {
                    if (data.user_id && event.user_id !== data.user_id) {
                        return;
                    }
                    if (data.event_types && data.event_types.length > 0) {
                        if (!data.event_types.includes(event.event_type)) {
                            return;
                        }
                    }
                    observer.next(event);
                },
                error: (err) => observer.error(err),
                complete: () => observer.complete(),
            });
            this.emitPaymentEvent('stream_connected', '', {
                serviceId: data.service_id,
                streamId: `stream-${++this.streamCounter}`,
            });
            return () => {
                subscription.unsubscribe();
                this.logger.log(`[gRPC] Payment event stream disconnected for service ${data.service_id}`);
            };
        });
    }
    emitPaymentEvent(eventType, userId, data) {
        const event = {
            event_id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            event_type: eventType,
            user_id: userId || '',
            data: data || {},
            timestamp: new Date().toISOString(),
            source: 'payment-service',
        };
        this.eventStream.next(event);
    }
    getFeatureFlagsForPlan(planId) {
        const planFeatureMap = {
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
    getPlanAmount(tier) {
        const tierPricing = {
            DISCOVER: 0,
            CONNECT: 9.99,
            COMMUNITY: 19.99,
        };
        return tierPricing[tier] || 0;
    }
    extractFeatureFlags(features) {
        const flags = [];
        if (features.unlimitedLikes)
            flags.push('unlimited_likes');
        if (features.seeWhoLikedYou)
            flags.push('see_who_liked_you');
        if (features.advancedFilters)
            flags.push('advanced_filters');
        if (features.canMakeAudioCalls)
            flags.push('audio_calls');
        if (features.canMakeVideoCalls)
            flags.push('video_calls');
        if (features.voiceMessages)
            flags.push('voice_messages');
        if (features.videoMessages)
            flags.push('video_messages');
        if (features.travelMode)
            flags.push('travel_mode');
        if (features.incognitoMode)
            flags.push('incognito_mode');
        if (features.supportPriority === 'priority' ||
            features.supportPriority === 'vip') {
            flags.push('priority_support');
        }
        return flags;
    }
    getPlanFeatureList(features) {
        const featureList = [];
        if (features.unlimitedLikes) {
            featureList.push('Unlimited likes');
        }
        else {
            featureList.push(`${features.dailyLikes} likes per day`);
        }
        if (features.seeWhoLikedYou)
            featureList.push('See who liked you');
        if (features.canMakeAudioCalls)
            featureList.push('Audio calls');
        if (features.canMakeVideoCalls)
            featureList.push('Video calls');
        if (features.voiceMessages)
            featureList.push('Voice messages');
        if (features.videoMessages)
            featureList.push('Video messages');
        if (features.advancedFilters)
            featureList.push('Advanced filters');
        if (features.travelMode)
            featureList.push('Travel mode');
        if (features.incognitoMode)
            featureList.push('Incognito browsing');
        if (features.supportPriority === 'priority') {
            featureList.push('Priority support');
        }
        else if (features.supportPriority === 'vip') {
            featureList.push('VIP support');
        }
        return featureList;
    }
    async getUserSubscriptions(data) {
        this.logger.debug(`[gRPC] Getting subscriptions for user ${data.user_id}`);
        try {
            const subscription = await this.subscriptionService.getUserSubscription(data.user_id);
            const features = this.subscriptionService.getSubscriptionFeatures(subscription.subscriptionTier);
            const subscriptionCreatedAt = 'createdAt' in subscription && subscription.createdAt instanceof Date
                ? subscription.createdAt.toISOString()
                : new Date().toISOString();
            const grpcSubscription = {
                id: ('stripeSubscriptionId' in subscription
                    ? subscription.stripeSubscriptionId
                    : null) || `sub_${data.user_id}`,
                user_id: data.user_id,
                plan_id: ('planId' in subscription ? subscription.planId : null) ||
                    subscription.subscriptionTier.toLowerCase(),
                status: subscription.status?.toLowerCase() || 'active',
                amount: this.getPlanAmount(subscription.subscriptionTier),
                currency: 'usd',
                interval: 'month',
                current_period_start: subscription.currentPeriodStart?.toISOString() ||
                    new Date().toISOString(),
                current_period_end: subscription.currentPeriodEnd?.toISOString() ||
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to get user subscriptions: ${errorMessage}`);
            return { subscriptions: [], has_more: false };
        }
    }
    refundPayment(data) {
        this.logger.debug(`[gRPC] Processing refund for payment ${data.payment_id}`);
        return { refund: undefined, success: false, error: 'Not implemented' };
    }
    async getPaymentHistory(data) {
        this.logger.debug(`[gRPC] Getting payment history for user ${data.user_id}`);
        try {
            const paymentIntents = await this.prisma.paymentIntent.findMany({
                where: { userId: data.user_id },
                orderBy: { createdAt: 'desc' },
                take: data.limit || 50,
            });
            const payments = paymentIntents.map((pi) => ({
                id: pi.stripePaymentIntentId,
                user_id: pi.userId,
                amount: Number(pi.amount),
                currency: pi.currency,
                status: pi.status.toLowerCase(),
                description: pi.description || '',
                payment_method_id: '',
                created_at: pi.createdAt.toISOString(),
                metadata: pi.metadata || {},
                invoice_id: '',
                subscription_id: '',
            }));
            return {
                payments,
                has_more: paymentIntents.length === (data.limit || 50),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to get payment history: ${errorMessage}`);
            return { payments: [], has_more: false };
        }
    }
    async removePaymentMethod(data) {
        this.logger.debug(`[gRPC] Removing payment method ${data.payment_method_id}`);
        try {
            await this.stripeService.deletePaymentMethod(data.user_id, data.payment_method_id);
            return {
                success: true,
                message: 'Payment method removed successfully',
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to remove payment method: ${errorMessage}`);
            return {
                success: false,
                message: errorMessage,
            };
        }
    }
    async setDefaultPaymentMethod(data) {
        this.logger.debug(`[gRPC] Setting default payment method for user ${data.user_id}`);
        try {
            await this.stripeService.setDefaultPaymentMethod(data.user_id, data.payment_method_id);
            const dbPaymentMethod = await this.prisma.paymentMethod.findUnique({
                where: { stripePaymentMethodId: data.payment_method_id },
            });
            const payment_method = dbPaymentMethod
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to set default payment method: ${errorMessage}`);
            return {
                success: false,
                payment_method: undefined,
            };
        }
    }
    getUpcomingInvoice(data) {
        this.logger.debug(`[gRPC] Getting upcoming invoice for user ${data.user_id}`);
        return { invoice: undefined, exists: false };
    }
    validatePromoCode(data) {
        this.logger.debug(`[gRPC] Validating promo code ${data.promo_code}`);
        try {
            const validPromoCodes = {
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
                discount_amount: 0,
                discount_percentage: promoCode.discountPercentage,
                expires_at: '',
                error: '',
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
};
exports.PaymentGrpcController = PaymentGrpcController;
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'CreateSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "createSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'UpdateSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "updateSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'CancelSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "cancelSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'ProcessPayment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "processPayment", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'AddPaymentMethod'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "addPaymentMethod", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetPaymentMethods'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getPaymentMethods", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetPricingPlans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], PaymentGrpcController.prototype, "getPricingPlans", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetInvoices'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getInvoices", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'ProcessStripeWebhook'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "processStripeWebhook", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetPaymentHealth'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], PaymentGrpcController.prototype, "getPaymentHealth", null);
__decorate([
    (0, microservices_1.GrpcStreamMethod)('PaymentService', 'StreamPaymentEvents'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", rxjs_1.Observable)
], PaymentGrpcController.prototype, "streamPaymentEvents", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetUserSubscriptions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getUserSubscriptions", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'RefundPayment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], PaymentGrpcController.prototype, "refundPayment", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetPaymentHistory'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getPaymentHistory", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'RemovePaymentMethod'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "removePaymentMethod", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'SetDefaultPaymentMethod'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "setDefaultPaymentMethod", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetUpcomingInvoice'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], PaymentGrpcController.prototype, "getUpcomingInvoice", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'ValidatePromoCode'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], PaymentGrpcController.prototype, "validatePromoCode", null);
exports.PaymentGrpcController = PaymentGrpcController = PaymentGrpcController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [subscription_service_1.SubscriptionService,
        stripe_service_1.StripeService,
        prisma_service_1.PrismaService])
], PaymentGrpcController);
//# sourceMappingURL=payment-grpc.controller.js.map