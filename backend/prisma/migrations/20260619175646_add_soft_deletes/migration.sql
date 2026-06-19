-- AlterTable
ALTER TABLE "clients" ADD COLUMN "deleted_at" DATETIME;

-- AlterTable
ALTER TABLE "communications" ADD COLUMN "deleted_at" DATETIME;

-- AlterTable
ALTER TABLE "consultations" ADD COLUMN "deleted_at" DATETIME;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "deleted_at" DATETIME;
