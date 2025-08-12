export declare class CreatePaymentIntentDto {
    planId: string;
    paymentMethodId?: string;
    currency?: string;
}
export declare class CreateSetupIntentDto {
    usage?: 'on_session' | 'off_session';
}
export declare class SetDefaultPaymentMethodDto {
    paymentMethodId: string;
}
export declare class PaymentIntentResponseDto {
    clientSecret: string | null;
    paymentIntentId: string;
    amount: number;
    currency: string;
}
export declare class SetupIntentResponseDto {
    clientSecret: string | null;
    setupIntentId: string;
}
export declare class PaymentMethodDto {
    id: string;
    userId: string;
    stripePaymentMethodId: string;
    type: string;
    brand?: string;
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare class BillingHistoryDto {
    id: string;
    userId: string;
    stripeInvoiceId: string;
    amount: number;
    currency: string;
    status: string;
    description: string;
    periodStart: Date;
    periodEnd: Date;
    invoiceUrl?: string;
    receiptUrl?: string;
    pdfUrl?: string;
    createdAt: Date;
}
