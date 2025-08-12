/**
 * Stripe Configuration
 * Handles all Stripe-related configuration and plan definitions
 * 
 * Last Updated On: 2025-08-06
 */

import { registerAs } from '@nestjs/config';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number; // in cents
  interval: 'month' | 'year';
  features: string[];
  stripePriceId: string;
  stripeProductId: string;
  tier: 'DISCOVER' | 'CONNECT' | 'COMMUNITY';
}

export default registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  currency: 'usd',
  apiVersion: '2025-07-30.basil' as const,
  
  // Webhook events we listen for
  webhookEvents: [
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'customer.created',
    'customer.updated',
    'customer.deleted',
    'checkout.session.completed',
    'checkout.session.expired',
  ],
  
  // Subscription plans configuration
  plans: {
    discover_monthly: {
      id: 'discover_monthly',
      name: 'Discover Monthly',
      description: 'Essential features for meaningful connections',
      price: 999, // $9.99
      interval: 'month',
      tier: 'DISCOVER',
      features: [
        'Basic matching algorithm',
        '10 daily likes',
        '3 profile photos',
        'Basic search filters',
        'Community forum read access',
      ],
      stripePriceId: process.env.STRIPE_DISCOVER_MONTHLY_PRICE_ID || '',
      stripeProductId: process.env.STRIPE_DISCOVER_PRODUCT_ID || '',
    },
    discover_yearly: {
      id: 'discover_yearly',
      name: 'Discover Yearly',
      description: 'Essential features - Save 20%',
      price: 9599, // $95.99 (20% off)
      interval: 'year',
      tier: 'DISCOVER',
      features: [
        'Basic matching algorithm',
        '10 daily likes',
        '3 profile photos',
        'Basic search filters',
        'Community forum read access',
      ],
      stripePriceId: process.env.STRIPE_DISCOVER_YEARLY_PRICE_ID || '',
      stripeProductId: process.env.STRIPE_DISCOVER_PRODUCT_ID || '',
    },
    connect_monthly: {
      id: 'connect_monthly',
      name: 'Connect Monthly',
      description: 'Enhanced features for deeper connections',
      price: 1999, // $19.99
      interval: 'month',
      tier: 'CONNECT',
      features: [
        'Everything in Discover',
        '50 daily likes',
        '6 profile photos',
        'Advanced search filters',
        'See who liked you',
        'Audio calls (30 min)',
        'Voice messages',
        'Travel mode',
        '3 profile boosts per month',
        'Message read receipts',
        'Priority support',
      ],
      stripePriceId: process.env.STRIPE_CONNECT_MONTHLY_PRICE_ID || '',
      stripeProductId: process.env.STRIPE_CONNECT_PRODUCT_ID || '',
    },
    connect_yearly: {
      id: 'connect_yearly',
      name: 'Connect Yearly',
      description: 'Enhanced features - Save 25%',
      price: 17999, // $179.99 (25% off)
      interval: 'year',
      tier: 'CONNECT',
      features: [
        'Everything in Discover',
        '50 daily likes',
        '6 profile photos',
        'Advanced search filters',
        'See who liked you',
        'Audio calls (30 min)',
        'Voice messages',
        'Travel mode',
        '3 profile boosts per month',
        'Message read receipts',
        'Priority support',
      ],
      stripePriceId: process.env.STRIPE_CONNECT_YEARLY_PRICE_ID || '',
      stripeProductId: process.env.STRIPE_CONNECT_PRODUCT_ID || '',
    },
    community_monthly: {
      id: 'community_monthly',
      name: 'Community Monthly',
      description: 'Premium experience with all features',
      price: 3999, // $39.99
      interval: 'month',
      tier: 'COMMUNITY',
      features: [
        'Everything in Connect',
        'Unlimited likes',
        '10 profile photos',
        'Video intro on profile',
        'Video calls (120 min)',
        'Screen sharing',
        'Call recording',
        'Group calls (8 participants)',
        'Video messages',
        '10 profile boosts per month',
        'Incognito mode',
        'Advanced analytics',
        'Profile verification badge',
        'VIP forum access',
        'Exclusive events',
        'AI coaching',
        'VIP support',
      ],
      stripePriceId: process.env.STRIPE_COMMUNITY_MONTHLY_PRICE_ID || '',
      stripeProductId: process.env.STRIPE_COMMUNITY_PRODUCT_ID || '',
    },
    community_yearly: {
      id: 'community_yearly',
      name: 'Community Yearly',
      description: 'Premium experience - Save 30%',
      price: 33599, // $335.99 (30% off)
      interval: 'year',
      tier: 'COMMUNITY',
      features: [
        'Everything in Connect',
        'Unlimited likes',
        '10 profile photos',
        'Video intro on profile',
        'Video calls (120 min)',
        'Screen sharing',
        'Call recording',
        'Group calls (8 participants)',
        'Video messages',
        '10 profile boosts per month',
        'Incognito mode',
        'Advanced analytics',
        'Profile verification badge',
        'VIP forum access',
        'Exclusive events',
        'AI coaching',
        'VIP support',
      ],
      stripePriceId: process.env.STRIPE_COMMUNITY_YEARLY_PRICE_ID || '',
      stripeProductId: process.env.STRIPE_COMMUNITY_PRODUCT_ID || '',
    },
  } as Record<string, SubscriptionPlan>,
}));