/**
 * BTD Payment Service Logger
 *
 * Simplified winston configuration using @btd/shared@2.2.0 logging module
 * Reduces configuration from 638 lines to ~340 lines while maintaining all functionality
 */

import { BaseLogger, createWinstonLogger, createNestWinstonLogger } from '@btd/shared/dist/logging';
import { WinstonModule } from 'nest-winston';

/**
 * Extended logger class with payment-specific business methods
 */
export class PaymentLogger extends BaseLogger {
  constructor() {
    const logger = createWinstonLogger({
      serviceName: 'btd-payment-service',
    });
    super(logger);
  }

  // Payment-specific business event methods

  /**
   * Log payment initiation event
   */
  paymentInitiated(
    paymentId: string,
    userId: string,
    amount: number,
    currency: string,
    method: string,
    metadata?: Record<string, any>,
  ) {
    this.businessInfo('payment-initiated', `Payment initiated: ${paymentId} (${amount} ${currency})`, {
      ...metadata,
      paymentId,
      userId,
      amount,
      currency,
      method,
    });
  }

  /**
   * Log payment processing state
   */
  paymentProcessing(
    paymentId: string,
    provider: string,
    amount: number,
    metadata?: Record<string, any>,
  ) {
    this.businessInfo('payment-processing', `Processing payment: ${paymentId} via ${provider}`, {
      ...metadata,
      paymentId,
      provider,
      amount,
    });
  }

  /**
   * Log successful payment
   */
  paymentSucceeded(
    paymentId: string,
    userId: string,
    amount: number,
    transactionId: string,
    metadata?: Record<string, any>,
  ) {
    this.businessInfo('payment-succeeded', `Payment succeeded: ${paymentId}`, {
      ...metadata,
      paymentId,
      userId,
      amount,
      transactionId,
    });
  }

  /**
   * Log payment failure
   */
  paymentFailed(
    paymentId: string,
    userId: string,
    amount: number,
    error: string,
    metadata?: Record<string, any>,
  ) {
    this.businessError('payment-failed', `Payment failed: ${paymentId} - ${error}`, {
      ...metadata,
      paymentId,
      userId,
      amount,
      error,
    });
  }

  /**
   * Log payment refund
   */
  paymentRefunded(
    paymentId: string,
    refundId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.businessInfo('payment-refunded', `Payment refunded: ${paymentId}`, {
      ...metadata,
      paymentId,
      refundId,
      amount,
      reason,
    });
  }

  /**
   * Log subscription creation
   */
  subscriptionCreated(
    subscriptionId: string,
    userId: string,
    planId: string,
    amount: number,
    metadata?: Record<string, any>,
  ) {
    this.businessInfo('subscription-created', `Subscription created: ${subscriptionId}`, {
      ...metadata,
      subscriptionId,
      userId,
      planId,
      amount,
    });
  }

  /**
   * Log subscription cancellation
   */
  subscriptionCancelled(
    subscriptionId: string,
    userId: string,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.businessInfo('subscription-cancelled', `Subscription cancelled: ${subscriptionId}`, {
      ...metadata,
      subscriptionId,
      userId,
      reason,
    });
  }

  /**
   * Log subscription renewal
   */
  subscriptionRenewed(
    subscriptionId: string,
    userId: string,
    amount: number,
    metadata?: Record<string, any>,
  ) {
    this.businessInfo('subscription-renewed', `Subscription renewed: ${subscriptionId}`, {
      ...metadata,
      subscriptionId,
      userId,
      amount,
    });
  }

  /**
   * Log fraud detection event
   */
  fraudDetected(
    paymentId: string,
    userId: string,
    riskScore: number,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.businessWarn('fraud-detected', `Fraud detected: ${paymentId} (risk: ${riskScore})`, {
      ...metadata,
      paymentId,
      userId,
      riskScore,
      reason,
    });
  }

  /**
   * Log chargeback received
   */
  chargebackReceived(
    paymentId: string,
    chargebackId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.businessWarn('chargeback-received', `Chargeback received: ${chargebackId}`, {
      ...metadata,
      paymentId,
      chargebackId,
      amount,
      reason,
    });
  }

  /**
   * Log payment method addition
   */
  paymentMethodAdded(
    userId: string,
    methodId: string,
    type: string,
    metadata?: Record<string, any>,
  ) {
    this.businessInfo('payment-method-added', `Payment method added: ${type}`, {
      ...metadata,
      userId,
      methodId,
      type,
    });
  }

  /**
   * Log payment method removal
   */
  paymentMethodRemoved(
    userId: string,
    methodId: string,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.businessInfo('payment-method-removed', `Payment method removed: ${methodId}`, {
      ...metadata,
      userId,
      methodId,
      reason,
    });
  }
}

// Create service logger instance
export const paymentLogger = new PaymentLogger();

// NestJS-compatible winston logger
export const createNestWinstonLoggerInstance = () => {
  return createNestWinstonLogger({
    serviceName: 'btd-payment-service',
  });
};

// For backwards compatibility - export NestJS logger module
export { WinstonModule };

// Default export for compatibility
export default paymentLogger;
