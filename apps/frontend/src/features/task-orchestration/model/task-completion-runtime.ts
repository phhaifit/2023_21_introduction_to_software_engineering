import { DEMO_TIMINGS } from "../mocks/task-orchestration-mocks";
import type { TaskFinalizedResult } from "./task-completion";
import type { TaskFinalizedResultSource } from "./task-completion-controller";
import type { TaskProcessingScheduler } from "./task-processing-controller";
import { selectAccumulatedPartialText } from "./task-streaming";
import type { CreatedTaskRecord } from "./task-types";

export interface TaskClipboardWriter {
  writeText(text: string): Promise<void>;
}

export interface TaskCompletionRuntime {
  readonly scheduler: TaskProcessingScheduler;
  readonly resultSource: TaskFinalizedResultSource;
  readonly clipboard: TaskClipboardWriter;
}

export interface TaskCompletionDelays {
  readonly completionMs: number;
}

export const DEFAULT_TASK_COMPLETION_DELAYS: TaskCompletionDelays = {
  completionMs: DEMO_TIMINGS.stepMs ?? 800
};

export function createDefaultFinalizedResultSource(): TaskFinalizedResultSource {
  return {
    finalize(task: CreatedTaskRecord): TaskFinalizedResult {
      return {
        text: selectAccumulatedPartialText(task.streamingSnapshot),
        finalizedAt: new Date().toISOString()
      };
    }
  };
}

export function createBrowserClipboardWriter(): TaskClipboardWriter {
  return {
    async writeText(text: string) {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API not available");
      }
    }
  };
}

export function createBrowserTaskCompletionRuntime(): TaskCompletionRuntime {
  return {
    scheduler: {
      schedule(delayMs, callback) {
        const id = window.setTimeout(callback, delayMs);
        return {
          cancel() {
            window.clearTimeout(id);
          }
        };
      }
    },
    resultSource: createDefaultFinalizedResultSource(),
    clipboard: createBrowserClipboardWriter()
  };
}
