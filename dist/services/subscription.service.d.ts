import '../types/external';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier } from '@prisma/client';
export interface SubscriptionFeatures {
    canMakeVideoCalls: boolean;
    canMakeAudioCalls: boolean;
    maxCallDuration: number;
    maxVideoQuality: 'sd' | 'hd' | 'fhd';
    hasVirtualBackgrounds: boolean;
    hasBeautyFilters: boolean;
    hasAREffects: boolean;
    hasCallRecording: boolean;
    hasScreenSharing: boolean;
    hasGroupCalls: boolean;
    maxGroupParticipants: number;
    hasCallScheduling: boolean;
    dailyUnmatchedMessages: number;
    unlimitedUnmatchedMessages: boolean;
    voiceMessages: boolean;
    videoMessages: boolean;
    messageReactions: boolean;
    readReceipts: boolean;
    dailyLikes: number;
    unlimitedLikes: boolean;
    seeWhoLikedYou: boolean;
    advancedFilters: boolean;
    travelMode: boolean;
    incognitoMode: boolean;
    maxPhotos: number;
    videoIntro: boolean;
    profileBoostCount: number;
    profileAnalytics: boolean;
    groupAudioRooms: boolean;
    forumAccess: 'none' | 'read' | 'write' | 'vip';
    virtualEvents: boolean;
    aiCoaching: boolean;
    communityMatchmaking: boolean;
    searchPriority: 'normal' | 'high' | 'ultra';
    messagePriority: 'normal' | 'high' | 'vip';
    supportPriority: 'normal' | 'priority' | 'vip';
}
export declare class SubscriptionService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    getUserSubscription(userId: string): Promise<{
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        id: string;
        createdAt: Date;
        userId: string;
        subscriptionTier: import(".prisma/client").$Enums.SubscriptionTier;
        stripeCustomerId: string | null;
        stripeSubscriptionId: string | null;
        planId: string | null;
        appleProductId: string | null;
        appleTransactionId: string | null;
        appleOriginalTransactionId: string | null;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelledAt: Date | null;
        lastRenewedAt: Date | null;
        trialEnd: Date | null;
        autoRenew: boolean;
        cancelAtPeriodEnd: boolean;
        isTrial: boolean;
        isIntroOffer: boolean;
        updatedAt: Date;
    } | {
        userId: string;
        subscriptionTier: "DISCOVER";
        status: "ACTIVE";
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: false;
    }>;
    getSubscriptionFeatures(tier: SubscriptionTier): SubscriptionFeatures;
    validateVideoCallAccess(userId: string, callType: 'audio' | 'video' | 'screen_share'): Promise<{
        allowed: boolean;
        reason?: string;
        upgradeRequired?: boolean;
    }>;
    validateCallDuration(userId: string, currentDurationMinutes: number): Promise<{
        allowed: boolean;
        reason?: string;
        timeRemaining?: number;
    }>;
    validateFeatureAccess(userId: string, feature: keyof SubscriptionFeatures): Promise<{
        allowed: boolean;
        reason?: string;
    }>;
    getMonthlyCallUsage(..._args: unknown[]): {
        totalCalls: number;
        totalMinutes: number;
        videoCalls: number;
        audioCalls: number;
    };
    updateCallUsage(..._args: unknown[]): void;
    canScheduleCalls(userId: string): Promise<boolean>;
    getMaxVideoQuality(userId: string): Promise<'sd' | 'hd' | 'fhd'>;
    trackFeatureUsage(userId: string, feature: string, metadata?: Record<string, unknown>): Promise<void>;
    getTierLevel(tier: SubscriptionTier): number;
    hasTierAccess(userId: string, requiredTier: SubscriptionTier): Promise<boolean>;
    getCallUsageStats(..._args: unknown[]): {
        totalCalls: number;
        totalMinutes: number;
        videoCalls: number;
        audioCalls: number;
    };
}
