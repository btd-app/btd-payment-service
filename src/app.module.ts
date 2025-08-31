/**
 * Main Application Module
 * Configures all modules, services, and middleware for the payment service
 * 
 * Last Updated On: 2025-08-06
 */

import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { PaymentController } from './controllers/payment.controller';
import { SubscriptionController } from './controllers/subscription.controller';
import { WebhookController } from './controllers/webhook.controller';
import { StripeService } from './services/stripe.service';
import { SubscriptionService } from './services/subscription.service';
import { GrpcModule } from './grpc/grpc.module';
import stripeConfig from './config/stripe.config';
import { raw } from 'express';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [stripeConfig],
      envFilePath: ['.env', '.env.local'],
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    
    // Database
    PrismaModule,
    
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
    AppService,
    StripeService,
    SubscriptionService,
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