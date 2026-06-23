import type { EntityId } from "@vcp/shared";
import type { Task } from "../domain/task.ts";

/**
 * Repository port for Task aggregate persistence.
 *
 * All operations are workspace-scoped to enforce tenant isolation.
 * No unscoped `findById(taskId)` operation is provided.
 *
 * Implementation deferred to future phase (Prisma adapter).
 */
export interface TaskRepository {
  /**
   * Persist a Task aggregate.
   *
   * @param workspaceId - Workspace context
   * @param task - Task with all required fields
   * @returns Promise resolving to the persisted Task
   */
  save(
    workspaceId: EntityId<"workspaceId">,
    task: Task
  ): Promise<Task>;

  /**
   * Find a Task by workspace and Task ID.
   *
   * @param workspaceId - Workspace context
   * @param taskId - Task identifier
   * @returns Promise resolving to the Task or null if not found
   */
  findById(
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<Task | null>;
}
