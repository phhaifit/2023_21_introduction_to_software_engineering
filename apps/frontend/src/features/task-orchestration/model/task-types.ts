import {
  TASK_ROUTING_MODES,
  type EntityId,
  type TaskRoutingMode,
  type TaskRoutingSelection,
  type TaskStatus as ProductionTaskStatus
} from "@vcp/shared";

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
  timeline: ProcessingStep[];
}

export interface MockAgent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  available: boolean;
}

export interface MockWorkflow {
  id: string;
  name: string;
  description: string;
  agentIds: string[];
}
