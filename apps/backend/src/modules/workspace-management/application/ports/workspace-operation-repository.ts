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
  WorkspaceReadContext,
  WorkspaceTransaction
} from "./workspace-persistence-types.ts";

export interface WorkspaceOperationRepository {
  create(
    input: CreateWorkspaceOperationInput,
    tx: WorkspaceTransaction
  ): Promise<WorkspaceOperationRecord>;

  findById(
    operationId: string,
    tx?: WorkspaceReadContext
  ): Promise<WorkspaceOperationRecord | null>;

  findActiveByWorkspaceAndFamily(input: {
    workspaceId: string;
    operationFamily: WorkspaceOperationFamily;
    tx?: WorkspaceReadContext;
  }): Promise<WorkspaceOperationRecord | null>;

  claimNextDueOperation(input: {
    workerId: string;
    leaseToken: string;
    now: string;
    leaseExpiresAt: string;
    supportedFamilies?: WorkspaceOperationFamily[];
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null>;

  renewLease(input: {
    operationId: string;
    leaseToken: string;
    expectedVersion: number;
    leaseExpiresAt: string;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null>;

  markSucceeded(input: {
    operationId: string;
    leaseToken: string;
    expectedVersion: number;
    completedAt: string;
    patch?: WorkspaceOperationCompletionPatch;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null>;

  scheduleRetry(input: {
    operationId: string;
    leaseToken: string;
    expectedVersion: number;
    nextAttemptAt: string;
    safeFailure: WorkspaceSafeFailure;
    executionPhase?: WorkspaceExecutionPhase;
    runtimeFinalityProof?: RuntimeFinalityProof;
    reconciliationRequiredAt?: string | null;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null>;

  markFailed(input: {
    operationId: string;
    leaseToken: string;
    expectedVersion: number;
    failedAt: string;
    safeFailure: WorkspaceSafeFailure;
    runtimeFinalityProof: RuntimeFinalityProof;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null>;

  requestCancellation(input: {
    operationId: string;
    expectedVersion: number;
    requestedAt: string;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null>;

  markSuperseded(input: {
    operationId: string;
    supersededByOperationId: string;
    expectedVersion: number;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord | null>;
}
