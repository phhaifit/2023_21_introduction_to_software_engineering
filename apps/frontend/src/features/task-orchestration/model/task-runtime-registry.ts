/**
 * task-runtime-registry.ts
 *
 * Dedicated Task runtime registry that coordinates existing multi-Task-safe
 * controllers and owns progression schedule handles by immutable Task ID.
 *
 * Responsibilities:
 *   - Synchronize runtime ownership with authoritative Task records.
 *   - Coordinate processing, streaming, completion, and cancellation sessions.
 *   - Support multiple tasks concurrently without relying on active selection.
 *   - Provide technical stop and canonical cancellation semantics.
 *   - Ensure idempotency and safety under React Strict Mode.
 *
 * Invariants:
 *   - Never mutates Task state directly.
 *   - Owns at most one progression handle per Task.
 *   - Callbacks capture immutable Task ID and verify generation guards.
 *   - Never references activeTaskId or activeConversationId.
 */

import type { EntityId } from "@vcp/shared";
import type { CreatedTaskRecord } from "./task-types";
import type { TaskCreationAction } from "./task-creation-state";
import { isTerminalTaskStatus } from "./task-lifecycle";
import { ORDERED_STEP_IDS } from "./task-processing";
import {
  createTaskProcessingController,
  TaskFinalStepBoundaryError,
  type TaskProcessingActionSink,
  type TaskProcessingScheduleHandle
} from "./task-processing-controller";
import type { TaskProcessingRuntime } from "./task-processing-runtime";
import { createTaskStreamingController } from "./task-streaming-controller";
import type { TaskStreamingDelays, TaskStreamingRuntime } from "./task-streaming-runtime";
import { createTaskCompletionController } from "./task-completion-controller";
import type { TaskCompletionDelays, TaskCompletionRuntime } from "./task-completion-runtime";
import {
  createTaskCancellationCoordinator,
  type TaskCancellationCoordinator
} from "./task-cancellation-coordinator";

const FINAL_STEP_ID = ORDERED_STEP_IDS[ORDERED_STEP_IDS.length - 1];
const STREAMING_START_STEP_ID = "execute-task";

export interface TaskRuntimeRegistryStateReader {
  findTask(taskId: EntityId<"taskId">): CreatedTaskRecord | null | undefined;
}

export interface TaskRuntimeRegistryOptions {
  readonly processingRuntime: TaskProcessingRuntime;
  readonly processingDelays: Readonly<{ pendingMs: number; stepMs: number }>;
  readonly streamingRuntime: TaskStreamingRuntime;
  readonly streamingDelays: TaskStreamingDelays;
  readonly completionRuntime: TaskCompletionRuntime;
  readonly completionDelays: TaskCompletionDelays;
  readonly stateReader: TaskRuntimeRegistryStateReader;
  readonly actionSink: TaskProcessingActionSink;
  readonly cancellationCoordinator?: TaskCancellationCoordinator;
}

export interface TaskRuntimeRegistry {
  /** Synchronizes runtime ownership with authoritative Task records. */
  syncTasks(tasks: readonly CreatedTaskRecord[]): void;
  /** Performs canonical cancellation through TaskCancellationCoordinator. */
  cancelTask(taskId: EntityId<"taskId">): void;
  /** Performs technical cleanup only without changing lifecycle status. */
  stopTask(taskId: EntityId<"taskId">): void;
  /** Technically stops all known Task resources. */
  stopAll(): void;
  /** Permanently disposes the registry. */
  dispose(): void;
}

export function createTaskRuntimeRegistry(
  options: TaskRuntimeRegistryOptions
): TaskRuntimeRegistry {
  const {
    processingRuntime,
    processingDelays,
    streamingRuntime,
    streamingDelays,
    completionRuntime,
    completionDelays,
    stateReader,
    actionSink
  } = options;

  const progressionHandles = new Map<string, TaskProcessingScheduleHandle>();
  const trackedTaskIds = new Set<string>();
  let disposed = false;

  const streamingController = createTaskStreamingController({
    scheduler: streamingRuntime.scheduler,
    clock: streamingRuntime.clock,
    fragmentIdentitySource: streamingRuntime.fragmentIdentitySource,
    fragmentSource: streamingRuntime.fragmentSource,
    stateReader: {
      findTask: (taskId) => stateReader.findTask(taskId) ?? null
    },
    actionSink,
    fragmentDelayMs: streamingDelays.fragmentMs
  });

  const completionController = createTaskCompletionController({
    scheduler: completionRuntime.scheduler,
    stateReader: {
      findTask: (taskId) => stateReader.findTask(taskId) ?? null
    },
    resultSource: completionRuntime.resultSource,
    actionSink,
    completionDelayMs: completionDelays.completionMs
  });

  const processingController = createTaskProcessingController({
    scheduler: processingRuntime.scheduler,
    clock: processingRuntime.clock,
    logIdentitySource: processingRuntime.logIdentitySource,
    actionSink,
    pendingDelayMs: processingDelays.pendingMs,
    stateReader: {
      findTask: (taskId) => stateReader.findTask(taskId)
    },
    streamingStopper: {
      stop: (taskId) => streamingController.stop(taskId)
    },
    completionStopper: {
      stop: (taskId) => completionController.stop(taskId)
    }
  });

  const cancellationCoordinator =
    options.cancellationCoordinator ??
    createTaskCancellationCoordinator({
      stateReader: {
        findTask: (taskId) => stateReader.findTask(taskId) ?? undefined
      },
      processingStopper: processingController,
      streamingStopper: streamingController,
      completionStopper: completionController,
      clock: {
        nowIso: () => processingRuntime.clock.now()
      },
      actionSink
    });

  function stopTask(taskId: EntityId<"taskId">): void {
    if (disposed) {
      return;
    }
    const key = taskId as string;
    const handle = progressionHandles.get(key);
    if (handle) {
      handle.cancel();
      progressionHandles.delete(key);
    }
    processingController.stop(taskId);
    streamingController.stop(taskId);
    completionController.stop(taskId);
    trackedTaskIds.delete(key);
  }

  function stopAll(): void {
    if (disposed) {
      return;
    }
    for (const handle of progressionHandles.values()) {
      handle.cancel();
    }
    progressionHandles.clear();

    for (const trackedId of Array.from(trackedTaskIds)) {
      const taskId = trackedId as EntityId<"taskId">;
      processingController.stop(taskId);
      streamingController.stop(taskId);
      completionController.stop(taskId);
    }
    trackedTaskIds.clear();
  }

  function syncTasks(tasks: readonly CreatedTaskRecord[]): void {
    if (disposed) {
      return;
    }

    // 1. Build the authoritative ID set
    const authoritativeIds = new Set<string>();
    for (const task of tasks) {
      authoritativeIds.add(task.taskId as string);
      trackedTaskIds.add(task.taskId as string);
    }

    // 2. Clean removed Tasks (e.g., Demo Reset cleanup)
    for (const trackedId of Array.from(trackedTaskIds)) {
      if (!authoritativeIds.has(trackedId)) {
        stopTask(trackedId as EntityId<"taskId">);
      }
    }

    // 3. Clean terminal Tasks & Synchronize nonterminal Tasks
    for (const task of tasks) {
      const { taskId, status } = task;
      const key = taskId as string;

      if (isTerminalTaskStatus(status)) {
        const handle = progressionHandles.get(key);
        if (handle) {
          handle.cancel();
          progressionHandles.delete(key);
        }
        processingController.stop(taskId);
        streamingController.stop(taskId);
        completionController.stop(taskId);
        trackedTaskIds.delete(key);
        continue;
      }

      if (status === "queued") {
        processingController.scheduleStart(taskId);
        continue;
      }

      if (status === "running") {
        // Progression scheduling
        if (!progressionHandles.has(key)) {
          const activeStep = task.processingSnapshot.steps.find(
            (step) => step.status === "active"
          );
          if (activeStep && activeStep.id !== FINAL_STEP_ID) {
            const handle = processingRuntime.scheduler.schedule(
              processingDelays.stepMs,
              () => {
                if (disposed) {
                  return;
                }

                const currentHandle = progressionHandles.get(key);
                if (currentHandle !== handle) {
                  return;
                }

                progressionHandles.delete(key);

                const latestTask = stateReader.findTask(taskId);
                if (!latestTask || isTerminalTaskStatus(latestTask.status)) {
                  return;
                }

                if (latestTask.status !== "running") {
                  return;
                }

                const latestActiveStep = latestTask.processingSnapshot.steps.find(
                  (step) => step.status === "active"
                );

                if (!latestActiveStep || latestActiveStep.id === FINAL_STEP_ID) {
                  return;
                }

                try {
                  processingController.advance(taskId);
                } catch (error) {
                  if (!(error instanceof TaskFinalStepBoundaryError)) {
                    throw error;
                  }
                }
              }
            );
            progressionHandles.set(key, handle);
          }
        }

        // Streaming start
        if (task.streamingSnapshot.phase === "idle") {
          const activeStep = task.processingSnapshot.steps.find(
            (step) => step.status === "active"
          );
          if (activeStep?.id === STREAMING_START_STEP_ID) {
            streamingController.start(taskId);
          }
        }

        // Completion start
        const finalStep = task.processingSnapshot.steps.at(-1);
        if (finalStep?.id === FINAL_STEP_ID && finalStep.status === "active") {
          if (task.streamingSnapshot.phase === "exhausted" && !task.finalizedResult) {
            completionController.start(taskId);
          }
        }
      }
    }
  }

  function cancelTask(taskId: EntityId<"taskId">): void {
    if (disposed) {
      return;
    }
    cancellationCoordinator.cancel(taskId);
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    stopAll();
    processingController.dispose();
    streamingController.dispose();
    completionController.dispose();
    if (!options.cancellationCoordinator) {
      cancellationCoordinator.dispose();
    }
    disposed = true;
  }

  return {
    syncTasks,
    cancelTask,
    stopTask,
    stopAll,
    dispose
  };
}
