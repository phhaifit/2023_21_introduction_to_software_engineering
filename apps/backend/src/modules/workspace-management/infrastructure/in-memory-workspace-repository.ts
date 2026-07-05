import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkspaceRepository, WorkspaceStatusUpdate, MembershipRecord } from "../application/workspace-repository.ts";
import type { Workspace } from "../domain/workspace.ts";

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly store = new Map<string, Workspace>();

  async save(workspace: Workspace): Promise<Workspace> {
    this.store.set(workspace.workspaceId, { ...workspace });
    return workspace;
  }

  async findById(workspaceId: EntityId<"workspaceId">): Promise<Workspace | null> {
    return this.store.get(workspaceId) ?? null;
  }

  async listAccessibleByUser(userId: EntityId<"userId">): Promise<Workspace[]> {
    return [...this.store.values()]
      .filter((ws) => ws.userId === userId && ws.status !== "deleted")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listAllActive(): Promise<Workspace[]> {
    return [...this.store.values()]
      .filter((ws) => ws.status !== "deleted")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // In-memory store holds no WorkspaceMember records; membership resolution
  // is not supported in this stub and always returns null.
  async findActiveMembershipByUser(_userId: EntityId<"userId">): Promise<MembershipRecord | null> {
    return null;
  }

  async updateStatus(
    workspaceId: EntityId<"workspaceId">,
    update: WorkspaceStatusUpdate,
    now: string
  ): Promise<Workspace> {
    const existing = this.store.get(workspaceId);
    if (!existing) throw new Error(`Workspace not found: ${workspaceId}`);

    const updated: Workspace = {
      ...existing,
      ...update,
      updatedAt: now
    };
    this.store.set(workspaceId, updated);
    return updated;
  }
}
