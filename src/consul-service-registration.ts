/**
 * Consul Service Registration for Payment Service
 *
 * Automatically registers the service with Consul service discovery
 * and maintains health checks.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsulServiceRegistrar, ConsulServiceRegistrationConfig } from '@btd/shared';

@Injectable()
export class ConsulServiceRegistration implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsulServiceRegistration.name);
  private serviceRegistrar: ConsulServiceRegistrar;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if Consul is reachable before attempting registration
   */
  private async checkConsulHealth(consulUrl: string): Promise<boolean> {
    try {
      const axios = require('axios');
      const response = await axios.get(`${consulUrl}/v1/status/leader`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      this.logger.error(`Consul health check failed for ${consulUrl}: ${error.message}`);
      return false;
    }
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('🏛️ Initializing Consul Service Registration...');

    // Build Consul URL from environment variables
    const consulHost = this.configService.get('CONSUL_HOST') ?? '10.27.27.27';
    const consulPort = this.configService.get('CONSUL_PORT') ?? '8500';
    const consulUrl = `http://${consulHost}:${consulPort}`;

    // Verify Consul is reachable before attempting registration
    const consulHealthy = await this.checkConsulHealth(consulUrl);
    if (!consulHealthy) {
      this.logger.warn(`⚠️ Consul not reachable at ${consulUrl}, service will run without discovery`);
      return;
    }

    const config: ConsulServiceRegistrationConfig = {
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
        buildVersion: process.env.BUILD_VERSION || 'unknown',
        region: this.configService.get('REGION') ?? 'us-east-1'
      },
      consulUrl: consulUrl,
      healthCheckPath: '/health',
      healthCheckInterval: '30s',
      healthCheckTimeout: '10s',
      deregisterCriticalAfter: '90s'
    };

    this.serviceRegistrar = new ConsulServiceRegistrar(config);

    // Delay registration to ensure service is fully started
    setTimeout(async () => {
      await this.serviceRegistrar.register();
    }, 3000);

    this.logger.log('✅ Consul Service Registration initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('🔄 Shutting down Consul Service Registration...');

    if (this.serviceRegistrar) {
      await this.serviceRegistrar.deregister();
    }

    this.logger.log('✅ Consul Service Registration shutdown complete');
  }

  async updateServiceMetadata(metadata: Record<string, any>): Promise<void> {
    if (this.serviceRegistrar) {
      await this.serviceRegistrar.updateMetadata(metadata);
    }
  }

  async updateHealthStatus(status: 'passing' | 'warning' | 'critical', note?: string): Promise<void> {
    if (this.serviceRegistrar) {
      await this.serviceRegistrar.updateHealth(status, note);
    }
  }

  isRegistered(): boolean {
    return this.serviceRegistrar ? this.serviceRegistrar.isServiceRegistered() : false;
  }

  getServiceId(): string | null {
    return this.serviceRegistrar ? this.serviceRegistrar.getServiceId() : null;
  }
}
