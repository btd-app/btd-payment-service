import { PrismaService } from '../prisma/prisma.service';
export declare class SubscriptionJobsService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    resetDailyLimits(): Promise<void>;
    checkExpiredSubscriptions(): Promise<void>;
    checkBillingRetrySubscriptions(): Promise<void>;
    cleanupOldWebhookLogs(): Promise<void>;
    syncPendingTransactions(): Promise<void>;
}
