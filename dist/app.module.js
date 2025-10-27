"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const schedule_1 = require("@nestjs/schedule");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const payment_module_1 = require("./payment/payment.module");
const subscription_jobs_service_1 = require("./scheduled/subscription-jobs.service");
const payment_controller_1 = require("./controllers/payment.controller");
const subscription_controller_1 = require("./controllers/subscription.controller");
const webhook_controller_1 = require("./controllers/webhook.controller");
const stripe_service_1 = require("./services/stripe.service");
const subscription_service_1 = require("./services/subscription.service");
const grpc_module_1 = require("./grpc/grpc.module");
const stripe_config_1 = require("./config/stripe.config");
const express_1 = require("express");
const consul_service_registration_1 = require("./consul-service-registration");
let AppModule = class AppModule {
    configure(consumer) {
        consumer
            .apply((0, express_1.raw)({ type: 'application/json' }))
            .forRoutes('api/v1/webhooks/stripe');
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [stripe_config_1.default],
                envFilePath: ['.env', '.env.local'],
            }),
            schedule_1.ScheduleModule.forRoot(),
            throttler_1.ThrottlerModule.forRoot([
                {
                    ttl: 60000,
                    limit: 100,
                },
            ]),
            prisma_module_1.PrismaModule,
            payment_module_1.PaymentModule,
            grpc_module_1.GrpcModule,
        ],
        controllers: [
            app_controller_1.AppController,
            payment_controller_1.PaymentController,
            subscription_controller_1.SubscriptionController,
            webhook_controller_1.WebhookController,
        ],
        providers: [
            consul_service_registration_1.ConsulServiceRegistration,
            app_service_1.AppService,
            stripe_service_1.StripeService,
            subscription_service_1.SubscriptionService,
            subscription_jobs_service_1.SubscriptionJobsService,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map