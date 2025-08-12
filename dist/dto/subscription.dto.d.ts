import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';
export declare class CreateSubscriptionDto {
    planId: string;
    paymentMethodId: string;
    customerId?: string;
}
export declare class UpdateSubscriptionDto {
    planId?: string;
    cancelAtPeriodEnd?: boolean;
}
export declare class CreateCheckoutSessionDto {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
}
export declare class CreatePortalSessionDto {
    returnUrl: string;
}
export declare class SubscriptionResponseDto {
    subscriptionId: string;
    clientSecret?: string | null;
    status: SubscriptionStatus;
    currentPeriodEnd: Date;
}
export declare class UserSubscriptionDto {
    id: string;
    userId: string;
    subscriptionTier: SubscriptionTier;
    stripeSubscriptionId?: string | null;
    stripeCustomerId?: string | null;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    planId?: string | null;
    trialEnd?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare class SubscriptionPlanDto {
    id: string;
    name: string;
    description: string;
    price: number;
    interval: 'month' | 'year';
    features: string[];
    stripePriceId: string;
    stripeProductId: string;
    tier: string;
}
export declare class ValidateFeatureAccessDto {
    feature: string;
}
export declare class FeatureAccessResponseDto {
    allowed: boolean;
    reason?: string;
    upgradeRequired?: boolean;
}
export declare class CallUsageStatsDto {
    totalCalls: number;
    totalMinutes: number;
    videoCalls: number;
    audioCalls: number;
}
export declare class SubscriptionFeaturesDto {
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
