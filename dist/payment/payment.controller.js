"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PaymentController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const payment_service_1 = require("./payment.service");
let PaymentController = PaymentController_1 = class PaymentController {
    constructor(paymentService) {
        this.paymentService = paymentService;
        this.logger = new common_1.Logger(PaymentController_1.name);
    }
    async validateAppleReceipt(data) {
        this.logger.debug(`[gRPC] ValidateAppleReceipt called for user: ${data.user_id}`);
        return this.paymentService.validateAppleReceipt(data);
    }
    async processAppleWebhook(data) {
        this.logger.debug(`[gRPC] ProcessAppleWebhook called`);
        return this.paymentService.processAppleWebhook(data);
    }
    async processConsumablePurchase(data) {
        this.logger.debug(`[gRPC] ProcessConsumablePurchase called for product: ${data.product_id}`);
        return this.paymentService.processConsumablePurchase(data);
    }
    async getUserSubscription(data) {
        this.logger.debug(`[gRPC] GetUserSubscription called for user: ${data.user_id}`);
        return this.paymentService.getUserSubscription(data);
    }
    async updateSubscriptionStatus(data) {
        this.logger.debug(`[gRPC] UpdateSubscriptionStatus called for user: ${data.user_id}`);
        return this.paymentService.updateSubscriptionStatus(data);
    }
    async cancelSubscription(data) {
        this.logger.debug(`[gRPC] CancelSubscription called for user: ${data.user_id}`);
        return this.paymentService.cancelSubscription(data);
    }
    async getTransactionHistory(data) {
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
                transactions: transactions.map((t) => ({
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
        }
        catch (error) {
            this.logger.error(`Get transaction history failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                transactions: [],
                total: 0,
            };
        }
    }
    async recordTransaction(data) {
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
        }
        catch (error) {
            this.logger.error(`Record transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                success: false,
            };
        }
    }
    async getHealth() {
        this.logger.debug('[gRPC] GetHealth called');
        try {
            await this.paymentService['prisma'].$queryRaw `SELECT 1`;
            return {
                healthy: true,
                timestamp: new Date().toISOString(),
                version: '1.0.0',
            };
        }
        catch (error) {
            this.logger.error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                healthy: false,
                timestamp: new Date().toISOString(),
                version: '1.0.0',
            };
        }
    }
};
exports.PaymentController = PaymentController;
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'ValidateAppleReceipt'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "validateAppleReceipt", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'ProcessAppleWebhook'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "processAppleWebhook", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'ProcessConsumablePurchase'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "processConsumablePurchase", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetUserSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "getUserSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'UpdateSubscriptionStatus'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "updateSubscriptionStatus", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'CancelSubscription'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "cancelSubscription", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetTransactionHistory'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "getTransactionHistory", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'RecordTransaction'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "recordTransaction", null);
__decorate([
    (0, microservices_1.GrpcMethod)('PaymentService', 'GetHealth'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "getHealth", null);
exports.PaymentController = PaymentController = PaymentController_1 = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [payment_service_1.PaymentService])
], PaymentController);
//# sourceMappingURL=payment.controller.js.map