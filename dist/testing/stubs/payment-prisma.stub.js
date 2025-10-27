"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentPrismaServiceStub = void 0;
exports.createPaymentPrismaServiceStub = createPaymentPrismaServiceStub;
class PaymentPrismaServiceStub {
    constructor() {
        this.callHistory = [];
        this.webhookEvent = {
            create: jest.fn().mockImplementation((args) => {
                this.recordCall('webhookEvent.create', [args]);
                return Promise.resolve({
                    id: 'webhook-event-123',
                    eventId: args.data.eventId,
                    stripeEventId: args.data.stripeEventId,
                    type: args.data.type,
                    data: args.data.data,
                    processed: false,
                    status: 'pending',
                    processedAt: args.data.processedAt,
                    error: null,
                    createdAt: new Date(),
                    ...args.data,
                });
            }),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            updateMany: jest.fn().mockImplementation((args) => {
                this.recordCall('webhookEvent.updateMany', [args]);
                return Promise.resolve({ count: 1 });
            }),
        };
        this.subscription = {
            create: jest.fn(),
            findFirst: jest.fn().mockImplementation((args) => {
                this.recordCall('subscription.findFirst', [args]);
                return Promise.resolve(null);
            }),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn().mockImplementation((args) => {
                this.recordCall('subscription.update', [args]);
                return Promise.resolve({
                    id: args.where.id,
                    userId: 'user-123',
                    subscriptionTier: 'CONNECT',
                    status: 'ACTIVE',
                    ...args.data,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }),
            updateMany: jest.fn(),
            delete: jest.fn(),
        };
        this.billingHistory = {
            create: jest.fn().mockImplementation((args) => {
                this.recordCall('billingHistory.create', [args]);
                return Promise.resolve({
                    id: 'billing-123',
                    userId: args.data.userId,
                    stripeInvoiceId: args.data.stripeInvoiceId,
                    type: args.data.type,
                    amount: args.data.amount,
                    currency: args.data.currency,
                    status: args.data.status,
                    description: args.data.description,
                    periodStart: args.data.periodStart,
                    periodEnd: args.data.periodEnd,
                    invoiceUrl: args.data.invoiceUrl,
                    pdfUrl: args.data.pdfUrl,
                    createdAt: new Date(),
                    ...args.data,
                });
            }),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        };
        this.paymentIntent = {
            create: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            updateMany: jest.fn().mockImplementation((args) => {
                this.recordCall('paymentIntent.updateMany', [args]);
                return Promise.resolve({ count: 1 });
            }),
        };
        this.paymentMethod = {
            create: jest.fn().mockImplementation((args) => {
                this.recordCall('paymentMethod.create', [args]);
                return Promise.resolve({
                    id: 'payment-method-123',
                    userId: args.data.userId,
                    stripePaymentMethodId: args.data.stripePaymentMethodId,
                    type: args.data.type,
                    brand: args.data.brand,
                    last4: args.data.last4,
                    expiryMonth: args.data.expiryMonth,
                    expiryYear: args.data.expiryYear,
                    isDefault: args.data.isDefault,
                    createdAt: new Date(),
                    ...args.data,
                });
            }),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            deleteMany: jest.fn().mockImplementation((args) => {
                this.recordCall('paymentMethod.deleteMany', [args]);
                return Promise.resolve({ count: 1 });
            }),
        };
        this.subscriptionPlan = {
            create: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        };
        this.userPremiumFeatures = {
            create: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            upsert: jest.fn(),
        };
        this.$transaction = jest.fn().mockImplementation((callback) => {
            this.recordCall('$transaction', [callback]);
            if (typeof callback === 'function') {
                return callback(this);
            }
            return Promise.resolve(callback);
        });
        this.$connect = jest.fn().mockResolvedValue(undefined);
        this.$disconnect = jest.fn().mockResolvedValue(undefined);
    }
    recordCall(method, args) {
        this.callHistory.push({ method, args });
    }
    getCallsFor(method) {
        return this.callHistory.filter((call) => call.method === method);
    }
    getAllCalls() {
        return this.callHistory;
    }
    clearCallHistory() {
        this.callHistory = [];
    }
    reset() {
        this.callHistory = [];
        this.webhookEvent.create.mockClear();
        this.webhookEvent.findFirst.mockClear();
        this.webhookEvent.findMany.mockClear();
        this.webhookEvent.updateMany.mockClear();
        this.subscription.create.mockClear();
        this.subscription.findFirst.mockClear();
        this.subscription.findUnique.mockClear();
        this.subscription.findMany.mockClear();
        this.subscription.update.mockClear();
        this.subscription.updateMany.mockClear();
        this.subscription.delete.mockClear();
        this.billingHistory.create.mockClear();
        this.billingHistory.findFirst.mockClear();
        this.billingHistory.findMany.mockClear();
        this.billingHistory.update.mockClear();
        this.paymentIntent.create.mockClear();
        this.paymentIntent.findFirst.mockClear();
        this.paymentIntent.findMany.mockClear();
        this.paymentIntent.updateMany.mockClear();
        this.paymentMethod.create.mockClear();
        this.paymentMethod.findFirst.mockClear();
        this.paymentMethod.findMany.mockClear();
        this.paymentMethod.deleteMany.mockClear();
        this.subscriptionPlan.create.mockClear();
        this.subscriptionPlan.findFirst.mockClear();
        this.subscriptionPlan.findMany.mockClear();
        this.subscriptionPlan.update.mockClear();
        this.userPremiumFeatures.create.mockClear();
        this.userPremiumFeatures.findUnique.mockClear();
        this.userPremiumFeatures.update.mockClear();
        this.userPremiumFeatures.upsert.mockClear();
        this.$transaction.mockClear();
        this.$connect.mockClear();
        this.$disconnect.mockClear();
    }
}
exports.PaymentPrismaServiceStub = PaymentPrismaServiceStub;
function createPaymentPrismaServiceStub() {
    return new PaymentPrismaServiceStub();
}
//# sourceMappingURL=payment-prisma.stub.js.map