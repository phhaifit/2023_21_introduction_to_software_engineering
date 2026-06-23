import type { WorkflowExecutionDto } from "@vcp/shared/contracts/workflow.ts";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";

export interface ExecutionUIModel extends WorkflowExecutionDto {
  workflowName: string; // Additional field for UI display convenience
}

export const mockExecutions: ExecutionUIModel[] = [
  {
    executionId: "exec_alpha_001" as EntityId<"executionId">,
    workspaceId: "ws_1" as EntityId<"workspaceId">,
    workflowId: "wf_1" as EntityId<"workflowId">,
    workflowName: "Data Pipeline Alpha",
    status: "Running",
    triggeredBy: "user_1" as EntityId<"userId">,
    startedAt: "2026-06-24T06:30:00.000Z",
    completedAt: null,
  },
  {
    executionId: "exec_alpha_002" as EntityId<"executionId">,
    workspaceId: "ws_1" as EntityId<"workspaceId">,
    workflowId: "wf_1" as EntityId<"workflowId">,
    workflowName: "Data Pipeline Alpha",
    status: "Success",
    triggeredBy: "user_1" as EntityId<"userId">,
    startedAt: "2026-06-23T14:00:00.000Z",
    completedAt: "2026-06-23T14:45:12.000Z",
  },
  {
    executionId: "exec_sync_001" as EntityId<"executionId">,
    workspaceId: "ws_1" as EntityId<"workspaceId">,
    workflowId: "wf_2" as EntityId<"workflowId">,
    workflowName: "Customer Sync Flow",
    status: "Failed",
    triggeredBy: "user_2" as EntityId<"userId">,
    startedAt: "2026-06-23T09:15:00.000Z",
    completedAt: "2026-06-23T09:17:05.000Z",
  },
  {
    executionId: "exec_health_001" as EntityId<"executionId">,
    workspaceId: "ws_1" as EntityId<"workspaceId">,
    workflowId: "wf_5" as EntityId<"workflowId">,
    workflowName: "System Health Checker",
    status: "Canceled",
    triggeredBy: "user_1" as EntityId<"userId">,
    startedAt: "2026-06-16T05:00:00.000Z",
    completedAt: "2026-06-16T05:00:45.000Z",
  }
];
