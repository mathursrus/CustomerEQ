-- Issue #524: Switch member identifier kind (direction-agnostic engine, Slice 1).
-- Adds the migration batch / mapping / old-key-usage tables, the two supporting
-- enums, and Brand.activeMigrationId (fast-lookup pointer to the one non-terminal
-- migration). Additive only — no changes to existing Member/Brand identifier shape.

-- CreateEnum
CREATE TYPE "MemberIdentifierMigrationStatus" AS ENUM ('PENDING_VALIDATION', 'VALIDATED', 'PROCESSING', 'REKEY_COMPLETE_IN_GRACE', 'GRACE_EXPIRED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MigrationOldKeyIngress" AS ENUM ('PUBLIC_SURVEY_RESPOND', 'API_MEMBERS_ENROLL', 'DISTRIBUTION_BATCH');

-- AlterTable
ALTER TABLE "brands" ADD COLUMN     "activeMigrationId" TEXT;

-- CreateTable
CREATE TABLE "member_identifier_migrations" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "fromKind" "MemberIdentifierKind" NOT NULL,
    "toKind" "MemberIdentifierKind" NOT NULL,
    "status" "MemberIdentifierMigrationStatus" NOT NULL DEFAULT 'PENDING_VALIDATION',
    "totalMembers" INTEGER NOT NULL DEFAULT 0,
    "processedMembers" INTEGER NOT NULL DEFAULT 0,
    "failedMembers" INTEGER NOT NULL DEFAULT 0,
    "reconciledMembers" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "attestedByClerkUserId" TEXT,
    "attestationText" TEXT,
    "attestedAt" TIMESTAMP(3),
    "rekeyCompletedAt" TIMESTAMP(3),
    "graceExpiresAt" TIMESTAMP(3),
    "graceExtensions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "member_identifier_migrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_identifier_migration_mappings" (
    "id" TEXT NOT NULL,
    "migrationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "oldExternalId" TEXT NOT NULL,
    "newExternalId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "errorReason" TEXT,

    CONSTRAINT "member_identifier_migration_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_identifier_migration_old_key_usage" (
    "id" TEXT NOT NULL,
    "migrationId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "ingress" "MigrationOldKeyIngress" NOT NULL,
    "dayBucket" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "member_identifier_migration_old_key_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_identifier_migrations_brandId_status_idx" ON "member_identifier_migrations"("brandId", "status");

-- CreateIndex
CREATE INDEX "member_identifier_migration_mappings_migrationId_appliedAt_idx" ON "member_identifier_migration_mappings"("migrationId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "member_identifier_migration_mappings_migrationId_memberId_key" ON "member_identifier_migration_mappings"("migrationId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "member_identifier_migration_mappings_migrationId_oldExterna_key" ON "member_identifier_migration_mappings"("migrationId", "oldExternalId");

-- CreateIndex
CREATE INDEX "member_identifier_migration_old_key_usage_brandId_migration_idx" ON "member_identifier_migration_old_key_usage"("brandId", "migrationId", "dayBucket");

-- CreateIndex
CREATE UNIQUE INDEX "member_identifier_migration_old_key_usage_migrationId_ingre_key" ON "member_identifier_migration_old_key_usage"("migrationId", "ingress", "dayBucket");

-- CreateIndex
CREATE UNIQUE INDEX "brands_activeMigrationId_key" ON "brands"("activeMigrationId");

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_activeMigrationId_fkey" FOREIGN KEY ("activeMigrationId") REFERENCES "member_identifier_migrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_identifier_migrations" ADD CONSTRAINT "member_identifier_migrations_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_identifier_migration_mappings" ADD CONSTRAINT "member_identifier_migration_mappings_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "member_identifier_migrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_identifier_migration_mappings" ADD CONSTRAINT "member_identifier_migration_mappings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_identifier_migration_old_key_usage" ADD CONSTRAINT "member_identifier_migration_old_key_usage_migrationId_fkey" FOREIGN KEY ("migrationId") REFERENCES "member_identifier_migrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
