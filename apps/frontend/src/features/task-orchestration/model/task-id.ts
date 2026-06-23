import type { TaskIdentity } from "./task-types";

let taskIdentitySequence = 0;

export function createTaskIdentity(): TaskIdentity {
  taskIdentitySequence += 1;
  const sequence = taskIdentitySequence.toString().padStart(6, "0");

  return {
    taskId: `TASK-${sequence}`,
    workId: `WORK-${sequence}`
  };
}

export function resetTaskIdentitySequence(): void {
  taskIdentitySequence = 0;
}
