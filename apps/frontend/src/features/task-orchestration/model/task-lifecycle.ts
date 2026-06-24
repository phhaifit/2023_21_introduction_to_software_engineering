import type { TaskStatus as ProductionTaskStatus } from "@vcp/shared";

import type { CreatedTaskRecord, TaskPresentationStatus } from "./task-types";

export type TaskTransitionResult =
  | {
      ok: true;
      task: CreatedTaskRecord;
    }
  | {
      ok: false;
      reason: string;
      task: CreatedTaskRecord;
    };

const TASK_STATUS_TRANSITIONS: Readonly<
  Record<ProductionTaskStatus, readonly ProductionTaskStatus[]>
> = {
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  requires_action: [],
  succeeded: [],
  failed: [],
  cancelled: []
};

const TASK_STATUS_PRESENTATION: Readonly<
  Record<ProductionTaskStatus, TaskPresentationStatus | null>
> = {
  queued: "pending",
  running: "in-progress",
  requires_action: null,
  succeeded: "completed",
  failed: "failed",
  cancelled: "canceled"
};

export function toTaskPresentationStatus(
  status: ProductionTaskStatus
): TaskPresentationStatus | null {
  return TASK_STATUS_PRESENTATION[status];
}

export function isTerminalTaskStatus(status: ProductionTaskStatus): boolean {
  return TASK_STATUS_TRANSITIONS[status].length === 0;
}

export function canTransitionTaskStatus(
  currentStatus: ProductionTaskStatus,
  nextStatus: ProductionTaskStatus
): boolean {
  return TASK_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function transitionTaskStatus(
  task: CreatedTaskRecord,
  nextStatus: ProductionTaskStatus
): TaskTransitionResult {
  if (!canTransitionTaskStatus(task.status, nextStatus)) {
    return {
      ok: false,
      reason: `Cannot transition task from ${task.status} to ${nextStatus}.`,
      task
    };
  }

  return {
    ok: true,
    task: {
      ...task,
      requestedRouting: { ...task.requestedRouting },
      timeline: task.timeline.map((step) => ({ ...step })),
      status: nextStatus
    }
  };
}
