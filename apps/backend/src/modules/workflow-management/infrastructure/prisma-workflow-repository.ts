import type { PrismaClient } from "@prisma/client";
import type { EntityId } from "@vcp/shared/contracts/ids.ts";
import type { WorkflowStatus } from "@vcp/shared/contracts/statuses.ts";
import type { Workflow, WorkflowStep } from "../domain/workflow.ts";
import type { WorkflowRepository } from "./workflow-repository.ts";

export class PrismaWorkflowRepository implements WorkflowRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async save(workflow: Workflow): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Upsert the workflow itself
      await tx.workflow.upsert({
        where: { workflowId: workflow.workflowId },
        update: {
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          triggerType: workflow.triggerType,
          triggerConfig: workflow.triggerConfig ? JSON.stringify(workflow.triggerConfig) : null,
          version: workflow.version,
          parentWorkflowId: workflow.parentWorkflowId,
          updatedAt: workflow.updatedAt,
        },
        create: {
          workflowId: workflow.workflowId,
          workspaceId: workflow.workspaceId,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          triggerType: workflow.triggerType,
          triggerConfig: workflow.triggerConfig ? JSON.stringify(workflow.triggerConfig) : null,
          version: workflow.version,
          parentWorkflowId: workflow.parentWorkflowId,
          createdAt: workflow.createdAt,
          updatedAt: workflow.updatedAt,
        },
      });

      // Handle steps: delete old ones and insert new ones
      await tx.workflowStep.deleteMany({
        where: { workflowId: workflow.workflowId },
      });

      if (workflow.steps.length > 0) {
        await tx.workflowStep.createMany({
          data: workflow.steps.map((step) => ({
            workflowStepId: step.workflowStepId,
            workspaceId: step.workspaceId,
            workflowId: step.workflowId,
            agentId: step.agentId,
            stepType: step.stepType,
            stepOrder: step.stepOrder,
            nextSteps: step.nextSteps ? JSON.stringify(step.nextSteps) : null,
            inputMapping: step.inputMapping ? JSON.stringify(step.inputMapping) : null,
            createdAt: step.createdAt,
            updatedAt: step.updatedAt,
          })),
        });
      }
    });
  }

  async findById(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">
  ): Promise<Workflow | null> {
    const record = await this.prisma.workflow.findUnique({
      where: { workflowId },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    if (!record || record.workspaceId !== workspaceId) {
      return null;
    }

    return {
      workflowId: record.workflowId as EntityId<"workflowId">,
      workspaceId: record.workspaceId as EntityId<"workspaceId">,
      name: record.name,
      description: record.description,
      status: record.status as WorkflowStatus,
      triggerType: (record.triggerType as "manual" | "schedule" | "webhook") || "manual",
      triggerConfig: record.triggerConfig ? JSON.parse(record.triggerConfig as string) : null,
      version: record.version,
      parentWorkflowId: record.parentWorkflowId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      steps: record.steps.map(
        (step): WorkflowStep => ({
          workflowStepId: step.workflowStepId as EntityId<"workflowStepId">,
          workspaceId: step.workspaceId as EntityId<"workspaceId">,
          workflowId: step.workflowId as EntityId<"workflowId">,
          agentId: step.agentId ? step.agentId as EntityId<"agentId"> : null,
          stepType: (step.stepType as "agent" | "approval") || "agent",
          stepOrder: step.stepOrder,
          nextSteps: step.nextSteps ? JSON.parse(step.nextSteps as string) : null,
          inputMapping: step.inputMapping ? JSON.parse(step.inputMapping as string) : null,
          createdAt: step.createdAt,
          updatedAt: step.updatedAt,
        })
      ),
    };
  }

  async listByWorkspace(
    workspaceId: EntityId<"workspaceId">,
    options?: { limit?: number; offset?: number }
  ): Promise<{ items: Workflow[]; total: number }> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const [total, records] = await Promise.all([
      this.prisma.workflow.count({ where: { workspaceId } }),
      this.prisma.workflow.findMany({
        where: { workspaceId },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        include: {
          steps: {
            orderBy: { stepOrder: "asc" },
          },
        },
      }),
    ]);

    const items: Workflow[] = records.map((record) => ({
      workflowId: record.workflowId as EntityId<"workflowId">,
      workspaceId: record.workspaceId as EntityId<"workspaceId">,
      name: record.name,
      description: record.description,
      status: record.status as WorkflowStatus,
      triggerType: (record.triggerType as "manual" | "schedule" | "webhook") || "manual",
      triggerConfig: record.triggerConfig ? JSON.parse(record.triggerConfig as string) : null,
      version: record.version,
      parentWorkflowId: record.parentWorkflowId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      steps: record.steps.map(
        (step): WorkflowStep => ({
          workflowStepId: step.workflowStepId as EntityId<"workflowStepId">,
          workspaceId: step.workspaceId as EntityId<"workspaceId">,
          workflowId: step.workflowId as EntityId<"workflowId">,
          agentId: step.agentId ? step.agentId as EntityId<"agentId"> : null,
          stepType: (step.stepType as "agent" | "approval") || "agent",
          stepOrder: step.stepOrder,
          nextSteps: step.nextSteps ? JSON.parse(step.nextSteps as string) : null,
          inputMapping: step.inputMapping ? JSON.parse(step.inputMapping as string) : null,
          createdAt: step.createdAt,
          updatedAt: step.updatedAt,
        })
      ),
    }));

    return { total, items };
  }

  async delete(
    workspaceId: EntityId<"workspaceId">,
    workflowId: EntityId<"workflowId">
  ): Promise<boolean> {
    const existing = await this.prisma.workflow.findUnique({
      where: { workflowId },
    });

    if (!existing || existing.workspaceId !== workspaceId) {
      return false;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowStep.deleteMany({ where: { workflowId } });
      await tx.workflow.delete({ where: { workflowId } });
    });

    return true;
  }

  async createExecution(execution: import("@vcp/shared/contracts/workflow.ts").WorkflowExecutionDto): Promise<void> {
    await this.prisma.workflowExecution.create({
      data: {
        executionId: execution.executionId,
        workspaceId: execution.workspaceId,
        workflowId: execution.workflowId,
        status: execution.status,
        triggeredBy: execution.triggeredBy,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
      },
    });
  }

  async updateExecutionStatus(workspaceId: EntityId<"workspaceId">, executionId: EntityId<"executionId">, status: import("@vcp/shared/contracts/workflow.ts").WorkflowExecutionStatus, completedAt?: string): Promise<void> {
    await this.prisma.workflowExecution.updateMany({
      where: { executionId, workspaceId },
      data: {
        status,
        ...(completedAt && { completedAt })
      }
    });
  }

  async createStepLog(log: import("@vcp/shared/contracts/workflow.ts").WorkflowStepLogDto): Promise<void> {
    await this.prisma.workflowStepLog.create({
      data: {
        logId: log.logId,
        workspaceId: log.workspaceId,
        executionId: log.executionId,
        workflowStepId: log.workflowStepId,
        status: log.status,
        inputData: log.inputData ? JSON.stringify(log.inputData) : null,
        outputData: log.outputData ? JSON.stringify(log.outputData) : null,
        errorMsg: log.errorMsg,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
      },
    });
  }

  async updateStepLog(logId: EntityId<"logId">, status: string, outputData?: any, errorMsg?: string, completedAt?: string): Promise<void> {
    await this.prisma.workflowStepLog.update({
      where: { logId },
      data: {
        status,
        ...(outputData && { outputData: JSON.stringify(outputData) }),
        ...(errorMsg && { errorMsg }),
        ...(completedAt && { completedAt })
      }
    });
  }
}
