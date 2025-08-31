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
const grpc_js_1 = require("@grpc/grpc-js");
const rxjs_1 = require("rxjs");
const subscription_service_1 = require("../services/subscription.service");
const stripe_service_1 = require("../services/stripe.service");
const prisma_service_1 = require("../prisma/prisma.service");
let PaymentGrpcController = PaymentGrpcController_1 = class PaymentGrpcController {
    subscriptionService;
    stripeService;
    prisma;
    logger = new common_1.Logger(PaymentGrpcController_1.name);
    eventStream = new rxjs_1.Subject();
    streamCounter = 0;
    constructor(subscriptionService, stripeService, prisma) {
        this.subscriptionService = subscriptionService;
        this.stripeService = stripeService;
        this.prisma = prisma;
    }
    async createSubscription(data, metadata, call) {
        this.logger.debug(`[gRPC] Creating subscription for user ${data.userId} with plan ${data.planId}`);
        try {
            const userEmail = data.userEmail || `user-${data.userId}@example.com`;
            const userName = data.userName || undefined;
            await this.stripeService.createOrGetCustomer(data.userId, userEmail, userName);
            const result = await this.stripeService.createSubscription(data.userId, data.planId, data.paymentMethodId || '');
            const dbSubscription = await this.prisma.userSubscription.findUnique({
                where: { userId: data.userId },
            });
            const subscription = {
                id: result.subscriptionId,
                userId: data.userId,
                planId: data.planId,
                status: result.status,
                amount: 0,
                currency: 'usd',
                interval: 'month',
                currentPeriodStart: dbSubscription?.currentPeriodStart?.toISOString() || new Date().toISOString(),
                currentPeriodEnd: result.currentPeriodEnd.toISOString(),
                createdAt: new Date().toISOString(),
                metadata: data.metadata,
                featureFlags: this.getFeatureFlagsForPlan(data.planId),
            };
            this.emitPaymentEvent('subscription_created', data.userId, {
                subscriptionId: subscription.id,
                planId: data.planId,
            });
            return {
                subscription,
                clientSecret: result.clientSecret,
                requiresAction: !!result.clientSecret,
            };
        }
        catch (error) {
            this.logger.error(`Failed to create subscription: ${error.message}`);
            throw error;
        }
    }
    async updateSubscription(data, metadata) {
        this.logger.debug(`[gRPC] Updating subscription ${data.subscriptionId}`);
        try {
            const updatedStripeSubscription = await this.stripeService.updateSubscription(data.userId, data.newPlanId, data.cancelAtPeriodEnd);
            const dbSubscription = await this.prisma.userSubscription.findUnique({
                where: { userId: data.userId },
            });
            if (!dbSubscription) {
                throw new Error('Subscription not found');
            }
            return {
                subscription: {
                    id: dbSubscription.stripeSubscriptionId || data.subscriptionId,
                    userId: data.userId,
                    planId: dbSubscription.planId || data.newPlanId,
                    status: dbSubscription.status.toLowerCase(),
                    amount: 0,
                    currency: 'usd',
                    interval: 'month',
                    currentPeriodStart: dbSubscription.currentPeriodStart?.toISOString() || new Date().toISOString(),
                    currentPeriodEnd: dbSubscription.currentPeriodEnd?.toISOString() || new Date().toISOString(),
                    createdAt: dbSubscription.createdAt.toISOString(),
                },
                prorationAmount: 0,
            };
        }
        catch (error) {
            this.logger.error(`Failed to update subscription: ${error.message}`);
            throw error;
        }
    }
    async cancelSubscription(data, metadata) {
        this.logger.debug(`[gRPC] Cancelling subscription ${data.subscriptionId} for user ${data.userId}`);
        try {
            await this.stripeService.cancelSubscription(data.userId, data.cancelImmediately);
            const dbSubscription = await this.prisma.userSubscription.findUnique({
                where: { userId: data.userId },
            });
            const now = new Date().toISOString();
            const endsAt = data.cancelImmediately
                ? now
                : dbSubscription?.currentPeriodEnd?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            this.emitPaymentEvent('subscription_cancelled', data.userId, {
                subscriptionId: data.subscriptionId,
                reason: data.cancellationReason || 'user_requested',
            });
            return {
                success: true,
                cancelledAt: dbSubscription?.cancelledAt?.toISOString() || now,
                endsAt,
            };
        }
        catch (error) {
            this.logger.error(`Failed to cancel subscription: ${error.message}`);
            throw error;
        }
    }
    async getSubscription(data, metadata) {
        this.logger.debug(`[gRPC] Getting subscription ${data.subscriptionId}`);
        try {
            const dbSubscription = await this.prisma.userSubscription.findUnique({
                where: { userId: data.userId },
            });
            if (!dbSubscription) {
                throw new Error('Subscription not found');
            }
            const features = this.subscriptionService.getSubscriptionFeatures(dbSubscription.subscriptionTier);
            return {
                subscription: {
                    id: dbSubscription.stripeSubscriptionId || data.subscriptionId,
                    userId: data.userId,
                    planId: dbSubscription.planId || dbSubscription.subscriptionTier.toLowerCase(),
                    status: dbSubscription.status.toLowerCase(),
                    amount: this.getPlanAmount(dbSubscription.subscriptionTier),
                    currency: 'usd',
                    interval: 'month',
                    currentPeriodStart: dbSubscription.currentPeriodStart?.toISOString() || new Date().toISOString(),
                    currentPeriodEnd: dbSubscription.currentPeriodEnd?.toISOString() || new Date().toISOString(),
                    createdAt: dbSubscription.createdAt.toISOString(),
                    featureFlags: this.extractFeatureFlags(features),
                },
            };
        }
        catch (error) {
            this.logger.error(`Failed to get subscription: ${error.message}`);
            throw error;
        }
    }
    async processPayment(data, metadata, call) {
        this.logger.debug(`[gRPC] Processing payment of ${data.amount} ${data.currency} for user ${data.userId}`);
        try {
            const paymentIntent = await this.stripeService.createPaymentIntent(data.userId, 'one_time_payment', data.paymentMethodId, data.currency);
            const paymentRecord = await this.prisma.paymentIntent.create({
                data: {
                    userId: data.userId,
                    stripePaymentIntentId: paymentIntent.paymentIntentId,
                    amount: data.amount,
                    currency: data.currency,
                    status: 'processing',
                    description: data.description,
                    metadata: data.metadata || {},
                },
            });
            const payment = {
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
        }
        catch (error) {
            this.logger.error(`Failed to process payment: ${error.message}`);
            return {
                payment: null,
                clientSecret: null,
                requiresAction: false,
                error: error.message,
            };
        }
    }
    async addPaymentMethod(data, metadata) {
        this.logger.debug(`[gRPC] Adding payment method for user ${data.userId}`);
        try {
            const setupIntent = await this.stripeService.createSetupIntent(data.userId);
            if (data.paymentMethodId) {
                if (data.setAsDefault) {
                    await this.stripeService.setDefaultPaymentMethod(data.userId, data.paymentMethodId);
                }
                const dbPaymentMethod = await this.prisma.paymentMethod.findUnique({
                    where: { stripePaymentMethodId: data.paymentMethodId },
                });
                if (dbPaymentMethod) {
                    const paymentMethod = {
                        id: dbPaymentMethod.stripePaymentMethodId,
                        type: dbPaymentMethod.type,
                        card: dbPaymentMethod.brand ? {
                            brand: dbPaymentMethod.brand,
                            last4: dbPaymentMethod.last4 || '****',
                            expMonth: dbPaymentMethod.expiryMonth || 12,
                            expYear: dbPaymentMethod.expiryYear || 2025,
                            funding: 'credit',
                        } : undefined,
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
            return {
                paymentMethod: null,
                success: true,
                error: null,
                setupIntent: {
                    clientSecret: setupIntent.clientSecret,
                    setupIntentId: setupIntent.setupIntentId,
                },
            };
        }
        catch (error) {
            this.logger.error(`Failed to add payment method: ${error.message}`);
            return {
                paymentMethod: null,
                success: false,
                error: error.message,
            };
        }
    }
    async getPaymentMethods(data, metadata) {
        this.logger.debug(`[gRPC] Getting payment methods for user ${data.userId}`);
        try {
            const dbPaymentMethods = await this.stripeService.getPaymentMethods(data.userId);
            const paymentMethods = dbPaymentMethods.map(pm => ({
                id: pm.stripePaymentMethodId,
                type: pm.type,
                card: pm.brand ? {
                    brand: pm.brand,
                    last4: pm.last4 || '****',
                    expMonth: pm.expiryMonth || 12,
                    expYear: pm.expiryYear || 2025,
                    funding: 'credit',
                } : undefined,
                createdAt: pm.createdAt.toISOString(),
                isDefault: pm.isDefault,
            }));
            const defaultMethod = paymentMethods.find(pm => pm.isDefault);
            return {
                paymentMethods,
                defaultPaymentMethodId: defaultMethod?.id || null,
            };
        }
        catch (error) {
            this.logger.error(`Failed to get payment methods: ${error.message}`);
            throw error;
        }
    }
    async getPricingPlans(data, metadata) {
        this.logger.debug(`[gRPC] Getting pricing plans for currency ${data.currency || 'usd'}`);
        try {
            const stripePlans = this.stripeService.getAvailablePlans();
            const plans = Object.values(stripePlans).map(plan => {
                const features = this.subscriptionService.getSubscriptionFeatures(plan.tier);
                return {
                    id: plan.id,
                    name: plan.name,
                    tier: plan.tier,
                    monthlyPrice: plan.price / 100,
                    yearlyPrice: (plan.price * 12 * 0.85) / 100,
                    currency: data.currency || 'usd',
                    features: this.getPlanFeatureList(features),
                    limits: {
                        daily_likes: features.dailyLikes,
                        daily_messages: features.dailyUnmatchedMessages,
                        super_likes: features.profileBoostCount,
                        max_photos: features.maxPhotos,
                        call_duration: features.maxCallDuration,
                    },
                    hasTrial: false,
                    trialDays: 0,
                    stripeMonthlyPriceId: plan.stripePriceId,
                    stripeYearlyPriceId: plan.stripePriceId + '_yearly',
                };
            });
            return {
                plans,
                currency: data.currency || 'usd',
            };
        }
        catch (error) {
            this.logger.error(`Failed to get pricing plans: ${error.message}`);
            throw error;
        }
    }
    async getInvoices(data, metadata) {
        this.logger.debug(`[gRPC] Getting invoices for user ${data.userId}`);
        try {
            const billingHistory = await this.stripeService.getBillingHistory(data.userId);
            const invoices = billingHistory.map(bill => ({
                id: bill.stripeInvoiceId,
                subscriptionId: bill.subscriptionId || null,
                amountDue: bill.amount / 100,
                amountPaid: bill.amount / 100,
                currency: bill.currency,
                status: bill.status.toLowerCase(),
                dueDate: bill.createdAt.toISOString(),
                periodStart: bill.periodStart.toISOString(),
                periodEnd: bill.periodEnd.toISOString(),
                lineItems: [
                    {
                        description: bill.description || 'Subscription',
                        amount: bill.amount / 100,
                        quantity: 1,
                    },
                ],
                pdfUrl: bill.pdfUrl || null,
            }));
            return {
                invoices: invoices.slice(0, data.limit || 100),
                hasMore: invoices.length > (data.limit || 100),
            };
        }
        catch (error) {
            this.logger.error(`Failed to get invoices: ${error.message}`);
            throw error;
        }
    }
    async processStripeWebhook(data, metadata) {
        this.logger.debug(`[gRPC] Processing Stripe webhook: ${data.eventType}`);
        try {
            let processed = false;
            let message = '';
            switch (data.eventType) {
                case 'payment_intent.succeeded':
                    await this.prisma.paymentIntent.updateMany({
                        where: { stripePaymentIntentId: data.objectId },
                        data: { status: 'succeeded' },
                    });
                    this.emitPaymentEvent('webhook_payment_succeeded', data.userId, {
                        eventId: data.eventId,
                        paymentIntentId: data.objectId,
                    });
                    processed = true;
                    message = 'Payment intent succeeded';
                    break;
                case 'payment_intent.payment_failed':
                    await this.prisma.paymentIntent.updateMany({
                        where: { stripePaymentIntentId: data.objectId },
                        data: { status: 'failed' },
                    });
                    this.emitPaymentEvent('webhook_payment_failed', data.userId, {
                        eventId: data.eventId,
                        paymentIntentId: data.objectId,
                    });
                    processed = true;
                    message = 'Payment intent failed';
                    break;
                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
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
        }
        catch (error) {
            this.logger.error(`Failed to process webhook: ${error.message}`);
            return {
                processed: false,
                message: null,
                error: error.message,
            };
        }
    }
    async getPaymentHealth(data, metadata) {
        this.logger.debug('[gRPC] Getting payment service health');
        const response = {
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
                totalRevenue: 250000.50,
                activeSubscriptions: 1250,
                mrr: 18750.00,
                transactionsByType: {
                    subscription_creation: 450,
                    subscription_renewal: 800,
                    one_time_payment: 200,
                },
            };
        }
        return response;
    }
    streamPaymentEvents(data, metadata) {
        this.logger.log(`[gRPC] Starting payment event stream for service ${data.serviceId}`);
        return new rxjs_1.Observable((observer) => {
            const subscription = this.eventStream.subscribe({
                next: (event) => {
                    if (data.userId && event.userId !== data.userId) {
                        return;
                    }
                    if (data.eventTypes && data.eventTypes.length > 0) {
                        if (!data.eventTypes.includes(event.eventType)) {
                            return;
                        }
                    }
                    observer.next(event);
                },
                error: (err) => observer.error(err),
                complete: () => observer.complete(),
            });
            this.emitPaymentEvent('stream_connected', undefined, {
                serviceId: data.serviceId,
                streamId: `stream-${++this.streamCounter}`,
            });
            return () => {
                subscription.unsubscribe();
                this.logger.log(`[gRPC] Payment event stream disconnected for service ${data.serviceId}`);
            };
        });
    }
    emitPaymentEvent(eventType, userId, data) {
        const event = {
            eventId: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            eventType,
            userId,
            data: data || {},
            timestamp: new Date().toISOString(),
            source: 'payment-service',
        };
        this.eventStream.next(event);
    }
    getFeatureFlagsForPlan(planId) {
        const planFeatureMap = {
            'discover': ['basic_matching'],
            'connect': ['unlimited_likes', 'see_who_liked_you', 'advanced_filters', 'audio_calls'],
            'community': ['unlimited_likes', 'see_who_liked_you', 'advanced_filters', 'audio_calls', 'video_calls', 'priority_support'],
        };
        return planFeatureMap[planId] || planFeatureMap['discover'];
    }
    getPlanAmount(tier) {
        const tierPricing = {
            'DISCOVER': 0,
            'CONNECT': 9.99,
            'COMMUNITY': 19.99,
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
        if (features.supportPriority === 'priority' || features.supportPriority === 'vip') {
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
        this.logger.debug(`[gRPC] Getting subscriptions for user ${data.userId}`);
        try {
            const subscription = await this.subscriptionService.getUserSubscription(data.userId);
            const features = this.subscriptionService.getSubscriptionFeatures(subscription.subscriptionTier);
            const subscriptions = [{
                    id: ('stripeSubscriptionId' in subscription ? subscription.stripeSubscriptionId : null) || `sub_${data.userId}`,
                    userId: data.userId,
                    planId: ('planId' in subscription ? subscription.planId : null) || subscription.subscriptionTier.toLowerCase(),
                    status: subscription.status?.toLowerCase() || 'active',
                    tier: subscription.subscriptionTier,
                    currentPeriodStart: subscription.currentPeriodStart?.toISOString() || new Date().toISOString(),
                    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || new Date().toISOString(),
                    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd || false,
                    features: this.extractFeatureFlags(features),
                }];
            return {
                subscriptions,
                hasMore: false
            };
        }
        catch (error) {
            this.logger.error(`Failed to get user subscriptions: ${error.message}`);
            return { subscriptions: [], hasMore: false };
        }
    }
    async refundPayment(data) {
        this.logger.debug(`[gRPC] Processing refund for payment ${data.paymentId}`);
        return { refund: null, success: false, error: 'Not implemented' };
    }
    async getPaymentHistory(data) {
        this.logger.debug(`[gRPC] Getting payment history for user ${data.userId}`);
        try {
            const paymentIntents = await this.prisma.paymentIntent.findMany({
                where: { userId: data.userId },
                orderBy: { createdAt: 'desc' },
                take: data.limit || 50,
                skip: data.offset || 0,
            });
            const payments = paymentIntents.map(pi => ({
                id: pi.stripePaymentIntentId,
                userId: pi.userId,
                amount: pi.amount,
                currency: pi.currency,
                status: pi.status.toLowerCase(),
                description: pi.description,
                createdAt: pi.createdAt.toISOString(),
                metadata: pi.metadata || {},
            }));
            return {
                payments,
                hasMore: paymentIntents.length === (data.limit || 50)
            };
        }
        catch (error) {
            this.logger.error(`Failed to get payment history: ${error.message}`);
            return { payments: [], hasMore: false };
        }
    }
    async removePaymentMethod(data) {
        this.logger.debug(`[gRPC] Removing payment method ${data.paymentMethodId}`);
        try {
            await this.stripeService.deletePaymentMethod(data.userId, data.paymentMethodId);
            return {
                success: true,
                message: 'Payment method removed successfully'
            };
        }
        catch (error) {
            this.logger.error(`Failed to remove payment method: ${error.message}`);
            return {
                success: false,
                message: error.message
            };
        }
    }
    async setDefaultPaymentMethod(data) {
        this.logger.debug(`[gRPC] Setting default payment method for user ${data.userId}`);
        try {
            await this.stripeService.setDefaultPaymentMethod(data.userId, data.paymentMethodId);
            const paymentMethod = await this.prisma.paymentMethod.findUnique({
                where: { stripePaymentMethodId: data.paymentMethodId },
            });
            return {
                success: true,
                paymentMethod: paymentMethod ? {
                    id: paymentMethod.stripePaymentMethodId,
                    type: paymentMethod.type,
                    isDefault: true,
                    last4: paymentMethod.last4,
                    brand: paymentMethod.brand,
                } : null
            };
        }
        catch (error) {
            this.logger.error(`Failed to set default payment method: ${error.message}`);
            return {
                success: false,
                paymentMethod: null
            };
        }
    }
    async getUpcomingInvoice(data) {
        this.logger.debug(`[gRPC] Getting upcoming invoice for user ${data.userId}`);
        return { invoice: null, exists: false };
    }
    async validatePromoCode(data) {
        this.logger.debug(`[gRPC] Validating promo code ${data.promoCode}`);
        try {
            const validPromoCodes = {
                'WELCOME10': { discountType: 'percentage', discountValue: 10, description: '10% off first month' },
                'SAVE20': { discountType: 'percentage', discountValue: 20, description: '20% off first month' },
                'FRIEND50': { discountType: 'fixed', discountValue: 50, description: '$5.00 off' },
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
                error: null,
            };
        }
        catch (error) {
            this.logger.error(`Failed to validate promo code: ${error.message}`);
            return { valid: false, error: 'Failed to validate promo code' };
        }
    }
};
exports.PaymentGrpcController = PaymentGrpcController;
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'CreateSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata, Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "createSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'UpdateSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "updateSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'CancelSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "cancelSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'ProcessPayment'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata, Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "processPayment", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'AddPaymentMethod'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "addPaymentMethod", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetPaymentMethods'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getPaymentMethods", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetPricingPlans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getPricingPlans", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetInvoices'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getInvoices", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'ProcessStripeWebhook'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "processStripeWebhook", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetPaymentHealth'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getPaymentHealth", null);
__decorate([
    (0, microservices_1.GrpcStreamMethod)('PaymentService', 'StreamPaymentEvents'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, grpc_js_1.Metadata]),
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
    __metadata("design:returntype", Promise)
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
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "getUpcomingInvoice", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'ValidatePromoCode'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentGrpcController.prototype, "validatePromoCode", null);
exports.PaymentGrpcController = PaymentGrpcController = PaymentGrpcController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [subscription_service_1.SubscriptionService,
        stripe_service_1.StripeService,
        prisma_service_1.PrismaService])
], PaymentGrpcController);
//# sourceMappingURL=payment-grpc.controller.js.map