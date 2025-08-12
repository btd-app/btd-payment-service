# BTD Payment Service

A NestJS-based microservice handling all payment and subscription operations for the BTD platform.

**Last Updated On:** 2025-08-06

## Features

- **Stripe Integration**: Complete integration with Stripe for payment processing
- **Subscription Management**: Three-tier subscription system (DISCOVER, CONNECT, COMMUNITY)
- **Payment Processing**: Handle one-time and recurring payments
- **Webhook Handling**: Process Stripe webhook events for real-time updates
- **Feature Gating**: Validate feature access based on subscription tier
- **Billing History**: Track and store all payment transactions
- **Payment Methods**: Manage customer payment methods
- **Usage Tracking**: Monitor feature usage and call statistics

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Payment Provider**: Stripe
- **Cache/Events**: Redis
- **Language**: TypeScript
- **Container**: Docker

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Stripe Account
- Docker (optional)

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd btd-payment-service
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up the database**
```bash
npx prisma migrate dev
npx prisma generate
```

## Configuration

### Environment Variables

```env
# Application
NODE_ENV=development
PORT=3004

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/btd_payment

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key

# Service URLs
ORCHESTRATOR_URL=http://localhost:3001
AUTH_SERVICE_URL=http://localhost:3003
```

## Development

### Running locally

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

### Running with Docker

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f btd-payment-service

# Stop services
docker-compose down
```

### Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## API Endpoints

### Payment Endpoints

- `GET /api/v1/payments/plans` - Get available subscription plans
- `POST /api/v1/payments/create-payment-intent` - Create payment intent
- `POST /api/v1/payments/setup-intent` - Create setup intent for saving payment method
- `GET /api/v1/payments/billing-history` - Get user's billing history
- `GET /api/v1/payments/payment-methods` - Get saved payment methods
- `DELETE /api/v1/payments/payment-methods/:id` - Delete payment method
- `POST /api/v1/payments/payment-methods/:id/set-default` - Set default payment method

### Subscription Endpoints

- `GET /api/v1/subscriptions/current` - Get current subscription
- `POST /api/v1/subscriptions` - Create new subscription
- `PUT /api/v1/subscriptions/:id` - Update subscription (upgrade/downgrade/cancel)
- `DELETE /api/v1/subscriptions/:id` - Cancel subscription immediately
- `POST /api/v1/subscriptions/checkout-session` - Create Stripe Checkout session
- `POST /api/v1/subscriptions/portal-session` - Create Stripe Portal session
- `GET /api/v1/subscriptions/features` - Get subscription features
- `POST /api/v1/subscriptions/validate-feature` - Validate feature access
- `GET /api/v1/subscriptions/call-usage` - Get call usage statistics
- `POST /api/v1/subscriptions/track-usage` - Track feature usage

### Webhook Endpoints

- `POST /api/v1/webhooks/stripe` - Handle Stripe webhook events

### Health Check

- `GET /health` - Service health status

## Subscription Tiers

### DISCOVER ($9.99/month)
- Basic matching algorithm
- 10 daily likes
- 3 profile photos
- Basic search filters
- Community forum read access

### CONNECT ($19.99/month)
- Everything in DISCOVER
- 50 daily likes
- 6 profile photos
- Advanced search filters
- See who liked you
- Audio calls (30 min)
- Voice messages
- Travel mode
- 3 profile boosts/month
- Message read receipts
- Priority support

### COMMUNITY ($39.99/month)
- Everything in CONNECT
- Unlimited likes
- 10 profile photos
- Video intro on profile
- Video calls (120 min)
- Screen sharing
- Call recording
- Group calls (8 participants)
- Video messages
- 10 profile boosts/month
- Incognito mode
- Advanced analytics
- Profile verification badge
- VIP forum access
- Exclusive events
- AI coaching
- VIP support

## Webhook Events

The service processes the following Stripe webhook events:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.trial_will_end`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `payment_method.attached`
- `payment_method.detached`
- `charge.dispute.created`
- `charge.dispute.closed`

## Database Schema

### Core Models

- **UserSubscription**: Main subscription tracking
- **PaymentIntent**: Payment intent tracking
- **BillingHistory**: Invoice and payment history
- **WebhookEvent**: Webhook event tracking
- **PaymentMethod**: Customer payment methods
- **CallUsageStats**: Call usage statistics
- **FeatureUsage**: Feature usage analytics

## Event Publishing

The service publishes the following events to Redis:

- `payment:subscription.created`
- `payment:subscription.updated`
- `payment:subscription.cancelled`
- `payment:payment.succeeded`
- `payment:payment.failed`
- `payment:feature.access_granted`
- `payment:feature.access_revoked`
- `payment:trial.ending`

## Security

- JWT authentication for API endpoints
- Webhook signature verification for Stripe events
- Rate limiting on all endpoints
- Secure payment processing via Stripe
- No storage of sensitive payment information

## Monitoring

- Health check endpoint
- Structured logging with Winston
- Error tracking and reporting
- Performance metrics
- Usage analytics

## Deployment

### Production Checklist

1. Set secure environment variables
2. Configure Stripe webhook endpoint in Stripe Dashboard
3. Set up database backups
4. Configure Redis persistence
5. Set up monitoring and alerting
6. Configure rate limiting
7. Enable HTTPS
8. Set up log aggregation

### Docker Deployment

```bash
# Build production image
docker build -t btd-payment-service:latest .

# Run with environment file
docker run -d \
  --name btd-payment-service \
  --env-file .env.production \
  -p 3004:3004 \
  btd-payment-service:latest
```

## Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Ensure STRIPE_WEBHOOK_SECRET matches the secret from Stripe Dashboard
   - Check that raw body middleware is configured correctly

2. **Database connection errors**
   - Verify DATABASE_URL is correct
   - Check PostgreSQL is running and accessible
   - Run migrations: `npx prisma migrate deploy`

3. **Redis connection errors**
   - Verify Redis is running
   - Check REDIS_HOST and REDIS_PORT configuration

4. **Stripe API errors**
   - Verify STRIPE_SECRET_KEY is valid
   - Check Stripe account status
   - Ensure price IDs exist in Stripe Dashboard

## Support

For issues or questions, please contact the development team or create an issue in the repository.

## License

Proprietary - All rights reserved