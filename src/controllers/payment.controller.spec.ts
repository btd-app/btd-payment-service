/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-argument */

/**
 * Payment Controller Unit Tests
 * Comprehensive test suite for payment-related API endpoints
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { StripeService } from '../services/stripe.service';
import {
  CreatePaymentIntentDto,
  CreateSetupIntentDto,
  PaymentIntentResponseDto,
  SetupIntentResponseDto,
} from '../dto/payment.dto';
import { SubscriptionPlanDto } from '../dto/subscription.dto';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Request } from 'express';

/**
 * Mock type for AuthenticatedRequest
 * Matches the interface from auth.guard.ts
 */
interface _AuthenticatedRequest extends Partial<Request> {
  user: {
    id: string;
    email: string;
  };
}

/**
 * Mock factory for StripeService
 * Provides complete stub implementation with controllable behavior
 */
class StripeServiceStub {
  getAvailablePlans = jest.fn();
  createOrGetCustomer = jest.fn();
  createPaymentIntent = jest.fn();
  createSetupIntent = jest.fn();
  getBillingHistory = jest.fn();
  getPaymentMethods = jest.fn();
  deletePaymentMethod = jest.fn();
  setDefaultPaymentMethod = jest.fn();

  reset() {
    jest.clearAllMocks();
  }
}

/**
 * Factory function to create StripeService stub
 */
function createStripeServiceStub(): StripeServiceStub {
  return new StripeServiceStub();
}

/**
 * Mock factory for subscription plans
 */
function createMockPlans(): SubscriptionPlanDto[] {
  return [
    {
      id: 'price_discover_monthly',
      name: 'Discover',
      description: 'Basic tier with essential features',
      price: 0,
      interval: 'month',
      features: ['Basic matching', 'Limited messages'],
      stripePriceId: 'price_discover_monthly',
      stripeProductId: 'prod_discover',
      tier: 'DISCOVER',
    },
    {
      id: 'price_connect_monthly',
      name: 'Connect',
      description: 'Premium tier with advanced features',
      price: 1999,
      interval: 'month',
      features: ['Unlimited matches', 'Video calls', 'Advanced filters'],
      stripePriceId: 'price_connect_monthly',
      stripeProductId: 'prod_connect',
      tier: 'CONNECT',
    },
    {
      id: 'price_community_monthly',
      name: 'Community',
      description: 'Ultimate tier with all features',
      price: 4999,
      interval: 'month',
      features: [
        'All Connect features',
        'Community access',
        'Priority support',
      ],
      stripePriceId: 'price_community_monthly',
      stripeProductId: 'prod_community',
      tier: 'COMMUNITY',
    },
  ];
}

/**
 * Mock factory for payment intent response
 */
function createMockPaymentIntentResponse(): PaymentIntentResponseDto {
  return {
    clientSecret: 'pi_test_secret_12345',
    paymentIntentId: 'pi_test_12345',
    amount: 1999,
    currency: 'usd',
  };
}

/**
 * Mock factory for setup intent response
 */
function createMockSetupIntentResponse(): SetupIntentResponseDto {
  return {
    clientSecret: 'seti_test_secret_12345',
    setupIntentId: 'seti_test_12345',
  };
}

/**
 * Mock factory for billing history
 */
function createMockBillingHistory(): Array<{
  id: string;
  userId: string;
  stripeInvoiceId: string;
  type: string;
  amount: Decimal;
  currency: string;
  status: string;
  description: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceUrl: string | null;
  receiptUrl: string | null;
  pdfUrl: string | null;
  createdAt: Date;
}> {
  return [
    {
      id: 'bill_1',
      userId: 'user-123',
      stripeInvoiceId: 'in_test_1',
      type: 'subscription_payment',
      amount: new Decimal(1999),
      currency: 'usd',
      status: 'PAID',
      description: 'Connect Monthly Subscription',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-02-01'),
      invoiceUrl: 'https://invoice.stripe.com/i/test_1',
      receiptUrl: null,
      pdfUrl: 'https://invoice.stripe.com/pdf/test_1',
      createdAt: new Date('2025-01-01'),
    },
    {
      id: 'bill_2',
      userId: 'user-123',
      stripeInvoiceId: 'in_test_2',
      type: 'subscription_payment',
      amount: new Decimal(1999),
      currency: 'usd',
      status: 'PAID',
      description: 'Connect Monthly Subscription',
      periodStart: new Date('2025-02-01'),
      periodEnd: new Date('2025-03-01'),
      invoiceUrl: 'https://invoice.stripe.com/i/test_2',
      receiptUrl: null,
      pdfUrl: 'https://invoice.stripe.com/pdf/test_2',
      createdAt: new Date('2025-02-01'),
    },
  ];
}

/**
 * Mock factory for payment methods
 */
function createMockPaymentMethods(): Array<{
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  createdAt: Date;
}> {
  return [
    {
      id: 'pm_db_1',
      userId: 'user-123',
      stripePaymentMethodId: 'pm_test_visa',
      type: 'card',
      brand: 'visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true,
      createdAt: new Date('2025-01-01'),
    },
    {
      id: 'pm_db_2',
      userId: 'user-123',
      stripePaymentMethodId: 'pm_test_mastercard',
      type: 'card',
      brand: 'mastercard',
      last4: '5555',
      expiryMonth: 6,
      expiryYear: 2026,
      isDefault: false,
      createdAt: new Date('2025-01-15'),
    },
  ];
}

describe('PaymentController', () => {
  let controller: PaymentController;
  let stripeServiceStub: StripeServiceStub;

  beforeEach(async () => {
    // Create fresh stub instance for each test
    stripeServiceStub = createStripeServiceStub();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: StripeService,
          useValue: stripeServiceStub,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  afterEach(() => {
    stripeServiceStub.reset();
  });

  describe('getPlans', () => {
    it('should return list of available subscription plans', () => {
      // Arrange
      const mockPlans = createMockPlans();
      stripeServiceStub.getAvailablePlans.mockReturnValue(mockPlans);

      // Act
      const result = controller.getPlans();

      // Assert
      expect(result).toEqual(mockPlans);
      expect(result).toHaveLength(3);
      expect(result[0].tier).toBe('DISCOVER');
      expect(result[1].tier).toBe('CONNECT');
      expect(result[2].tier).toBe('COMMUNITY');
      expect(stripeServiceStub.getAvailablePlans).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no plans are configured', () => {
      // Arrange
      stripeServiceStub.getAvailablePlans.mockReturnValue([]);

      // Act
      const result = controller.getPlans();

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent successfully with authenticated user', async () => {
      // Arrange
      const dto: CreatePaymentIntentDto = {
        planId: 'price_connect_monthly',
        paymentMethodId: 'pm_test_12345',
        currency: 'usd',
      };
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;
      const mockResponse = createMockPaymentIntentResponse();

      stripeServiceStub.createOrGetCustomer.mockResolvedValue('cus_test_123');
      stripeServiceStub.createPaymentIntent.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.createPaymentIntent(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(stripeServiceStub.createOrGetCustomer).toHaveBeenCalledWith(
        'user-123',
        'test@example.com',
      );
      expect(stripeServiceStub.createPaymentIntent).toHaveBeenCalledWith(
        'user-123',
        'price_connect_monthly',
        'pm_test_12345',
        'usd',
      );
    });

    it('should create payment intent with fallback user ID when user not authenticated', async () => {
      // Arrange
      const dto: CreatePaymentIntentDto = {
        planId: 'price_connect_monthly',
        currency: 'usd',
      };
      const mockRequest = { user: null } as any;
      const mockResponse = createMockPaymentIntentResponse();

      stripeServiceStub.createOrGetCustomer.mockResolvedValue('cus_test_123');
      stripeServiceStub.createPaymentIntent.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.createPaymentIntent(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(stripeServiceStub.createOrGetCustomer).toHaveBeenCalledWith(
        'test-user',
        'test@example.com',
      );
      expect(stripeServiceStub.createPaymentIntent).toHaveBeenCalledWith(
        'test-user',
        'price_connect_monthly',
        undefined,
        'usd',
      );
    });

    it('should create payment intent without payment method ID', async () => {
      // Arrange
      const dto: CreatePaymentIntentDto = {
        planId: 'price_connect_monthly',
        currency: 'usd',
      };
      const mockRequest = {
        user: { id: 'user-456', email: 'another@example.com' },
      } as any;
      const mockResponse = createMockPaymentIntentResponse();

      stripeServiceStub.createOrGetCustomer.mockResolvedValue('cus_test_456');
      stripeServiceStub.createPaymentIntent.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.createPaymentIntent(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(stripeServiceStub.createPaymentIntent).toHaveBeenCalledWith(
        'user-456',
        'price_connect_monthly',
        undefined,
        'usd',
      );
    });

    it('should create payment intent with default currency when not specified', async () => {
      // Arrange
      const dto: CreatePaymentIntentDto = {
        planId: 'price_connect_monthly',
      };
      const mockRequest = {
        user: { id: 'user-789', email: 'user@example.com' },
      } as any;
      const mockResponse = createMockPaymentIntentResponse();

      stripeServiceStub.createOrGetCustomer.mockResolvedValue('cus_test_789');
      stripeServiceStub.createPaymentIntent.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.createPaymentIntent(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(stripeServiceStub.createPaymentIntent).toHaveBeenCalledWith(
        'user-789',
        'price_connect_monthly',
        undefined,
        undefined,
      );
    });

    it('should throw BadRequestException when plan ID is invalid', async () => {
      // Arrange
      const dto: CreatePaymentIntentDto = {
        planId: 'invalid_plan',
        currency: 'usd',
      };
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.createOrGetCustomer.mockResolvedValue('cus_test_123');
      stripeServiceStub.createPaymentIntent.mockRejectedValue(
        new BadRequestException('Invalid plan ID'),
      );

      // Act & Assert
      await expect(
        controller.createPaymentIntent(dto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createPaymentIntent(dto, mockRequest),
      ).rejects.toThrow('Invalid plan ID');
    });

    it('should throw error when customer creation fails', async () => {
      // Arrange
      const dto: CreatePaymentIntentDto = {
        planId: 'price_connect_monthly',
        currency: 'usd',
      };
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.createOrGetCustomer.mockRejectedValue(
        new InternalServerErrorException('Failed to create customer'),
      );

      // Act & Assert
      await expect(
        controller.createPaymentIntent(dto, mockRequest),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw error when payment intent creation fails', async () => {
      // Arrange
      const dto: CreatePaymentIntentDto = {
        planId: 'price_connect_monthly',
        paymentMethodId: 'pm_invalid',
        currency: 'usd',
      };
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.createOrGetCustomer.mockResolvedValue('cus_test_123');
      stripeServiceStub.createPaymentIntent.mockRejectedValue(
        new BadRequestException('Invalid payment method'),
      );

      // Act & Assert
      await expect(
        controller.createPaymentIntent(dto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createPaymentIntent(dto, mockRequest),
      ).rejects.toThrow('Invalid payment method');
    });
  });

  describe('createSetupIntent', () => {
    it('should create setup intent successfully with authenticated user', async () => {
      // Arrange
      const dto: CreateSetupIntentDto = {};
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;
      const mockResponse = createMockSetupIntentResponse();

      stripeServiceStub.createSetupIntent.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.createSetupIntent(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(stripeServiceStub.createSetupIntent).toHaveBeenCalledWith(
        'user-123',
      );
      expect(stripeServiceStub.createSetupIntent).toHaveBeenCalledTimes(1);
    });

    it('should create setup intent with fallback user ID when user not authenticated', async () => {
      // Arrange
      const dto: CreateSetupIntentDto = {};
      const mockRequest = { user: null } as any;
      const mockResponse = createMockSetupIntentResponse();

      stripeServiceStub.createSetupIntent.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.createSetupIntent(dto, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(stripeServiceStub.createSetupIntent).toHaveBeenCalledWith(
        'test-user',
      );
    });

    it('should throw error when setup intent creation fails', async () => {
      // Arrange
      const dto: CreateSetupIntentDto = {};
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.createSetupIntent.mockRejectedValue(
        new BadRequestException('Customer not found'),
      );

      // Act & Assert
      await expect(
        controller.createSetupIntent(dto, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.createSetupIntent(dto, mockRequest),
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('getBillingHistory', () => {
    it('should return billing history with Decimal converted to number', async () => {
      // Arrange
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;
      const mockHistory = createMockBillingHistory();

      stripeServiceStub.getBillingHistory.mockResolvedValue(mockHistory);

      // Act
      const result = await controller.getBillingHistory(mockRequest);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(1999);
      expect(typeof result[0].amount).toBe('number');
      expect(result[1].amount).toBe(1999);
      expect(typeof result[1].amount).toBe('number');
      expect(stripeServiceStub.getBillingHistory).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should return billing history with fallback user ID', async () => {
      // Arrange
      const mockRequest = { user: null } as any;
      const mockHistory = createMockBillingHistory();

      stripeServiceStub.getBillingHistory.mockResolvedValue(mockHistory);

      // Act
      const result = await controller.getBillingHistory(mockRequest);

      // Assert
      expect(result).toHaveLength(2);
      expect(stripeServiceStub.getBillingHistory).toHaveBeenCalledWith(
        'test-user',
      );
    });

    it('should return empty array when user has no billing history', async () => {
      // Arrange
      const mockRequest = {
        user: { id: 'user-new', email: 'new@example.com' },
      } as any;

      stripeServiceStub.getBillingHistory.mockResolvedValue([]);

      // Act
      const result = await controller.getBillingHistory(mockRequest);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle Decimal to number conversion correctly', async () => {
      // Arrange
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;
      const mockHistory = [
        {
          id: 'bill_1',
          userId: 'user-123',
          stripeInvoiceId: 'in_test_1',
          type: 'subscription_payment',
          amount: new Decimal(9999.99),
          currency: 'usd',
          status: 'PAID',
          description: 'Test payment',
          periodStart: new Date('2025-01-01'),
          periodEnd: new Date('2025-02-01'),
          invoiceUrl: null,
          receiptUrl: null,
          pdfUrl: null,
          createdAt: new Date('2025-01-01'),
        },
      ];

      stripeServiceStub.getBillingHistory.mockResolvedValue(mockHistory);

      // Act
      const result = await controller.getBillingHistory(mockRequest);

      // Assert
      expect(result[0].amount).toBe(9999.99);
      expect(typeof result[0].amount).toBe('number');
    });

    it('should throw error when getBillingHistory fails', async () => {
      // Arrange
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.getBillingHistory.mockRejectedValue(
        new InternalServerErrorException('Database error'),
      );

      // Act & Assert
      await expect(controller.getBillingHistory(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getPaymentMethods', () => {
    it('should return payment methods with updatedAt field added', async () => {
      // Arrange
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;
      const mockMethods = createMockPaymentMethods();

      stripeServiceStub.getPaymentMethods.mockResolvedValue(mockMethods);

      // Act
      const result = await controller.getPaymentMethods(mockRequest);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].updatedAt).toEqual(mockMethods[0].createdAt);
      expect(result[1].updatedAt).toEqual(mockMethods[1].createdAt);
      expect(result[0].brand).toBe('visa');
      expect(result[0].last4).toBe('4242');
      expect(result[0].isDefault).toBe(true);
      expect(result[1].isDefault).toBe(false);
      expect(stripeServiceStub.getPaymentMethods).toHaveBeenCalledWith(
        'user-123',
      );
    });

    it('should return payment methods with fallback user ID', async () => {
      // Arrange
      const mockRequest = { user: null } as any;
      const mockMethods = createMockPaymentMethods();

      stripeServiceStub.getPaymentMethods.mockResolvedValue(mockMethods);

      // Act
      const result = await controller.getPaymentMethods(mockRequest);

      // Assert
      expect(result).toHaveLength(2);
      expect(stripeServiceStub.getPaymentMethods).toHaveBeenCalledWith(
        'test-user',
      );
    });

    it('should return empty array when user has no payment methods', async () => {
      // Arrange
      const mockRequest = {
        user: { id: 'user-new', email: 'new@example.com' },
      } as any;

      stripeServiceStub.getPaymentMethods.mockResolvedValue([]);

      // Act
      const result = await controller.getPaymentMethods(mockRequest);

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should correctly add updatedAt field using createdAt as fallback', async () => {
      // Arrange
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;
      const testDate = new Date('2025-01-15T10:30:00Z');
      const mockMethods = [
        {
          id: 'pm_1',
          userId: 'user-123',
          stripePaymentMethodId: 'pm_test',
          type: 'card',
          brand: 'amex',
          last4: '0005',
          expiryMonth: 3,
          expiryYear: 2027,
          isDefault: true,
          createdAt: testDate,
        },
      ];

      stripeServiceStub.getPaymentMethods.mockResolvedValue(mockMethods);

      // Act
      const result = await controller.getPaymentMethods(mockRequest);

      // Assert
      expect(result[0].updatedAt).toEqual(testDate);
      expect(result[0].createdAt).toEqual(testDate);
    });

    it('should throw error when getPaymentMethods fails', async () => {
      // Arrange
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.getPaymentMethods.mockRejectedValue(
        new InternalServerErrorException('Database error'),
      );

      // Act & Assert
      await expect(controller.getPaymentMethods(mockRequest)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('deletePaymentMethod', () => {
    it('should delete payment method successfully', async () => {
      // Arrange
      const paymentMethodId = 'pm_test_12345';
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.deletePaymentMethod.mockResolvedValue(undefined);

      // Act
      const result = await controller.deletePaymentMethod(
        paymentMethodId,
        mockRequest,
      );

      // Assert
      expect(result).toBeUndefined();
      expect(stripeServiceStub.deletePaymentMethod).toHaveBeenCalledWith(
        'user-123',
        'pm_test_12345',
      );
      expect(stripeServiceStub.deletePaymentMethod).toHaveBeenCalledTimes(1);
    });

    it('should delete payment method with fallback user ID', async () => {
      // Arrange
      const paymentMethodId = 'pm_test_67890';
      const mockRequest = { user: null } as any;

      stripeServiceStub.deletePaymentMethod.mockResolvedValue(undefined);

      // Act
      const result = await controller.deletePaymentMethod(
        paymentMethodId,
        mockRequest,
      );

      // Assert
      expect(result).toBeUndefined();
      expect(stripeServiceStub.deletePaymentMethod).toHaveBeenCalledWith(
        'test-user',
        'pm_test_67890',
      );
    });

    it('should throw BadRequestException when payment method not found', async () => {
      // Arrange
      const paymentMethodId = 'pm_nonexistent';
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.deletePaymentMethod.mockRejectedValue(
        new BadRequestException('Payment method not found'),
      );

      // Act & Assert
      await expect(
        controller.deletePaymentMethod(paymentMethodId, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.deletePaymentMethod(paymentMethodId, mockRequest),
      ).rejects.toThrow('Payment method not found');
    });

    it('should throw error when user does not own payment method', async () => {
      // Arrange
      const paymentMethodId = 'pm_other_user';
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.deletePaymentMethod.mockRejectedValue(
        new BadRequestException('Payment method not found'),
      );

      // Act & Assert
      await expect(
        controller.deletePaymentMethod(paymentMethodId, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when Stripe API fails', async () => {
      // Arrange
      const paymentMethodId = 'pm_test_12345';
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.deletePaymentMethod.mockRejectedValue(
        new InternalServerErrorException('Stripe API error'),
      );

      // Act & Assert
      await expect(
        controller.deletePaymentMethod(paymentMethodId, mockRequest),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should set default payment method successfully', async () => {
      // Arrange
      const paymentMethodId = 'pm_test_12345';
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.setDefaultPaymentMethod.mockResolvedValue({
        success: true,
      });

      // Act
      const result = await controller.setDefaultPaymentMethod(
        paymentMethodId,
        mockRequest,
      );

      // Assert
      expect(result).toEqual({ success: true });
      expect(stripeServiceStub.setDefaultPaymentMethod).toHaveBeenCalledWith(
        'user-123',
        'pm_test_12345',
      );
      expect(stripeServiceStub.setDefaultPaymentMethod).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should set default payment method with fallback user ID', async () => {
      // Arrange
      const paymentMethodId = 'pm_test_67890';
      const mockRequest = { user: null } as any;

      stripeServiceStub.setDefaultPaymentMethod.mockResolvedValue({
        success: true,
      });

      // Act
      const result = await controller.setDefaultPaymentMethod(
        paymentMethodId,
        mockRequest,
      );

      // Assert
      expect(result).toEqual({ success: true });
      expect(stripeServiceStub.setDefaultPaymentMethod).toHaveBeenCalledWith(
        'test-user',
        'pm_test_67890',
      );
    });

    it('should throw BadRequestException when payment method not found', async () => {
      // Arrange
      const paymentMethodId = 'pm_nonexistent';
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.setDefaultPaymentMethod.mockRejectedValue(
        new BadRequestException('Customer not found'),
      );

      // Act & Assert
      await expect(
        controller.setDefaultPaymentMethod(paymentMethodId, mockRequest),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.setDefaultPaymentMethod(paymentMethodId, mockRequest),
      ).rejects.toThrow('Customer not found');
    });

    it('should throw error when user does not own payment method', async () => {
      // Arrange
      const paymentMethodId = 'pm_other_user';
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.setDefaultPaymentMethod.mockRejectedValue(
        new BadRequestException('Payment method not found'),
      );

      // Act & Assert
      await expect(
        controller.setDefaultPaymentMethod(paymentMethodId, mockRequest),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when Stripe API fails', async () => {
      // Arrange
      const paymentMethodId = 'pm_test_12345';
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.setDefaultPaymentMethod.mockRejectedValue(
        new InternalServerErrorException('Stripe API error'),
      );

      // Act & Assert
      await expect(
        controller.setDefaultPaymentMethod(paymentMethodId, mockRequest),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should return success false when operation fails gracefully', async () => {
      // Arrange
      const paymentMethodId = 'pm_test_12345';
      const mockRequest = {
        user: { id: 'user-123', email: 'test@example.com' },
      } as any;

      stripeServiceStub.setDefaultPaymentMethod.mockResolvedValue({
        success: false,
      });

      // Act
      const result = await controller.setDefaultPaymentMethod(
        paymentMethodId,
        mockRequest,
      );

      // Assert
      expect(result).toEqual({ success: false });
    });
  });
});
