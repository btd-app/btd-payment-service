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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionFeaturesDto = exports.CallUsageStatsDto = exports.FeatureAccessResponseDto = exports.ValidateFeatureAccessDto = exports.SubscriptionPlanDto = exports.UserSubscriptionDto = exports.SubscriptionResponseDto = exports.CreatePortalSessionDto = exports.CreateCheckoutSessionDto = exports.UpdateSubscriptionDto = exports.CreateSubscriptionDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class CreateSubscriptionDto {
}
exports.CreateSubscriptionDto = CreateSubscriptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Subscription plan ID' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateSubscriptionDto.prototype, "planId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Payment method ID from Stripe' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateSubscriptionDto.prototype, "paymentMethodId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Stripe customer ID' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSubscriptionDto.prototype, "customerId", void 0);
class UpdateSubscriptionDto {
}
exports.UpdateSubscriptionDto = UpdateSubscriptionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'New plan ID to upgrade/downgrade to' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateSubscriptionDto.prototype, "planId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Cancel subscription at end of period' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], UpdateSubscriptionDto.prototype, "cancelAtPeriodEnd", void 0);
class CreateCheckoutSessionDto {
}
exports.CreateCheckoutSessionDto = CreateCheckoutSessionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Stripe price ID' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCheckoutSessionDto.prototype, "priceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Success redirect URL' }),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCheckoutSessionDto.prototype, "successUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cancel redirect URL' }),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateCheckoutSessionDto.prototype, "cancelUrl", void 0);
class CreatePortalSessionDto {
}
exports.CreatePortalSessionDto = CreatePortalSessionDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Return URL after portal session' }),
    (0, class_validator_1.IsUrl)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePortalSessionDto.prototype, "returnUrl", void 0);
class SubscriptionResponseDto {
}
exports.SubscriptionResponseDto = SubscriptionResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionResponseDto.prototype, "subscriptionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], SubscriptionResponseDto.prototype, "clientSecret", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.SubscriptionStatus }),
    __metadata("design:type", String)
], SubscriptionResponseDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], SubscriptionResponseDto.prototype, "currentPeriodEnd", void 0);
class UserSubscriptionDto {
}
exports.UserSubscriptionDto = UserSubscriptionDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserSubscriptionDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], UserSubscriptionDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.SubscriptionTier }),
    __metadata("design:type", String)
], UserSubscriptionDto.prototype, "subscriptionTier", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], UserSubscriptionDto.prototype, "stripeSubscriptionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], UserSubscriptionDto.prototype, "stripeCustomerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.SubscriptionStatus }),
    __metadata("design:type", String)
], UserSubscriptionDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], UserSubscriptionDto.prototype, "currentPeriodStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], UserSubscriptionDto.prototype, "currentPeriodEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], UserSubscriptionDto.prototype, "cancelAtPeriodEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], UserSubscriptionDto.prototype, "planId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Date)
], UserSubscriptionDto.prototype, "trialEnd", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], UserSubscriptionDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], UserSubscriptionDto.prototype, "updatedAt", void 0);
class SubscriptionPlanDto {
}
exports.SubscriptionPlanDto = SubscriptionPlanDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionPlanDto.prototype, "price", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "interval", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    __metadata("design:type", Array)
], SubscriptionPlanDto.prototype, "features", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "stripePriceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "stripeProductId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['DISCOVER', 'CONNECT', 'COMMUNITY'] }),
    __metadata("design:type", String)
], SubscriptionPlanDto.prototype, "tier", void 0);
class ValidateFeatureAccessDto {
}
exports.ValidateFeatureAccessDto = ValidateFeatureAccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Feature name to validate access for' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ValidateFeatureAccessDto.prototype, "feature", void 0);
class FeatureAccessResponseDto {
}
exports.FeatureAccessResponseDto = FeatureAccessResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], FeatureAccessResponseDto.prototype, "allowed", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], FeatureAccessResponseDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Boolean)
], FeatureAccessResponseDto.prototype, "upgradeRequired", void 0);
class CallUsageStatsDto {
}
exports.CallUsageStatsDto = CallUsageStatsDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CallUsageStatsDto.prototype, "totalCalls", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CallUsageStatsDto.prototype, "totalMinutes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CallUsageStatsDto.prototype, "videoCalls", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], CallUsageStatsDto.prototype, "audioCalls", void 0);
class SubscriptionFeaturesDto {
}
exports.SubscriptionFeaturesDto = SubscriptionFeaturesDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "canMakeVideoCalls", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "canMakeAudioCalls", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionFeaturesDto.prototype, "maxCallDuration", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionFeaturesDto.prototype, "maxVideoQuality", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "hasVirtualBackgrounds", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "hasBeautyFilters", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "hasAREffects", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "hasCallRecording", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "hasScreenSharing", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "hasGroupCalls", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionFeaturesDto.prototype, "maxGroupParticipants", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "hasCallScheduling", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionFeaturesDto.prototype, "dailyUnmatchedMessages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "unlimitedUnmatchedMessages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "voiceMessages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "videoMessages", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "messageReactions", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "readReceipts", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionFeaturesDto.prototype, "dailyLikes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "unlimitedLikes", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "seeWhoLikedYou", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "advancedFilters", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "travelMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "incognitoMode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionFeaturesDto.prototype, "maxPhotos", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "videoIntro", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], SubscriptionFeaturesDto.prototype, "profileBoostCount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "profileAnalytics", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "groupAudioRooms", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionFeaturesDto.prototype, "forumAccess", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "virtualEvents", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "aiCoaching", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], SubscriptionFeaturesDto.prototype, "communityMatchmaking", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionFeaturesDto.prototype, "searchPriority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionFeaturesDto.prototype, "messagePriority", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SubscriptionFeaturesDto.prototype, "supportPriority", void 0);
//# sourceMappingURL=subscription.dto.js.map