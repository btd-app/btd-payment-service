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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var WebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
require("../types/external");
const stripe_1 = __importDefault(require("stripe"));
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let WebhookController = WebhookController_1 = class WebhookController {
    constructor(prisma, configService) {
        this.prisma = prisma;
        this.configService = configService;
        this.logger = new common_1.Logger(WebhookController_1.name);
        this.stripe = new stripe_1.default(this.configService.get('STRIPE_SECRET_KEY') || '', {
            apiVersion: '2025-08-27.basil',
        });
        this.endpointSecret = this.configService.get('STRIPE_WEBHOOK_SECRET') || '';
    }
    async handleStripeWebhook(signature, req) {
        if (!signature) {
            throw new common_1.BadRequestException('Missing stripe-signature header');
        }
        let event;
        try {
            const rawBody = req.rawBody || req.body || Buffer.from('');
            this.logger.debug(`Processing webhook with signature: ${signature.substring(0, 20)}...`);
            this.logger.debug(`Raw body type: ${typeof rawBody}, length: ${Buffer.isBuffer(rawBody) ? rawBody.length : 'unknown'}`);
            const bodyBuffer = Buffer.isBuffer(rawBody)
                ? rawBody
                : Buffer.from(rawBody);
            event = this.stripe.webhooks.constructEvent(bodyBuffer, signature, this.endpointSecret);
        }
        catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            this.logger.error(`Webhook signature verification failed: ${errorMessage}`);
            throw new common_1.BadRequestException('Invalid webhook signature');
        }
        await this.prisma.webhookEvent.create({
            data: {
                eventId: event.id,
                stripeEventId: event.id,
                type: event.type,
                data: JSON.parse(JSON.stringify(event)),
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
            await this.prisma.webhookEvent.updateMany({
                where: { stripeEventId: event.id },
                data: { status: 'processed' },
            });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error processing webhook event ${event.id}: ${errorMessage}`);
            await this.prisma.webhookEvent.updateMany({
                where: { stripeEventId: event.id },
                data: {
                    status: 'failed',
                    error: errorMessage,
                },
            });
        }
        return { received: true };
    }
    async handleSubscriptionCreated(event) {
        const subscription = event.data.object;
        const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id;
        const userSub = await this.prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
        });
        if (!userSub) {
            this.logger.error(`No user found for customer ${customerId}`);
            return;
        }
        const subscriptionData = subscription;
        await this.prisma.subscription.update({
            where: { id: userSub.id },
            data: {
                stripeSubscriptionId: subscription.id,
                status: this.mapStripeStatus(subscription.status),
                currentPeriodStart: new Date(subscriptionData.current_period_start * 1000),
                currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
                cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
                planId: subscription.items.data[0]?.price?.id,
            },
        });
        this.logger.log(`Subscription created for user ${userSub.userId}`);
    }
    async handleSubscriptionUpdated(event) {
        const subscription = event.data.object;
        const userSub = await this.prisma.subscription.findFirst({
            where: { stripeSubscriptionId: subscription.id },
        });
        if (!userSub) {
            this.logger.error(`No subscription found for ${subscription.id}`);
            return;
        }
        const priceId = subscription.items.data[0]?.price?.id ?? '';
        const tier = this.getTierFromPriceId(priceId);
        const subscriptionData = subscription;
        await this.prisma.subscription.update({
            where: { id: userSub.id },
            data: {
                subscriptionTier: tier,
                status: this.mapStripeStatus(subscription.status),
                currentPeriodStart: new Date(subscriptionData.current_period_start * 1000),
                currentPeriodEnd: new Date(subscriptionData.current_period_end * 1000),
                cancelAtPeriodEnd: subscriptionData.cancel_at_period_end,
                planId: priceId,
            },
        });
        this.logger.log(`Subscription updated for user ${userSub.userId}`);
    }
    async handleSubscriptionDeleted(event) {
        const subscription = event.data.object;
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
                status: client_1.SubscriptionStatus.CANCELLED,
                subscriptionTier: client_1.SubscriptionTier.DISCOVER,
                cancelledAt: new Date(),
            },
        });
        this.logger.log(`Subscription cancelled for user ${userSub.userId}`);
    }
    handleTrialWillEnd(event) {
        const subscription = event.data.object;
        this.logger.log(`Trial ending soon for subscription ${subscription.id}`);
    }
    async handleInvoicePaymentSucceeded(event) {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;
        const userSub = await this.prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
        });
        if (!userSub) {
            this.logger.error(`No user found for customer ${customerId}`);
            return;
        }
        await this.prisma.billingHistory.create({
            data: {
                userId: userSub.userId,
                stripeInvoiceId: invoice.id,
                type: 'subscription_payment',
                amount: invoice.amount_paid ?? 0,
                currency: invoice.currency ?? 'usd',
                status: client_1.InvoiceStatus.PAID,
                description: invoice.description ?? 'Subscription payment',
                periodStart: new Date((invoice.period_start ?? 0) * 1000),
                periodEnd: new Date((invoice.period_end ?? 0) * 1000),
                invoiceUrl: invoice.hosted_invoice_url ?? undefined,
                pdfUrl: invoice.invoice_pdf ?? undefined,
            },
        });
        this.logger.log(`Payment succeeded for user ${userSub.userId}`);
    }
    async handleInvoicePaymentFailed(event) {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;
        const userSub = await this.prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
        });
        if (!userSub) {
            this.logger.error(`No user found for customer ${customerId}`);
            return;
        }
        await this.prisma.billingHistory.create({
            data: {
                userId: userSub.userId,
                stripeInvoiceId: invoice.id,
                type: 'subscription_payment',
                amount: invoice.amount_due ?? 0,
                currency: invoice.currency ?? 'usd',
                status: client_1.InvoiceStatus.UNCOLLECTIBLE,
                description: `Payment failed - ${invoice.description ?? 'Subscription payment'}`,
                periodStart: new Date((invoice.period_start ?? 0) * 1000),
                periodEnd: new Date((invoice.period_end ?? 0) * 1000),
            },
        });
        this.logger.log(`Payment failed for user ${userSub.userId}`);
    }
    async handlePaymentIntentSucceeded(event) {
        const paymentIntent = event.data.object;
        await this.prisma.paymentIntent.updateMany({
            where: { stripePaymentIntentId: paymentIntent.id },
            data: {
                status: 'SUCCEEDED',
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
                status: 'FAILED',
                updatedAt: new Date(),
            },
        });
        this.logger.log(`Payment intent failed: ${paymentIntent.id}`);
    }
    async handlePaymentMethodAttached(event) {
        const paymentMethod = event.data.object;
        const customerId = typeof paymentMethod.customer === 'string'
            ? paymentMethod.customer
            : paymentMethod.customer?.id;
        const userSub = await this.prisma.subscription.findFirst({
            where: { stripeCustomerId: customerId },
        });
        if (!userSub) {
            this.logger.error(`No user found for customer ${customerId}`);
            return;
        }
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
    async handlePaymentMethodDetached(event) {
        const paymentMethod = event.data.object;
        await this.prisma.paymentMethod.deleteMany({
            where: { stripePaymentMethodId: paymentMethod.id },
        });
        this.logger.log(`Payment method detached: ${paymentMethod.id}`);
    }
    handleDisputeCreated(event) {
        const dispute = event.data.object;
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
        this.logger.warn(`Dispute created: ${dispute.id} for charge ${chargeId}`);
    }
    handleDisputeClosed(event) {
        const dispute = event.data.object;
        this.logger.log(`Dispute closed: ${dispute.id} - Status: ${dispute.status}`);
    }
    mapStripeStatus(stripeStatus) {
        const statusMap = {
            active: client_1.SubscriptionStatus.ACTIVE,
            canceled: client_1.SubscriptionStatus.CANCELLED,
            incomplete: client_1.SubscriptionStatus.PENDING,
            incomplete_expired: client_1.SubscriptionStatus.EXPIRED,
            trialing: client_1.SubscriptionStatus.ACTIVE,
            unpaid: client_1.SubscriptionStatus.BILLING_RETRY,
            past_due: client_1.SubscriptionStatus.BILLING_RETRY,
        };
        return statusMap[stripeStatus] || client_1.SubscriptionStatus.PENDING;
    }
    getTierFromPriceId(priceId) {
        const priceToTierMap = {
            price_discover_monthly: client_1.SubscriptionTier.DISCOVER,
            price_discover_yearly: client_1.SubscriptionTier.DISCOVER,
            price_connect_monthly: client_1.SubscriptionTier.CONNECT,
            price_connect_yearly: client_1.SubscriptionTier.CONNECT,
            price_community_monthly: client_1.SubscriptionTier.COMMUNITY,
            price_community_yearly: client_1.SubscriptionTier.COMMUNITY,
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
    (0, common_1.Controller)('webhooks'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], WebhookController);
//# sourceMappingURL=webhook.controller.js.map