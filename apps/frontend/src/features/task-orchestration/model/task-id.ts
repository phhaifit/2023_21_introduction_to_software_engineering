import type { EntityId } from "@vcp/shared";

import type { TaskIdentity } from "./task-types";

let taskIdentitySequence = 0;

export function createTaskIdentity(): TaskIdentity {
  taskIdentitySequence += 1;
  const sequence = taskIdentitySequence.toString().padStart(6, "0");

  return {
    taskId: `TASK-${sequence}` as EntityId<"taskId">,
    workId: `WORK-${sequence}` as EntityId<"workId">
  };
}

export function resetTaskIdentitySequence(): void {
  taskIdentitySequence = 0;
}
