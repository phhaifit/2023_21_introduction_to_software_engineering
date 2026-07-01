import type { EntityId } from "./ids.ts";
import type { WorkspaceStatus } from "./statuses.ts";
import type { SubscriptionPlan } from "./plans.ts";

// ---------------------------------------------------------------------------
// Public read DTOs
// ---------------------------------------------------------------------------

export type WorkspaceSummaryDto = {
  workspaceId: EntityId<"workspaceId">;
  name: string;
  status: WorkspaceStatus;
  plan: SubscriptionPlan;
  createdAt: string;
  updatedAt: string;
  accessRestricted?: boolean;
  membershipRole?: string;
};

export type WorkspaceDetailDto = WorkspaceSummaryDto & {
  runtimeUrl?: string;
  agentCount: number;
  workflowCount: number;
  toolCount: number;
};

// ---------------------------------------------------------------------------
// Request DTOs — caller-provided intent only
// (no workspaceId, userId, status, timestamps — those are server-owned)
// ---------------------------------------------------------------------------

export type CreateWorkspaceRequest = {
  name: string;
  plan: SubscriptionPlan;
};

// ---------------------------------------------------------------------------
// Response DTOs for mutations
// ---------------------------------------------------------------------------

export type WorkspaceDeleteAckDto = {
  workspaceId: EntityId<"workspaceId">;
  status: Extract<WorkspaceStatus, "stopping">;
};
