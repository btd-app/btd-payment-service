/**
 * gRPC Module for Payment Service
 * Configures gRPC server for payment operations
 */
import { Module, Global } from '@nestjs/common';
import { PaymentGrpcController } from './payment-grpc.controller';

@Global()
@Module({
  controllers: [PaymentGrpcController],
  providers: [],
  exports: [],
})
export class GrpcModule {}