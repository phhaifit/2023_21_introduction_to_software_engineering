import type { PrismaClient } from "@vcp/database";
import type { EntityId, TaskStatus } from "@vcp/shared";
import type { TaskWorkRepository } from "../application/task-work-repository.ts";
import type { ResolvedTaskRouting, TaskWork } from "../domain/task-work.ts";

export class PrismaTaskWorkRepository implements TaskWorkRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async save(workspaceId: EntityId<"workspaceId">, work: TaskWork): Promise<TaskWork> {
    const record = await this.prisma.taskRun.upsert({
      where: { taskRunId: work.workId as string },
      create: {
        taskRunId: work.workId as string,
        workspaceId: workspaceId as string,
        taskId: work.taskId as string,
        status: work.status,
        attemptNumber: work.attemptNumber,
        resolvedAgentId: work.resolvedRouting?.destination === "agent" ? work.resolvedRouting.agentId : null,
        resolvedWorkflowId: work.resolvedRouting?.destination === "workflow" ? work.resolvedRouting.workflowId : null,
        result: work.result === undefined ? undefined : work.result,
        errorCode: work.errorCode,
        errorMessage: work.errorMessage,
        queuedAt: work.queuedAt,
        startedAt: work.startedAt,
        completedAt: work.finishedAt,
        createdAt: work.createdAt,
        updatedAt: work.updatedAt
      },
      update: {
        status: work.status,
        resolvedAgentId: work.resolvedRouting?.destination === "agent" ? work.resolvedRouting.agentId : null,
        resolvedWorkflowId: work.resolvedRouting?.destination === "workflow" ? work.resolvedRouting.workflowId : null,
        result: work.result === undefined ? undefined : work.result,
        errorCode: work.errorCode,
        errorMessage: work.errorMessage,
        startedAt: work.startedAt,
        completedAt: work.finishedAt,
        updatedAt: work.updatedAt
      }
    });

    return toDomainTaskWork(record);
  }

  async findById(
    workspaceId: EntityId<"workspaceId">,
    workId: EntityId<"workId">
  ): Promise<TaskWork | null> {
    const record = await this.prisma.taskRun.findFirst({
      where: {
        workspaceId: workspaceId as string,
        taskRunId: workId as string
      }
    });

    return record ? toDomainTaskWork(record) : null;
  }

  async listByTaskId(
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<readonly TaskWork[]> {
    const records = await this.prisma.taskRun.findMany({
      where: {
        workspaceId: workspaceId as string,
        taskId: taskId as string
      },
      orderBy: { attemptNumber: "asc" }
    });

    return records.map(toDomainTaskWork);
  }
}

function toDomainTaskWork(record: {
  taskRunId: string;
  workspaceId: string;
  taskId: string;
  status: string;
  attemptNumber: number;
  resolvedAgentId: string | null;
  resolvedWorkflowId: string | null;
  result: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}): TaskWork {
  return {
    workId: record.taskRunId as EntityId<"workId">,
    taskId: record.taskId as EntityId<"taskId">,
    workspaceId: record.workspaceId as EntityId<"workspaceId">,
    attemptNumber: record.attemptNumber,
    status: record.status as TaskStatus,
    resolvedRouting: toResolvedRouting(record),
    result: record.result ?? undefined,
    errorCode: record.errorCode ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    queuedAt: record.queuedAt,
    startedAt: record.startedAt ?? undefined,
    finishedAt: record.completedAt ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toResolvedRouting(record: {
  resolvedAgentId: string | null;
  resolvedWorkflowId: string | null;
}): ResolvedTaskRouting | null {
  if (record.resolvedAgentId) {
    return { destination: "agent", agentId: record.resolvedAgentId as EntityId<"agentId"> };
  }
  if (record.resolvedWorkflowId) {
    return {
      destination: "workflow",
      workflowId: record.resolvedWorkflowId as EntityId<"workflowId">
    };
  }
  return null;
}
