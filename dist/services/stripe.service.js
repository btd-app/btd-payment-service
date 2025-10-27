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
var StripeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
require("../types/external");
const stripe_1 = require("stripe");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let StripeService = StripeService_1 = class StripeService {
    constructor(configService, prisma) {
        this.configService = configService;
        this.prisma = prisma;
        this.logger = new common_1.Logger(StripeService_1.name);
        const stripeConfig = this.configService.get('stripe');
        if (!stripeConfig) {
            throw new Error('Stripe configuration is missing');
        }
        this.stripe = new stripe_1.default(stripeConfig.secretKey, {
            apiVersion: stripeConfig.apiVersion,
            typescript: true,
        });
        this.plans = stripeConfig.plans;
    }
    async createOrGetCustomer(userId, email, name) {
        try {
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
                select: { stripeCustomerId: true },
            });
            if (subscription?.stripeCustomerId) {
                return subscription.stripeCustomerId;
            }
            const customer = await this.stripe.customers.create({
                email,
                name,
                metadata: {
                    userId,
                },
            });
            await this.prisma.subscription.upsert({
                where: { userId },
                create: {
                    userId,
                    stripeCustomerId: customer.id,
                    subscriptionTier: client_1.SubscriptionTier.DISCOVER,
                    status: client_1.SubscriptionStatus.PENDING,
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
                update: {
                    stripeCustomerId: customer.id,
                },
            });
            this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
            return customer.id;
        }
        catch (error) {
            this.logger.error('Error creating/getting Stripe customer:', error);
            throw new common_1.InternalServerErrorException('Failed to create customer');
        }
    }
    async createPaymentIntent(userId, planId, paymentMethodId, currency = 'usd') {
        try {
            const plan = this.plans[planId];
            if (!plan) {
                throw new common_1.BadRequestException('Invalid plan ID');
            }
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription?.stripeCustomerId) {
                throw new common_1.BadRequestException('Customer not found');
            }
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: plan.price,
                currency,
                customer: subscription.stripeCustomerId,
                payment_method: paymentMethodId,
                confirm: !!paymentMethodId,
                metadata: {
                    userId,
                    planId,
                },
                description: `Subscription: ${plan.name}`,
            });
            await this.prisma.paymentIntent.create({
                data: {
                    userId,
                    stripePaymentIntentId: paymentIntent.id,
                    amount: plan.price,
                    currency: paymentIntent.currency,
                    status: paymentIntent.status,
                    description: `Subscription: ${plan.name}`,
                    metadata: {
                        planId,
                    },
                },
            });
            return {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                amount: plan.price,
                currency: paymentIntent.currency,
            };
        }
        catch (error) {
            this.logger.error('Error creating payment intent:', error);
            throw error;
        }
    }
    async createSubscription(userId, planId, paymentMethodId) {
        try {
            const plan = this.plans[planId];
            if (!plan) {
                throw new common_1.BadRequestException('Invalid plan ID');
            }
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription?.stripeCustomerId) {
                throw new common_1.BadRequestException('Customer not found');
            }
            await this.stripe.paymentMethods.attach(paymentMethodId, {
                customer: subscription.stripeCustomerId,
            });
            await this.stripe.customers.update(subscription.stripeCustomerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
            const stripeSubscription = await this.stripe.subscriptions.create({
                customer: subscription.stripeCustomerId,
                items: [{ price: plan.stripePriceId }],
                payment_behavior: 'default_incomplete',
                payment_settings: {
                    save_default_payment_method: 'on_subscription',
                },
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    userId,
                    planId,
                },
            });
            const subscriptionData = stripeSubscription;
            await this.prisma.subscription.update({
                where: { userId },
                data: {
                    subscriptionTier: plan.tier,
                    stripeSubscriptionId: stripeSubscription.id,
                    status: stripeSubscription.status.toUpperCase(),
                    currentPeriodStart: new Date(subscriptionData.current_period_start * 1000),
                    currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
                    cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
                    planId,
                },
            });
            const latestInvoice = stripeSubscription.latest_invoice;
            let clientSecret = null;
            if (latestInvoice && typeof latestInvoice === 'object') {
                const invoice = latestInvoice;
                const paymentIntent = invoice
                    .payment_intent;
                if (paymentIntent && typeof paymentIntent === 'object') {
                    const secret = paymentIntent
                        .client_secret;
                    clientSecret = secret ?? null;
                }
            }
            return {
                subscriptionId: stripeSubscription.id,
                clientSecret,
                status: stripeSubscription.status.toUpperCase(),
                currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
            };
        }
        catch (error) {
            this.logger.error('Error creating subscription:', error);
            throw error;
        }
    }
    async updateSubscription(userId, newPlanId, cancelAtPeriodEnd) {
        try {
            const dbSubscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!dbSubscription?.stripeSubscriptionId) {
                throw new common_1.BadRequestException('No active subscription found');
            }
            const stripeSubscription = await this.stripe.subscriptions.retrieve(dbSubscription.stripeSubscriptionId);
            const updateData = {};
            if (newPlanId) {
                const plan = this.plans[newPlanId];
                if (!plan) {
                    throw new common_1.BadRequestException('Invalid plan ID');
                }
                updateData.items = [
                    {
                        id: stripeSubscription.items.data[0]?.id,
                        price: plan.stripePriceId,
                    },
                ];
                updateData.proration_behavior = 'create_prorations';
            }
            if (cancelAtPeriodEnd !== undefined) {
                updateData.cancel_at_period_end = cancelAtPeriodEnd;
            }
            const updatedSubscription = await this.stripe.subscriptions.update(dbSubscription.stripeSubscriptionId, updateData);
            await this.prisma.subscription.update({
                where: { userId },
                data: {
                    ...(newPlanId && {
                        planId: newPlanId,
                        subscriptionTier: this.plans[newPlanId].tier,
                    }),
                    ...(cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd }),
                    status: updatedSubscription.status,
                },
            });
            return updatedSubscription;
        }
        catch (error) {
            this.logger.error('Error updating subscription:', error);
            throw error;
        }
    }
    async cancelSubscription(userId, immediately = false) {
        try {
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription?.stripeSubscriptionId) {
                throw new common_1.BadRequestException('No active subscription found');
            }
            if (immediately) {
                await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
                await this.prisma.subscription.update({
                    where: { userId },
                    data: {
                        status: client_1.SubscriptionStatus.CANCELLED,
                        subscriptionTier: client_1.SubscriptionTier.DISCOVER,
                    },
                });
            }
            else {
                await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                    cancel_at_period_end: true,
                });
                await this.prisma.subscription.update({
                    where: { userId },
                    data: {
                        cancelAtPeriodEnd: true,
                    },
                });
            }
        }
        catch (error) {
            this.logger.error('Error canceling subscription:', error);
            throw error;
        }
    }
    async getBillingHistory(userId) {
        try {
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription?.stripeCustomerId) {
                return [];
            }
            const invoices = await this.stripe.invoices.list({
                customer: subscription.stripeCustomerId,
                limit: 100,
            });
            const billingHistory = [];
            for (const invoice of invoices.data) {
                const record = await this.prisma.billingHistory.upsert({
                    where: { stripeInvoiceId: invoice.id },
                    create: {
                        userId,
                        stripeInvoiceId: invoice.id,
                        type: 'subscription_payment',
                        amount: invoice.amount_paid || 0,
                        currency: invoice.currency,
                        status: (invoice.status || 'draft'),
                        description: invoice.description || 'Subscription payment',
                        periodStart: new Date(invoice.period_start * 1000),
                        periodEnd: new Date(invoice.period_end * 1000),
                        invoiceUrl: invoice.hosted_invoice_url,
                        pdfUrl: invoice.invoice_pdf,
                    },
                    update: {
                        status: (invoice.status || 'draft'),
                    },
                });
                billingHistory.push(record);
            }
            return billingHistory;
        }
        catch (error) {
            this.logger.error('Error getting billing history:', error);
            throw error;
        }
    }
    async getPaymentMethods(userId) {
        try {
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription?.stripeCustomerId) {
                return [];
            }
            const paymentMethods = await this.stripe.paymentMethods.list({
                customer: subscription.stripeCustomerId,
                type: 'card',
            });
            const customer = (await this.stripe.customers.retrieve(subscription.stripeCustomerId));
            const defaultPaymentMethodId = typeof customer.invoice_settings?.default_payment_method === 'string'
                ? customer.invoice_settings.default_payment_method
                : customer.invoice_settings?.default_payment_method?.id || null;
            const methods = [];
            for (const pm of paymentMethods.data) {
                const method = await this.prisma.paymentMethod.upsert({
                    where: { stripePaymentMethodId: pm.id },
                    create: {
                        userId,
                        stripePaymentMethodId: pm.id,
                        type: pm.type,
                        brand: pm.card?.brand,
                        last4: pm.card?.last4,
                        expiryMonth: pm.card?.exp_month,
                        expiryYear: pm.card?.exp_year,
                        isDefault: pm.id === defaultPaymentMethodId,
                    },
                    update: {
                        isDefault: pm.id === defaultPaymentMethodId,
                    },
                });
                methods.push(method);
            }
            return methods;
        }
        catch (error) {
            this.logger.error('Error getting payment methods:', error);
            throw error;
        }
    }
    async createSetupIntent(userId) {
        try {
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription?.stripeCustomerId) {
                throw new common_1.BadRequestException('Customer not found');
            }
            const setupIntent = await this.stripe.setupIntents.create({
                customer: subscription.stripeCustomerId,
                payment_method_types: ['card'],
                metadata: {
                    userId,
                },
            });
            return {
                clientSecret: setupIntent.client_secret,
                setupIntentId: setupIntent.id,
            };
        }
        catch (error) {
            this.logger.error('Error creating setup intent:', error);
            throw error;
        }
    }
    async deletePaymentMethod(userId, paymentMethodId) {
        try {
            const paymentMethod = await this.prisma.paymentMethod.findUnique({
                where: { stripePaymentMethodId: paymentMethodId },
            });
            if (!paymentMethod || paymentMethod.userId !== userId) {
                throw new common_1.BadRequestException('Payment method not found');
            }
            await this.stripe.paymentMethods.detach(paymentMethodId);
            await this.prisma.paymentMethod.delete({
                where: { stripePaymentMethodId: paymentMethodId },
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error('Error deleting payment method:', error);
            throw error;
        }
    }
    async setDefaultPaymentMethod(userId, paymentMethodId) {
        try {
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription?.stripeCustomerId) {
                throw new common_1.BadRequestException('Customer not found');
            }
            await this.stripe.customers.update(subscription.stripeCustomerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });
            await this.prisma.paymentMethod.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
            await this.prisma.paymentMethod.update({
                where: { stripePaymentMethodId: paymentMethodId },
                data: { isDefault: true },
            });
            return { success: true };
        }
        catch (error) {
            this.logger.error('Error setting default payment method:', error);
            throw error;
        }
    }
    getAvailablePlans() {
        return Object.values(this.plans);
    }
    async getCurrentSubscription(userId) {
        const subscription = await this.prisma.subscription.findUnique({
            where: { userId },
        });
        if (!subscription) {
            throw new common_1.NotFoundException('No subscription found');
        }
        return subscription;
    }
    async cancelSubscriptionImmediately(userId, subscriptionId) {
        try {
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription ||
                subscription.stripeSubscriptionId !== subscriptionId) {
                throw new common_1.NotFoundException('Subscription not found');
            }
            await this.stripe.subscriptions.cancel(subscriptionId);
            await this.prisma.subscription.update({
                where: { userId },
                data: {
                    status: client_1.SubscriptionStatus.CANCELLED,
                    subscriptionTier: client_1.SubscriptionTier.DISCOVER,
                    cancelledAt: new Date(),
                },
            });
        }
        catch (error) {
            this.logger.error('Error cancelling subscription immediately:', error);
            throw error;
        }
    }
    async reactivateSubscription(userId, subscriptionId) {
        try {
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription ||
                subscription.stripeSubscriptionId !== subscriptionId) {
                throw new common_1.NotFoundException('Subscription not found');
            }
            const stripeSubscription = await this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: false,
            });
            await this.prisma.subscription.update({
                where: { userId },
                data: {
                    cancelAtPeriodEnd: false,
                    status: client_1.SubscriptionStatus.ACTIVE,
                },
            });
            const reactivatedData = stripeSubscription;
            return {
                subscriptionId: stripeSubscription.id,
                clientSecret: null,
                status: client_1.SubscriptionStatus.ACTIVE,
                currentPeriodEnd: new Date(reactivatedData.current_period_end * 1000),
            };
        }
        catch (error) {
            this.logger.error('Error reactivating subscription:', error);
            throw error;
        }
    }
    async createCheckoutSession(userId, userEmail, priceId, successUrl, cancelUrl) {
        try {
            const customerId = await this.createOrGetCustomer(userId, userEmail);
            const session = await this.stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    userId,
                },
            });
            return {
                sessionId: session.id,
                url: session.url || '',
            };
        }
        catch (error) {
            this.logger.error('Error creating checkout session:', error);
            throw error;
        }
    }
    async createPortalSession(userId, returnUrl) {
        try {
            const subscription = await this.prisma.subscription.findUnique({
                where: { userId },
            });
            if (!subscription?.stripeCustomerId) {
                throw new common_1.NotFoundException('No customer found');
            }
            const session = await this.stripe.billingPortal.sessions.create({
                customer: subscription.stripeCustomerId,
                return_url: returnUrl,
            });
            return { url: session.url };
        }
        catch (error) {
            this.logger.error('Error creating portal session:', error);
            throw error;
        }
    }
};
exports.StripeService = StripeService;
exports.StripeService = StripeService = StripeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], StripeService);
//# sourceMappingURL=stripe.service.js.map