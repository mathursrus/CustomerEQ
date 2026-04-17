-- Align legacy mcp_oauth_codes table columns with the Prisma model.
-- Some local databases were created with snake_case columns from an earlier
-- draft migration. The application now uses camelCase column names.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'brand_id'
  ) THEN
    ALTER TABLE "mcp_oauth_codes" RENAME COLUMN "brand_id" TO "brandId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'clerk_user_id'
  ) THEN
    ALTER TABLE "mcp_oauth_codes" RENAME COLUMN "clerk_user_id" TO "clerkUserId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE "mcp_oauth_codes" RENAME COLUMN "client_id" TO "clientId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'redirect_uri'
  ) THEN
    ALTER TABLE "mcp_oauth_codes" RENAME COLUMN "redirect_uri" TO "redirectUri";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'code_challenge'
  ) THEN
    ALTER TABLE "mcp_oauth_codes" RENAME COLUMN "code_challenge" TO "codeChallenge";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE "mcp_oauth_codes" RENAME COLUMN "expires_at" TO "expiresAt";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE "mcp_oauth_codes" RENAME COLUMN "created_at" TO "createdAt";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'used'
  ) THEN
    ALTER TABLE "mcp_oauth_codes" DROP COLUMN "used";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'codeChallengeMethod'
  ) THEN
    ALTER TABLE "mcp_oauth_codes"
      ADD COLUMN "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'usedAt'
  ) THEN
    ALTER TABLE "mcp_oauth_codes"
      ADD COLUMN "usedAt" TIMESTAMP(3);
  END IF;
END $$;

DROP INDEX IF EXISTS "mcp_oauth_codes_expires_at_idx";
CREATE INDEX IF NOT EXISTS "mcp_oauth_codes_expiresAt_idx" ON "mcp_oauth_codes"("expiresAt");
