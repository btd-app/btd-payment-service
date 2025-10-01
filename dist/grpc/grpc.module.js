"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrpcModule = void 0;
const common_1 = require("@nestjs/common");
const payment_grpc_controller_1 = require("./payment-grpc.controller");
const subscription_service_1 = require("../services/subscription.service");
const stripe_service_1 = require("../services/stripe.service");
const prisma_module_1 = require("../prisma/prisma.module");
let GrpcModule = class GrpcModule {
};
exports.GrpcModule = GrpcModule;
exports.GrpcModule = GrpcModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [payment_grpc_controller_1.PaymentGrpcController],
        providers: [subscription_service_1.SubscriptionService, stripe_service_1.StripeService],
        exports: [],
    })
], GrpcModule);
//# sourceMappingURL=grpc.module.js.map