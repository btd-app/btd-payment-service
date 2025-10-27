/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/**
 * Stripe Mock Factories
 * Provides mock implementations for Stripe webhook events and objects
 */

import Stripe from 'stripe';

/**
 * Create a base Stripe event mock
 */
export function createStripeEventMock(
  type: string,
  data: any,
  overrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  return {
    id: `evt_${Math.random().toString(36).substring(7)}`,
    object: 'event',
    api_version: '2025-08-27.basil',
    created: Math.floor(Date.now() / 1000),
    type,
    data: {
      object: data,
    },
    livemode: false,
    pending_webhooks: 0,
    request: {
      id: null,
      idempotency_key: null,
    },
    ...overrides,
  } as Stripe.Event;
}

/**
 * Create a mock Stripe subscription object
 */
export function createStripeSubscriptionMock(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `sub_${Math.random().toString(36).substring(7)}`,
    object: 'subscription',
    application: null,
    application_fee_percent: null,
    automatic_tax: {
      enabled: false,
      liability: null,
    },
    billing_cycle_anchor: now,
    billing_cycle_anchor_config: null,
    billing_thresholds: null,
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    cancellation_details: {
      comment: null,
      feedback: null,
      reason: null,
    },
    collection_method: 'charge_automatically',
    created: now,
    currency: 'usd',
    current_period_start: now,
    current_period_end: now + 2592000, // +30 days
    customer: `cus_${Math.random().toString(36).substring(7)}`,
    days_until_due: null,
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: null,
    discount: null,
    discounts: [],
    ended_at: null,
    invoice_settings: {
      account_tax_ids: null,
      issuer: {
        type: 'self',
      },
    },
    items: {
      object: 'list',
      data: [
        {
          id: `si_${Math.random().toString(36).substring(7)}`,
          object: 'subscription_item',
          billing_thresholds: null,
          created: now,
          metadata: {},
          price: {
            id: 'price_connect_monthly',
            object: 'price',
            active: true,
            billing_scheme: 'per_unit',
            created: now,
            currency: 'usd',
            custom_unit_amount: null,
            livemode: false,
            lookup_key: null,
            metadata: {},
            nickname: null,
            product: `prod_${Math.random().toString(36).substring(7)}`,
            recurring: {
              aggregate_usage: null,
              interval: 'month',
              interval_count: 1,
              meter: null,
              trial_period_days: null,
              usage_type: 'licensed',
            },
            tax_behavior: 'unspecified',
            tiers_mode: null,
            transform_quantity: null,
            type: 'recurring',
            unit_amount: 999,
            unit_amount_decimal: '999',
          },
          quantity: 1,
          subscription: `sub_${Math.random().toString(36).substring(7)}`,
          tax_rates: [],
        },
      ],
      has_more: false,
      url: '/v1/subscription_items',
    },
    latest_invoice: null,
    livemode: false,
    metadata: {},
    next_pending_invoice_item_invoice: null,
    on_behalf_of: null,
    pause_collection: null,
    payment_settings: {
      payment_method_options: null,
      payment_method_types: null,
      save_default_payment_method: 'off',
    },
    pending_invoice_item_interval: null,
    pending_setup_intent: null,
    pending_update: null,
    plan: null,
    quantity: 1,
    schedule: null,
    start_date: now,
    status: 'active',
    test_clock: null,
    transfer_data: null,
    trial_end: null,
    trial_settings: {
      end_behavior: {
        missing_payment_method: 'create_invoice',
      },
    },
    trial_start: null,
    ...overrides,
  } as Stripe.Subscription;
}

/**
 * Create a mock Stripe invoice object
 */
export function createStripeInvoiceMock(
  overrides: Partial<Stripe.Invoice> = {},
): Stripe.Invoice {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `in_${Math.random().toString(36).substring(7)}`,
    object: 'invoice',
    account_country: 'US',
    account_name: 'Test Account',
    account_tax_ids: null,
    amount_due: 999,
    amount_paid: 999,
    amount_remaining: 0,
    amount_shipping: 0,
    application: null,
    application_fee_amount: null,
    attempt_count: 1,
    attempted: true,
    auto_advance: true,
    automatic_tax: {
      enabled: false,
      liability: null,
      status: null,
    },
    billing_reason: 'subscription_cycle',
    charge: `ch_${Math.random().toString(36).substring(7)}`,
    collection_method: 'charge_automatically',
    created: now,
    currency: 'usd',
    custom_fields: null,
    customer: `cus_${Math.random().toString(36).substring(7)}`,
    customer_address: null,
    customer_email: 'test@example.com',
    customer_name: null,
    customer_phone: null,
    customer_shipping: null,
    customer_tax_exempt: 'none',
    customer_tax_ids: [],
    default_payment_method: null,
    default_source: null,
    default_tax_rates: [],
    description: 'Subscription payment',
    discount: null,
    discounts: [],
    due_date: null,
    effective_at: now,
    ending_balance: 0,
    footer: null,
    from_invoice: null,
    hosted_invoice_url: 'https://invoice.stripe.com/i/test',
    invoice_pdf: 'https://invoice.stripe.com/i/test/pdf',
    issuer: {
      type: 'self',
    },
    last_finalization_error: null,
    latest_revision: null,
    lines: {
      object: 'list',
      data: [],
      has_more: false,
      url: '/v1/invoices/in_test/lines',
    },
    livemode: false,
    metadata: {},
    next_payment_attempt: null,
    number: 'INV-0001',
    on_behalf_of: null,
    paid: true,
    paid_out_of_band: false,
    payment_intent: `pi_${Math.random().toString(36).substring(7)}`,
    payment_settings: {
      default_mandate: null,
      payment_method_options: null,
      payment_method_types: null,
    },
    period_end: now,
    period_start: now - 2592000,
    post_payment_credit_notes_amount: 0,
    pre_payment_credit_notes_amount: 0,
    quote: null,
    receipt_number: null,
    rendering: null,
    rendering_options: null,
    shipping_cost: null,
    shipping_details: null,
    starting_balance: 0,
    statement_descriptor: null,
    status: 'paid',
    status_transitions: {
      finalized_at: now,
      marked_uncollectible_at: null,
      paid_at: now,
      voided_at: null,
    },
    subscription: `sub_${Math.random().toString(36).substring(7)}`,
    subscription_details: {
      metadata: {},
    },
    subtotal: 999,
    subtotal_excluding_tax: 999,
    tax: null,
    test_clock: null,
    total: 999,
    total_discount_amounts: [],
    total_excluding_tax: 999,
    total_tax_amounts: [],
    transfer_data: null,
    webhooks_delivered_at: now,
    ...overrides,
  } as Stripe.Invoice;
}

/**
 * Create a mock Stripe payment intent object
 */
export function createStripePaymentIntentMock(
  overrides: Partial<Stripe.PaymentIntent> = {},
): Stripe.PaymentIntent {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `pi_${Math.random().toString(36).substring(7)}`,
    object: 'payment_intent',
    amount: 999,
    amount_capturable: 0,
    amount_details: {
      tip: {},
    },
    amount_received: 999,
    application: null,
    application_fee_amount: null,
    automatic_payment_methods: null,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: 'automatic',
    client_secret: 'pi_test_secret',
    confirmation_method: 'automatic',
    created: now,
    currency: 'usd',
    customer: `cus_${Math.random().toString(36).substring(7)}`,
    description: null,
    invoice: null,
    last_payment_error: null,
    latest_charge: `ch_${Math.random().toString(36).substring(7)}`,
    livemode: false,
    metadata: {},
    next_action: null,
    on_behalf_of: null,
    payment_method: `pm_${Math.random().toString(36).substring(7)}`,
    payment_method_configuration_details: null,
    payment_method_options: {},
    payment_method_types: ['card'],
    processing: null,
    receipt_email: null,
    review: null,
    setup_future_usage: null,
    shipping: null,
    source: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    status: 'succeeded',
    transfer_data: null,
    transfer_group: null,
    ...overrides,
  } as Stripe.PaymentIntent;
}

/**
 * Create a mock Stripe payment method object
 */
export function createStripePaymentMethodMock(
  overrides: Partial<Stripe.PaymentMethod> = {},
): Stripe.PaymentMethod {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `pm_${Math.random().toString(36).substring(7)}`,
    object: 'payment_method',
    allow_redisplay: 'always',
    billing_details: {
      address: {
        city: null,
        country: null,
        line1: null,
        line2: null,
        postal_code: null,
        state: null,
      },
      email: null,
      name: null,
      phone: null,
    },
    card: {
      brand: 'visa',
      checks: {
        address_line1_check: null,
        address_postal_code_check: null,
        cvc_check: 'pass',
      },
      country: 'US',
      display_brand: 'visa',
      exp_month: 12,
      exp_year: 2025,
      fingerprint: 'fingerprint123',
      funding: 'credit',
      generated_from: null,
      last4: '4242',
      networks: {
        available: ['visa'],
        preferred: null,
      },
      three_d_secure_usage: {
        supported: true,
      },
      wallet: null,
    },
    created: now,
    customer: `cus_${Math.random().toString(36).substring(7)}`,
    livemode: false,
    metadata: {},
    type: 'card',
    ...overrides,
  } as Stripe.PaymentMethod;
}

/**
 * Create a mock Stripe customer object
 */
export function createStripeCustomerMock(
  overrides: Partial<Stripe.Customer> = {},
): Stripe.Customer {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `cus_${Math.random().toString(36).substring(7)}`,
    object: 'customer',
    address: null,
    balance: 0,
    created: now,
    currency: null,
    default_source: null,
    delinquent: false,
    description: null,
    discount: null,
    email: 'test@example.com',
    invoice_prefix: 'INV',
    invoice_settings: {
      custom_fields: null,
      default_payment_method: null,
      footer: null,
      rendering_options: null,
    },
    livemode: false,
    metadata: {},
    name: 'Test Customer',
    next_invoice_sequence: 1,
    phone: null,
    preferred_locales: [],
    shipping: null,
    tax_exempt: 'none',
    test_clock: null,
    ...overrides,
  } as Stripe.Customer;
}

/**
 * Create a mock Stripe dispute object
 */
export function createStripeDisputeMock(
  overrides: Partial<Stripe.Dispute> = {},
): Stripe.Dispute {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: `dp_${Math.random().toString(36).substring(7)}`,
    object: 'dispute',
    amount: 999,
    balance_transactions: [],
    charge: `ch_${Math.random().toString(36).substring(7)}`,
    created: now,
    currency: 'usd',
    evidence: {
      access_activity_log: null,
      billing_address: null,
      cancellation_policy: null,
      cancellation_policy_disclosure: null,
      cancellation_rebuttal: null,
      customer_communication: null,
      customer_email_address: null,
      customer_name: null,
      customer_purchase_ip: null,
      customer_signature: null,
      duplicate_charge_documentation: null,
      duplicate_charge_explanation: null,
      duplicate_charge_id: null,
      product_description: null,
      receipt: null,
      refund_policy: null,
      refund_policy_disclosure: null,
      refund_refusal_explanation: null,
      service_date: null,
      service_documentation: null,
      shipping_address: null,
      shipping_carrier: null,
      shipping_date: null,
      shipping_documentation: null,
      shipping_tracking_number: null,
      uncategorized_file: null,
      uncategorized_text: null,
    },
    evidence_details: {
      due_by: now + 86400 * 7,
      has_evidence: false,
      past_due: false,
      submission_count: 0,
    },
    is_charge_refundable: true,
    livemode: false,
    metadata: {},
    network_reason_code: null,
    payment_intent: `pi_${Math.random().toString(36).substring(7)}`,
    payment_method_details: null,
    reason: 'fraudulent',
    status: 'warning_needs_response',
    ...overrides,
  } as Stripe.Dispute;
}

/**
 * Create a subscription created event
 */
export function createSubscriptionCreatedEventMock(
  subscriptionOverrides: Partial<Stripe.Subscription> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const subscription = createStripeSubscriptionMock(subscriptionOverrides);
  return createStripeEventMock(
    'customer.subscription.created',
    subscription,
    eventOverrides,
  );
}

/**
 * Create a subscription updated event
 */
export function createSubscriptionUpdatedEventMock(
  subscriptionOverrides: Partial<Stripe.Subscription> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const subscription = createStripeSubscriptionMock(subscriptionOverrides);
  return createStripeEventMock(
    'customer.subscription.updated',
    subscription,
    eventOverrides,
  );
}

/**
 * Create a subscription deleted event
 */
export function createSubscriptionDeletedEventMock(
  subscriptionOverrides: Partial<Stripe.Subscription> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const subscription = createStripeSubscriptionMock({
    status: 'canceled',
    canceled_at: Math.floor(Date.now() / 1000),
    ...subscriptionOverrides,
  });
  return createStripeEventMock(
    'customer.subscription.deleted',
    subscription,
    eventOverrides,
  );
}

/**
 * Create an invoice payment succeeded event
 */
export function createInvoicePaymentSucceededEventMock(
  invoiceOverrides: Partial<Stripe.Invoice> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const invoice = createStripeInvoiceMock({
    status: 'paid',
    ...invoiceOverrides,
  });
  return createStripeEventMock(
    'invoice.payment_succeeded',
    invoice,
    eventOverrides,
  );
}

/**
 * Create an invoice payment failed event
 */
export function createInvoicePaymentFailedEventMock(
  invoiceOverrides: Partial<Stripe.Invoice> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const invoice = createStripeInvoiceMock({
    status: 'open',
    attempted: true,
    ...invoiceOverrides,
  });
  return createStripeEventMock(
    'invoice.payment_failed',
    invoice,
    eventOverrides,
  );
}

/**
 * Create a payment intent succeeded event
 */
export function createPaymentIntentSucceededEventMock(
  paymentIntentOverrides: Partial<Stripe.PaymentIntent> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const paymentIntent = createStripePaymentIntentMock({
    status: 'succeeded',
    ...paymentIntentOverrides,
  });
  return createStripeEventMock(
    'payment_intent.succeeded',
    paymentIntent,
    eventOverrides,
  );
}

/**
 * Create a payment intent failed event
 */
export function createPaymentIntentFailedEventMock(
  paymentIntentOverrides: Partial<Stripe.PaymentIntent> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const paymentIntent = createStripePaymentIntentMock({
    status: 'requires_payment_method',
    last_payment_error: {
      code: 'card_declined',
      message: 'Your card was declined.',
      type: 'card_error',
    },
    ...paymentIntentOverrides,
  });
  return createStripeEventMock(
    'payment_intent.payment_failed',
    paymentIntent,
    eventOverrides,
  );
}

/**
 * Create a payment method attached event
 */
export function createPaymentMethodAttachedEventMock(
  paymentMethodOverrides: Partial<Stripe.PaymentMethod> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const paymentMethod = createStripePaymentMethodMock(paymentMethodOverrides);
  return createStripeEventMock(
    'payment_method.attached',
    paymentMethod,
    eventOverrides,
  );
}

/**
 * Create a payment method detached event
 */
export function createPaymentMethodDetachedEventMock(
  paymentMethodOverrides: Partial<Stripe.PaymentMethod> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const paymentMethod = createStripePaymentMethodMock({
    customer: null,
    ...paymentMethodOverrides,
  });
  return createStripeEventMock(
    'payment_method.detached',
    paymentMethod,
    eventOverrides,
  );
}

/**
 * Create a customer updated event
 */
export function createCustomerUpdatedEventMock(
  customerOverrides: Partial<Stripe.Customer> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const customer = createStripeCustomerMock(customerOverrides);
  return createStripeEventMock('customer.updated', customer, eventOverrides);
}

/**
 * Create a dispute created event
 */
export function createDisputeCreatedEventMock(
  disputeOverrides: Partial<Stripe.Dispute> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const dispute = createStripeDisputeMock(disputeOverrides);
  return createStripeEventMock(
    'charge.dispute.created',
    dispute,
    eventOverrides,
  );
}

/**
 * Create a dispute closed event
 */
export function createDisputeClosedEventMock(
  disputeOverrides: Partial<Stripe.Dispute> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const dispute = createStripeDisputeMock({
    status: 'won',
    ...disputeOverrides,
  });
  return createStripeEventMock(
    'charge.dispute.closed',
    dispute,
    eventOverrides,
  );
}

/**
 * Create a trial will end event
 */
export function createTrialWillEndEventMock(
  subscriptionOverrides: Partial<Stripe.Subscription> = {},
  eventOverrides: Partial<Stripe.Event> = {},
): Stripe.Event {
  const now = Math.floor(Date.now() / 1000);
  const subscription = createStripeSubscriptionMock({
    status: 'trialing',
    trial_end: now + 86400 * 3, // Trial ends in 3 days
    trial_start: now - 86400 * 11, // Trial started 11 days ago (14-day trial)
    ...subscriptionOverrides,
  });
  return createStripeEventMock(
    'customer.subscription.trial_will_end',
    subscription,
    eventOverrides,
  );
}

/**
 * Create a mock Stripe instance
 */
export function createStripeMock() {
  return {
    webhooks: {
      constructEvent: jest.fn(),
    },
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      del: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      confirm: jest.fn(),
      cancel: jest.fn(),
    },
    paymentMethods: {
      attach: jest.fn(),
      detach: jest.fn(),
      list: jest.fn(),
    },
    invoices: {
      retrieve: jest.fn(),
      list: jest.fn(),
    },
  };
}
