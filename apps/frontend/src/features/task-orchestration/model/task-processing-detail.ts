import {
  type ProcessingStep,
  type TaskLog,
  type TaskPresentationStatus,
  type CreatedTaskRecord
} from "./task-types";
import { toTaskPresentationStatus } from "./task-lifecycle";
import { formatRoutingSummary } from "../task-orchestration-page";

export interface TaskProcessingDetail {
  readonly taskId: string;
  readonly workId: string;
  readonly status: TaskPresentationStatus;
  readonly routingSummary: string;
  readonly durationMs: number | null;
  readonly steps: readonly ProcessingStep[];
  readonly logs: readonly TaskLog[];
}

export function buildTaskProcessingDetail(task: CreatedTaskRecord): TaskProcessingDetail | null {
  const status = toTaskPresentationStatus(task.status);
  
  if (status !== "in-progress" && status !== "completed") {
    return null;
  }

  const { processingSnapshot } = task;
  
  let durationMs: number | null = null;
  
  if (status === "completed" && task.finalizedResult?.finalizedAt && processingSnapshot.startedAt) {
    const start = new Date(processingSnapshot.startedAt).getTime();
    const end = new Date(task.finalizedResult.finalizedAt).getTime();
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      durationMs = end - start;
    }
  }

  return {
    taskId: task.taskId,
    workId: task.workId,
    status,
    routingSummary: formatRoutingSummary(task.requestedRouting),
    durationMs,
    steps: processingSnapshot.steps,
    logs: processingSnapshot.logs,
  };
}
