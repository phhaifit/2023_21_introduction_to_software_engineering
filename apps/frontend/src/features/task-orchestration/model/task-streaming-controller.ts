/**
 * task-streaming-controller.ts
 *
 * Deterministic, injected-dependency streaming controller for the
 * Task & Orchestration PA5 prototype (Task 9A).
 *
 * Responsibilities:
 *   - Dispatch streaming-started and schedule fragment delivery.
 *   - Append one fragment per scheduled callback in source order.
 *   - Dispatch streaming-exhausted when all fragments are delivered.
 *   - Stop at the exhausted boundary — completion belongs to a later task.
 *   - Isolate each task in its own session.
 *
 * Invariants:
 *   - Never mutates Task state directly.
 *   - Never calls any global clock, random-number, UUID-generator,
 *     or global timer function — all such dependencies are injected.
 *   - Never imports React, React hooks, backend services, ORM clients,
 *     database internals, or private agent/workflow module files.
 *   - Each Task ID maps to an isolated, independent session.
 *   - At most one pending fragment schedule per Task.
 */

import type { EntityId } from "@vcp/shared";

import type { TaskCreationAction } from "./task-creation-state";
import type { CreatedTaskRecord } from "./task-types";
import type {
  TaskProcessingScheduleHandle,
  TaskProcessingScheduler,
  TaskProcessingTimeSource
} from "./task-processing-controller";
import { INITIAL_STREAMING_SEQUENCE } from "./task-streaming";

// ---------------------------------------------------------------------------
// Injected-boundary interfaces
// ---------------------------------------------------------------------------

export interface TaskStreamingFragmentSource {
  getFragments(taskId: EntityId<"taskId">): readonly string[];
}

export interface TaskStreamingFragmentIdentitySource {
  nextFragmentId(): string;
}

export interface TaskStreamingStateReader {
  findTask(taskId: EntityId<"taskId">): CreatedTaskRecord | null;
}

export interface TaskStreamingActionSink {
  dispatch(action: TaskCreationAction): void;
}

// ---------------------------------------------------------------------------
// Public controller interface
// ---------------------------------------------------------------------------

export interface TaskStreamingController {
  /**
   * Begin streaming for a running task whose streaming phase is idle.
   *
   * Policy: at most one session per Task. Duplicate start is a no-op.
   */
  start(taskId: EntityId<"taskId">): void;

  /**
   * Append the next fragment or exhaust streaming when no fragments remain.
   *
   * Typically invoked by the scheduled callback after start().
   */
  advance(taskId: EntityId<"taskId">): void;

  /**
   * Cancel pending schedules and remove the session without clearing fragments.
   */
  stop(taskId: EntityId<"taskId">): void;

  /** Cancel all pending schedules and clear every session. Idempotent. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Factory options
// ---------------------------------------------------------------------------

export interface TaskStreamingControllerOptions {
  readonly scheduler: TaskProcessingScheduler;
  readonly clock: TaskProcessingTimeSource;
  readonly fragmentIdentitySource: TaskStreamingFragmentIdentitySource;
  readonly fragmentSource: TaskStreamingFragmentSource;
  readonly stateReader: TaskStreamingStateReader;
  readonly actionSink: TaskStreamingActionSink;
  readonly fragmentDelayMs: number;
}

// ---------------------------------------------------------------------------
// Internal session type — one per task ID
// ---------------------------------------------------------------------------

interface TaskStreamingSession {
  pendingHandle: TaskProcessingScheduleHandle | null;
  started: boolean;
  sessionToken: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createTaskStreamingController(
  options: TaskStreamingControllerOptions
): TaskStreamingController {
  const {
    scheduler,
    clock,
    fragmentIdentitySource,
    fragmentSource,
    stateReader,
    actionSink,
    fragmentDelayMs
  } = options;

  const sessions = new Map<string, TaskStreamingSession>();
  let nextSessionToken = 0;

  function _emitAction(action: TaskCreationAction): void {
    actionSink.dispatch(action);
  }

  function _canStream(task: CreatedTaskRecord | null): task is CreatedTaskRecord {
    return (
      task !== null &&
      task.status === "running" &&
      task.streamingSnapshot.phase === "streaming"
    );
  }

  function _scheduleNextFragment(
    taskId: EntityId<"taskId">,
    session: TaskStreamingSession
  ): void {
    const token = session.sessionToken;

    const handle = scheduler.schedule(fragmentDelayMs, () => {
      session.pendingHandle = null;

      if (!sessions.has(taskId as string)) {
        return;
      }

      const currentSession = sessions.get(taskId as string);
      if (!currentSession || currentSession.sessionToken !== token) {
        return;
      }

      advance(taskId);
    });

    session.pendingHandle = handle;
  }

  function start(taskId: EntityId<"taskId">): void {
    const key = taskId as string;

    if (sessions.has(key)) {
      return;
    }

    const task = stateReader.findTask(taskId);
    if (!task || task.status !== "running") {
      return;
    }

    if (task.streamingSnapshot.phase !== "idle") {
      return;
    }

    const session: TaskStreamingSession = {
      pendingHandle: null,
      started: false,
      sessionToken: ++nextSessionToken
    };
    sessions.set(key, session);

    _emitAction({
      type: "streaming-started",
      taskId,
      startedAt: clock.now()
    });

    session.started = true;
    _scheduleNextFragment(taskId, session);
  }

  function advance(taskId: EntityId<"taskId">): void {
    const key = taskId as string;
    const session = sessions.get(key);

    if (!session || !session.started) {
      return;
    }

    const task = stateReader.findTask(taskId);
    if (!_canStream(task)) {
      sessions.delete(key);
      return;
    }

    const fragments = fragmentSource.getFragments(taskId);
    const nextIndex = task.streamingSnapshot.fragments.length;

    if (nextIndex >= fragments.length) {
      _emitAction({
        type: "streaming-exhausted",
        taskId,
        exhaustedAt: clock.now()
      });
      sessions.delete(key);
      return;
    }

    const sequence = nextIndex + INITIAL_STREAMING_SEQUENCE;

    _emitAction({
      type: "streaming-fragment-appended",
      taskId,
      fragmentId: fragmentIdentitySource.nextFragmentId(),
      sequence,
      text: fragments[nextIndex],
      appendedAt: clock.now()
    });

    const updatedTask = stateReader.findTask(taskId);
    if (!_canStream(updatedTask)) {
      sessions.delete(key);
      return;
    }

    const remainingIndex = updatedTask.streamingSnapshot.fragments.length;
    if (remainingIndex >= fragments.length) {
      _emitAction({
        type: "streaming-exhausted",
        taskId,
        exhaustedAt: clock.now()
      });
      sessions.delete(key);
      return;
    }

    _scheduleNextFragment(taskId, session);
  }

  function stop(taskId: EntityId<"taskId">): void {
    const key = taskId as string;
    const session = sessions.get(key);

    if (!session) {
      return;
    }

    if (session.pendingHandle !== null) {
      session.pendingHandle.cancel();
      session.pendingHandle = null;
    }

    session.sessionToken = ++nextSessionToken;
    sessions.delete(key);
  }

  function dispose(): void {
    for (const session of sessions.values()) {
      if (session.pendingHandle !== null) {
        session.pendingHandle.cancel();
        session.pendingHandle = null;
      }
      session.sessionToken = ++nextSessionToken;
    }
    sessions.clear();
  }

  return { start, advance, stop, dispose };
}
