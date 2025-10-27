import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class ConsulServiceRegistration implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly logger;
    private serviceRegistrar;
    constructor(configService: ConfigService);
    private checkConsulHealth;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    updateServiceMetadata(metadata: Record<string, unknown>): Promise<void>;
    updateHealthStatus(status: 'passing' | 'warning' | 'critical', note?: string): Promise<void>;
    isRegistered(): boolean;
    getServiceId(): string | null;
}
