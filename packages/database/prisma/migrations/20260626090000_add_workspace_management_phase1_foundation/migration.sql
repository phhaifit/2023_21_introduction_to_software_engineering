-- Preflight: legacy Workspace rows must be classifiable before Phase 1 backfill.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "workspaces"
        WHERE "status" NOT IN ('pending', 'running', 'stopping', 'failed', 'deleted')
    ) THEN
        RAISE EXCEPTION 'Cannot classify legacy workspaces: unsupported status exists.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "workspaces"
        WHERE "workspaceId" IS NULL
           OR "userId" IS NULL
           OR "name" IS NULL
           OR "status" IS NULL
           OR "createdAt" IS NULL
           OR "updatedAt" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot migrate legacy workspaces: required legacy fields contain null values.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "workspaces"
        WHERE BTRIM("workspaceId") = ''
           OR BTRIM("userId") = ''
           OR BTRIM("name") = ''
           OR BTRIM("createdAt") = ''
           OR BTRIM("updatedAt") = ''
    ) THEN
        RAISE EXCEPTION 'Cannot migrate legacy workspaces: required legacy fields contain blank values.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "workspaces"
        WHERE "createdAt" !~ '^\d{4}-\d{2}-\d{2}T'
           OR "updatedAt" !~ '^\d{4}-\d{2}-\d{2}T'
    ) THEN
        RAISE EXCEPTION 'Cannot migrate legacy workspaces: malformed timestamp values exist.';
    END IF;
END $$;

-- AlterTable: Workspace-owned lifecycle, bootstrap, runtime, and provenance fields.
ALTER TABLE "workspaces" ADD COLUMN "createdByUserId" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "normalizedName" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "lifecycleVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "workspaces" ADD COLUMN "eventSequence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "workspaces" ADD COLUMN "ownerBootstrapState" TEXT NOT NULL DEFAULT 'not_applicable';
ALTER TABLE "workspaces" ADD COLUMN "ownerBootstrapAttemptId" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "ownerBootstrapAttemptVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "workspaces" ADD COLUMN "ownerBootstrapRequestedAt" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "ownerBootstrapExpiresAt" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "ownerMembershipEstablishedAt" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "ownerBootstrapFailureCode" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "ownerBootstrapFailureMessage" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "requestedProfile" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "resolvedProvisioningProfile" JSONB;
ALTER TABLE "workspaces" ADD COLUMN "provisioningProfileSource" TEXT NOT NULL DEFAULT 'legacy_unknown';
ALTER TABLE "workspaces" ADD COLUMN "migrationOrigin" TEXT NOT NULL DEFAULT 'legacy_import';
ALTER TABLE "workspaces" ADD COLUMN "runtimeVerificationState" TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE "workspaces" ADD COLUMN "provider" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "runtimeRef" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "runtimeUrl" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "provisioningRequestedAt" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "provisionedAt" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "deletionRequestedAt" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "deletedAt" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "failureCode" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "failureMessage" TEXT;

-- Backfill: keep legacy rows conservative and do not fabricate runtime/profile/event history.
UPDATE "workspaces"
SET
    "createdByUserId" = "userId",
    "normalizedName" = LOWER(regexp_replace(BTRIM("name"), '\s+', ' ', 'g')),
    "runtimeVerificationState" = CASE
        WHEN "status" IN ('running', 'stopping') THEN 'manual_review_required'
        ELSE 'unknown'
    END;

-- Backfill: map legacy statuses to canonical fail-closed lifecycle states.
UPDATE "workspaces"
SET "status" = CASE "status"
    WHEN 'pending' THEN 'provisioning'
    WHEN 'running' THEN 'provisioning'
    WHEN 'stopping' THEN 'deleting'
    WHEN 'failed' THEN 'failed'
    WHEN 'deleted' THEN 'deleted'
    ELSE "status"
END;

ALTER TABLE "workspaces" ALTER COLUMN "createdByUserId" SET NOT NULL;
ALTER TABLE "workspaces" ALTER COLUMN "normalizedName" SET NOT NULL;
ALTER TABLE "workspaces" ALTER COLUMN "status" SET DEFAULT 'provisioning';

-- CreateTable
CREATE TABLE "workspace_provisioning_operations" (
    "operationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "operationFamily" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "executionPhase" TEXT NOT NULL DEFAULT 'queued',
    "requestFingerprint" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT,
    "provider" TEXT,
    "providerRequestKey" TEXT NOT NULL,
    "runtimeRef" TEXT,
    "runtimeFinalityProof" TEXT NOT NULL DEFAULT 'unknown',
    "dependsOnOperationId" TEXT,
    "supersedesOperationId" TEXT,
    "cancellationRequestedAt" TEXT,
    "claimedByWorkerId" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TEXT,
    "lastAttemptAt" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "unknownOutcomeAt" TEXT,
    "reconciliationRequiredAt" TEXT,
    "completedAt" TEXT,
    "failedAt" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "workspace_provisioning_operations_pkey" PRIMARY KEY ("operationId")
);

-- CreateTable
CREATE TABLE "outbox_messages" (
    "outboxMessageId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "eventSequence" INTEGER NOT NULL,
    "lifecycleVersion" INTEGER,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 10,
    "nextAttemptAt" TEXT,
    "lastAttemptAt" TEXT,
    "publishedAt" TEXT,
    "deadLetteredAt" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "leaseToken" TEXT,
    "leaseExpiresAt" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("outboxMessageId")
);

-- CreateTable
CREATE TABLE "workspace_command_receipts" (
    "commandReceiptId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "commandTarget" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "idempotencyKeyHash" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "responseStatusCode" INTEGER,
    "responseBody" JSONB,
    "responseHeaders" JSONB,
    "operationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "completedAt" TEXT,

    CONSTRAINT "workspace_command_receipts_pkey" PRIMARY KEY ("commandReceiptId")
);

-- CreateTable
CREATE TABLE "workspace_visibility_projections" (
    "projectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "membershipVersion" INTEGER NOT NULL DEFAULT 0,
    "projectionUpdatedAt" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "workspace_visibility_projections_pkey" PRIMARY KEY ("projectionId")
);

-- CreateTable
CREATE TABLE "processed_domain_events" (
    "consumerName" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "processedAt" TEXT NOT NULL,
    "resultStatus" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "processed_domain_events_pkey" PRIMARY KEY ("consumerName", "eventId")
);

-- CreateIndex
CREATE INDEX "workspaces_createdByUserId_idx" ON "workspaces"("createdByUserId");
CREATE INDEX "workspaces_status_updatedAt_workspaceId_idx" ON "workspaces"("status", "updatedAt", "workspaceId");
CREATE INDEX "workspaces_createdByUserId_ownerBootstrapState_ownerBootstrapExpiresAt_updatedAt_workspaceId_idx" ON "workspaces"("createdByUserId", "ownerBootstrapState", "ownerBootstrapExpiresAt", "updatedAt", "workspaceId");
CREATE INDEX "workspaces_provider_idx" ON "workspaces"("provider");
CREATE INDEX "workspaces_runtimeRef_idx" ON "workspaces"("runtimeRef");
CREATE INDEX "workspaces_migrationOrigin_idx" ON "workspaces"("migrationOrigin");
CREATE INDEX "workspaces_runtimeVerificationState_idx" ON "workspaces"("runtimeVerificationState");

CREATE UNIQUE INDEX "workspace_provisioning_operations_providerRequestKey_key" ON "workspace_provisioning_operations"("providerRequestKey");
CREATE INDEX "workspace_provisioning_operations_workspaceId_idx" ON "workspace_provisioning_operations"("workspaceId");
CREATE INDEX "workspace_provisioning_operations_workspaceId_operationFamily_status_idx" ON "workspace_provisioning_operations"("workspaceId", "operationFamily", "status");
CREATE INDEX "workspace_provisioning_operations_status_nextAttemptAt_leaseExpiresAt_idx" ON "workspace_provisioning_operations"("status", "nextAttemptAt", "leaseExpiresAt");
CREATE INDEX "workspace_provisioning_operations_dependsOnOperationId_idx" ON "workspace_provisioning_operations"("dependsOnOperationId");
CREATE INDEX "workspace_provisioning_operations_supersedesOperationId_idx" ON "workspace_provisioning_operations"("supersedesOperationId");
CREATE INDEX "workspace_provisioning_operations_leaseExpiresAt_idx" ON "workspace_provisioning_operations"("leaseExpiresAt");
CREATE UNIQUE INDEX "workspace_provisioning_operations_active_family_key" ON "workspace_provisioning_operations"("workspaceId", "operationFamily") WHERE "status" IN ('queued', 'blocked', 'running', 'retry_scheduled');

CREATE UNIQUE INDEX "outbox_messages_eventId_key" ON "outbox_messages"("eventId");
CREATE UNIQUE INDEX "outbox_messages_aggregateType_aggregateId_eventSequence_key" ON "outbox_messages"("aggregateType", "aggregateId", "eventSequence");
CREATE INDEX "outbox_messages_status_nextAttemptAt_leaseExpiresAt_idx" ON "outbox_messages"("status", "nextAttemptAt", "leaseExpiresAt");
CREATE INDEX "outbox_messages_aggregateType_aggregateId_eventSequence_idx" ON "outbox_messages"("aggregateType", "aggregateId", "eventSequence");
CREATE INDEX "outbox_messages_leaseExpiresAt_idx" ON "outbox_messages"("leaseExpiresAt");

CREATE UNIQUE INDEX "wcr_idem_scope_key" ON "workspace_command_receipts"("actorUserId", "commandType", "commandTarget", "idempotencyKeyHash");
CREATE INDEX "wcr_scope_lookup_idx" ON "workspace_command_receipts"("actorUserId", "commandType", "commandTarget");
CREATE INDEX "wcr_workspace_idx" ON "workspace_command_receipts"("workspaceId");
CREATE INDEX "wcr_operation_idx" ON "workspace_command_receipts"("operationId");
CREATE INDEX "wcr_expires_idx" ON "workspace_command_receipts"("expiresAt");
CREATE UNIQUE INDEX "wcr_operation_key" ON "workspace_command_receipts"("operationId") WHERE "operationId" IS NOT NULL;

CREATE UNIQUE INDEX "workspace_visibility_projections_userId_workspaceId_key" ON "workspace_visibility_projections"("userId", "workspaceId");
CREATE INDEX "workspace_visibility_projections_userId_canRead_projectionUpdatedAt_workspaceId_idx" ON "workspace_visibility_projections"("userId", "canRead", "projectionUpdatedAt", "workspaceId");
CREATE INDEX "workspace_visibility_projections_workspaceId_idx" ON "workspace_visibility_projections"("workspaceId");

CREATE INDEX "processed_domain_events_consumerName_idx" ON "processed_domain_events"("consumerName");
CREATE INDEX "processed_domain_events_aggregateType_aggregateId_idx" ON "processed_domain_events"("aggregateType", "aggregateId");
CREATE INDEX "processed_domain_events_eventType_idx" ON "processed_domain_events"("eventType");

-- AddForeignKey
ALTER TABLE "workspace_provisioning_operations" ADD CONSTRAINT "workspace_provisioning_operations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("workspaceId") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "workspace_command_receipts" ADD CONSTRAINT "workspace_command_receipts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("workspaceId") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "workspace_visibility_projections" ADD CONSTRAINT "workspace_visibility_projections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("workspaceId") ON DELETE RESTRICT ON UPDATE NO ACTION;
