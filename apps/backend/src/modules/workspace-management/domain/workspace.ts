import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkspaceStatus } from "@vcp/shared/contracts/statuses.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import type {
  WorkspaceSummaryDto,
  WorkspaceDetailDto
} from "@vcp/shared/contracts/workspace-management.ts";

// ---------------------------------------------------------------------------
// Domain entity — private to this module
// ---------------------------------------------------------------------------

export type Workspace = {
  workspaceId: EntityId<"workspaceId">;
  userId: EntityId<"userId">;
  name: string;
  status: WorkspaceStatus;
  plan: SubscriptionPlan;
  runtimeUrl?: string;
  containerId?: string;
  failureReason?: string;
  subscriptionId?: EntityId<"subscriptionId">;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceDraft = {
  workspaceId: EntityId<"workspaceId">;
  userId: EntityId<"userId">;
  name: string;
  plan: SubscriptionPlan;
  subscriptionId?: EntityId<"subscriptionId">;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createWorkspace(draft: WorkspaceDraft): Workspace {
  return {
    ...draft,
    status: "pending"
  };
}

// ---------------------------------------------------------------------------
// Business rules
// ---------------------------------------------------------------------------

export function isWorkspaceDeletable(workspace: Pick<Workspace, "status">): boolean {
  return (
    workspace.status === "running" ||
    workspace.status === "failed" ||
    workspace.status === "pending"
  );
}

export function isWorkspaceAccessible(workspace: Pick<Workspace, "status">): boolean {
  return workspace.status !== "deleted";
}

// ---------------------------------------------------------------------------
// Public DTO mappers — convert private domain → shared contract
// ---------------------------------------------------------------------------

export function toWorkspaceSummaryDto(workspace: Workspace): WorkspaceSummaryDto {
  return {
    workspaceId: workspace.workspaceId,
    name: workspace.name,
    status: workspace.status,
    plan: workspace.plan,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt
  };
}

export function toWorkspaceDetailDto(
  workspace: Workspace,
  counts: { agentCount: number; workflowCount: number; toolCount: number }
): WorkspaceDetailDto {
  return {
    ...toWorkspaceSummaryDto(workspace),
    runtimeUrl: workspace.runtimeUrl,
    agentCount: counts.agentCount,
    workflowCount: counts.workflowCount,
    toolCount: counts.toolCount
  };
}
