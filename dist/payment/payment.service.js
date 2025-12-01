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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PaymentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const config_1 = require("@nestjs/config");
const client_1 = require("@prisma/client");
const axios_1 = __importDefault(require("axios"));
let PaymentService = PaymentService_1 = class PaymentService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.logger = new common_1.Logger(PaymentService_1.name);
        this.environment = this.config.get('NODE_ENV') ?? 'development';
        this.applePassword = this.config.get('APPLE_SHARED_SECRET') ?? '';
        this.appleVerifyUrl =
            this.environment === 'production'
                ? 'https://buy.itunes.apple.com/verifyReceipt'
                : 'https://sandbox.itunes.apple.com/verifyReceipt';
    }
    async validateAppleReceipt(data) {
        this.logger.debug(`Validating Apple receipt for user: ${data.user_id}`);
        try {
            const verificationResponse = await this.verifyWithApple(data.receipt_data);
            if (verificationResponse.status !== 0) {
                throw new Error(`Apple verification failed with status: ${verificationResponse.status}`);
            }
            const latestReceiptInfo = verificationResponse.latest_receipt_info?.[0];
            if (!latestReceiptInfo) {
                throw new Error('No receipt info found');
            }
            const productId = latestReceiptInfo.product_id;
            const isSubscription = !productId.includes('consumable');
            if (isSubscription) {
                const subscription = await this.processSubscriptionReceipt(data.user_id, latestReceiptInfo, verificationResponse);
                return {
                    success: true,
                    subscription: await this.formatSubscription(subscription),
                };
            }
            else {
                throw new Error('Receipt is for a consumable product, not a subscription');
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Receipt validation failed: ${errorMessage}`);
            return {
                success: false,
                error_message: errorMessage,
            };
        }
    }
    async processAppleWebhook(data) {
        this.logger.debug('Processing Apple webhook');
        try {
            const payload = this.verifyAppleJWT(data.signed_payload);
            await this.prisma.appleWebhookLog.create({
                data: {
                    notificationType: payload.notificationType,
                    signedPayload: data.signed_payload,
                    status: 'processing',
                },
            });
            let actionTaken = '';
            switch (payload.notificationType) {
                case 'DID_CHANGE_RENEWAL_STATUS':
                    actionTaken = await this.handleRenewalStatusChange(payload);
                    break;
                case 'DID_RENEW':
                    actionTaken = await this.handleSubscriptionRenewal(payload);
                    break;
                case 'EXPIRED':
                    actionTaken = await this.handleSubscriptionExpired(payload);
                    break;
                case 'REFUND':
                    actionTaken = await this.handleRefund(payload);
                    break;
                case 'DID_FAIL_TO_RENEW':
                    actionTaken = await this.handleFailedRenewal(payload);
                    break;
                default:
                    actionTaken = 'ignored';
                    this.logger.warn(`Unhandled notification type: ${payload.notificationType}`);
            }
            await this.prisma.appleWebhookLog.updateMany({
                where: {
                    signedPayload: data.signed_payload,
                    status: 'processing',
                },
                data: {
                    status: 'processed',
                    processedAt: new Date(),
                },
            });
            return {
                success: true,
                notification_type: payload.notificationType,
                action_taken: actionTaken,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Webhook processing failed: ${errorMessage}`);
            await this.prisma.appleWebhookLog.create({
                data: {
                    notificationType: 'unknown',
                    signedPayload: data.signed_payload,
                    status: 'failed',
                    errorMessage,
                },
            });
            return {
                success: false,
                error_message: errorMessage,
            };
        }
    }
    async processConsumablePurchase(data) {
        this.logger.debug(`Processing consumable purchase: ${data.product_id}`);
        try {
            const existingTransaction = await this.prisma.appleTransaction.findUnique({
                where: { transactionId: data.transaction_id },
            });
            if (existingTransaction) {
                this.logger.warn(`Transaction already processed: ${data.transaction_id}`);
                return {
                    success: false,
                    error_message: 'Transaction already processed',
                };
            }
            const verificationResponse = await this.verifyWithApple(data.receipt_data);
            if (verificationResponse.status !== 0) {
                throw new Error(`Apple verification failed with status: ${verificationResponse.status}`);
            }
            const transaction = verificationResponse.receipt?.in_app?.find((t) => t.transaction_id === data.transaction_id);
            if (!transaction) {
                throw new Error('Transaction not found in receipt');
            }
            await this.prisma.appleTransaction.create({
                data: {
                    userId: data.user_id,
                    transactionId: data.transaction_id,
                    productId: data.product_id,
                    type: 'consumable',
                    status: 'completed',
                    processedAt: new Date(),
                },
            });
            const granted = await this.grantConsumableItems(data.user_id, data.product_id);
            return {
                success: true,
                granted,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Consumable purchase failed: ${errorMessage}`);
            return {
                success: false,
                error_message: errorMessage,
            };
        }
    }
    async getUserSubscription(data) {
        this.logger.debug(`Getting subscription for user: ${data.user_id}`);
        try {
            const subscription = await this.prisma.subscription.findFirst({
                where: {
                    userId: data.user_id,
                    status: 'ACTIVE',
                },
                orderBy: {
                    currentPeriodEnd: 'desc',
                },
            });
            if (!subscription) {
                return {
                    has_subscription: false,
                };
            }
            const features = await this.getUserFeatures(data.user_id);
            const usage = await this.getUserUsage(data.user_id);
            return {
                has_subscription: true,
                subscription: await this.formatSubscription(subscription),
                features,
                usage,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Get subscription failed: ${errorMessage}`);
            return {
                has_subscription: false,
            };
        }
    }
    async updateSubscriptionStatus(data) {
        this.logger.debug(`Updating subscription status for user: ${data.user_id}`);
        try {
            const subscription = await this.prisma.subscription.findFirst({
                where: {
                    userId: data.user_id,
                    status: 'ACTIVE',
                },
            });
            if (!subscription) {
                throw new Error('No active subscription found');
            }
            const validStatuses = Object.values(client_1.SubscriptionStatus);
            if (!validStatuses.includes(data.status)) {
                throw new Error(`Invalid status: ${data.status}`);
            }
            const updated = await this.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: data.status,
                    cancelledAt: data.status === 'CANCELLED' ? new Date() : undefined,
                },
            });
            return {
                success: true,
                subscription: await this.formatSubscription(updated),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Update subscription failed: ${errorMessage}`);
            return {
                success: false,
            };
        }
    }
    async cancelSubscription(data) {
        this.logger.debug(`Cancelling subscription for user: ${data.user_id}`);
        try {
            const subscription = await this.prisma.subscription.findFirst({
                where: {
                    userId: data.user_id,
                    status: 'ACTIVE',
                },
            });
            if (!subscription) {
                throw new Error('No active subscription found');
            }
            const cancellationDate = data.immediate
                ? new Date()
                : subscription.currentPeriodEnd;
            await this.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: data.immediate ? 'CANCELLED' : 'ACTIVE',
                    autoRenew: false,
                    cancelledAt: new Date(),
                },
            });
            return {
                success: true,
                cancellation_date: cancellationDate.toISOString(),
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Cancel subscription failed: ${errorMessage}`);
            return {
                success: false,
            };
        }
    }
    async verifyWithApple(receiptData) {
        const response = await axios_1.default.post(this.appleVerifyUrl, {
            'receipt-data': receiptData,
            password: this.applePassword,
            'exclude-old-transactions': true,
        });
        return response.data;
    }
    verifyAppleJWT(signedPayload) {
        if (this.environment === 'development') {
            const parts = signedPayload.split('.');
            const payloadString = Buffer.from(parts[1], 'base64').toString();
            const decoded = JSON.parse(payloadString);
            return decoded.data;
        }
        throw new Error('JWT verification not implemented for production');
    }
    async processSubscriptionReceipt(userId, receiptInfo, _verificationResponse) {
        const expiresMs = parseInt(receiptInfo.expires_date_ms, 10);
        const expiresAt = new Date(expiresMs);
        const productId = receiptInfo.product_id;
        const transactionId = receiptInfo.transaction_id;
        const originalTransactionId = receiptInfo.original_transaction_id;
        const tier = this.getTierFromProductId(productId);
        let subscription = await this.prisma.subscription.findFirst({
            where: {
                appleOriginalTransactionId: originalTransactionId,
            },
        });
        if (subscription) {
            subscription = await this.prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                    status: 'ACTIVE',
                    currentPeriodEnd: expiresAt,
                    appleTransactionId: transactionId,
                    lastRenewedAt: new Date(),
                },
            });
        }
        else {
            subscription = await this.prisma.subscription.create({
                data: {
                    userId,
                    subscriptionTier: tier,
                    status: 'ACTIVE',
                    appleProductId: productId,
                    appleTransactionId: transactionId,
                    appleOriginalTransactionId: originalTransactionId,
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: expiresAt,
                    autoRenew: receiptInfo.is_in_billing_retry_period === 'false',
                    isTrial: receiptInfo.is_trial_period === 'true',
                    isIntroOffer: receiptInfo.is_in_intro_offer_period === 'true',
                },
            });
        }
        await this.updateUserFeatures(userId, tier);
        await this.prisma.appleTransaction.create({
            data: {
                userId,
                transactionId,
                originalTransactionId,
                productId,
                type: 'subscription',
                status: 'completed',
                processedAt: new Date(),
            },
        });
        return subscription;
    }
    getTierFromProductId(productId) {
        if (productId.includes('community') || productId.includes('platinum'))
            return 'COMMUNITY';
        if (productId.includes('connect') || productId.includes('gold'))
            return 'CONNECT';
        if (productId.includes('discover') ||
            productId.includes('plus') ||
            productId.includes('basic'))
            return 'DISCOVER';
        return 'DISCOVER';
    }
    async updateUserFeatures(userId, tier) {
        const features = this.getFeaturesForTier(tier);
        await this.prisma.userPremiumFeatures.upsert({
            where: { userId },
            create: {
                userId,
                ...features,
            },
            update: features,
        });
    }
    getFeaturesForTier(tier) {
        const tiers = {
            platinum: {
                unlimitedLikes: true,
                whoLikedMe: true,
                topPicks: true,
                rewind: true,
                passport: true,
                incognito: true,
                boostsRemaining: 5,
                superLikesRemaining: 10,
            },
            gold: {
                unlimitedLikes: true,
                whoLikedMe: true,
                topPicks: true,
                rewind: true,
                passport: false,
                incognito: false,
                boostsRemaining: 2,
                superLikesRemaining: 5,
            },
            plus: {
                unlimitedLikes: true,
                whoLikedMe: true,
                topPicks: false,
                rewind: false,
                passport: false,
                incognito: false,
                boostsRemaining: 1,
                superLikesRemaining: 3,
            },
            basic: {
                unlimitedLikes: false,
                whoLikedMe: false,
                topPicks: false,
                rewind: false,
                passport: false,
                incognito: false,
                boostsRemaining: 0,
                superLikesRemaining: 1,
            },
            free: {
                unlimitedLikes: false,
                whoLikedMe: false,
                topPicks: false,
                rewind: false,
                passport: false,
                incognito: false,
                boostsRemaining: 0,
                superLikesRemaining: 0,
            },
        };
        return tiers[tier] || tiers.free;
    }
    async grantConsumableItems(userId, productId) {
        const grants = {
            'com.btdapp.boost.pack5': { type: 'boost', quantity: 5 },
            'com.btdapp.boost.pack10': { type: 'boost', quantity: 10 },
            'com.btdapp.superlike.pack5': { type: 'super_like', quantity: 5 },
            'com.btdapp.superlike.pack10': { type: 'super_like', quantity: 10 },
        };
        const grant = grants[productId];
        if (!grant) {
            throw new Error(`Unknown product: ${productId}`);
        }
        await this.prisma.userPremiumFeatures.upsert({
            where: { userId },
            create: {
                userId,
                boostsRemaining: grant.type === 'boost' ? grant.quantity : 0,
                superLikesRemaining: grant.type === 'super_like' ? grant.quantity : 0,
            },
            update: {
                boostsRemaining: grant.type === 'boost' ? { increment: grant.quantity } : undefined,
                superLikesRemaining: grant.type === 'super_like'
                    ? { increment: grant.quantity }
                    : undefined,
            },
        });
        return grant;
    }
    async getUserFeatures(userId) {
        const features = await this.prisma.userPremiumFeatures.findUnique({
            where: { userId },
        });
        if (!features) {
            return {
                unlimited_likes: false,
                who_liked_me: false,
                top_picks: false,
                rewind: false,
                passport: false,
                incognito: false,
                daily_super_likes_limit: 0,
                daily_boosts_limit: 0,
            };
        }
        return {
            unlimited_likes: features.unlimitedLikes,
            who_liked_me: features.whoLikedMe,
            top_picks: features.topPicks,
            rewind: features.rewind,
            passport: features.passport,
            incognito: features.incognito,
            daily_super_likes_limit: features.superLikesRemaining,
            daily_boosts_limit: features.boostsRemaining,
        };
    }
    async getUserUsage(userId) {
        const features = await this.prisma.userPremiumFeatures.findUnique({
            where: { userId },
        });
        if (!features) {
            return {
                boosts_remaining: 0,
                super_likes_remaining: 0,
                daily_likes_used: 0,
                daily_super_likes_used: 0,
            };
        }
        return {
            boosts_remaining: features.boostsRemaining,
            super_likes_remaining: features.superLikesRemaining,
            daily_likes_used: features.dailyLikesUsed,
            daily_super_likes_used: features.dailySuperLikesUsed,
        };
    }
    async formatSubscription(subscription) {
        if (!subscription)
            return null;
        const tierValue = subscription.tier ?? subscription.subscriptionTier;
        const plan = await this.prisma.subscriptionPlan.findFirst({
            where: {
                tier: tierValue,
            },
        });
        return {
            id: subscription.id,
            user_id: subscription.userId,
            plan: plan
                ? {
                    id: plan.id,
                    name: plan.name,
                    tier: plan.tier,
                    duration: plan.duration,
                    price: {
                        amount: plan.price.toNumber(),
                        currency: plan.currency,
                        formatted: `$${plan.price.toFixed(2)}`,
                    },
                    features: plan.features,
                }
                : null,
            status: subscription.status,
            start_date: subscription.startsAt?.toISOString() ??
                subscription.currentPeriodStart.toISOString(),
            end_date: subscription.expiresAt?.toISOString() ??
                subscription.currentPeriodEnd.toISOString(),
            next_billing_date: subscription.autoRenew
                ? (subscription.expiresAt?.toISOString() ??
                    subscription.currentPeriodEnd.toISOString())
                : null,
            auto_renew: subscription.autoRenew,
            is_trial: subscription.isTrial,
            tier: subscription.tier ?? subscription.subscriptionTier,
        };
    }
    async handleRenewalStatusChange(payload) {
        const { originalTransactionId, autoRenewStatus } = payload.data;
        if (!originalTransactionId) {
            throw new Error('Missing originalTransactionId in payload');
        }
        await this.prisma.subscription.updateMany({
            where: { appleOriginalTransactionId: originalTransactionId },
            data: { autoRenew: autoRenewStatus === '1' },
        });
        return `Updated auto-renew to ${autoRenewStatus === '1'}`;
    }
    async handleSubscriptionRenewal(payload) {
        const { originalTransactionId, expiresDate } = payload.data;
        if (!originalTransactionId || !expiresDate) {
            throw new Error('Missing required fields in payload');
        }
        await this.prisma.subscription.updateMany({
            where: { appleOriginalTransactionId: originalTransactionId },
            data: {
                currentPeriodEnd: new Date(parseInt(expiresDate, 10)),
                lastRenewedAt: new Date(),
                status: 'ACTIVE',
            },
        });
        return 'Subscription renewed';
    }
    async handleSubscriptionExpired(payload) {
        const { originalTransactionId } = payload.data;
        if (!originalTransactionId) {
            throw new Error('Missing originalTransactionId in payload');
        }
        await this.prisma.subscription.updateMany({
            where: { appleOriginalTransactionId: originalTransactionId },
            data: { status: 'EXPIRED' },
        });
        return 'Subscription expired';
    }
    async handleRefund(payload) {
        const { originalTransactionId, transactionId } = payload.data;
        if (!transactionId) {
            throw new Error('Missing transactionId in payload');
        }
        await this.prisma.appleTransaction.updateMany({
            where: { transactionId },
            data: { status: 'refunded' },
        });
        if (originalTransactionId) {
            await this.prisma.subscription.updateMany({
                where: { appleOriginalTransactionId: originalTransactionId },
                data: { status: 'CANCELLED' },
            });
        }
        return 'Refund processed';
    }
    async handleFailedRenewal(payload) {
        const { originalTransactionId } = payload.data;
        if (!originalTransactionId) {
            throw new Error('Missing originalTransactionId in payload');
        }
        await this.prisma.subscription.updateMany({
            where: { appleOriginalTransactionId: originalTransactionId },
            data: { status: 'BILLING_RETRY' },
        });
        return 'Marked as billing retry';
    }
};
exports.PaymentService = PaymentService;
exports.PaymentService = PaymentService = PaymentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], PaymentService);
//# sourceMappingURL=payment.service.js.map