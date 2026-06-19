-- AlterTable
ALTER TABLE "users" ADD COLUMN "reset_token" TEXT;
ALTER TABLE "users" ADD COLUMN "reset_token_expires" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");
