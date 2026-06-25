import type { KnowledgeSyncJobStatus } from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { SafeJsonValue } from "./safe-json.ts";

export type KnowledgeSyncScopeNode = {
  scopeNodeId: string;
  workspaceId: EntityId<"workspaceId">;
  sourceId: string;
  parentScopeNodeId?: string;
  externalId: string;
  nodeType: "folder" | "file" | "page" | "space";
  displayName: string;
  selected: boolean;
  selectable: boolean;
  safeMetadata?: SafeJsonValue;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSyncJob = {
  jobId: EntityId<"jobId">;
  workspaceId: EntityId<"workspaceId">;
  sourceId?: string;
  status: KnowledgeSyncJobStatus;
  requestedByUserId?: EntityId<"userId">;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  totalItems?: number;
  syncedItems?: number;
  failedItems?: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeSyncJobEvent = {
  syncJobEventId: string;
  workspaceId: EntityId<"workspaceId">;
  jobId: EntityId<"jobId">;
  eventType: string;
  status?: KnowledgeSyncJobStatus;
  message?: string;
  errorCode?: string;
  occurredAt: string;
  createdAt: string;
};
