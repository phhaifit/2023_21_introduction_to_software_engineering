import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkflowStatus } from "@vcp/shared/contracts/statuses.ts";
import type { WorkflowDto, WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";
import type { WorkflowRepository } from "../infrastructure/workflow-repository.ts";
import { createWorkflow, createWorkflowStep, toWorkflowSummary, toWorkflowStepDto } from "../domain/workflow.ts";
import { validateWorkflowAgents, WorkflowValidationError } from "../domain/workflow-validation.ts";
import type { AgentSummaryProvider } from "../domain/workflow-validation.ts";

export interface CreateWorkflowCommand {
  workspaceId: EntityId<"workspaceId">;
  name: string;
  steps: { agentId: string; stepOrder: number }[];
}

export interface UpdateWorkflowCommand {
  workspaceId: EntityId<"workspaceId">;
  workflowId: EntityId<"workflowId">;
  name?: string;
  status?: WorkflowStatus;
  steps?: { agentId: string; stepOrder: number }[];
}

export class WorkflowUseCases {
  private repository: WorkflowRepository;
  private agentProvider: AgentSummaryProvider;

  constructor(repository: WorkflowRepository, agentProvider: AgentSummaryProvider) {
    this.repository = repository;
    this.agentProvider = agentProvider;
  }

  async createWorkflow(command: CreateWorkflowCommand): Promise<{ workflow: WorkflowDto; steps: WorkflowStepDto[] }> {
    const workflowId = `wf_${crypto.randomUUID()}` as EntityId<"workflowId">;
    
    const steps = command.steps.map((step) =>
      createWorkflowStep(
        `wfs_${crypto.randomUUID()}` as EntityId<"workflowStepId">,
        command.workspaceId,
        workflowId,
        step.agentId as EntityId<"agentId">,
        step.stepOrder
      )
    );

    const workflow = createWorkflow(workflowId, command.workspaceId, command.name, steps);

    // Validate agents before creation
    await validateWorkflowAgents(workflow.workspaceId, workflow.steps.map(toWorkflowStepDto), this.agentProvider);

    await this.repository.save(workflow);

    return {
      workflow: toWorkflowSummary(workflow),
      steps: workflow.steps.map(toWorkflowStepDto),
    };
  }

  async updateWorkflow(command: UpdateWorkflowCommand): Promise<{ workflow: WorkflowDto; steps: WorkflowStepDto[] }> {
    const workflow = await this.repository.findById(command.workspaceId, command.workflowId);
    
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (command.name !== undefined) {
      workflow.name = command.name;
    }

    if (command.status !== undefined) {
      workflow.status = command.status;
    }

    if (command.steps !== undefined) {
      workflow.steps = command.steps.map((step) =>
        createWorkflowStep(
          `wfs_${crypto.randomUUID()}` as EntityId<"workflowStepId">,
          command.workspaceId,
          workflow.workflowId,
          step.agentId as EntityId<"agentId">,
          step.stepOrder
        )
      );
    }

    // Ensure we update timestamp
    workflow.updatedAt = new Date().toISOString();

    // Re-validate agents on update to ensure no disabled agents are persisted if status is active, 
    // or simply just ensure the workflow remains valid.
    await validateWorkflowAgents(workflow.workspaceId, workflow.steps.map(toWorkflowStepDto), this.agentProvider);

    await this.repository.save(workflow);

    return {
      workflow: toWorkflowSummary(workflow),
      steps: workflow.steps.map(toWorkflowStepDto),
    };
  }

  async getWorkflow(workspaceId: EntityId<"workspaceId">, workflowId: EntityId<"workflowId">): Promise<{ workflow: WorkflowDto; steps: WorkflowStepDto[] } | null> {
    const workflow = await this.repository.findById(workspaceId, workflowId);
    if (!workflow) return null;

    return {
      workflow: toWorkflowSummary(workflow),
      steps: workflow.steps.map(toWorkflowStepDto),
    };
  }

  async listWorkflows(workspaceId: EntityId<"workspaceId">, limit = 50, offset = 0): Promise<{ items: WorkflowDto[]; total: number }> {
    const result = await this.repository.listByWorkspace(workspaceId, { limit, offset });
    return {
      total: result.total,
      items: result.items.map(toWorkflowSummary),
    };
  }
}
