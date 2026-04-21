-- Migration: add_mcp_oauth_code
-- Stores short-lived PKCE authorization codes issued during the MCP OAuth dance.
-- Each code is one-time use, expires in 10 minutes, and is invalidated after exchange.

CREATE TABLE IF NOT EXISTS "mcp_oauth_codes" (
  "id"                  TEXT        NOT NULL,
  "code"                TEXT        NOT NULL,
  "brandId"             TEXT        NOT NULL,
  "clerkUserId"         TEXT        NOT NULL,
  "clientId"            TEXT        NOT NULL,
  "redirectUri"         TEXT        NOT NULL,
  "codeChallenge"       TEXT        NOT NULL,
  "codeChallengeMethod" TEXT        NOT NULL DEFAULT 'S256',
  "expiresAt"           TIMESTAMP(3) NOT NULL,
  "usedAt"              TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mcp_oauth_codes_pkey" PRIMARY KEY ("id")
);

-- Unique index so token exchange can look up the code safely
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_oauth_codes_code_key" ON "mcp_oauth_codes"("code");

-- Index for efficient expiry-based cleanup. Older local databases may have
-- been created from an earlier draft using snake_case columns, so only create
-- this index when the camelCase column exists. A follow-up migration renames
-- legacy columns in place.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mcp_oauth_codes' AND column_name = 'expiresAt'
  ) THEN
    CREATE INDEX IF NOT EXISTS "mcp_oauth_codes_expiresAt_idx" ON "mcp_oauth_codes"("expiresAt");
  END IF;
END $$;
