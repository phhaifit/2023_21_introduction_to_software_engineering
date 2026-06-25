/**
 * task-cancellation-coordinator.ts
 *
 * Deterministic cancellation cleanup coordinator for the Task & Orchestration
 * PA5 prototype (Task 12A).
 *
 * Responsibilities:
 *   - Coordinate the deterministic cleanup of pending, processing, streaming,
 *     and completion sessions when a task is cancelled.
 *   - Ensure each stopper receives the correct Task ID.
 *   - Dispatch the semantic "task-cancelled" action exactly once.
 *   - Prevent duplicate and re-entrant cancellation per task.
 *   - Implement a robust cleanup error policy: if a stopper throws, all remaining
 *     stoppers are still attempted, errors are aggregated, in-flight state is
 *     cleared, and cancellation dispatch is halted.
 *
 * Invariants:
 *   - Never mutates Task state directly; does not store duplicate Task state.
 *   - Never uses global clock, random, or timer APIs (all injected).
 *   - Never calls global dispose() on dependency controllers.
 *   - Never imports React, backend services, or database internals.
 */

import type { EntityId } from "@vcp/shared";

import type { CreatedTaskRecord } from "./task-types";
import type { TaskCreationAction } from "./task-creation-state";
import { isTerminalTaskStatus } from "./task-lifecycle";

// ---------------------------------------------------------------------------
// Injected Dependencies
// ---------------------------------------------------------------------------

export interface TaskCancellationStateReader {
  findTask(taskId: EntityId<"taskId">): CreatedTaskRecord | undefined;
}

export interface TaskProcessingStopper {
  stop(taskId: EntityId<"taskId">): void;
}

export interface TaskStreamingStopper {
  stop(taskId: EntityId<"taskId">): void;
}

export interface TaskCompletionStopper {
  stop(taskId: EntityId<"taskId">): void;
}

export interface TaskCancellationTimeSource {
  nowIso(): string;
}

export interface TaskCancellationActionSink {
  dispatch(action: TaskCreationAction): void;
}

export interface TaskCancellationCoordinatorOptions {
  readonly stateReader: TaskCancellationStateReader;
  /** Acts as both Pending and Processing stopper as per ownership rules. */
  readonly processingStopper: TaskProcessingStopper;
  readonly streamingStopper: TaskStreamingStopper;
  readonly completionStopper: TaskCompletionStopper;
  readonly clock: TaskCancellationTimeSource;
  readonly actionSink: TaskCancellationActionSink;
}

// ---------------------------------------------------------------------------
// Public Interface & Errors
// ---------------------------------------------------------------------------

export interface TaskCancellationCoordinator {
  /**
   * Deterministically stop all active sessions for the given task and dispatch
   * the semantic cancellation action.
   */
  cancel(taskId: EntityId<"taskId">): void;

  /**
   * Dispose the coordinator. Clears in-flight metadata without dispatching
   * actions or calling dispose on dependency controllers. Idempotent.
   */
  dispose(): void;
}

export class TaskCancellationCoordinatorDisposedError extends Error {
  constructor() {
    super("Cannot cancel task: TaskCancellationCoordinator is disposed.");
    this.name = "TaskCancellationCoordinatorDisposedError";
  }
}

// ---------------------------------------------------------------------------
// Factory Implementation
// ---------------------------------------------------------------------------

export function createTaskCancellationCoordinator(
  options: TaskCancellationCoordinatorOptions
): TaskCancellationCoordinator {
  const {
    stateReader,
    processingStopper,
    streamingStopper,
    completionStopper,
    clock,
    actionSink
  } = options;

  // Track in-flight cancellations to prevent duplicate/re-entrant calls per task.
  const inFlight = new Set<string>();
  let disposed = false;

  function cancel(taskId: EntityId<"taskId">): void {
    if (disposed) {
      throw new TaskCancellationCoordinatorDisposedError();
    }

    const key = taskId as string;

    // 1. Prevent duplicate/re-entrant cancellation per task.
    if (inFlight.has(key)) {
      return;
    }

    // 2. Read authoritative Task.
    const task = stateReader.findTask(taskId);
    if (!task) {
      return;
    }

    // 3. Verify status is cancellable (terminal statuses reject/ignore cancellation).
    if (isTerminalTaskStatus(task.status)) {
      return;
    }

    // Mark task as in-flight.
    inFlight.add(key);

    const errors: unknown[] = [];

    // 4. Stop Pending & Processing sessions.
    try {
      processingStopper.stop(taskId);
    } catch (err) {
      errors.push(err);
    }

    // 5. Stop Streaming session.
    try {
      streamingStopper.stop(taskId);
    } catch (err) {
      errors.push(err);
    }

    // 6. Stop Completion session.
    try {
      completionStopper.stop(taskId);
    } catch (err) {
      errors.push(err);
    }

    // 7. Cleanup error policy: if any stopper threw, halt dispatch, clear in-flight
    // metadata, and propagate errors via AggregateError.
    if (errors.length > 0) {
      inFlight.delete(key);
      throw new AggregateError(
        errors,
        `TaskCancellationCoordinator encountered errors while stopping sessions for task "${key}".`
      );
    }

    // 8. Dispatch semantic cancellation action exactly once.
    try {
      actionSink.dispatch({
        type: "task-cancelled",
        taskId,
        cancelledAt: clock.nowIso()
      });
    } finally {
      // 9. Clear internal in-flight metadata.
      inFlight.delete(key);
    }
  }

  function dispose(): void {
    disposed = true;
    inFlight.clear();
  }

  return { cancel, dispose };
}
