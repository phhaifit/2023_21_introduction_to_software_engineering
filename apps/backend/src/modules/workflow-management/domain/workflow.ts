import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkflowStatus } from "@vcp/shared/contracts/statuses.ts";
import type { WorkflowDto, WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";

export interface Workflow {
  workflowId: EntityId<"workflowId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  workflowStepId: EntityId<"workflowStepId">;
  workspaceId: EntityId<"workspaceId">;
  workflowId: EntityId<"workflowId">;
  agentId: EntityId<"agentId">;
  stepOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function createWorkflow(
  workflowId: EntityId<"workflowId">,
  workspaceId: EntityId<"workspaceId">,
  name: string,
  steps: WorkflowStep[] = []
): Workflow {
  const now = new Date().toISOString();
  return {
    workflowId,
    workspaceId,
    name,
    status: "draft" as WorkflowStatus,
    createdAt: now,
    updatedAt: now,
    steps,
  };
}

export function createWorkflowStep(
  workflowStepId: EntityId<"workflowStepId">,
  workspaceId: EntityId<"workspaceId">,
  workflowId: EntityId<"workflowId">,
  agentId: EntityId<"agentId">,
  stepOrder: number
): WorkflowStep {
  const now = new Date().toISOString();
  return {
    workflowStepId,
    workspaceId,
    workflowId,
    agentId,
    stepOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export function toWorkflowSummary(workflow: Workflow): WorkflowDto {
  return {
    workflowId: workflow.workflowId,
    workspaceId: workflow.workspaceId,
    name: workflow.name,
    description: null,
    status: workflow.status,
    triggerType: "manual",
    triggerConfig: null,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
  };
}

export function toWorkflowStepDto(step: WorkflowStep): WorkflowStepDto {
  return {
    workflowStepId: step.workflowStepId,
    workspaceId: step.workspaceId,
    workflowId: step.workflowId,
    agentId: step.agentId,
    stepOrder: step.stepOrder,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}
