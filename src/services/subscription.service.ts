/**
 * Subscription Service
 * Handles subscription feature validation, tier management, and usage tracking
 *
 * Last Updated On: 2025-08-06
 */

import { Injectable, Logger } from '@nestjs/common';
import '../types/external';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';

export interface SubscriptionFeatures {
  // Video Call Features
  canMakeVideoCalls: boolean;
  canMakeAudioCalls: boolean;
  maxCallDuration: number; // in minutes
  maxVideoQuality: 'sd' | 'hd' | 'fhd';
  hasVirtualBackgrounds: boolean;
  hasBeautyFilters: boolean;
  hasAREffects: boolean;
  hasCallRecording: boolean;
  hasScreenSharing: boolean;
  hasGroupCalls: boolean;
  maxGroupParticipants: number;
  hasCallScheduling: boolean;

  // Messaging Features
  dailyUnmatchedMessages: number;
  unlimitedUnmatchedMessages: boolean;
  voiceMessages: boolean;
  videoMessages: boolean;
  messageReactions: boolean;
  readReceipts: boolean;

  // Discovery Features
  dailyLikes: number;
  unlimitedLikes: boolean;
  seeWhoLikedYou: boolean;
  advancedFilters: boolean;
  travelMode: boolean;
  incognitoMode: boolean;

  // Profile Features
  maxPhotos: number;
  videoIntro: boolean;
  profileBoostCount: number;
  profileAnalytics: boolean;

  // Communication Features
  groupAudioRooms: boolean;

  // Community Features
  forumAccess: 'none' | 'read' | 'write' | 'vip';
  virtualEvents: boolean;
  aiCoaching: boolean;
  communityMatchmaking: boolean;

  // Priority Features
  searchPriority: 'normal' | 'high' | 'ultra';
  messagePriority: 'normal' | 'high' | 'vip';
  supportPriority: 'normal' | 'priority' | 'vip';
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string) {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      // Return subscription or default to DISCOVER tier (free tier)
      return (
        subscription || {
          userId,
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
        }
      );
    } catch (error) {
      this.logger.error('Error getting user subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription features for a given tier
   */
  getSubscriptionFeatures(tier: SubscriptionTier): SubscriptionFeatures {
    switch (tier) {
      case SubscriptionTier.DISCOVER:
        return {
          // Video Call Features - No access
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

          // Messaging Features - Basic
          dailyUnmatchedMessages: 5,
          unlimitedUnmatchedMessages: false,
          voiceMessages: false,
          videoMessages: false,
          messageReactions: false,
          readReceipts: false,

          // Discovery Features - Basic
          dailyLikes: 10,
          unlimitedLikes: false,
          seeWhoLikedYou: false,
          advancedFilters: false,
          travelMode: false,
          incognitoMode: false,

          // Profile Features - Basic
          maxPhotos: 3,
          videoIntro: false,
          profileBoostCount: 0,
          profileAnalytics: false,

          // Communication Features
          groupAudioRooms: false,

          // Community Features
          forumAccess: 'read',
          virtualEvents: false,
          aiCoaching: false,
          communityMatchmaking: false,

          // Priority Features
          searchPriority: 'normal',
          messagePriority: 'normal',
          supportPriority: 'normal',
        };

      case SubscriptionTier.CONNECT:
        return {
          // Video Call Features - Audio only
          canMakeVideoCalls: false,
          canMakeAudioCalls: true,
          maxCallDuration: 30, // 30 minutes
          maxVideoQuality: 'hd',
          hasVirtualBackgrounds: false,
          hasBeautyFilters: false,
          hasAREffects: false,
          hasCallRecording: false,
          hasScreenSharing: false,
          hasGroupCalls: false,
          maxGroupParticipants: 0,
          hasCallScheduling: false,

          // Messaging Features - Enhanced
          dailyUnmatchedMessages: 25,
          unlimitedUnmatchedMessages: false,
          voiceMessages: true,
          videoMessages: false,
          messageReactions: true,
          readReceipts: true,

          // Discovery Features - Enhanced
          dailyLikes: 50,
          unlimitedLikes: false,
          seeWhoLikedYou: true,
          advancedFilters: true,
          travelMode: true,
          incognitoMode: false,

          // Profile Features - Enhanced
          maxPhotos: 6,
          videoIntro: false,
          profileBoostCount: 3,
          profileAnalytics: true,

          // Communication Features
          groupAudioRooms: true,

          // Community Features
          forumAccess: 'write',
          virtualEvents: true,
          aiCoaching: false,
          communityMatchmaking: true,

          // Priority Features
          searchPriority: 'high',
          messagePriority: 'high',
          supportPriority: 'priority',
        };

      case SubscriptionTier.COMMUNITY:
        return {
          // Video Call Features - Full access
          canMakeVideoCalls: true,
          canMakeAudioCalls: true,
          maxCallDuration: 120, // 120 minutes
          maxVideoQuality: 'fhd',
          hasVirtualBackgrounds: true,
          hasBeautyFilters: true,
          hasAREffects: true,
          hasCallRecording: true,
          hasScreenSharing: true,
          hasGroupCalls: true,
          maxGroupParticipants: 8,
          hasCallScheduling: true,

          // Messaging Features - Premium
          dailyUnmatchedMessages: -1, // Unlimited
          unlimitedUnmatchedMessages: true,
          voiceMessages: true,
          videoMessages: true,
          messageReactions: true,
          readReceipts: true,

          // Discovery Features - Premium
          dailyLikes: -1, // Unlimited
          unlimitedLikes: true,
          seeWhoLikedYou: true,
          advancedFilters: true,
          travelMode: true,
          incognitoMode: true,

          // Profile Features - Premium
          maxPhotos: 10,
          videoIntro: true,
          profileBoostCount: 10,
          profileAnalytics: true,

          // Communication Features
          groupAudioRooms: true,

          // Community Features
          forumAccess: 'vip',
          virtualEvents: true,
          aiCoaching: true,
          communityMatchmaking: true,

          // Priority Features
          searchPriority: 'ultra',
          messagePriority: 'vip',
          supportPriority: 'vip',
        };

      default:
        return this.getSubscriptionFeatures(SubscriptionTier.DISCOVER);
    }
  }

  /**
   * Validate video call access for user
   */
  async validateVideoCallAccess(
    userId: string,
    callType: 'audio' | 'video' | 'screen_share',
  ): Promise<{
    allowed: boolean;
    reason?: string;
    upgradeRequired?: boolean;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const features = this.getSubscriptionFeatures(
        subscription.subscriptionTier,
      );

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
    } catch (error) {
      this.logger.error('Error validating video call access:', error);
      return {
        allowed: false,
        reason: 'Unable to validate subscription access',
      };
    }
  }

  /**
   * Validate call duration against subscription limits
   */
  async validateCallDuration(
    userId: string,
    currentDurationMinutes: number,
  ): Promise<{
    allowed: boolean;
    reason?: string;
    timeRemaining?: number;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const features = this.getSubscriptionFeatures(
        subscription.subscriptionTier,
      );

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
    } catch (error) {
      this.logger.error('Error validating call duration:', error);
      return {
        allowed: false,
        reason: 'Unable to validate call duration',
      };
    }
  }

  /**
   * Validate feature access
   */
  async validateFeatureAccess(
    userId: string,
    feature: keyof SubscriptionFeatures,
  ): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const features = this.getSubscriptionFeatures(
        subscription.subscriptionTier,
      );
      const hasAccess = features[feature];

      if (typeof hasAccess === 'boolean' && !hasAccess) {
        const featureNames: Record<string, string> = {
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
    } catch (error) {
      this.logger.error('Error validating feature access:', error);
      return {
        allowed: false,
        reason: 'Unable to validate feature access',
      };
    }
  }

  /**
   * Get user's call usage stats for current month
   * NOTE: This functionality belongs in video-call service
   * This is a stub method that returns mock data
   * @returns Call usage statistics (mock data)
   */
  getMonthlyCallUsage(..._args: unknown[]) {
    try {
      // This functionality should be in video-call service
      // Returning mock data to fix build errors
      return {
        totalCalls: 0,
        totalMinutes: 0,
        videoCalls: 0,
        audioCalls: 0,
      };
    } catch (error) {
      this.logger.error('Error getting monthly call usage:', error);
      return {
        totalCalls: 0,
        totalMinutes: 0,
        videoCalls: 0,
        audioCalls: 0,
      };
    }
  }

  /**
   * Update call usage stats
   * NOTE: This functionality belongs in video-call service
   * This is a stub method that does nothing
   */
  updateCallUsage(..._args: unknown[]): void {
    // This functionality should be in video-call service
    // No-op to fix build errors
    this.logger.debug(`Call usage tracking should be in video-call service`);
  }

  /**
   * Check if user can schedule calls
   */
  async canScheduleCalls(userId: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const features = this.getSubscriptionFeatures(
        subscription.subscriptionTier,
      );
      return features.hasCallScheduling;
    } catch (error) {
      this.logger.error('Error checking call scheduling access:', error);
      return false;
    }
  }

  /**
   * Get maximum video quality for user's subscription
   */
  async getMaxVideoQuality(userId: string): Promise<'sd' | 'hd' | 'fhd'> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const features = this.getSubscriptionFeatures(
        subscription.subscriptionTier,
      );
      return features.maxVideoQuality;
    } catch (error) {
      this.logger.error('Error getting max video quality:', error);
      return 'sd';
    }
  }

  /**
   * Track feature usage for analytics
   * @param userId - User ID
   * @param feature - Feature name being tracked
   * @param metadata - Optional metadata for the feature usage
   */
  async trackFeatureUsage(
    userId: string,
    feature: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.featureUsage.create({
        data: {
          userId,
          feature,
          metadata: metadata as never,
        },
      });

      const logData: Record<string, unknown> = {
        userId,
        feature,
        metadata,
        timestamp: new Date().toISOString(),
      };
      this.logger.log('Feature usage tracked', logData);
    } catch (error) {
      this.logger.error('Error tracking feature usage:', error);
    }
  }

  /**
   * Get subscription tier hierarchy level (for comparison)
   */
  getTierLevel(tier: SubscriptionTier): number {
    const levels = {
      [SubscriptionTier.DISCOVER]: 1,
      [SubscriptionTier.CONNECT]: 2,
      [SubscriptionTier.COMMUNITY]: 3,
    };
    return levels[tier] || 1;
  }

  /**
   * Check if user has tier access (current tier >= required tier)
   */
  async hasTierAccess(
    userId: string,
    requiredTier: SubscriptionTier,
  ): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const currentLevel = this.getTierLevel(subscription.subscriptionTier);
      const requiredLevel = this.getTierLevel(requiredTier);
      return currentLevel >= requiredLevel;
    } catch (error) {
      this.logger.error('Error checking tier access:', error);
      return false;
    }
  }

  /**
   * Get call usage statistics for a user
   * NOTE: This functionality belongs in video-call service
   * This is a stub method that returns mock data
   * @returns Call usage statistics (mock data)
   */
  getCallUsageStats(..._args: unknown[]) {
    // This functionality should be in video-call service
    // Returning mock data to fix build errors
    return {
      totalCalls: 0,
      totalMinutes: 0,
      videoCalls: 0,
      audioCalls: 0,
    };
  }
}
