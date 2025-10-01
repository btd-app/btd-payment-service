/**
 * gRPC Module for Payment Service
 * Configures gRPC server for payment operations
 */
import { Module, Global } from '@nestjs/common';
import { PaymentGrpcController } from './payment-grpc.controller';
import { HealthController } from './health.controller';
import { SubscriptionService } from '../services/subscription.service';
import { StripeService } from '../services/stripe.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PaymentGrpcController],
  providers: [SubscriptionService, StripeService],
  exports: [],
})
export class GrpcModule {}