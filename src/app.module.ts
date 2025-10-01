/**
 * Main Application Module
 * Configures all modules, services, and middleware for the payment service
 * 
 * Last Updated On: 2025-08-06
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PaymentModule } from './payment/payment.module';
import { SubscriptionJobsService } from './scheduled/subscription-jobs.service';
import { PaymentController } from './controllers/payment.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { WebhookController } from './controllers/webhook.controller';
import { StripeService } from './services/stripe.service';
import { SubscriptionService } from './services/subscription.service';
import { GrpcModule } from './grpc/grpc.module';
import stripeConfig from './config/stripe.config';
import { raw } from 'express';
import { ConsulServiceRegistration } from './consul-service-registration';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [stripeConfig],
      envFilePath: ['.env', '.env.local'],
    }),

    // Scheduling
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Database
    PrismaModule,

    // Payment Module (includes Apple App Store integration)
    PaymentModule,

    // gRPC Module
    GrpcModule,
  ],
  controllers: [
    AppController,
    PaymentController,
    SubscriptionController,
    WebhookController,
  ],
  providers: [
    ConsulServiceRegistration,
    AppService,
    StripeService,
    SubscriptionService,
    SubscriptionJobsService, // Scheduled jobs for subscription management
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware for raw body on webhook endpoint
   */
  configure(consumer: MiddlewareConsumer) {
    // Apply raw body middleware only to Stripe webhook endpoint
    consumer
      .apply(raw({ type: 'application/json' }))
      .forRoutes('api/v1/webhooks/stripe');
  }
}