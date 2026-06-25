import type { CreatedTaskRecord } from "./task-types";

export interface TaskFinalizedResult {
  readonly text: string;
  readonly finalizedAt: string;
}

export function isValidFinalizedResult(
  result: TaskFinalizedResult
): boolean {
  return result.text.trim().length > 0 && result.finalizedAt.trim().length > 0;
}

export function isTaskReadyForCompletion(task: CreatedTaskRecord): boolean {
  if (task.status !== "running") {
    return false;
  }

  const finalStep = task.processingSnapshot.steps.at(-1);
  if (finalStep?.id !== "finalize" || finalStep.status !== "active") {
    return false;
  }

  return task.streamingSnapshot.phase === "exhausted";
}
