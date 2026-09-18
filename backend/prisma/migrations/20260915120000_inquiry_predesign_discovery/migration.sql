-- Add representative-led pre-design discovery to the existing inquiry record.
ALTER TABLE "inquiries" ADD COLUMN "discovery_data" TEXT;
ALTER TABLE "inquiries" ADD COLUMN "discovery_completed_at" DATETIME;
