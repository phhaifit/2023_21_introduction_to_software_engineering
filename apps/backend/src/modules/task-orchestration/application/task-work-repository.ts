import type { EntityId } from "@vcp/shared";
import type { TaskWork } from "../domain/task-work.ts";

/**
 * Repository port for TaskWork aggregate persistence.
 *
 * All operations are workspace-scoped to enforce tenant isolation.
 * No unscoped `findById(workId)` operation is provided.
 *
 * Implementation deferred to future phase (Prisma adapter).
 */
export interface TaskWorkRepository {
  /**
   * Persist a TaskWork aggregate.
   *
   * @param workspaceId - Workspace context
   * @param work - TaskWork with all required fields
   * @returns Promise resolving to the persisted TaskWork
   */
  save(
    workspaceId: EntityId<"workspaceId">,
    work: TaskWork
  ): Promise<TaskWork>;

  /**
   * Find a TaskWork by workspace and Work ID.
   *
   * @param workspaceId - Workspace context
   * @param workId - Work identifier
   * @returns Promise resolving to the TaskWork or null if not found
   */
  findById(
    workspaceId: EntityId<"workspaceId">,
    workId: EntityId<"workId">
  ): Promise<TaskWork | null>;

  /**
   * List all TaskWork attempts for a Task within a workspace.
   *
   * Returned attempts are ordered by attempt number ascending (earliest first).
   *
   * @param workspaceId - Workspace context
   * @param taskId - Parent Task identifier
   * @returns Promise resolving to readonly list of TaskWork attempts, empty if none found
   */
  listByTaskId(
    workspaceId: EntityId<"workspaceId">,
    taskId: EntityId<"taskId">
  ): Promise<readonly TaskWork[]>;
}
