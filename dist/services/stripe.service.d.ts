import { ConfigService } from '@nestjs/config';
import '../types/external';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus, BillingHistory, PaymentMethod } from '@prisma/client';
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
        clientSecret: string;
        paymentIntentId: string;
        amount: number;
        currency: string;
    }>;
    createSubscription(userId: string, planId: string, paymentMethodId: string): Promise<{
        subscriptionId: string;
        clientSecret: string | null;
        status: SubscriptionStatus;
        currentPeriodEnd: Date;
    }>;
    updateSubscription(userId: string, newPlanId?: string, cancelAtPeriodEnd?: boolean): Promise<Stripe.Response<Stripe.Subscription>>;
    cancelSubscription(userId: string, immediately?: boolean): Promise<void>;
    getBillingHistory(userId: string): Promise<BillingHistory[]>;
    getPaymentMethods(userId: string): Promise<PaymentMethod[]>;
    createSetupIntent(userId: string): Promise<{
        clientSecret: string;
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
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        id: string;
        createdAt: Date;
        userId: string;
        subscriptionTier: import(".prisma/client").$Enums.SubscriptionTier;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        planId: string | null;
        appleProductId: string | null;
        appleTransactionId: string | null;
        appleOriginalTransactionId: string | null;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelledAt: Date | null;
        lastRenewedAt: Date | null;
        trialEnd: Date | null;
        autoRenew: boolean;
        cancelAtPeriodEnd: boolean;
        isTrial: boolean;
        isIntroOffer: boolean;
        updatedAt: Date;
    }>;
    cancelSubscriptionImmediately(userId: string, subscriptionId: string): Promise<void>;
    reactivateSubscription(userId: string, subscriptionId: string): Promise<{
        subscriptionId: string;
        clientSecret: any;
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
