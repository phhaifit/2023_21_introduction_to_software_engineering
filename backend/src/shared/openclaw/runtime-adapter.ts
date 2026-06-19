import type { EntityId, ResourceEntitlement, WorkspaceStatus } from "../../../../shared/contracts";

export type OpenClawWorkspaceConfig = {
  workspaceId: EntityId<"workspaceId">;
  displayName: string;
  entitlement: ResourceEntitlement;
};

export type OpenClawRuntimeInfo = {
  workspaceId: EntityId<"workspaceId">;
  status: WorkspaceStatus;
  runtimeUrl?: string;
  containerId?: string;
  failureReason?: string;
};

export type OpenClawRuntimeAdapter = {
  provision(config: OpenClawWorkspaceConfig): Promise<OpenClawRuntimeInfo>;
  start(workspaceId: EntityId<"workspaceId">): Promise<OpenClawRuntimeInfo>;
  stop(workspaceId: EntityId<"workspaceId">): Promise<OpenClawRuntimeInfo>;
  delete(workspaceId: EntityId<"workspaceId">): Promise<void>;
  resize(
    workspaceId: EntityId<"workspaceId">,
    entitlement: ResourceEntitlement
  ): Promise<OpenClawRuntimeInfo>;
  getStatus(workspaceId: EntityId<"workspaceId">): Promise<OpenClawRuntimeInfo>;
};
