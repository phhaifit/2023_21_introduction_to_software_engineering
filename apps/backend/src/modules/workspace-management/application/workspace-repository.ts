import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkspaceStatus } from "@vcp/shared/contracts/statuses.ts";
import type { Workspace } from "../domain/workspace.ts";

// ---------------------------------------------------------------------------
// Port interface — workspace-management owns this; Prisma impl lives in infra
// ---------------------------------------------------------------------------

export type WorkspaceStatusUpdate = Partial<
  Pick<Workspace, "status" | "runtimeUrl" | "containerId" | "failureReason">
>;

export type MembershipRecord = {
  workspaceId: EntityId<"workspaceId">;
  memberId: EntityId<"memberId">;
  role: string;
};

export interface WorkspaceRepository {
  save(workspace: Workspace): Promise<Workspace>;
  findById(workspaceId: EntityId<"workspaceId">): Promise<Workspace | null>;
  listAccessibleByUser(userId: EntityId<"userId">): Promise<Workspace[]>;
  findActiveMembershipByUser(userId: EntityId<"userId">): Promise<MembershipRecord | null>;
  updateStatus(
    workspaceId: EntityId<"workspaceId">,
    update: WorkspaceStatusUpdate,
    now: string
  ): Promise<Workspace>;
}
