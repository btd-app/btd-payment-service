import { Redis } from 'ioredis';
export interface PaymentEvent {
    type: string;
    userId: string;
    data: any;
    timestamp: Date;
    correlationId?: string;
}
export declare class RedisService {
    private readonly redis;
    private readonly logger;
    constructor(redis: Redis);
    publishPaymentEvent(event: PaymentEvent): Promise<void>;
    publishSubscriptionCreated(userId: string, subscriptionData: any): Promise<void>;
    publishSubscriptionUpdated(userId: string, subscriptionData: any): Promise<void>;
    publishSubscriptionCancelled(userId: string, subscriptionData: any): Promise<void>;
    publishPaymentSucceeded(userId: string, paymentData: any): Promise<void>;
    publishPaymentFailed(userId: string, paymentData: any): Promise<void>;
    publishFeatureAccessGranted(userId: string, feature: string, tier: string): Promise<void>;
    publishFeatureAccessRevoked(userId: string, feature: string, reason: string): Promise<void>;
    publishTrialEnding(userId: string, daysRemaining: number): Promise<void>;
    getCachedSubscription(userId: string): Promise<any>;
    cacheSubscription(userId: string, subscriptionData: any, ttl?: number): Promise<void>;
    invalidateSubscriptionCache(userId: string): Promise<void>;
}
