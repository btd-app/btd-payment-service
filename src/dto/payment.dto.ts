/**
 * Payment DTOs
 * Data Transfer Objects for payment-related operations
 * 
 * Last Updated On: 2025-08-06
 */

import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentIntentDto {
  @ApiProperty({ description: 'Subscription plan ID' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiPropertyOptional({ description: 'Payment method ID from Stripe' })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiPropertyOptional({ description: 'Currency code', default: 'usd' })
  @IsString()
  @IsOptional()
  currency?: string;
}

export class CreateSetupIntentDto {
  @ApiPropertyOptional({ description: 'Usage type for the payment method' })
  @IsString()
  @IsOptional()
  usage?: 'on_session' | 'off_session';
}

export class SetDefaultPaymentMethodDto {
  @ApiProperty({ description: 'Payment method ID to set as default' })
  @IsString()
  @IsNotEmpty()
  paymentMethodId: string;
}

export class PaymentIntentResponseDto {
  @ApiProperty()
  clientSecret: string | null;

  @ApiProperty()
  paymentIntentId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;
}

export class SetupIntentResponseDto {
  @ApiProperty()
  clientSecret: string | null;

  @ApiProperty()
  setupIntentId: string;
}

export class PaymentMethodDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  stripePaymentMethodId: string;

  @ApiProperty()
  type: string;

  @ApiPropertyOptional()
  brand?: string;

  @ApiPropertyOptional()
  last4?: string;

  @ApiPropertyOptional()
  expiryMonth?: number;

  @ApiPropertyOptional()
  expiryYear?: number;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class BillingHistoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  stripeInvoiceId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;

  @ApiPropertyOptional()
  invoiceUrl?: string;

  @ApiPropertyOptional()
  receiptUrl?: string;

  @ApiPropertyOptional()
  pdfUrl?: string;

  @ApiProperty()
  createdAt: Date;
}