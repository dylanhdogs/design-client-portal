-- Add explicit Reception phase evidence and handoff fields.
ALTER TABLE "inquiries" ADD COLUMN "design_inspirations" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "site_assessment" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "rom_amount" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "proposal_narrative" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "proposal_provided_at" DATETIME;
ALTER TABLE "inquiries" ADD COLUMN "proposal_client_response" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "handoff_approved_at" DATETIME;
