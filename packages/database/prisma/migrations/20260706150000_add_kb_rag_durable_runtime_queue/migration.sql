CREATE TABLE "knowledge_runtime_jobs" (
    "runtimeJobId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "targetJobId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TEXT,
    "nextAttemptAt" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "queuedAt" TEXT NOT NULL,
    "startedAt" TEXT,
    "completedAt" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "knowledge_runtime_jobs_pkey" PRIMARY KEY ("runtimeJobId")
);

CREATE UNIQUE INDEX "knowledge_runtime_jobs_kind_targetJobId_key"
ON "knowledge_runtime_jobs"("kind", "targetJobId");

CREATE INDEX "knowledge_runtime_jobs_workspaceId_status_idx"
ON "knowledge_runtime_jobs"("workspaceId", "status");

CREATE INDEX "knowledge_runtime_jobs_status_nextAttemptAt_leaseExpiresAt_idx"
ON "knowledge_runtime_jobs"("status", "nextAttemptAt", "leaseExpiresAt");

CREATE INDEX "knowledge_runtime_jobs_leaseOwner_leaseExpiresAt_idx"
ON "knowledge_runtime_jobs"("leaseOwner", "leaseExpiresAt");

CREATE UNIQUE INDEX "knowledge_sync_jobs_active_source_key"
ON "knowledge_sync_jobs"("sourceId")
WHERE "sourceId" IS NOT NULL AND "status" IN ('pending', 'syncing');
