import type { EntityId } from "@vcp/shared";

import {
  isTaskReadyForCompletion,
  isValidFinalizedResult,
  type TaskFinalizedResult
} from "./task-completion";
import type { TaskCreationAction } from "./task-creation-state";
import type {
  TaskProcessingScheduleHandle,
  TaskProcessingScheduler
} from "./task-processing-controller";
import type { CreatedTaskRecord } from "./task-types";

export interface TaskCompletionStateReader {
  findTask(taskId: EntityId<"taskId">): CreatedTaskRecord | null;
}

export interface TaskFinalizedResultSource {
  finalize(task: CreatedTaskRecord): TaskFinalizedResult;
}

export interface TaskCompletionActionSink {
  dispatch(action: TaskCreationAction): void;
}

export interface TaskCompletionController {
  start(taskId: EntityId<"taskId">): void;
  complete(taskId: EntityId<"taskId">): void;
  stop(taskId: EntityId<"taskId">): void;
  dispose(): void;
}

export interface TaskCompletionControllerOptions {
  readonly scheduler: TaskProcessingScheduler;
  readonly stateReader: TaskCompletionStateReader;
  readonly resultSource: TaskFinalizedResultSource;
  readonly actionSink: TaskCompletionActionSink;
  readonly completionDelayMs: number;
}

interface TaskCompletionSession {
  pendingHandle: TaskProcessingScheduleHandle | null;
  sessionToken: number;
}

export function createTaskCompletionController(
  options: TaskCompletionControllerOptions
): TaskCompletionController {
  const { scheduler, stateReader, resultSource, actionSink, completionDelayMs } =
    options;

  const sessions = new Map<string, TaskCompletionSession>();
  let nextSessionToken = 0;

  function canComplete(task: CreatedTaskRecord | null): task is CreatedTaskRecord {
    return task !== null && isTaskReadyForCompletion(task);
  }

  function start(taskId: EntityId<"taskId">): void {
    const key = taskId as string;
    if (sessions.has(key)) {
      return;
    }

    if (!canComplete(stateReader.findTask(taskId))) {
      return;
    }

    const session: TaskCompletionSession = {
      pendingHandle: null,
      sessionToken: ++nextSessionToken
    };
    sessions.set(key, session);

    const token = session.sessionToken;
    session.pendingHandle = scheduler.schedule(completionDelayMs, () => {
      session.pendingHandle = null;

      const current = sessions.get(key);
      if (!current || current.sessionToken !== token) {
        return;
      }

      complete(taskId);
    });
  }

  function complete(taskId: EntityId<"taskId">): void {
    const key = taskId as string;
    const session = sessions.get(key);

    const task = stateReader.findTask(taskId);
    if (!canComplete(task)) {
      sessions.delete(key);
      return;
    }

    let result: TaskFinalizedResult;
    try {
      result = resultSource.finalize(task);
    } catch (error) {
      sessions.delete(key);
      throw error;
    }

    if (!isValidFinalizedResult(result)) {
      sessions.delete(key);
      return;
    }

    if (session?.pendingHandle !== null && session?.pendingHandle !== undefined) {
      session.pendingHandle.cancel();
      session.pendingHandle = null;
    }
    sessions.delete(key);
    actionSink.dispatch({
      type: "task-completed",
      taskId,
      result
    });
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

  return { start, complete, stop, dispose };
}
