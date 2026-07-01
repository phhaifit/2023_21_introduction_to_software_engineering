import type { EntityId } from "@vcp/shared";
import type { TaskRepository } from "../application/task-repository.ts";
import type { Task } from "../domain/task.ts";

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();

  async save(workspaceId: EntityId<"workspaceId">, task: Task): Promise<Task> {
    this.tasks.set(key(workspaceId, task.taskId), { ...task });
    return { ...task };
  }

  async findById(
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<Task | null> {
    const found = this.tasks.get(key(workspaceId, taskId));
    return found ? { ...found } : null;
  }
}

function key(workspaceId: EntityId<"workspaceId">, taskId: EntityId<"taskId">): string {
  return `${workspaceId}:${taskId}`;
}
