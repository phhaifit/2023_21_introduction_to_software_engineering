import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeSyncJobStatus } from "@vcp/shared/contracts/knowledge-base-rag.ts";
import type {
  KnowledgeSyncJob,
  KnowledgeSyncJobEvent,
  KnowledgeSyncScopeNode
} from "../domain/knowledge-sync.ts";

export type KnowledgeSyncJobListFilters = {
  sourceId?: string;
  statuses?: readonly KnowledgeSyncJobStatus[];
  page?: number;
  pageSize?: number;
};

export type KnowledgeSyncJobListResult = {
  items: KnowledgeSyncJob[];
  total: number;
};

export type KnowledgeSyncScopeRepository = {
  getSyncScope(
    workspaceId: EntityId<"workspaceId">,
    sourceId?: string
  ): Promise<KnowledgeSyncScopeNode[]>;
  saveSyncScopeNodes(
    workspaceId: EntityId<"workspaceId">,
    nodes: readonly KnowledgeSyncScopeNode[]
  ): Promise<KnowledgeSyncScopeNode[]>;
};

export type KnowledgeSyncJobRepository = {
  listSyncJobs(
    workspaceId: EntityId<"workspaceId">,
    filters?: KnowledgeSyncJobListFilters
  ): Promise<KnowledgeSyncJobListResult>;
  getSyncJobById(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeSyncJob | null>;
  saveSyncJob(job: KnowledgeSyncJob): Promise<KnowledgeSyncJob>;
  appendSyncJobEvent(event: KnowledgeSyncJobEvent): Promise<KnowledgeSyncJobEvent>;
  listSyncJobEvents(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeSyncJobEvent[]>;
};

