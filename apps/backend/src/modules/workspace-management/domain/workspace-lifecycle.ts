import {
  ACTIVE_WORKSPACE_OPERATION_STATUSES,
  workspaceDomainError,
  type WorkspaceDomainErrorCode,
  type WorkspaceLifecycleStatus,
  type WorkspaceState,
  type WorkspaceTransitionCommand,
  type WorkspaceTransitionDecision
} from "./workspace-types.ts";

export function transitionWorkspace(
  current: WorkspaceState | null,
  command: WorkspaceTransitionCommand
): WorkspaceTransitionDecision {
  if (command.type === "CreateWorkspace") {
    if (current !== null) {
      return reject("workspace.lifecycle_conflict", "Workspace already exists.");
    }
    return {
      accepted: true,
      nextState: {
        workspaceId: command.workspaceId,
        status: "provisioning",
        lifecycleVersion: 1,
        deleteRequested: false,
        runtimeFinalityProof: "runtime_unknown",
        activeProvisionOperation: null,
        activeDeprovisionOperation: null
      }
    };
  }

  if (current === null) {
    return reject("workspace.lifecycle_conflict", "Workspace does not exist.");
  }

  if (current.status === "deleted") {
    return reject("workspace.deleted_terminal", "Workspace is deleted and cannot be modified.");
  }

  if (
    "expectedLifecycleVersion" in command &&
    command.expectedLifecycleVersion !== current.lifecycleVersion
  ) {
    return reject("workspace.stale_lifecycle_version", "Stale lifecycle version.");
  }

  switch (command.type) {
    case "ProvisionSucceeded": {
      if (current.status === "provisioning") {
        const nextStatus: WorkspaceLifecycleStatus = current.deleteRequested ? "deleting" : "active";
        return {
          accepted: true,
          nextState: advance(current, nextStatus, { runtimeFinalityProof: command.runtimeFinalityProof }),
          suppressReadyEvent: current.deleteRequested || undefined,
          requiresDeprovisionOperation: current.deleteRequested || undefined
        };
      }
      if (current.status === "deleting") {
        return {
          accepted: true,
          nextState: advance(current, "deleting", { runtimeFinalityProof: command.runtimeFinalityProof }),
          suppressReadyEvent: true
        };
      }
      return reject("workspace.lifecycle_conflict", `ProvisionSucceeded not valid in status "${current.status}".`);
    }

    case "ProvisionFailedTerminal": {
      if (current.status !== "provisioning") {
        return reject("workspace.lifecycle_conflict", `ProvisionFailedTerminal not valid in status "${current.status}".`);
      }
      return { accepted: true, nextState: advance(current, "failed", {}) };
    }

    case "RequestDelete": {
      if (current.status === "deleting") {
        return { accepted: true, nextState: { ...current } };
      }
      if (current.status === "active") {
        return {
          accepted: true,
          nextState: advance(current, "deleting", { deleteRequested: true }),
          requiresDeprovisionOperation: true,
          requiresRuntimeCleanup:
            current.runtimeFinalityProof === "runtime_present_confirmed" || undefined
        };
      }
      if (current.status === "provisioning") {
        return {
          accepted: true,
          nextState: advance(current, "deleting", { deleteRequested: true }),
          requiresProvisionCancellation: current.activeProvisionOperation ? true : undefined,
          requiresDeprovisionOperation: true
        };
      }
      if (current.status === "failed") {
        return {
          accepted: true,
          nextState: advance(current, "deleting", { deleteRequested: true }),
          requiresReconciliation: true,
          nextExecutionPhase: "reconcile"
        };
      }
      return reject("workspace.lifecycle_conflict", `RequestDelete not valid in status "${current.status}".`);
    }

    case "DeprovisionSucceeded": {
      if (current.status !== "deleting") {
        return reject("workspace.lifecycle_conflict", `DeprovisionSucceeded not valid in status "${current.status}".`);
      }
      const canDelete =
        command.cleanupSucceeded || command.runtimeFinalityProof === "runtime_absent_final";
      if (!canDelete) {
        return reject(
          "workspace.lifecycle_conflict",
          "Deprovision succeeded but runtime finality is not confirmed absent or cleanup not succeeded."
        );
      }
      return {
        accepted: true,
        nextState: advance(current, "deleted", { runtimeFinalityProof: command.runtimeFinalityProof })
      };
    }

    case "DeprovisionFailedTerminal": {
      if (current.status !== "deleting") {
        return reject("workspace.lifecycle_conflict", `DeprovisionFailedTerminal not valid in status "${current.status}".`);
      }
      return { accepted: true, nextState: advance(current, "delete_failed", {}) };
    }

    case "RequestDeleteRetry": {
      if (current.status !== "delete_failed") {
        return reject("workspace.lifecycle_conflict", `RequestDeleteRetry not valid in status "${current.status}".`);
      }
      const activeOp = current.activeDeprovisionOperation;
      if (
        activeOp &&
        (ACTIVE_WORKSPACE_OPERATION_STATUSES as readonly string[]).includes(activeOp.status)
      ) {
        return reject(
          "workspace.lifecycle_conflict",
          "Cannot retry delete while an active deprovision operation exists."
        );
      }
      return {
        accepted: true,
        nextState: advance(current, "deleting", {}),
        requiresReconciliation: true,
        nextExecutionPhase: "reconcile"
      };
    }

    case "RetryProvisionInternal": {
      if (current.status !== "failed") {
        return reject("workspace.lifecycle_conflict", `RetryProvisionInternal not valid in status "${current.status}".`);
      }
      return {
        accepted: true,
        nextState: advance(current, "provisioning", { runtimeFinalityProof: "runtime_unknown" })
      };
    }
  }
}

function advance(
  current: WorkspaceState,
  nextStatus: WorkspaceLifecycleStatus,
  overrides: Partial<WorkspaceState>
): WorkspaceState {
  const statusChanged = nextStatus !== current.status;
  return {
    ...current,
    ...overrides,
    status: nextStatus,
    lifecycleVersion: statusChanged ? current.lifecycleVersion + 1 : current.lifecycleVersion
  };
}

function reject(code: WorkspaceDomainErrorCode, message: string): WorkspaceTransitionDecision {
  return { accepted: false, error: workspaceDomainError(code, message) };
}
