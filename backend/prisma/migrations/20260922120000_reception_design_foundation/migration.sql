-- Add structured Reception activity fields and explicit ROM, agreement, handoff, and compliance review fields.
ALTER TABLE "consultations" ADD COLUMN "activity_type" TEXT NOT NULL DEFAULT 'SITE_MEETING';
ALTER TABLE "consultations" ADD COLUMN "subject" TEXT;
ALTER TABLE "consultations" ADD COLUMN "end_at" DATETIME;
ALTER TABLE "consultations" ADD COLUMN "participants" TEXT;
ALTER TABLE "consultations" ADD COLUMN "internal_followers" TEXT;
ALTER TABLE "consultations" ADD COLUMN "next_action" TEXT;
ALTER TABLE "consultations" ADD COLUMN "next_action_due_at" DATETIME;
ALTER TABLE "consultations" ADD COLUMN "cancellation_reason" TEXT;

ALTER TABLE "inquiries" ADD COLUMN "rom_status" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "rom_decision_at" DATETIME;
ALTER TABLE "inquiries" ADD COLUMN "rom_approved_by" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "design_agreement_status" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "design_agreement_accepted_at" DATETIME;
ALTER TABLE "inquiries" ADD COLUMN "design_agreement_accepted_by" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "handoff_summary" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "handoff_approved_by" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "compliance_verification_status" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "compliance_verification_checked_at" DATETIME;
ALTER TABLE "inquiries" ADD COLUMN "compliance_verification_source" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "compliance_verification_categories" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "compliance_verification_links" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "compliance_verification_reviewed_by" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "compliance_verification_reviewed_at" DATETIME;
ALTER TABLE "inquiries" ADD COLUMN "compliance_verification_notes" TEXT;
