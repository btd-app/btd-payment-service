import { Metadata, ServerUnaryCall } from '@grpc/grpc-js';
import { Observable } from 'rxjs';
import { SubscriptionService } from '../services/subscription.service';
import { StripeService } from '../services/stripe.service';
import { PrismaService } from '../prisma/prisma.service';
interface CreateSubscriptionRequest {
    userId: string;
    planId: string;
    paymentMethodId?: string;
    promoCode?: string;
    metadata?: Record<string, string>;
    userEmail?: string;
    userName?: string;
}
interface ProcessPaymentRequest {
    userId: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    description?: string;
    metadata?: Record<string, string>;
    savePaymentMethod?: boolean;
}
interface PaymentEvent {
    eventId: string;
    eventType: string;
    userId?: string;
    data: Record<string, string>;
    timestamp: string;
    source: string;
}
export declare class PaymentGrpcController {
    private readonly subscriptionService;
    private readonly stripeService;
    private readonly prisma;
    private readonly logger;
    private readonly eventStream;
    private streamCounter;
    constructor(subscriptionService: SubscriptionService, stripeService: StripeService, prisma: PrismaService);
    createSubscription(data: CreateSubscriptionRequest, metadata: Metadata, call: ServerUnaryCall<any, any>): Promise<any>;
    updateSubscription(data: any, metadata: Metadata): Promise<any>;
    cancelSubscription(data: any, metadata: Metadata): Promise<any>;
    getSubscription(data: any, metadata: Metadata): Promise<any>;
    processPayment(data: ProcessPaymentRequest, metadata: Metadata, call: ServerUnaryCall<any, any>): Promise<any>;
    addPaymentMethod(data: any, metadata: Metadata): Promise<any>;
    getPaymentMethods(data: any, metadata: Metadata): Promise<any>;
    getPricingPlans(data: any, metadata: Metadata): Promise<any>;
    getInvoices(data: any, metadata: Metadata): Promise<any>;
    processStripeWebhook(data: any, metadata: Metadata): Promise<any>;
    getPaymentHealth(data: any, metadata: Metadata): Promise<any>;
    streamPaymentEvents(data: any, metadata: Metadata): Observable<PaymentEvent>;
    private emitPaymentEvent;
    private getFeatureFlagsForPlan;
    private getPlanAmount;
    private extractFeatureFlags;
    private getPlanFeatureList;
    getUserSubscriptions(data: any): Promise<any>;
    refundPayment(data: any): Promise<any>;
    getPaymentHistory(data: any): Promise<any>;
    removePaymentMethod(data: any): Promise<any>;
    setDefaultPaymentMethod(data: any): Promise<any>;
    getUpcomingInvoice(data: any): Promise<any>;
    validatePromoCode(data: any): Promise<any>;
}
export {};
