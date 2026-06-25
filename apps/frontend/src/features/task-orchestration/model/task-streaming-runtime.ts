import type {
  TaskProcessingScheduleHandle,
  TaskProcessingScheduler,
  TaskProcessingTimeSource
} from "./task-processing-controller";
import type {
  TaskStreamingFragmentIdentitySource,
  TaskStreamingFragmentSource
} from "./task-streaming-controller";

export interface TaskStreamingRuntime {
  readonly scheduler: TaskProcessingScheduler;
  readonly clock: TaskProcessingTimeSource;
  readonly fragmentIdentitySource: TaskStreamingFragmentIdentitySource;
  readonly fragmentSource: TaskStreamingFragmentSource;
}

export interface TaskStreamingDelays {
  readonly fragmentMs: number;
}

export const DEFAULT_TASK_STREAMING_DELAYS: TaskStreamingDelays = {
  fragmentMs: 150
};

const DEFAULT_STREAMING_FRAGMENTS = Object.freeze([
  "Drafting the response from the selected route. ",
  "Combining task context with the simulated execution output. ",
  "Preparing a concise partial answer for review."
] as const);

interface TaskStreamingRuntimeBase {
  readonly scheduler?: TaskProcessingScheduler;
  readonly clock?: TaskProcessingTimeSource;
}

export function createDefaultTaskStreamingRuntime(
  base: TaskStreamingRuntimeBase = {}
): TaskStreamingRuntime {
  let fragmentCounter = 0;

  const scheduler: TaskProcessingScheduler =
    base.scheduler ?? {
      schedule(
        delayMs: number,
        callback: () => void
      ): TaskProcessingScheduleHandle {
        const timerId = window.setTimeout(callback, delayMs);
        return {
          cancel(): void {
            window.clearTimeout(timerId);
          }
        };
      }
    };

  const clock: TaskProcessingTimeSource =
    base.clock ?? {
      now(): string {
        return new Date().toISOString();
      }
    };

  const fragmentIdentitySource: TaskStreamingFragmentIdentitySource = {
    nextFragmentId(): string {
      fragmentCounter += 1;
      return `FRG-${fragmentCounter.toString().padStart(4, "0")}`;
    }
  };

  const fragmentSource: TaskStreamingFragmentSource = {
    getFragments(): readonly string[] {
      return DEFAULT_STREAMING_FRAGMENTS;
    }
  };

  return {
    scheduler,
    clock,
    fragmentIdentitySource,
    fragmentSource
  };
}
