/**
 * Payment Controller
 * Handles payment-related API endpoints
 * 
 * Last Updated On: 2025-08-06
 */

import {
  Controller,
  Get,
  Post,
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
import {
  CreatePaymentIntentDto,
  CreateSetupIntentDto,
  SetDefaultPaymentMethodDto,
  PaymentIntentResponseDto,
  SetupIntentResponseDto,
  PaymentMethodDto,
  BillingHistoryDto,
} from '../dto/payment.dto';
import { SubscriptionPlanDto } from '../dto/subscription.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

@ApiTags('Payments')
@Controller('api/v1/payments')
// @UseGuards(AuthGuard) // TODO: Add auth guard
@ApiBearerAuth()
export class PaymentController {
  constructor(private readonly stripeService: StripeService) {}

  /**
   * Get available subscription plans
   */
  @Get('plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of available subscription plans',
    type: [SubscriptionPlanDto],
  })
  async getPlans(): Promise<SubscriptionPlanDto[]> {
    return this.stripeService.getAvailablePlans();
  }

  /**
   * Create payment intent for subscription purchase
   */
  @Post('create-payment-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create payment intent for subscription' })
  @ApiResponse({
    status: 200,
    description: 'Payment intent created successfully',
    type: PaymentIntentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<PaymentIntentResponseDto> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    const userEmail = req.user?.email || 'test@example.com';
    
    // Ensure customer exists
    await this.stripeService.createOrGetCustomer(userId, userEmail);
    
    return this.stripeService.createPaymentIntent(
      userId,
      dto.planId,
      dto.paymentMethodId,
      dto.currency,
    );
  }

  /**
   * Create setup intent for saving payment method
   */
  @Post('setup-intent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create setup intent for saving payment method' })
  @ApiResponse({
    status: 200,
    description: 'Setup intent created successfully',
    type: SetupIntentResponseDto,
  })
  async createSetupIntent(
    @Body() dto: CreateSetupIntentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SetupIntentResponseDto> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    return this.stripeService.createSetupIntent(userId);
  }

  /**
   * Get user's billing history
   */
  @Get('billing-history')
  @ApiOperation({ summary: 'Get billing history for current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns billing history',
    type: [BillingHistoryDto],
  })
  async getBillingHistory(@Req() req: AuthenticatedRequest): Promise<BillingHistoryDto[]> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    return this.stripeService.getBillingHistory(userId);
  }

  /**
   * Get user's saved payment methods
   */
  @Get('payment-methods')
  @ApiOperation({ summary: 'Get saved payment methods' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of payment methods',
    type: [PaymentMethodDto],
  })
  async getPaymentMethods(@Req() req: AuthenticatedRequest): Promise<PaymentMethodDto[]> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    return this.stripeService.getPaymentMethods(userId);
  }

  /**
   * Delete a payment method
   */
  @Delete('payment-methods/:paymentMethodId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a payment method' })
  @ApiParam({ name: 'paymentMethodId', description: 'Payment method ID to delete' })
  @ApiResponse({
    status: 204,
    description: 'Payment method deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async deletePaymentMethod(
    @Param('paymentMethodId') paymentMethodId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    await this.stripeService.deletePaymentMethod(userId, paymentMethodId);
  }

  /**
   * Set default payment method
   */
  @Post('payment-methods/:paymentMethodId/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set default payment method' })
  @ApiParam({ name: 'paymentMethodId', description: 'Payment method ID to set as default' })
  @ApiResponse({
    status: 200,
    description: 'Default payment method set successfully',
  })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async setDefaultPaymentMethod(
    @Param('paymentMethodId') paymentMethodId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean }> {
    const userId = req.user?.id || 'test-user'; // TODO: Get from auth
    return this.stripeService.setDefaultPaymentMethod(userId, paymentMethodId);
  }
}