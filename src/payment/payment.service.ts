import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import axios from 'axios';

/**
 * Apple receipt verification response structure
 */
interface AppleReceiptInfo {
  product_id: string;
  transaction_id: string;
  original_transaction_id: string;
  expires_date_ms: string;
  is_in_billing_retry_period?: string;
  is_trial_period?: string;
  is_in_intro_offer_period?: string;
}

/**
 * Apple receipt data embedded in verification response
 */
interface AppleReceipt {
  in_app?: AppleReceiptInfo[];
}

/**
 * Complete Apple verification response from their API
 */
interface AppleVerificationResponse {
  status: number;
  latest_receipt_info?: AppleReceiptInfo[];
  receipt?: AppleReceipt;
}

/**
 * Apple webhook JWT payload structure
 */
interface AppleWebhookPayload {
  notificationType: string;
  data: {
    originalTransactionId?: string;
    autoRenewStatus?: string;
    expiresDate?: string;
    transactionId?: string;
  };
}

/**
 * Subscription data returned from Prisma
 */
interface SubscriptionData {
  id: string;
  userId: string;
  subscriptionTier?: SubscriptionTier;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  autoRenew: boolean;
  isTrial: boolean;
  tier?: SubscriptionTier;
  startsAt?: Date;
  expiresAt?: Date;
}

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
    this.environment = this.config.get('NODE_ENV') ?? 'development';
    this.applePassword = this.config.get('APPLE_SHARED_SECRET') ?? '';

    this.appleVerifyUrl =
      this.environment === 'production'
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
      const verificationResponse = await this.verifyWithApple(
        data.receipt_data,
      );

      if (verificationResponse.status !== 0) {
        throw new Error(
          `Apple verification failed with status: ${verificationResponse.status}`,
        );
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
        throw new Error(
          'Receipt is for a consumable product, not a subscription',
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Receipt validation failed: ${errorMessage}`);
      return {
        success: false,
        error_message: errorMessage,
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
      const payload = this.verifyAppleJWT(data.signed_payload);

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
          this.logger.warn(
            `Unhandled notification type: ${payload.notificationType}`,
          );
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing failed: ${errorMessage}`);

      // Log failed webhook
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

  async processConsumablePurchase(data: {
    user_id: string;
    product_id: string;
    transaction_id: string;
    receipt_data: string;
  }) {
    this.logger.debug(`Processing consumable purchase: ${data.product_id}`);

    try {
      // Check if transaction already processed
      const existingTransaction = await this.prisma.appleTransaction.findUnique(
        {
          where: { transactionId: data.transaction_id },
        },
      );

      if (existingTransaction) {
        this.logger.warn(
          `Transaction already processed: ${data.transaction_id}`,
        );
        return {
          success: false,
          error_message: 'Transaction already processed',
        };
      }

      // Verify receipt with Apple
      const verificationResponse = await this.verifyWithApple(
        data.receipt_data,
      );

      if (verificationResponse.status !== 0) {
        throw new Error(
          `Apple verification failed with status: ${verificationResponse.status}`,
        );
      }

      // Find the specific transaction
      const transaction = verificationResponse.receipt?.in_app?.find(
        (t) => t.transaction_id === data.transaction_id,
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
      const granted = await this.grantConsumableItems(
        data.user_id,
        data.product_id,
      );

      return {
        success: true,
        granted,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Consumable purchase failed: ${errorMessage}`);
      return {
        success: false,
        error_message: errorMessage,
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Get subscription failed: ${errorMessage}`);
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
          status: 'ACTIVE',
        },
      });

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Validate status is a valid SubscriptionStatus
      const validStatuses: string[] = Object.values(SubscriptionStatus);
      if (!validStatuses.includes(data.status)) {
        throw new Error(`Invalid status: ${data.status}`);
      }

      const updated = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: data.status as SubscriptionStatus,
          cancelledAt: data.status === 'CANCELLED' ? new Date() : undefined,
        },
      });

      return {
        success: true,
        subscription: await this.formatSubscription(updated),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Update subscription failed: ${errorMessage}`);
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cancel subscription failed: ${errorMessage}`);
      return {
        success: false,
      };
    }
  }

  // Private helper methods

  /**
   * Verify receipt with Apple's verification API
   * @param receiptData Base64-encoded receipt data from client
   * @returns Typed Apple verification response
   */
  private async verifyWithApple(
    receiptData: string,
  ): Promise<AppleVerificationResponse> {
    const response = await axios.post<AppleVerificationResponse>(
      this.appleVerifyUrl,
      {
        'receipt-data': receiptData,
        password: this.applePassword,
        'exclude-old-transactions': true,
      },
    );

    return response.data;
  }

  /**
   * Verify Apple JWT webhook payload
   * @param signedPayload JWT signed by Apple
   * @returns Decoded webhook payload
   */
  private verifyAppleJWT(signedPayload: string): AppleWebhookPayload {
    // In production, verify with Apple's public key
    // For now, decode without verification (development only)
    if (this.environment === 'development') {
      const parts = signedPayload.split('.');
      const payloadString = Buffer.from(parts[1], 'base64').toString();
      const decoded = JSON.parse(payloadString) as {
        data: AppleWebhookPayload;
      };
      return decoded.data;
    }

    // Production: Verify with Apple's public key
    // This would require fetching Apple's public keys and verifying
    throw new Error('JWT verification not implemented for production');
  }

  /**
   * Process subscription receipt from Apple verification
   * @param userId User ID
   * @param receiptInfo Receipt information from Apple
   * @param verificationResponse Full verification response (unused but kept for future use)
   * @returns Created or updated subscription
   */
  private async processSubscriptionReceipt(
    userId: string,
    receiptInfo: AppleReceiptInfo,
    _verificationResponse: AppleVerificationResponse,
  ): Promise<SubscriptionData> {
    const expiresMs = parseInt(receiptInfo.expires_date_ms, 10);
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
          status: 'ACTIVE',
          currentPeriodEnd: expiresAt,
          appleTransactionId: transactionId,
          lastRenewedAt: new Date(),
        },
      });
    } else {
      // Create new subscription
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

  private getTierFromProductId(
    productId: string,
  ): 'DISCOVER' | 'CONNECT' | 'COMMUNITY' {
    // Map Apple product IDs to subscription tiers
    if (productId.includes('community') || productId.includes('platinum'))
      return 'COMMUNITY';
    if (productId.includes('connect') || productId.includes('gold'))
      return 'CONNECT';
    if (
      productId.includes('discover') ||
      productId.includes('plus') ||
      productId.includes('basic')
    )
      return 'DISCOVER';
    return 'DISCOVER';
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

  /**
   * Get premium features configuration for a subscription tier
   * @param tier Subscription tier name
   * @returns Feature configuration object
   */
  private getFeaturesForTier(tier: string): {
    unlimitedLikes: boolean;
    whoLikedMe: boolean;
    topPicks: boolean;
    rewind: boolean;
    passport: boolean;
    incognito: boolean;
    boostsRemaining: number;
    superLikesRemaining: number;
  } {
    const tiers: Record<
      string,
      {
        unlimitedLikes: boolean;
        whoLikedMe: boolean;
        topPicks: boolean;
        rewind: boolean;
        passport: boolean;
        incognito: boolean;
        boostsRemaining: number;
        superLikesRemaining: number;
      }
    > = {
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

  /**
   * Grant consumable items (boosts, super likes) based on product ID
   * @param userId User ID to grant items to
   * @param productId Product ID that was purchased
   * @returns Grant details including type and quantity
   */
  private async grantConsumableItems(
    userId: string,
    productId: string,
  ): Promise<{ type: string; quantity: number }> {
    const grants: Record<string, { type: string; quantity: number }> = {
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
    await this.prisma.userPremiumFeatures.upsert({
      where: { userId },
      create: {
        userId,
        boostsRemaining: grant.type === 'boost' ? grant.quantity : 0,
        superLikesRemaining: grant.type === 'super_like' ? grant.quantity : 0,
      },
      update: {
        boostsRemaining:
          grant.type === 'boost' ? { increment: grant.quantity } : undefined,
        superLikesRemaining:
          grant.type === 'super_like'
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

  /**
   * Format subscription data for API response
   * @param subscription Prisma subscription object
   * @returns Formatted subscription data or null
   */
  private async formatSubscription(
    subscription: SubscriptionData | null,
  ): Promise<Record<string, unknown> | null> {
    if (!subscription) return null;

    // Get plan details
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
            features: plan.features as unknown[],
          }
        : null,
      status: subscription.status,
      start_date:
        subscription.startsAt?.toISOString() ??
        subscription.currentPeriodStart.toISOString(),
      end_date:
        subscription.expiresAt?.toISOString() ??
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

  // Webhook handlers

  /**
   * Handle renewal status change webhook from Apple
   * @param payload Apple webhook payload
   * @returns Status message
   */
  private async handleRenewalStatusChange(
    payload: AppleWebhookPayload,
  ): Promise<string> {
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

  /**
   * Handle subscription renewal webhook from Apple
   * @param payload Apple webhook payload
   * @returns Status message
   */
  private async handleSubscriptionRenewal(
    payload: AppleWebhookPayload,
  ): Promise<string> {
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

  /**
   * Handle subscription expired webhook from Apple
   * @param payload Apple webhook payload
   * @returns Status message
   */
  private async handleSubscriptionExpired(
    payload: AppleWebhookPayload,
  ): Promise<string> {
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

  /**
   * Handle refund webhook from Apple
   * @param payload Apple webhook payload
   * @returns Status message
   */
  private async handleRefund(payload: AppleWebhookPayload): Promise<string> {
    const { originalTransactionId, transactionId } = payload.data;

    if (!transactionId) {
      throw new Error('Missing transactionId in payload');
    }

    // Mark transaction as refunded
    await this.prisma.appleTransaction.updateMany({
      where: { transactionId },
      data: { status: 'refunded' },
    });

    // Cancel subscription if originalTransactionId is provided
    if (originalTransactionId) {
      await this.prisma.subscription.updateMany({
        where: { appleOriginalTransactionId: originalTransactionId },
        data: { status: 'CANCELLED' },
      });
    }

    return 'Refund processed';
  }

  /**
   * Handle failed renewal webhook from Apple
   * @param payload Apple webhook payload
   * @returns Status message
   */
  private async handleFailedRenewal(
    payload: AppleWebhookPayload,
  ): Promise<string> {
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
}
