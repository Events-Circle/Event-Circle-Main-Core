-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'HOT', 'FOLLOW_UP', 'QUALIFIED', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "core_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "notificationPreferences" JSONB NOT NULL DEFAULT '{"email":false,"push":false}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_refresh_tokens" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_consents" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT NOT NULL,
    "features" TEXT[],
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_audit_logs" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_memberships" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'VIEWER',

    CONSTRAINT "core_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_suppliers" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "businessName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "serviceAreas" TEXT[],
    "acceptInquiries" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "core_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_outbox_events" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "core_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence_profiles" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presence_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_opportunities" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'DIRECT',
    "campaign" TEXT,
    "contactConsent" BOOLEAN NOT NULL,
    "contactConsentVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "core_users_email_key" ON "core_users"("email");

-- CreateIndex
CREATE INDEX "core_sessions_userId_revokedAt_idx" ON "core_sessions"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "core_refresh_tokens_tokenHash_key" ON "core_refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "core_consents_userId_purpose_recordedAt_idx" ON "core_consents"("userId", "purpose", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "core_subscriptions_providerReference_key" ON "core_subscriptions"("providerReference");

-- CreateIndex
CREATE INDEX "core_subscriptions_userId_status_endsAt_idx" ON "core_subscriptions"("userId", "status", "endsAt");

-- CreateIndex
CREATE INDEX "core_notifications_userId_createdAt_idx" ON "core_notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "core_audit_logs_actorId_createdAt_idx" ON "core_audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "core_memberships_userId_organizationId_key" ON "core_memberships"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "core_suppliers_organizationId_key" ON "core_suppliers"("organizationId");

-- CreateIndex
CREATE INDEX "core_outbox_events_deliveredAt_createdAt_idx" ON "core_outbox_events"("deliveredAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "presence_profiles_supplierId_key" ON "presence_profiles"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "presence_profiles_slug_key" ON "presence_profiles"("slug");

-- CreateIndex
CREATE INDEX "lead_opportunities_organizationId_createdAt_idx" ON "lead_opportunities"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "core_sessions" ADD CONSTRAINT "core_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_refresh_tokens" ADD CONSTRAINT "core_refresh_tokens_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "core_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_consents" ADD CONSTRAINT "core_consents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_subscriptions" ADD CONSTRAINT "core_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_notifications" ADD CONSTRAINT "core_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_memberships" ADD CONSTRAINT "core_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_memberships" ADD CONSTRAINT "core_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_suppliers" ADD CONSTRAINT "core_suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core_organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
