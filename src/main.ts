import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import {
  getServiceProtoPath,
  getHealthProtoPath,
  getProtoDir,
  getProtoStandardDir,
} from '@btd/proto';
import { CorrelationIdMiddleware } from './shared/middleware/correlation-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for webhook signature verification
  });

  // Configure gRPC microservice
  const grpcPort = process.env.GRPC_PORT || '50055';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: ['btd.payment.v1', 'grpc.health.v1'],
      protoPath: [getServiceProtoPath('payment'), getHealthProtoPath()],
      url: `0.0.0.0:${grpcPort}`,
      loader: {
        keepCase: true, // CRITICAL: Keep snake_case field names from proto files
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [getProtoDir(), getProtoStandardDir()],
      },
      maxReceiveMessageLength: 8 * 1024 * 1024, // 8MB
      maxSendMessageLength: 8 * 1024 * 1024, // 8MB
    },
  });

  // Apply correlation ID middleware globally
  const correlationMiddleware = new CorrelationIdMiddleware();
  app.use(correlationMiddleware.use.bind(correlationMiddleware));

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8100',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Correlation-ID',
      'X-Request-ID',
      'X-Calling-Service',
      'X-Internal-Key',
    ],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation (only in non-production environments)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('BTD Payment Service')
      .setDescription(
        'Comprehensive payment processing, subscription management, and billing operations for BTD dating platform',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('subscriptions', 'Subscription tier management')
      .addTag('payments', 'Payment processing operations')
      .addTag('billing', 'Billing and invoice management')
      .addTag('webhooks', 'Payment provider webhooks')
      .addTag('refunds', 'Refund processing')
      .addTag('reports', 'Financial reporting')
      .addTag('health', 'Service health monitoring')
      .setContact('BTD Support', 'https://btd.com/support', 'support@btd.com')
      .setLicense('Proprietary', 'https://btd.com/license')
      .addServer(
        `http://localhost:${process.env.PORT ?? 3500}`,
        'Local Development',
      )
      .addServer('https://api.btd.com', 'Production')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'BTD Payment Service API',
      customfavIcon: 'https://btd.com/favicon.ico',
      customCss: '.swagger-ui .topbar { display: none }',
    });

    console.log(
      `📚 Swagger documentation available at: http://localhost:${process.env.PORT ?? 3500}/api/docs`,
    );
  }

  // Start all microservices
  await app.startAllMicroservices();

  // Start HTTP server
  await app.listen(process.env.PORT ?? 3500);
  console.log(`💳 Payment service running on port ${process.env.PORT ?? 3500}`);
  console.log(`🔗 gRPC server listening on port ${grpcPort}`);
}

// Start the application with proper error handling
void bootstrap().catch((error) => {
  console.error('Failed to start payment service:', error);
  process.exit(1);
});
// Test deployment to development environment - Mon Oct 27 03:09:52 PM PDT 2025
// Test deployment to development environment - Mon Oct 27 03:10:54 PM PDT 2025
