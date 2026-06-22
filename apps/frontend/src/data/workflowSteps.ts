import { WorkflowStep } from "../types/workflow";

export const mockWorkflowSteps: Record<string, WorkflowStep[]> = {
  "wf-1": [
    {
      id: "step-1-1",
      order: 1,
      name: "Import Transaction CSV",
      type: "Import",
      assignedAgentId: "agent-1",
      estimatedTime: "2m",
      dependencyIds: []
    },
    {
      id: "step-1-2",
      order: 2,
      name: "Validate Schema",
      type: "Validation",
      assignedAgentId: "agent-2",
      estimatedTime: "3m",
      dependencyIds: ["step-1-1"]
    },
    {
      id: "step-1-3",
      order: 3,
      name: "Transform Currency",
      type: "Transformation",
      assignedAgentId: "agent-3",
      estimatedTime: "5m",
      dependencyIds: ["step-1-2"]
    },
    {
      id: "step-1-4",
      order: 4,
      name: "Send Alert Notification",
      type: "Notification",
      assignedAgentId: "agent-4",
      estimatedTime: "1m",
      dependencyIds: ["step-1-3"]
    }
  ],
  "wf-2": [
    {
      id: "step-2-1",
      order: 1,
      name: "Import CRM Leads",
      type: "Import",
      assignedAgentId: "agent-1",
      estimatedTime: "4m",
      dependencyIds: []
    },
    {
      id: "step-2-2",
      order: 2,
      name: "Cleanse Duplicate Data",
      type: "Validation",
      assignedAgentId: "agent-2",
      estimatedTime: "2m",
      dependencyIds: ["step-2-1"]
    },
    {
      id: "step-2-3",
      order: 3,
      name: "Sync to Database",
      type: "Transformation",
      assignedAgentId: "agent-3",
      estimatedTime: "3m",
      dependencyIds: ["step-2-2"]
    }
  ]
};
