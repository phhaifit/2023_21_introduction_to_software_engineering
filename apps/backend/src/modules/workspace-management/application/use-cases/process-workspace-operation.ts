import type { WorkspaceUnitOfWork } from "../ports/workspace-unit-of-work.ts";
import type { WorkspaceRepository } from "../ports/workspace-repository.ts";
import type { WorkspaceOperationRepository } from "../ports/workspace-operation-repository.ts";
import type { WorkspaceOutboxRepository } from "../ports/workspace-outbox-repository.ts";
import type { WorkspaceRuntimeProvisioningPort } from "../ports/workspace-runtime-provisioning-port.ts";
import type { WorkspaceIdFactory } from "../ports/workspace-id-factory.ts";
import type { WorkspaceClock } from "../ports/workspace-clock.ts";
import type { WorkspaceOperationRecord, WorkspacePersistenceRecord } from "../ports/workspace-persistence-types.ts";
import type { WorkspaceSafeFailure } from "../../domain/workspace-failure.ts";
import { createSafeWorkspaceFailure } from "../../domain/workspace-failure.ts";
import { WorkspaceEventFactory } from "../services/workspace-event-factory.ts";

export type ProcessDecision =
  | "provisioned_active"
  | "provisioned_after_delete_requires_cleanup"
  | "provision_failed"
  | "provision_retry_scheduled"
  | "moved_to_reconcile"
  | "reconcile_retry_scheduled"
  | "reconcile_absent_retry_provision"
  | "deprovisioned_deleted"
  | "deprovision_failed"
  | "deprovision_retry_scheduled";

export type ProcessOneResult =
  | { readonly kind: "no_operation" }
  | { readonly kind: "processed"; readonly operationId: string; readonly decision: ProcessDecision }
  | { readonly kind: "dependency_blocked"; readonly operationId: string; readonly dependsOnOperationId: string }
  | { readonly kind: "lease_lost"; readonly operationId: string };

type WorkerInput = {
  readonly workerId: string;
  readonly now: string;
  readonly leaseToken: string;
  readonly leaseExpiresAt: string;
};

export class ProcessWorkspaceOperationUseCase {
  private readonly unitOfWork: WorkspaceUnitOfWork;
  private readonly workspaces: WorkspaceRepository;
  private readonly operations: WorkspaceOperationRepository;
  private readonly outbox: WorkspaceOutboxRepository;
  private readonly runtime: WorkspaceRuntimeProvisioningPort;
  private readonly ids: WorkspaceIdFactory;
  private readonly clock: WorkspaceClock;
  private readonly events: WorkspaceEventFactory;

  constructor(
    unitOfWork: WorkspaceUnitOfWork,
    workspaces: WorkspaceRepository,
    operations: WorkspaceOperationRepository,
    outbox: WorkspaceOutboxRepository,
    runtime: WorkspaceRuntimeProvisioningPort,
    ids: WorkspaceIdFactory,
    clock: WorkspaceClock,
    events: WorkspaceEventFactory
  ) {
    this.unitOfWork = unitOfWork;
    this.workspaces = workspaces;
    this.operations = operations;
    this.outbox = outbox;
    this.runtime = runtime;
    this.ids = ids;
    this.clock = clock;
    this.events = events;
  }

  async processOne(input: WorkerInput): Promise<ProcessOneResult> {
    const operation = await this.unitOfWork.run(async (tx) =>
      this.operations.claimNextDueOperation({
        workerId: input.workerId,
        leaseToken: input.leaseToken,
        now: input.now,
        leaseExpiresAt: input.leaseExpiresAt,
        tx
      })
    );

    if (!operation) {
      return { kind: "no_operation" };
    }

    if (operation.dependsOnOperationId) {
      const dep = await this.operations.findById(operation.dependsOnOperationId);
      if (dep && dep.runtimeFinalityProof === "runtime_unknown") {
        return {
          kind: "dependency_blocked",
          operationId: operation.operationId,
          dependsOnOperationId: operation.dependsOnOperationId
        };
      }
    }

    const workspace = await this.workspaces.findById(operation.workspaceId);
    if (!workspace) {
      return { kind: "lease_lost", operationId: operation.operationId };
    }

    if (operation.operationFamily === "provisioning") {
      return this.handleProvisioning(operation, workspace, input);
    }

    return this.handleDeprovisioning(operation, workspace, input);
  }

  private async handleProvisioning(
    operation: WorkspaceOperationRecord,
    workspace: WorkspacePersistenceRecord,
    input: WorkerInput
  ): Promise<ProcessOneResult> {
    const correlationId = this.ids.nextCorrelationId();

    if (operation.executionPhase === "reconcile") {
      const statusResult = await this.runtime.getWorkspaceRuntimeStatus({
        workspaceId: workspace.workspaceId,
        operationId: operation.operationId,
        providerRequestKey: operation.providerRequestKey,
        runtimeRef: workspace.runtimeRef,
        correlationId
      });

      if (statusResult.kind === "present_confirmed") {
        return this.commitProvisionSuccess(
          operation,
          workspace,
          {
            provider: statusResult.provider ?? "unknown",
            runtimeRef: statusResult.runtimeRef ?? workspace.runtimeRef ?? "",
            runtimeUrl: null
          },
          input
        );
      }

      if (statusResult.kind === "absent_final") {
        const safeFailure = toSafeFailure("runtime.absent_during_reconcile", "Runtime not found during reconcile, retrying provision");
        const updated = await this.unitOfWork.run(async (tx) =>
          this.operations.scheduleRetry({
            operationId: operation.operationId,
            leaseToken: input.leaseToken,
            expectedVersion: operation.version,
            nextAttemptAt: this.clock.addSeconds(input.now, 30),
            safeFailure,
            executionPhase: "execute",
            tx
          })
        );
        if (!updated) return { kind: "lease_lost", operationId: operation.operationId };
        return { kind: "processed", operationId: operation.operationId, decision: "reconcile_absent_retry_provision" };
      }

      // unknown
      const safeFailure = toSafeFailure(statusResult.code, statusResult.message);
      const updated = await this.unitOfWork.run(async (tx) =>
        this.operations.scheduleRetry({
          operationId: operation.operationId,
          leaseToken: input.leaseToken,
          expectedVersion: operation.version,
          nextAttemptAt: this.clock.addSeconds(input.now, 30),
          safeFailure,
          executionPhase: "reconcile",
          tx
        })
      );
      if (!updated) return { kind: "lease_lost", operationId: operation.operationId };
      return { kind: "processed", operationId: operation.operationId, decision: "reconcile_retry_scheduled" };
    }

    // execute phase
    const provisionResult = await this.runtime.provisionWorkspace({
      workspaceId: workspace.workspaceId,
      operationId: operation.operationId,
      providerRequestKey: operation.providerRequestKey,
      resolvedProvisioningProfile: workspace.resolvedProvisioningProfile,
      correlationId
    });

    if (provisionResult.kind === "provisioned") {
      return this.commitProvisionSuccess(
        operation,
        workspace,
        {
          provider: provisionResult.provider,
          runtimeRef: provisionResult.runtimeRef,
          runtimeUrl: provisionResult.runtimeUrl ?? null
        },
        input
      );
    }

    if (provisionResult.kind === "unknown_outcome") {
      const safeFailure = toSafeFailure(provisionResult.code, provisionResult.message);
      const updated = await this.unitOfWork.run(async (tx) =>
        this.operations.scheduleRetry({
          operationId: operation.operationId,
          leaseToken: input.leaseToken,
          expectedVersion: operation.version,
          nextAttemptAt: this.clock.addSeconds(input.now, 30),
          safeFailure,
          executionPhase: "reconcile",
          tx
        })
      );
      if (!updated) return { kind: "lease_lost", operationId: operation.operationId };
      return { kind: "processed", operationId: operation.operationId, decision: "moved_to_reconcile" };
    }

    if (provisionResult.kind === "terminal_failure") {
      const safeFailure = toSafeFailure(provisionResult.code, provisionResult.message);
      const now = input.now;

      await this.unitOfWork.run(async (tx) => {
        await this.operations.markFailed({
          operationId: operation.operationId,
          leaseToken: input.leaseToken,
          expectedVersion: operation.version,
          failedAt: now,
          safeFailure,
          runtimeFinalityProof: "runtime_unknown",
          tx
        });

        await this.workspaces.updateLifecycleIfVersion({
          workspaceId: workspace.workspaceId,
          expectedLifecycleVersion: workspace.lifecycleVersion,
          nextStatus: "failed",
          patch: {
            failureCode: safeFailure.code,
            failureMessage: safeFailure.message,
            updatedAt: now
          },
          tx
        });

        await this.enqueueEvent(workspace, "workspace.provisioning_failed.v1",
          { workspaceId: workspace.workspaceId, failureCode: safeFailure.code }, now, tx);
      });

      return { kind: "processed", operationId: operation.operationId, decision: "provision_failed" };
    }

    // retryable_failure
    const safeFailure = toSafeFailure(provisionResult.code, provisionResult.message);
    const updated = await this.unitOfWork.run(async (tx) =>
      this.operations.scheduleRetry({
        operationId: operation.operationId,
        leaseToken: input.leaseToken,
        expectedVersion: operation.version,
        nextAttemptAt: this.clock.addSeconds(input.now, 30),
        safeFailure,
        tx
      })
    );
    if (!updated) return { kind: "lease_lost", operationId: operation.operationId };
    return { kind: "processed", operationId: operation.operationId, decision: "provision_retry_scheduled" };
  }

  private async commitProvisionSuccess(
    operation: WorkspaceOperationRecord,
    workspace: WorkspacePersistenceRecord,
    runtimeInfo: { provider: string; runtimeRef: string; runtimeUrl: string | null },
    input: WorkerInput
  ): Promise<ProcessOneResult> {
    const now = input.now;
    const isLateProvision = workspace.status === "deleting" || workspace.status === "deleted";

    const result = await this.unitOfWork.run(async (tx) => {
      const markedOp = await this.operations.markSucceeded({
        operationId: operation.operationId,
        leaseToken: input.leaseToken,
        expectedVersion: operation.version,
        completedAt: now,
        patch: {
          provider: runtimeInfo.provider,
          runtimeRef: runtimeInfo.runtimeRef
        },
        tx
      });
      if (!markedOp) return null;

      if (isLateProvision) {
        // Workspace already being deleted; do not activate it
        return { decision: "provisioned_after_delete_requires_cleanup" as ProcessDecision };
      }

      await this.workspaces.updateLifecycleIfVersion({
        workspaceId: workspace.workspaceId,
        expectedLifecycleVersion: workspace.lifecycleVersion,
        nextStatus: "active",
        patch: {
          provider: runtimeInfo.provider,
          runtimeRef: runtimeInfo.runtimeRef,
          runtimeUrl: runtimeInfo.runtimeUrl,
          provisionedAt: now,
          updatedAt: now
        },
        tx
      });

      await this.enqueueEvent(workspace, "workspace.ready.v1",
        { workspaceId: workspace.workspaceId }, now, tx);

      return { decision: "provisioned_active" as ProcessDecision };
    });

    if (!result) return { kind: "lease_lost", operationId: operation.operationId };
    return { kind: "processed", operationId: operation.operationId, decision: result.decision };
  }

  private async handleDeprovisioning(
    operation: WorkspaceOperationRecord,
    workspace: WorkspacePersistenceRecord,
    input: WorkerInput
  ): Promise<ProcessOneResult> {
    const correlationId = this.ids.nextCorrelationId();
    const now = input.now;

    if (operation.executionPhase === "reconcile") {
      const statusResult = await this.runtime.getWorkspaceRuntimeStatus({
        workspaceId: workspace.workspaceId,
        operationId: operation.operationId,
        providerRequestKey: operation.providerRequestKey,
        runtimeRef: workspace.runtimeRef,
        correlationId
      });

      if (statusResult.kind === "absent_final") {
        return this.commitDeprovisionSuccess(operation, workspace, "runtime_absent_final", input);
      }

      if (statusResult.kind === "present_confirmed") {
        const safeFailure = toSafeFailure("runtime.still_present", "Runtime still present during reconcile, retrying deprovision");
        const updated = await this.unitOfWork.run(async (tx) =>
          this.operations.scheduleRetry({
            operationId: operation.operationId,
            leaseToken: input.leaseToken,
            expectedVersion: operation.version,
            nextAttemptAt: this.clock.addSeconds(now, 30),
            safeFailure,
            executionPhase: "execute",
            tx
          })
        );
        if (!updated) return { kind: "lease_lost", operationId: operation.operationId };
        return { kind: "processed", operationId: operation.operationId, decision: "deprovision_retry_scheduled" };
      }

      // unknown
      const safeFailure = toSafeFailure(statusResult.code, statusResult.message);
      const updated = await this.unitOfWork.run(async (tx) =>
        this.operations.scheduleRetry({
          operationId: operation.operationId,
          leaseToken: input.leaseToken,
          expectedVersion: operation.version,
          nextAttemptAt: this.clock.addSeconds(now, 30),
          safeFailure,
          executionPhase: "reconcile",
          runtimeFinalityProof: "runtime_unknown",
          tx
        })
      );
      if (!updated) return { kind: "lease_lost", operationId: operation.operationId };
      return { kind: "processed", operationId: operation.operationId, decision: "deprovision_retry_scheduled" };
    }

    // execute phase
    const deprovisionResult = await this.runtime.deprovisionWorkspace({
      workspaceId: workspace.workspaceId,
      operationId: operation.operationId,
      providerRequestKey: operation.providerRequestKey,
      runtimeRef: workspace.runtimeRef,
      correlationId
    });

    if (deprovisionResult.kind === "deprovisioned") {
      return this.commitDeprovisionSuccess(operation, workspace, deprovisionResult.runtimeFinalityProof, input);
    }

    if (deprovisionResult.kind === "terminal_failure") {
      const safeFailure = toSafeFailure(deprovisionResult.code, deprovisionResult.message);

      await this.unitOfWork.run(async (tx) => {
        await this.operations.markFailed({
          operationId: operation.operationId,
          leaseToken: input.leaseToken,
          expectedVersion: operation.version,
          failedAt: now,
          safeFailure,
          runtimeFinalityProof: "runtime_unknown",
          tx
        });

        await this.workspaces.updateLifecycleIfVersion({
          workspaceId: workspace.workspaceId,
          expectedLifecycleVersion: workspace.lifecycleVersion,
          nextStatus: "delete_failed",
          patch: {
            failureCode: safeFailure.code,
            failureMessage: safeFailure.message,
            updatedAt: now
          },
          tx
        });

        await this.enqueueEvent(workspace, "workspace.deletion_failed.v1",
          { workspaceId: workspace.workspaceId, failureCode: safeFailure.code }, now, tx);
      });

      return { kind: "processed", operationId: operation.operationId, decision: "deprovision_failed" };
    }

    if (deprovisionResult.kind === "unknown_outcome") {
      const safeFailure = toSafeFailure(deprovisionResult.code, deprovisionResult.message);
      const updated = await this.unitOfWork.run(async (tx) =>
        this.operations.scheduleRetry({
          operationId: operation.operationId,
          leaseToken: input.leaseToken,
          expectedVersion: operation.version,
          nextAttemptAt: this.clock.addSeconds(now, 30),
          safeFailure,
          executionPhase: "reconcile",
          runtimeFinalityProof: "runtime_unknown",
          tx
        })
      );
      if (!updated) return { kind: "lease_lost", operationId: operation.operationId };
      return { kind: "processed", operationId: operation.operationId, decision: "deprovision_retry_scheduled" };
    }

    // retryable_failure
    const safeFailure = toSafeFailure(deprovisionResult.code, deprovisionResult.message);
    const updated = await this.unitOfWork.run(async (tx) =>
      this.operations.scheduleRetry({
        operationId: operation.operationId,
        leaseToken: input.leaseToken,
        expectedVersion: operation.version,
        nextAttemptAt: this.clock.addSeconds(now, 30),
        safeFailure,
        tx
      })
    );
    if (!updated) return { kind: "lease_lost", operationId: operation.operationId };
    return { kind: "processed", operationId: operation.operationId, decision: "deprovision_retry_scheduled" };
  }

  private async commitDeprovisionSuccess(
    operation: WorkspaceOperationRecord,
    workspace: WorkspacePersistenceRecord,
    runtimeFinalityProof: "runtime_absent_final",
    input: WorkerInput
  ): Promise<ProcessOneResult> {
    const now = input.now;

    const result = await this.unitOfWork.run(async (tx) => {
      const markedOp = await this.operations.markSucceeded({
        operationId: operation.operationId,
        leaseToken: input.leaseToken,
        expectedVersion: operation.version,
        completedAt: now,
        patch: { runtimeFinalityProof },
        tx
      });
      if (!markedOp) return null;

      await this.workspaces.updateLifecycleIfVersion({
        workspaceId: workspace.workspaceId,
        expectedLifecycleVersion: workspace.lifecycleVersion,
        nextStatus: "deleted",
        patch: {
          deletedAt: now,
          runtimeVerificationState: runtimeFinalityProof,
          updatedAt: now
        },
        tx
      });

      await this.enqueueEvent(workspace, "workspace.deleted.v1",
        { workspaceId: workspace.workspaceId, deletedAt: now, cleanupAuthorized: true }, now, tx);

      return markedOp;
    });

    if (!result) return { kind: "lease_lost", operationId: operation.operationId };
    return { kind: "processed", operationId: operation.operationId, decision: "deprovisioned_deleted" };
  }

  private async enqueueEvent(
    workspace: WorkspacePersistenceRecord,
    eventType: Parameters<WorkspaceEventFactory["create"]>[0]["eventType"],
    payload: Record<string, unknown>,
    now: string,
    tx: Parameters<WorkspaceOutboxRepository["enqueue"]>[1]
  ): Promise<void> {
    const seq = await this.workspaces.allocateNextEventSequence({
      workspaceId: workspace.workspaceId,
      tx
    });
    const event = this.events.create({
      eventId: this.ids.nextEventId(),
      eventType,
      aggregateId: workspace.workspaceId,
      lifecycleVersion: workspace.lifecycleVersion + 1,
      eventSequence: seq,
      occurredAt: now,
      correlationId: this.ids.nextCorrelationId(),
      payload
    });
    await this.outbox.enqueue(
      this.events.toOutboxInput(event, {
        outboxMessageId: this.ids.nextOutboxMessageId(),
        createdAt: now
      }),
      tx
    );
  }
}

function toSafeFailure(code: string, message: string): WorkspaceSafeFailure {
  const result = createSafeWorkspaceFailure({ code, message, retryClassification: "retryable" });
  if (result.ok) return result.value;
  return { code: "runtime.unknown", message: "Unknown failure", retryClassification: "retryable" };
}
