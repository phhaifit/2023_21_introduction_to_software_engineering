import type { WorkspaceSafeFailure } from "./workspace-failure.ts";

export const WORKSPACE_LIFECYCLE_STATUSES = [
  "provisioning",
  "active",
  "failed",
  "deleting",
  "delete_failed",
  "deleted"
] as const;

export type WorkspaceLifecycleStatus =
  (typeof WORKSPACE_LIFECYCLE_STATUSES)[number];

export const WORKSPACE_OPERATION_FAMILIES = [
  "provisioning",
  "deprovisioning"
] as const;

export type WorkspaceOperationFamily =
  (typeof WORKSPACE_OPERATION_FAMILIES)[number];

export const WORKSPACE_OPERATION_STATUSES = [
  "queued",
  "blocked",
  "running",
  "retry_scheduled",
  "succeeded",
  "failed",
  "cancelled",
  "superseded"
] as const;

export type WorkspaceOperationStatus =
  (typeof WORKSPACE_OPERATION_STATUSES)[number];

export const ACTIVE_WORKSPACE_OPERATION_STATUSES = [
  "queued",
  "blocked",
  "running",
  "retry_scheduled"
] as const satisfies readonly WorkspaceOperationStatus[];

export type ActiveWorkspaceOperationStatus =
  (typeof ACTIVE_WORKSPACE_OPERATION_STATUSES)[number];

export const WORKSPACE_EXECUTION_PHASES = ["execute", "reconcile"] as const;

export type WorkspaceExecutionPhase =
  (typeof WORKSPACE_EXECUTION_PHASES)[number];

export const RUNTIME_FINALITY_PROOFS = [
  "runtime_present_confirmed",
  "runtime_absent_final",
  "runtime_unknown",
  "provision_call_cancelled_before_dispatch"
] as const;

export type RuntimeFinalityProof = (typeof RUNTIME_FINALITY_PROOFS)[number];

export type WorkspaceOperationSnapshot = {
  readonly operationId: string;
  readonly operationFamily: WorkspaceOperationFamily;
  readonly status: WorkspaceOperationStatus;
  readonly executionPhase: WorkspaceExecutionPhase;
  readonly runtimeFinalityProof?: RuntimeFinalityProof;
};

export type WorkspaceState = {
  readonly workspaceId: string;
  readonly status: WorkspaceLifecycleStatus;
  readonly lifecycleVersion: number;
  readonly deleteRequested: boolean;
  readonly runtimeFinalityProof: RuntimeFinalityProof;
  readonly activeProvisionOperation: WorkspaceOperationSnapshot | null;
  readonly activeDeprovisionOperation: WorkspaceOperationSnapshot | null;
};

type VersionedWorkspaceTransitionCommand = {
  readonly expectedLifecycleVersion: number;
};

export type WorkspaceTransitionCommand =
  | {
      readonly type: "CreateWorkspace";
      readonly workspaceId: string;
    }
  | (VersionedWorkspaceTransitionCommand & {
      readonly type: "ProvisionSucceeded";
      readonly runtimeFinalityProof: "runtime_present_confirmed";
    })
  | (VersionedWorkspaceTransitionCommand & {
      readonly type: "ProvisionFailedTerminal";
      readonly failure?: WorkspaceSafeFailure;
    })
  | (VersionedWorkspaceTransitionCommand & {
      readonly type: "RequestDelete";
    })
  | (VersionedWorkspaceTransitionCommand & {
      readonly type: "DeprovisionSucceeded";
      readonly cleanupSucceeded: boolean;
      readonly runtimeFinalityProof: RuntimeFinalityProof;
    })
  | (VersionedWorkspaceTransitionCommand & {
      readonly type: "DeprovisionFailedTerminal";
      readonly failure?: WorkspaceSafeFailure;
    })
  | (VersionedWorkspaceTransitionCommand & {
      readonly type: "RequestDeleteRetry";
      readonly priorOutcomeReconciled: boolean;
    })
  | (VersionedWorkspaceTransitionCommand & {
      readonly type: "RetryProvisionInternal";
      readonly priorOutcomeReconciled?: boolean;
    });

export const WORKSPACE_DOMAIN_ERROR_CODES = [
  "workspace.validation_failed",
  "workspace.lifecycle_conflict",
  "workspace.stale_lifecycle_version",
  "workspace.deleted_terminal",
  "workspace.unsafe_failure"
] as const;

export type WorkspaceDomainErrorCode =
  (typeof WORKSPACE_DOMAIN_ERROR_CODES)[number];

export type WorkspaceValidationIssue = {
  readonly path: string;
  readonly message: string;
  readonly code?: string;
};

export type WorkspaceDomainError = {
  readonly code: WorkspaceDomainErrorCode;
  readonly message: string;
  readonly issues?: readonly WorkspaceValidationIssue[];
};

export type DomainResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: WorkspaceDomainError;
    };

export type WorkspaceTransitionDecision = {
  readonly accepted: boolean;
  readonly nextState?: WorkspaceState;
  readonly error?: WorkspaceDomainError;
  readonly requiresProvisionCancellation?: boolean;
  readonly requiresDeprovisionOperation?: boolean;
  readonly requiresReconciliation?: boolean;
  readonly requiresRuntimeCleanup?: boolean;
  readonly suppressReadyEvent?: boolean;
  readonly nextExecutionPhase?: WorkspaceExecutionPhase;
};

export function workspaceDomainError(
  code: WorkspaceDomainErrorCode,
  message: string,
  issues?: readonly WorkspaceValidationIssue[]
): WorkspaceDomainError {
  return issues && issues.length > 0 ? { code, message, issues } : { code, message };
}
