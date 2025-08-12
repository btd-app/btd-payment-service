"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_service_1 = require("./redis.service");
let RedisModule = class RedisModule {
};
exports.RedisModule = RedisModule;
exports.RedisModule = RedisModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            {
                provide: 'REDIS_CLIENT',
                useFactory: async (configService) => {
                    const Redis = require('ioredis');
                    const client = new Redis({
                        host: configService.get('REDIS_HOST', 'localhost'),
                        port: configService.get('REDIS_PORT', 6379),
                        password: configService.get('REDIS_PASSWORD'),
                        db: configService.get('REDIS_DB', 0),
                    });
                    client.on('error', (err) => {
                        console.error('Redis Client Error:', err);
                    });
                    client.on('connect', () => {
                        console.log('Redis Client Connected');
                    });
                    return client;
                },
                inject: [config_1.ConfigService],
            },
            redis_service_1.RedisService,
        ],
        exports: ['REDIS_CLIENT', redis_service_1.RedisService],
    })
], RedisModule);
//# sourceMappingURL=redis.module.js.map