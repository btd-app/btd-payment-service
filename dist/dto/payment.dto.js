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
exports.BillingHistoryDto = exports.PaymentMethodDto = exports.SetupIntentResponseDto = exports.PaymentIntentResponseDto = exports.SetDefaultPaymentMethodDto = exports.CreateSetupIntentDto = exports.CreatePaymentIntentDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreatePaymentIntentDto {
    planId;
    paymentMethodId;
    currency;
}
exports.CreatePaymentIntentDto = CreatePaymentIntentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Subscription plan ID' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreatePaymentIntentDto.prototype, "planId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Payment method ID from Stripe' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePaymentIntentDto.prototype, "paymentMethodId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Currency code', default: 'usd' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreatePaymentIntentDto.prototype, "currency", void 0);
class CreateSetupIntentDto {
    usage;
}
exports.CreateSetupIntentDto = CreateSetupIntentDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Usage type for the payment method' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateSetupIntentDto.prototype, "usage", void 0);
class SetDefaultPaymentMethodDto {
    paymentMethodId;
}
exports.SetDefaultPaymentMethodDto = SetDefaultPaymentMethodDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Payment method ID to set as default' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SetDefaultPaymentMethodDto.prototype, "paymentMethodId", void 0);
class PaymentIntentResponseDto {
    clientSecret;
    paymentIntentId;
    amount;
    currency;
}
exports.PaymentIntentResponseDto = PaymentIntentResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Object)
], PaymentIntentResponseDto.prototype, "clientSecret", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PaymentIntentResponseDto.prototype, "paymentIntentId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], PaymentIntentResponseDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PaymentIntentResponseDto.prototype, "currency", void 0);
class SetupIntentResponseDto {
    clientSecret;
    setupIntentId;
}
exports.SetupIntentResponseDto = SetupIntentResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Object)
], SetupIntentResponseDto.prototype, "clientSecret", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], SetupIntentResponseDto.prototype, "setupIntentId", void 0);
class PaymentMethodDto {
    id;
    userId;
    stripePaymentMethodId;
    type;
    brand;
    last4;
    expiryMonth;
    expiryYear;
    isDefault;
    createdAt;
    updatedAt;
}
exports.PaymentMethodDto = PaymentMethodDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PaymentMethodDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PaymentMethodDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PaymentMethodDto.prototype, "stripePaymentMethodId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PaymentMethodDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], PaymentMethodDto.prototype, "brand", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], PaymentMethodDto.prototype, "last4", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Number)
], PaymentMethodDto.prototype, "expiryMonth", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", Number)
], PaymentMethodDto.prototype, "expiryYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], PaymentMethodDto.prototype, "isDefault", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], PaymentMethodDto.prototype, "createdAt", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], PaymentMethodDto.prototype, "updatedAt", void 0);
class BillingHistoryDto {
    id;
    userId;
    stripeInvoiceId;
    amount;
    currency;
    status;
    description;
    periodStart;
    periodEnd;
    invoiceUrl;
    receiptUrl;
    pdfUrl;
    createdAt;
}
exports.BillingHistoryDto = BillingHistoryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillingHistoryDto.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillingHistoryDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillingHistoryDto.prototype, "stripeInvoiceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Number)
], BillingHistoryDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillingHistoryDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillingHistoryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], BillingHistoryDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], BillingHistoryDto.prototype, "periodStart", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], BillingHistoryDto.prototype, "periodEnd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], BillingHistoryDto.prototype, "invoiceUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], BillingHistoryDto.prototype, "receiptUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    __metadata("design:type", String)
], BillingHistoryDto.prototype, "pdfUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Date)
], BillingHistoryDto.prototype, "createdAt", void 0);
//# sourceMappingURL=payment.dto.js.map