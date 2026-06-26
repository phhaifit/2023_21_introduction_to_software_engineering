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
            stepOrder: step.stepOrder,
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
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      steps: record.steps.map(
        (step): WorkflowStep => ({
          workflowStepId: step.workflowStepId as EntityId<"workflowStepId">,
          workspaceId: step.workspaceId as EntityId<"workspaceId">,
          workflowId: step.workflowId as EntityId<"workflowId">,
          agentId: step.agentId as EntityId<"agentId">,
          stepOrder: step.stepOrder,
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
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      steps: record.steps.map(
        (step): WorkflowStep => ({
          workflowStepId: step.workflowStepId as EntityId<"workflowStepId">,
          workspaceId: step.workspaceId as EntityId<"workspaceId">,
          workflowId: step.workflowId as EntityId<"workflowId">,
          agentId: step.agentId as EntityId<"agentId">,
          stepOrder: step.stepOrder,
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
}
