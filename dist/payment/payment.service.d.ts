import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class PaymentService {
    private readonly prisma;
    private readonly config;
    private readonly logger;
    private readonly appleVerifyUrl;
    private readonly applePassword;
    private readonly environment;
    constructor(prisma: PrismaService, config: ConfigService);
    validateAppleReceipt(data: {
        receipt_data: string;
        user_id: string;
        source: string;
    }): Promise<{
        success: boolean;
        subscription: Record<string, unknown>;
        error_message?: undefined;
    } | {
        success: boolean;
        error_message: string;
        subscription?: undefined;
    }>;
    processAppleWebhook(data: {
        signed_payload: string;
        headers: Record<string, string>;
    }): Promise<{
        success: boolean;
        notification_type: string;
        action_taken: string;
        error_message?: undefined;
    } | {
        success: boolean;
        error_message: string;
        notification_type?: undefined;
        action_taken?: undefined;
    }>;
    processConsumablePurchase(data: {
        user_id: string;
        product_id: string;
        transaction_id: string;
        receipt_data: string;
    }): Promise<{
        success: boolean;
        error_message: string;
        granted?: undefined;
    } | {
        success: boolean;
        granted: {
            type: string;
            quantity: number;
        };
        error_message?: undefined;
    }>;
    getUserSubscription(data: {
        user_id: string;
    }): Promise<{
        has_subscription: boolean;
        subscription?: undefined;
        features?: undefined;
        usage?: undefined;
    } | {
        has_subscription: boolean;
        subscription: Record<string, unknown>;
        features: {
            unlimited_likes: boolean;
            who_liked_me: boolean;
            top_picks: boolean;
            rewind: boolean;
            passport: boolean;
            incognito: boolean;
            daily_super_likes_limit: number;
            daily_boosts_limit: number;
        };
        usage: {
            boosts_remaining: number;
            super_likes_remaining: number;
            daily_likes_used: number;
            daily_super_likes_used: number;
        };
    }>;
    updateSubscriptionStatus(data: {
        user_id: string;
        status: string;
        reason: string;
    }): Promise<{
        success: boolean;
        subscription: Record<string, unknown>;
    } | {
        success: boolean;
        subscription?: undefined;
    }>;
    cancelSubscription(data: {
        user_id: string;
        reason: string;
        immediate: boolean;
    }): Promise<{
        success: boolean;
        cancellation_date: string;
    } | {
        success: boolean;
        cancellation_date?: undefined;
    }>;
    private verifyWithApple;
    private verifyAppleJWT;
    private processSubscriptionReceipt;
    private getTierFromProductId;
    private updateUserFeatures;
    private getFeaturesForTier;
    private grantConsumableItems;
    private getUserFeatures;
    private getUserUsage;
    private formatSubscription;
    private handleRenewalStatusChange;
    private handleSubscriptionRenewal;
    private handleSubscriptionExpired;
    private handleRefund;
    private handleFailedRenewal;
}
