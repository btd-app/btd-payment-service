/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/**
 * Subscription Service Unit Tests
 * Comprehensive test suite for subscription feature validation, tier management, and usage tracking
 *
 * Coverage Target: 80%+
 * Last Updated: 2025-10-25
 */

import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let _prismaService: PrismaService;

  // Mock PrismaService
  const mockPrismaService = {
    subscription: {
      findUnique: jest.fn(),
    },
    featureUsage: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    _prismaService = module.get<PrismaService>(PrismaService);

    // Suppress logger output during tests
    jest.spyOn((Logger as any).prototype, 'log').mockImplementation();
    jest.spyOn((Logger as any).prototype, 'error').mockImplementation();
    jest.spyOn((Logger as any).prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSubscriptionFeatures', () => {
    it('should return DISCOVER tier features with basic access', () => {
      const features = service.getSubscriptionFeatures(
        SubscriptionTier.DISCOVER,
      );

      expect(features).toEqual({
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
      });
    });

    it('should return CONNECT tier features with enhanced access', () => {
      const features = service.getSubscriptionFeatures(
        SubscriptionTier.CONNECT,
      );

      expect(features).toEqual({
        // Video Call Features - Audio only
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
      });
    });

    it('should return COMMUNITY tier features with full access', () => {
      const features = service.getSubscriptionFeatures(
        SubscriptionTier.COMMUNITY,
      );

      expect(features).toEqual({
        // Video Call Features - Full access
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

        // Messaging Features - Premium
        dailyUnmatchedMessages: -1,
        unlimitedUnmatchedMessages: true,
        voiceMessages: true,
        videoMessages: true,
        messageReactions: true,
        readReceipts: true,

        // Discovery Features - Premium
        dailyLikes: -1,
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
      });
    });

    it('should return DISCOVER features for invalid tier', () => {
      const features = service.getSubscriptionFeatures(
        'INVALID_TIER' as SubscriptionTier,
      );

      expect(features.dailyLikes).toBe(10);
      expect(features.canMakeVideoCalls).toBe(false);
      expect(features.forumAccess).toBe('read');
    });
  });

  describe('getUserSubscription', () => {
    const mockUserId = 'user-123';

    it('should return existing subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date('2025-01-01'),
        currentPeriodEnd: new Date('2025-02-01'),
        cancelAtPeriodEnd: false,
        stripeCustomerId: 'cus_123',
        stripeSubscriptionId: 'sub_123',
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.getUserSubscription(mockUserId);

      expect(result).toEqual(mockSubscription);
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });

    it('should return default DISCOVER subscription when user has no subscription', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getUserSubscription(mockUserId);

      expect(result.userId).toBe(mockUserId);
      expect(result.subscriptionTier).toBe(SubscriptionTier.DISCOVER);
      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.cancelAtPeriodEnd).toBe(false);
      expect(result.currentPeriodStart).toBeInstanceOf(Date);
      expect(result.currentPeriodEnd).toBeInstanceOf(Date);
    });

    it('should throw error when database query fails', async () => {
      const mockError = new Error('Database connection failed');
      mockPrismaService.subscription.findUnique.mockRejectedValue(mockError);

      await expect(service.getUserSubscription(mockUserId)).rejects.toThrow(
        mockError,
      );
      expect((Logger as any).prototype.error).toHaveBeenCalledWith(
        'Error getting user subscription:',
        mockError,
      );
    });
  });

  describe('validateVideoCallAccess', () => {
    const mockUserId = 'user-123';

    it('should allow video calls for COMMUNITY tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.COMMUNITY,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateVideoCallAccess(mockUserId, 'video');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.upgradeRequired).toBeUndefined();
    });

    it('should deny video calls for CONNECT tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateVideoCallAccess(mockUserId, 'video');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Video calls require Community subscription');
      expect(result.upgradeRequired).toBe(true);
    });

    it('should allow audio calls for CONNECT tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateVideoCallAccess(mockUserId, 'audio');

      expect(result.allowed).toBe(true);
    });

    it('should deny audio calls for DISCOVER tier', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const result = await service.validateVideoCallAccess(mockUserId, 'audio');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(
        'Audio calls require Connect subscription or higher',
      );
      expect(result.upgradeRequired).toBe(true);
    });

    it('should deny screen sharing for non-COMMUNITY tiers', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateVideoCallAccess(
        mockUserId,
        'screen_share',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(
        'Screen sharing requires Community subscription',
      );
      expect(result.upgradeRequired).toBe(true);
    });

    it('should allow screen sharing for COMMUNITY tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.COMMUNITY,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateVideoCallAccess(
        mockUserId,
        'screen_share',
      );

      expect(result.allowed).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database error');
      mockPrismaService.subscription.findUnique.mockRejectedValue(mockError);

      const result = await service.validateVideoCallAccess(mockUserId, 'video');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Unable to validate subscription access');
      expect((Logger as any).prototype.error).toHaveBeenCalledWith(
        'Error validating video call access:',
        mockError,
      );
    });
  });

  describe('validateCallDuration', () => {
    const mockUserId = 'user-123';

    it('should allow call within duration limit for CONNECT tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateCallDuration(mockUserId, 15);

      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(15); // 30 - 15
    });

    it('should deny call when duration limit reached', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateCallDuration(mockUserId, 35);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Call duration limit (30 minutes) reached');
      expect(result.timeRemaining).toBeUndefined();
    });

    it('should deny call when no call duration available (DISCOVER tier)', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const result = await service.validateCallDuration(mockUserId, 5);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Calls not available on your current plan');
    });

    it('should calculate correct time remaining for COMMUNITY tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.COMMUNITY,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateCallDuration(mockUserId, 60);

      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(60); // 120 - 60
    });

    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database error');
      mockPrismaService.subscription.findUnique.mockRejectedValue(mockError);

      const result = await service.validateCallDuration(mockUserId, 10);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Unable to validate call duration');
      expect((Logger as any).prototype.error).toHaveBeenCalledWith(
        'Error validating call duration:',
        mockError,
      );
    });
  });

  describe('validateFeatureAccess', () => {
    const mockUserId = 'user-123';

    it('should allow access to boolean features that are true', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.COMMUNITY,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateFeatureAccess(
        mockUserId,
        'hasScreenSharing',
      );

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny access to boolean features that are false', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateFeatureAccess(
        mockUserId,
        'canMakeVideoCalls',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(
        'Video calls requires a higher subscription tier',
      );
    });

    it('should provide feature-specific denial messages', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const result = await service.validateFeatureAccess(
        mockUserId,
        'aiCoaching',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(
        'AI coaching requires a higher subscription tier',
      );
    });

    it('should allow access to non-boolean features', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateFeatureAccess(
        mockUserId,
        'maxPhotos',
      );

      expect(result.allowed).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database error');
      mockPrismaService.subscription.findUnique.mockRejectedValue(mockError);

      const result = await service.validateFeatureAccess(
        mockUserId,
        'voiceMessages',
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Unable to validate feature access');
      expect((Logger as any).prototype.error).toHaveBeenCalledWith(
        'Error validating feature access:',
        mockError,
      );
    });
  });

  describe('canScheduleCalls', () => {
    const mockUserId = 'user-123';

    it('should return true for COMMUNITY tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.COMMUNITY,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.canScheduleCalls(mockUserId);

      expect(result).toBe(true);
    });

    it('should return false for DISCOVER tier', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const result = await service.canScheduleCalls(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false for CONNECT tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.canScheduleCalls(mockUserId);

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      const mockError = new Error('Database error');
      mockPrismaService.subscription.findUnique.mockRejectedValue(mockError);

      const result = await service.canScheduleCalls(mockUserId);

      expect(result).toBe(false);
      expect((Logger as any).prototype.error).toHaveBeenCalledWith(
        'Error checking call scheduling access:',
        mockError,
      );
    });
  });

  describe('getMaxVideoQuality', () => {
    const mockUserId = 'user-123';

    it('should return "sd" for DISCOVER tier', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getMaxVideoQuality(mockUserId);

      expect(result).toBe('sd');
    });

    it('should return "hd" for CONNECT tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.getMaxVideoQuality(mockUserId);

      expect(result).toBe('hd');
    });

    it('should return "fhd" for COMMUNITY tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.COMMUNITY,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.getMaxVideoQuality(mockUserId);

      expect(result).toBe('fhd');
    });

    it('should return "sd" on database error', async () => {
      const mockError = new Error('Database error');
      mockPrismaService.subscription.findUnique.mockRejectedValue(mockError);

      const result = await service.getMaxVideoQuality(mockUserId);

      expect(result).toBe('sd');
      expect((Logger as any).prototype.error).toHaveBeenCalledWith(
        'Error getting max video quality:',
        mockError,
      );
    });
  });

  describe('trackFeatureUsage', () => {
    const mockUserId = 'user-123';

    it('should track feature usage without metadata', async () => {
      mockPrismaService.featureUsage.create.mockResolvedValue({
        id: 'usage-123',
        userId: mockUserId,
        feature: 'video_call',
        metadata: null,
        createdAt: new Date(),
      });

      await service.trackFeatureUsage(mockUserId, 'video_call');

      expect(mockPrismaService.featureUsage.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          feature: 'video_call',
          metadata: undefined,
        },
      });
      expect((Logger as any).prototype.log).toHaveBeenCalled();
    });

    it('should track feature usage with metadata', async () => {
      const metadata = { duration: 30, quality: 'hd' };

      mockPrismaService.featureUsage.create.mockResolvedValue({
        id: 'usage-123',
        userId: mockUserId,
        feature: 'video_call',
        metadata,
        createdAt: new Date(),
      });

      await service.trackFeatureUsage(mockUserId, 'video_call', metadata);

      expect(mockPrismaService.featureUsage.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          feature: 'video_call',
          metadata: metadata,
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database error');
      mockPrismaService.featureUsage.create.mockRejectedValue(mockError);

      await expect(
        service.trackFeatureUsage(mockUserId, 'video_call'),
      ).resolves.not.toThrow();

      expect((Logger as any).prototype.error).toHaveBeenCalledWith(
        'Error tracking feature usage:',
        mockError,
      );
    });
  });

  describe('getTierLevel', () => {
    it('should return 1 for DISCOVER tier', () => {
      const level = service.getTierLevel(SubscriptionTier.DISCOVER);
      expect(level).toBe(1);
    });

    it('should return 2 for CONNECT tier', () => {
      const level = service.getTierLevel(SubscriptionTier.CONNECT);
      expect(level).toBe(2);
    });

    it('should return 3 for COMMUNITY tier', () => {
      const level = service.getTierLevel(SubscriptionTier.COMMUNITY);
      expect(level).toBe(3);
    });

    it('should return 1 for invalid tier', () => {
      const level = service.getTierLevel('INVALID' as SubscriptionTier);
      expect(level).toBe(1);
    });
  });

  describe('hasTierAccess', () => {
    const mockUserId = 'user-123';

    it('should return true when current tier equals required tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.hasTierAccess(
        mockUserId,
        SubscriptionTier.CONNECT,
      );

      expect(result).toBe(true);
    });

    it('should return true when current tier is higher than required tier', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.COMMUNITY,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.hasTierAccess(
        mockUserId,
        SubscriptionTier.CONNECT,
      );

      expect(result).toBe(true);
    });

    it('should return false when current tier is lower than required tier', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const result = await service.hasTierAccess(
        mockUserId,
        SubscriptionTier.COMMUNITY,
      );

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      const mockError = new Error('Database error');
      mockPrismaService.subscription.findUnique.mockRejectedValue(mockError);

      const result = await service.hasTierAccess(
        mockUserId,
        SubscriptionTier.CONNECT,
      );

      expect(result).toBe(false);
      expect((Logger as any).prototype.error).toHaveBeenCalledWith(
        'Error checking tier access:',
        mockError,
      );
    });
  });

  describe('stub methods', () => {
    describe('getMonthlyCallUsage', () => {
      it('should return mock data with zero values', () => {
        const result = service.getMonthlyCallUsage('user-123');

        expect(result).toEqual({
          totalCalls: 0,
          totalMinutes: 0,
          videoCalls: 0,
          audioCalls: 0,
        });
      });

      it('should handle any arguments without errors', () => {
        const result = service.getMonthlyCallUsage(
          'user-123',
          'extra-arg',
          123,
        );

        expect(result).toBeDefined();
        expect(result.totalCalls).toBe(0);
      });

      it('should not throw errors', () => {
        expect(() => service.getMonthlyCallUsage()).not.toThrow();
      });
    });

    describe('updateCallUsage', () => {
      it('should not throw errors with any arguments', () => {
        expect(() =>
          service.updateCallUsage('user-123', 30, 'video'),
        ).not.toThrow();
      });

      it('should log debug message', () => {
        service.updateCallUsage('user-123');

        expect((Logger as any).prototype.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            'Call usage tracking should be in video-call service',
          ),
        );
      });

      it('should return undefined', () => {
        const result = service.updateCallUsage('user-123');
        expect(result).toBeUndefined();
      });
    });

    describe('getCallUsageStats', () => {
      it('should return mock data with zero values', () => {
        const result = service.getCallUsageStats('user-123');

        expect(result).toEqual({
          totalCalls: 0,
          totalMinutes: 0,
          videoCalls: 0,
          audioCalls: 0,
        });
      });

      it('should handle any arguments without errors', () => {
        const result = service.getCallUsageStats('user-123', {
          period: 'monthly',
        });

        expect(result).toBeDefined();
        expect(result.totalMinutes).toBe(0);
      });

      it('should not throw errors', () => {
        expect(() => service.getCallUsageStats()).not.toThrow();
      });
    });
  });

  describe('edge cases and error handling', () => {
    const mockUserId = 'user-123';

    it('should handle null subscription gracefully across all methods', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const features = await service.getUserSubscription(mockUserId);
      const videoAccess = await service.validateVideoCallAccess(
        mockUserId,
        'video',
      );
      const duration = await service.validateCallDuration(mockUserId, 5);
      const quality = await service.getMaxVideoQuality(mockUserId);

      expect(features.subscriptionTier).toBe(SubscriptionTier.DISCOVER);
      expect(videoAccess.allowed).toBe(false);
      expect(duration.allowed).toBe(false);
      expect(quality).toBe('sd');
    });

    it('should handle concurrent feature usage tracking', async () => {
      mockPrismaService.featureUsage.create.mockResolvedValue({
        id: 'usage-123',
        userId: mockUserId,
        feature: 'test',
        metadata: null,
        createdAt: new Date(),
      });

      const promises = [
        service.trackFeatureUsage(mockUserId, 'feature1'),
        service.trackFeatureUsage(mockUserId, 'feature2'),
        service.trackFeatureUsage(mockUserId, 'feature3'),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
      expect(mockPrismaService.featureUsage.create).toHaveBeenCalledTimes(3);
    });

    it('should validate different call types correctly', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.COMMUNITY,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const videoResult = await service.validateVideoCallAccess(
        mockUserId,
        'video',
      );
      const audioResult = await service.validateVideoCallAccess(
        mockUserId,
        'audio',
      );
      const screenResult = await service.validateVideoCallAccess(
        mockUserId,
        'screen_share',
      );

      expect(videoResult.allowed).toBe(true);
      expect(audioResult.allowed).toBe(true);
      expect(screenResult.allowed).toBe(true);
    });

    it('should handle exact duration limit boundary', async () => {
      const mockSubscription = {
        userId: mockUserId,
        subscriptionTier: SubscriptionTier.CONNECT,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
      };

      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.validateCallDuration(mockUserId, 30);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Call duration limit (30 minutes) reached');
    });
  });

  describe('tier feature comparison', () => {
    it('should have increasing privileges across tiers', () => {
      const discover = service.getSubscriptionFeatures(
        SubscriptionTier.DISCOVER,
      );
      const connect = service.getSubscriptionFeatures(SubscriptionTier.CONNECT);
      const community = service.getSubscriptionFeatures(
        SubscriptionTier.COMMUNITY,
      );

      // Verify progression of limits
      expect(discover.dailyLikes).toBeLessThan(connect.dailyLikes);
      expect(connect.dailyLikes).toBe(50);
      expect(community.dailyLikes).toBe(-1); // Unlimited
      expect(community.unlimitedLikes).toBe(true);

      expect(discover.maxPhotos).toBeLessThan(connect.maxPhotos);
      expect(connect.maxPhotos).toBeLessThan(community.maxPhotos);

      expect(discover.maxCallDuration).toBeLessThan(connect.maxCallDuration);
      expect(connect.maxCallDuration).toBeLessThan(community.maxCallDuration);

      // Verify boolean feature progression
      expect(discover.canMakeAudioCalls).toBe(false);
      expect(connect.canMakeAudioCalls).toBe(true);
      expect(community.canMakeAudioCalls).toBe(true);

      expect(discover.canMakeVideoCalls).toBe(false);
      expect(connect.canMakeVideoCalls).toBe(false);
      expect(community.canMakeVideoCalls).toBe(true);
    });

    it('should have correct forum access levels per tier', () => {
      const discover = service.getSubscriptionFeatures(
        SubscriptionTier.DISCOVER,
      );
      const connect = service.getSubscriptionFeatures(SubscriptionTier.CONNECT);
      const community = service.getSubscriptionFeatures(
        SubscriptionTier.COMMUNITY,
      );

      expect(discover.forumAccess).toBe('read');
      expect(connect.forumAccess).toBe('write');
      expect(community.forumAccess).toBe('vip');
    });

    it('should have correct priority levels per tier', () => {
      const discover = service.getSubscriptionFeatures(
        SubscriptionTier.DISCOVER,
      );
      const connect = service.getSubscriptionFeatures(SubscriptionTier.CONNECT);
      const community = service.getSubscriptionFeatures(
        SubscriptionTier.COMMUNITY,
      );

      expect(discover.searchPriority).toBe('normal');
      expect(connect.searchPriority).toBe('high');
      expect(community.searchPriority).toBe('ultra');

      expect(discover.supportPriority).toBe('normal');
      expect(connect.supportPriority).toBe('priority');
      expect(community.supportPriority).toBe('vip');
    });
  });
});
