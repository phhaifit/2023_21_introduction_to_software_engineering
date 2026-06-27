import type { EntityId } from "./ids.ts";

export const WORKSPACE_LIFECYCLE_STATUSES = [
  "provisioning",
  "active",
  "failed",
  "deleting",
  "delete_failed",
  "deleted"
] as const;

export const REQUESTED_WORKSPACE_PROFILES = ["standard", "premium"] as const;

export type WorkspaceLifecycleStatusDto =
  (typeof WORKSPACE_LIFECYCLE_STATUSES)[number];

export type RequestedWorkspaceProfileDto =
  (typeof REQUESTED_WORKSPACE_PROFILES)[number];

export type CreateWorkspaceRequest = {
  name: string;
  requestedProfile: RequestedWorkspaceProfileDto;
};

export type WorkspaceSafeFailureDto = {
  code: string;
  message: string;
};

export type WorkspaceSummaryDto = {
  workspaceId: EntityId<"workspaceId">;
  name: string;
  status: WorkspaceLifecycleStatusDto;
  requestedProfile?: RequestedWorkspaceProfileDto | null;
  createdAt: string;
  updatedAt: string;
  provisioningRequestedAt?: string | null;
  provisionedAt?: string | null;
  deletionRequestedAt?: string | null;
  deletedAt?: string | null;
  failure?: WorkspaceSafeFailureDto | null;
};

export type WorkspaceDetailDto = WorkspaceSummaryDto;

export type WorkspaceCommandOperationDto = {
  operationId: string | null;
  status: "queued" | "blocked" | "reused";
};

export type CreateWorkspaceAcceptedResponse = {
  workspace: WorkspaceSummaryDto;
  operation: WorkspaceCommandOperationDto;
};

export type DeleteWorkspaceAcceptedResponse = {
  workspaceId: EntityId<"workspaceId">;
  status: "deleting";
  operation: WorkspaceCommandOperationDto;
  acceptedAt: string;
};
