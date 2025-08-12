import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan } from '../config/stripe.config';
export declare class StripeService {
    private readonly configService;
    private readonly prisma;
    private readonly logger;
    private readonly stripe;
    private readonly plans;
    constructor(configService: ConfigService, prisma: PrismaService);
    createOrGetCustomer(userId: string, email: string, name?: string): Promise<string>;
    createPaymentIntent(userId: string, planId: string, paymentMethodId?: string, currency?: string): Promise<{
        clientSecret: string | null;
        paymentIntentId: string;
        amount: number;
        currency: string;
    }>;
    createSubscription(userId: string, planId: string, paymentMethodId: string): Promise<{
        subscriptionId: any;
        clientSecret: string | null;
        status: any;
        currentPeriodEnd: Date;
    }>;
    updateSubscription(userId: string, newPlanId?: string, cancelAtPeriodEnd?: boolean): Promise<Stripe.Response<Stripe.Subscription>>;
    cancelSubscription(userId: string, immediately?: boolean): Promise<void>;
    getBillingHistory(userId: string): Promise<any[]>;
    getPaymentMethods(userId: string): Promise<any[]>;
    createSetupIntent(userId: string): Promise<{
        clientSecret: string | null;
        setupIntentId: string;
    }>;
    deletePaymentMethod(userId: string, paymentMethodId: string): Promise<{
        success: boolean;
    }>;
    setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<{
        success: boolean;
    }>;
    getAvailablePlans(): SubscriptionPlan[];
    getCurrentSubscription(userId: string): Promise<{
        id: string;
        userId: string;
        stripeSubscriptionId: string | null;
        subscriptionTier: import(".prisma/client").$Enums.SubscriptionTier;
        stripeCustomerId: string | null;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: boolean;
        cancelledAt: Date | null;
        planId: string | null;
        trialEnd: Date | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    cancelSubscriptionImmediately(userId: string, subscriptionId: string): Promise<void>;
    reactivateSubscription(userId: string, subscriptionId: string): Promise<{
        subscriptionId: string;
        clientSecret: null;
        status: "ACTIVE";
        currentPeriodEnd: Date;
    }>;
    createCheckoutSession(userId: string, userEmail: string, priceId: string, successUrl: string, cancelUrl: string): Promise<{
        sessionId: string;
        url: string;
    }>;
    createPortalSession(userId: string, returnUrl: string): Promise<{
        url: string;
    }>;
}
