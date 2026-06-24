/**
 * task-processing-controller.ts
 *
 * Deterministic, injected-dependency processing controller for the
 * Task & Orchestration PA5 prototype (Task 8A).
 *
 * Responsibilities:
 *   - Schedule the delayed transition from queued → running.
 *   - Drive ordered step progression (complete current → activate next).
 *   - Emit only existing semantic reducer actions through the injected sink.
 *   - Stop at the final-step boundary — completion belongs to a later task.
 *   - Isolate each task in its own session.
 *
 * Invariants:
 *   - Never mutates Task state directly.
 *   - Never calls any global clock, random-number, UUID-generator,
 *     or global timer function — all such dependencies are injected.
 *   - Never imports React, React hooks, backend services, ORM clients,
 *     database internals, or private agent/workflow module files.
 *   - Each Task ID maps to an isolated, independent session.
 *   - At most one pending start schedule per Task.
 */

import type { EntityId } from "@vcp/shared";

import { ORDERED_STEP_IDS } from "./task-processing";
import type { TaskCreationAction } from "./task-creation-state";

// ---------------------------------------------------------------------------
// Injected-boundary interfaces
// ---------------------------------------------------------------------------

/** Handle returned by TaskProcessingScheduler.schedule — allows cancellation. */
export interface TaskProcessingScheduleHandle {
  cancel(): void;
}

/** Injected scheduler — wraps all asynchronous timing. */
export interface TaskProcessingScheduler {
  schedule(
    delayMs: number,
    callback: () => void
  ): TaskProcessingScheduleHandle;
}

/** Injected clock — supplies ISO-8601 timestamps via injection, not the wall clock. */
export interface TaskProcessingTimeSource {
  now(): string;
}

/** Injected log-ID generator — produces unique log IDs without global randomness sources. */
export interface TaskProcessingLogIdentitySource {
  nextLogId(): string;
}

/** Injected action sink — the only way the controller changes Task state. */
export interface TaskProcessingActionSink {
  dispatch(action: TaskCreationAction): void;
}

// ---------------------------------------------------------------------------
// Public controller interface
// ---------------------------------------------------------------------------

export interface TaskProcessingController {
  /**
   * Schedule the queued → running transition for a task.
   *
   * Policy: at most one pending start schedule per Task.
   * Calling scheduleStart() when a pending schedule already exists for the
   * same taskId is a no-op (duplicate scheduling is silently ignored).
   * This prevents double-scheduling due to accidental re-render or
   * race conditions.
   */
  scheduleStart(taskId: EntityId<"taskId">): void;

  /**
   * Advance the running task one step:
   *   1. Complete the current active step.
   *   2. Append a completion log.
   *   3. Activate the next waiting step (if one exists).
   *   4. Append an activation log.
   *
   * Throws when:
   *   - No session exists for taskId (advance before scheduleStart fired).
   *   - The session has already passed the final-step boundary.
   *
   * At the final-step boundary: throws TaskFinalStepBoundaryError.
   * This error signals that Task completion belongs to a later task (Task 9+).
   */
  advance(taskId: EntityId<"taskId">): void;

  /**
   * Stop a task controller session without emitting any lifecycle transition.
   *
   * - Cancels a pending scheduled start when present.
   * - Removes the internal session.
   * - Safe when no session exists.
   * - Does NOT emit cancelled / failed / succeeded.
   * - Does NOT implement cancellation execution (Task 12 scope).
   */
  stop(taskId: EntityId<"taskId">): void;

  /**
   * Dispose all sessions.
   *
   * - Cancels every pending schedule handle.
   * - Removes all internal sessions.
   * - Idempotent: calling dispose() multiple times is safe.
   * - Emits no lifecycle transition.
   */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Stable error type for the final-step boundary
// ---------------------------------------------------------------------------

/**
 * Thrown by advance() when the final processing step has been reached.
 *
 * This is NOT a runtime failure — it is a deliberate boundary that signals
 * Task completion (succeeded / failed) belongs to a later implementation task.
 */
export class TaskFinalStepBoundaryError extends Error {
  constructor(taskId: string) {
    super(
      `Task "${taskId}" has reached the final processing-step boundary. ` +
        "Completion, failure, and cancellation belong to a later task."
    );
    this.name = "TaskFinalStepBoundaryError";
  }
}

/**
 * Thrown by advance() when no session exists for the given taskId.
 * This typically means advance() was called before the scheduled callback
 * fired, or after stop()/dispose().
 */
export class TaskSessionNotFoundError extends Error {
  constructor(taskId: string) {
    super(
      `No active controller session found for task "${taskId}". ` +
        "Call scheduleStart() and wait for the scheduled callback to fire."
    );
    this.name = "TaskSessionNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Factory options
// ---------------------------------------------------------------------------

export interface TaskProcessingControllerOptions {
  /** Injected scheduler — must not use real global timers. */
  readonly scheduler: TaskProcessingScheduler;
  /** Injected clock — supplies ISO-8601 timestamps through injection only. */
  readonly clock: TaskProcessingTimeSource;
  /** Injected log-ID generator — produces unique IDs through injection only. */
  readonly logIdentitySource: TaskProcessingLogIdentitySource;
  /** Injected action sink — the authoritative reducer dispatcher. */
  readonly actionSink: TaskProcessingActionSink;
  /** Delay in ms before the queued → running transition fires. */
  readonly pendingDelayMs: number;
}

// ---------------------------------------------------------------------------
// Internal session type — one per task ID
// ---------------------------------------------------------------------------

interface TaskControllerSession {
  /** Pending start schedule handle — present until callback fires. */
  pendingStartHandle: TaskProcessingScheduleHandle | null;
  /**
   * Index into ORDERED_STEP_IDS representing the step that is currently
   * active (or about to be advanced away from).
   *
   * Set to 0 when the session is created (validate-input is first).
   * Incremented each time advance() completes a step.
   * When activeStepIndex === ORDERED_STEP_IDS.length, the final-step
   * boundary has been passed.
   */
  activeStepIndex: number;
  /** True once the scheduled callback has fired and processing has started. */
  started: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new TaskProcessingController with injected dependencies.
 *
 * The controller manages independent sessions for each task ID.
 * Sessions are created lazily by scheduleStart() and removed by stop() or
 * dispose().
 */
export function createTaskProcessingController(
  options: TaskProcessingControllerOptions
): TaskProcessingController {
  const { scheduler, clock, logIdentitySource, actionSink, pendingDelayMs } =
    options;

  // Map from taskId string → isolated session.
  const sessions = new Map<string, TaskControllerSession>();

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  function _emitAction(action: TaskCreationAction): void {
    // Errors from the action sink are propagated to the caller, not swallowed.
    actionSink.dispatch(action);
  }

  function _buildStartLog(
    taskId: EntityId<"taskId">,
    timestamp: string
  ): TaskCreationAction {
    return {
      type: "processing-log-appended",
      taskId,
      log: {
        id: logIdentitySource.nextLogId(),
        timestamp,
        level: "info",
        stepId: ORDERED_STEP_IDS[0],
        message: "Processing started — validating input."
      }
    };
  }

  function _buildActivationLog(
    taskId: EntityId<"taskId">,
    stepId: string,
    timestamp: string
  ): TaskCreationAction {
    const labels: Record<string, string> = {
      "validate-input": "Validating input.",
      "analyze-request": "Analyzing request.",
      "select-routing": "Selecting agent or workflow.",
      "execute-task": "Executing task.",
      "aggregate-result": "Aggregating result.",
      finalize: "Finalizing."
    };

    return {
      type: "processing-log-appended",
      taskId,
      log: {
        id: logIdentitySource.nextLogId(),
        timestamp,
        level: "info",
        stepId,
        message: labels[stepId] ?? `Step "${stepId}" activated.`
      }
    };
  }

  function _buildCompletionLog(
    taskId: EntityId<"taskId">,
    stepId: string,
    timestamp: string
  ): TaskCreationAction {
    const labels: Record<string, string> = {
      "validate-input": "Input validated successfully.",
      "analyze-request": "Request analyzed.",
      "select-routing": "Agent or workflow selected.",
      "execute-task": "Task executed.",
      "aggregate-result": "Result aggregated.",
      finalize: "Processing finalized."
    };

    return {
      type: "processing-log-appended",
      taskId,
      log: {
        id: logIdentitySource.nextLogId(),
        timestamp,
        level: "success",
        stepId,
        message: labels[stepId] ?? `Step "${stepId}" completed.`
      }
    };
  }

  // -------------------------------------------------------------------------
  // scheduleStart
  // -------------------------------------------------------------------------

  function scheduleStart(taskId: EntityId<"taskId">): void {
    const key = taskId as string;

    // Duplicate scheduling policy: silently ignore when a session already
    // exists for this task.  This prevents double-scheduling caused by
    // accidental re-renders or race conditions.
    if (sessions.has(key)) {
      return;
    }

    const session: TaskControllerSession = {
      pendingStartHandle: null,
      activeStepIndex: 0,
      started: false
    };
    sessions.set(key, session);

    const handle = scheduler.schedule(pendingDelayMs, () => {
      // Remove the pending handle — it has now fired.
      session.pendingStartHandle = null;

      // Guard: if the session was removed (stop/dispose) while we were
      // waiting, do not emit any action.
      if (!sessions.has(key)) {
        return;
      }

      session.started = true;

      const timestamp = clock.now();

      // 1. Emit processing-started (queued → running transition via reducer).
      _emitAction({
        type: "processing-started",
        taskId,
        startedAt: timestamp
      });

      // 2. Emit the initial activation log for the first step.
      //    (startProcessing already activates validate-input; this log
      //     records the activation event in the logs array.)
      _emitAction(_buildStartLog(taskId, timestamp));
    });

    session.pendingStartHandle = handle;
  }

  // -------------------------------------------------------------------------
  // advance
  // -------------------------------------------------------------------------

  function advance(taskId: EntityId<"taskId">): void {
    const key = taskId as string;
    const session = sessions.get(key);

    if (!session) {
      throw new TaskSessionNotFoundError(key);
    }

    if (!session.started) {
      throw new TaskSessionNotFoundError(
        `${key} (session exists but scheduled callback has not fired yet)`
      );
    }

    const currentIndex = session.activeStepIndex;
    const totalSteps = ORDERED_STEP_IDS.length;

    // Final-step boundary: all steps have been driven through advance().
    // Completion (succeeded/failed) belongs to a later task.
    if (currentIndex >= totalSteps) {
      throw new TaskFinalStepBoundaryError(key);
    }

    const currentStepId = ORDERED_STEP_IDS[currentIndex];
    const timestamp = clock.now();

    // Step 1 — complete the currently active step.
    _emitAction({
      type: "processing-step-completed",
      taskId,
      stepId: currentStepId,
      completedAt: timestamp
    });

    // Step 2 — append a completion log for the current step.
    _emitAction(_buildCompletionLog(taskId, currentStepId, timestamp));

    // Advance internal index.
    session.activeStepIndex = currentIndex + 1;
    const nextIndex = session.activeStepIndex;

    // Step 3 — activate the next step when it exists.
    if (nextIndex < totalSteps) {
      const nextStepId = ORDERED_STEP_IDS[nextIndex];

      _emitAction({
        type: "processing-step-activated",
        taskId,
        stepId: nextStepId
      });

      // Step 4 — append an activation log for the next step.
      _emitAction(_buildActivationLog(taskId, nextStepId, timestamp));
    }
    // When nextIndex === totalSteps the final-step boundary is now stored in
    // session.activeStepIndex.  The NEXT call to advance() will throw
    // TaskFinalStepBoundaryError, ensuring callers always check the boundary.
  }

  // -------------------------------------------------------------------------
  // stop
  // -------------------------------------------------------------------------

  function stop(taskId: EntityId<"taskId">): void {
    const key = taskId as string;
    const session = sessions.get(key);

    if (!session) {
      // Safe no-op for unknown tasks.
      return;
    }

    // Cancel a pending start schedule if it has not yet fired.
    if (session.pendingStartHandle !== null) {
      session.pendingStartHandle.cancel();
      session.pendingStartHandle = null;
    }

    sessions.delete(key);
    // Does NOT emit cancelled / failed / succeeded.
    // Cancellation execution belongs to Task 12.
  }

  // -------------------------------------------------------------------------
  // dispose
  // -------------------------------------------------------------------------

  function dispose(): void {
    for (const session of sessions.values()) {
      if (session.pendingStartHandle !== null) {
        session.pendingStartHandle.cancel();
        session.pendingStartHandle = null;
      }
    }
    sessions.clear();
    // Idempotent: calling dispose() again is safe — sessions is already empty.
  }

  // -------------------------------------------------------------------------
  // Return the public controller
  // -------------------------------------------------------------------------

  return { scheduleStart, advance, stop, dispose };
}
