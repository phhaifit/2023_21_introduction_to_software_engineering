import {
  TASK_ROUTING_MODES,
  type EntityId,
  type TaskRoutingMode,
  type TaskRoutingSelection,
  type TaskStatus as ProductionTaskStatus
} from "@vcp/shared";

import type { TaskFinalizedResult } from "./task-completion";

export const TASK_STATUSES = [
  "pending",
  "in-progress",
  "completed",
  "failed",
  "canceled"
] as const;

export type TaskPresentationStatus = (typeof TASK_STATUSES)[number];

export const ROUTING_MODES = TASK_ROUTING_MODES;

export type RoutingMode = TaskRoutingMode;

export const PROCESSING_STEP_STATUSES = [
  "waiting",
  "active",
  "completed",
  "failed",
  "canceled"
] as const;

export type ProcessingStepStatus = (typeof PROCESSING_STEP_STATUSES)[number];

export interface ProcessingStep {
  id: string;
  label: string;
  status: ProcessingStepStatus;
  startedAt?: string;
  completedAt?: string;
}

export type TaskLogLevel = "info" | "success" | "warning" | "error";

export interface TaskLog {
  id: string;
  timestamp: string;
  level: TaskLogLevel;
  stepId: string;
  message: string;
}

export interface TaskError {
  code: string;
  stepId: string;
  title: string;
  message: string;
  occurredAt: string;
}

export interface TaskIdentity {
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
}

export interface Task {
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  prompt: string;
  status: TaskPresentationStatus;
  routingMode: RoutingMode;
  selectedAgentId?: string;
  selectedWorkflowId?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  activeStepId?: string;
  canceledAtStepId?: string;
  timeline: ProcessingStep[];
  logs: TaskLog[];
  partialResult: string;
  finalResult?: string;
  error?: TaskError;
}

export interface CreatedTaskRecord {
  taskId: EntityId<"taskId">;
  workId: EntityId<"workId">;
  prompt: string;
  requestedRouting: TaskRoutingSelection;
  status: ProductionTaskStatus;
  createdAt: string;
  /** Authoritative processing lifecycle snapshot — present from task creation. */
  processingSnapshot: import("./task-processing").ProcessingSnapshot;
  /** Authoritative partial-result streaming snapshot — present from task creation. */
  streamingSnapshot: import("./task-streaming").TaskStreamingSnapshot;
  /** Authoritative completed-result state; absent until atomic completion. */
  finalizedResult?: TaskFinalizedResult;
  /** Authoritative cancellation timestamp; absent until atomic cancellation. */
  cancelledAt?: string;
  /** Authoritative task error; absent until deterministic failure. */
  error?: TaskError;
}

export interface RoutingAgentOption {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  available: boolean;
}

export interface RoutingWorkflowOption {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
}
