import type { WorkspaceLifecycleStatus } from "../../domain/workspace-types.ts";
import type {
  CreateWorkspacePersistenceInput,
  WorkspaceKeysetCursor,
  WorkspaceLifecyclePatch,
  WorkspacePersistenceRecord,
  WorkspaceTransaction
} from "../../application/ports/workspace-persistence-types.ts";
import type { WorkspaceRepository } from "../../application/ports/workspace-repository.ts";

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  readonly records: WorkspacePersistenceRecord[] = [];

  seed(record: WorkspacePersistenceRecord): void {
    this.records.push(record);
  }

  async create(
    input: CreateWorkspacePersistenceInput,
    _tx: WorkspaceTransaction
  ): Promise<WorkspacePersistenceRecord> {
    const record: WorkspacePersistenceRecord = {
      lifecycleVersion: 1,
      eventSequence: 0,
      ownerBootstrapState: "not_applicable",
      ownerBootstrapAttemptVersion: 0,
      provisioningProfileSource: "resolved",
      migrationOrigin: "native",
      runtimeVerificationState: "unknown",
      ...input
    };
    this.records.push(record);
    return record;
  }

  async findById(
    workspaceId: string,
    _tx?: WorkspaceTransaction
  ): Promise<WorkspacePersistenceRecord | null> {
    return this.records.find((r) => r.workspaceId === workspaceId) ?? null;
  }

  async findByIds(input: {
    workspaceIds: string[];
    excludeDeleted?: boolean;
    tx?: WorkspaceTransaction;
  }): Promise<WorkspacePersistenceRecord[]> {
    return this.records.filter(
      (r) =>
        input.workspaceIds.includes(r.workspaceId) &&
        (!input.excludeDeleted || r.status !== "deleted")
    );
  }

  async findPendingBootstrapByCreator(input: {
    createdByUserId: string;
    now: string;
    cursor?: WorkspaceKeysetCursor;
    limit: number;
    tx?: WorkspaceTransaction;
  }): Promise<WorkspacePersistenceRecord[]> {
    return this.records
      .filter(
        (r) =>
          r.createdByUserId === input.createdByUserId &&
          r.ownerBootstrapState === "pending" &&
          r.ownerBootstrapExpiresAt !== null &&
          r.ownerBootstrapExpiresAt > input.now
      )
      .slice(0, input.limit);
  }

  async updateLifecycleIfVersion(input: {
    workspaceId: string;
    expectedLifecycleVersion: number;
    nextStatus: WorkspaceLifecycleStatus;
    patch: WorkspaceLifecyclePatch;
    tx: WorkspaceTransaction;
  }): Promise<WorkspacePersistenceRecord | null> {
    const index = this.records.findIndex(
      (r) =>
        r.workspaceId === input.workspaceId &&
        r.lifecycleVersion === input.expectedLifecycleVersion
    );
    if (index < 0) return null;
    const current = this.records[index] as WorkspacePersistenceRecord;
    const next: WorkspacePersistenceRecord = {
      ...current,
      ...input.patch,
      status: input.nextStatus,
      lifecycleVersion: current.lifecycleVersion + 1
    };
    this.records[index] = next;
    return next;
  }

  async allocateNextEventSequence(input: {
    workspaceId: string;
    tx: WorkspaceTransaction;
  }): Promise<number> {
    const index = this.records.findIndex((r) => r.workspaceId === input.workspaceId);
    if (index < 0) throw new Error(`Workspace ${input.workspaceId} not found`);
    const current = this.records[index] as WorkspacePersistenceRecord;
    const next = { ...current, eventSequence: current.eventSequence + 1 };
    this.records[index] = next;
    return next.eventSequence;
  }
}
