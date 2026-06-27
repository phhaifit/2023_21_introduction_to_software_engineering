import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { KnowledgeIndexStatus } from "@vcp/shared/contracts/statuses.ts";

export type KnowledgeIngestionJob = {
  jobId: EntityId<"jobId">;
  workspaceId: EntityId<"workspaceId">;
  documentId?: EntityId<"documentId">;
  status: KnowledgeIndexStatus;
  progress: number;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  requestedByUserId?: EntityId<"userId">;
  createdAt: string;
  updatedAt: string;
};

