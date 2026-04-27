-- Issue #170: Onboarding & First-Run Experience — shared spine
-- Single migration per RFC §2.5: adds OnboardingState + OnboardingActivationEvent,
-- new Brand columns + relation, OrgSizeCategory / UseCasePath / OnboardingStep enums,
-- APPLICATION value on ExternalSourceType, ApiKey.externalSignalSourceId.
-- Includes idempotent backfill for existing brands.

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "OrgSizeCategory" AS ENUM (
  'SIZE_1_10',
  'SIZE_11_50',
  'SIZE_51_200',
  'SIZE_201_PLUS',
  'PREFER_NOT_TO_SAY'
);

CREATE TYPE "UseCasePath" AS ENUM (
  'api',
  'site',
  'apps',
  'skipped'
);

CREATE TYPE "OnboardingStep" AS ENUM (
  'account_created',
  'org_profile_completed',
  'path_chosen',
  'data_source_connected',
  'first_event_received',
  'first_survey_published',
  'program_created',
  'first_action_triggered',
  'activated'
);

ALTER TYPE "ExternalSourceType" ADD VALUE 'APPLICATION';

-- ── Brand: new columns + default-theme FK ────────────────────────────────────

ALTER TABLE "brands"
  ADD COLUMN "siteDomain"     TEXT,
  ADD COLUMN "logoUrl"        TEXT,
  ADD COLUMN "defaultThemeId" TEXT,
  ADD COLUMN "sizeCategory"   "OrgSizeCategory";

ALTER TABLE "brands"
  ADD CONSTRAINT "brands_defaultThemeId_fkey"
  FOREIGN KEY ("defaultThemeId")
  REFERENCES "survey_themes"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- ── ApiKey: per-app linkage (OD-2; #173 consumes) ────────────────────────────

ALTER TABLE "api_keys"
  ADD COLUMN "externalSignalSourceId" TEXT;

ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_externalSignalSourceId_fkey"
  FOREIGN KEY ("externalSignalSourceId")
  REFERENCES "external_signal_sources"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "api_keys_externalSignalSourceId_idx"
  ON "api_keys"("externalSignalSourceId");

-- ── OnboardingState: 1:1 with Brand ──────────────────────────────────────────

CREATE TABLE "onboarding_state" (
  "id"                  TEXT             NOT NULL,
  "brandId"             TEXT             NOT NULL,
  "useCasePath"         "UseCasePath",
  "checklist"           JSONB            NOT NULL DEFAULT '{}'::jsonb,
  "dismissedByUserIds"  TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "invitedAdminUserIds" TEXT[]           NOT NULL DEFAULT ARRAY[]::TEXT[],
  "activatedAt"         TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "onboarding_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_state_brandId_key" ON "onboarding_state"("brandId");
CREATE INDEX "onboarding_state_activatedAt_idx" ON "onboarding_state"("activatedAt");

ALTER TABLE "onboarding_state"
  ADD CONSTRAINT "onboarding_state_brandId_fkey"
  FOREIGN KEY ("brandId")
  REFERENCES "brands"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- ── OnboardingActivationEvent: append-only funnel events ─────────────────────

CREATE TABLE "onboarding_activation_events" (
  "id"           TEXT            NOT NULL,
  "brandId"      TEXT            NOT NULL,
  "step"         "OnboardingStep" NOT NULL,
  "previousStep" "OnboardingStep",
  "occurredAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dwellMs"     INTEGER,
  "metadata"     JSONB           NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "onboarding_activation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "onboarding_activation_events_brandId_occurredAt_idx"
  ON "onboarding_activation_events"("brandId", "occurredAt");
CREATE INDEX "onboarding_activation_events_step_occurredAt_idx"
  ON "onboarding_activation_events"("step", "occurredAt");

ALTER TABLE "onboarding_activation_events"
  ADD CONSTRAINT "onboarding_activation_events_brandId_fkey"
  FOREIGN KEY ("brandId")
  REFERENCES "brands"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- ── Backfill: every existing Brand gets a baseline OnboardingState row +
--    one account_created activation event. Idempotent on brandId uniqueness;
--    re-running this section is safe (ON CONFLICT DO NOTHING).
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO "onboarding_state" ("id", "brandId", "checklist", "createdAt", "updatedAt")
SELECT
  'os_' || substr(md5(random()::text || b."id"), 1, 24),
  b."id",
  '{"brandCreated": true, "dataSourceConnected": false, "firstEventReceived": false, "firstSurveyLive": false, "firstActionTriggered": false, "programCreated": false}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "brands" b
ON CONFLICT ("brandId") DO NOTHING;

INSERT INTO "onboarding_activation_events" ("id", "brandId", "step", "occurredAt", "metadata")
SELECT
  'oae_' || substr(md5(random()::text || b."id"), 1, 24),
  b."id",
  'account_created'::"OnboardingStep",
  COALESCE(b."createdAt", CURRENT_TIMESTAMP),
  '{"backfilled": true}'::jsonb
FROM "brands" b
WHERE NOT EXISTS (
  SELECT 1 FROM "onboarding_activation_events" oae
  WHERE oae."brandId" = b."id" AND oae."step" = 'account_created'
);
