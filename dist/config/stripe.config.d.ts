export interface SubscriptionPlan {
    id: string;
    name: string;
    description: string;
    price: number;
    interval: 'month' | 'year';
    features: string[];
    stripePriceId: string;
    stripeProductId: string;
    tier: 'DISCOVER' | 'CONNECT' | 'COMMUNITY';
}
declare const _default: (() => {
    secretKey: string | undefined;
    webhookSecret: string | undefined;
    publishableKey: string | undefined;
    currency: string;
    apiVersion: "2025-07-30.basil";
    webhookEvents: string[];
    plans: Record<string, SubscriptionPlan>;
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    secretKey: string | undefined;
    webhookSecret: string | undefined;
    publishableKey: string | undefined;
    currency: string;
    apiVersion: "2025-07-30.basil";
    webhookEvents: string[];
    plans: Record<string, SubscriptionPlan>;
}>;
export default _default;
