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
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private configService: ConfigService) {
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
  }

  /**
   * Connect to database on module initialization
   */
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Connected to payment database');
    } catch (error) {
      console.warn('⚠️  Database connection failed, running without database:', error.message);
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
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() can only be called in test environment');
    }

    const models = [
      'featureUsage',
      // 'callUsageStats', // This belongs in video-call service
      'paymentMethod',
      'webhookEvent',
      'billingHistory',
      'paymentIntent',
      'subscription',
    ];

    for (const model of models) {
      await this[model].deleteMany({});
    }
  }
}