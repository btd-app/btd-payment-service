"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ConsulServiceRegistration_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsulServiceRegistration = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_1 = require("@btd/shared");
const axios_1 = __importDefault(require("axios"));
let ConsulServiceRegistration = ConsulServiceRegistration_1 = class ConsulServiceRegistration {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(ConsulServiceRegistration_1.name);
    }
    async checkConsulHealth(consulUrl) {
        try {
            const response = await axios_1.default.get(`${consulUrl}/v1/status/leader`, {
                timeout: 5000,
            });
            return response.status === 200;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Consul health check failed for ${consulUrl}: ${errorMessage}`);
            return false;
        }
    }
    async onModuleInit() {
        this.logger.log('🏛️ Initializing Consul Service Registration...');
        const consulHost = this.configService.get('CONSUL_HOST') ?? '10.27.27.27';
        const consulPort = this.configService.get('CONSUL_PORT') ?? '8500';
        const consulUrl = `http://${consulHost}:${consulPort}`;
        const consulHealthy = await this.checkConsulHealth(consulUrl);
        if (!consulHealthy) {
            this.logger.warn(`⚠️ Consul not reachable at ${consulUrl}, service will run without discovery`);
            return;
        }
        const config = {
            serviceName: 'btd-payment-service',
            version: this.configService.get('SERVICE_VERSION') ?? '1.0.0',
            host: this.configService.get('HOST') ?? 'localhost',
            port: this.configService.get('PORT') ?? 3011,
            grpcPort: this.configService.get('GRPC_PORT') ?? 50055,
            protocol: 'http',
            tags: ['payment', 'stripe', 'billing', 'microservice', 'btd'],
            metadata: {
                description: 'Payment service for BTD platform',
                environment: this.configService.get('NODE_ENV') ?? 'development',
                buildVersion: process.env.BUILD_VERSION ?? 'unknown',
                region: this.configService.get('REGION') ?? 'us-east-1',
            },
            consulUrl: consulUrl,
            healthCheckPath: '/health',
            healthCheckInterval: '30s',
            healthCheckTimeout: '10s',
            deregisterCriticalAfter: '90s',
        };
        this.serviceRegistrar = new shared_1.ConsulServiceRegistrar(config);
        setTimeout(() => {
            void this.serviceRegistrar.register();
        }, 3000);
        this.logger.log('✅ Consul Service Registration initialized');
    }
    async onModuleDestroy() {
        this.logger.log('🔄 Shutting down Consul Service Registration...');
        if (this.serviceRegistrar) {
            await this.serviceRegistrar.deregister();
        }
        this.logger.log('✅ Consul Service Registration shutdown complete');
    }
    async updateServiceMetadata(metadata) {
        if (this.serviceRegistrar) {
            await this.serviceRegistrar.updateMetadata(metadata);
        }
    }
    async updateHealthStatus(status, note) {
        if (this.serviceRegistrar) {
            await this.serviceRegistrar.updateHealth(status, note);
        }
    }
    isRegistered() {
        return this.serviceRegistrar
            ? this.serviceRegistrar.isServiceRegistered()
            : false;
    }
    getServiceId() {
        return this.serviceRegistrar ? this.serviceRegistrar.getServiceId() : null;
    }
};
exports.ConsulServiceRegistration = ConsulServiceRegistration;
exports.ConsulServiceRegistration = ConsulServiceRegistration = ConsulServiceRegistration_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ConsulServiceRegistration);
//# sourceMappingURL=consul-service-registration.js.map