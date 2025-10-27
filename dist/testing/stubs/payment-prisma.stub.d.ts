export declare class PaymentPrismaServiceStub {
    private callHistory;
    webhookEvent: {
        create: jest.Mock<any, any, any>;
        findFirst: jest.Mock<any, any, any>;
        findMany: jest.Mock<any, any, any>;
        updateMany: jest.Mock<any, any, any>;
    };
    subscription: {
        create: jest.Mock<any, any, any>;
        findFirst: jest.Mock<any, any, any>;
        findUnique: jest.Mock<any, any, any>;
        findMany: jest.Mock<any, any, any>;
        update: jest.Mock<any, any, any>;
        updateMany: jest.Mock<any, any, any>;
        delete: jest.Mock<any, any, any>;
    };
    billingHistory: {
        create: jest.Mock<any, any, any>;
        findFirst: jest.Mock<any, any, any>;
        findMany: jest.Mock<any, any, any>;
        update: jest.Mock<any, any, any>;
    };
    paymentIntent: {
        create: jest.Mock<any, any, any>;
        findFirst: jest.Mock<any, any, any>;
        findMany: jest.Mock<any, any, any>;
        updateMany: jest.Mock<any, any, any>;
    };
    paymentMethod: {
        create: jest.Mock<any, any, any>;
        findFirst: jest.Mock<any, any, any>;
        findMany: jest.Mock<any, any, any>;
        deleteMany: jest.Mock<any, any, any>;
    };
    subscriptionPlan: {
        create: jest.Mock<any, any, any>;
        findFirst: jest.Mock<any, any, any>;
        findMany: jest.Mock<any, any, any>;
        update: jest.Mock<any, any, any>;
    };
    userPremiumFeatures: {
        create: jest.Mock<any, any, any>;
        findUnique: jest.Mock<any, any, any>;
        update: jest.Mock<any, any, any>;
        upsert: jest.Mock<any, any, any>;
    };
    $transaction: jest.Mock<any, any, any>;
    $connect: jest.Mock<any, any, any>;
    $disconnect: jest.Mock<any, any, any>;
    private recordCall;
    getCallsFor(method: string): Array<{
        method: string;
        args: any[];
    }>;
    getAllCalls(): Array<{
        method: string;
        args: any[];
    }>;
    clearCallHistory(): void;
    reset(): void;
}
export declare function createPaymentPrismaServiceStub(): PaymentPrismaServiceStub;
