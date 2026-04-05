-- Track edit time on member notes so the UI can show "edited N ago".
ALTER TABLE "member_notes" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "member_notes" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "member_notes" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "member_notes" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
