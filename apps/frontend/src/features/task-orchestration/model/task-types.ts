export const TASK_STATUSES = [
  "pending",
  "in-progress",
  "completed",
  "failed",
  "canceled"
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ROUTING_MODES = [
  "auto",
  "specific-agent",
  "predefined-workflow"
] as const;

export type RoutingMode = (typeof ROUTING_MODES)[number];

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
  taskId: string;
  workId: string;
}

export interface Task {
  taskId: string;
  workId: string;
  prompt: string;
  status: TaskStatus;
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
