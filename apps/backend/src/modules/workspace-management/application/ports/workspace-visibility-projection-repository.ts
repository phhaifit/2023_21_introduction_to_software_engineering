import type {
  WorkspaceProjectionCandidatePage,
  WorkspaceReadContext,
  WorkspaceTransaction,
  WorkspaceVisibilityCursor,
  WorkspaceVisibilityProjectionRecord
} from "./workspace-persistence-types.ts";

export interface WorkspaceVisibilityProjectionRepository {
  upsertAccess(input: {
    userId: string;
    workspaceId: string;
    canRead: boolean;
    canDelete: boolean;
    membershipVersion: number;
    projectionUpdatedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceVisibilityProjectionRecord>;

  revokeAccess(input: {
    userId: string;
    workspaceId: string;
    membershipVersion: number;
    projectionUpdatedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<boolean>;

  listCandidateWorkspaceIds(input: {
    userId: string;
    cursor?: WorkspaceVisibilityCursor;
    limit: number;
    tx?: WorkspaceReadContext;
  }): Promise<WorkspaceProjectionCandidatePage>;
}
