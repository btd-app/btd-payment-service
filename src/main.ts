import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for webhook signature verification
  });

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:8100',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  if (process.env.NODE_ENV === 'development') {
    const config = new DocumentBuilder()
      .setTitle('BTD Payment Service')
      .setDescription('Payment and subscription management for BTD')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3500);
  console.log(`Payment service running on port ${process.env.PORT ?? 3500}`);
}
bootstrap();
