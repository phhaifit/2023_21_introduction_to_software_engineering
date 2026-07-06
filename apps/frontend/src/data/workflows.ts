import { WorkflowDto, WorkflowExecutionStatus } from "@vcp/shared/contracts/workflow";

// Extend WorkflowDto for UI purposes in the mock
export interface MockWorkflow extends WorkflowDto {
  stepCount: number;
  lastExecutionStatus?: WorkflowExecutionStatus;
}

export const mockWorkflows: MockWorkflow[] = [
  {
    workflowId: "wf-1",
    workspaceId: "ws-1",
    name: "Data Pipeline Alpha",
    description: "Imports daily transactions, validates schema, and runs transformations.",
    status: "Published",
    triggerType: "schedule",
    triggerConfig: { cron: "0 8 * * *" },
    createdAt: "2026-06-10 08:00",
    updatedAt: "2026-06-16 08:30",
    stepCount: 4,
    lastExecutionStatus: "Running"
  },
  {
    workflowId: "wf-2",
    workspaceId: "ws-1",
    name: "Customer Sync Flow",
    description: "Syncs customer records between CRM and internal database.",
    status: "Published",
    triggerType: "webhook",
    triggerConfig: { url: "https://api.vcp.com/hooks/wf-2" },
    createdAt: "2026-06-11 09:00",
    updatedAt: "2026-06-15 17:45",
    stepCount: 3,
    lastExecutionStatus: "Success"
  },
  {
    workflowId: "wf-3",
    workspaceId: "ws-1",
    name: "Inventory Validation",
    description: "Checks stock counts, flags discrepancies, and alerts managers.",
    status: "Draft",
    triggerType: "manual",
    triggerConfig: null,
    createdAt: "2026-06-14 11:00",
    updatedAt: "2026-06-14 11:20",
    stepCount: 2,
    lastExecutionStatus: undefined
  },
  {
    workflowId: "wf-4",
    workspaceId: "ws-1",
    name: "Monthly Report Generator",
    description: "Aggregates monthly usage data and sends a PDF report to partners.",
    status: "Published",
    triggerType: "schedule",
    triggerConfig: { cron: "0 0 1 * *" },
    createdAt: "2026-05-01 00:00",
    updatedAt: "2026-06-01 00:05",
    stepCount: 4,
    lastExecutionStatus: "Success"
  },
  {
    workflowId: "wf-5",
    workspaceId: "ws-1",
    name: "System Health Checker",
    description: "Pings services, collects health status, and updates the status page.",
    status: "Published",
    triggerType: "schedule",
    triggerConfig: { cron: "*/15 * * * *" },
    createdAt: "2026-06-16 00:00",
    updatedAt: "2026-06-16 05:00",
    stepCount: 3,
    lastExecutionStatus: "Failed"
  }
];
