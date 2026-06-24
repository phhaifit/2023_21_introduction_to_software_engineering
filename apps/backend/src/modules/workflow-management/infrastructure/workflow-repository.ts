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
}
