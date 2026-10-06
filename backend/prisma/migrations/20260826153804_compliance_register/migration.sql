-- CreateTable
CREATE TABLE "compliance_requirements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "property_id" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "external_agency" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "owner_id" TEXT,
    "reviewer_id" TEXT,
    "due_at" DATETIME,
    "submitted_at" DATETIME,
    "external_response_at" DATETIME,
    "evidence_required" BOOLEAN NOT NULL DEFAULT false,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "rejection_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "compliance_requirements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "compliance_requirements_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "compliance_requirements_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "compliance_requirements_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "compliance_exceptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "requirement_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "mitigation" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "due_at" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approved_by" TEXT,
    "approved_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "compliance_exceptions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "compliance_exceptions_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "compliance_requirements" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "compliance_exceptions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "compliance_exceptions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_evidence_links" (
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
    CONSTRAINT "evidence_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "evidence_links_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "compliance_requirements" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_evidence_links" ("created_at", "created_by", "design_version_id", "document_id", "id", "is_current", "organization_id", "project_id", "purpose", "requirement_id", "scope_version_id", "stage", "work_item_id") SELECT "created_at", "created_by", "design_version_id", "document_id", "id", "is_current", "organization_id", "project_id", "purpose", "requirement_id", "scope_version_id", "stage", "work_item_id" FROM "evidence_links";
DROP TABLE "evidence_links";
ALTER TABLE "new_evidence_links" RENAME TO "evidence_links";
CREATE INDEX "evidence_links_project_id_stage_idx" ON "evidence_links"("project_id", "stage");
CREATE INDEX "evidence_links_requirement_id_is_current_idx" ON "evidence_links"("requirement_id", "is_current");
CREATE INDEX "evidence_links_document_id_idx" ON "evidence_links"("document_id");
CREATE INDEX "evidence_links_design_version_id_idx" ON "evidence_links"("design_version_id");
CREATE INDEX "evidence_links_scope_version_id_idx" ON "evidence_links"("scope_version_id");
CREATE INDEX "evidence_links_work_item_id_idx" ON "evidence_links"("work_item_id");
CREATE INDEX "evidence_links_organization_id_project_id_idx" ON "evidence_links"("organization_id", "project_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "compliance_requirements_project_id_idx" ON "compliance_requirements"("project_id");

-- CreateIndex
CREATE INDEX "compliance_requirements_property_id_idx" ON "compliance_requirements"("property_id");

-- CreateIndex
CREATE INDEX "compliance_requirements_owner_id_idx" ON "compliance_requirements"("owner_id");

-- CreateIndex
CREATE INDEX "compliance_requirements_status_idx" ON "compliance_requirements"("status");

-- CreateIndex
CREATE INDEX "compliance_requirements_due_at_idx" ON "compliance_requirements"("due_at");

-- CreateIndex
CREATE INDEX "compliance_requirements_organization_id_status_idx" ON "compliance_requirements"("organization_id", "status");

-- CreateIndex
CREATE INDEX "compliance_exceptions_project_id_idx" ON "compliance_exceptions"("project_id");

-- CreateIndex
CREATE INDEX "compliance_exceptions_requirement_id_idx" ON "compliance_exceptions"("requirement_id");

-- CreateIndex
CREATE INDEX "compliance_exceptions_status_idx" ON "compliance_exceptions"("status");

-- CreateIndex
CREATE INDEX "compliance_exceptions_organization_id_project_id_idx" ON "compliance_exceptions"("organization_id", "project_id");
