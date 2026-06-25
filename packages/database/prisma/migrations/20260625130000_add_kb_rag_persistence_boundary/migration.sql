-- AlterTable: extend the KB/RAG-owned document skeleton without changing ownership.
ALTER TABLE "documents" ADD COLUMN "displayName" TEXT;
UPDATE "documents" SET "displayName" = "fileName" WHERE "displayName" IS NULL;
ALTER TABLE "documents" ALTER COLUMN "displayName" SET NOT NULL;
ALTER TABLE "documents" ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE "documents" ADD COLUMN "fileType" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "documents" ADD COLUMN "sizeBytes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "documents" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'upload';
ALTER TABLE "documents" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "documents" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "documents" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "documents" ADD COLUMN "ingestionStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "documents" ADD COLUMN "indexingStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "documents" ADD COLUMN "chunkCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "documents" ADD COLUMN "indexedChunkCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "documents" ADD COLUMN "deletedAt" TEXT;

-- AlterTable: extend the KB/RAG-owned index skeleton with safe public lifecycle fields.
ALTER TABLE "knowledge_indexes" ADD COLUMN "chunkCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "knowledge_indexes" ADD COLUMN "indexedChunkCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "knowledge_indexes" ADD COLUMN "lastIndexedAt" TEXT;
ALTER TABLE "knowledge_indexes" ADD COLUMN "errorCode" TEXT;
ALTER TABLE "knowledge_indexes" ADD COLUMN "errorMessage" TEXT;

-- CreateTable
CREATE TABLE "knowledge_document_chunks" (
    "chunkId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "contentText" TEXT NOT NULL,
    "contentHash" TEXT,
    "tokenCount" INTEGER,
    "embeddingStatus" TEXT NOT NULL DEFAULT 'pending',
    "vectorRef" TEXT,
    "sourceLocator" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "knowledge_document_chunks_pkey" PRIMARY KEY ("chunkId")
);

-- CreateTable
CREATE TABLE "knowledge_ingestion_jobs" (
    "jobId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "documentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "queuedAt" TEXT NOT NULL,
    "startedAt" TEXT,
    "completedAt" TEXT,
    "failedAt" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "requestedByUserId" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "knowledge_ingestion_jobs_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "knowledge_data_sources" (
    "sourceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'not_connected',
    "lastSyncAt" TEXT,
    "connectedByUserId" TEXT,
    "safeMetadata" JSONB,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "knowledge_data_sources_pkey" PRIMARY KEY ("sourceId")
);

-- CreateTable
CREATE TABLE "knowledge_sync_scope_nodes" (
    "scopeNodeId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "parentScopeNodeId" TEXT,
    "externalId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "safeMetadata" JSONB,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "knowledge_sync_scope_nodes_pkey" PRIMARY KEY ("scopeNodeId")
);

-- CreateTable
CREATE TABLE "knowledge_sync_jobs" (
    "jobId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedByUserId" TEXT,
    "queuedAt" TEXT NOT NULL,
    "startedAt" TEXT,
    "completedAt" TEXT,
    "failedAt" TEXT,
    "totalItems" INTEGER,
    "syncedItems" INTEGER,
    "failedItems" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "knowledge_sync_jobs_pkey" PRIMARY KEY ("jobId")
);

-- CreateTable
CREATE TABLE "knowledge_sync_job_events" (
    "syncJobEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT,
    "message" TEXT,
    "errorCode" TEXT,
    "occurredAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "knowledge_sync_job_events_pkey" PRIMARY KEY ("syncJobEventId")
);

-- CreateIndex
CREATE INDEX "documents_sourceId_idx" ON "documents"("sourceId");

-- CreateIndex
CREATE INDEX "documents_workspaceId_sourceType_idx" ON "documents"("workspaceId", "sourceType");

-- CreateIndex
CREATE INDEX "documents_workspaceId_ingestionStatus_idx" ON "documents"("workspaceId", "ingestionStatus");

-- CreateIndex
CREATE INDEX "documents_workspaceId_indexingStatus_idx" ON "documents"("workspaceId", "indexingStatus");

-- CreateIndex
CREATE INDEX "documents_workspaceId_contentHash_idx" ON "documents"("workspaceId", "contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_document_chunks_documentId_chunkIndex_key" ON "knowledge_document_chunks"("documentId", "chunkIndex");

-- CreateIndex
CREATE INDEX "knowledge_document_chunks_workspaceId_idx" ON "knowledge_document_chunks"("workspaceId");

-- CreateIndex
CREATE INDEX "knowledge_document_chunks_documentId_idx" ON "knowledge_document_chunks"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_document_chunks_workspaceId_embeddingStatus_idx" ON "knowledge_document_chunks"("workspaceId", "embeddingStatus");

-- CreateIndex
CREATE INDEX "knowledge_document_chunks_workspaceId_contentHash_idx" ON "knowledge_document_chunks"("workspaceId", "contentHash");

-- CreateIndex
CREATE INDEX "knowledge_ingestion_jobs_workspaceId_idx" ON "knowledge_ingestion_jobs"("workspaceId");

-- CreateIndex
CREATE INDEX "knowledge_ingestion_jobs_documentId_idx" ON "knowledge_ingestion_jobs"("documentId");

-- CreateIndex
CREATE INDEX "knowledge_ingestion_jobs_requestedByUserId_idx" ON "knowledge_ingestion_jobs"("requestedByUserId");

-- CreateIndex
CREATE INDEX "knowledge_ingestion_jobs_workspaceId_status_idx" ON "knowledge_ingestion_jobs"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "knowledge_data_sources_workspaceId_idx" ON "knowledge_data_sources"("workspaceId");

-- CreateIndex
CREATE INDEX "knowledge_data_sources_workspaceId_provider_idx" ON "knowledge_data_sources"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "knowledge_data_sources_workspaceId_connectionStatus_idx" ON "knowledge_data_sources"("workspaceId", "connectionStatus");

-- CreateIndex
CREATE INDEX "knowledge_data_sources_connectedByUserId_idx" ON "knowledge_data_sources"("connectedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_sync_scope_nodes_sourceId_externalId_key" ON "knowledge_sync_scope_nodes"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "knowledge_sync_scope_nodes_workspaceId_idx" ON "knowledge_sync_scope_nodes"("workspaceId");

-- CreateIndex
CREATE INDEX "knowledge_sync_scope_nodes_sourceId_idx" ON "knowledge_sync_scope_nodes"("sourceId");

-- CreateIndex
CREATE INDEX "knowledge_sync_scope_nodes_parentScopeNodeId_idx" ON "knowledge_sync_scope_nodes"("parentScopeNodeId");

-- CreateIndex
CREATE INDEX "knowledge_sync_scope_nodes_workspaceId_selected_idx" ON "knowledge_sync_scope_nodes"("workspaceId", "selected");

-- CreateIndex
CREATE INDEX "knowledge_sync_jobs_workspaceId_idx" ON "knowledge_sync_jobs"("workspaceId");

-- CreateIndex
CREATE INDEX "knowledge_sync_jobs_sourceId_idx" ON "knowledge_sync_jobs"("sourceId");

-- CreateIndex
CREATE INDEX "knowledge_sync_jobs_requestedByUserId_idx" ON "knowledge_sync_jobs"("requestedByUserId");

-- CreateIndex
CREATE INDEX "knowledge_sync_jobs_workspaceId_status_idx" ON "knowledge_sync_jobs"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "knowledge_sync_job_events_workspaceId_idx" ON "knowledge_sync_job_events"("workspaceId");

-- CreateIndex
CREATE INDEX "knowledge_sync_job_events_jobId_idx" ON "knowledge_sync_job_events"("jobId");

-- CreateIndex
CREATE INDEX "knowledge_sync_job_events_eventType_idx" ON "knowledge_sync_job_events"("eventType");

-- Preflight: existing KB/RAG skeleton rows must be internally consistent before adding FKs.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "knowledge_indexes" ki
        LEFT JOIN "documents" d ON d."documentId" = ki."documentId"
        WHERE d."documentId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot add knowledge_indexes(documentId) foreign key: orphan knowledge index rows exist.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "knowledge_access_grants" kag
        LEFT JOIN "documents" d ON d."documentId" = kag."documentId"
        WHERE d."documentId" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot add knowledge_access_grants(documentId) foreign key: orphan knowledge access grant rows exist.';
    END IF;
END $$;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_data_sources"("sourceId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "knowledge_indexes" ADD CONSTRAINT "knowledge_indexes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("documentId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "knowledge_document_chunks" ADD CONSTRAINT "knowledge_document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("documentId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "knowledge_ingestion_jobs" ADD CONSTRAINT "knowledge_ingestion_jobs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("documentId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "knowledge_sync_scope_nodes" ADD CONSTRAINT "knowledge_sync_scope_nodes_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_data_sources"("sourceId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "knowledge_sync_jobs" ADD CONSTRAINT "knowledge_sync_jobs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_data_sources"("sourceId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "knowledge_sync_job_events" ADD CONSTRAINT "knowledge_sync_job_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "knowledge_sync_jobs"("jobId") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "knowledge_access_grants" ADD CONSTRAINT "knowledge_access_grants_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("documentId") ON DELETE RESTRICT ON UPDATE NO ACTION;
