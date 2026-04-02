-- Add opt-in fields to Member for GDPR/CCPA compliance
ALTER TABLE "members" ADD COLUMN "email_opt_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "members" ADD COLUMN "sms_opt_in" BOOLEAN NOT NULL DEFAULT false;

-- Add slug to Program for human-readable enrollment URLs
ALTER TABLE "programs" ADD COLUMN "slug" VARCHAR(100);
ALTER TABLE "programs" ADD CONSTRAINT "programs_slug_key" UNIQUE ("slug");
