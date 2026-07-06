import type { DomainEvent } from "@vcp/shared/contracts/events.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type {
  KnowledgeDataSourceStatus,
  KnowledgeSyncJobStatus,
  UploadValidationStatus
} from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";

export type KnowledgeBaseRagEventContext = {
  eventId: EntityId<"eventId">;
  workspaceId: EntityId<"workspaceId">;
  actorId?: EntityId<"userId">;
  occurredAt: string;
};

export function createUploadValidatedEvent(input: KnowledgeBaseRagEventContext & {
  status: UploadValidationStatus;
  acceptedCount: number;
  rejectedCount: number;
}): DomainEvent<"knowledge.document.uploadValidated"> {
  return {
    name: "knowledge.document.uploadValidated",
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    payload: {
      eventType: "knowledge.document.uploadValidated",
      workspaceId: input.workspaceId,
      actorId: requireActorId(input.actorId, "upload validation"),
      status: input.status,
      acceptedCount: input.acceptedCount,
      rejectedCount: input.rejectedCount
    }
  };
}

export function createIngestionQueuedEvent(input: KnowledgeBaseRagEventContext & {
  documentId: EntityId<"documentId">;
  jobId: EntityId<"jobId">;
  status: KnowledgeIndexStatus;
}): DomainEvent<"knowledge.document.ingestionQueued"> {
  return {
    name: "knowledge.document.ingestionQueued",
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    payload: {
      eventType: "knowledge.document.ingestionQueued",
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      documentId: input.documentId,
      jobId: input.jobId,
      status: input.status
    }
  };
}

export function createIngestionStartedEvent(input: KnowledgeBaseRagEventContext & {
  documentId: EntityId<"documentId">;
  jobId: EntityId<"jobId">;
  status: KnowledgeIndexStatus;
}): DomainEvent<"knowledge.document.ingestionStarted"> {
  return {
    name: "knowledge.document.ingestionStarted",
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    payload: {
      eventType: "knowledge.document.ingestionStarted",
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      jobId: input.jobId,
      status: input.status
    }
  };
}

export function createIngestionCompletedEvent(input: KnowledgeBaseRagEventContext & {
  documentId: EntityId<"documentId">;
  jobId: EntityId<"jobId">;
  status: KnowledgeIndexStatus;
  chunkCount: number;
  indexedChunkCount: number;
}): DomainEvent<"knowledge.document.ingestionCompleted"> {
  return {
    name: "knowledge.document.ingestionCompleted",
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    payload: {
      eventType: "knowledge.document.ingestionCompleted",
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      jobId: input.jobId,
      status: input.status,
      chunkCount: input.chunkCount,
      indexedChunkCount: input.indexedChunkCount
    }
  };
}

export function createIngestionFailedEvent(input: KnowledgeBaseRagEventContext & {
  documentId: EntityId<"documentId">;
  jobId: EntityId<"jobId">;
  status: KnowledgeIndexStatus;
  errorCode: string;
  errorMessage: string;
}): DomainEvent<"knowledge.document.ingestionFailed"> {
  return {
    name: "knowledge.document.ingestionFailed",
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    payload: {
      eventType: "knowledge.document.ingestionFailed",
      workspaceId: input.workspaceId,
      documentId: input.documentId,
      jobId: input.jobId,
      status: input.status,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage
    }
  };
}

export function createDataSourceConnectedEvent(input: KnowledgeBaseRagEventContext & {
  sourceId: string;
  status: KnowledgeDataSourceStatus;
}): DomainEvent<"knowledge.dataSource.connected"> {
  return {
    name: "knowledge.dataSource.connected",
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    payload: {
      eventType: "knowledge.dataSource.connected",
      workspaceId: input.workspaceId,
      actorId: requireActorId(input.actorId, "data source connection"),
      sourceId: input.sourceId,
      status: input.status
    }
  };
}

export function createSyncScopeUpdatedEvent(input: KnowledgeBaseRagEventContext & {
  sourceId: string;
  selectedScopeNodeCount: number;
}): DomainEvent<"knowledge.sync.scopeUpdated"> {
  return {
    name: "knowledge.sync.scopeUpdated",
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    payload: {
      eventType: "knowledge.sync.scopeUpdated",
      workspaceId: input.workspaceId,
      actorId: requireActorId(input.actorId, "sync scope update"),
      sourceId: input.sourceId,
      selectedScopeNodeCount: input.selectedScopeNodeCount
    }
  };
}

export function createSyncRequestedEvent(input: KnowledgeBaseRagEventContext & {
  jobId: EntityId<"jobId">;
  sourceId?: string;
  status: KnowledgeSyncJobStatus;
}): DomainEvent<"knowledge.sync.requested"> {
  return {
    name: "knowledge.sync.requested",
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    payload: {
      eventType: "knowledge.sync.requested",
      workspaceId: input.workspaceId,
      actorId: requireActorId(input.actorId, "sync request"),
      jobId: input.jobId,
      sourceId: input.sourceId,
      status: input.status
    }
  };
}

function requireActorId(
  actorId: EntityId<"userId"> | undefined,
  action: string
): EntityId<"userId"> {
  if (!actorId) {
    throw new Error(`actorId is required for ${action} events`);
  }

  return actorId;
}
