import { BaseLogger } from '@btd/shared/dist/logging';
import { WinstonModule } from 'nest-winston';
export declare class PaymentLogger extends BaseLogger {
    constructor();
    paymentInitiated(paymentId: string, userId: string, amount: number, currency: string, method: string, metadata?: Record<string, any>): void;
    paymentProcessing(paymentId: string, provider: string, amount: number, metadata?: Record<string, any>): void;
    paymentSucceeded(paymentId: string, userId: string, amount: number, transactionId: string, metadata?: Record<string, any>): void;
    paymentFailed(paymentId: string, userId: string, amount: number, error: string, metadata?: Record<string, any>): void;
    paymentRefunded(paymentId: string, refundId: string, amount: number, reason: string, metadata?: Record<string, any>): void;
    subscriptionCreated(subscriptionId: string, userId: string, planId: string, amount: number, metadata?: Record<string, any>): void;
    subscriptionCancelled(subscriptionId: string, userId: string, reason: string, metadata?: Record<string, any>): void;
    subscriptionRenewed(subscriptionId: string, userId: string, amount: number, metadata?: Record<string, any>): void;
    fraudDetected(paymentId: string, userId: string, riskScore: number, reason: string, metadata?: Record<string, any>): void;
    chargebackReceived(paymentId: string, chargebackId: string, amount: number, reason: string, metadata?: Record<string, any>): void;
    paymentMethodAdded(userId: string, methodId: string, type: string, metadata?: Record<string, any>): void;
    paymentMethodRemoved(userId: string, methodId: string, reason: string, metadata?: Record<string, any>): void;
}
export declare const paymentLogger: PaymentLogger;
export declare const createNestWinstonLoggerInstance: () => any;
export { WinstonModule };
export default paymentLogger;
