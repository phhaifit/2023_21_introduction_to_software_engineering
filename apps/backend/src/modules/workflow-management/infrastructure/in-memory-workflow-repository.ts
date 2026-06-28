import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { Workflow } from "../domain/workflow.ts";
import type { WorkflowRepository } from "./workflow-repository.ts";

export class InMemoryWorkflowRepository implements WorkflowRepository {
  private readonly workflows: Map<string, Workflow> = new Map();

  async save(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.workflowId, workflow);
  }

  async findById(workspaceId: EntityId<"workspaceId">, workflowId: EntityId<"workflowId">): Promise<Workflow | null> {
    const workflow = this.workflows.get(workflowId);
    if (workflow && workflow.workspaceId === workspaceId) {
      return workflow;
    }
    return null;
  }

  async listByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    options?: { limit?: number; offset?: number }
  ): Promise<{ items: Workflow[]; total: number }> {
    const items = Array.from(this.workflows.values()).filter(w => w.workspaceId === workspaceId);
    // Sort by updatedAt descending
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const paginatedItems = items.slice(offset, offset + limit);
    
    return {
      items: paginatedItems,
      total: items.length
    };
  }

  async delete(workspaceId: EntityId<"workspaceId">, workflowId: EntityId<"workflowId">): Promise<boolean> {
    const workflow = this.workflows.get(workflowId);
    if (workflow && workflow.workspaceId === workspaceId) {
      this.workflows.delete(workflowId);
      return true;
    }
    return false;
  }

  private readonly executions: Map<string, any> = new Map();
  private readonly stepLogs: Map<string, any> = new Map();

  async createExecution(execution: import("@vcp/shared/contracts/workflow.ts").WorkflowExecutionDto): Promise<void> {
    this.executions.set(execution.executionId, execution);
  }

  async updateExecutionStatus(workspaceId: EntityId<"workspaceId">, executionId: EntityId<"executionId">, status: import("@vcp/shared/contracts/workflow.ts").WorkflowExecutionStatus, completedAt?: string): Promise<void> {
    const exec = this.executions.get(executionId);
    if (exec && exec.workspaceId === workspaceId) {
      exec.status = status;
      if (completedAt) exec.completedAt = completedAt;
    }
  }

  async createStepLog(log: import("@vcp/shared/contracts/workflow.ts").WorkflowStepLogDto): Promise<void> {
    this.stepLogs.set(log.logId, log);
  }

  async updateStepLog(logId: EntityId<"logId">, status: string, outputData?: any, errorMsg?: string, completedAt?: string): Promise<void> {
    const log = this.stepLogs.get(logId);
    if (log) {
      log.status = status;
      if (outputData) log.outputData = outputData;
      if (errorMsg) log.errorMsg = errorMsg;
      if (completedAt) log.completedAt = completedAt;
    }
  }
}
