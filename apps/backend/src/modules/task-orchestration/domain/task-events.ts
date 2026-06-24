import type { EntityId, TaskRoutingSelection, TaskStatus } from "@vcp/shared";
import { parseTaskRoutingSelection, TaskRoutingValidationError } from "./routing-validation.ts";

// ====== Event Type and Status Mappings ======
// Canonical event-type literals
export const TASK_EVENT_TYPES = [
  "task.submitted",
  "task.started",
  "task.requires-action",
  "task.completed",
  "task.failed",
  "task.cancelled"
] as const;

export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

// Status mappings: UI representation → canonical production status
export const EVENT_TYPE_TO_STATUS = {
  "task.submitted": "queued",
  "task.started": "running",
  "task.requires-action": "requires_action",
  "task.completed": "succeeded",
  "task.failed": "failed",
  "task.cancelled": "cancelled"
} as const satisfies Record<TaskEventType, TaskStatus>;

// ====== Common Event Envelope ======
type BaseTaskEvent = {
  readonly eventId: EntityId<"eventId">;
  readonly eventType: TaskEventType;
  readonly occurredAt: string;
  readonly workspaceId: EntityId<"workspaceId">;
  readonly taskId: EntityId<"taskId">;
  readonly workId: EntityId<"workId">;
  readonly attemptNumber: number;
  readonly status: TaskStatus;
};

// ====== Individual Event Types ======
export type TaskSubmittedEvent = BaseTaskEvent & {
  readonly eventType: "task.submitted";
  readonly status: "queued";
  readonly requestedRouting: TaskRoutingSelection;
};

export type TaskStartedEvent = BaseTaskEvent & {
  readonly eventType: "task.started";
  readonly status: "running";
};

export type TaskRequiresActionEvent = BaseTaskEvent & {
  readonly eventType: "task.requires-action";
  readonly status: "requires_action";
  readonly reasonCode: string;
  readonly message: string;
};

export type TaskCompletedEvent = BaseTaskEvent & {
  readonly eventType: "task.completed";
  readonly status: "succeeded";
};

export type TaskFailedEvent = BaseTaskEvent & {
  readonly eventType: "task.failed";
  readonly status: "failed";
  readonly errorCode: string;
  readonly errorMessage: string;
};

export type TaskCancelledEvent = BaseTaskEvent & {
  readonly eventType: "task.cancelled";
  readonly status: "cancelled";
  readonly reason?: string;
};

// ====== Discriminated Union ======
export type TaskLifecycleEvent =
  | TaskSubmittedEvent
  | TaskStartedEvent
  | TaskRequiresActionEvent
  | TaskCompletedEvent
  | TaskFailedEvent
  | TaskCancelledEvent;

// ====== Event Creation Validation ======
export class TaskEventValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid task event: ${issues.join(", ")}`);
    this.name = "TaskEventValidationError";
    this.issues = issues;
  }
}

// ====== Shared Validation Helpers ======
function validateCommonEnvelope(
  eventId: unknown,
  workspaceId: unknown,
  taskId: unknown,
  workId: unknown,
  occurredAt: unknown,
  attemptNumber: unknown
): string[] {
  const issues: string[] = [];

  if (!eventId || typeof eventId !== "string") {
    issues.push("eventId is required and must be a non-empty string");
  }
  if (!workspaceId || typeof workspaceId !== "string") {
    issues.push("workspaceId is required and must be a non-empty string");
  }
  if (!taskId || typeof taskId !== "string") {
    issues.push("taskId is required and must be a non-empty string");
  }
  if (!workId || typeof workId !== "string") {
    issues.push("workId is required and must be a non-empty string");
  }
  if (!occurredAt || typeof occurredAt !== "string") {
    issues.push("occurredAt is required and must be a non-empty string");
  }

  // Validate attemptNumber: must be a positive integer >= 1
  if (typeof attemptNumber !== "number") {
    issues.push("attemptNumber must be a number");
  } else if (!Number.isInteger(attemptNumber)) {
    issues.push("attemptNumber must be an integer");
  } else if (attemptNumber < 1) {
    issues.push("attemptNumber must be greater than or equal to 1");
  }

  return issues;
}

// ====== Event Factories ======
type SubmittedEventDraft = {
  eventId: EntityId<"eventId">;
  workspaceId: EntityId<"workspaceId">;
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  occurredAt: string;
  attemptNumber: number;
  requestedRouting: TaskRoutingSelection;
};

export function createTaskSubmittedEvent(draft: SubmittedEventDraft): TaskSubmittedEvent {
  const issues = validateCommonEnvelope(
    draft.eventId,
    draft.workspaceId,
    draft.taskId,
    draft.workId,
    draft.occurredAt,
    draft.attemptNumber
  );

  if (issues.length > 0) {
    throw new TaskEventValidationError(issues);
  }

  // Parse and reconstruct routing through canonical parser to prevent caller aliasing
  let requestedRouting: TaskRoutingSelection;
  try {
    requestedRouting = parseTaskRoutingSelection(draft.requestedRouting);
  } catch (error) {
    if (error instanceof TaskRoutingValidationError) {
      throw new TaskEventValidationError([`routing validation failed: ${error.message}`]);
    }
    throw error;
  }

  return {
    eventId: draft.eventId,
    eventType: "task.submitted",
    occurredAt: draft.occurredAt,
    workspaceId: draft.workspaceId,
    taskId: draft.taskId,
    workId: draft.workId,
    attemptNumber: draft.attemptNumber,
    status: "queued",
    requestedRouting
  };
}

type StartedEventDraft = {
  eventId: EntityId<"eventId">;
  workspaceId: EntityId<"workspaceId">;
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  occurredAt: string;
  attemptNumber: number;
};

export function createTaskStartedEvent(draft: StartedEventDraft): TaskStartedEvent {
  const issues = validateCommonEnvelope(
    draft.eventId,
    draft.workspaceId,
    draft.taskId,
    draft.workId,
    draft.occurredAt,
    draft.attemptNumber
  );

  if (issues.length > 0) {
    throw new TaskEventValidationError(issues);
  }

  return {
    eventId: draft.eventId,
    eventType: "task.started",
    occurredAt: draft.occurredAt,
    workspaceId: draft.workspaceId,
    taskId: draft.taskId,
    workId: draft.workId,
    attemptNumber: draft.attemptNumber,
    status: "running"
  };
}

type RequiresActionEventDraft = {
  eventId: EntityId<"eventId">;
  workspaceId: EntityId<"workspaceId">;
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  occurredAt: string;
  attemptNumber: number;
  reasonCode: string;
  message: string;
};

export function createTaskRequiresActionEvent(
  draft: RequiresActionEventDraft
): TaskRequiresActionEvent {
  const issues = validateCommonEnvelope(
    draft.eventId,
    draft.workspaceId,
    draft.taskId,
    draft.workId,
    draft.occurredAt,
    draft.attemptNumber
  );

  // Validate reasonCode and message
  const trimmedReasonCode = typeof draft.reasonCode === "string" ? draft.reasonCode.trim() : "";
  const trimmedMessage = typeof draft.message === "string" ? draft.message.trim() : "";

  if (!trimmedReasonCode) {
    issues.push("reasonCode is required and must not be empty or whitespace-only");
  }
  if (!trimmedMessage) {
    issues.push("message is required and must not be empty or whitespace-only");
  }

  if (issues.length > 0) {
    throw new TaskEventValidationError(issues);
  }

  return {
    eventId: draft.eventId,
    eventType: "task.requires-action",
    occurredAt: draft.occurredAt,
    workspaceId: draft.workspaceId,
    taskId: draft.taskId,
    workId: draft.workId,
    attemptNumber: draft.attemptNumber,
    status: "requires_action",
    reasonCode: trimmedReasonCode,
    message: trimmedMessage
  };
}

type CompletedEventDraft = {
  eventId: EntityId<"eventId">;
  workspaceId: EntityId<"workspaceId">;
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  occurredAt: string;
  attemptNumber: number;
};

export function createTaskCompletedEvent(draft: CompletedEventDraft): TaskCompletedEvent {
  const issues = validateCommonEnvelope(
    draft.eventId,
    draft.workspaceId,
    draft.taskId,
    draft.workId,
    draft.occurredAt,
    draft.attemptNumber
  );

  if (issues.length > 0) {
    throw new TaskEventValidationError(issues);
  }

  return {
    eventId: draft.eventId,
    eventType: "task.completed",
    occurredAt: draft.occurredAt,
    workspaceId: draft.workspaceId,
    taskId: draft.taskId,
    workId: draft.workId,
    attemptNumber: draft.attemptNumber,
    status: "succeeded"
  };
}

type FailedEventDraft = {
  eventId: EntityId<"eventId">;
  workspaceId: EntityId<"workspaceId">;
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  occurredAt: string;
  attemptNumber: number;
  errorCode: string;
  errorMessage: string;
};

export function createTaskFailedEvent(draft: FailedEventDraft): TaskFailedEvent {
  const issues = validateCommonEnvelope(
    draft.eventId,
    draft.workspaceId,
    draft.taskId,
    draft.workId,
    draft.occurredAt,
    draft.attemptNumber
  );

  // Validate errorCode and errorMessage
  const trimmedErrorCode = typeof draft.errorCode === "string" ? draft.errorCode.trim() : "";
  const trimmedErrorMessage =
    typeof draft.errorMessage === "string" ? draft.errorMessage.trim() : "";

  if (!trimmedErrorCode) {
    issues.push("errorCode is required and must not be empty or whitespace-only");
  }
  if (!trimmedErrorMessage) {
    issues.push("errorMessage is required and must not be empty or whitespace-only");
  }

  if (issues.length > 0) {
    throw new TaskEventValidationError(issues);
  }

  return {
    eventId: draft.eventId,
    eventType: "task.failed",
    occurredAt: draft.occurredAt,
    workspaceId: draft.workspaceId,
    taskId: draft.taskId,
    workId: draft.workId,
    attemptNumber: draft.attemptNumber,
    status: "failed",
    errorCode: trimmedErrorCode,
    errorMessage: trimmedErrorMessage
  };
}

type CancelledEventDraft = {
  eventId: EntityId<"eventId">;
  workspaceId: EntityId<"workspaceId">;
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  occurredAt: string;
  attemptNumber: number;
  reason?: string;
};

export function createTaskCancelledEvent(draft: CancelledEventDraft): TaskCancelledEvent {
  const issues = validateCommonEnvelope(
    draft.eventId,
    draft.workspaceId,
    draft.taskId,
    draft.workId,
    draft.occurredAt,
    draft.attemptNumber
  );

  if (issues.length > 0) {
    throw new TaskEventValidationError(issues);
  }

  // Normalize reason if provided
  const normalizedReason =
    draft.reason && typeof draft.reason === "string" ? draft.reason.trim() : undefined;

  return {
    eventId: draft.eventId,
    eventType: "task.cancelled",
    occurredAt: draft.occurredAt,
    workspaceId: draft.workspaceId,
    taskId: draft.taskId,
    workId: draft.workId,
    attemptNumber: draft.attemptNumber,
    status: "cancelled",
    ...(normalizedReason && { reason: normalizedReason })
  };
}
