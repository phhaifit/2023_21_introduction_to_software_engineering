import type {
  CreateOutboxMessageInput,
  JsonValue,
  WorkspacePersistenceRecord
} from "../ports/workspace-persistence-types.ts";

export type WorkspaceEventType =
  | "workspace.created.v1"
  | "workspace.provisioning.requested.v1"
  | "workspace.ready.v1"
  | "workspace.provisioning_failed.v1"
  | "workspace.deletion_requested.v1"
  | "workspace.deleted.v1"
  | "workspace.deletion_failed.v1";

export type WorkspaceDomainEvent<TPayload> = {
  readonly eventId: string;
  readonly eventType: WorkspaceEventType;
  readonly eventVersion: 1;
  readonly aggregateType: "workspace";
  readonly aggregateId: string;
  readonly lifecycleVersion: number;
  readonly eventSequence: number;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly payload: TPayload;
};

export class WorkspaceEventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceEventValidationError";
  }
}

const WORKSPACE_EVENT_TYPES = new Set<string>([
  "workspace.created.v1",
  "workspace.provisioning.requested.v1",
  "workspace.ready.v1",
  "workspace.provisioning_failed.v1",
  "workspace.deletion_requested.v1",
  "workspace.deleted.v1",
  "workspace.deletion_failed.v1"
]);

const FORBIDDEN_EVENT_TYPES = new Set<string>([
  "workspace-membership.owner-established.v1",
  "workspace-membership.owner-establishment-failed.v1"
]);

const UNSAFE_EVENT_KEYS = new Set([
  "credential",
  "secret",
  "providerrequestkey",
  "leasetoken",
  "rawruntimeresponse",
  "providerrawbody",
  "rawproviderresponse",
  "stacktrace",
  "runtimeurl",
  "authorization",
  "authorizationheader",
  "token",
  "password"
]);

export class WorkspaceEventFactory {
  create<TPayload extends JsonValue>(input: {
    eventId: string;
    eventType: WorkspaceEventType;
    aggregateType?: "workspace";
    aggregateId: string;
    lifecycleVersion: number;
    eventSequence: number;
    occurredAt: string;
    correlationId: string;
    causationId?: string;
    payload: TPayload;
  }): WorkspaceDomainEvent<TPayload> {
    if (input.aggregateType && input.aggregateType !== "workspace") {
      throw new WorkspaceEventValidationError(
        "Workspace events must use aggregateType workspace."
      );
    }

    assertWorkspaceEventType(input.eventType);
    assertSafeEventPayload(input.payload);

    return {
      eventId: input.eventId,
      eventType: input.eventType,
      eventVersion: 1,
      aggregateType: "workspace",
      aggregateId: input.aggregateId,
      lifecycleVersion: input.lifecycleVersion,
      eventSequence: input.eventSequence,
      occurredAt: input.occurredAt,
      correlationId: input.correlationId,
      ...(input.causationId ? { causationId: input.causationId } : {}),
      payload: input.payload
    };
  }

  toOutboxInput(
    event: WorkspaceDomainEvent<JsonValue>,
    input: {
      outboxMessageId: string;
      createdAt: string;
    }
  ): CreateOutboxMessageInput {
    return {
      outboxMessageId: input.outboxMessageId,
      eventId: event.eventId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      eventSequence: event.eventSequence,
      lifecycleVersion: event.lifecycleVersion,
      payload: event as unknown as JsonValue,
      nextAttemptAt: null,
      lastAttemptAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      leaseToken: null,
      leaseExpiresAt: null,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };
  }
}

export function decodeWorkspaceDomainEvent(
  value: JsonValue
): WorkspaceDomainEvent<unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkspaceEventValidationError("Outbox payload is not an event envelope.");
  }

  const record = value as Record<string, unknown>;
  if (record.aggregateType !== "workspace") {
    throw new WorkspaceEventValidationError(
      "Outbox event aggregateType is not workspace."
    );
  }

  if (typeof record.eventType !== "string") {
    throw new WorkspaceEventValidationError("Workspace eventType is required.");
  }

  assertWorkspaceEventType(record.eventType);
  assertSafeEventPayload(record.payload as JsonValue);

  return record as WorkspaceDomainEvent<unknown>;
}

export function createWorkspaceCreatedPayload(input: {
  workspace: WorkspacePersistenceRecord;
  bootstrapAttemptId: string;
  bootstrapAttemptVersion: number;
}): JsonValue {
  return {
    workspaceId: input.workspace.workspaceId,
    createdByUserId: input.workspace.createdByUserId,
    name: input.workspace.name,
    createdAt: input.workspace.createdAt,
    initialStatus: input.workspace.status,
    bootstrapAttemptId: input.bootstrapAttemptId,
    bootstrapAttemptVersion: input.bootstrapAttemptVersion
  };
}

export function createDeletionRequestedPayload(input: {
  workspaceId: string;
  requestedByUserId: string;
  requestedAt: string;
  operationId: string;
}): JsonValue {
  return {
    workspaceId: input.workspaceId,
    requestedByUserId: input.requestedByUserId,
    requestedAt: input.requestedAt,
    operationId: input.operationId,
    destructiveCleanupAuthorized: false,
    downstreamGuidance: "non_destructive_quiesce_only"
  };
}

function assertWorkspaceEventType(eventType: string): asserts eventType is WorkspaceEventType {
  if (FORBIDDEN_EVENT_TYPES.has(eventType)) {
    throw new WorkspaceEventValidationError(
      "Workspace Management must not create Workspace Membership acknowledgement events."
    );
  }

  if (!WORKSPACE_EVENT_TYPES.has(eventType)) {
    throw new WorkspaceEventValidationError("Unsupported Workspace event type.");
  }
}

function assertSafeEventPayload(payload: JsonValue): void {
  collectUnsafePayloadPaths(payload, "$");
}

function collectUnsafePayloadPaths(value: JsonValue, path: string): void {
  if (value === null || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUnsafePayloadPaths(item, `${path}[${index}]`));
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (UNSAFE_EVENT_KEYS.has(normalized)) {
      throw new WorkspaceEventValidationError(
        `Workspace event payload contains unsafe field at ${path}.${key}.`
      );
    }

    collectUnsafePayloadPaths(nested, `${path}.${key}`);
  }
}
