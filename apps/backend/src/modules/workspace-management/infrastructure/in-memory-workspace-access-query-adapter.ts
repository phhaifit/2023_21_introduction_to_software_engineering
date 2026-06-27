import type {
  WorkspaceAccessDecision,
  WorkspaceAccessQueryPort
} from "../application/ports/workspace-access-query-port.ts";
import type { WorkspaceVisibilityProjectionRecord } from "../application/ports/workspace-persistence-types.ts";

export class InMemoryWorkspaceAccessQueryAdapter implements WorkspaceAccessQueryPort {
  private readonly records: WorkspaceVisibilityProjectionRecord[];

  constructor(records: WorkspaceVisibilityProjectionRecord[]) {
    this.records = records;
  }

  async filterAccessibleWorkspaceIds(input: {
    workspaceIds: string[];
    userId: string;
    requiredPermission: "workspace:read";
  }): Promise<{ accessibleWorkspaceIds: string[] }> {
    const accessibleWorkspaceIds = input.workspaceIds.filter((workspaceId) =>
      this.records.some(
        (r) => r.userId === input.userId && r.workspaceId === workspaceId && r.canRead
      )
    );
    return { accessibleWorkspaceIds };
  }

  async getWorkspaceAccess(input: {
    workspaceId: string;
    userId: string;
  }): Promise<WorkspaceAccessDecision> {
    const record = this.records.find(
      (r) => r.userId === input.userId && r.workspaceId === input.workspaceId && r.canRead
    );
    if (record) {
      return { kind: "allowed", canDelete: record.canDelete };
    }
    return { kind: "denied", reason: "not_found" };
  }
}
