import type { WorkspaceAccessQueryPort } from "../ports/workspace-access-query-port.ts";
import type { WorkspaceClock } from "../ports/workspace-clock.ts";
import type { WorkspaceCommandReceiptRepository } from "../ports/workspace-command-receipt-repository.ts";
import type { WorkspaceIdFactory } from "../ports/workspace-id-factory.ts";
import type { WorkspaceOperationRepository } from "../ports/workspace-operation-repository.ts";
import type { WorkspaceOutboxRepository } from "../ports/workspace-outbox-repository.ts";
import type {
  JsonValue,
  WorkspaceCommandReceiptRecord,
  WorkspaceOperationRecord,
  WorkspacePersistenceRecord,
  WorkspaceTransaction
} from "../ports/workspace-persistence-types.ts";
import type { WorkspaceProviderRequestKeyFactory } from "../ports/workspace-provider-request-key-factory.ts";
import type { WorkspaceRepository } from "../ports/workspace-repository.ts";
import type { WorkspaceUnitOfWork } from "../ports/workspace-unit-of-work.ts";
import { computeWorkspaceCommandFingerprint } from "../services/workspace-command-fingerprint.ts";
import {
  WorkspaceEventFactory,
  createDeletionRequestedPayload
} from "../services/workspace-event-factory.ts";
import { hasValidPendingBootstrapAccess } from "../services/workspace-operation-planner.ts";

export type DeleteWorkspaceUseCaseResult =
  | {
      readonly kind: "accepted";
      readonly workspaceId: string;
      readonly operationId: string | null;
      readonly status: "deleting";
      readonly replayed: false;
      readonly response: JsonValue;
    }
  | {
      readonly kind: "replayed";
      readonly response: JsonValue;
    }
  | {
      readonly kind:
        | "idempotency_conflict"
        | "not_found"
        | "access_denied"
        | "unavailable"
        | "lifecycle_conflict";
      readonly message?: string;
    };

export class DeleteWorkspaceUseCase {
  private readonly unitOfWork: WorkspaceUnitOfWork;
  private readonly workspaces: WorkspaceRepository;
  private readonly operations: WorkspaceOperationRepository;
  private readonly outbox: WorkspaceOutboxRepository;
  private readonly receipts: WorkspaceCommandReceiptRepository;
  private readonly access: WorkspaceAccessQueryPort;
  private readonly ids: WorkspaceIdFactory;
  private readonly providerRequestKeys: WorkspaceProviderRequestKeyFactory;
  private readonly clock: WorkspaceClock;
  private readonly events: WorkspaceEventFactory;

  constructor(
    unitOfWork: WorkspaceUnitOfWork,
    workspaces: WorkspaceRepository,
    operations: WorkspaceOperationRepository,
    outbox: WorkspaceOutboxRepository,
    receipts: WorkspaceCommandReceiptRepository,
    access: WorkspaceAccessQueryPort,
    ids: WorkspaceIdFactory,
    providerRequestKeys: WorkspaceProviderRequestKeyFactory,
    clock: WorkspaceClock,
    events: WorkspaceEventFactory
  ) {
    this.unitOfWork = unitOfWork;
    this.workspaces = workspaces;
    this.operations = operations;
    this.outbox = outbox;
    this.receipts = receipts;
    this.access = access;
    this.ids = ids;
    this.providerRequestKeys = providerRequestKeys;
    this.clock = clock;
    this.events = events;
  }

  async execute(input: {
    actorUserId: string;
    workspaceId: string;
    idempotencyKey: string;
    priorRuntimeOutcomeReconciled?: boolean;
  }): Promise<DeleteWorkspaceUseCaseResult> {
    const now = this.clock.now();
    const requestFingerprint = computeWorkspaceCommandFingerprint({
      workspaceId: input.workspaceId,
      command: "delete",
      priorRuntimeOutcomeReconciled: input.priorRuntimeOutcomeReconciled ?? false
    });

    return this.unitOfWork.run(async (tx) => {
      const workspace = await this.workspaces.findById(input.workspaceId, tx);
      if (!workspace || workspace.status === "deleted") {
        return { kind: "not_found" };
      }

      const authorization = await this.authorizeDelete({
        workspace,
        actorUserId: input.actorUserId,
        now
      });
      if (authorization !== "allowed") {
        return authorization === "forbidden"
          ? { kind: "access_denied", message: "Workspace delete is not authorized." }
          : { kind: authorization };
      }

      const existingReceipt = await this.receipts.findByScope({
        actorUserId: input.actorUserId,
        commandType: "workspace.delete",
        commandTarget: `workspace:${input.workspaceId}`,
        idempotencyKey: input.idempotencyKey,
        tx
      });
      const replay = decideReceiptReplay(existingReceipt, requestFingerprint);
      if (replay) {
        return replay;
      }

      if (workspace.status === "deleting") {
        const activeOperation = await this.operations.findActiveByWorkspaceAndFamily({
          workspaceId: workspace.workspaceId,
          operationFamily: "deprovisioning",
          tx
        });
        return this.persistDeleteReceipt({
          workspace,
          actorUserId: input.actorUserId,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint,
          operationId: activeOperation?.operationId ?? null,
          operationStatus: "reused",
          now,
          tx
        });
      }

      if (workspace.status === "delete_failed" && !input.priorRuntimeOutcomeReconciled) {
        return {
          kind: "lifecycle_conflict",
          message: "delete_failed retry requires prior runtime reconciliation."
        };
      }

      const existingDeprovision = await this.operations.findActiveByWorkspaceAndFamily({
        workspaceId: workspace.workspaceId,
        operationFamily: "deprovisioning",
        tx
      });
      if (existingDeprovision) {
        return this.persistDeleteReceipt({
          workspace,
          actorUserId: input.actorUserId,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint,
          operationId: existingDeprovision.operationId,
          operationStatus: "reused",
          now,
          tx
        });
      }

      const activeProvision = await this.operations.findActiveByWorkspaceAndFamily({
        workspaceId: workspace.workspaceId,
        operationFamily: "provisioning",
        tx
      });
      if (workspace.status === "provisioning" && activeProvision) {
        await this.operations.requestCancellation({
          operationId: activeProvision.operationId,
          expectedVersion: activeProvision.version,
          requestedAt: now,
          tx
        });
      }

      const nextOperation = await this.createDeprovisionOperation({
        workspace,
        activeProvision,
        actorUserId: input.actorUserId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint,
        reconcile: workspace.status === "failed" || workspace.status === "delete_failed",
        blockedByProvision: Boolean(activeProvision && workspace.status === "provisioning"),
        now,
        tx
      });

      const updated = await this.workspaces.updateLifecycleIfVersion({
        workspaceId: workspace.workspaceId,
        expectedLifecycleVersion: workspace.lifecycleVersion,
        nextStatus: "deleting",
        patch: {
          deletionRequestedAt: now,
          updatedAt: now
        },
        tx
      });

      if (!updated) {
        return {
          kind: "lifecycle_conflict",
          message: "Workspace lifecycle version is stale."
        };
      }

      const eventSequence = await this.workspaces.allocateNextEventSequence({
        workspaceId: workspace.workspaceId,
        tx
      });
      const event = this.events.create({
        eventId: this.ids.nextEventId(),
        eventType: "workspace.deletion_requested.v1",
        aggregateId: workspace.workspaceId,
        lifecycleVersion: updated.lifecycleVersion,
        eventSequence,
        occurredAt: now,
        correlationId: this.ids.nextCorrelationId(),
        payload: createDeletionRequestedPayload({
          workspaceId: workspace.workspaceId,
          requestedByUserId: input.actorUserId,
          requestedAt: now,
          operationId: nextOperation.operationId
        })
      });
      await this.outbox.enqueue(
        this.events.toOutboxInput(event, {
          outboxMessageId: this.ids.nextOutboxMessageId(),
          createdAt: now
        }),
        tx
      );

      return this.persistDeleteReceipt({
        workspace: updated,
        actorUserId: input.actorUserId,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint,
        operationId: nextOperation.operationId,
        operationStatus: nextOperation.status === "blocked" ? "blocked" : "queued",
        now,
        tx
      });
    });
  }

  private async authorizeDelete(input: {
    workspace: WorkspacePersistenceRecord;
    actorUserId: string;
    now: string;
  }): Promise<"allowed" | "not_found" | "forbidden" | "unavailable"> {
    if (hasValidPendingBootstrapAccess(input)) {
      return "allowed";
    }

    const decision = await this.access.getWorkspaceAccess({
      workspaceId: input.workspace.workspaceId,
      userId: input.actorUserId
    });

    if (decision.kind === "allowed" && decision.canDelete) {
      return "allowed";
    }

    if (decision.kind === "allowed") {
      return "forbidden";
    }

    return decision.reason;
  }

  private async createDeprovisionOperation(input: {
    workspace: WorkspacePersistenceRecord;
    activeProvision: WorkspaceOperationRecord | null;
    actorUserId: string;
    idempotencyKey: string;
    requestFingerprint: string;
    reconcile: boolean;
    blockedByProvision: boolean;
    now: string;
    tx: WorkspaceTransaction;
  }): Promise<WorkspaceOperationRecord> {
    const operationId = this.ids.nextOperationId();
    return this.operations.create(
      {
        operationId,
        workspaceId: input.workspace.workspaceId,
        operationType: "deprovision",
        operationFamily: "deprovisioning",
        status: input.blockedByProvision ? "blocked" : "queued",
        executionPhase: input.reconcile ? "reconcile" : "execute",
        requestFingerprint: input.requestFingerprint,
        idempotencyKeyHash: input.idempotencyKey,
        provider: input.workspace.provider,
        providerRequestKey: this.providerRequestKeys.create({
          workspaceId: input.workspace.workspaceId,
          operationId,
          operationType: "deprovision"
        }),
        runtimeRef: input.workspace.runtimeRef,
        runtimeFinalityProof: "runtime_unknown",
        dependsOnOperationId: input.activeProvision?.operationId ?? null,
        supersedesOperationId: null,
        cancellationRequestedAt: null,
        claimedByWorkerId: null,
        leaseToken: null,
        leaseExpiresAt: null,
        attemptCount: 0,
        maxAttempts: 5,
        nextAttemptAt: null,
        lastAttemptAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        unknownOutcomeAt: null,
        reconciliationRequiredAt: input.reconcile ? input.now : null,
        completedAt: null,
        failedAt: null,
        createdAt: input.now,
        updatedAt: input.now,
        version: 1
      },
      input.tx
    );
  }

  private async persistDeleteReceipt(input: {
    workspace: WorkspacePersistenceRecord;
    actorUserId: string;
    idempotencyKey: string;
    requestFingerprint: string;
    operationId: string | null;
    operationStatus: "queued" | "blocked" | "reused";
    now: string;
    tx: WorkspaceTransaction;
  }): Promise<DeleteWorkspaceUseCaseResult> {
    const responseBody: JsonValue = {
      workspaceId: input.workspace.workspaceId,
      status: "deleting",
      operation: {
        operationId: input.operationId,
        status: input.operationStatus
      },
      acceptedAt: input.now
    };

    await this.receipts.create(
      {
        commandReceiptId: this.ids.nextCommandReceiptId(),
        actorUserId: input.actorUserId,
        commandType: "workspace.delete",
        commandTarget: `workspace:${input.workspace.workspaceId}`,
        workspaceId: input.workspace.workspaceId,
        idempotencyKeyHash: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        responseStatusCode: 202,
        responseBody,
        responseHeaders: null,
        operationId: input.operationId,
        status: "completed",
        createdAt: input.now,
        updatedAt: input.now,
        expiresAt: this.clock.addSeconds(input.now, 86_400),
        completedAt: input.now
      },
      input.tx
    );

    return {
      kind: "accepted",
      workspaceId: input.workspace.workspaceId,
      operationId: input.operationId,
      status: "deleting",
      replayed: false,
      response: responseBody
    };
  }
}

function decideReceiptReplay(
  existingReceipt: WorkspaceCommandReceiptRecord | null,
  requestFingerprint: string
): DeleteWorkspaceUseCaseResult | null {
  if (!existingReceipt) {
    return null;
  }

  if (existingReceipt.requestFingerprint !== requestFingerprint) {
    return { kind: "idempotency_conflict" };
  }

  return {
    kind: "replayed",
    response: existingReceipt.responseBody ?? null
  };
}
