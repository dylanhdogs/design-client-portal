-- CreateIndex
CREATE INDEX "checklist_items_phase_id_idx" ON "checklist_items"("phase_id");

-- CreateIndex
CREATE INDEX "communications_client_id_idx" ON "communications"("client_id");

-- CreateIndex
CREATE INDEX "communications_user_id_idx" ON "communications"("user_id");

-- CreateIndex
CREATE INDEX "consultations_client_id_idx" ON "consultations"("client_id");

-- CreateIndex
CREATE INDEX "consultations_user_id_idx" ON "consultations"("user_id");

-- CreateIndex
CREATE INDEX "documents_client_id_idx" ON "documents"("client_id");

-- CreateIndex
CREATE INDEX "documents_consultation_id_idx" ON "documents"("consultation_id");

-- CreateIndex
CREATE INDEX "documents_user_id_idx" ON "documents"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "pool_notes_project_id_idx" ON "pool_notes"("project_id");

-- CreateIndex
CREATE INDEX "pool_notes_user_id_idx" ON "pool_notes"("user_id");

-- CreateIndex
CREATE INDEX "project_phases_project_id_idx" ON "project_phases"("project_id");
