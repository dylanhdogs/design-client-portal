-- CreateTable
CREATE TABLE "design_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT NOT NULL,
    "requirements" TEXT,
    "site_information" TEXT,
    "change_summary" TEXT,
    "material_change" BOOLEAN NOT NULL DEFAULT false,
    "cost_impact" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "schedule_impact" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" DATETIME,
    "approved_by" TEXT,
    CONSTRAINT "design_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "design_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "design_versions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scope_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "inclusions" TEXT NOT NULL,
    "exclusions" TEXT,
    "allowances" TEXT,
    "estimate_amount" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "change_summary" TEXT,
    "material_change" BOOLEAN NOT NULL DEFAULT false,
    "schedule_impact" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" DATETIME,
    "approved_by" TEXT,
    CONSTRAINT "scope_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "scope_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "scope_versions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "document_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "requirement_id" TEXT,
    "design_version_id" TEXT,
    "scope_version_id" TEXT,
    "work_item_id" TEXT,
    "purpose" TEXT NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "evidence_links_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_design_version_id_fkey" FOREIGN KEY ("design_version_id") REFERENCES "design_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_scope_version_id_fkey" FOREIGN KEY ("scope_version_id") REFERENCES "scope_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "decision_id" TEXT,
    "gate_id" TEXT,
    "design_version_id" TEXT,
    "scope_version_id" TEXT,
    "approval_type" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "comment" TEXT,
    "idempotency_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approvals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "project_gates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_design_version_id_fkey" FOREIGN KEY ("design_version_id") REFERENCES "design_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_scope_version_id_fkey" FOREIGN KEY ("scope_version_id") REFERENCES "scope_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_approvals" ("approval_type", "approver_id", "comment", "created_at", "decision_id", "gate_id", "id", "idempotency_key", "organization_id", "project_id", "result") SELECT "approval_type", "approver_id", "comment", "created_at", "decision_id", "gate_id", "id", "idempotency_key", "organization_id", "project_id", "result" FROM "approvals";
DROP TABLE "approvals";
ALTER TABLE "new_approvals" RENAME TO "approvals";
CREATE UNIQUE INDEX "approvals_idempotency_key_key" ON "approvals"("idempotency_key");
CREATE INDEX "approvals_project_id_idx" ON "approvals"("project_id");
CREATE INDEX "approvals_decision_id_idx" ON "approvals"("decision_id");
CREATE INDEX "approvals_gate_id_idx" ON "approvals"("gate_id");
CREATE INDEX "approvals_design_version_id_idx" ON "approvals"("design_version_id");
CREATE INDEX "approvals_scope_version_id_idx" ON "approvals"("scope_version_id");
CREATE INDEX "approvals_organization_id_project_id_idx" ON "approvals"("organization_id", "project_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "design_versions_project_id_idx" ON "design_versions"("project_id");

-- CreateIndex
CREATE INDEX "design_versions_organization_id_project_id_idx" ON "design_versions"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "design_versions_project_id_version_number_key" ON "design_versions"("project_id", "version_number");

-- CreateIndex
CREATE INDEX "scope_versions_project_id_idx" ON "scope_versions"("project_id");

-- CreateIndex
CREATE INDEX "scope_versions_organization_id_project_id_idx" ON "scope_versions"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "scope_versions_project_id_version_number_key" ON "scope_versions"("project_id", "version_number");

-- CreateIndex
CREATE INDEX "evidence_links_project_id_stage_idx" ON "evidence_links"("project_id", "stage");

-- CreateIndex
CREATE INDEX "evidence_links_requirement_id_is_current_idx" ON "evidence_links"("requirement_id", "is_current");

-- CreateIndex
CREATE INDEX "evidence_links_document_id_idx" ON "evidence_links"("document_id");

-- CreateIndex
CREATE INDEX "evidence_links_design_version_id_idx" ON "evidence_links"("design_version_id");

-- CreateIndex
CREATE INDEX "evidence_links_scope_version_id_idx" ON "evidence_links"("scope_version_id");

-- CreateIndex
CREATE INDEX "evidence_links_work_item_id_idx" ON "evidence_links"("work_item_id");

-- CreateIndex
CREATE INDEX "evidence_links_organization_id_project_id_idx" ON "evidence_links"("organization_id", "project_id");
