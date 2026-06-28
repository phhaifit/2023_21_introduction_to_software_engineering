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
  status?: WorkflowStatus;
  triggerType?: "manual" | "schedule" | "webhook";
  triggerConfig?: any;
  steps: { workflowStepId?: string; agentId?: string | null; stepType?: "agent" | "approval"; stepOrder: number; nextSteps?: Array<{ targetStepId: string; condition?: string | null }> | null; inputMapping?: Record<string, string> | null }[];
}

export interface UpdateWorkflowCommand {
  workspaceId: EntityId<"workspaceId">;
  workflowId: EntityId<"workflowId">;
  name?: string;
  description?: string | null;
  status?: WorkflowStatus;
  triggerType?: "manual" | "schedule" | "webhook";
  triggerConfig?: any;
  steps?: { workflowStepId?: string; agentId?: string | null; stepType?: "agent" | "approval"; stepOrder: number; nextSteps?: Array<{ targetStepId: string; condition?: string | null }> | null; inputMapping?: Record<string, string> | null }[];
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
    
    const idMap = new Map<string, string>();
    const newStepIds = command.steps.map(step => {
      const newId = `wfs_${crypto.randomUUID()}` as EntityId<"workflowStepId">;
      if (step.workflowStepId) {
        idMap.set(step.workflowStepId, newId);
      }
      return newId;
    });

    const steps = command.steps.map((step, index) => {
      const mappedNextSteps = step.nextSteps?.map(next => ({
        ...next,
        targetStepId: idMap.get(next.targetStepId) || next.targetStepId
      })) || null;

      return createWorkflowStep(
        newStepIds[index],
        command.workspaceId,
        workflowId,
        step.agentId ? (step.agentId as EntityId<"agentId">) : null,
        step.stepType ?? "agent",
        step.stepOrder,
        mappedNextSteps,
        step.inputMapping
      );
    });

    const workflow = createWorkflow(workflowId, command.workspaceId, command.name, command.description ?? null, command.triggerType ?? "manual", command.triggerConfig ?? null, steps);

    // Apply status from command (createWorkflow defaults to "draft")
    if (command.status) {
      workflow.status = command.status as any;
    }

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

    // Handle Versioning: if the workflow is published, we don't mutate it. We create a new version.
    let targetWorkflow = workflow;
    if (workflow.status === "published") {
      // Archive old one
      workflow.status = "archived";
      await this.repository.save(workflow);

      // Create new version
      targetWorkflow = createWorkflow(
        `wf_${crypto.randomUUID()}` as EntityId<"workflowId">,
        workflow.workspaceId,
        command.name ?? workflow.name,
        command.description ?? workflow.description,
        command.triggerType ?? workflow.triggerType,
        command.triggerConfig ?? workflow.triggerConfig,
        []
      );
      targetWorkflow.version = workflow.version + 1;
      targetWorkflow.parentWorkflowId = workflow.workflowId;
      targetWorkflow.status = command.status ?? "draft";
    } else {
      if (command.name !== undefined) targetWorkflow.name = command.name;
      if (command.status !== undefined) targetWorkflow.status = command.status;
      if (command.description !== undefined) targetWorkflow.description = command.description;
      if (command.triggerType !== undefined) targetWorkflow.triggerType = command.triggerType;
      if (command.triggerConfig !== undefined) targetWorkflow.triggerConfig = command.triggerConfig;
    }

    if (command.steps !== undefined) {
      const idMap = new Map<string, string>();
      const newStepIds = command.steps.map(step => {
        const newId = `wfs_${crypto.randomUUID()}` as EntityId<"workflowStepId">;
        if (step.workflowStepId) {
          idMap.set(step.workflowStepId, newId);
        }
        return newId;
      });

      targetWorkflow.steps = command.steps.map((step, index) => {
        const mappedNextSteps = step.nextSteps?.map(next => ({
          ...next,
          targetStepId: idMap.get(next.targetStepId) || next.targetStepId
        })) || null;

        return createWorkflowStep(
          newStepIds[index],
          command.workspaceId,
          targetWorkflow.workflowId,
          step.agentId ? (step.agentId as EntityId<"agentId">) : null,
          step.stepType ?? "agent",
          step.stepOrder,
          mappedNextSteps,
          step.inputMapping
        );
      });
    } else if (targetWorkflow !== workflow && workflow.steps) {
      // Copy steps to new version if steps not provided in command
      targetWorkflow.steps = workflow.steps.map(step => 
        createWorkflowStep(
          `wfs_${crypto.randomUUID()}` as EntityId<"workflowStepId">,
          targetWorkflow.workspaceId,
          targetWorkflow.workflowId,
          step.agentId ? (step.agentId as EntityId<"agentId">) : null,
          step.stepType ?? "agent",
          step.stepOrder,
          step.nextSteps,
          step.inputMapping
        )
      );
    }

    targetWorkflow.updatedAt = new Date().toISOString();

    const stepDtos = targetWorkflow.steps.map(toWorkflowStepDto);
    await validateWorkflowAgents(targetWorkflow.workspaceId, stepDtos, this.agentProvider);
    validateWorkflowDAG(stepDtos);

    await this.repository.save(targetWorkflow);

    return {
      workflow: toWorkflowSummary(targetWorkflow),
      steps: targetWorkflow.steps.map(toWorkflowStepDto),
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

  async executeWorkflow(command: ExecuteWorkflowCommand): Promise<{ executionId: EntityId<"executionId"> }> {
    const workflow = await this.repository.findById(command.workspaceId, command.workflowId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }

    if (workflow.status !== "published") {
      throw new Error("Cannot execute inactive workflow");
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error("Cannot execute workflow with no steps");
    }

    // Validate agents to ensure they exist and are active
    await validateWorkflowAgents(command.workspaceId, workflow.steps.map(toWorkflowStepDto), this.agentProvider);

    const executionId = `wfe_${crypto.randomUUID()}` as EntityId<"executionId">;

    // Create execution record
    await this.repository.createExecution({
      executionId,
      workspaceId: command.workspaceId,
      workflowId: command.workflowId,
      status: "Pending",
      triggeredBy: command.triggeredBy,
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const request: ExecuteWorkflowRequest = {
      workflowId: command.workflowId,
      workspaceId: command.workspaceId,
      executionId,
      triggeredBy: command.triggeredBy,
      triggerType: workflow.triggerType,
      inputData: command.inputData,
    };

    // Fire-and-forget: don't await handoff so API returns immediately with executionId
    // The workflow runs in the background and emits events via eventBus
    setImmediate(() => {
      this.executionHandoff.handoffExecution(request).catch((err: any) => {
        console.error("[WorkflowUseCases] Async handoff failed:", err);
      });
    });

    return { executionId };
  }

  async deleteWorkflow(workspaceId: EntityId<"workspaceId">, workflowId: EntityId<"workflowId">): Promise<void> {
    const success = await this.repository.delete(workspaceId, workflowId);
    if (!success) {
      throw new Error("Workflow not found");
    }
  }
}
