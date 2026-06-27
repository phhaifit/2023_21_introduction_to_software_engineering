import { describe, expect, it } from "vitest";

import {
  compareWorkspaceCommandIdempotency,
  createSafeWorkspaceFailure,
  transitionWorkspace,
  validateRequestedWorkspaceIntent,
  validateWorkspaceName
} from "./index.ts";
import type {
  WorkspaceCommandIdempotencyInput,
  WorkspaceOperationSnapshot,
  WorkspaceState
} from "./index.ts";

const workspaceId = "workspace-1";

function state(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
  return {
    workspaceId,
    status: "provisioning",
    lifecycleVersion: 1,
    deleteRequested: false,
    runtimeFinalityProof: "runtime_unknown",
    activeProvisionOperation: null,
    activeDeprovisionOperation: null,
    ...overrides
  };
}

function operation(
  overrides: Partial<WorkspaceOperationSnapshot> = {}
): WorkspaceOperationSnapshot {
  return {
    operationId: "operation-1",
    operationFamily: "provisioning",
    status: "running",
    executionPhase: "execute",
    runtimeFinalityProof: "runtime_unknown",
    ...overrides
  };
}

describe("Workspace name and profile validation", () => {
  it("valid_name_is_trimmed_collapsed_and_normalized", () => {
    const result = validateWorkspaceName("  Acme    Operations  ");

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.displayName : "").toBe("Acme Operations");
    expect(result.ok ? result.value.normalizedName : "").toBe("acme operations");
  });

  it("empty_name_is_rejected", () => {
    const result = validateWorkspaceName("");

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error.issues?.[0]?.code).toBe("workspace_name_empty");
  });

  it("whitespace_only_name_is_rejected", () => {
    const result = validateWorkspaceName("       ");

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error.issues?.[0]?.code).toBe("workspace_name_empty");
  });

  it("control_character_name_is_rejected", () => {
    const asciiControl = validateWorkspaceName("Acme\u0007Ops");
    const unicodeControl = validateWorkspaceName("Acme\u200BOps");

    expect(asciiControl.ok).toBe(false);
    expect(unicodeControl.ok).toBe(false);
    expect(asciiControl.ok ? "" : asciiControl.error.issues?.[0]?.code).toBe(
      "workspace_name_control_character"
    );
  });

  it("name_over_80_characters_is_rejected", () => {
    const result = validateWorkspaceName("a".repeat(81));

    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error.issues?.[0]?.code).toBe(
      "workspace_name_too_long"
    );
  });

  it("standard_profile_is_accepted", () => {
    const result = validateRequestedWorkspaceIntent({
      name: "  Standard Workspace  ",
      requestedProfile: "standard"
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value : null).toEqual({
      name: "Standard Workspace",
      requestedProfile: "standard"
    });
  });

  it("premium_profile_is_accepted", () => {
    const result = validateRequestedWorkspaceIntent({
      name: "Premium Workspace",
      requestedProfile: "premium"
    });

    expect(result.ok).toBe(true);
    expect(result.ok ? result.value.requestedProfile : "").toBe("premium");
  });

  it("unknown_profile_is_rejected", () => {
    const result = validateRequestedWorkspaceIntent({
      name: "Unknown Profile",
      requestedProfile: "enterprise"
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.error.issues?.map((issue) => issue.code)).toContain(
      "workspace_requested_profile_invalid"
    );
  });

  it("client_resource_limits_are_not_accepted", () => {
    const result = validateRequestedWorkspaceIntent({
      name: "Resource Injection",
      requestedProfile: "standard",
      cpuLimit: 16,
      memoryMb: 65536,
      runtimeUrl: "https://runtime.example"
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.error.issues?.map((issue) => issue.code)).toContain(
      "workspace_intent_forbidden_field"
    );
  });
});

describe("Workspace lifecycle transition guard", () => {
  it("create_enters_provisioning_with_lifecycle_version_one", () => {
    const decision = transitionWorkspace(null, {
      type: "CreateWorkspace",
      workspaceId
    });

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("provisioning");
    expect(decision.nextState?.lifecycleVersion).toBe(1);
    expect(decision.nextState?.deleteRequested).toBe(false);
  });

  it("provision_success_enters_active", () => {
    const decision = transitionWorkspace(state(), {
      type: "ProvisionSucceeded",
      expectedLifecycleVersion: 1,
      runtimeFinalityProof: "runtime_present_confirmed"
    });

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("active");
    expect(decision.nextState?.lifecycleVersion).toBe(2);
  });

  it("provision_success_after_delete_stays_deleting", () => {
    const decision = transitionWorkspace(
      state({
        deleteRequested: true,
        activeProvisionOperation: operation()
      }),
      {
        type: "ProvisionSucceeded",
        expectedLifecycleVersion: 1,
        runtimeFinalityProof: "runtime_present_confirmed"
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("deleting");
    expect(decision.suppressReadyEvent).toBe(true);
    expect(decision.requiresDeprovisionOperation).toBe(true);
  });

  it("late_provision_success_after_delete_request_suppresses_ready_event", () => {
    const decision = transitionWorkspace(
      state({
        status: "deleting",
        lifecycleVersion: 2,
        deleteRequested: true,
        activeProvisionOperation: operation()
      }),
      {
        type: "ProvisionSucceeded",
        expectedLifecycleVersion: 2,
        runtimeFinalityProof: "runtime_present_confirmed"
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("deleting");
    expect(decision.nextState?.lifecycleVersion).toBe(2);
    expect(decision.suppressReadyEvent).toBe(true);
  });

  it("provision_failure_terminal_enters_failed", () => {
    const decision = transitionWorkspace(state(), {
      type: "ProvisionFailedTerminal",
      expectedLifecycleVersion: 1
    });

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("failed");
  });

  it("delete_from_provisioning_requires_cancellation_and_dependency", () => {
    const decision = transitionWorkspace(
      state({ activeProvisionOperation: operation() }),
      {
        type: "RequestDelete",
        expectedLifecycleVersion: 1
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("deleting");
    expect(decision.requiresProvisionCancellation).toBe(true);
    expect(decision.requiresDeprovisionOperation).toBe(true);
  });

  it("delete_from_active_requires_deprovision", () => {
    const decision = transitionWorkspace(
      state({ status: "active", runtimeFinalityProof: "runtime_present_confirmed" }),
      {
        type: "RequestDelete",
        expectedLifecycleVersion: 1
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("deleting");
    expect(decision.requiresDeprovisionOperation).toBe(true);
    expect(decision.requiresRuntimeCleanup).toBe(true);
  });

  it("delete_from_failed_requires_reconciliation", () => {
    const decision = transitionWorkspace(
      state({ status: "failed", runtimeFinalityProof: "runtime_unknown" }),
      {
        type: "RequestDelete",
        expectedLifecycleVersion: 1
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("deleting");
    expect(decision.requiresReconciliation).toBe(true);
    expect(decision.nextExecutionPhase).toBe("reconcile");
  });

  it("delete_cannot_finish_without_cleanup_success_or_runtime_absent_final", () => {
    const decision = transitionWorkspace(
      state({ status: "deleting", lifecycleVersion: 2, deleteRequested: true }),
      {
        type: "DeprovisionSucceeded",
        expectedLifecycleVersion: 2,
        cleanupSucceeded: false,
        runtimeFinalityProof: "runtime_unknown"
      }
    );

    expect(decision.accepted).toBe(false);
    expect(decision.error?.code).toBe("workspace.lifecycle_conflict");
  });

  it("delete_with_cleanup_success_enters_deleted", () => {
    const decision = transitionWorkspace(
      state({ status: "deleting", lifecycleVersion: 2, deleteRequested: true }),
      {
        type: "DeprovisionSucceeded",
        expectedLifecycleVersion: 2,
        cleanupSucceeded: true,
        runtimeFinalityProof: "runtime_present_confirmed"
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("deleted");
  });

  it("delete_with_runtime_absent_final_enters_deleted", () => {
    const decision = transitionWorkspace(
      state({ status: "deleting", lifecycleVersion: 2, deleteRequested: true }),
      {
        type: "DeprovisionSucceeded",
        expectedLifecycleVersion: 2,
        cleanupSucceeded: false,
        runtimeFinalityProof: "runtime_absent_final"
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("deleted");
  });

  it("deprovision_terminal_failure_enters_delete_failed", () => {
    const decision = transitionWorkspace(
      state({ status: "deleting", lifecycleVersion: 2, deleteRequested: true }),
      {
        type: "DeprovisionFailedTerminal",
        expectedLifecycleVersion: 2
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("delete_failed");
  });

  it("delete_failed_retry_starts_reconcile_phase", () => {
    const decision = transitionWorkspace(
      state({ status: "delete_failed", lifecycleVersion: 3, deleteRequested: true }),
      {
        type: "RequestDeleteRetry",
        expectedLifecycleVersion: 3,
        priorOutcomeReconciled: true
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("deleting");
    expect(decision.nextExecutionPhase).toBe("reconcile");
    expect(decision.requiresReconciliation).toBe(true);
  });

  it("delete_failed_retry_rejects_active_deprovision_operation", () => {
    const decision = transitionWorkspace(
      state({
        status: "delete_failed",
        lifecycleVersion: 3,
        deleteRequested: true,
        activeDeprovisionOperation: operation({
          operationFamily: "deprovisioning",
          status: "retry_scheduled"
        })
      }),
      {
        type: "RequestDeleteRetry",
        expectedLifecycleVersion: 3,
        priorOutcomeReconciled: true
      }
    );

    expect(decision.accepted).toBe(false);
    expect(decision.error?.code).toBe("workspace.lifecycle_conflict");
  });

  it("retry_provision_internal_enters_provisioning", () => {
    const decision = transitionWorkspace(
      state({ status: "failed", runtimeFinalityProof: "runtime_absent_final" }),
      {
        type: "RetryProvisionInternal",
        expectedLifecycleVersion: 1,
        priorOutcomeReconciled: true
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("provisioning");
  });

  it("deleted_workspace_rejects_non_terminal_commands", () => {
    const decision = transitionWorkspace(
      state({ status: "deleted", lifecycleVersion: 4, deleteRequested: true }),
      {
        type: "RequestDelete",
        expectedLifecycleVersion: 4
      }
    );

    expect(decision.accepted).toBe(false);
    expect(decision.error?.code).toBe("workspace.deleted_terminal");
  });

  it("deleting_workspace_cannot_return_to_active", () => {
    const decision = transitionWorkspace(
      state({ status: "deleting", lifecycleVersion: 2, deleteRequested: true }),
      {
        type: "ProvisionSucceeded",
        expectedLifecycleVersion: 2,
        runtimeFinalityProof: "runtime_present_confirmed"
      }
    );

    expect(decision.accepted).toBe(true);
    expect(decision.nextState?.status).toBe("deleting");
    expect(decision.nextState?.status).not.toBe("active");
  });

  it("failed_workspace_cannot_jump_to_active", () => {
    const decision = transitionWorkspace(state({ status: "failed" }), {
      type: "ProvisionSucceeded",
      expectedLifecycleVersion: 1,
      runtimeFinalityProof: "runtime_present_confirmed"
    });

    expect(decision.accepted).toBe(false);
    expect(decision.error?.code).toBe("workspace.lifecycle_conflict");
  });

  it("stale_lifecycle_version_is_rejected", () => {
    const decision = transitionWorkspace(
      state({ status: "active", lifecycleVersion: 7 }),
      {
        type: "RequestDelete",
        expectedLifecycleVersion: 6
      }
    );

    expect(decision.accepted).toBe(false);
    expect(decision.error?.code).toBe("workspace.stale_lifecycle_version");
  });

  it("lifecycle_version_increments_only_on_status_change", () => {
    const deleteDecision = transitionWorkspace(
      state({ status: "active", lifecycleVersion: 7 }),
      {
        type: "RequestDelete",
        expectedLifecycleVersion: 7
      }
    );

    expect(deleteDecision.nextState?.lifecycleVersion).toBe(8);

    const repeatedDelete = transitionWorkspace(deleteDecision.nextState ?? null, {
      type: "RequestDelete",
      expectedLifecycleVersion: 8
    });

    expect(repeatedDelete.nextState?.status).toBe("deleting");
    expect(repeatedDelete.nextState?.lifecycleVersion).toBe(8);

    const lateProvision = transitionWorkspace(repeatedDelete.nextState ?? null, {
      type: "ProvisionSucceeded",
      expectedLifecycleVersion: 8,
      runtimeFinalityProof: "runtime_present_confirmed"
    });

    expect(lateProvision.nextState?.status).toBe("deleting");
    expect(lateProvision.nextState?.lifecycleVersion).toBe(8);
  });
});

describe("Workspace command idempotency comparison", () => {
  const existing: WorkspaceCommandIdempotencyInput = {
    actorUserId: "user-a",
    commandType: "workspace.create",
    commandTarget: "collection:/api/workspaces",
    idempotencyKey: "same-key",
    requestFingerprint: "fingerprint-a"
  };

  it("same_command_scope_and_fingerprint_replays", () => {
    const outcome = compareWorkspaceCommandIdempotency({ ...existing }, existing);

    expect(outcome).toBe("replay_existing_response");
  });

  it("same_command_scope_with_different_fingerprint_conflicts", () => {
    const outcome = compareWorkspaceCommandIdempotency(
      { ...existing, requestFingerprint: "fingerprint-b" },
      existing
    );

    expect(outcome).toBe("idempotency_conflict");
  });

  it("different_actor_same_key_does_not_collide", () => {
    const outcome = compareWorkspaceCommandIdempotency(
      { ...existing, actorUserId: "user-b" },
      existing
    );

    expect(outcome).toBe("new_command");
  });

  it("same_actor_same_key_different_target_does_not_collide", () => {
    const outcome = compareWorkspaceCommandIdempotency(
      { ...existing, commandTarget: "workspace:workspace-2" },
      existing
    );

    expect(outcome).toBe("new_command");
  });
});

describe("Workspace safe failure model", () => {
  it("unsafe_provider_error_fields_are_rejected_or_removed", () => {
    const rawProviderBody = "provider body with raw stack";
    const result = createSafeWorkspaceFailure({
      code: "workspace.provision_failed",
      message: "Provisioning failed safely.",
      retryClassification: "terminal",
      providerRawResponse: rawProviderBody,
      stackTrace: rawProviderBody
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(rawProviderBody);
  });

  it("domain_failure_never_exposes_runtime_or_credential_material", () => {
    const result = createSafeWorkspaceFailure({
      code: "workspace.deprovision_failed",
      message: "runtimeUrl=https://runtime.example password=secret-value",
      retryClassification: "manual_review_required"
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("https://runtime.example");
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });
});
