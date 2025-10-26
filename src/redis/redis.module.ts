/**
 * Redis Module
 * Provides Redis connection for event publishing
 *
 * Last Updated On: 2025-08-06
 */

import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService): Redis => {
        const redisHost: string = configService.get<string>(
          'REDIS_HOST',
          'localhost',
        );
        const redisPort: number = configService.get<number>('REDIS_PORT', 6379);
        const redisPassword: string | undefined =
          configService.get<string>('REDIS_PASSWORD');
        const redisDb: number = configService.get<number>('REDIS_DB', 0);

        const redisOptions: RedisOptions = {
          host: redisHost,
          port: redisPort,
          password: redisPassword,
          db: redisDb,
        };

        const client: Redis = new Redis(redisOptions);

        client.on('error', (err: Error) => {
          console.error('Redis Client Error:', err);
        });

        client.on('connect', () => {
          console.log('Redis Client Connected');
        });

        return client;
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', RedisService],
})
export class RedisModule {}
