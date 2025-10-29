"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const swagger_1 = require("@nestjs/swagger");
const microservices_1 = require("@nestjs/microservices");
const proto_1 = require("@btd/proto");
const correlation_id_middleware_1 = require("./shared/middleware/correlation-id.middleware");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        rawBody: true,
    });
    const grpcPort = process.env.GRPC_PORT || '50055';
    app.connectMicroservice({
        transport: microservices_1.Transport.GRPC,
        options: {
            package: ['btd.payment.v1', 'grpc.health.v1'],
            protoPath: [(0, proto_1.getServiceProtoPath)('payment'), (0, proto_1.getHealthProtoPath)()],
            url: `0.0.0.0:${grpcPort}`,
            loader: {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
                includeDirs: [(0, proto_1.getProtoDir)(), (0, proto_1.getProtoStandardDir)()],
            },
            maxReceiveMessageLength: 8 * 1024 * 1024,
            maxSendMessageLength: 8 * 1024 * 1024,
        },
    });
    const correlationMiddleware = new correlation_id_middleware_1.CorrelationIdMiddleware();
    app.use(correlationMiddleware.use.bind(correlationMiddleware));
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
    app.setGlobalPrefix('api/v1');
    if (process.env.NODE_ENV !== 'production') {
        const config = new swagger_1.DocumentBuilder()
            .setTitle('BTD Payment Service')
            .setDescription('Comprehensive payment processing, subscription management, and billing operations for BTD dating platform')
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
            .addServer(`http://localhost:${process.env.PORT ?? 3500}`, 'Local Development')
            .addServer('https://api.btd.com', 'Production')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('api/docs', app, document, {
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
        console.log(`📚 Swagger documentation available at: http://localhost:${process.env.PORT ?? 3500}/api/docs`);
    }
    await app.startAllMicroservices();
    await app.listen(process.env.PORT ?? 3500);
    console.log(`💳 Payment service running on port ${process.env.PORT ?? 3500}`);
    console.log(`🔗 gRPC server listening on port ${grpcPort}`);
}
void bootstrap().catch((error) => {
    console.error('Failed to start payment service:', error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map