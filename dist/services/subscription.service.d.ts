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
        id: string;
        userId: string;
        stripeSubscriptionId: string | null;
        subscriptionTier: import(".prisma/client").$Enums.SubscriptionTier;
        stripeCustomerId: string | null;
        status: import(".prisma/client").$Enums.SubscriptionStatus;
        currentPeriodStart: Date;
        currentPeriodEnd: Date;
        cancelAtPeriodEnd: boolean;
        cancelledAt: Date | null;
        planId: string | null;
        trialEnd: Date | null;
        metadata: import("@prisma/client/runtime/library").JsonValue | null;
        createdAt: Date;
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
    getMonthlyCallUsage(userId: string): Promise<{
        totalCalls: number;
        totalMinutes: number;
        videoCalls: number;
        audioCalls: number;
    }>;
    updateCallUsage(userId: string, callType: 'audio' | 'video', durationMinutes: number): Promise<void>;
    canScheduleCalls(userId: string): Promise<boolean>;
    getMaxVideoQuality(userId: string): Promise<'sd' | 'hd' | 'fhd'>;
    trackFeatureUsage(userId: string, feature: string, metadata?: any): Promise<void>;
    getTierLevel(tier: SubscriptionTier): number;
    hasTierAccess(userId: string, requiredTier: SubscriptionTier): Promise<boolean>;
    getCallUsageStats(userId: string): Promise<{
        month: number;
        year: number;
        id: string;
        userId: string;
        createdAt: Date;
        updatedAt: Date;
        totalCalls: number;
        totalMinutes: number;
        videoCalls: number;
        audioCalls: number;
        avgCallDuration: number;
        callsInitiated: number;
        callsReceived: number;
        lastCallAt: Date | null;
    } | {
        totalCalls: number;
        totalMinutes: number;
        videoCalls: number;
        audioCalls: number;
    }>;
}
