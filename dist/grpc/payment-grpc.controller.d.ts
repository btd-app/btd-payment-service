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
interface CreateSubscriptionResponse {
    subscription: Subscription;
    clientSecret?: string;
    requiresAction: boolean;
}
interface UpdateSubscriptionRequest {
    subscriptionId: string;
    userId: string;
    newPlanId: string;
    prorate?: boolean;
    effectiveDate?: string;
    cancelAtPeriodEnd?: boolean;
}
interface UpdateSubscriptionResponse {
    subscription: Subscription;
    prorationAmount: number;
}
interface CancelSubscriptionRequest {
    subscriptionId: string;
    userId: string;
    cancelImmediately: boolean;
    cancellationReason?: string;
    feedback?: string;
}
interface CancelSubscriptionResponse {
    success: boolean;
    cancelledAt: string;
    endsAt: string;
}
interface GetSubscriptionRequest {
    subscriptionId: string;
    userId: string;
}
interface GetSubscriptionResponse {
    subscription: Subscription;
}
interface GetUserSubscriptionsRequest {
    userId: string;
    includeCancelled?: boolean;
    limit?: number;
    startingAfter?: string;
}
interface GetUserSubscriptionsResponse {
    subscriptions: Subscription[];
    hasMore: boolean;
}
interface Subscription {
    id: string;
    userId: string;
    planId: string;
    status: string;
    amount: number;
    currency: string;
    interval: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    createdAt: string;
    cancelledAt?: string;
    endsAt?: string;
    metadata?: Record<string, string>;
    featureFlags?: string[];
    tier?: string;
    cancelAtPeriodEnd?: boolean;
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
interface ProcessPaymentResponse {
    payment: Payment | null;
    clientSecret: string | null;
    requiresAction: boolean;
    error: string | null;
}
interface Payment {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    status: string;
    description?: string;
    paymentMethodId: string;
    createdAt: string;
    metadata?: Record<string, string>;
    invoiceId?: string;
    subscriptionId?: string;
}
interface GetPaymentHistoryRequest {
    userId: string;
    limit?: number;
    offset?: number;
    startingAfter?: string;
    endingBefore?: string;
}
interface GetPaymentHistoryResponse {
    payments: Payment[];
    hasMore: boolean;
}
interface RefundPaymentRequest {
    paymentId: string;
    userId: string;
    amount?: number;
    reason?: string;
}
interface RefundPaymentResponse {
    refund: Refund | null;
    success: boolean;
    error?: string;
}
interface Refund {
    id: string;
    paymentId: string;
    amount: number;
    currency: string;
    status: string;
    reason?: string;
    createdAt: string;
}
interface AddPaymentMethodRequest {
    userId: string;
    paymentMethodId?: string;
    setAsDefault?: boolean;
}
interface AddPaymentMethodResponse {
    paymentMethod: PaymentMethod | null;
    success: boolean;
    error: string | null;
    setupIntent?: {
        clientSecret: string;
        setupIntentId: string;
    };
}
interface RemovePaymentMethodRequest {
    paymentMethodId: string;
    userId: string;
}
interface RemovePaymentMethodResponse {
    success: boolean;
    message: string;
}
interface GetPaymentMethodsRequest {
    userId: string;
    type?: string;
}
interface GetPaymentMethodsResponse {
    paymentMethods: PaymentMethod[];
    defaultPaymentMethodId: string | null;
}
interface SetDefaultPaymentMethodRequest {
    userId: string;
    paymentMethodId: string;
}
interface SetDefaultPaymentMethodResponse {
    success: boolean;
    paymentMethod: PaymentMethod | null;
}
interface PaymentMethod {
    id: string;
    type: string;
    card?: {
        brand: string;
        last4: string;
        expMonth: number;
        expYear: number;
        funding: string;
    };
    createdAt: string;
    isDefault: boolean;
    billingEmail?: string;
    brand?: string;
    last4?: string;
}
interface GetInvoicesRequest {
    userId: string;
    limit?: number;
    startingAfter?: string;
}
interface GetInvoicesResponse {
    invoices: Invoice[];
    hasMore: boolean;
}
interface Invoice {
    id: string;
    subscriptionId: string | null;
    amountDue: number;
    amountPaid: number;
    currency: string;
    status: string;
    dueDate: string;
    periodStart: string;
    periodEnd: string;
    lineItems: InvoiceLineItem[];
    pdfUrl: string | null;
}
interface InvoiceLineItem {
    description: string;
    amount: number;
    quantity: number;
    periodStart?: string;
    periodEnd?: string;
}
interface GetUpcomingInvoiceRequest {
    userId: string;
    subscriptionId?: string;
}
interface GetUpcomingInvoiceResponse {
    invoice: Invoice | null;
    exists: boolean;
}
interface GetPricingPlansRequest {
    currency?: string;
    includeTrialInfo?: boolean;
    userTier?: string;
}
interface GetPricingPlansResponse {
    plans: PricingPlan[];
    currency: string;
}
interface PricingPlan {
    id: string;
    name: string;
    tier: string;
    monthlyPrice: number;
    yearlyPrice: number;
    currency: string;
    features: string[];
    limits: Record<string, number>;
    hasTrial: boolean;
    trialDays: number;
    stripeMonthlyPriceId: string;
    stripeYearlyPriceId: string;
}
interface ValidatePromoCodeRequest {
    promoCode: string;
    userId?: string;
    planId?: string;
}
interface ValidatePromoCodeResponse {
    valid: boolean;
    discountType?: string;
    discountValue?: number;
    discountAmount?: number;
    discountPercentage?: number;
    description?: string;
    expiresAt?: string;
    error?: string;
}
interface ProcessStripeWebhookRequest {
    eventType: string;
    eventId: string;
    payload?: Uint8Array;
    signature?: string;
    objectId?: string;
    userId?: string;
}
interface ProcessStripeWebhookResponse {
    processed: boolean;
    message: string | null;
    error: string | null;
}
interface GetPaymentHealthRequest {
    includeStripeStatus?: boolean;
    includeMetrics?: boolean;
}
interface GetPaymentHealthResponse {
    healthy: boolean;
    timestamp: string;
    stripeStatus?: StripeStatus;
    metrics?: PaymentMetrics;
}
interface StripeStatus {
    connected: boolean;
    mode: string;
    webhookEndpointsActive: number;
    lastWebhookAt: string;
}
interface PaymentMetrics {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    totalRevenue: number;
    activeSubscriptions: number;
    mrr: number;
    transactionsByType: Record<string, number>;
}
interface StreamPaymentEventsRequest {
    serviceId: string;
    eventTypes?: string[];
    userId?: string;
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
    createSubscription(data: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse>;
    updateSubscription(data: UpdateSubscriptionRequest): Promise<UpdateSubscriptionResponse>;
    cancelSubscription(data: CancelSubscriptionRequest): Promise<CancelSubscriptionResponse>;
    getSubscription(data: GetSubscriptionRequest): Promise<GetSubscriptionResponse>;
    processPayment(data: ProcessPaymentRequest): Promise<ProcessPaymentResponse>;
    addPaymentMethod(data: AddPaymentMethodRequest): Promise<AddPaymentMethodResponse>;
    getPaymentMethods(data: GetPaymentMethodsRequest): Promise<GetPaymentMethodsResponse>;
    getPricingPlans(data: GetPricingPlansRequest): GetPricingPlansResponse;
    getInvoices(data: GetInvoicesRequest): Promise<GetInvoicesResponse>;
    processStripeWebhook(data: ProcessStripeWebhookRequest): Promise<ProcessStripeWebhookResponse>;
    getPaymentHealth(data: GetPaymentHealthRequest): GetPaymentHealthResponse;
    streamPaymentEvents(data: StreamPaymentEventsRequest): Observable<PaymentEvent>;
    private emitPaymentEvent;
    private getFeatureFlagsForPlan;
    private getPlanAmount;
    private extractFeatureFlags;
    private getPlanFeatureList;
    getUserSubscriptions(data: GetUserSubscriptionsRequest): Promise<GetUserSubscriptionsResponse>;
    refundPayment(data: RefundPaymentRequest): RefundPaymentResponse;
    getPaymentHistory(data: GetPaymentHistoryRequest): Promise<GetPaymentHistoryResponse>;
    removePaymentMethod(data: RemovePaymentMethodRequest): Promise<RemovePaymentMethodResponse>;
    setDefaultPaymentMethod(data: SetDefaultPaymentMethodRequest): Promise<SetDefaultPaymentMethodResponse>;
    getUpcomingInvoice(data: GetUpcomingInvoiceRequest): GetUpcomingInvoiceResponse;
    validatePromoCode(data: ValidatePromoCodeRequest): ValidatePromoCodeResponse;
}
export {};
