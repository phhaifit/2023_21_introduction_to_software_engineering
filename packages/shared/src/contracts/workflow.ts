import type { EntityId } from "./ids.ts";
import type { WorkflowStatus } from "./statuses.ts";
export type WorkflowTriggerType = "manual" | "schedule" | "webhook";
export type WorkflowExecutionStatus = "Pending" | "Running" | "Success" | "Failed" | "Canceled";

export interface WorkflowDto {
  workflowId: EntityId<"workflowId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepTransition {
  targetStepId: EntityId<"workflowStepId">;
  condition?: string | null;
}

export interface WorkflowStepDto {
  workflowStepId: EntityId<"workflowStepId">;
  workspaceId: EntityId<"workspaceId">;
  workflowId: EntityId<"workflowId">;
  agentId: EntityId<"agentId">;
  stepOrder: number;
  nextSteps?: WorkflowStepTransition[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutionDto {
  executionId: EntityId<"executionId">;
  workspaceId: EntityId<"workspaceId">;
  workflowId: EntityId<"workflowId">;
  status: WorkflowExecutionStatus;
  triggeredBy: EntityId<"userId">;
  startedAt: string;
  completedAt: string | null;
}

export interface ExecuteWorkflowRequest {
  workflowId: EntityId<"workflowId">;
  workspaceId: EntityId<"workspaceId">;
  triggeredBy: EntityId<"userId">;
  triggerType: WorkflowTriggerType;
  inputData?: Record<string, any>;
}
