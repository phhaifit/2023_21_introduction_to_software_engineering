import type { EntityId } from "@vcp/shared";
import type { TaskWorkRepository } from "../application/task-work-repository.ts";
import type { TaskWork } from "../domain/task-work.ts";

export class InMemoryTaskWorkRepository implements TaskWorkRepository {
  private readonly workById = new Map<string, TaskWork>();

  async save(workspaceId: EntityId<"workspaceId">, work: TaskWork): Promise<TaskWork> {
    this.workById.set(workKey(workspaceId, work.workId), { ...work });
    return { ...work };
  }

  async findById(
    workspaceId: EntityId<"workspaceId">,
    workId: EntityId<"workId">
  ): Promise<TaskWork | null> {
    const found = this.workById.get(workKey(workspaceId, workId));
    return found ? { ...found } : null;
  }

  async listByTaskId(
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<readonly TaskWork[]> {
    return Array.from(this.workById.values())
      .filter((work) => work.workspaceId === workspaceId && work.taskId === taskId)
      .sort((a, b) => a.attemptNumber - b.attemptNumber)
      .map((work) => ({ ...work }));
  }
}

function workKey(workspaceId: EntityId<"workspaceId">, workId: EntityId<"workId">): string {
  return `${workspaceId}:${workId}`;
}
