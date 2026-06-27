import type { WorkspaceClock } from "../ports/workspace-clock.ts";
import type { WorkspaceCommandReceiptRepository } from "../ports/workspace-command-receipt-repository.ts";
import type { WorkspaceEntitlementPort } from "../ports/workspace-entitlement-port.ts";
import type { WorkspaceIdFactory } from "../ports/workspace-id-factory.ts";
import type { WorkspaceOperationRepository } from "../ports/workspace-operation-repository.ts";
import type { WorkspaceOutboxRepository } from "../ports/workspace-outbox-repository.ts";
import type {
  JsonValue,
  WorkspaceCommandReceiptRecord,
  WorkspacePersistenceRecord,
  WorkspaceTransaction
} from "../ports/workspace-persistence-types.ts";
import type { WorkspaceProviderRequestKeyFactory } from "../ports/workspace-provider-request-key-factory.ts";
import type { WorkspaceRepository } from "../ports/workspace-repository.ts";
import type { WorkspaceUnitOfWork } from "../ports/workspace-unit-of-work.ts";
import { validateRequestedWorkspaceIntent } from "../../domain/workspace-profile.ts";
import { validateWorkspaceName } from "../../domain/workspace-name.ts";
import { computeWorkspaceCommandFingerprint } from "../services/workspace-command-fingerprint.ts";
import {
  WorkspaceEventFactory,
  createWorkspaceCreatedPayload
} from "../services/workspace-event-factory.ts";

export type CreateWorkspaceUseCaseResult =
  | {
      readonly kind: "accepted";
      readonly workspaceId: string;
      readonly operationId: string;
      readonly status: "provisioning";
      readonly replayed: false;
      readonly response: JsonValue;
    }
  | {
      readonly kind: "replayed";
      readonly response: JsonValue;
    }
  | {
      readonly kind: "idempotency_conflict";
    }
  | {
      readonly kind: "validation_failed" | "entitlement_denied" | "entitlement_unavailable";
      readonly code: string;
      readonly message: string;
    };

export class CreateWorkspaceUseCase {
  private readonly unitOfWork: WorkspaceUnitOfWork;
  private readonly workspaces: WorkspaceRepository;
  private readonly operations: WorkspaceOperationRepository;
  private readonly outbox: WorkspaceOutboxRepository;
  private readonly receipts: WorkspaceCommandReceiptRepository;
  private readonly entitlement: WorkspaceEntitlementPort;
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
    entitlement: WorkspaceEntitlementPort,
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
    this.entitlement = entitlement;
    this.ids = ids;
    this.providerRequestKeys = providerRequestKeys;
    this.clock = clock;
    this.events = events;
  }

  async execute(input: {
    actorUserId: string;
    idempotencyKey: string;
    name: string;
    requestedProfile: "standard" | "premium";
    bootstrapTtlSeconds: number;
  }): Promise<CreateWorkspaceUseCaseResult> {
    const intent = validateRequestedWorkspaceIntent({
      name: input.name,
      requestedProfile: input.requestedProfile
    });

    if (!intent.ok) {
      return {
        kind: "validation_failed",
        code: intent.error.code,
        message: intent.error.message
      };
    }

    const name = validateWorkspaceName(input.name);
    if (!name.ok) {
      return {
        kind: "validation_failed",
        code: name.error.code,
        message: name.error.message
      };
    }

    const entitlementDecision = await this.entitlement.resolveProvisioningProfile({
      userId: input.actorUserId,
      requestedProfile: intent.value.requestedProfile
    });

    if (entitlementDecision.kind !== "resolved") {
      return {
        kind:
          entitlementDecision.kind === "denied"
            ? "entitlement_denied"
            : "entitlement_unavailable",
        code: entitlementDecision.code,
        message: entitlementDecision.message
      };
    }

    const requestFingerprint = computeWorkspaceCommandFingerprint({
      name: name.value.displayName,
      requestedProfile: intent.value.requestedProfile
    });

    return this.unitOfWork.run(async (tx) => {
      const existingReceipt = await this.receipts.findByScope({
        actorUserId: input.actorUserId,
        commandType: "workspace.create",
        commandTarget: "workspace:new",
        idempotencyKey: input.idempotencyKey,
        tx
      });
      const replay = decideReceiptReplay(existingReceipt, requestFingerprint);
      if (replay) {
        return replay;
      }

      const now = this.clock.now();
      const workspaceId = this.ids.nextWorkspaceId();
      const operationId = this.ids.nextOperationId();
      const commandReceiptId = this.ids.nextCommandReceiptId();
      const bootstrapAttemptId = this.ids.nextBootstrapAttemptId();
      const correlationId = this.ids.nextCorrelationId();
      const providerRequestKey = this.providerRequestKeys.create({
        workspaceId,
        operationId,
        operationType: "provision"
      });

      const workspace = await this.workspaces.create(
        {
          workspaceId,
          userId: input.actorUserId,
          createdByUserId: input.actorUserId,
          name: name.value.displayName,
          normalizedName: name.value.normalizedName,
          status: "provisioning",
          lifecycleVersion: 1,
          eventSequence: 0,
          ownerBootstrapState: "pending",
          ownerBootstrapAttemptId: bootstrapAttemptId,
          ownerBootstrapAttemptVersion: 1,
          ownerBootstrapRequestedAt: now,
          ownerBootstrapExpiresAt: this.clock.addSeconds(now, input.bootstrapTtlSeconds),
          ownerMembershipEstablishedAt: null,
          ownerBootstrapFailureCode: null,
          ownerBootstrapFailureMessage: null,
          requestedProfile: entitlementDecision.requestedProfile,
          resolvedProvisioningProfile: entitlementDecision.resolvedProvisioningProfile,
          provisioningProfileSource: "resolved",
          migrationOrigin: "native",
          runtimeVerificationState: "unknown",
          provider: null,
          runtimeRef: null,
          runtimeUrl: null,
          provisioningRequestedAt: now,
          provisionedAt: null,
          deletionRequestedAt: null,
          deletedAt: null,
          failureCode: null,
          failureMessage: null,
          createdAt: now,
          updatedAt: now
        },
        tx
      );

      await this.operations.create(
        {
          operationId,
          workspaceId,
          operationType: "provision",
          operationFamily: "provisioning",
          status: "queued",
          executionPhase: "execute",
          requestFingerprint,
          idempotencyKeyHash: input.idempotencyKey,
          provider: null,
          providerRequestKey,
          runtimeRef: null,
          runtimeFinalityProof: "runtime_unknown",
          dependsOnOperationId: null,
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
          reconciliationRequiredAt: null,
          completedAt: null,
          failedAt: null,
          createdAt: now,
          updatedAt: now,
          version: 1
        },
        tx
      );

      await this.enqueueWorkspaceEvent(workspace, {
        eventType: "workspace.created.v1",
        eventSequence: await this.workspaces.allocateNextEventSequence({
          workspaceId,
          tx
        }),
        occurredAt: now,
        correlationId,
        payload: createWorkspaceCreatedPayload({
          workspace,
          bootstrapAttemptId,
          bootstrapAttemptVersion: 1
        })
      }, tx);

      await this.enqueueWorkspaceEvent(workspace, {
        eventType: "workspace.provisioning.requested.v1",
        eventSequence: await this.workspaces.allocateNextEventSequence({
          workspaceId,
          tx
        }),
        occurredAt: now,
        correlationId,
        payload: {
          workspaceId,
          operationId,
          requestedProfile: entitlementDecision.requestedProfile
        }
      }, tx);

      const responseBody: JsonValue = {
        workspace: {
          workspaceId,
          name: workspace.name,
          status: "provisioning",
          requestedProfile: workspace.requestedProfile,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          provisioningRequestedAt: workspace.provisioningRequestedAt
        },
        operation: {
          operationId,
          status: "queued"
        }
      };

      await this.receipts.create(
        {
          commandReceiptId,
          actorUserId: input.actorUserId,
          commandType: "workspace.create",
          commandTarget: "workspace:new",
          workspaceId,
          idempotencyKeyHash: input.idempotencyKey,
          requestFingerprint,
          responseStatusCode: 202,
          responseBody,
          responseHeaders: null,
          operationId,
          status: "completed",
          createdAt: now,
          updatedAt: now,
          expiresAt: this.clock.addSeconds(now, 86_400),
          completedAt: now
        },
        tx
      );

      return {
        kind: "accepted",
        workspaceId,
        operationId,
        status: "provisioning",
        replayed: false,
        response: responseBody
      };
    });
  }

  private async enqueueWorkspaceEvent(
    workspace: WorkspacePersistenceRecord,
    input: {
      eventType:
        | "workspace.created.v1"
        | "workspace.provisioning.requested.v1";
      eventSequence: number;
      occurredAt: string;
      correlationId: string;
      payload: JsonValue;
    },
    tx: WorkspaceTransaction
  ): Promise<void> {
    const event = this.events.create({
      eventId: this.ids.nextEventId(),
      eventType: input.eventType,
      aggregateId: workspace.workspaceId,
      lifecycleVersion: workspace.lifecycleVersion,
      eventSequence: input.eventSequence,
      occurredAt: input.occurredAt,
      correlationId: input.correlationId,
      payload: input.payload
    });
    await this.outbox.enqueue(
      this.events.toOutboxInput(event, {
        outboxMessageId: this.ids.nextOutboxMessageId(),
        createdAt: input.occurredAt
      }),
      tx
    );
  }
}

function decideReceiptReplay(
  existingReceipt: WorkspaceCommandReceiptRecord | null,
  requestFingerprint: string
): CreateWorkspaceUseCaseResult | null {
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
