"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WinstonModule = exports.createNestWinstonLoggerInstance = exports.paymentLogger = exports.PaymentLogger = void 0;
const logging_1 = require("@btd/shared/dist/logging");
const nest_winston_1 = require("nest-winston");
Object.defineProperty(exports, "WinstonModule", { enumerable: true, get: function () { return nest_winston_1.WinstonModule; } });
class PaymentLogger extends logging_1.BaseLogger {
    constructor() {
        const logger = (0, logging_1.createWinstonLogger)({
            serviceName: 'btd-payment-service',
        });
        super(logger);
    }
    paymentInitiated(paymentId, userId, amount, currency, method, metadata) {
        this.businessInfo('payment-initiated', `Payment initiated: ${paymentId} (${amount} ${currency})`, {
            ...metadata,
            paymentId,
            userId,
            amount,
            currency,
            method,
        });
    }
    paymentProcessing(paymentId, provider, amount, metadata) {
        this.businessInfo('payment-processing', `Processing payment: ${paymentId} via ${provider}`, {
            ...metadata,
            paymentId,
            provider,
            amount,
        });
    }
    paymentSucceeded(paymentId, userId, amount, transactionId, metadata) {
        this.businessInfo('payment-succeeded', `Payment succeeded: ${paymentId}`, {
            ...metadata,
            paymentId,
            userId,
            amount,
            transactionId,
        });
    }
    paymentFailed(paymentId, userId, amount, error, metadata) {
        this.businessError('payment-failed', `Payment failed: ${paymentId} - ${error}`, {
            ...metadata,
            paymentId,
            userId,
            amount,
            error,
        });
    }
    paymentRefunded(paymentId, refundId, amount, reason, metadata) {
        this.businessInfo('payment-refunded', `Payment refunded: ${paymentId}`, {
            ...metadata,
            paymentId,
            refundId,
            amount,
            reason,
        });
    }
    subscriptionCreated(subscriptionId, userId, planId, amount, metadata) {
        this.businessInfo('subscription-created', `Subscription created: ${subscriptionId}`, {
            ...metadata,
            subscriptionId,
            userId,
            planId,
            amount,
        });
    }
    subscriptionCancelled(subscriptionId, userId, reason, metadata) {
        this.businessInfo('subscription-cancelled', `Subscription cancelled: ${subscriptionId}`, {
            ...metadata,
            subscriptionId,
            userId,
            reason,
        });
    }
    subscriptionRenewed(subscriptionId, userId, amount, metadata) {
        this.businessInfo('subscription-renewed', `Subscription renewed: ${subscriptionId}`, {
            ...metadata,
            subscriptionId,
            userId,
            amount,
        });
    }
    fraudDetected(paymentId, userId, riskScore, reason, metadata) {
        this.businessWarn('fraud-detected', `Fraud detected: ${paymentId} (risk: ${riskScore})`, {
            ...metadata,
            paymentId,
            userId,
            riskScore,
            reason,
        });
    }
    chargebackReceived(paymentId, chargebackId, amount, reason, metadata) {
        this.businessWarn('chargeback-received', `Chargeback received: ${chargebackId}`, {
            ...metadata,
            paymentId,
            chargebackId,
            amount,
            reason,
        });
    }
    paymentMethodAdded(userId, methodId, type, metadata) {
        this.businessInfo('payment-method-added', `Payment method added: ${type}`, {
            ...metadata,
            userId,
            methodId,
            type,
        });
    }
    paymentMethodRemoved(userId, methodId, reason, metadata) {
        this.businessInfo('payment-method-removed', `Payment method removed: ${methodId}`, {
            ...metadata,
            userId,
            methodId,
            reason,
        });
    }
}
exports.PaymentLogger = PaymentLogger;
exports.paymentLogger = new PaymentLogger();
const createNestWinstonLoggerInstance = () => {
    return (0, logging_1.createNestWinstonLogger)({
        serviceName: 'btd-payment-service',
    });
};
exports.createNestWinstonLoggerInstance = createNestWinstonLoggerInstance;
exports.default = exports.paymentLogger;
//# sourceMappingURL=winston.config.js.map