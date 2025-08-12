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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var WebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const stripe_1 = require("stripe");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let WebhookController = WebhookController_1 = class WebhookController {
    prisma;
    configService;
    logger = new common_1.Logger(WebhookController_1.name);
    stripe;
    endpointSecret;
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
        this.stripe = new stripe_1.default(this.configService.get('STRIPE_SECRET_KEY') || '', {
            apiVersion: '2025-07-30.basil',
        });
        this.endpointSecret = this.configService.get('STRIPE_WEBHOOK_SECRET') || '';
    }
    async handleStripeWebhook(signature, req) {
        if (!signature) {
            throw new common_1.BadRequestException('Missing stripe-signature header');
        }
        let event;
        try {
            event = this.stripe.webhooks.constructEvent(req.rawBody || Buffer.from(''), signature, this.endpointSecret);
        }
        catch (err) {
            this.logger.error(`Webhook signature verification failed: ${err.message}`);
            throw new common_1.BadRequestException('Invalid webhook signature');
        }
        await this.prisma.webhookEvent.create({
            data: {
                stripeEventId: event.id,
                type: event.type,
                payload: event,
                processedAt: new Date(),
            },
        });
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
                    await this.handleTrialWillEnd(event);
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
                    await this.handleDisputeCreated(event);
                    break;
                case 'charge.dispute.closed':
                    await this.handleDisputeClosed(event);
                    break;
                default:
                    this.logger.log(`Unhandled event type: ${event.type}`);
            }
            await this.prisma.webhookEvent.updateMany({
                where: { stripeEventId: event.id },
                data: { status: 'processed' },
            });
        }
        catch (error) {
            this.logger.error(`Error processing webhook event ${event.id}: ${error.message}`);
            await this.prisma.webhookEvent.updateMany({
                where: { stripeEventId: event.id },
                data: {
                    status: 'failed',
                    error: error.message,
                },
            });
        }
        return { received: true };
    }
    async handleSubscriptionCreated(event) {
        const subscription = event.data.object;
        const userSub = await this.prisma.userSubscription.findFirst({
            where: { stripeCustomerId: subscription.customer },
        });
        if (!userSub) {
            this.logger.error(`No user found for customer ${subscription.customer}`);
            return;
        }
        await this.prisma.userSubscription.update({
            where: { id: userSub.id },
            data: {
                stripeSubscriptionId: subscription.id,
                status: this.mapStripeStatus(subscription.status),
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                planId: subscription.items.data[0]?.price?.id,
            },
        });
        this.logger.log(`Subscription created for user ${userSub.userId}`);
    }
    async handleSubscriptionUpdated(event) {
        const subscription = event.data.object;
        const userSub = await this.prisma.userSubscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
        });
        if (!userSub) {
            this.logger.error(`No subscription found for ${subscription.id}`);
            return;
        }
        const tier = this.getTierFromPriceId(subscription.items.data[0]?.price?.id);
        await this.prisma.userSubscription.update({
            where: { id: userSub.id },
            data: {
                subscriptionTier: tier,
                status: this.mapStripeStatus(subscription.status),
                currentPeriodStart: new Date(subscription.current_period_start * 1000),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                planId: subscription.items.data[0]?.price?.id,
            },
        });
        this.logger.log(`Subscription updated for user ${userSub.userId}`);
    }
    async handleSubscriptionDeleted(event) {
        const subscription = event.data.object;
        const userSub = await this.prisma.userSubscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
        });
        if (!userSub) {
            this.logger.error(`No subscription found for ${subscription.id}`);
            return;
        }
        await this.prisma.userSubscription.update({
            where: { id: userSub.id },
            data: {
                status: client_1.SubscriptionStatus.CANCELED,
                subscriptionTier: client_1.SubscriptionTier.DISCOVER,
                cancelledAt: new Date(),
            },
        });
        this.logger.log(`Subscription cancelled for user ${userSub.userId}`);
    }
    async handleTrialWillEnd(event) {
        const subscription = event.data.object;
        this.logger.log(`Trial ending soon for subscription ${subscription.id}`);
    }
    async handleInvoicePaymentSucceeded(event) {
        const invoice = event.data.object;
        const userSub = await this.prisma.userSubscription.findFirst({
            where: { stripeCustomerId: invoice.customer },
        });
        if (!userSub) {
            this.logger.error(`No user found for customer ${invoice.customer}`);
            return;
        }
        await this.prisma.billingHistory.create({
            data: {
                userId: userSub.userId,
                stripeInvoiceId: invoice.id,
                amount: invoice.amount_paid,
                currency: invoice.currency,
                status: client_1.InvoiceStatus.paid,
                description: invoice.description || `Subscription payment`,
                periodStart: new Date(invoice.period_start * 1000),
                periodEnd: new Date(invoice.period_end * 1000),
                invoiceUrl: invoice.hosted_invoice_url,
                pdfUrl: invoice.invoice_pdf,
            },
        });
        this.logger.log(`Payment succeeded for user ${userSub.userId}`);
    }
    async handleInvoicePaymentFailed(event) {
        const invoice = event.data.object;
        const userSub = await this.prisma.userSubscription.findFirst({
            where: { stripeCustomerId: invoice.customer },
        });
        if (!userSub) {
            this.logger.error(`No user found for customer ${invoice.customer}`);
            return;
        }
        await this.prisma.billingHistory.create({
            data: {
                userId: userSub.userId,
                stripeInvoiceId: invoice.id,
                amount: invoice.amount_due,
                currency: invoice.currency,
                status: client_1.InvoiceStatus.uncollectible,
                description: `Payment failed - ${invoice.description || 'Subscription payment'}`,
                periodStart: new Date(invoice.period_start * 1000),
                periodEnd: new Date(invoice.period_end * 1000),
            },
        });
        this.logger.log(`Payment failed for user ${userSub.userId}`);
    }
    async handlePaymentIntentSucceeded(event) {
        const paymentIntent = event.data.object;
        await this.prisma.paymentIntent.updateMany({
            where: { stripePaymentIntentId: paymentIntent.id },
            data: {
                status: 'succeeded',
                updatedAt: new Date(),
            },
        });
        this.logger.log(`Payment intent succeeded: ${paymentIntent.id}`);
    }
    async handlePaymentIntentFailed(event) {
        const paymentIntent = event.data.object;
        await this.prisma.paymentIntent.updateMany({
            where: { stripePaymentIntentId: paymentIntent.id },
            data: {
                status: 'failed',
                updatedAt: new Date(),
            },
        });
        this.logger.log(`Payment intent failed: ${paymentIntent.id}`);
    }
    async handlePaymentMethodAttached(event) {
        const paymentMethod = event.data.object;
        const userSub = await this.prisma.userSubscription.findFirst({
            where: { stripeCustomerId: paymentMethod.customer },
        });
        if (!userSub) {
            this.logger.error(`No user found for customer ${paymentMethod.customer}`);
            return;
        }
        await this.prisma.paymentMethod.create({
            data: {
                userId: userSub.userId,
                stripePaymentMethodId: paymentMethod.id,
                type: paymentMethod.type,
                brand: paymentMethod.card?.brand,
                last4: paymentMethod.card?.last4,
                expiryMonth: paymentMethod.card?.exp_month,
                expiryYear: paymentMethod.card?.exp_year,
                isDefault: false,
            },
        });
        this.logger.log(`Payment method attached for user ${userSub.userId}`);
    }
    async handlePaymentMethodDetached(event) {
        const paymentMethod = event.data.object;
        await this.prisma.paymentMethod.deleteMany({
            where: { stripePaymentMethodId: paymentMethod.id },
        });
        this.logger.log(`Payment method detached: ${paymentMethod.id}`);
    }
    async handleDisputeCreated(event) {
        const dispute = event.data.object;
        this.logger.warn(`Dispute created: ${dispute.id} for charge ${dispute.charge}`);
    }
    async handleDisputeClosed(event) {
        const dispute = event.data.object;
        this.logger.log(`Dispute closed: ${dispute.id} - Status: ${dispute.status}`);
    }
    mapStripeStatus(stripeStatus) {
        const statusMap = {
            'active': client_1.SubscriptionStatus.ACTIVE,
            'past_due': client_1.SubscriptionStatus.PAST_DUE,
            'canceled': client_1.SubscriptionStatus.CANCELED,
            'incomplete': client_1.SubscriptionStatus.INCOMPLETE,
            'incomplete_expired': client_1.SubscriptionStatus.EXPIRED,
            'trialing': client_1.SubscriptionStatus.TRIALING,
            'unpaid': client_1.SubscriptionStatus.PAST_DUE,
        };
        return statusMap[stripeStatus] || client_1.SubscriptionStatus.INACTIVE;
    }
    getTierFromPriceId(priceId) {
        const priceToTierMap = {
            'price_discover_monthly': client_1.SubscriptionTier.DISCOVER,
            'price_discover_yearly': client_1.SubscriptionTier.DISCOVER,
            'price_connect_monthly': client_1.SubscriptionTier.CONNECT,
            'price_connect_yearly': client_1.SubscriptionTier.CONNECT,
            'price_community_monthly': client_1.SubscriptionTier.COMMUNITY,
            'price_community_yearly': client_1.SubscriptionTier.COMMUNITY,
        };
        return priceToTierMap[priceId] || client_1.SubscriptionTier.DISCOVER;
    }
};
exports.WebhookController = WebhookController;
__decorate([
    (0, common_1.Post)('stripe'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Handle Stripe webhook events' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Webhook processed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid webhook signature' }),
    __param(0, (0, common_1.Headers)('stripe-signature')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], WebhookController.prototype, "handleStripeWebhook", null);
exports.WebhookController = WebhookController = WebhookController_1 = __decorate([
    (0, swagger_1.ApiTags)('Webhooks'),
    (0, common_1.Controller)('api/v1/webhooks'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], WebhookController);
//# sourceMappingURL=webhook.controller.js.map