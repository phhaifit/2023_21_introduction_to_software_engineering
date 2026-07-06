import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";
import type { KnowledgeIngestionJob } from "../domain/knowledge-ingestion-job.ts";

export type KnowledgeIngestionJobListFilters = {
  documentId?: EntityId<"documentId">;
  statuses?: readonly KnowledgeIndexStatus[];
  page?: number;
  pageSize?: number;
};

export type KnowledgeIngestionJobListResult = {
  items: KnowledgeIngestionJob[];
  total: number;
};

export type KnowledgeIngestionJobRepository = {
  findNextQueuedJob(
    workspaceId: EntityId<"workspaceId">
  ): Promise<KnowledgeIngestionJob | null>;
  listIngestionJobs(
    workspaceId: EntityId<"workspaceId">,
    filters?: KnowledgeIngestionJobListFilters
  ): Promise<KnowledgeIngestionJobListResult>;
  getIngestionJobById(
    workspaceId: EntityId<"workspaceId">,
    jobId: EntityId<"jobId">
  ): Promise<KnowledgeIngestionJob | null>;
  saveIngestionJob(job: KnowledgeIngestionJob): Promise<KnowledgeIngestionJob>;
};
