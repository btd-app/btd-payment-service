-- CreateEnum
CREATE TYPE "public"."SubscriptionTier" AS ENUM ('DISCOVER', 'CONNECT', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED', 'PAST_DUE', 'TRIALING', 'UNPAID', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('requires_payment_method', 'requires_confirmation', 'requires_action', 'processing', 'requires_capture', 'canceled', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('draft', 'open', 'paid', 'uncollectible', 'void');

-- CreateTable
CREATE TABLE "public"."UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionTier" "public"."SubscriptionTier" NOT NULL DEFAULT 'DISCOVER',
    "stripeSubscriptionId" TEXT,
    "stripeCustomerId" TEXT,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "planId" TEXT,
    "trialEnd" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "public"."PaymentStatus" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" "public"."InvoiceStatus" NOT NULL,
    "description" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "invoiceUrl" TEXT,
    "receiptUrl" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookEvent" (
    "id" TEXT NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "last4" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CallUsageStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "videoCalls" INTEGER NOT NULL DEFAULT 0,
    "audioCalls" INTEGER NOT NULL DEFAULT 0,
    "avgCallDuration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "callsInitiated" INTEGER NOT NULL DEFAULT 0,
    "callsReceived" INTEGER NOT NULL DEFAULT 0,
    "lastCallAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallUsageStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeatureUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "public"."UserSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_stripeSubscriptionId_key" ON "public"."UserSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "UserSubscription_status_idx" ON "public"."UserSubscription"("status");

-- CreateIndex
CREATE INDEX "UserSubscription_userId_idx" ON "public"."UserSubscription"("userId");

-- CreateIndex
CREATE INDEX "UserSubscription_currentPeriodEnd_idx" ON "public"."UserSubscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentIntent_stripePaymentIntentId_key" ON "public"."PaymentIntent"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "PaymentIntent_status_idx" ON "public"."PaymentIntent"("status");

-- CreateIndex
CREATE INDEX "PaymentIntent_userId_idx" ON "public"."PaymentIntent"("userId");

-- CreateIndex
CREATE INDEX "PaymentIntent_stripePaymentIntentId_idx" ON "public"."PaymentIntent"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingHistory_stripeInvoiceId_key" ON "public"."BillingHistory"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "BillingHistory_userId_idx" ON "public"."BillingHistory"("userId");

-- CreateIndex
CREATE INDEX "BillingHistory_createdAt_idx" ON "public"."BillingHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_stripeEventId_key" ON "public"."WebhookEvent"("stripeEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "public"."WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_type_idx" ON "public"."WebhookEvent"("type");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "public"."WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON "public"."PaymentMethod"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "public"."PaymentMethod"("userId");

-- CreateIndex
CREATE INDEX "CallUsageStats_userId_idx" ON "public"."CallUsageStats"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CallUsageStats_userId_month_year_key" ON "public"."CallUsageStats"("userId", "month", "year");

-- CreateIndex
CREATE INDEX "FeatureUsage_userId_idx" ON "public"."FeatureUsage"("userId");

-- CreateIndex
CREATE INDEX "FeatureUsage_feature_idx" ON "public"."FeatureUsage"("feature");

-- CreateIndex
CREATE INDEX "FeatureUsage_createdAt_idx" ON "public"."FeatureUsage"("createdAt");
