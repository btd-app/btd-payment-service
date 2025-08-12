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
var SubscriptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
let SubscriptionService = SubscriptionService_1 = class SubscriptionService {
    prisma;
    logger = new common_1.Logger(SubscriptionService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getUserSubscription(userId) {
        try {
            const subscription = await this.prisma.userSubscription.findUnique({
                where: { userId },
            });
            return subscription || {
                userId,
                subscriptionTier: client_1.SubscriptionTier.DISCOVER,
                status: client_1.SubscriptionStatus.ACTIVE,
                currentPeriodStart: new Date(),
                currentPeriodEnd: new Date(),
                cancelAtPeriodEnd: false,
            };
        }
        catch (error) {
            this.logger.error('Error getting user subscription:', error);
            throw error;
        }
    }
    getSubscriptionFeatures(tier) {
        switch (tier) {
            case client_1.SubscriptionTier.DISCOVER:
                return {
                    canMakeVideoCalls: false,
                    canMakeAudioCalls: false,
                    maxCallDuration: 0,
                    maxVideoQuality: 'sd',
                    hasVirtualBackgrounds: false,
                    hasBeautyFilters: false,
                    hasAREffects: false,
                    hasCallRecording: false,
                    hasScreenSharing: false,
                    hasGroupCalls: false,
                    maxGroupParticipants: 0,
                    hasCallScheduling: false,
                    dailyUnmatchedMessages: 5,
                    unlimitedUnmatchedMessages: false,
                    voiceMessages: false,
                    videoMessages: false,
                    messageReactions: false,
                    readReceipts: false,
                    dailyLikes: 10,
                    unlimitedLikes: false,
                    seeWhoLikedYou: false,
                    advancedFilters: false,
                    travelMode: false,
                    incognitoMode: false,
                    maxPhotos: 3,
                    videoIntro: false,
                    profileBoostCount: 0,
                    profileAnalytics: false,
                    groupAudioRooms: false,
                    forumAccess: 'read',
                    virtualEvents: false,
                    aiCoaching: false,
                    communityMatchmaking: false,
                    searchPriority: 'normal',
                    messagePriority: 'normal',
                    supportPriority: 'normal',
                };
            case client_1.SubscriptionTier.CONNECT:
                return {
                    canMakeVideoCalls: false,
                    canMakeAudioCalls: true,
                    maxCallDuration: 30,
                    maxVideoQuality: 'hd',
                    hasVirtualBackgrounds: false,
                    hasBeautyFilters: false,
                    hasAREffects: false,
                    hasCallRecording: false,
                    hasScreenSharing: false,
                    hasGroupCalls: false,
                    maxGroupParticipants: 0,
                    hasCallScheduling: false,
                    dailyUnmatchedMessages: 25,
                    unlimitedUnmatchedMessages: false,
                    voiceMessages: true,
                    videoMessages: false,
                    messageReactions: true,
                    readReceipts: true,
                    dailyLikes: 50,
                    unlimitedLikes: false,
                    seeWhoLikedYou: true,
                    advancedFilters: true,
                    travelMode: true,
                    incognitoMode: false,
                    maxPhotos: 6,
                    videoIntro: false,
                    profileBoostCount: 3,
                    profileAnalytics: true,
                    groupAudioRooms: true,
                    forumAccess: 'write',
                    virtualEvents: true,
                    aiCoaching: false,
                    communityMatchmaking: true,
                    searchPriority: 'high',
                    messagePriority: 'high',
                    supportPriority: 'priority',
                };
            case client_1.SubscriptionTier.COMMUNITY:
                return {
                    canMakeVideoCalls: true,
                    canMakeAudioCalls: true,
                    maxCallDuration: 120,
                    maxVideoQuality: 'fhd',
                    hasVirtualBackgrounds: true,
                    hasBeautyFilters: true,
                    hasAREffects: true,
                    hasCallRecording: true,
                    hasScreenSharing: true,
                    hasGroupCalls: true,
                    maxGroupParticipants: 8,
                    hasCallScheduling: true,
                    dailyUnmatchedMessages: -1,
                    unlimitedUnmatchedMessages: true,
                    voiceMessages: true,
                    videoMessages: true,
                    messageReactions: true,
                    readReceipts: true,
                    dailyLikes: -1,
                    unlimitedLikes: true,
                    seeWhoLikedYou: true,
                    advancedFilters: true,
                    travelMode: true,
                    incognitoMode: true,
                    maxPhotos: 10,
                    videoIntro: true,
                    profileBoostCount: 10,
                    profileAnalytics: true,
                    groupAudioRooms: true,
                    forumAccess: 'vip',
                    virtualEvents: true,
                    aiCoaching: true,
                    communityMatchmaking: true,
                    searchPriority: 'ultra',
                    messagePriority: 'vip',
                    supportPriority: 'vip',
                };
            default:
                return this.getSubscriptionFeatures(client_1.SubscriptionTier.DISCOVER);
        }
    }
    async validateVideoCallAccess(userId, callType) {
        try {
            const subscription = await this.getUserSubscription(userId);
            const features = this.getSubscriptionFeatures(subscription.subscriptionTier);
            if (callType === 'video' && !features.canMakeVideoCalls) {
                return {
                    allowed: false,
                    reason: 'Video calls require Community subscription',
                    upgradeRequired: true,
                };
            }
            if (callType === 'audio' && !features.canMakeAudioCalls) {
                return {
                    allowed: false,
                    reason: 'Audio calls require Connect subscription or higher',
                    upgradeRequired: true,
                };
            }
            if (callType === 'screen_share' && !features.hasScreenSharing) {
                return {
                    allowed: false,
                    reason: 'Screen sharing requires Community subscription',
                    upgradeRequired: true,
                };
            }
            return { allowed: true };
        }
        catch (error) {
            this.logger.error('Error validating video call access:', error);
            return {
                allowed: false,
                reason: 'Unable to validate subscription access',
            };
        }
    }
    async validateCallDuration(userId, currentDurationMinutes) {
        try {
            const subscription = await this.getUserSubscription(userId);
            const features = this.getSubscriptionFeatures(subscription.subscriptionTier);
            if (features.maxCallDuration === 0) {
                return {
                    allowed: false,
                    reason: 'Calls not available on your current plan',
                };
            }
            if (currentDurationMinutes >= features.maxCallDuration) {
                return {
                    allowed: false,
                    reason: `Call duration limit (${features.maxCallDuration} minutes) reached`,
                };
            }
            return {
                allowed: true,
                timeRemaining: features.maxCallDuration - currentDurationMinutes,
            };
        }
        catch (error) {
            this.logger.error('Error validating call duration:', error);
            return {
                allowed: false,
                reason: 'Unable to validate call duration',
            };
        }
    }
    async validateFeatureAccess(userId, feature) {
        try {
            const subscription = await this.getUserSubscription(userId);
            const features = this.getSubscriptionFeatures(subscription.subscriptionTier);
            const hasAccess = features[feature];
            if (typeof hasAccess === 'boolean' && !hasAccess) {
                const featureNames = {
                    hasScreenSharing: 'Screen sharing',
                    hasVirtualBackgrounds: 'Virtual backgrounds',
                    hasBeautyFilters: 'Beauty filters',
                    hasAREffects: 'AR effects',
                    hasCallRecording: 'Call recording',
                    hasGroupCalls: 'Group calls',
                    hasCallScheduling: 'Call scheduling',
                    canMakeVideoCalls: 'Video calls',
                    canMakeAudioCalls: 'Audio calls',
                    voiceMessages: 'Voice messages',
                    videoMessages: 'Video messages',
                    seeWhoLikedYou: 'See who liked you',
                    travelMode: 'Travel mode',
                    incognitoMode: 'Incognito mode',
                    videoIntro: 'Video intro',
                    aiCoaching: 'AI coaching',
                };
                return {
                    allowed: false,
                    reason: `${featureNames[feature] || 'This feature'} requires a higher subscription tier`,
                };
            }
            return { allowed: true };
        }
        catch (error) {
            this.logger.error('Error validating feature access:', error);
            return {
                allowed: false,
                reason: 'Unable to validate feature access',
            };
        }
    }
    async getMonthlyCallUsage(userId) {
        try {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            const stats = await this.prisma.callUsageStats.findUnique({
                where: {
                    userId_month_year: {
                        userId,
                        month,
                        year,
                    },
                },
            });
            return {
                totalCalls: stats?.totalCalls || 0,
                totalMinutes: stats?.totalMinutes || 0,
                videoCalls: stats?.videoCalls || 0,
                audioCalls: stats?.audioCalls || 0,
            };
        }
        catch (error) {
            this.logger.error('Error getting monthly call usage:', error);
            return {
                totalCalls: 0,
                totalMinutes: 0,
                videoCalls: 0,
                audioCalls: 0,
            };
        }
    }
    async updateCallUsage(userId, callType, durationMinutes) {
        try {
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();
            await this.prisma.callUsageStats.upsert({
                where: {
                    userId_month_year: {
                        userId,
                        month,
                        year,
                    },
                },
                update: {
                    totalCalls: { increment: 1 },
                    totalMinutes: { increment: durationMinutes },
                    ...(callType === 'video'
                        ? { videoCalls: { increment: 1 } }
                        : { audioCalls: { increment: 1 } }),
                    lastCallAt: now,
                    avgCallDuration: {
                        increment: durationMinutes / 10,
                    },
                },
                create: {
                    userId,
                    month,
                    year,
                    totalCalls: 1,
                    totalMinutes: durationMinutes,
                    videoCalls: callType === 'video' ? 1 : 0,
                    audioCalls: callType === 'audio' ? 1 : 0,
                    avgCallDuration: durationMinutes,
                    callsInitiated: 1,
                    lastCallAt: now,
                },
            });
        }
        catch (error) {
            this.logger.error('Error updating call usage:', error);
            throw error;
        }
    }
    async canScheduleCalls(userId) {
        try {
            const subscription = await this.getUserSubscription(userId);
            const features = this.getSubscriptionFeatures(subscription.subscriptionTier);
            return features.hasCallScheduling;
        }
        catch (error) {
            this.logger.error('Error checking call scheduling access:', error);
            return false;
        }
    }
    async getMaxVideoQuality(userId) {
        try {
            const subscription = await this.getUserSubscription(userId);
            const features = this.getSubscriptionFeatures(subscription.subscriptionTier);
            return features.maxVideoQuality;
        }
        catch (error) {
            this.logger.error('Error getting max video quality:', error);
            return 'sd';
        }
    }
    async trackFeatureUsage(userId, feature, metadata) {
        try {
            await this.prisma.featureUsage.create({
                data: {
                    userId,
                    feature,
                    metadata,
                },
            });
            this.logger.log('Feature usage tracked', {
                userId,
                feature,
                metadata,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            this.logger.error('Error tracking feature usage:', error);
        }
    }
    getTierLevel(tier) {
        const levels = {
            [client_1.SubscriptionTier.DISCOVER]: 1,
            [client_1.SubscriptionTier.CONNECT]: 2,
            [client_1.SubscriptionTier.COMMUNITY]: 3,
        };
        return levels[tier] || 1;
    }
    async hasTierAccess(userId, requiredTier) {
        try {
            const subscription = await this.getUserSubscription(userId);
            const currentLevel = this.getTierLevel(subscription.subscriptionTier);
            const requiredLevel = this.getTierLevel(requiredTier);
            return currentLevel >= requiredLevel;
        }
        catch (error) {
            this.logger.error('Error checking tier access:', error);
            return false;
        }
    }
    async getCallUsageStats(userId) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const stats = await this.prisma.callUsageStats.findUnique({
            where: {
                userId_month_year: {
                    userId,
                    month,
                    year,
                },
            },
        });
        return stats || {
            totalCalls: 0,
            totalMinutes: 0,
            videoCalls: 0,
            audioCalls: 0,
        };
    }
};
exports.SubscriptionService = SubscriptionService;
exports.SubscriptionService = SubscriptionService = SubscriptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionService);
//# sourceMappingURL=subscription.service.js.map