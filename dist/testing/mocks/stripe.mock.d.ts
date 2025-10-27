import Stripe from 'stripe';
export declare function createStripeEventMock(type: string, data: any, overrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createStripeSubscriptionMock(overrides?: Partial<Stripe.Subscription>): Stripe.Subscription;
export declare function createStripeInvoiceMock(overrides?: Partial<Stripe.Invoice>): Stripe.Invoice;
export declare function createStripePaymentIntentMock(overrides?: Partial<Stripe.PaymentIntent>): Stripe.PaymentIntent;
export declare function createStripePaymentMethodMock(overrides?: Partial<Stripe.PaymentMethod>): Stripe.PaymentMethod;
export declare function createStripeCustomerMock(overrides?: Partial<Stripe.Customer>): Stripe.Customer;
export declare function createStripeDisputeMock(overrides?: Partial<Stripe.Dispute>): Stripe.Dispute;
export declare function createSubscriptionCreatedEventMock(subscriptionOverrides?: Partial<Stripe.Subscription>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createSubscriptionUpdatedEventMock(subscriptionOverrides?: Partial<Stripe.Subscription>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createSubscriptionDeletedEventMock(subscriptionOverrides?: Partial<Stripe.Subscription>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createInvoicePaymentSucceededEventMock(invoiceOverrides?: Partial<Stripe.Invoice>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createInvoicePaymentFailedEventMock(invoiceOverrides?: Partial<Stripe.Invoice>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createPaymentIntentSucceededEventMock(paymentIntentOverrides?: Partial<Stripe.PaymentIntent>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createPaymentIntentFailedEventMock(paymentIntentOverrides?: Partial<Stripe.PaymentIntent>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createPaymentMethodAttachedEventMock(paymentMethodOverrides?: Partial<Stripe.PaymentMethod>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createPaymentMethodDetachedEventMock(paymentMethodOverrides?: Partial<Stripe.PaymentMethod>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createCustomerUpdatedEventMock(customerOverrides?: Partial<Stripe.Customer>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createDisputeCreatedEventMock(disputeOverrides?: Partial<Stripe.Dispute>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createDisputeClosedEventMock(disputeOverrides?: Partial<Stripe.Dispute>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createTrialWillEndEventMock(subscriptionOverrides?: Partial<Stripe.Subscription>, eventOverrides?: Partial<Stripe.Event>): Stripe.Event;
export declare function createStripeMock(): {
    webhooks: {
        constructEvent: jest.Mock<any, any, any>;
    };
    customers: {
        create: jest.Mock<any, any, any>;
        retrieve: jest.Mock<any, any, any>;
        update: jest.Mock<any, any, any>;
        del: jest.Mock<any, any, any>;
    };
    subscriptions: {
        create: jest.Mock<any, any, any>;
        retrieve: jest.Mock<any, any, any>;
        update: jest.Mock<any, any, any>;
        cancel: jest.Mock<any, any, any>;
    };
    paymentIntents: {
        create: jest.Mock<any, any, any>;
        retrieve: jest.Mock<any, any, any>;
        confirm: jest.Mock<any, any, any>;
        cancel: jest.Mock<any, any, any>;
    };
    paymentMethods: {
        attach: jest.Mock<any, any, any>;
        detach: jest.Mock<any, any, any>;
        list: jest.Mock<any, any, any>;
    };
    invoices: {
        retrieve: jest.Mock<any, any, any>;
        list: jest.Mock<any, any, any>;
    };
};
