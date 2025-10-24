import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionJobsService {
  private readonly logger = new Logger(SubscriptionJobsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async resetDailyLimits() {
    this.logger.log('Starting daily limits reset job');

    try {
      // Reset daily usage counters for all users
      const result = await this.prisma.userPremiumFeatures.updateMany({
        data: {
          dailyLikesUsed: 0,
          dailySuperLikesUsed: 0,
          lastResetAt: new Date(),
        },
      });

      this.logger.log(`Reset daily limits for ${result.count} users`);
    } catch (error) {
      this.logger.error(`Daily limits reset failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredSubscriptions() {
    this.logger.log('Starting expired subscriptions check');

    try {
      // Find subscriptions that have expired
      const expiredSubscriptions = await this.prisma.subscription.findMany({
        where: {
          status: 'ACTIVE',
          currentPeriodEnd: {
            lt: new Date(),
          },
        },
      });

      for (const subscription of expiredSubscriptions) {
        // Update subscription status
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' },
        });

        // Reset user features to free tier
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
    } catch (error) {
      this.logger.error(`Expired subscriptions check failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async checkBillingRetrySubscriptions() {
    this.logger.log('Starting billing retry check');

    try {
      // Find subscriptions in billing retry status
      const retrySubscriptions = await this.prisma.subscription.findMany({
        where: {
          status: 'BILLING_RETRY',
          currentPeriodEnd: {
            gt: new Date(),
          },
        },
      });

      // In production, this would trigger a re-attempt to charge the user
      // For now, just log them
      if (retrySubscriptions.length > 0) {
        this.logger.log(`Found ${retrySubscriptions.length} subscriptions in billing retry`);
      }
    } catch (error) {
      this.logger.error(`Billing retry check failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanupOldWebhookLogs() {
    this.logger.log('Starting webhook log cleanup');

    try {
      // Delete webhook logs older than 30 days
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
    } catch (error) {
      this.logger.error(`Webhook log cleanup failed: ${error.message}`);
    }
  }

  @Cron('0 */5 * * * *') // Every 5 minutes
  async syncPendingTransactions() {
    this.logger.debug('Checking for pending transactions');

    try {
      // Find transactions that haven't been processed yet
      const pendingTransactions = await this.prisma.appleTransaction.findMany({
        where: {
          status: null,
          processedAt: null,
        },
        take: 10,
      });

      if (pendingTransactions.length > 0) {
        this.logger.log(`Found ${pendingTransactions.length} pending transactions to process`);
        // In production, this would verify these with Apple
      }
    } catch (error) {
      this.logger.error(`Pending transactions sync failed: ${error.message}`);
    }
  }
}