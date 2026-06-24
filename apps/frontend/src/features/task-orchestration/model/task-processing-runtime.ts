import type {
  TaskProcessingLogIdentitySource,
  TaskProcessingScheduler,
  TaskProcessingScheduleHandle,
  TaskProcessingTimeSource
} from "./task-processing-controller";

export interface TaskProcessingRuntime {
  readonly scheduler: TaskProcessingScheduler;
  readonly clock: TaskProcessingTimeSource;
  readonly logIdentitySource: TaskProcessingLogIdentitySource;
}

export function createBrowserTaskProcessingRuntime(): TaskProcessingRuntime {
  let logCounter = 0;

  const scheduler: TaskProcessingScheduler = {
    schedule(delayMs: number, callback: () => void): TaskProcessingScheduleHandle {
      const timerId = window.setTimeout(callback, delayMs);
      return {
        cancel(): void {
          window.clearTimeout(timerId);
        }
      };
    }
  };

  const clock: TaskProcessingTimeSource = {
    now(): string {
      return new Date().toISOString();
    }
  };

  const logIdentitySource: TaskProcessingLogIdentitySource = {
    nextLogId(): string {
      logCounter += 1;
      return `LOG-${logCounter.toString().padStart(4, "0")}`;
    }
  };

  return { scheduler, clock, logIdentitySource };
}
