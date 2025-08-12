/**
 * Stripe Service
 * Handles all Stripe API interactions for payments and subscriptions
 * 
 * Last Updated On: 2025-08-06
 */

import { Injectable, Logger, BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { 
  SubscriptionTier, 
  SubscriptionStatus,
  PaymentStatus,
  InvoiceStatus,
} from '@prisma/client';
import { SubscriptionPlan } from '../config/stripe.config';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly plans: Record<string, SubscriptionPlan>;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const stripeConfig = this.configService.get('stripe');
    this.stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: stripeConfig.apiVersion,
      typescript: true,
    });
    this.plans = stripeConfig.plans;
  }

  /**
   * Create or retrieve existing Stripe customer
   */
  async createOrGetCustomer(
    userId: string, 
    email: string, 
    name?: string
  ): Promise<string> {
    try {
      // Check if user already has a Stripe customer ID
      const subscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
        select: { stripeCustomerId: true },
      });

      if (subscription?.stripeCustomerId) {
        return subscription.stripeCustomerId;
      }

      // Create new Stripe customer
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          userId,
        },
      });

      // Update user subscription record with customer ID
      await this.prisma.userSubscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: customer.id,
          subscriptionTier: SubscriptionTier.DISCOVER,
          status: SubscriptionStatus.ACTIVE,
        },
        update: {
          stripeCustomerId: customer.id,
        },
      });

      this.logger.log(`Created Stripe customer ${customer.id} for user ${userId}`);
      return customer.id;
    } catch (error) {
      this.logger.error('Error creating/getting Stripe customer:', error);
      throw new InternalServerErrorException('Failed to create customer');
    }
  }

  /**
   * Create payment intent for one-time or subscription payments
   */
  async createPaymentIntent(
    userId: string,
    planId: string,
    paymentMethodId?: string,
    currency: string = 'usd',
  ) {
    try {
      const plan = this.plans[planId];
      if (!plan) {
        throw new BadRequestException('Invalid plan ID');
      }

      // Get or create customer
      const subscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!subscription?.stripeCustomerId) {
        throw new BadRequestException('Customer not found');
      }

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: plan.price,
        currency,
        customer: subscription.stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: !!paymentMethodId,
        metadata: {
          userId,
          planId,
        },
        description: `Subscription: ${plan.name}`,
      });

      // Store payment intent in database
      await this.prisma.paymentIntent.create({
        data: {
          userId,
          stripePaymentIntentId: paymentIntent.id,
          amount: plan.price,
          currency: paymentIntent.currency,
          status: paymentIntent.status as PaymentStatus,
          description: `Subscription: ${plan.name}`,
          metadata: {
            planId,
          },
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: plan.price,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      this.logger.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Create a new subscription
   */
  async createSubscription(
    userId: string,
    planId: string,
    paymentMethodId: string,
  ) {
    try {
      const plan = this.plans[planId];
      if (!plan) {
        throw new BadRequestException('Invalid plan ID');
      }

      // Get customer
      const subscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!subscription?.stripeCustomerId) {
        throw new BadRequestException('Customer not found');
      }

      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: subscription.stripeCustomerId,
      });

      // Set as default payment method
      await this.stripe.customers.update(subscription.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Create subscription
      const stripeSubscription: any = await this.stripe.subscriptions.create({
        customer: subscription.stripeCustomerId,
        items: [{ price: plan.stripePriceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { 
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          planId,
        },
      });

      // Update subscription in database
      await this.prisma.userSubscription.update({
        where: { userId },
        data: {
          subscriptionTier: plan.tier as SubscriptionTier,
          stripeSubscriptionId: stripeSubscription.id,
          status: stripeSubscription.status.toUpperCase() as SubscriptionStatus,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          planId,
        },
      });

      const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = (latestInvoice as any)?.payment_intent as Stripe.PaymentIntent;

      return {
        subscriptionId: stripeSubscription.id,
        clientSecret: paymentIntent?.client_secret,
        status: stripeSubscription.status,
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      };
    } catch (error) {
      this.logger.error('Error creating subscription:', error);
      throw error;
    }
  }

  /**
   * Update existing subscription
   */
  async updateSubscription(
    userId: string,
    newPlanId?: string,
    cancelAtPeriodEnd?: boolean,
  ) {
    try {
      const userSubscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!userSubscription?.stripeSubscriptionId) {
        throw new BadRequestException('No active subscription found');
      }

      const subscription = await this.stripe.subscriptions.retrieve(
        userSubscription.stripeSubscriptionId,
      );

      const updateData: Stripe.SubscriptionUpdateParams = {};

      if (newPlanId) {
        const plan = this.plans[newPlanId];
        if (!plan) {
          throw new BadRequestException('Invalid plan ID');
        }

        // Update subscription item
        updateData.items = [{
          id: subscription.items.data[0]?.id,
          price: plan.stripePriceId,
        }];
        updateData.proration_behavior = 'create_prorations';
      }

      if (cancelAtPeriodEnd !== undefined) {
        updateData.cancel_at_period_end = cancelAtPeriodEnd;
      }

      const updatedSubscription = await this.stripe.subscriptions.update(
        userSubscription.stripeSubscriptionId,
        updateData,
      );

      // Update in database
      await this.prisma.userSubscription.update({
        where: { userId },
        data: {
          ...(newPlanId && { 
            planId: newPlanId,
            subscriptionTier: this.plans[newPlanId].tier as SubscriptionTier,
          }),
          ...(cancelAtPeriodEnd !== undefined && { cancelAtPeriodEnd }),
          status: updatedSubscription.status as SubscriptionStatus,
        },
      });

      return updatedSubscription;
    } catch (error) {
      this.logger.error('Error updating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string, immediately: boolean = false) {
    try {
      const userSubscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!userSubscription?.stripeSubscriptionId) {
        throw new BadRequestException('No active subscription found');
      }

      if (immediately) {
        await this.stripe.subscriptions.cancel(userSubscription.stripeSubscriptionId);
        
        await this.prisma.userSubscription.update({
          where: { userId },
          data: {
            status: SubscriptionStatus.CANCELED,
            subscriptionTier: SubscriptionTier.DISCOVER,
          },
        });
      } else {
        await this.stripe.subscriptions.update(userSubscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

        await this.prisma.userSubscription.update({
          where: { userId },
          data: {
            cancelAtPeriodEnd: true,
          },
        });
      }
    } catch (error) {
      this.logger.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Get billing history for user
   */
  async getBillingHistory(userId: string) {
    try {
      const userSubscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!userSubscription?.stripeCustomerId) {
        return [];
      }

      const invoices = await this.stripe.invoices.list({
        customer: userSubscription.stripeCustomerId,
        limit: 100,
      });

      // Store invoices in database
      const billingHistory: any[] = [];
      for (const invoice of invoices.data) {
        const record = await this.prisma.billingHistory.upsert({
          where: { stripeInvoiceId: invoice.id },
          create: {
            userId,
            stripeInvoiceId: invoice.id!,
            amount: invoice.amount_paid || 0,
            currency: invoice.currency,
            status: (invoice.status || 'draft') as InvoiceStatus,
            description: invoice.description || 'Subscription payment',
            periodStart: new Date(invoice.period_start * 1000),
            periodEnd: new Date(invoice.period_end * 1000),
            invoiceUrl: invoice.hosted_invoice_url,
            pdfUrl: invoice.invoice_pdf,
          },
          update: {
            status: (invoice.status || 'draft') as InvoiceStatus,
          },
        });
        billingHistory.push(record);
      }

      return billingHistory;
    } catch (error) {
      this.logger.error('Error getting billing history:', error);
      throw error;
    }
  }

  /**
   * Get user's payment methods
   */
  async getPaymentMethods(userId: string) {
    try {
      const userSubscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!userSubscription?.stripeCustomerId) {
        return [];
      }

      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: userSubscription.stripeCustomerId,
        type: 'card',
      });

      const customer = await this.stripe.customers.retrieve(
        userSubscription.stripeCustomerId,
      ) as Stripe.Customer;
      
      const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method;

      // Store payment methods in database
      const methods: any[] = [];
      for (const pm of paymentMethods.data) {
        const method = await this.prisma.paymentMethod.upsert({
          where: { stripePaymentMethodId: pm.id },
          create: {
            userId,
            stripePaymentMethodId: pm.id,
            type: pm.type,
            brand: pm.card?.brand,
            last4: pm.card?.last4,
            expiryMonth: pm.card?.exp_month,
            expiryYear: pm.card?.exp_year,
            isDefault: pm.id === defaultPaymentMethodId,
          },
          update: {
            isDefault: pm.id === defaultPaymentMethodId,
          },
        });
        methods.push(method);
      }

      return methods;
    } catch (error) {
      this.logger.error('Error getting payment methods:', error);
      throw error;
    }
  }

  /**
   * Create setup intent for saving payment method
   */
  async createSetupIntent(userId: string) {
    try {
      const userSubscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!userSubscription?.stripeCustomerId) {
        throw new BadRequestException('Customer not found');
      }

      const setupIntent = await this.stripe.setupIntents.create({
        customer: userSubscription.stripeCustomerId,
        payment_method_types: ['card'],
        metadata: {
          userId,
        },
      });

      return {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
      };
    } catch (error) {
      this.logger.error('Error creating setup intent:', error);
      throw error;
    }
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(userId: string, paymentMethodId: string) {
    try {
      // Verify ownership
      const paymentMethod = await this.prisma.paymentMethod.findUnique({
        where: { stripePaymentMethodId: paymentMethodId },
      });

      if (!paymentMethod || paymentMethod.userId !== userId) {
        throw new BadRequestException('Payment method not found');
      }

      // Detach from Stripe
      await this.stripe.paymentMethods.detach(paymentMethodId);

      // Delete from database
      await this.prisma.paymentMethod.delete({
        where: { stripePaymentMethodId: paymentMethodId },
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting payment method:', error);
      throw error;
    }
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(userId: string, paymentMethodId: string) {
    try {
      const userSubscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!userSubscription?.stripeCustomerId) {
        throw new BadRequestException('Customer not found');
      }

      // Update default payment method in Stripe
      await this.stripe.customers.update(userSubscription.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // Update database
      await this.prisma.paymentMethod.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      await this.prisma.paymentMethod.update({
        where: { stripePaymentMethodId: paymentMethodId },
        data: { isDefault: true },
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error setting default payment method:', error);
      throw error;
    }
  }

  /**
   * Get available subscription plans
   */
  getAvailablePlans() {
    return Object.values(this.plans);
  }

  /**
   * Get current user subscription
   */
  async getCurrentSubscription(userId: string) {
    const subscription = await this.prisma.userSubscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    return subscription;
  }

  /**
   * Cancel subscription immediately
   */
  async cancelSubscriptionImmediately(userId: string, subscriptionId: string): Promise<void> {
    try {
      const userSubscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!userSubscription || userSubscription.stripeSubscriptionId !== subscriptionId) {
        throw new NotFoundException('Subscription not found');
      }

      // Cancel immediately in Stripe
      await this.stripe.subscriptions.cancel(subscriptionId);

      // Update database
      await this.prisma.userSubscription.update({
        where: { userId },
        data: {
          status: SubscriptionStatus.CANCELED,
          subscriptionTier: SubscriptionTier.DISCOVER,
          cancelledAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error cancelling subscription immediately:', error);
      throw error;
    }
  }

  /**
   * Reactivate a cancelled subscription
   */
  async reactivateSubscription(userId: string, subscriptionId: string) {
    try {
      const userSubscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!userSubscription || userSubscription.stripeSubscriptionId !== subscriptionId) {
        throw new NotFoundException('Subscription not found');
      }

      // Reactivate in Stripe
      const stripeSubscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      // Update database
      await this.prisma.userSubscription.update({
        where: { userId },
        data: {
          cancelAtPeriodEnd: false,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      return {
        subscriptionId: stripeSubscription.id,
        clientSecret: null,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
      };
    } catch (error) {
      this.logger.error('Error reactivating subscription:', error);
      throw error;
    }
  }

  /**
   * Create Stripe Checkout session
   */
  async createCheckoutSession(
    userId: string,
    userEmail: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    try {
      const customerId = await this.createOrGetCustomer(userId, userEmail);

      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          userId,
        },
      });

      return {
        sessionId: session.id,
        url: session.url || '',
      };
    } catch (error) {
      this.logger.error('Error creating checkout session:', error);
      throw error;
    }
  }

  /**
   * Create Stripe Portal session for subscription management
   */
  async createPortalSession(userId: string, returnUrl: string) {
    try {
      const userSubscription = await this.prisma.userSubscription.findUnique({
        where: { userId },
      });

      if (!userSubscription?.stripeCustomerId) {
        throw new NotFoundException('No customer found');
      }

      const session = await this.stripe.billingPortal.sessions.create({
        customer: userSubscription.stripeCustomerId,
        return_url: returnUrl,
      });

      return { url: session.url };
    } catch (error) {
      this.logger.error('Error creating portal session:', error);
      throw error;
    }
  }
}