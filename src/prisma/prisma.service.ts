/**
 * Prisma Service
 * Handles database connection and provides Prisma client
 *
 * Last Updated On: 2025-08-06
 */

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import '../types/external';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import '../types/prisma-extended';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get('DATABASE_URL'),
        },
      },
      log:
        configService.get('NODE_ENV') === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    });
  }

  /**
   * Connect to database on module initialization
   */
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Connected to payment database');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        '⚠️  Database connection failed, running without database:',
        errorMessage,
      );
    }
  }

  /**
   * Disconnect from database on module destruction
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Clean database for testing (only in test environment)
   */
  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() can only be called in test environment');
    }

    // Clean up database tables in reverse dependency order
    await this.featureUsage.deleteMany({});
    await this.paymentMethod.deleteMany({});
    await this.webhookEvent.deleteMany({});
    await this.billingHistory.deleteMany({});
    await this.paymentIntent.deleteMany({});
    await this.subscription.deleteMany({});
  }
}
