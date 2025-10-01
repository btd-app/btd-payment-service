import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly appleVerifyUrl: string;
  private readonly applePassword: string;
  private readonly environment: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.environment = this.config.get<string>('NODE_ENV', 'development');
    this.applePassword = this.config.get<string>('APPLE_SHARED_SECRET', '');

    this.appleVerifyUrl = this.environment === 'production'
      ? 'https://buy.itunes.apple.com/verifyReceipt'
      : 'https://sandbox.itunes.apple.com/verifyReceipt';
  }

  async validateAppleReceipt(data: {
    receipt_data: string;
    user_id: string;
    source: string;
  }) {
    this.logger.debug(`Validating Apple receipt for user: ${data.user_id}`);

    try {
      // Verify receipt with Apple
      const verificationResponse = await this.verifyWithApple(data.receipt_data);

      if (verificationResponse.status !== 0) {
        throw new Error(`Apple verification failed with status: ${verificationResponse.status}`);
      }

      // Parse latest receipt info
      const latestReceiptInfo = verificationResponse.latest_receipt_info?.[0];
      if (!latestReceiptInfo) {
        throw new Error('No receipt info found');
      }

      // Check if it's a subscription or consumable
      const productId = latestReceiptInfo.product_id;
      const isSubscription = !productId.includes('consumable');

      if (isSubscription) {
        // Process subscription
        const subscription = await this.processSubscriptionReceipt(
          data.user_id,
          latestReceiptInfo,
          verificationResponse,
        );

        return {
          success: true,
          subscription: await this.formatSubscription(subscription),
        };
      } else {
        // This shouldn't happen for subscription validation
        throw new Error('Receipt is for a consumable product, not a subscription');
      }
    } catch (error) {
      this.logger.error(`Receipt validation failed: ${error.message}`);
      return {
        success: false,
        error_message: error.message,
      };
    }
  }

  async processAppleWebhook(data: {
    signed_payload: string;
    headers: Record<string, string>;
  }) {
    this.logger.debug('Processing Apple webhook');

    try {
      // Verify JWT signature
      const payload = await this.verifyAppleJWT(data.signed_payload);

      // Log webhook for audit
      await this.prisma.appleWebhookLog.create({
        data: {
          notificationType: payload.notificationType,
          signedPayload: data.signed_payload,
          status: 'processing',
        },
      });

      // Process based on notification type
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

      // Update webhook log
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
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);

      // Log failed webhook
      await this.prisma.appleWebhookLog.create({
        data: {
          notificationType: 'unknown',
          signedPayload: data.signed_payload,
          status: 'failed',
          errorMessage: error.message,
        },
      });

      return {
        success: false,
        error_message: error.message,
      };
    }
  }

  async processConsumablePurchase(data: {
    user_id: string;
    product_id: string;
    transaction_id: string;
    receipt_data: string;
  }) {
    this.logger.debug(`Processing consumable purchase: ${data.product_id}`);

    try {
      // Check if transaction already processed
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

      // Verify receipt with Apple
      const verificationResponse = await this.verifyWithApple(data.receipt_data);

      if (verificationResponse.status !== 0) {
        throw new Error(`Apple verification failed with status: ${verificationResponse.status}`);
      }

      // Find the specific transaction
      const transaction = verificationResponse.receipt?.in_app?.find(
        (t: any) => t.transaction_id === data.transaction_id,
      );

      if (!transaction) {
        throw new Error('Transaction not found in receipt');
      }

      // Record transaction
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

      // Grant consumable items
      const granted = await this.grantConsumableItems(data.user_id, data.product_id);

      return {
        success: true,
        granted,
      };
    } catch (error) {
      this.logger.error(`Consumable purchase failed: ${error.message}`);
      return {
        success: false,
        error_message: error.message,
      };
    }
  }

  async getUserSubscription(data: { user_id: string }) {
    this.logger.debug(`Getting subscription for user: ${data.user_id}`);

    try {
      // Get active subscription
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          userId: data.user_id,
          status: 'active',
        },
        orderBy: {
          expiresAt: 'desc',
        },
      });

      if (!subscription) {
        return {
          has_subscription: false,
        };
      }

      // Get user features and usage
      const features = await this.getUserFeatures(data.user_id);
      const usage = await this.getUserUsage(data.user_id);

      return {
        has_subscription: true,
        subscription: await this.formatSubscription(subscription),
        features,
        usage,
      };
    } catch (error) {
      this.logger.error(`Get subscription failed: ${error.message}`);
      return {
        has_subscription: false,
      };
    }
  }

  async updateSubscriptionStatus(data: {
    user_id: string;
    status: string;
    reason: string;
  }) {
    this.logger.debug(`Updating subscription status for user: ${data.user_id}`);

    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          userId: data.user_id,
          status: 'active',
        },
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const updated = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: data.status,
          cancelledAt: data.status === 'cancelled' ? new Date() : undefined,
        },
      });

      return {
        success: true,
        subscription: await this.formatSubscription(updated),
      };
    } catch (error) {
      this.logger.error(`Update subscription failed: ${error.message}`);
      return {
        success: false,
      };
    }
  }

  async cancelSubscription(data: {
    user_id: string;
    reason: string;
    immediate: boolean;
  }) {
    this.logger.debug(`Cancelling subscription for user: ${data.user_id}`);

    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: {
          userId: data.user_id,
          status: 'active',
        },
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const cancellationDate = data.immediate ? new Date() : subscription.expiresAt;

      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: data.immediate ? 'cancelled' : 'active',
          autoRenew: false,
          cancelledAt: new Date(),
        },
      });

      return {
        success: true,
        cancellation_date: cancellationDate.toISOString(),
      };
    } catch (error) {
      this.logger.error(`Cancel subscription failed: ${error.message}`);
      return {
        success: false,
      };
    }
  }

  // Private helper methods

  private async verifyWithApple(receiptData: string) {
    const response = await axios.post(this.appleVerifyUrl, {
      'receipt-data': receiptData,
      password: this.applePassword,
      'exclude-old-transactions': true,
    });

    return response.data;
  }

  private async verifyAppleJWT(signedPayload: string): Promise<any> {
    // In production, verify with Apple's public key
    // For now, decode without verification (development only)
    if (this.environment === 'development') {
      const parts = signedPayload.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload.data;
    }

    // Production: Verify with Apple's public key
    // This would require fetching Apple's public keys and verifying
    throw new Error('JWT verification not implemented for production');
  }

  private async processSubscriptionReceipt(
    userId: string,
    receiptInfo: any,
    verificationResponse: any,
  ) {
    const expiresMs = parseInt(receiptInfo.expires_date_ms);
    const expiresAt = new Date(expiresMs);
    const productId = receiptInfo.product_id;
    const transactionId = receiptInfo.transaction_id;
    const originalTransactionId = receiptInfo.original_transaction_id;

    // Determine tier from product ID
    const tier = this.getTierFromProductId(productId);

    // Check if subscription exists
    let subscription = await this.prisma.subscription.findFirst({
      where: {
        appleOriginalTransactionId: originalTransactionId,
      },
    });

    if (subscription) {
      // Update existing subscription
      subscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          expiresAt,
          appleTransactionId: transactionId,
          lastRenewedAt: new Date(),
        },
      });
    } else {
      // Create new subscription
      subscription = await this.prisma.subscription.create({
        data: {
          userId,
          tier,
          status: 'active',
          appleProductId: productId,
          appleTransactionId: transactionId,
          appleOriginalTransactionId: originalTransactionId,
          startsAt: new Date(),
          expiresAt,
          autoRenew: receiptInfo.is_in_billing_retry_period === 'false',
          isTrial: receiptInfo.is_trial_period === 'true',
          isIntroOffer: receiptInfo.is_in_intro_offer_period === 'true',
        },
      });
    }

    // Update user features based on tier
    await this.updateUserFeatures(userId, tier);

    // Record transaction
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

  private getTierFromProductId(productId: string): string {
    if (productId.includes('platinum')) return 'platinum';
    if (productId.includes('gold')) return 'gold';
    if (productId.includes('plus')) return 'plus';
    if (productId.includes('basic')) return 'basic';
    return 'free';
  }

  private async updateUserFeatures(userId: string, tier: string) {
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

  private getFeaturesForTier(tier: string) {
    const tiers: Record<string, any> = {
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

  private async grantConsumableItems(userId: string, productId: string) {
    const grants: Record<string, any> = {
      'com.btdapp.boost.pack5': { type: 'boost', quantity: 5 },
      'com.btdapp.boost.pack10': { type: 'boost', quantity: 10 },
      'com.btdapp.superlike.pack5': { type: 'super_like', quantity: 5 },
      'com.btdapp.superlike.pack10': { type: 'super_like', quantity: 10 },
    };

    const grant = grants[productId];
    if (!grant) {
      throw new Error(`Unknown product: ${productId}`);
    }

    // Update user features
    const features = await this.prisma.userPremiumFeatures.upsert({
      where: { userId },
      create: {
        userId,
        boostsRemaining: grant.type === 'boost' ? grant.quantity : 0,
        superLikesRemaining: grant.type === 'super_like' ? grant.quantity : 0,
      },
      update: {
        boostsRemaining: grant.type === 'boost'
          ? { increment: grant.quantity }
          : undefined,
        superLikesRemaining: grant.type === 'super_like'
          ? { increment: grant.quantity }
          : undefined,
      },
    });

    return grant;
  }

  private async getUserFeatures(userId: string) {
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

  private async getUserUsage(userId: string) {
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

  private async formatSubscription(subscription: any) {
    if (!subscription) return null;

    // Get plan details
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: {
        tier: subscription.tier,
      },
    });

    return {
      id: subscription.id,
      user_id: subscription.userId,
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        duration: plan.duration,
        price: {
          amount: plan.price.toNumber(),
          currency: plan.currency,
          formatted: `$${plan.price.toFixed(2)}`,
        },
        features: plan.features as any[],
      } : null,
      status: subscription.status,
      start_date: subscription.startsAt.toISOString(),
      end_date: subscription.expiresAt.toISOString(),
      next_billing_date: subscription.autoRenew ? subscription.expiresAt.toISOString() : null,
      auto_renew: subscription.autoRenew,
      is_trial: subscription.isTrial,
      tier: subscription.tier,
    };
  }

  // Webhook handlers

  private async handleRenewalStatusChange(payload: any): Promise<string> {
    const { originalTransactionId, autoRenewStatus } = payload.data;

    await this.prisma.subscription.updateMany({
      where: { appleOriginalTransactionId: originalTransactionId },
      data: { autoRenew: autoRenewStatus === '1' },
    });

    return `Updated auto-renew to ${autoRenewStatus === '1'}`;
  }

  private async handleSubscriptionRenewal(payload: any): Promise<string> {
    const { originalTransactionId, expiresDate } = payload.data;

    await this.prisma.subscription.updateMany({
      where: { appleOriginalTransactionId: originalTransactionId },
      data: {
        expiresAt: new Date(parseInt(expiresDate)),
        lastRenewedAt: new Date(),
        status: 'active',
      },
    });

    return 'Subscription renewed';
  }

  private async handleSubscriptionExpired(payload: any): Promise<string> {
    const { originalTransactionId } = payload.data;

    await this.prisma.subscription.updateMany({
      where: { appleOriginalTransactionId: originalTransactionId },
      data: { status: 'expired' },
    });

    return 'Subscription expired';
  }

  private async handleRefund(payload: any): Promise<string> {
    const { originalTransactionId, transactionId } = payload.data;

    // Mark transaction as refunded
    await this.prisma.appleTransaction.updateMany({
      where: { transactionId },
      data: { status: 'refunded' },
    });

    // Cancel subscription
    await this.prisma.subscription.updateMany({
      where: { appleOriginalTransactionId: originalTransactionId },
      data: { status: 'cancelled' },
    });

    return 'Refund processed';
  }

  private async handleFailedRenewal(payload: any): Promise<string> {
    const { originalTransactionId } = payload.data;

    await this.prisma.subscription.updateMany({
      where: { appleOriginalTransactionId: originalTransactionId },
      data: { status: 'billing_retry' },
    });

    return 'Marked as billing retry';
  }
}