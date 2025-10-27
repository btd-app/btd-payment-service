# BTD Payment Service - Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for the BTD Payment Service, which handles critical payment processing, subscription management, and billing operations through Stripe and Apple In-App Purchases.

**Last Updated:** 2025-10-25
**Coverage Target:** 75% global, 90%+ for critical services
**Current Status:** ✅ All critical services have comprehensive test coverage

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Coverage Requirements](#test-coverage-requirements)
3. [Test Types](#test-types)
4. [Critical Services Testing](#critical-services-testing)
5. [Testing Tools & Configuration](#testing-tools--configuration)
6. [Test Organization](#test-organization)
7. [Mock & Stub Utilities](#mock--stub-utilities)
8. [Continuous Testing](#continuous-testing)
9. [Coverage Enforcement](#coverage-enforcement)
10. [Testing Best Practices](#testing-best-practices)

---

## Testing Philosophy

### Core Principles

1. **Safety First**: Payment services require the highest level of testing rigor
2. **Complete Isolation**: All tests must run without external dependencies (databases, APIs, services)
3. **Fast Feedback**: Test suite should run in under 2 minutes
4. **Maintainability**: Tests serve as living documentation
5. **Regression Prevention**: Comprehensive test coverage prevents breaking changes

### Testing Pyramid

```
           ╱ E2E Tests (5%)
          ╱  Integration Tests (15%)
         ╱
        ╱____Unit Tests (80%)
```

- **Unit Tests (80%)**: Fast, isolated, comprehensive
- **Integration Tests (15%)**: Database, gRPC, service interactions
- **E2E Tests (5%)**: Complete payment flows

---

## Test Coverage Requirements

### Global Requirements

| Metric | Minimum | Target | Critical Services |
|--------|---------|--------|-------------------|
| Statements | 75% | 85% | 90%+ |
| Branches | 60% | 70% | 80%+ |
| Functions | 75% | 85% | 95%+ |
| Lines | 75% | 85% | 90%+ |

### File-Specific Thresholds

#### Critical Payment Services (90%+ Coverage Required)

1. **stripe.service.ts**
   - Statements: 90%
   - Branches: 80%
   - Functions: 95%
   - Lines: 90%
   - **Current: 97.8% statements** ✅

2. **payment.service.ts** (Apple IAP)
   - Statements: 90%
   - Branches: 80%
   - Functions: 95%
   - Lines: 90%
   - **Current: 98.39% statements** ✅

3. **webhook.controller.ts**
   - Statements: 85%
   - Branches: 65%
   - Functions: 85%
   - Lines: 85%
   - **Current: 95.38% statements** ✅

4. **payment-grpc.controller.ts**
   - Statements: 80%
   - Branches: 55%
   - Functions: 75%
   - Lines: 80%
   - **Current: 88.54% statements** ✅

5. **subscription.service.ts**
   - Statements: 85%
   - Branches: 75%
   - Functions: 90%
   - Lines: 85%
   - **Current: 97.59% statements** ✅

---

## Test Types

### 1. Unit Tests

**Purpose**: Test individual functions/methods in complete isolation

**Characteristics:**
- No database connections
- No external API calls
- All dependencies mocked
- Fast execution (< 100ms per test)
- Deterministic results

**Coverage:**
- All public methods
- Edge cases and error paths
- Type conversions and transformations
- Business logic validation

**Example:**
```typescript
describe('StripeService', () => {
  describe('createPaymentIntent', () => {
    it('should create payment intent successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const mockPlan = { price: 9.99, stripePriceId: 'price_123' };

      // Act
      const result = await service.createPaymentIntent(userId, 9.99, 'usd', 'plan-123');

      // Assert
      expect(result.paymentIntentId).toBeDefined();
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 999, currency: 'usd' })
      );
    });
  });
});
```

### 2. Integration Tests

**Purpose**: Test interactions between components

**Scope:**
- Database operations (with test database)
- gRPC service communication
- Redis caching
- Message queue integration

**To Be Implemented:**
- Prisma integration tests
- gRPC streaming tests
- Redis pub/sub tests
- End-to-end webhook processing

### 3. E2E Tests

**Purpose**: Test complete user journeys

**Scenarios:**
- Complete subscription purchase flow
- Payment failure and retry
- Subscription upgrade/downgrade
- Refund processing
- Webhook event processing

**To Be Implemented:**
- Subscription lifecycle tests
- Payment flow tests
- Apple IAP purchase flow

---

## Critical Services Testing

### 1. Stripe Service (stripe.service.ts)

**Test Suite:** `src/services/stripe.service.spec.ts`
**Tests:** 66 tests
**Coverage:** 97.8% statements

#### Test Coverage:

**Customer Management:**
- ✅ Create or get existing customer
- ✅ Handle missing customer scenarios
- ✅ Update customer information

**Payment Intents:**
- ✅ Create payment intents
- ✅ Handle invalid plans
- ✅ Process payment confirmations
- ✅ Handle API errors

**Subscriptions:**
- ✅ Create new subscriptions
- ✅ Update existing subscriptions
- ✅ Cancel subscriptions (immediate & at period end)
- ✅ Reactivate cancelled subscriptions

**Billing & Payment Methods:**
- ✅ Retrieve billing history
- ✅ List payment methods
- ✅ Add payment methods
- ✅ Remove payment methods
- ✅ Set default payment method

**Advanced Features:**
- ✅ Create setup intents
- ✅ Create checkout sessions
- ✅ Create billing portal sessions

### 2. Payment Service (payment.service.ts)

**Test Suite:** `src/payment/payment.service.spec.ts`
**Tests:** 61 tests
**Coverage:** 98.39% statements

#### Test Coverage:

**Apple Receipt Validation:**
- ✅ Validate new subscriptions
- ✅ Update existing subscriptions
- ✅ Handle invalid receipts
- ✅ Process consumable purchases (boosts, super likes)

**Webhook Handling:**
- ✅ DID_RENEW events
- ✅ DID_CHANGE_RENEWAL_STATUS events
- ✅ EXPIRED events
- ✅ REFUND events
- ✅ DID_FAIL_TO_RENEW events

**Subscription Management:**
- ✅ Get user subscription status
- ✅ Update subscription status
- ✅ Cancel subscriptions
- ✅ Product ID to tier mapping

**Helper Methods:**
- ✅ Format subscription data
- ✅ Get features for tier
- ✅ Grant consumable items

### 3. Webhook Controller (webhook.controller.ts)

**Test Suite:** `src/controllers/webhook.controller.spec.ts`
**Tests:** 40 tests
**Coverage:** 95.38% statements

#### Test Coverage:

**Signature Verification:**
- ✅ Missing signature rejection
- ✅ Invalid signature rejection
- ✅ Valid signature acceptance
- ✅ Raw body handling

**Subscription Events:**
- ✅ customer.subscription.created
- ✅ customer.subscription.updated
- ✅ customer.subscription.deleted

**Invoice Events:**
- ✅ invoice.payment_succeeded
- ✅ invoice.payment_failed

**Payment Intent Events:**
- ✅ payment_intent.succeeded
- ✅ payment_intent.failed

**Payment Method Events:**
- ✅ payment_method.attached
- ✅ payment_method.detached

**Helper Methods:**
- ✅ Status mapping (Stripe → Prisma)
- ✅ Tier mapping (Stripe price → Subscription tier)

### 4. Payment gRPC Controller (payment-grpc.controller.ts)

**Test Suite:** `src/grpc/payment-grpc.controller.spec.ts`
**Tests:** 63 tests
**Coverage:** 88.54% statements

#### Test Coverage:

**Subscription Operations:**
- ✅ createSubscription
- ✅ getSubscription
- ✅ updateSubscription
- ✅ cancelSubscription
- ✅ getUserSubscriptions

**Payment Operations:**
- ✅ processPayment
- ✅ getPaymentHistory
- ✅ refundPayment (stub)

**Payment Method Management:**
- ✅ addPaymentMethod
- ✅ getPaymentMethods
- ✅ removePaymentMethod
- ✅ setDefaultPaymentMethod

**Utility Operations:**
- ✅ processStripeWebhook
- ✅ getPaymentHealth
- ✅ getPricingPlans
- ✅ getInvoices
- ✅ validatePromoCode

### 5. Subscription Service (subscription.service.ts)

**Test Suite:** `src/services/subscription.service.spec.ts`
**Tests:** 59 tests
**Coverage:** 97.59% statements

#### Test Coverage:

**Feature Access:**
- ✅ Get subscription features by tier
- ✅ Validate video call access
- ✅ Validate call duration limits
- ✅ Check feature access

**Tier Management:**
- ✅ Get tier level (1-3)
- ✅ Check tier access
- ✅ Compare tier privileges

**Usage Tracking:**
- ✅ Track feature usage
- ✅ Record metadata

---

## Testing Tools & Configuration

### Test Framework

**Jest Configuration:** `jest.config.js`

```javascript
{
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': 'ts-jest' },
  coverageThresholds: {
    global: { statements: 75, branches: 60, functions: 75, lines: 75 },
    // File-specific thresholds for critical services
  },
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json'],
}
```

### Mock Libraries

- **jest**: Native Jest mocking (`jest.fn()`, `jest.spyOn()`)
- **@nestjs/testing**: NestJS Test module for dependency injection
- **Custom Mocks**: Stripe, Prisma, Redis mock factories

### Coverage Tools

- **Jest Coverage**: Built-in coverage reporting
- **HTML Reports**: `coverage/index.html`
- **LCOV Format**: For CI/CD integration

---

## Test Organization

### Directory Structure

```
src/
├── services/
│   ├── stripe.service.ts
│   ├── stripe.service.spec.ts          ✅ 66 tests
│   ├── subscription.service.ts
│   └── subscription.service.spec.ts    ✅ 59 tests
├── payment/
│   ├── payment.service.ts
│   └── payment.service.spec.ts         ✅ 61 tests
├── controllers/
│   ├── webhook.controller.ts
│   └── webhook.controller.spec.ts      ✅ 40 tests
├── grpc/
│   ├── payment-grpc.controller.ts
│   └── payment-grpc.controller.spec.ts ✅ 63 tests
└── testing/
    ├── mocks/
    │   ├── stripe.mock.ts              # Stripe API mocks
    │   └── prisma.mock.ts              # Prisma client mocks
    └── stubs/
        └── payment-prisma.stub.ts      # Prisma service stub
```

### Test File Naming

- **Unit Tests:** `*.spec.ts` (co-located with source)
- **Integration Tests:** `*.integration.spec.ts`
- **E2E Tests:** `*.e2e.spec.ts`

---

## Mock & Stub Utilities

### Shared Test Utilities

**Location:** `src/testing/mocks/stripe.mock.ts`

```typescript
export function createStripeEventMock(type: string, data: any): Stripe.Event;
export function createStripeSubscriptionMock(overrides?: Partial<Stripe.Subscription>);
export function createStripeInvoiceMock(overrides?: Partial<Stripe.Invoice>);
export function createStripePaymentIntentMock(overrides?: Partial<Stripe.PaymentIntent>);
export function createStripePaymentMethodMock(overrides?: Partial<Stripe.PaymentMethod>);
```

**Location:** `src/testing/stubs/payment-prisma.stub.ts`

```typescript
export class PaymentPrismaServiceStub {
  subscription: MockSubscriptionDelegate;
  paymentIntent: MockPaymentIntentDelegate;
  billingHistory: MockBillingHistoryDelegate;
  webhookEvent: MockWebhookEventDelegate;
  // ... other models
}
```

### Creating New Mocks

1. Create mock factory function
2. Export from testing utilities
3. Use in test files with `jest.mock()`
4. Document mock behavior

---

## Continuous Testing

### Local Development

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run specific test file
npm test -- stripe.service.spec.ts

# Run tests matching pattern
npm test -- --testNamePattern="createPaymentIntent"
```

### Pre-Commit Hooks

**Recommended** (not currently enforced):
```bash
# .husky/pre-commit
npm run test:cov
```

### CI/CD Pipeline

**GitHub Actions** (to be configured):
```yaml
- name: Run Tests
  run: npm test

- name: Check Coverage
  run: npm run test:cov

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

---

## Coverage Enforcement

### Jest Thresholds

Coverage thresholds are enforced automatically by Jest. **Tests will fail** if coverage drops below configured thresholds.

```bash
$ npm run test:cov

FAIL  src/services/stripe.service.spec.ts
  ● Test suite failed to run

    Jest: Coverage for statements (89%) does not meet global threshold (90%)
```

### Monitoring Coverage

1. **Local:** HTML report at `coverage/index.html`
2. **CI/CD:** LCOV report for code coverage services
3. **Pull Requests:** Coverage diff in PR comments

---

## Testing Best Practices

### 1. Test Naming

✅ **Good:**
```typescript
it('should create payment intent when valid plan provided', () => {});
it('should throw BadRequestException when plan not found', () => {});
```

❌ **Bad:**
```typescript
it('test payment intent', () => {});
it('works correctly', () => {});
```

### 2. AAA Pattern

```typescript
it('should cancel subscription at period end', async () => {
  // Arrange
  const userId = 'user-123';
  const mockSubscription = { id: 'sub-123', status: 'ACTIVE' };
  mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);

  // Act
  const result = await service.cancelSubscription(userId);

  // Assert
  expect(result).toBeDefined();
  expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
    'sub-123',
    expect.objectContaining({ cancel_at_period_end: true })
  );
});
```

### 3. Test Isolation

- Each test should be completely independent
- Use `beforeEach` to reset state
- Clean up mocks in `afterEach`
- No shared mutable state

### 4. Mock Only What You Need

✅ **Good:**
```typescript
const mockStripe = {
  paymentIntents: { create: jest.fn() },
};
```

❌ **Bad:**
```typescript
const mockStripe = {
  // Mocking entire Stripe SDK (100+ methods)
};
```

### 5. Test Error Paths

Always test both success and failure scenarios:

```typescript
it('should create payment successfully', async () => { /* ... */ });
it('should throw error when Stripe API fails', async () => { /* ... */ });
it('should handle network timeout', async () => { /* ... */ });
it('should handle invalid input', async () => { /* ... */ });
```

### 6. Avoid Test Implementation Coupling

Test **behavior**, not **implementation details**.

✅ **Good:**
```typescript
it('should mark subscription as cancelled', async () => {
  await service.cancelSubscription('user-123');
  const subscription = await prisma.subscription.findUnique({
    where: { userId: 'user-123' }
  });
  expect(subscription.status).toBe('CANCELLED');
});
```

❌ **Bad:**
```typescript
it('should call prisma.subscription.update', async () => {
  await service.cancelSubscription('user-123');
  expect(mockPrisma.subscription.update).toHaveBeenCalled();
});
```

### 7. Use Descriptive Test Data

```typescript
const testUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
};

const testSubscription = {
  id: 'sub-456',
  userId: 'user-123',
  status: 'ACTIVE',
  tier: 'CONNECT',
};
```

---

## Future Testing Roadmap

### Phase 1: Foundation (Complete ✅)
- ✅ Unit tests for critical services
- ✅ Mock factories and stubs
- ✅ Jest configuration with thresholds
- ✅ Testing strategy documentation

### Phase 2: Integration Tests (Next)
- [ ] Prisma integration tests
- [ ] gRPC streaming tests
- [ ] Redis pub/sub tests
- [ ] Webhook integration tests

### Phase 3: E2E Tests
- [ ] Complete subscription flow
- [ ] Payment failure scenarios
- [ ] Refund processing flow
- [ ] Apple IAP purchase flow

### Phase 4: Performance & Load Testing
- [ ] Payment processing under load
- [ ] Webhook processing throughput
- [ ] Database query optimization
- [ ] gRPC service benchmarks

### Phase 5: Security Testing
- [ ] Webhook signature validation
- [ ] Payment data encryption
- [ ] SQL injection prevention
- [ ] OWASP compliance

---

## Resources

### Documentation
- [Jest Documentation](https://jestjs.io/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Stripe Testing](https://stripe.com/docs/testing)
- [TypeScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

### Internal Resources
- Mock Factories: `src/testing/mocks/`
- Test Stubs: `src/testing/stubs/`
- Coverage Reports: `coverage/index.html`

### Team Contacts
- **Test Strategy Owner:** Development Team
- **CI/CD Configuration:** DevOps Team
- **Coverage Reviews:** Tech Lead

---

## Appendix

### A. Coverage Report Example

```
File                             | % Stmts | % Branch | % Funcs | % Lines |
---------------------------------|---------|----------|---------|---------|
All files                        |   86.32 |    72.45 |   91.23 |   85.87 |
 services/stripe.service.ts      |   97.80 |    98.21 |  100.00 |   97.77 |
 services/subscription.service.ts|   97.59 |    95.83 |  100.00 |   97.53 |
 payment/payment.service.ts      |   98.39 |    91.11 |  100.00 |   98.36 |
 controllers/webhook.controller  |   95.38 |    69.87 |   93.75 |   95.31 |
 grpc/payment-grpc.controller.ts |   88.54 |    60.22 |   82.85 |   89.84 |
```

### B. Test Execution Time

```
Test Suites: 5 passed, 5 total
Tests:       289 passed, 289 total
Snapshots:   0 total
Time:        47.618 s
```

### C. Common Testing Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch

# Debug mode
npm run test:debug

# Run specific file
npm test -- stripe.service.spec.ts

# Run tests matching pattern
npm test -- --testNamePattern="payment"

# Update snapshots
npm test -- -u

# Clear cache
npm test -- --clearCache
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-25
**Status:** Living Document - Update as testing strategy evolves
