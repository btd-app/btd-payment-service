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
var SubscriptionJobsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionJobsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
let SubscriptionJobsService = SubscriptionJobsService_1 = class SubscriptionJobsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(SubscriptionJobsService_1.name);
    }
    async resetDailyLimits() {
        this.logger.log('Starting daily limits reset job');
        try {
            const result = await this.prisma.userPremiumFeatures.updateMany({
                data: {
                    dailyLikesUsed: 0,
                    dailySuperLikesUsed: 0,
                    lastResetAt: new Date(),
                },
            });
            this.logger.log(`Reset daily limits for ${result.count} users`);
        }
        catch (error) {
            this.logger.error(`Daily limits reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async checkExpiredSubscriptions() {
        this.logger.log('Starting expired subscriptions check');
        try {
            const expiredSubscriptions = await this.prisma.subscription.findMany({
                where: {
                    status: 'ACTIVE',
                    currentPeriodEnd: {
                        lt: new Date(),
                    },
                },
            });
            for (const subscription of expiredSubscriptions) {
                await this.prisma.subscription.update({
                    where: { id: subscription.id },
                    data: { status: 'EXPIRED' },
                });
                await this.prisma.userPremiumFeatures.update({
                    where: { userId: subscription.userId },
                    data: {
                        unlimitedLikes: false,
                        whoLikedMe: false,
                        topPicks: false,
                        rewind: false,
                        passport: false,
                        incognito: false,
                        boostsRemaining: 0,
                        superLikesRemaining: 0,
                    },
                });
                this.logger.log(`Expired subscription for user: ${subscription.userId}`);
            }
            if (expiredSubscriptions.length > 0) {
                this.logger.log(`Processed ${expiredSubscriptions.length} expired subscriptions`);
            }
        }
        catch (error) {
            this.logger.error(`Expired subscriptions check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async checkBillingRetrySubscriptions() {
        this.logger.log('Starting billing retry check');
        try {
            const retrySubscriptions = await this.prisma.subscription.findMany({
                where: {
                    status: 'BILLING_RETRY',
                    currentPeriodEnd: {
                        gt: new Date(),
                    },
                },
            });
            if (retrySubscriptions.length > 0) {
                this.logger.log(`Found ${retrySubscriptions.length} subscriptions in billing retry`);
            }
        }
        catch (error) {
            this.logger.error(`Billing retry check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async cleanupOldWebhookLogs() {
        this.logger.log('Starting webhook log cleanup');
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const result = await this.prisma.appleWebhookLog.deleteMany({
                where: {
                    createdAt: {
                        lt: thirtyDaysAgo,
                    },
                },
            });
            if (result.count > 0) {
                this.logger.log(`Deleted ${result.count} old webhook logs`);
            }
        }
        catch (error) {
            this.logger.error(`Webhook log cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async syncPendingTransactions() {
        this.logger.debug('Checking for pending transactions');
        try {
            const pendingTransactions = await this.prisma.appleTransaction.findMany({
                where: {
                    status: null,
                    processedAt: null,
                },
                take: 10,
            });
            if (pendingTransactions.length > 0) {
                this.logger.log(`Found ${pendingTransactions.length} pending transactions to process`);
            }
        }
        catch (error) {
            this.logger.error(`Pending transactions sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
};
exports.SubscriptionJobsService = SubscriptionJobsService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionJobsService.prototype, "resetDailyLimits", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionJobsService.prototype, "checkExpiredSubscriptions", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_6_HOURS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionJobsService.prototype, "checkBillingRetrySubscriptions", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_1AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionJobsService.prototype, "cleanupOldWebhookLogs", null);
__decorate([
    (0, schedule_1.Cron)('0 */5 * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SubscriptionJobsService.prototype, "syncPendingTransactions", null);
exports.SubscriptionJobsService = SubscriptionJobsService = SubscriptionJobsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionJobsService);
//# sourceMappingURL=subscription-jobs.service.js.map