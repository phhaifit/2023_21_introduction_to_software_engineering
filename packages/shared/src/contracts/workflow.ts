export type WorkflowStatus = "Draft" | "Published" | "Archived";
export type WorkflowTriggerType = "manual" | "schedule" | "webhook";
export type WorkflowExecutionStatus = "Pending" | "Running" | "Success" | "Failed" | "Canceled";

export interface WorkflowDto {
  workflowId: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  triggerType: WorkflowTriggerType;
  triggerConfig: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepDto {
  workflowStepId: string;
  workspaceId: string;
  workflowId: string;
  agentId: string;
  stepOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecutionDto {
  executionId: string;
  workspaceId: string;
  workflowId: string;
  status: WorkflowExecutionStatus;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
}

export interface ExecuteWorkflowRequest {
  workflowId: string;
  workspaceId: string;
  triggeredBy: string;
  triggerType: WorkflowTriggerType;
  inputData?: Record<string, any>;
}
