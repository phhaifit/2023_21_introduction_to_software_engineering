import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkspaceStatus } from "@vcp/shared/contracts/statuses.ts";
import type { SubscriptionPlan } from "@vcp/shared/contracts/plans.ts";
import type { Workspace } from "../domain/workspace.ts";

// Minimal shape expected from @vcp/database Workspace model rows
type WorkspaceRow = {
  workspaceId: string;
  userId: string;
  name: string;
  status: string;
  plan: string;
  runtimeUrl: string | null;
  containerId: string | null;
  failureReason: string | null;
  subscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toDomain(row: WorkspaceRow): Workspace {
  return {
    workspaceId: row.workspaceId as EntityId<"workspaceId">,
    userId: row.userId as EntityId<"userId">,
    name: row.name,
    status: row.status as WorkspaceStatus,
    plan: row.plan as SubscriptionPlan,
    runtimeUrl: row.runtimeUrl ?? undefined,
    containerId: row.containerId ?? undefined,
    failureReason: row.failureReason ?? undefined,
    subscriptionId: (row.subscriptionId ?? undefined) as EntityId<"subscriptionId"> | undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function toPrismaCreate(workspace: Workspace) {
  return {
    workspaceId: workspace.workspaceId,
    userId: workspace.userId,
    name: workspace.name,
    status: workspace.status,
    plan: workspace.plan,
    runtimeUrl: workspace.runtimeUrl ?? null,
    containerId: workspace.containerId ?? null,
    failureReason: workspace.failureReason ?? null,
    subscriptionId: workspace.subscriptionId ?? null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt
  };
}
