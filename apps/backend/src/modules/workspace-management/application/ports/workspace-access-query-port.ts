export type WorkspaceAccessDecision =
  | {
      readonly kind: "allowed";
      readonly canDelete: boolean;
    }
  | {
      readonly kind: "denied";
      readonly reason: "not_found" | "forbidden" | "unavailable";
    };

export interface WorkspaceAccessQueryPort {
  filterAccessibleWorkspaceIds(input: {
    workspaceIds: string[];
    userId: string;
    requiredPermission: "workspace:read";
  }): Promise<{
    accessibleWorkspaceIds: string[];
  }>;

  getWorkspaceAccess(input: {
    workspaceId: string;
    userId: string;
  }): Promise<WorkspaceAccessDecision>;
}
