export type WorkflowStatus = "Draft" | "Published" | "Running" | "Completed" | "Failed";

export type WorkflowStepType = "Import" | "Validation" | "Transformation" | "Notification";

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  stepCount: number;
  lastUpdated: string;
}

export interface WorkflowStep {
  id: string;
  order: number;
  name: string;
  type: WorkflowStepType;
  assignedAgentId: string;
  estimatedTime: string;
  dependencyIds: string[];
}
