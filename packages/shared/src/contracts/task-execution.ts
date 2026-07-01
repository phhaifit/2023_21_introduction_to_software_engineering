import type { EntityId } from "./ids.ts";
import type { TaskRoutingSelection } from "./task-orchestration.ts";

export const CANONICAL_TASK_STATUSES = [
  "pending",
  "in-progress",
  "completed",
  "failed",
  "canceled"
] as const;

export type CanonicalTaskStatus = (typeof CANONICAL_TASK_STATUSES)[number];

export type AttachmentReference = {
  id: string;
  type: string;
  referencePath: string;
};

export type StartExecutionCommand = {
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  workspaceId: EntityId<"workspaceId">;
  conversationId: EntityId<"conversationId">;
  prompt: string;
  routing: TaskRoutingSelection;
  attachments?: AttachmentReference[];

  ["rawCredentials"]?: never;
  containerConfiguration?: never;
  infrastructureResourceConfiguration?: never;
  clientComponentState?: never;
  providerSpecificUnverifiedPayload?: never;
};

export function validateStartExecutionCommand(command: Record<string, any>): StartExecutionCommand {
  if (!command.taskId || !command.workId || !command.workspaceId || !command.conversationId || !command.prompt || !command.routing) {
    throw new Error("Invalid StartExecutionCommand: missing required platform fields");
  }
  if (
    "rawCredentials" in command ||
    "containerConfiguration" in command ||
    "infrastructureResourceConfiguration" in command ||
    "clientComponentState" in command ||
    "providerSpecificUnverifiedPayload" in command
  ) {
    throw new Error("Invalid StartExecutionCommand: explicitly excluded fields detected (credentials, infrastructure config, client component state, or unverified payloads)");
  }
  return command as StartExecutionCommand;
}

export interface WorkspaceExecutionRuntime {
  provider: "openclaw";
  instanceId: string;
  endpointReference: string;
  ["credentialReference"]: string;
  status: "running" | "stopped" | "unavailable";
}

export interface WorkspaceExecutionRuntimeResolver {
  resolve(workspaceId: EntityId<"workspaceId">): Promise<WorkspaceExecutionRuntime>;
}

export type ExecutionBinding = {
  taskId: EntityId<"taskId">;
  runtimeInstanceId: string;
  providerExecutionReference: string;
  verifiedProviderFields: Record<string, unknown>;
  unverifiedProviderSchema?: never;
};

export function validateExecutionBinding(binding: Record<string, any>, isProvisioningAttempt: boolean = false): ExecutionBinding {
  if (isProvisioningAttempt) {
    throw new Error("Task & Orchestration SHALL NOT provision the referenced runtime. A usable execution-runtime reference must be supplied by Workspace Management or infrastructure modules.");
  }
  if (!binding.taskId || !binding.runtimeInstanceId || !binding.providerExecutionReference) {
    throw new Error("Invalid ExecutionBinding: missing required association fields");
  }
  if ("unverifiedProviderSchema" in binding) {
    throw new Error("Invalid ExecutionBinding: unverified provider schema fields detected");
  }
  return binding as ExecutionBinding;
}

export const NORMALIZED_ERROR_CODES = [
  "execution-runtime-unavailable",
  "execution-runtime-not-running",
  "routing-target-unavailable",
  "provider-authentication-rejected",
  "execution-start-rejected",
  "execution-failed",
  "cancellation-failed",
  "snapshot-recovery-failed"
] as const;

export type NormalizedErrorCode = (typeof NORMALIZED_ERROR_CODES)[number];

export type NormalizedRuntimeError = {
  code: NormalizedErrorCode;
  message: string;
  rawProviderPayload?: unknown;
};

export function sanitizeNormalizedRuntimeError(error: NormalizedRuntimeError): NormalizedRuntimeError {
  let message = error.message;
  message = message.replace(/(bearer|api[_-]?key|password|secret|token)[\s:=]+[^\s,;]+/gi, "$1 [REDACTED]");

  return {
    code: error.code,
    message,
    rawProviderPayload: undefined
  };
}

export type BaseEventScoping = {
  workspaceId?: EntityId<"workspaceId">;
  workId?: EntityId<"workId">;
  providerExecutionReference?: string;
  providerSessionReference?: string;
};

export type ExecutionAcceptedEvent = { type: "execution-accepted"; taskId: EntityId<"taskId">; timestamp: string } & BaseEventScoping;
export type ExecutionStartedEvent = { type: "execution-started"; taskId: EntityId<"taskId">; timestamp: string } & BaseEventScoping;
export type RoutingResolvedEvent = { type: "routing-resolved"; taskId: EntityId<"taskId">; routingTarget: string; timestamp: string } & BaseEventScoping;
export type StepStartedEvent = { type: "step-started"; taskId: EntityId<"taskId">; stepId: string; stepName: string; timestamp: string } & BaseEventScoping;
export type StepCompletedEvent = { type: "step-completed"; taskId: EntityId<"taskId">; stepId: string; result: string; timestamp: string } & BaseEventScoping;
export type PartialOutputReceivedEvent = { type: "partial-output-received"; taskId: EntityId<"taskId">; outputChunk: string; timestamp: string } & BaseEventScoping;
export type ExecutionCompletedEvent = { type: "execution-completed"; taskId: EntityId<"taskId">; finalOutput: string; timestamp: string } & BaseEventScoping;
export type ExecutionFailedEvent = { type: "execution-failed"; taskId: EntityId<"taskId">; error: NormalizedRuntimeError; timestamp: string } & BaseEventScoping;
export type ExecutionCanceledEvent = { type: "execution-canceled"; taskId: EntityId<"taskId">; timestamp: string } & BaseEventScoping;

export const RUNTIME_ACTIVITY_TYPES = [
  "routing",
  "workflow",
  "tool",
  "tool-call",
  "web-search",
  "document-read",
  "file-read",
  "browser",
  "shell",
  "api-call",
  "sub-agent",
  "handoff",
  "review",
  "aggregation",
  "completion",
  "message",
  "provider-diagnostic"
] as const;

export type RuntimeActivityType = (typeof RUNTIME_ACTIVITY_TYPES)[number];

export type RuntimeActivityStatus =
  | "started"
  | "in-progress"
  | "completed"
  | "failed"
  | "canceled";

export type SubActivityEvent = {
  type: "sub-activity";
  taskId: EntityId<"taskId">;
  activityType: RuntimeActivityType;
  details: string;
  displayLabel?: string;
  summary?: string;
  status?: RuntimeActivityStatus;
  stepId?: string;
  toolName?: string;
  queryPreview?: string;
  resourceLabel?: string;
  inputPreview?: string;
  outputPreview?: string;
  providerEventName?: string;
  rawProviderPayload?: unknown;
  timestamp: string;
} & BaseEventScoping;

export type NormalizedRuntimeEvent =
  | ExecutionAcceptedEvent
  | ExecutionStartedEvent
  | RoutingResolvedEvent
  | StepStartedEvent
  | StepCompletedEvent
  | PartialOutputReceivedEvent
  | ExecutionCompletedEvent
  | ExecutionFailedEvent
  | ExecutionCanceledEvent
  | SubActivityEvent;

export function validateObservabilityProjectionRule(action: {
  createsTool?: boolean;
  assignsTool?: boolean;
  createsSubAgent?: boolean;
  controlsInternalOrchestration?: boolean;
  createsWorkflow?: boolean;
  infersUnprovidedEvents?: boolean;
}): void {
  if (
    action.createsTool ||
    action.assignsTool ||
    action.createsSubAgent ||
    action.controlsInternalOrchestration ||
    action.createsWorkflow ||
    action.infersUnprovidedEvents
  ) {
    throw new Error(
      "Task & Orchestration SHALL act strictly as an observability projection consumer. It SHALL display or project activity supplied by the provider but SHALL NOT create tools, assign tools to agents, create sub-agents, control OpenClaw internal orchestration, create workflows, or infer events that were not provided."
    );
  }
}

export function sanitizeObservabilityPayload(payload: unknown): any {
  if (typeof payload === "string") {
    return payload
      .replace(/(bearer|api[_-]?key|password|secret|token)[\s:=]+[^\s,;]+/gi, "$1 [REDACTED]")
      .replace(/(c:\\users\\[^\s,;]+|\/etc\/[^\s,;]+|\/var\/[^\s,;]+)/gi, "[REDACTED_PATH]");
  }
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload)) {
      return payload.map(item => sanitizeObservabilityPayload(item));
    }
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (/^(bearer|api[_-]?key|password|secret|token)$/i.test(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "string") {
        sanitized[key] = value
          .replace(/(bearer|api[_-]?key|password|secret|token)[\s:=]+[^\s,;]+/gi, "$1 [REDACTED]")
          .replace(/(c:\\users\\[^\s,;]+|\/etc\/[^\s,;]+|\/var\/[^\s,;]+)/gi, "[REDACTED_PATH]");
      } else if (typeof value === "object") {
        sanitized[key] = sanitizeObservabilityPayload(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  return payload;
}

export type RuntimeObservation =
  | "platform-task-accepted"
  | "provider-execution-confirmed-started"
  | "partial-or-activity-update"
  | "final-completion-confirmed"
  | "terminal-provider-failure-confirmed"
  | "cancellation-confirmed"
  | "transport-interruption";

export function mapRuntimeObservationToTaskStatus(
  observation: RuntimeObservation,
  currentStatus: CanonicalTaskStatus
): CanonicalTaskStatus {
  switch (observation) {
    case "platform-task-accepted":
      return "pending";
    case "provider-execution-confirmed-started":
    case "partial-or-activity-update":
      return "in-progress";
    case "final-completion-confirmed":
      return "completed";
    case "terminal-provider-failure-confirmed":
      return "failed";
    case "cancellation-confirmed":
      return "canceled";
    case "transport-interruption":
      // Transport interruption SHALL NOT by itself transition a Task to Failed. Status remains unchanged.
      return currentStatus;
    default:
      return currentStatus;
  }
}

export type ExecutionSnapshot = {
  taskId: EntityId<"taskId">;
  status: CanonicalTaskStatus;
  lastObservedEvent?: NormalizedRuntimeEvent;
  updatedAt: string;
};

export interface TaskExecutionAdapter {
  startExecution(command: StartExecutionCommand): Promise<ExecutionBinding>;
  cancelExecution(taskId: EntityId<"taskId">): Promise<void>;
  getExecutionSnapshot(taskId: EntityId<"taskId">): Promise<ExecutionSnapshot>;
  subscribe(taskId: EntityId<"taskId">, callback: (event: NormalizedRuntimeEvent) => void): void;
  unsubscribe(taskId: EntityId<"taskId">, callback: (event: NormalizedRuntimeEvent) => void): void;
  releaseResources(): Promise<void>;
}
