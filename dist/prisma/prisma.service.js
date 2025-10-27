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
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
require("../types/external");
const client_1 = require("@prisma/client");
const config_1 = require("@nestjs/config");
require("../types/prisma-extended");
let PrismaService = class PrismaService extends client_1.PrismaClient {
    constructor(configService) {
        super({
            datasources: {
                db: {
                    url: configService.get('DATABASE_URL'),
                },
            },
            log: configService.get('NODE_ENV') === 'development'
                ? ['query', 'error', 'warn']
                : ['error'],
        });
        this.configService = configService;
    }
    async onModuleInit() {
        try {
            await this.$connect();
            console.log('✅ Connected to payment database');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.warn('⚠️  Database connection failed, running without database:', errorMessage);
        }
    }
    async onModuleDestroy() {
        await this.$disconnect();
    }
    async cleanDatabase() {
        if (process.env.NODE_ENV !== 'test') {
            throw new Error('cleanDatabase() can only be called in test environment');
        }
        await this.featureUsage.deleteMany({});
        await this.paymentMethod.deleteMany({});
        await this.webhookEvent.deleteMany({});
        await this.billingHistory.deleteMany({});
        await this.paymentIntent.deleteMany({});
        await this.subscription.deleteMany({});
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map