ALTER TABLE "compliance_research_sources"
ADD COLUMN "authority_type" TEXT NOT NULL DEFAULT 'OTHER';

ALTER TABLE "compliance_research_sources"
ADD COLUMN "authority_name" TEXT NOT NULL DEFAULT 'Other source';
