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
exports.SubscriptionController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const stripe_service_1 = require("../services/stripe.service");
const subscription_service_1 = require("../services/subscription.service");
const subscription_dto_1 = require("../dto/subscription.dto");
let SubscriptionController = class SubscriptionController {
    constructor(stripeService, subscriptionService) {
        this.stripeService = stripeService;
        this.subscriptionService = subscriptionService;
    }
    async getCurrentSubscription(req) {
        const userId = req.user?.id || 'test-user';
        return this.stripeService.getCurrentSubscription(userId);
    }
    async createSubscription(dto, req) {
        const userId = req.user?.id || 'test-user';
        const userEmail = req.user?.email || 'test@example.com';
        await this.stripeService.createOrGetCustomer(userId, userEmail);
        return this.stripeService.createSubscription(userId, dto.planId, dto.paymentMethodId);
    }
    async updateSubscription(subscriptionId, dto, req) {
        const userId = req.user?.id || 'test-user';
        if (dto.cancelAtPeriodEnd !== undefined) {
            if (dto.cancelAtPeriodEnd) {
                await this.stripeService.cancelSubscription(userId, dto.cancelAtPeriodEnd);
                const subscription = await this.stripeService.getCurrentSubscription(userId);
                return {
                    subscriptionId: subscription.stripeSubscriptionId || '',
                    status: subscription.status,
                    currentPeriodEnd: subscription.currentPeriodEnd,
                };
            }
            else {
                return this.stripeService.reactivateSubscription(userId, subscriptionId);
            }
        }
        if (dto.planId) {
            await this.stripeService.updateSubscription(userId, dto.planId, dto.cancelAtPeriodEnd);
            const subscription = await this.stripeService.getCurrentSubscription(userId);
            return {
                subscriptionId: subscription.stripeSubscriptionId || '',
                status: subscription.status,
                currentPeriodEnd: subscription.currentPeriodEnd,
            };
        }
        throw new Error('No valid update parameters provided');
    }
    async cancelSubscription(subscriptionId, req) {
        const userId = req.user?.id || 'test-user';
        await this.stripeService.cancelSubscriptionImmediately(userId, subscriptionId);
    }
    async createCheckoutSession(dto, req) {
        const userId = req.user?.id || 'test-user';
        const userEmail = req.user?.email || 'test@example.com';
        return this.stripeService.createCheckoutSession(userId, userEmail, dto.priceId, dto.successUrl, dto.cancelUrl);
    }
    async createPortalSession(dto, req) {
        const userId = req.user?.id || 'test-user';
        return this.stripeService.createPortalSession(userId, dto.returnUrl);
    }
    async getSubscriptionFeatures(req) {
        const userId = req.user?.id || 'test-user';
        const subscription = await this.stripeService.getCurrentSubscription(userId);
        return this.subscriptionService.getSubscriptionFeatures(subscription.subscriptionTier);
    }
    async validateFeatureAccess(dto, req) {
        const userId = req.user?.id || 'test-user';
        return this.subscriptionService.validateFeatureAccess(userId, dto.feature);
    }
    getCallUsageStats(req) {
        const userId = req.user?.id || 'test-user';
        return this.subscriptionService.getCallUsageStats(userId);
    }
    async trackFeatureUsage(dto, req) {
        const userId = req.user?.id || 'test-user';
        await this.subscriptionService.trackFeatureUsage(userId, dto.feature, dto.metadata);
        return { success: true };
    }
};
exports.SubscriptionController = SubscriptionController;
__decorate([
    (0, common_1.Get)('current'),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user subscription' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns current subscription',
        type: subscription_dto_1.UserSubscriptionDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'No active subscription found' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "getCurrentSubscription", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({ summary: 'Create new subscription' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Subscription created successfully',
        type: subscription_dto_1.SubscriptionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid request' }),
    (0, swagger_1.ApiResponse)({
        status: 409,
        description: 'Active subscription already exists',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [subscription_dto_1.CreateSubscriptionDto, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "createSubscription", null);
__decorate([
    (0, common_1.Put)(':subscriptionId'),
    (0, swagger_1.ApiOperation)({ summary: 'Update subscription (upgrade/downgrade/cancel)' }),
    (0, swagger_1.ApiParam)({
        name: 'subscriptionId',
        description: 'Subscription ID to update',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Subscription updated successfully',
        type: subscription_dto_1.SubscriptionResponseDto,
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Subscription not found' }),
    __param(0, (0, common_1.Param)('subscriptionId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, subscription_dto_1.UpdateSubscriptionDto, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "updateSubscription", null);
__decorate([
    (0, common_1.Delete)(':subscriptionId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel subscription immediately' }),
    (0, swagger_1.ApiParam)({
        name: 'subscriptionId',
        description: 'Subscription ID to cancel',
    }),
    (0, swagger_1.ApiResponse)({
        status: 204,
        description: 'Subscription cancelled successfully',
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Subscription not found' }),
    __param(0, (0, common_1.Param)('subscriptionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "cancelSubscription", null);
__decorate([
    (0, common_1.Post)('checkout-session'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Create Stripe Checkout session for subscription' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Checkout session created successfully',
        schema: {
            properties: {
                sessionId: { type: 'string' },
                url: { type: 'string' },
            },
        },
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [subscription_dto_1.CreateCheckoutSessionDto, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "createCheckoutSession", null);
__decorate([
    (0, common_1.Post)('portal-session'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Create Stripe Portal session for self-service subscription management',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Portal session created successfully',
        schema: {
            properties: {
                url: { type: 'string' },
            },
        },
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [subscription_dto_1.CreatePortalSessionDto, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "createPortalSession", null);
__decorate([
    (0, common_1.Get)('features'),
    (0, swagger_1.ApiOperation)({ summary: 'Get subscription features for current user' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns subscription features',
        type: subscription_dto_1.SubscriptionFeaturesDto,
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "getSubscriptionFeatures", null);
__decorate([
    (0, common_1.Post)('validate-feature'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Validate if user has access to a specific feature',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Feature access validation result',
        type: subscription_dto_1.FeatureAccessResponseDto,
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [subscription_dto_1.ValidateFeatureAccessDto, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "validateFeatureAccess", null);
__decorate([
    (0, common_1.Get)('call-usage'),
    (0, swagger_1.ApiOperation)({ summary: 'Get call usage statistics for current user' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Returns call usage statistics',
        type: subscription_dto_1.CallUsageStatsDto,
    }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", subscription_dto_1.CallUsageStatsDto)
], SubscriptionController.prototype, "getCallUsageStats", null);
__decorate([
    (0, common_1.Post)('track-usage'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Track feature usage for analytics' }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'Usage tracked successfully',
    }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SubscriptionController.prototype, "trackFeatureUsage", null);
exports.SubscriptionController = SubscriptionController = __decorate([
    (0, swagger_1.ApiTags)('Subscriptions'),
    (0, common_1.Controller)('api/v1/subscriptions'),
    (0, swagger_1.ApiBearerAuth)(),
    __metadata("design:paramtypes", [stripe_service_1.StripeService,
        subscription_service_1.SubscriptionService])
], SubscriptionController);
//# sourceMappingURL=subscription.controller.js.map