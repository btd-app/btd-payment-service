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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const stripe_service_1 = require("../services/stripe.service");
const payment_dto_1 = require("../dto/payment.dto");
const subscription_dto_1 = require("../dto/subscription.dto");
let PaymentController = class PaymentController {
    constructor(stripeService) {
        this.stripeService = stripeService;
    }
    getPlans() {
        return this.stripeService.getAvailablePlans();
    }
    async createPaymentIntent(dto, req) {
        const userId = req.user?.id || 'test-user';
        const userEmail = req.user?.email || 'test@example.com';
        await this.stripeService.createOrGetCustomer(userId, userEmail);
        return this.stripeService.createPaymentIntent(userId, dto.planId, dto.paymentMethodId, dto.currency);
    }
    async createSetupIntent(dto, req) {
        const userId = req.user?.id || 'test-user';
        return this.stripeService.createSetupIntent(userId);
    }
    async getBillingHistory(req) {
        const userId = req.user?.id || 'test-user';
        const history = await this.stripeService.getBillingHistory(userId);
        return history.map((record) => ({
            ...record,
            amount: Number(record.amount),
        }));
    }
    async getPaymentMethods(req) {
        const userId = req.user?.id || 'test-user';
        const methods = await this.stripeService.getPaymentMethods(userId);
        return methods.map((method) => ({
            ...method,
            updatedAt: method.createdAt,
        }));
    }
    async deletePaymentMethod(paymentMethodId, req) {
        const userId = req.user?.id || 'test-user';
        await this.stripeService.deletePaymentMethod(userId, paymentMethodId);
    }
    async setDefaultPaymentMethod(paymentMethodId, req) {
        const userId = req.user?.id || 'test-user';
        return this.stripeService.setDefaultPaymentMethod(userId, paymentMethodId);
    }
};
exports.PaymentController = PaymentController;
__decorate([
    (0, common_1.Get)('plans'),
    (0, swagger_1.ApiOperation)({ summary: 'Get available subscription plans' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns list of available subscription plans',
        type: [subscription_dto_1.SubscriptionPlanDto],
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], PaymentController.prototype, "getPlans", null);
__decorate([
    (0, common_1.Post)('create-payment-intent'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Create payment intent for subscription' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Payment intent created successfully',
        type: payment_dto_1.PaymentIntentResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid request' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.CreatePaymentIntentDto, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "createPaymentIntent", null);
__decorate([
    (0, common_1.Post)('setup-intent'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Create setup intent for saving payment method' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Setup intent created successfully',
        type: payment_dto_1.SetupIntentResponseDto,
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [payment_dto_1.CreateSetupIntentDto, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "createSetupIntent", null);
__decorate([
    (0, common_1.Get)('billing-history'),
    (0, swagger_1.ApiOperation)({ summary: 'Get billing history for current user' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns billing history',
        type: [payment_dto_1.BillingHistoryDto],
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "getBillingHistory", null);
__decorate([
    (0, common_1.Get)('payment-methods'),
    (0, swagger_1.ApiOperation)({ summary: 'Get saved payment methods' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns list of payment methods',
        type: [payment_dto_1.PaymentMethodDto],
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "getPaymentMethods", null);
__decorate([
    (0, common_1.Delete)('payment-methods/:paymentMethodId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a payment method' }),
    (0, swagger_1.ApiParam)({
        name: 'paymentMethodId',
        description: 'Payment method ID to delete',
    }),
    (0, swagger_1.ApiResponse)({
        status: 204,
        description: 'Payment method deleted successfully',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Payment method not found' }),
    __param(0, (0, common_1.Param)('paymentMethodId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "deletePaymentMethod", null);
__decorate([
    (0, common_1.Post)('payment-methods/:paymentMethodId/set-default'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Set default payment method' }),
    (0, swagger_1.ApiParam)({
        name: 'paymentMethodId',
        description: 'Payment method ID to set as default',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Default payment method set successfully',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Payment method not found' }),
    __param(0, (0, common_1.Param)('paymentMethodId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], PaymentController.prototype, "setDefaultPaymentMethod", null);
exports.PaymentController = PaymentController = __decorate([
    (0, swagger_1.ApiTags)('Payments'),
    (0, common_1.Controller)('api/v1/payments'),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [stripe_service_1.StripeService])
], PaymentController);
//# sourceMappingURL=payment.controller.js.map