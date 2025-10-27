import { Redis } from 'ioredis';
export interface PaymentEvent {
    type: string;
    userId: string;
    data: Record<string, unknown>;
    timestamp: Date;
    correlationId?: string;
}
export declare class RedisService {
    private readonly redis;
    private readonly logger;
    constructor(redis: Redis);
    publishPaymentEvent(event: PaymentEvent): Promise<void>;
    publishSubscriptionCreated(userId: string, subscriptionData: Record<string, unknown>): Promise<void>;
    publishSubscriptionUpdated(userId: string, subscriptionData: Record<string, unknown>): Promise<void>;
    publishSubscriptionCancelled(userId: string, subscriptionData: Record<string, unknown>): Promise<void>;
    publishPaymentSucceeded(userId: string, paymentData: Record<string, unknown>): Promise<void>;
    publishPaymentFailed(userId: string, paymentData: Record<string, unknown>): Promise<void>;
    publishFeatureAccessGranted(userId: string, feature: string, tier: string): Promise<void>;
    publishFeatureAccessRevoked(userId: string, feature: string, reason: string): Promise<void>;
    publishTrialEnding(userId: string, daysRemaining: number): Promise<void>;
    getCachedSubscription(userId: string): Promise<Record<string, unknown> | null>;
    cacheSubscription(userId: string, subscriptionData: Record<string, unknown>, ttl?: number): Promise<void>;
    invalidateSubscriptionCache(userId: string): Promise<void>;
}
