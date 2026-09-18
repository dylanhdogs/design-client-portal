-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN "after_state" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN "before_state" TEXT;
ALTER TABLE "activity_logs" ADD COLUMN "request_id" TEXT;

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "client_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "jurisdiction" TEXT,
    "hoa_name" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "properties_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "client_id" TEXT NOT NULL,
    "property_id" TEXT,
    "project_id" TEXT,
    "source" TEXT,
    "description" TEXT,
    "objectives" TEXT,
    "budget_expectation" TEXT,
    "desired_timing" TEXT,
    "qualification_status" TEXT NOT NULL DEFAULT 'NEW',
    "owner_id" TEXT,
    "next_action" TEXT,
    "next_action_due_at" DATETIME,
    "converted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "inquiries_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inquiries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inquiries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lifecycle_stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "owner_id" TEXT,
    "reviewer_id" TEXT,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "lifecycle_stages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lifecycle_stages_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lifecycle_stages_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TASK',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "owner_id" TEXT,
    "reviewer_id" TEXT,
    "due_at" DATETIME,
    "client_visible" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "completed_at" DATETIME,
    "verified_at" DATETIME,
    "deleted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "work_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "work_item_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "options_json" TEXT,
    "selected_option" TEXT,
    "requested_by" TEXT NOT NULL,
    "decision_maker_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "cost_impact" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "schedule_impact" TEXT,
    "due_at" DATETIME,
    "decided_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "decisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "decisions_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "decisions_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "decisions_decision_maker_id_fkey" FOREIGN KEY ("decision_maker_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "decision_id" TEXT,
    "gate_id" TEXT,
    "approval_type" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "comment" TEXT,
    "idempotency_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approvals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "decisions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_gate_id_fkey" FOREIGN KEY ("gate_id") REFERENCES "project_gates" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_gates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "from_stage" TEXT NOT NULL,
    "to_stage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "evaluation_version" INTEGER NOT NULL DEFAULT 1,
    "required_items" TEXT NOT NULL DEFAULT '[]',
    "blocker_count" INTEGER NOT NULL DEFAULT 0,
    "reviewer_id" TEXT,
    "approved_by" TEXT,
    "approved_at" DATETIME,
    "override_reason" TEXT,
    "override_risk" TEXT,
    "override_mitigation" TEXT,
    "override_owner_id" TEXT,
    "override_due_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_gates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_gates_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "project_gates_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "project_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "pool_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pool_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "pool_type" TEXT,
    "pool_shape" TEXT,
    "dimensions" TEXT,
    "estimated_budget" TEXT,
    "notes" TEXT,
    "current_phase" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'INTAKE',
    "workflow_enabled" BOOLEAN NOT NULL DEFAULT false,
    "current_lifecycle_stage" TEXT,
    "workflow_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "pool_projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pool_projects" ("client_id", "created_at", "current_phase", "dimensions", "estimated_budget", "id", "notes", "pool_shape", "pool_type", "status", "updated_at") SELECT "client_id", "created_at", "current_phase", "dimensions", "estimated_budget", "id", "notes", "pool_shape", "pool_type", "status", "updated_at" FROM "pool_projects";
DROP TABLE "pool_projects";
ALTER TABLE "new_pool_projects" RENAME TO "pool_projects";
CREATE UNIQUE INDEX "pool_projects_client_id_key" ON "pool_projects"("client_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "properties_client_id_idx" ON "properties"("client_id");

-- CreateIndex
CREATE INDEX "properties_organization_id_client_id_idx" ON "properties"("organization_id", "client_id");

-- CreateIndex
CREATE INDEX "inquiries_client_id_idx" ON "inquiries"("client_id");

-- CreateIndex
CREATE INDEX "inquiries_property_id_idx" ON "inquiries"("property_id");

-- CreateIndex
CREATE INDEX "inquiries_project_id_idx" ON "inquiries"("project_id");

-- CreateIndex
CREATE INDEX "inquiries_owner_id_idx" ON "inquiries"("owner_id");

-- CreateIndex
CREATE INDEX "inquiries_qualification_status_idx" ON "inquiries"("qualification_status");

-- CreateIndex
CREATE INDEX "inquiries_organization_id_qualification_status_idx" ON "inquiries"("organization_id", "qualification_status");

-- CreateIndex
CREATE INDEX "lifecycle_stages_project_id_idx" ON "lifecycle_stages"("project_id");

-- CreateIndex
CREATE INDEX "lifecycle_stages_owner_id_idx" ON "lifecycle_stages"("owner_id");

-- CreateIndex
CREATE INDEX "lifecycle_stages_status_idx" ON "lifecycle_stages"("status");

-- CreateIndex
CREATE INDEX "lifecycle_stages_organization_id_status_idx" ON "lifecycle_stages"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lifecycle_stages_project_id_stage_key" ON "lifecycle_stages"("project_id", "stage");

-- CreateIndex
CREATE INDEX "work_items_project_id_idx" ON "work_items"("project_id");

-- CreateIndex
CREATE INDEX "work_items_owner_id_idx" ON "work_items"("owner_id");

-- CreateIndex
CREATE INDEX "work_items_reviewer_id_idx" ON "work_items"("reviewer_id");

-- CreateIndex
CREATE INDEX "work_items_status_idx" ON "work_items"("status");

-- CreateIndex
CREATE INDEX "work_items_due_at_idx" ON "work_items"("due_at");

-- CreateIndex
CREATE INDEX "work_items_organization_id_status_idx" ON "work_items"("organization_id", "status");

-- CreateIndex
CREATE INDEX "decisions_project_id_idx" ON "decisions"("project_id");

-- CreateIndex
CREATE INDEX "decisions_work_item_id_idx" ON "decisions"("work_item_id");

-- CreateIndex
CREATE INDEX "decisions_status_idx" ON "decisions"("status");

-- CreateIndex
CREATE INDEX "decisions_due_at_idx" ON "decisions"("due_at");

-- CreateIndex
CREATE INDEX "decisions_organization_id_status_idx" ON "decisions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_idempotency_key_key" ON "approvals"("idempotency_key");

-- CreateIndex
CREATE INDEX "approvals_project_id_idx" ON "approvals"("project_id");

-- CreateIndex
CREATE INDEX "approvals_decision_id_idx" ON "approvals"("decision_id");

-- CreateIndex
CREATE INDEX "approvals_gate_id_idx" ON "approvals"("gate_id");

-- CreateIndex
CREATE INDEX "approvals_organization_id_project_id_idx" ON "approvals"("organization_id", "project_id");

-- CreateIndex
CREATE INDEX "project_gates_project_id_idx" ON "project_gates"("project_id");

-- CreateIndex
CREATE INDEX "project_gates_status_idx" ON "project_gates"("status");

-- CreateIndex
CREATE INDEX "project_gates_organization_id_status_idx" ON "project_gates"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_gates_project_id_from_stage_to_stage_key" ON "project_gates"("project_id", "from_stage", "to_stage");

-- CreateIndex
CREATE INDEX "project_assignments_project_id_idx" ON "project_assignments"("project_id");

-- CreateIndex
CREATE INDEX "project_assignments_user_id_active_idx" ON "project_assignments"("user_id", "active");

-- CreateIndex
CREATE INDEX "project_assignments_organization_id_project_id_idx" ON "project_assignments"("organization_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_assignments_project_id_user_id_scope_key" ON "project_assignments"("project_id", "user_id", "scope");
