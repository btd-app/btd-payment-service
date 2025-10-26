/**
 * Subscription DTOs
 * Data Transfer Objects for subscription-related operations
 *
 * Last Updated On: 2025-08-06
 */

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Subscription plan ID' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ description: 'Payment method ID from Stripe' })
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;

  @ApiPropertyOptional({ description: 'Stripe customer ID' })
  @IsString()
  @IsOptional()
  customerId?: string;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ description: 'New plan ID to upgrade/downgrade to' })
  @IsString()
  @IsOptional()
  planId?: string;

  @ApiPropertyOptional({ description: 'Cancel subscription at end of period' })
  @IsBoolean()
  @IsOptional()
  cancelAtPeriodEnd?: boolean;
}

export class CreateCheckoutSessionDto {
  @ApiProperty({ description: 'Stripe price ID' })
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiProperty({ description: 'Success redirect URL' })
  @IsUrl()
  @IsNotEmpty()
  successUrl: string;

  @ApiProperty({ description: 'Cancel redirect URL' })
  @IsUrl()
  @IsNotEmpty()
  cancelUrl: string;
}

export class CreatePortalSessionDto {
  @ApiProperty({ description: 'Return URL after portal session' })
  @IsUrl()
  @IsNotEmpty()
  returnUrl: string;
}

export class SubscriptionResponseDto {
  @ApiProperty()
  subscriptionId: string;

  @ApiPropertyOptional()
  clientSecret?: string | null;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiProperty()
  currentPeriodEnd: Date;
}

export class UserSubscriptionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: SubscriptionTier })
  subscriptionTier: SubscriptionTier;

  @ApiPropertyOptional()
  stripeSubscriptionId?: string | null;

  @ApiPropertyOptional()
  stripeCustomerId?: string | null;

  @ApiProperty({ enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @ApiProperty()
  currentPeriodStart: Date;

  @ApiProperty()
  currentPeriodEnd: Date;

  @ApiProperty()
  cancelAtPeriodEnd: boolean;

  @ApiPropertyOptional()
  planId?: string | null;

  @ApiPropertyOptional()
  trialEnd?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SubscriptionPlanDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  price: number;

  @ApiProperty()
  interval: 'month' | 'year';

  @ApiProperty({ type: [String] })
  features: string[];

  @ApiProperty()
  stripePriceId: string;

  @ApiProperty()
  stripeProductId: string;

  @ApiProperty({ enum: ['DISCOVER', 'CONNECT', 'COMMUNITY'] })
  tier: string;
}

export class ValidateFeatureAccessDto {
  @ApiProperty({ description: 'Feature name to validate access for' })
  @IsString()
  @IsNotEmpty()
  feature: string;
}

export class FeatureAccessResponseDto {
  @ApiProperty()
  allowed: boolean;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  upgradeRequired?: boolean;
}

export class CallUsageStatsDto {
  @ApiProperty()
  totalCalls: number;

  @ApiProperty()
  totalMinutes: number;

  @ApiProperty()
  videoCalls: number;

  @ApiProperty()
  audioCalls: number;
}

export class SubscriptionFeaturesDto {
  @ApiProperty()
  canMakeVideoCalls: boolean;

  @ApiProperty()
  canMakeAudioCalls: boolean;

  @ApiProperty()
  maxCallDuration: number;

  @ApiProperty()
  maxVideoQuality: 'sd' | 'hd' | 'fhd';

  @ApiProperty()
  hasVirtualBackgrounds: boolean;

  @ApiProperty()
  hasBeautyFilters: boolean;

  @ApiProperty()
  hasAREffects: boolean;

  @ApiProperty()
  hasCallRecording: boolean;

  @ApiProperty()
  hasScreenSharing: boolean;

  @ApiProperty()
  hasGroupCalls: boolean;

  @ApiProperty()
  maxGroupParticipants: number;

  @ApiProperty()
  hasCallScheduling: boolean;

  @ApiProperty()
  dailyUnmatchedMessages: number;

  @ApiProperty()
  unlimitedUnmatchedMessages: boolean;

  @ApiProperty()
  voiceMessages: boolean;

  @ApiProperty()
  videoMessages: boolean;

  @ApiProperty()
  messageReactions: boolean;

  @ApiProperty()
  readReceipts: boolean;

  @ApiProperty()
  dailyLikes: number;

  @ApiProperty()
  unlimitedLikes: boolean;

  @ApiProperty()
  seeWhoLikedYou: boolean;

  @ApiProperty()
  advancedFilters: boolean;

  @ApiProperty()
  travelMode: boolean;

  @ApiProperty()
  incognitoMode: boolean;

  @ApiProperty()
  maxPhotos: number;

  @ApiProperty()
  videoIntro: boolean;

  @ApiProperty()
  profileBoostCount: number;

  @ApiProperty()
  profileAnalytics: boolean;

  @ApiProperty()
  groupAudioRooms: boolean;

  @ApiProperty()
  forumAccess: 'none' | 'read' | 'write' | 'vip';

  @ApiProperty()
  virtualEvents: boolean;

  @ApiProperty()
  aiCoaching: boolean;

  @ApiProperty()
  communityMatchmaking: boolean;

  @ApiProperty()
  searchPriority: 'normal' | 'high' | 'ultra';

  @ApiProperty()
  messagePriority: 'normal' | 'high' | 'vip';

  @ApiProperty()
  supportPriority: 'normal' | 'priority' | 'vip';
}
