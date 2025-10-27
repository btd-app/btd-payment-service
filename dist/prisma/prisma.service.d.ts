import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import '../types/external';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import '../types/prisma-extended';
export declare class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private configService;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    cleanDatabase(): Promise<void>;
}
