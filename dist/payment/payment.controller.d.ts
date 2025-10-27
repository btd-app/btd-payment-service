import { PaymentService } from './payment.service';
export declare class PaymentController {
    private readonly paymentService;
    private readonly logger;
    constructor(paymentService: PaymentService);
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
    getTransactionHistory(data: {
        user_id: string;
        limit: number;
        offset: number;
    }): Promise<{
        transactions: {
            id: string;
            user_id: string;
            transaction_id: string;
            original_transaction_id: string;
            product_id: string;
            type: string;
            amount: number;
            currency: string;
            status: string;
            processed_at: string;
            created_at: string;
        }[];
        total: number;
    }>;
    recordTransaction(data: {
        user_id: string;
        transaction_id: string;
        product_id: string;
        type: string;
        amount: number;
        currency: string;
    }): Promise<{
        success: boolean;
        transaction: {
            id: string;
            user_id: string;
            transaction_id: string;
            product_id: string;
            type: string;
            amount: number;
            currency: string;
            status: string;
            processed_at: string;
            created_at: string;
        };
    } | {
        success: boolean;
        transaction?: undefined;
    }>;
    getHealth(): Promise<{
        healthy: boolean;
        timestamp: string;
        version: string;
    }>;
}
