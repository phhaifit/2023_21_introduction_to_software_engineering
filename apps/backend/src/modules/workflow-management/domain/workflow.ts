import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkflowStatus } from "@vcp/shared/contracts/statuses.ts";
import type { WorkflowDto, WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";

export interface Workflow {
  workflowId: EntityId<"workflowId">;
  workspaceId: EntityId<"workspaceId">;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerType: "manual" | "schedule" | "webhook";
  triggerConfig?: any;
  version: number;
  parentWorkflowId: string | null;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  workflowStepId: EntityId<"workflowStepId">;
  workspaceId: EntityId<"workspaceId">;
  workflowId: EntityId<"workflowId">;
  agentId: EntityId<"agentId"> | null;
  stepType: "agent" | "approval";
  stepOrder: number;
  nextSteps?: Array<{ targetStepId: string; condition?: string | null }> | null;
  inputMapping?: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export function createWorkflow(
  workflowId: EntityId<"workflowId">,
  workspaceId: EntityId<"workspaceId">,
  name: string,
  description: string | null = null,
  triggerType: "manual" | "schedule" | "webhook" = "manual",
  triggerConfig: any = null,
  steps: WorkflowStep[] = []
): Workflow {
  const now = new Date().toISOString();
  return {
    workflowId,
    workspaceId,
    name,
    description,
    status: "draft" as WorkflowStatus,
    triggerType,
    triggerConfig,
    version: 1,
    parentWorkflowId: null,
    createdAt: now,
    updatedAt: now,
    steps,
  };
}

export function createWorkflowStep(
  workflowStepId: EntityId<"workflowStepId">,
  workspaceId: EntityId<"workspaceId">,
  workflowId: EntityId<"workflowId">,
  agentId: EntityId<"agentId"> | null,
  stepType: "agent" | "approval",
  stepOrder: number,
  nextSteps: Array<{ targetStepId: string; condition?: string | null }> | null = null,
  inputMapping: Record<string, string> | null = null
): WorkflowStep {
  const now = new Date().toISOString();
  return {
    workflowStepId,
    workspaceId,
    workflowId,
    agentId,
    stepType,
    stepOrder,
    nextSteps,
    inputMapping,
    createdAt: now,
    updatedAt: now,
  };
}

export function toWorkflowSummary(workflow: Workflow): WorkflowDto {
  return {
    workflowId: workflow.workflowId,
    workspaceId: workflow.workspaceId,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    triggerType: workflow.triggerType,
    triggerConfig: workflow.triggerConfig || null,
    version: workflow.version,
    parentWorkflowId: workflow.parentWorkflowId,
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
    stepType: step.stepType,
    stepOrder: step.stepOrder,
    nextSteps: step.nextSteps as any,
    inputMapping: step.inputMapping as any,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}
