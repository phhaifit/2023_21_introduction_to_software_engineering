import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Workflow } from "../domain/workflow.ts";

export interface WorkflowRepository {
  save(workflow: Workflow): Promise<void>;
  findById(workspaceId: EntityId<"workspaceId">, workflowId: EntityId<"workflowId">): Promise<Workflow | null>;
  listByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    options?: { limit?: number; offset?: number }
  ): Promise<{ items: Workflow[]; total: number }>;
  delete(workspaceId: EntityId<"workspaceId">, workflowId: EntityId<"workflowId">): Promise<boolean>;
  
  createExecution(execution: import("@vcp/shared/contracts/workflow.ts").WorkflowExecutionDto): Promise<void>;
  updateExecutionStatus(workspaceId: EntityId<"workspaceId">, executionId: EntityId<"executionId">, status: import("@vcp/shared/contracts/workflow.ts").WorkflowExecutionStatus, completedAt?: string): Promise<void>;
  createStepLog(log: import("@vcp/shared/contracts/workflow.ts").WorkflowStepLogDto): Promise<void>;
  updateStepLog(logId: EntityId<"logId">, status: string, outputData?: any, errorMsg?: string, completedAt?: string): Promise<void>;
}
