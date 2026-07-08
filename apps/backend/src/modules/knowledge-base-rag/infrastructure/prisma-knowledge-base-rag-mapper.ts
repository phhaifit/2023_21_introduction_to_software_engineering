import type {
  Document as PrismaDocument,
  KnowledgeDataSource as PrismaKnowledgeDataSource,
  KnowledgeDocumentChunk as PrismaKnowledgeDocumentChunk,
  KnowledgeIngestionJob as PrismaKnowledgeIngestionJob,
  KnowledgeSyncJob as PrismaKnowledgeSyncJob,
  KnowledgeSyncJobEvent as PrismaKnowledgeSyncJobEvent,
  KnowledgeSyncScopeNode as PrismaKnowledgeSyncScopeNode
} from "@vcp/database";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDataSourceStatus,
  KnowledgeDocumentSource,
  KnowledgeSyncJobStatus
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";
import type { KnowledgeDataSource } from "../domain/knowledge-data-source.ts";
import type {
  KnowledgeDocument,
  KnowledgeDocumentChunk
} from "../domain/knowledge-document.ts";
import type { SafeJsonValue } from "../domain/safe-json.ts";
import type { KnowledgeIngestionJob } from "../domain/knowledge-ingestion-job.ts";
import type {
  KnowledgeSyncJob,
  KnowledgeSyncJobEvent,
  KnowledgeSyncScopeNode
} from "../domain/knowledge-sync.ts";

export function toKnowledgeDocumentDomain(record: PrismaDocument): KnowledgeDocument {
  return {
    documentId: record.documentId as EntityId<"documentId">,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    uploadedByUserId: record.uploadedByUserId as EntityId<"userId">,
    displayName: record.displayName,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileType: record.fileType,
    sizeBytes: record.sizeBytes,
    sourceType: record.sourceType as KnowledgeDocumentSource,
    sourceId: record.sourceId ?? undefined,
    storageKey: record.storageKey ?? undefined,
    contentHash: record.contentHash ?? undefined,
    externalId: record.externalId ?? undefined,
    sourceModifiedAt: record.sourceModifiedAt ?? undefined,
    lastSyncedAt: record.lastSyncedAt ?? undefined,
    status: record.status as KnowledgeIndexStatus,
    ingestionStatus: record.ingestionStatus as KnowledgeIndexStatus,
    indexingStatus: record.indexingStatus as KnowledgeIndexStatus,
    chunkCount: record.chunkCount,
    indexedChunkCount: record.indexedChunkCount,
    deletedAt: record.deletedAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function toKnowledgeDocumentPrisma(document: KnowledgeDocument) {
  return {
    documentId: document.documentId,
    workspaceId: document.workspaceId,
    uploadedByUserId: document.uploadedByUserId,
    displayName: document.displayName,
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileType: document.fileType,
    sizeBytes: document.sizeBytes,
    sourceType: document.sourceType,
    sourceId: document.sourceId ?? null,
    storageKey: document.storageKey ?? null,
    contentHash: document.contentHash ?? null,
    externalId: document.externalId ?? null,
    sourceModifiedAt: document.sourceModifiedAt ?? null,
    lastSyncedAt: document.lastSyncedAt ?? null,
    status: document.status,
    ingestionStatus: document.ingestionStatus,
    indexingStatus: document.indexingStatus,
    chunkCount: document.chunkCount,
    indexedChunkCount: document.indexedChunkCount,
    deletedAt: document.deletedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

export function toKnowledgeDocumentChunkDomain(
  record: PrismaKnowledgeDocumentChunk
): KnowledgeDocumentChunk {
  return {
    chunkId: record.chunkId,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    documentId: record.documentId as EntityId<"documentId">,
    chunkIndex: record.chunkIndex,
    contentText: record.contentText,
    contentHash: record.contentHash ?? undefined,
    tokenCount: record.tokenCount ?? undefined,
    embeddingStatus: record.embeddingStatus as KnowledgeIndexStatus,
    vectorRef: record.vectorRef ?? undefined,
    sourceLocator: record.sourceLocator ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function toKnowledgeDocumentChunkPrisma(chunk: KnowledgeDocumentChunk) {
  return {
    chunkId: chunk.chunkId,
    workspaceId: chunk.workspaceId,
    documentId: chunk.documentId,
    chunkIndex: chunk.chunkIndex,
    contentText: chunk.contentText,
    contentHash: chunk.contentHash ?? null,
    tokenCount: chunk.tokenCount ?? null,
    embeddingStatus: chunk.embeddingStatus,
    vectorRef: chunk.vectorRef ?? null,
    sourceLocator: chunk.sourceLocator ?? null,
    createdAt: chunk.createdAt,
    updatedAt: chunk.updatedAt
  };
}

export function toKnowledgeIngestionJobDomain(
  record: PrismaKnowledgeIngestionJob
): KnowledgeIngestionJob {
  return {
    jobId: record.jobId as EntityId<"jobId">,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    documentId: record.documentId
      ? (record.documentId as EntityId<"documentId">)
      : undefined,
    status: record.status as KnowledgeIndexStatus,
    progress: record.progress,
    queuedAt: record.queuedAt,
    startedAt: record.startedAt ?? undefined,
    completedAt: record.completedAt ?? undefined,
    failedAt: record.failedAt ?? undefined,
    errorCode: record.errorCode ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    safeSummary:
      record.safeSummary === null
        ? undefined
        : (record.safeSummary as SafeJsonValue),
    requestedByUserId: record.requestedByUserId
      ? (record.requestedByUserId as EntityId<"userId">)
      : undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function toKnowledgeIngestionJobPrisma(job: KnowledgeIngestionJob) {
  return {
    jobId: job.jobId,
    workspaceId: job.workspaceId,
    documentId: job.documentId ?? null,
    status: job.status,
    progress: job.progress,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    failedAt: job.failedAt ?? null,
    errorCode: job.errorCode ?? null,
    errorMessage: job.errorMessage ?? null,
    safeSummary: job.safeSummary as never,
    requestedByUserId: job.requestedByUserId ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

export function toKnowledgeDataSourceDomain(
  record: PrismaKnowledgeDataSource,
  selectedScopeNodeCount = 0
): KnowledgeDataSource {
  return {
    sourceId: record.sourceId,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    provider: record.provider as KnowledgeDataSource["provider"],
    displayName: record.displayName,
    connectionStatus: record.connectionStatus as KnowledgeDataSourceStatus,
    selectedScopeNodeCount,
    lastSyncAt: record.lastSyncAt ?? undefined,
    connectedByUserId: record.connectedByUserId
      ? (record.connectedByUserId as EntityId<"userId">)
      : undefined,
    safeMetadata:
      record.safeMetadata === null
        ? undefined
        : (record.safeMetadata as SafeJsonValue),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function toKnowledgeDataSourcePrisma(source: KnowledgeDataSource) {
  return {
    sourceId: source.sourceId,
    workspaceId: source.workspaceId,
    provider: source.provider,
    displayName: source.displayName,
    connectionStatus: source.connectionStatus,
    lastSyncAt: source.lastSyncAt ?? null,
    connectedByUserId: source.connectedByUserId ?? null,
    safeMetadata: source.safeMetadata as never,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  };
}

export function toKnowledgeSyncScopeNodeDomain(
  record: PrismaKnowledgeSyncScopeNode
): KnowledgeSyncScopeNode {
  return {
    scopeNodeId: record.scopeNodeId,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    sourceId: record.sourceId,
    parentScopeNodeId: record.parentScopeNodeId ?? undefined,
    externalId: record.externalId,
    nodeType: record.nodeType as KnowledgeSyncScopeNode["nodeType"],
    displayName: record.displayName,
    selected: record.selected,
    selectable: true,
    safeMetadata:
      record.safeMetadata === null
        ? undefined
        : (record.safeMetadata as SafeJsonValue),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function toKnowledgeSyncScopeNodePrisma(node: KnowledgeSyncScopeNode) {
  return {
    scopeNodeId: node.scopeNodeId,
    workspaceId: node.workspaceId,
    sourceId: node.sourceId,
    parentScopeNodeId: node.parentScopeNodeId ?? null,
    externalId: node.externalId,
    nodeType: node.nodeType,
    displayName: node.displayName,
    selected: node.selected,
    safeMetadata: node.safeMetadata as never,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt
  };
}

export function toKnowledgeSyncJobDomain(record: PrismaKnowledgeSyncJob): KnowledgeSyncJob {
  return {
    jobId: record.jobId as EntityId<"jobId">,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    sourceId: record.sourceId ?? undefined,
    status: record.status as KnowledgeSyncJobStatus,
    requestedByUserId: record.requestedByUserId
      ? (record.requestedByUserId as EntityId<"userId">)
      : undefined,
    queuedAt: record.queuedAt,
    startedAt: record.startedAt ?? undefined,
    completedAt: record.completedAt ?? undefined,
    failedAt: record.failedAt ?? undefined,
    totalItems: record.totalItems ?? undefined,
    syncedItems: record.syncedItems ?? undefined,
    failedItems: record.failedItems ?? undefined,
    errorCode: record.errorCode ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    safeSummary:
      record.safeSummary === null
        ? undefined
        : (record.safeSummary as SafeJsonValue),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export function toKnowledgeSyncJobPrisma(job: KnowledgeSyncJob) {
  return {
    jobId: job.jobId,
    workspaceId: job.workspaceId,
    sourceId: job.sourceId ?? null,
    status: job.status,
    requestedByUserId: job.requestedByUserId ?? null,
    queuedAt: job.queuedAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    failedAt: job.failedAt ?? null,
    totalItems: job.totalItems ?? null,
    syncedItems: job.syncedItems ?? null,
    failedItems: job.failedItems ?? null,
    errorCode: job.errorCode ?? null,
    errorMessage: job.errorMessage ?? null,
    safeSummary: job.safeSummary as never,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

export function toKnowledgeSyncJobEventDomain(
  record: PrismaKnowledgeSyncJobEvent
): KnowledgeSyncJobEvent {
  return {
    syncJobEventId: record.syncJobEventId,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    jobId: record.jobId as EntityId<"jobId">,
    eventType: record.eventType,
    status: record.status ? (record.status as KnowledgeSyncJobStatus) : undefined,
    message: record.message ?? undefined,
    errorCode: record.errorCode ?? undefined,
    occurredAt: record.occurredAt,
    createdAt: record.createdAt
  };
}

export function toKnowledgeSyncJobEventPrisma(event: KnowledgeSyncJobEvent) {
  return {
    syncJobEventId: event.syncJobEventId,
    workspaceId: event.workspaceId,
    jobId: event.jobId,
    eventType: event.eventType,
    status: event.status ?? null,
    message: event.message ?? null,
    errorCode: event.errorCode ?? null,
    occurredAt: event.occurredAt,
    createdAt: event.createdAt
  };
}
