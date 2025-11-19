/**
 * Enhanced Winston Logger Configuration for BTD Payment Service
 *
 * Features:
 * - Daily log rotation with compression
 * - Multiple transports (console, file, error file, Graylog)
 * - Environment-specific configurations
 * - Correlation ID support
 * - Structured JSON logging
 * - Payment-specific business event logging methods
 * - NestJS integration via nest-winston
 */

import * as winston from 'winston';
import * as Winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { WinstonModule } from 'nest-winston';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Import Graylog transport (optional)
import * as WinstonGraylog2 from 'winston-graylog2';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Environment configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Ensure logs directory exists
const logsDir = path.resolve('logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Enhanced format for development (readable)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const {
      timestamp,
      level,
      message,
      correlationId,
      userId,
      context,
      ...meta
    } = info;
    const metaStr = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : '';

    const corrIdStr = correlationId
      ? typeof correlationId === 'object'
        ? JSON.stringify(correlationId)
        : `${correlationId as string | number | boolean}`
      : '';

    const userStr = userId
      ? typeof userId === 'object'
        ? JSON.stringify(userId)
        : `${userId as string | number | boolean}`
      : '';

    const ctxStr = context
      ? typeof context === 'object'
        ? JSON.stringify(context)
        : `${context as string | number | boolean}`
      : '';
    const corrId = corrIdStr ? `[${corrIdStr}]` : '';
    const user = userStr ? `[User:${userStr}]` : '';
    const ctx = ctxStr ? `[${ctxStr}]` : '';
    // Ensure all values are strings to avoid template literal expression type warnings
    const timestampStr = String(timestamp);
    const levelStr = String(level);
    const messageStr = String(message);
    return `${timestampStr} ${levelStr}: ${corrId}${user}${ctx} ${messageStr} ${metaStr}`;
  }),
);

// Enhanced format for production (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf((info) => {
    return JSON.stringify({
      ...info,
      facility: 'btd-payment-service',
      environment: process.env.NODE_ENV || 'development',
      service: 'btd-payment-service',
      version: process.env.npm_package_version || '1.0.0',
      host: process.env.HOSTNAME || os.hostname(),
      pid: process.pid,
    });
  }),
);

// Create transports array
const transports: Winston.transport[] = [];

// Console transport
if (isDevelopment) {
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: developmentFormat,
    }),
  );
} else {
  transports.push(
    new winston.transports.Console({
      level: 'info',
      format: productionFormat,
    }),
  );
}

// Daily rotating file transport for all logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'payment-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d', // Keep logs for 14 days
    format: productionFormat,
    level: logLevel,
    auditFile: path.join(logsDir, 'audit-payment.json'),
    handleExceptions: false,
    handleRejections: false,
    // Prevent write-after-end errors during shutdown
    silent: false,
  }),
);

// Daily rotating file transport for error logs only
transports.push(
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d', // Keep error logs longer
    format: productionFormat,
    level: 'error',
    auditFile: path.join(logsDir, 'audit-error.json'),
    handleExceptions: false,
    handleRejections: false,
    // Prevent write-after-end errors during shutdown
    silent: false,
  }),
);

// Graylog transport (if configured and enabled)
const graylogEnabled = process.env.GRAYLOG_ENABLED === 'true';
if (graylogEnabled && process.env.GRAYLOG_HOST && process.env.GRAYLOG_PORT) {
  console.log(
    `🔗 Graylog transport enabled: ${process.env.GRAYLOG_HOST}:${process.env.GRAYLOG_PORT}`,
  );
  transports.push(
    new WinstonGraylog2({
      name: 'Graylog',
      level: process.env.LOG_LEVEL || 'info',
      silent: false,
      handleExceptions: true,
      graylog: {
        servers: [
          {
            host: process.env.GRAYLOG_HOST,
            port: parseInt(process.env.GRAYLOG_PORT),
          },
        ],
        hostname: process.env.HOSTNAME || os.hostname(),
        facility: process.env.GRAYLOG_FACILITY || 'btd-payment-service',
        bufferSize: 1400,
      },
      staticMeta: {
        service: 'btd-payment-service',
        environment:
          process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
        version:
          process.env.SERVICE_VERSION ||
          process.env.npm_package_version ||
          '1.0.0',
      },
    }),
  );
} else if (!graylogEnabled) {
  console.log('ℹ️  Graylog transport disabled (GRAYLOG_ENABLED=false)');
}

// Create the Winston logger instance
export const winstonLogger = winston.createLogger({
  level: logLevel,
  levels,
  format: productionFormat,
  defaultMeta: { service: 'btd-payment-service' },
  transports,
  exitOnError: false,
});

// Create NestJS Winston logger instance
export const createNestWinstonLogger = () => {
  return WinstonModule.createLogger({
    instance: winstonLogger,
  });
};

// Extended logger class with business methods for Payment Service
export class PaymentLogger {
  private logger: Winston.Logger;

  constructor(logger: Winston.Logger) {
    this.logger = logger;
  }

  // Standard logging methods
  error(message: string, meta?: any) {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  http(message: string, meta?: any) {
    this.logger.http(message, meta);
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }

  // Business event logging methods specific to Payment Service

  /**
   * Log payment initiation event
   * @param paymentId - Unique payment identifier
   * @param userId - User making the payment
   * @param amount - Payment amount
   * @param currency - Payment currency (e.g., USD, EUR)
   * @param method - Payment method (card, bank_transfer, etc.)
   * @param metadata - Additional context
   */
  paymentInitiated(
    paymentId: string,
    userId: string,
    amount: number,
    currency: string,
    method: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('Payment initiated', {
      event: 'payment_initiated',
      paymentId,
      userId,
      amount,
      currency,
      method,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log payment processing state
   * @param paymentId - Payment identifier
   * @param provider - Payment provider (stripe, paypal, etc.)
   * @param amount - Amount being processed
   * @param metadata - Additional context
   */
  paymentProcessing(
    paymentId: string,
    provider: string,
    amount: number,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('Payment processing', {
      event: 'payment_processing',
      paymentId,
      provider,
      amount,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log successful payment
   * @param paymentId - Payment identifier
   * @param userId - User identifier
   * @param amount - Payment amount
   * @param transactionId - Provider transaction ID
   * @param metadata - Additional context
   */
  paymentSucceeded(
    paymentId: string,
    userId: string,
    amount: number,
    transactionId: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('Payment succeeded', {
      event: 'payment_succeeded',
      paymentId,
      userId,
      amount,
      transactionId,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log payment failure
   * @param paymentId - Payment identifier
   * @param userId - User identifier
   * @param amount - Payment amount
   * @param error - Error message/reason
   * @param metadata - Additional context
   */
  paymentFailed(
    paymentId: string,
    userId: string,
    amount: number,
    error: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.error('Payment failed', {
      event: 'payment_failed',
      paymentId,
      userId,
      amount,
      error,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log payment refund
   * @param paymentId - Original payment identifier
   * @param refundId - Refund identifier
   * @param amount - Refund amount
   * @param reason - Refund reason
   * @param metadata - Additional context
   */
  paymentRefunded(
    paymentId: string,
    refundId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('Payment refunded', {
      event: 'payment_refunded',
      paymentId,
      refundId,
      amount,
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log subscription creation
   * @param subscriptionId - Subscription identifier
   * @param userId - User identifier
   * @param planId - Subscription plan identifier
   * @param amount - Subscription amount
   * @param metadata - Additional context
   */
  subscriptionCreated(
    subscriptionId: string,
    userId: string,
    planId: string,
    amount: number,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('Subscription created', {
      event: 'subscription_created',
      subscriptionId,
      userId,
      planId,
      amount,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log subscription cancellation
   * @param subscriptionId - Subscription identifier
   * @param userId - User identifier
   * @param reason - Cancellation reason
   * @param metadata - Additional context
   */
  subscriptionCancelled(
    subscriptionId: string,
    userId: string,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('Subscription cancelled', {
      event: 'subscription_cancelled',
      subscriptionId,
      userId,
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log subscription renewal
   * @param subscriptionId - Subscription identifier
   * @param userId - User identifier
   * @param amount - Renewal amount
   * @param metadata - Additional context
   */
  subscriptionRenewed(
    subscriptionId: string,
    userId: string,
    amount: number,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('Subscription renewed', {
      event: 'subscription_renewed',
      subscriptionId,
      userId,
      amount,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log fraud detection event
   * @param paymentId - Payment identifier
   * @param userId - User identifier
   * @param riskScore - Fraud risk score
   * @param reason - Detection reason
   * @param metadata - Additional context
   */
  fraudDetected(
    paymentId: string,
    userId: string,
    riskScore: number,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.warn('Fraud detected', {
      event: 'fraud_detected',
      paymentId,
      userId,
      riskScore,
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log chargeback received
   * @param paymentId - Original payment identifier
   * @param chargebackId - Chargeback identifier
   * @param amount - Chargeback amount
   * @param reason - Chargeback reason
   * @param metadata - Additional context
   */
  chargebackReceived(
    paymentId: string,
    chargebackId: string,
    amount: number,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.warn('Chargeback received', {
      event: 'chargeback_received',
      paymentId,
      chargebackId,
      amount,
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log payment method addition
   * @param userId - User identifier
   * @param methodId - Payment method identifier
   * @param type - Payment method type (card, bank_account, etc.)
   * @param metadata - Additional context
   */
  paymentMethodAdded(
    userId: string,
    methodId: string,
    type: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('Payment method added', {
      event: 'payment_method_added',
      userId,
      methodId,
      type,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  /**
   * Log payment method removal
   * @param userId - User identifier
   * @param methodId - Payment method identifier
   * @param reason - Removal reason
   * @param metadata - Additional context
   */
  paymentMethodRemoved(
    userId: string,
    methodId: string,
    reason: string,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('Payment method removed', {
      event: 'payment_method_removed',
      userId,
      methodId,
      reason,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }
}

// Create enhanced logger instance
export const paymentLogger = new PaymentLogger(winstonLogger);

// Track logger state to prevent writing after end
let loggerClosed = false;
let shutdownInProgress = false;

// Safe logging function that prevents write-after-end errors
const safeLog = (level: string, message: string, meta?: any) => {
  if (!loggerClosed && !shutdownInProgress) {
    try {
      winstonLogger[level](message, meta);
    } catch (error) {
      // Fallback to console if winston fails
      console.error(`Logging error: ${error.message}`);
    }
  } else {
    // Use console as fallback when logger is closed
    console.log(`[${level.toUpperCase()}] ${message}`, meta || '');
  }
};

// Graceful logger shutdown function
const gracefulShutdown = (signal: string) => {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  console.log(
    `Received ${signal}, shutting down winston logger gracefully...`,
  );

  // Stop accepting new log entries
  loggerClosed = true;

  // Give existing writes time to complete
  setTimeout(() => {
    try {
      // Close all transports properly
      winstonLogger.transports.forEach((transport: any) => {
        if (transport.close && typeof transport.close === 'function') {
          transport.close();
        }
      });

      // End the logger
      if (winstonLogger && typeof winstonLogger.end === 'function') {
        winstonLogger.end();
      }
    } catch (error) {
      console.error('Error during winston shutdown:', error.message);
    }
  }, 200);
};

// Handle process events safely - remove default handlers that could cause conflicts
if (process.listenerCount('unhandledRejection') === 0) {
  process.on('unhandledRejection', (reason, promise) => {
    safeLog('error', 'Unhandled Rejection at Promise', { reason, promise });
  });
}

if (process.listenerCount('uncaughtException') === 0) {
  process.on('uncaughtException', (error) => {
    safeLog('error', 'Uncaught Exception', {
      error: error.message,
      stack: error.stack,
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
    setTimeout(() => process.exit(1), 500);
  });
}

// Graceful shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default winstonLogger;
