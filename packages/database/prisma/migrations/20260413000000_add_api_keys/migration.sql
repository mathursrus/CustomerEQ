-- Developer-facing API keys for the /admin/developer page.
-- Introduced in #141 (feature implementation) but the schema change
-- was originally applied to local Postgres only via raw SQL, which
-- broke prod auth for any X-Api-Key caller until this migration landed.

CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_keyHash_key" ON "api_keys"("keyHash");
CREATE INDEX IF NOT EXISTS "api_keys_brandId_revokedAt_idx" ON "api_keys"("brandId", "revokedAt");

-- FK to brands (safe even if the table already exists from the earlier
-- local raw-SQL path — IF NOT EXISTS on DO block).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_brandId_fkey'
    ) THEN
        ALTER TABLE "api_keys"
            ADD CONSTRAINT "api_keys_brandId_fkey"
            FOREIGN KEY ("brandId") REFERENCES "brands"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END$$;
