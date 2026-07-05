import type {
  IngestionJobDto,
  KnowledgeDataSourceDto,
  KnowledgeDocumentChunkDto,
  SyncJobDto,
  SyncScopeNodeDto
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";
import { toKnowledgeDocumentDto } from "../domain/knowledge-document.ts";
import type { KnowledgeDataSource } from "../domain/knowledge-data-source.ts";
import type { KnowledgeIngestionJob } from "../domain/knowledge-ingestion-job.ts";
import type { KnowledgeSyncJob, KnowledgeSyncScopeNode } from "../domain/knowledge-sync.ts";

export { toKnowledgeDocumentDto };

export function toKnowledgeDocumentChunkDto(
  chunk: KnowledgeDocumentChunk
): KnowledgeDocumentChunkDto {
  return {
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    workspaceId: chunk.workspaceId,
    sequence: chunk.chunkIndex,
    textPreview: chunk.contentText.slice(0, 240),
    pageLabel: chunk.sourceLocator,
    characterCount: chunk.contentText.length,
    createdAt: chunk.createdAt
  };
}

export function toIngestionJobDto(job: KnowledgeIngestionJob): IngestionJobDto {
  if (!job.documentId) {
    throw new Error("Cannot map ingestion job without documentId to public DTO");
  }

  return {
    jobId: job.jobId,
    workspaceId: job.workspaceId,
    documentId: job.documentId,
    status: job.status,
    progressPercent: job.progress,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt,
    finishedAt: job.completedAt ?? job.failedAt,
    failure:
      job.errorCode && job.errorMessage
        ? { errorCode: job.errorCode, errorMessage: job.errorMessage }
        : undefined
  };
}

export function toKnowledgeDataSourceDto(
  source: KnowledgeDataSource
): KnowledgeDataSourceDto {
  const safeMetadata =
    source.safeMetadata &&
    typeof source.safeMetadata === "object" &&
    !Array.isArray(source.safeMetadata)
      ? source.safeMetadata
      : {};
  return {
    sourceId: source.sourceId,
    workspaceId: source.workspaceId,
    provider: source.provider,
    displayName: source.displayName,
    status: source.connectionStatus,
    selectedScopeNodeCount: source.selectedScopeNodeCount,
    connectedAccountEmail:
      typeof safeMetadata.connectedAccountEmail === "string"
        ? safeMetadata.connectedAccountEmail
        : undefined,
    oauthConfigured:
      typeof safeMetadata.oauthConfigured === "boolean"
        ? safeMetadata.oauthConfigured
        : undefined,
    lastSyncAt: source.lastSyncAt,
    updatedAt: source.updatedAt
  };
}

export function toSyncScopeNodeDto(node: KnowledgeSyncScopeNode): SyncScopeNodeDto {
  return {
    scopeNodeId: node.scopeNodeId,
    sourceId: node.sourceId,
    parentScopeNodeId: node.parentScopeNodeId,
    name: node.displayName,
    nodeType: node.nodeType,
    selected: node.selected,
    selectable: node.selectable,
    updatedAt: node.updatedAt
  };
}

export function toSyncJobDto(job: KnowledgeSyncJob): SyncJobDto {
  const summary =
    job.safeSummary &&
    typeof job.safeSummary === "object" &&
    !Array.isArray(job.safeSummary)
      ? job.safeSummary
      : {};
  const count = (name: string) =>
    typeof summary[name] === "number" ? summary[name] : undefined;
  return {
    jobId: job.jobId,
    workspaceId: job.workspaceId,
    sourceId: job.sourceId,
    status: job.status,
    requestedAt: job.queuedAt,
    startedAt: job.startedAt,
    finishedAt: job.completedAt ?? job.failedAt,
    scannedItemCount: job.totalItems ?? 0,
    changedItemCount: job.syncedItems ?? 0,
    importedItemCount: count("importedItemCount"),
    updatedItemCount: count("updatedItemCount"),
    skippedUnchangedItemCount: count("skippedUnchangedItemCount"),
    skippedUnsupportedItemCount: count("skippedUnsupportedItemCount"),
    failedItemCount: count("failedItemCount"),
    totalChunksCreated: count("totalChunksCreated"),
    totalVectorsIndexed: count("totalVectorsIndexed"),
    failure:
      job.errorCode && job.errorMessage
        ? { errorCode: job.errorCode, errorMessage: job.errorMessage }
        : undefined
  };
}

export type KnowledgeDocumentDtoSource = KnowledgeDocument;
