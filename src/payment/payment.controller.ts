import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @GrpcMethod('PaymentService', 'ValidateAppleReceipt')
  async validateAppleReceipt(data: {
    receipt_data: string;
    user_id: string;
    source: string;
  }) {
    this.logger.debug(`[gRPC] ValidateAppleReceipt called for user: ${data.user_id}`);
    return this.paymentService.validateAppleReceipt(data);
  }

  @GrpcMethod('PaymentService', 'ProcessAppleWebhook')
  async processAppleWebhook(data: {
    signed_payload: string;
    headers: Record<string, string>;
  }) {
    this.logger.debug(`[gRPC] ProcessAppleWebhook called`);
    return this.paymentService.processAppleWebhook(data);
  }

  @GrpcMethod('PaymentService', 'ProcessConsumablePurchase')
  async processConsumablePurchase(data: {
    user_id: string;
    product_id: string;
    transaction_id: string;
    receipt_data: string;
  }) {
    this.logger.debug(`[gRPC] ProcessConsumablePurchase called for product: ${data.product_id}`);
    return this.paymentService.processConsumablePurchase(data);
  }

  @GrpcMethod('PaymentService', 'GetUserSubscription')
  async getUserSubscription(data: { user_id: string }) {
    this.logger.debug(`[gRPC] GetUserSubscription called for user: ${data.user_id}`);
    return this.paymentService.getUserSubscription(data);
  }

  @GrpcMethod('PaymentService', 'UpdateSubscriptionStatus')
  async updateSubscriptionStatus(data: {
    user_id: string;
    status: string;
    reason: string;
  }) {
    this.logger.debug(`[gRPC] UpdateSubscriptionStatus called for user: ${data.user_id}`);
    return this.paymentService.updateSubscriptionStatus(data);
  }

  @GrpcMethod('PaymentService', 'CancelSubscription')
  async cancelSubscription(data: {
    user_id: string;
    reason: string;
    immediate: boolean;
  }) {
    this.logger.debug(`[gRPC] CancelSubscription called for user: ${data.user_id}`);
    return this.paymentService.cancelSubscription(data);
  }

  @GrpcMethod('PaymentService', 'GetTransactionHistory')
  async getTransactionHistory(data: {
    user_id: string;
    limit: number;
    offset: number;
  }) {
    this.logger.debug(`[gRPC] GetTransactionHistory called for user: ${data.user_id}`);

    try {
      const transactions = await this.paymentService['prisma'].appleTransaction.findMany({
        where: { userId: data.user_id },
        take: data.limit || 10,
        skip: data.offset || 0,
        orderBy: { createdAt: 'desc' },
      });

      const total = await this.paymentService['prisma'].appleTransaction.count({
        where: { userId: data.user_id },
      });

      return {
        transactions: transactions.map(t => ({
          id: t.id,
          user_id: t.userId,
          transaction_id: t.transactionId,
          original_transaction_id: t.originalTransactionId,
          product_id: t.productId,
          type: t.type,
          amount: t.amount?.toNumber() || 0,
          currency: t.currency || 'USD',
          status: t.status,
          processed_at: t.processedAt?.toISOString(),
          created_at: t.createdAt.toISOString(),
        })),
        total,
      };
    } catch (error) {
      this.logger.error(`Get transaction history failed: ${error.message}`);
      return {
        transactions: [],
        total: 0,
      };
    }
  }

  @GrpcMethod('PaymentService', 'RecordTransaction')
  async recordTransaction(data: {
    user_id: string;
    transaction_id: string;
    product_id: string;
    type: string;
    amount: number;
    currency: string;
  }) {
    this.logger.debug(`[gRPC] RecordTransaction called for transaction: ${data.transaction_id}`);

    try {
      const transaction = await this.paymentService['prisma'].appleTransaction.create({
        data: {
          userId: data.user_id,
          transactionId: data.transaction_id,
          productId: data.product_id,
          type: data.type,
          amount: data.amount,
          currency: data.currency,
          status: 'completed',
          processedAt: new Date(),
        },
      });

      return {
        success: true,
        transaction: {
          id: transaction.id,
          user_id: transaction.userId,
          transaction_id: transaction.transactionId,
          product_id: transaction.productId,
          type: transaction.type,
          amount: transaction.amount?.toNumber() || 0,
          currency: transaction.currency || 'USD',
          status: transaction.status,
          processed_at: transaction.processedAt?.toISOString(),
          created_at: transaction.createdAt.toISOString(),
        },
      };
    } catch (error) {
      this.logger.error(`Record transaction failed: ${error.message}`);
      return {
        success: false,
      };
    }
  }

  @GrpcMethod('PaymentService', 'GetHealth')
  async getHealth() {
    this.logger.debug('[gRPC] GetHealth called');

    try {
      // Check database connection
      await this.paymentService['prisma'].$queryRaw`SELECT 1`;

      return {
        healthy: true,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      return {
        healthy: false,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };
    }
  }
}