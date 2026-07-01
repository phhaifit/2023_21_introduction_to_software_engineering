import type { PrismaClient } from "@vcp/database";
import type { EntityId, TaskRoutingSelection, TaskStatus } from "@vcp/shared";
import type { TaskRepository } from "../application/task-repository.ts";
import type { Task } from "../domain/task.ts";

export class PrismaTaskRepository implements TaskRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async save(workspaceId: EntityId<"workspaceId">, task: Task): Promise<Task> {
    const record = await this.prisma.task.upsert({
      where: { taskId: task.taskId as string },
      create: {
        taskId: task.taskId as string,
        workspaceId: workspaceId as string,
        submittedByUserId: task.submittedByUserId as string,
        prompt: task.prompt,
        routingMode: task.requestedRouting.mode,
        agentId: task.requestedRouting.mode === "specific-agent" ? task.requestedRouting.agentId : null,
        workflowId: task.requestedRouting.mode === "predefined-workflow" ? task.requestedRouting.workflowId : null,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      },
      update: {
        prompt: task.prompt,
        routingMode: task.requestedRouting.mode,
        agentId: task.requestedRouting.mode === "specific-agent" ? task.requestedRouting.agentId : null,
        workflowId: task.requestedRouting.mode === "predefined-workflow" ? task.requestedRouting.workflowId : null,
        status: task.status,
        updatedAt: task.updatedAt
      }
    });

    return toDomainTask(record);
  }

  async findById(
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<Task | null> {
    const record = await this.prisma.task.findFirst({
      where: {
        workspaceId: workspaceId as string,
        taskId: taskId as string
      }
    });

    return record ? toDomainTask(record) : null;
  }
}

function toDomainTask(record: {
  taskId: string;
  workspaceId: string;
  submittedByUserId: string;
  prompt: string;
  routingMode: string;
  agentId: string | null;
  workflowId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}): Task {
  return {
    taskId: record.taskId as EntityId<"taskId">,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    submittedByUserId: record.submittedByUserId as EntityId<"userId">,
    prompt: record.prompt,
    requestedRouting: toRouting(record),
    status: record.status as TaskStatus,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toRouting(record: {
  routingMode: string;
  agentId: string | null;
  workflowId: string | null;
}): TaskRoutingSelection {
  if (record.routingMode === "specific-agent" && record.agentId) {
    return { mode: "specific-agent", agentId: record.agentId as EntityId<"agentId"> };
  }
  if (record.routingMode === "predefined-workflow" && record.workflowId) {
    return { mode: "predefined-workflow", workflowId: record.workflowId as EntityId<"workflowId"> };
  }
  return { mode: "auto" };
}
