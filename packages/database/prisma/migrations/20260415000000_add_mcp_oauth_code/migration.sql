-- Migration: add_mcp_oauth_code
-- Stores short-lived PKCE authorization codes issued during the MCP OAuth dance.
-- Each code is one-time use, expires in 10 minutes, and is deleted after exchange.

CREATE TABLE IF NOT EXISTS "mcp_oauth_codes" (
  "id"             TEXT          NOT NULL DEFAULT gen_random_uuid()::text,
  "code"           TEXT          NOT NULL,
  "brand_id"       TEXT          NOT NULL,
  "clerk_user_id"  TEXT          NOT NULL,
  "code_challenge" TEXT          NOT NULL,
  "client_id"      TEXT          NOT NULL,
  "redirect_uri"   TEXT          NOT NULL,
  "expires_at"     TIMESTAMPTZ   NOT NULL,
  "used"           BOOLEAN       NOT NULL DEFAULT false,
  "created_at"     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "mcp_oauth_codes_pkey" PRIMARY KEY ("id")
);

-- Unique index so token exchange can look up the code safely
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_oauth_codes_code_key" ON "mcp_oauth_codes"("code");

-- Index for efficient expiry-based cleanup
CREATE INDEX IF NOT EXISTS "mcp_oauth_codes_expires_at_idx" ON "mcp_oauth_codes"("expires_at");
