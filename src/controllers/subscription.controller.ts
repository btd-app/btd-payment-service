/**
 * Subscription Controller
 * Handles subscription management API endpoints
 * 
 * Last Updated On: 2025-08-06
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { StripeService } from '../services/stripe.service';
import { SubscriptionService, SubscriptionFeatures } from '../services/subscription.service';
import {
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  SubscriptionResponseDto,
  UserSubscriptionDto,
  ValidateFeatureAccessDto,
  FeatureAccessResponseDto,
  CallUsageStatsDto,
  SubscriptionFeaturesDto,
  CreateCheckoutSessionDto,
  CreatePortalSessionDto,
} from '../dto/subscription.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags('Subscriptions')
@Controller('api/v1/subscriptions')
// @UseGuards(AuthGuard) // TODO: Add auth guard
@ApiBearerAuth()
export class SubscriptionController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * Get current user's subscription
   */
  @Get('current')
  @ApiOperation({ summary: 'Get current user subscription' })
  @ApiResponse({
    status: 200,
    description: 'Returns current subscription',
    type: UserSubscriptionDto,
  })
  @ApiResponse({ status: 404, description: 'No active subscription found' })
  async getCurrentSubscription(@Req() req: AuthenticatedRequest): Promise<UserSubscriptionDto> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    return this.stripeService.getCurrentSubscription(userId);
  }

  /**
   * Create new subscription
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new subscription' })
  @ApiResponse({
    status: 201,
    description: 'Subscription created successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 409, description: 'Active subscription already exists' })
  async createSubscription(
    @Body() dto: CreateSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SubscriptionResponseDto> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    const userEmail = req.user?.email || 'test@example.com';
    
    // Ensure customer exists
    const customerId = await this.stripeService.createOrGetCustomer(userId, userEmail);
    
    return this.stripeService.createSubscription(
      userId,
      dto.planId,
      dto.paymentMethodId,
    );
  }

  /**
   * Update existing subscription
   */
  @Put(':subscriptionId')
  @ApiOperation({ summary: 'Update subscription (upgrade/downgrade/cancel)' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID to update' })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async updateSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SubscriptionResponseDto> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    
    if (dto.cancelAtPeriodEnd !== undefined) {
      if (dto.cancelAtPeriodEnd) {
        await this.stripeService.cancelSubscription(userId, dto.cancelAtPeriodEnd);
        // Return a response after cancelling
        const subscription = await this.stripeService.getCurrentSubscription(userId);
        return {
          subscriptionId: subscription.stripeSubscriptionId || '',
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        };
      } else {
        return this.stripeService.reactivateSubscription(userId, subscriptionId);
      }
    }
    
    if (dto.planId) {
      await this.stripeService.updateSubscription(userId, dto.planId, dto.cancelAtPeriodEnd);
      // Return updated subscription
      const subscription = await this.stripeService.getCurrentSubscription(userId);
      return {
        subscriptionId: subscription.stripeSubscriptionId || '',
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
      };
    }
    
    throw new Error('No valid update parameters provided');
  }

  /**
   * Cancel subscription immediately
   */
  @Delete(':subscriptionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel subscription immediately' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID to cancel' })
  @ApiResponse({
    status: 204,
    description: 'Subscription cancelled successfully',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async cancelSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    await this.stripeService.cancelSubscriptionImmediately(userId, subscriptionId);
  }

  /**
   * Create Stripe Checkout session
   */
  @Post('checkout-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe Checkout session for subscription' })
  @ApiResponse({
    status: 200,
    description: 'Checkout session created successfully',
    schema: {
      properties: {
        sessionId: { type: 'string' },
        url: { type: 'string' },
      },
    },
  })
  async createCheckoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ sessionId: string; url: string }> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    const userEmail = req.user?.email || 'test@example.com';
    
    return this.stripeService.createCheckoutSession(
      userId,
      userEmail,
      dto.priceId,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  /**
   * Create Stripe Portal session for subscription management
   */
  @Post('portal-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe Portal session for self-service subscription management' })
  @ApiResponse({
    status: 200,
    description: 'Portal session created successfully',
    schema: {
      properties: {
        url: { type: 'string' },
      },
    },
  })
  async createPortalSession(
    @Body() dto: CreatePortalSessionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ url: string }> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    return this.stripeService.createPortalSession(userId, dto.returnUrl);
  }

  /**
   * Get subscription features for user
   */
  @Get('features')
  @ApiOperation({ summary: 'Get subscription features for current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns subscription features',
    type: SubscriptionFeaturesDto,
  })
  async getSubscriptionFeatures(@Req() req: AuthenticatedRequest): Promise<SubscriptionFeaturesDto> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    const subscription = await this.stripeService.getCurrentSubscription(userId);
    return this.subscriptionService.getSubscriptionFeatures(subscription.subscriptionTier);
  }

  /**
   * Validate feature access
   */
  @Post('validate-feature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate if user has access to a specific feature' })
  @ApiResponse({
    status: 200,
    description: 'Feature access validation result',
    type: FeatureAccessResponseDto,
  })
  async validateFeatureAccess(
    @Body() dto: ValidateFeatureAccessDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<FeatureAccessResponseDto> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    return this.subscriptionService.validateFeatureAccess(userId, dto.feature as keyof SubscriptionFeatures);
  }

  /**
   * Get call usage statistics
   */
  @Get('call-usage')
  @ApiOperation({ summary: 'Get call usage statistics for current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns call usage statistics',
    type: CallUsageStatsDto,
  })
  async getCallUsageStats(@Req() req: AuthenticatedRequest): Promise<CallUsageStatsDto> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    return this.subscriptionService.getCallUsageStats(userId);
  }

  /**
   * Track feature usage
   */
  @Post('track-usage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Track feature usage for analytics' })
  @ApiResponse({
    status: 200,
    description: 'Usage tracked successfully',
  })
  async trackFeatureUsage(
    @Body() dto: { feature: string; metadata?: any },
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    await this.subscriptionService.trackFeatureUsage(userId, dto.feature, dto.metadata);
    return { success: true };
  }
}