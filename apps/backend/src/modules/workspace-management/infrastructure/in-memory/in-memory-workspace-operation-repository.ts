import type {
  RuntimeFinalityProof,
  WorkspaceExecutionPhase,
  WorkspaceOperationFamily
} from "../../domain/workspace-types.ts";
import type { WorkspaceSafeFailure } from "../../domain/workspace-failure.ts";
import type {
  CreateWorkspaceOperationInput,
  WorkspaceOperationCompletionPatch,
  WorkspaceOperationRecord,
  WorkspaceTransaction
} from "../../application/ports/workspace-persistence-types.ts";
import type { WorkspaceOperationRepository } from "../../application/ports/workspace-operation-repository.ts";

export class InMemoryWorkspaceOperationRepository implements WorkspaceOperationRepository {
  readonly records: WorkspaceOperationRecord[] = [];

  seed(record: WorkspaceOperationRecord): void {
    this.records.push(record);
  }

  async create(
    input: CreateWorkspaceOperationInput,
    _tx: WorkspaceTransaction
  ): Promise<WorkspaceOperationRecord> {
    const record: WorkspaceOperationRecord = {
      status: "queued",
      executionPhase: "execute",
      runtimeFinalityProof: "runtime_unknown",
      attemptCount: 0,
      maxAttempts: 5,
      version: 1,
      ...input
    };
    this.records.push(record);
    return record;
  }

  async findById(
    operationId: string,
    _tx?: WorkspaceTransaction
  ): Promise<WorkspaceOperationRecord | null> {
    return this.records.find((r) => r.operationId === operationId) ?? null;
  }

  async findActiveByWorkspaceAndFamily(input: {
    workspaceId: string;
    operationFamily: WorkspaceOperationFamily;
    tx?: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null> {
    return (
      this.records.find(
        (r) =>
          r.workspaceId === input.workspaceId &&
          r.operationFamily === input.operationFamily &&
          ["queued", "blocked", "running", "retry_scheduled"].includes(r.status)
      ) ?? null
    );
  }

  async claimNextDueOperation(input: {
    workerId: string;
    leaseToken: string;
    now: string;
    leaseExpiresAt: string;
    supportedFamilies?: WorkspaceOperationFamily[];
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null> {
    const index = this.records.findIndex(
      (r) =>
        (r.status === "queued" || r.status === "retry_scheduled") &&
        (r.nextAttemptAt === null || r.nextAttemptAt <= input.now) &&
        (!input.supportedFamilies || input.supportedFamilies.includes(r.operationFamily))
    );
    if (index < 0) return null;
    const current = this.records[index] as WorkspaceOperationRecord;
    const claimed: WorkspaceOperationRecord = {
      ...current,
      status: "running",
      claimedByWorkerId: input.workerId,
      leaseToken: input.leaseToken,
      leaseExpiresAt: input.leaseExpiresAt,
      lastAttemptAt: input.now,
      attemptCount: current.attemptCount + 1,
      updatedAt: input.now,
      version: current.version + 1
    };
    this.records[index] = claimed;
    return claimed;
  }

  async renewLease(input: {
    operationId: string;
    leaseToken: string;
    expectedVersion: number;
    leaseExpiresAt: string;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null> {
    return this.mutateClaimed(input, { leaseExpiresAt: input.leaseExpiresAt });
  }

  async markSucceeded(input: {
    operationId: string;
    leaseToken: string;
    expectedVersion: number;
    completedAt: string;
    patch?: WorkspaceOperationCompletionPatch;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null> {
    return this.mutateClaimed(input, {
      status: "succeeded",
      completedAt: input.completedAt,
      updatedAt: input.completedAt,
      leaseToken: null,
      leaseExpiresAt: null,
      ...input.patch
    });
  }

  async scheduleRetry(input: {
    operationId: string;
    leaseToken: string;
    expectedVersion: number;
    nextAttemptAt: string;
    safeFailure: WorkspaceSafeFailure;
    executionPhase?: WorkspaceExecutionPhase;
    runtimeFinalityProof?: RuntimeFinalityProof;
    reconciliationRequiredAt?: string | null;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null> {
    return this.mutateClaimed(input, {
      status: "retry_scheduled",
      nextAttemptAt: input.nextAttemptAt,
      lastErrorCode: input.safeFailure.code,
      lastErrorMessage: input.safeFailure.message,
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: input.nextAttemptAt,
      ...(input.executionPhase !== undefined ? { executionPhase: input.executionPhase } : {}),
      ...(input.runtimeFinalityProof !== undefined ? { runtimeFinalityProof: input.runtimeFinalityProof } : {}),
      ...(input.reconciliationRequiredAt !== undefined ? { reconciliationRequiredAt: input.reconciliationRequiredAt } : {})
    });
  }

  async markFailed(input: {
    operationId: string;
    leaseToken: string;
    expectedVersion: number;
    failedAt: string;
    safeFailure: WorkspaceSafeFailure;
    runtimeFinalityProof: RuntimeFinalityProof;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null> {
    return this.mutateClaimed(input, {
      status: "failed",
      failedAt: input.failedAt,
      updatedAt: input.failedAt,
      lastErrorCode: input.safeFailure.code,
      lastErrorMessage: input.safeFailure.message,
      runtimeFinalityProof: input.runtimeFinalityProof,
      leaseToken: null,
      leaseExpiresAt: null
    });
  }

  async requestCancellation(input: {
    operationId: string;
    expectedVersion: number;
    requestedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null> {
    const index = this.records.findIndex(
      (r) =>
        r.operationId === input.operationId && r.version === input.expectedVersion
    );
    if (index < 0) return null;
    const current = this.records[index] as WorkspaceOperationRecord;
    const next: WorkspaceOperationRecord = {
      ...current,
      cancellationRequestedAt: input.requestedAt,
      updatedAt: input.requestedAt,
      version: current.version + 1
    };
    this.records[index] = next;
    return next;
  }

  async markSuperseded(input: {
    operationId: string;
    supersededByOperationId: string;
    expectedVersion: number;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null> {
    const index = this.records.findIndex(
      (r) =>
        r.operationId === input.operationId && r.version === input.expectedVersion
    );
    if (index < 0) return null;
    const current = this.records[index] as WorkspaceOperationRecord;
    const next: WorkspaceOperationRecord = {
      ...current,
      status: "superseded",
      supersedesOperationId: input.supersededByOperationId,
      version: current.version + 1
    };
    this.records[index] = next;
    return next;
  }

  private mutateClaimed(
    input: { operationId: string; leaseToken: string; expectedVersion: number },
    patch: Partial<WorkspaceOperationRecord>
  ): WorkspaceOperationRecord | null {
    const index = this.records.findIndex(
      (r) =>
        r.operationId === input.operationId &&
        r.leaseToken === input.leaseToken &&
        r.version === input.expectedVersion
    );
    if (index < 0) return null;
    const current = this.records[index] as WorkspaceOperationRecord;
    const next: WorkspaceOperationRecord = { ...current, ...patch, version: current.version + 1 };
    this.records[index] = next;
    return next;
  }
}
