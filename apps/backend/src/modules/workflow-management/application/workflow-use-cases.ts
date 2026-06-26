import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkflowStatus } from "@vcp/shared/contracts/statuses.ts";
import type { WorkflowDto, WorkflowStepDto } from "@vcp/shared/contracts/workflow.ts";
import type { WorkflowRepository } from "../infrastructure/workflow-repository.ts";
import { createWorkflow, createWorkflowStep, toWorkflowSummary, toWorkflowStepDto } from "../domain/workflow.ts";
import { validateWorkflowAgents, validateWorkflowDAG, WorkflowValidationError } from "../domain/workflow-validation.ts";
import type { AgentSummaryProvider } from "../domain/workflow-validation.ts";
import type { ExecuteWorkflowRequest } from "@vcp/shared/contracts/workflow.ts";

export interface WorkflowExecutionHandoff {
  handoffExecution(request: ExecuteWorkflowRequest): Promise<void>;
}

export interface CreateWorkflowCommand {
  workspaceId: EntityId<"workspaceId">;
  name: string;
  description?: string;
  triggerType?: "manual" | "schedule" | "webhook";
  triggerConfig?: any;
  steps: { agentId: string; stepOrder: number; nextSteps?: Array<{ targetStepId: string; condition?: string | null }> | null }[];
}

export interface UpdateWorkflowCommand {
  workspaceId: EntityId<"workspaceId">;
  workflowId: EntityId<"workflowId">;
  name?: string;
  description?: string | null;
  status?: WorkflowStatus;
  triggerType?: "manual" | "schedule" | "webhook";
  triggerConfig?: any;
  steps?: { agentId: string; stepOrder: number; nextSteps?: Array<{ targetStepId: string; condition?: string | null }> | null }[];
}

export interface ExecuteWorkflowCommand {
  workspaceId: EntityId<"workspaceId">;
  workflowId: EntityId<"workflowId">;
  triggeredBy: EntityId<"userId">;
  inputData?: Record<string, any>;
}

export class WorkflowUseCases {
  private repository: WorkflowRepository;
  private agentProvider: AgentSummaryProvider;
  private executionHandoff: WorkflowExecutionHandoff;

  constructor(repository: WorkflowRepository, agentProvider: AgentSummaryProvider, executionHandoff: WorkflowExecutionHandoff) {
    this.repository = repository;
    this.agentProvider = agentProvider;
    this.executionHandoff = executionHandoff;
  }

  async createWorkflow(command: CreateWorkflowCommand): Promise<{ workflow: WorkflowDto; steps: WorkflowStepDto[] }> {
    const workflowId = `wf_${crypto.randomUUID()}` as EntityId<"workflowId">;
    
    const steps = command.steps.map((step) =>
      createWorkflowStep(
        `wfs_${crypto.randomUUID()}` as EntityId<"workflowStepId">,
        command.workspaceId,
        workflowId,
        step.agentId as EntityId<"agentId">,
        step.stepOrder,
        step.nextSteps
      )
    );

    const workflow = createWorkflow(workflowId, command.workspaceId, command.name, command.description ?? null, command.triggerType ?? "manual", command.triggerConfig ?? null, steps);

    // Validate agents before creation
    const stepDtos = workflow.steps.map(toWorkflowStepDto);
    await validateWorkflowAgents(workflow.workspaceId, stepDtos, this.agentProvider);
    validateWorkflowDAG(stepDtos);

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

    if (command.description !== undefined) {
      workflow.description = command.description;
    }

    if (command.triggerType !== undefined) {
      workflow.triggerType = command.triggerType;
    }

    if (command.triggerConfig !== undefined) {
      workflow.triggerConfig = command.triggerConfig;
    }

    if (command.steps !== undefined) {
      workflow.steps = command.steps.map((step) =>
        createWorkflowStep(
          `wfs_${crypto.randomUUID()}` as EntityId<"workflowStepId">,
          command.workspaceId,
          workflow.workflowId,
          step.agentId as EntityId<"agentId">,
          step.stepOrder,
          step.nextSteps
        )
      );
    }

    // Ensure we update timestamp
    workflow.updatedAt = new Date().toISOString();

    // Re-validate agents on update to ensure no disabled agents are persisted if status is active, 
    // or simply just ensure the workflow remains valid.
    const stepDtos = workflow.steps.map(toWorkflowStepDto);
    await validateWorkflowAgents(workflow.workspaceId, stepDtos, this.agentProvider);
    validateWorkflowDAG(stepDtos);

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

  async listWorkflows(workspaceId: EntityId<"workspaceId">, limit = 50, offset = 0): Promise<{ items: (WorkflowDto & { stepCount: number })[]; total: number }> {
    const result = await this.repository.listByWorkspace(workspaceId, { limit, offset });
    return {
      total: result.total,
      items: result.items.map(w => ({ ...toWorkflowSummary(w), stepCount: w.steps?.length ?? 0 })),
    };
  }

  async executeWorkflow(command: ExecuteWorkflowCommand): Promise<void> {
    const workflow = await this.repository.findById(command.workspaceId, command.workflowId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "active") {
      throw new Error("Cannot execute inactive workflow");
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error("Cannot execute workflow with no steps");
    }

    // Validate agents to ensure they exist and are active
    await validateWorkflowAgents(command.workspaceId, workflow.steps.map(toWorkflowStepDto), this.agentProvider);

    const request: ExecuteWorkflowRequest = {
      workflowId: command.workflowId,
      workspaceId: command.workspaceId,
      triggeredBy: command.triggeredBy,
      triggerType: workflow.triggerType,
      inputData: command.inputData,
    };

    await this.executionHandoff.handoffExecution(request);
  }

  async deleteWorkflow(workspaceId: EntityId<"workspaceId">, workflowId: EntityId<"workflowId">): Promise<void> {
    const success = await this.repository.delete(workspaceId, workflowId);
    if (!success) {
      throw new Error("Workflow not found");
    }
  }
}
