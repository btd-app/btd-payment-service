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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const ioredis_1 = require("ioredis");
let RedisService = RedisService_1 = class RedisService {
    constructor(redis) {
        this.redis = redis;
        this.logger = new common_1.Logger(RedisService_1.name);
    }
    async publishPaymentEvent(event) {
        try {
            const channel = `payment:${event.type}`;
            const message = JSON.stringify({
                ...event,
                timestamp: event.timestamp || new Date(),
            });
            await this.redis.publish(channel, message);
            this.logger.debug(`Published event to ${channel}: ${event.type}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to publish event: ${errorMessage}`);
            throw error;
        }
    }
    async publishSubscriptionCreated(userId, subscriptionData) {
        await this.publishPaymentEvent({
            type: 'subscription.created',
            userId,
            data: subscriptionData,
            timestamp: new Date(),
        });
    }
    async publishSubscriptionUpdated(userId, subscriptionData) {
        await this.publishPaymentEvent({
            type: 'subscription.updated',
            userId,
            data: subscriptionData,
            timestamp: new Date(),
        });
    }
    async publishSubscriptionCancelled(userId, subscriptionData) {
        await this.publishPaymentEvent({
            type: 'subscription.cancelled',
            userId,
            data: subscriptionData,
            timestamp: new Date(),
        });
    }
    async publishPaymentSucceeded(userId, paymentData) {
        await this.publishPaymentEvent({
            type: 'payment.succeeded',
            userId,
            data: paymentData,
            timestamp: new Date(),
        });
    }
    async publishPaymentFailed(userId, paymentData) {
        await this.publishPaymentEvent({
            type: 'payment.failed',
            userId,
            data: paymentData,
            timestamp: new Date(),
        });
    }
    async publishFeatureAccessGranted(userId, feature, tier) {
        await this.publishPaymentEvent({
            type: 'feature.access_granted',
            userId,
            data: { feature, tier },
            timestamp: new Date(),
        });
    }
    async publishFeatureAccessRevoked(userId, feature, reason) {
        await this.publishPaymentEvent({
            type: 'feature.access_revoked',
            userId,
            data: { feature, reason },
            timestamp: new Date(),
        });
    }
    async publishTrialEnding(userId, daysRemaining) {
        await this.publishPaymentEvent({
            type: 'trial.ending',
            userId,
            data: { daysRemaining },
            timestamp: new Date(),
        });
    }
    async getCachedSubscription(userId) {
        try {
            const key = `subscription:${userId}`;
            const data = await this.redis.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to get cached subscription: ${errorMessage}`);
            return null;
        }
    }
    async cacheSubscription(userId, subscriptionData, ttl = 3600) {
        try {
            const key = `subscription:${userId}`;
            await this.redis.setex(key, ttl, JSON.stringify(subscriptionData));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to cache subscription: ${errorMessage}`);
        }
    }
    async invalidateSubscriptionCache(userId) {
        try {
            const key = `subscription:${userId}`;
            await this.redis.del(key);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Failed to invalidate subscription cache: ${errorMessage}`);
        }
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)('REDIS_CLIENT')),
    __metadata("design:paramtypes", [ioredis_1.Redis])
], RedisService);
//# sourceMappingURL=redis.service.js.map