ALTER TABLE "documents"
  ADD COLUMN "externalId" TEXT,
  ADD COLUMN "sourceModifiedAt" TEXT,
  ADD COLUMN "lastSyncedAt" TEXT;

CREATE UNIQUE INDEX "documents_workspaceId_sourceId_externalId_key"
  ON "documents"("workspaceId", "sourceId", "externalId");

ALTER TABLE "knowledge_sync_jobs"
  ADD COLUMN "safeSummary" JSONB;
