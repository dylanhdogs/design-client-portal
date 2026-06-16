-- AlterTable
ALTER TABLE "checklist_items" ADD COLUMN "verification_status" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "checklist_items" ADD COLUMN "submitted_at" DATETIME;
ALTER TABLE "checklist_items" ADD COLUMN "submitted_by" TEXT;
ALTER TABLE "checklist_items" ADD COLUMN "verified_at" DATETIME;
ALTER TABLE "checklist_items" ADD COLUMN "verified_by" TEXT;
ALTER TABLE "checklist_items" ADD COLUMN "rejection_reason" TEXT;

-- Backfill already completed items as approved so existing data keeps its meaning.
UPDATE "checklist_items"
SET "verification_status" = 'APPROVED',
    "verified_at" = "completed_at",
    "verified_by" = "completed_by"
WHERE "is_completed" = 1;
