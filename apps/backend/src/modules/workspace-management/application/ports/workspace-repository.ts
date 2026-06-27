import type { WorkspaceLifecycleStatus } from "../../domain/workspace-types.ts";
import type {
  CreateWorkspacePersistenceInput,
  WorkspaceKeysetCursor,
  WorkspaceLifecyclePatch,
  WorkspacePersistenceRecord,
  WorkspaceReadContext,
  WorkspaceTransaction
} from "./workspace-persistence-types.ts";

export interface WorkspaceRepository {
  create(
    input: CreateWorkspacePersistenceInput,
    tx: WorkspaceTransaction
  ): Promise<WorkspacePersistenceRecord>;

  findById(
    workspaceId: string,
    tx?: WorkspaceReadContext
  ): Promise<WorkspacePersistenceRecord | null>;

  findByIds(input: {
    workspaceIds: string[];
    excludeDeleted?: boolean;
    tx?: WorkspaceReadContext;
  }): Promise<WorkspacePersistenceRecord[]>;

  findPendingBootstrapByCreator(input: {
    createdByUserId: string;
    now: string;
    cursor?: WorkspaceKeysetCursor;
    limit: number;
    tx?: WorkspaceReadContext;
  }): Promise<WorkspacePersistenceRecord[]>;

  updateLifecycleIfVersion(input: {
    workspaceId: string;
    expectedLifecycleVersion: number;
    nextStatus: WorkspaceLifecycleStatus;
    patch: WorkspaceLifecyclePatch;
    tx: WorkspaceTransaction;
  }): Promise<WorkspacePersistenceRecord | null>;

  allocateNextEventSequence(input: {
    workspaceId: string;
    tx: WorkspaceTransaction;
  }): Promise<number>;
}
