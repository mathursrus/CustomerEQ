-- Add optional rep-sentiment tag to member notes. Drives the note modifier
-- on customer health score computation.
ALTER TABLE "member_notes" ADD COLUMN "sentiment" TEXT;
