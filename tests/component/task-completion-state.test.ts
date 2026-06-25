import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { EntityId } from "@vcp/shared";
import {
  initialTaskCreationState,
  taskCreationReducer,
  type TaskCreationState
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import {
  isTerminalTaskStatus,
  canTransitionTaskStatus,
  transitionTaskStatus
} from "@vcp/frontend/features/task-orchestration/model/task-lifecycle.ts";
import { ORDERED_STEP_IDS } from "@vcp/frontend/features/task-orchestration/model/task-processing.ts";
import { selectAccumulatedPartialText } from "@vcp/frontend/features/task-orchestration/model/task-streaming.ts";
import type {
  CreatedTaskRecord,
  TaskLog
} from "@vcp/frontend/features/task-orchestration/model/task-types.ts";

const TASK_A = "TASK-000001" as EntityId<"taskId">;
const TASK_B = "TASK-000002" as EntityId<"taskId">;
const WORK_A = "WORK-000001" as EntityId<"workId">;
const WORK_B = "WORK-000002" as EntityId<"workId">;
const CREATED_AT = "2026-06-24T10:00:00.000Z";
const COMPLETED_AT = "2026-06-24T10:10:00.000Z";

function makeQueuedState(
  taskId: EntityId<"taskId"> = TASK_A,
  workId: EntityId<"workId"> = WORK_A
): TaskCreationState {
  return taskCreationReducer(initialTaskCreationState, {
    type: "task-created",
    request: { prompt: `Prompt for ${taskId}`, routing: { mode: "auto" } },
    response: {
      taskId,
      workId,
      status: "queued",
      createdAt: CREATED_AT
    }
  });
}

function makeRunningState(taskId: EntityId<"taskId"> = TASK_A) {
  return taskCreationReducer(makeQueuedState(taskId), {
    type: "processing-started",
    taskId,
    startedAt: CREATED_AT
  });
}

function driveToFinalizeActive(state: TaskCreationState, taskId = TASK_A) {
  let next = state;

  for (let index = 0; index < ORDERED_STEP_IDS.length - 1; index++) {
    const current = ORDERED_STEP_IDS[index]!;
    const following = ORDERED_STEP_IDS[index + 1]!;
    next = taskCreationReducer(next, {
      type: "processing-step-completed",
      taskId,
      stepId: current,
      completedAt: `${CREATED_AT}-${index}`
    });
    next = taskCreationReducer(next, {
      type: "processing-step-activated",
      taskId,
      stepId: following
    });
  }

  return next;
}

function exhaustStreaming(state: TaskCreationState, taskId = TASK_A) {
  let next = taskCreationReducer(state, {
    type: "streaming-started",
    taskId,
    startedAt: CREATED_AT
  });
  next = taskCreationReducer(next, {
    type: "streaming-fragment-appended",
    taskId,
    fragmentId: "FRG-001",
    sequence: 1,
    text: "Partial draft.",
    appendedAt: CREATED_AT
  });
  return taskCreationReducer(next, {
    type: "streaming-exhausted",
    taskId,
    exhaustedAt: CREATED_AT
  });
}

function makeEligibleState(taskId = TASK_A) {
  return exhaustStreaming(driveToFinalizeActive(makeRunningState(taskId)), taskId);
}

function complete(state: TaskCreationState, taskId = TASK_A) {
  return taskCreationReducer(state, {
    type: "task-completed",
    taskId,
    result: {
      text: "Finalized answer.",
      finalizedAt: COMPLETED_AT
    }
  });
}

function getTask(state: TaskCreationState, taskId = TASK_A): CreatedTaskRecord {
  const task = state.tasks.find((candidate) => candidate.taskId === taskId);
  if (!task) throw new Error(`Missing task ${taskId}`);
  return task;
}

function withTerminalStatus(
  state: TaskCreationState,
  status: "failed" | "cancelled"
): TaskCreationState {
  const task = getTask(state);
  const transitioned = transitionTaskStatus(task, status);
  if (!transitioned.ok) throw new Error(`Cannot transition to ${status}`);
  return {
    ...state,
    tasks: state.tasks.map((candidate) =>
      candidate.taskId === task.taskId ? transitioned.task : candidate
    )
  };
}

describe("completed result state", () => {
  it("keeps a new task without finalized result", () => {
    const task = getTask(makeQueuedState());

    expect(task.finalizedResult).toBeUndefined();
  });

  it("does not treat partial output as finalized result", () => {
    const task = getTask(exhaustStreaming(makeRunningState()));

    expect(selectAccumulatedPartialText(task.streamingSnapshot)).toBe(
      "Partial draft."
    );
    expect(task.finalizedResult).toBeUndefined();
  });

  it("atomically stores a valid finalized result and transitions running to succeeded", () => {
    const state = complete(makeEligibleState());
    const task = getTask(state);

    expect(task.status).toBe("succeeded");
    expect(task.finalizedResult).toEqual({
      text: "Finalized answer.",
      finalizedAt: COMPLETED_AT
    });
  });

  it("rejects empty finalized result text", () => {
    const state = makeEligibleState();
    const next = taskCreationReducer(state, {
      type: "task-completed",
      taskId: TASK_A,
      result: { text: "   ", finalizedAt: COMPLETED_AT }
    });

    expect(getTask(next).status).toBe("running");
    expect(getTask(next).finalizedResult).toBeUndefined();
  });

  it("rejects queued and terminal tasks", () => {
    const queued = complete(makeQueuedState());
    const failed = complete(withTerminalStatus(makeEligibleState(), "failed"));
    const cancelled = complete(
      withTerminalStatus(makeEligibleState(), "cancelled")
    );
    const succeeded = complete(complete(makeEligibleState()));

    expect(getTask(queued).status).toBe("queued");
    expect(getTask(failed).status).toBe("failed");
    expect(getTask(cancelled).status).toBe("cancelled");
    expect(getTask(succeeded).finalizedResult?.finalizedAt).toBe(COMPLETED_AT);
  });

  it("preserves task metadata, processing snapshot, logs, and partial fragments", () => {
    const withLog = taskCreationReducer(makeEligibleState(), {
      type: "processing-log-appended",
      taskId: TASK_A,
      log: {
        id: "LOG-001",
        timestamp: CREATED_AT,
        level: "info",
        stepId: "finalize",
        message: "Ready to finalize."
      }
    });
    const before = getTask(withLog);
    const after = getTask(complete(withLog));

    expect(after.taskId).toBe(before.taskId);
    expect(after.workId).toBe(before.workId);
    expect(after.prompt).toBe(before.prompt);
    expect(after.requestedRouting).toEqual(before.requestedRouting);
    expect(after.processingSnapshot.steps).toEqual(before.processingSnapshot.steps);
    expect(after.processingSnapshot.logs).toEqual(before.processingSnapshot.logs);
    expect(after.streamingSnapshot.fragments).toEqual(
      before.streamingSnapshot.fragments
    );
  });

  it("does not mutate previous state or affect other tasks", () => {
    let state = makeEligibleState();
    state = taskCreationReducer(state, {
      type: "task-created",
      request: { prompt: "Second", routing: { mode: "auto" } },
      response: {
        taskId: TASK_B,
        workId: WORK_B,
        status: "queued",
        createdAt: CREATED_AT
      }
    });
    const previousTasks = state.tasks;
    const next = complete(state);

    expect(state.tasks).toBe(previousTasks);
    expect(getTask(state).status).toBe("running");
    expect(getTask(next).status).toBe("succeeded");
    expect(getTask(next, TASK_B).status).toBe("queued");
  });

  it("rejects late processing steps, logs, and streaming chunks after completion", () => {
    const state = complete(makeEligibleState());
    const lateLog: TaskLog = {
      id: "LOG-LATE",
      timestamp: COMPLETED_AT,
      level: "info",
      stepId: "finalize",
      message: "Late update."
    };
    const lateStep = taskCreationReducer(state, {
      type: "processing-step-completed",
      taskId: TASK_A,
      stepId: "finalize",
      completedAt: COMPLETED_AT
    });
    const lateLogState = taskCreationReducer(state, {
      type: "processing-log-appended",
      taskId: TASK_A,
      log: lateLog
    });
    const lateChunk = taskCreationReducer(state, {
      type: "streaming-fragment-appended",
      taskId: TASK_A,
      fragmentId: "FRG-LATE",
      sequence: 2,
      text: "late",
      appendedAt: COMPLETED_AT
    });

    expect(getTask(lateStep).processingSnapshot).toEqual(
      getTask(state).processingSnapshot
    );
    expect(getTask(lateLogState).processingSnapshot.logs).toEqual(
      getTask(state).processingSnapshot.logs
    );
    expect(getTask(lateChunk).streamingSnapshot.fragments).toEqual(
      getTask(state).streamingSnapshot.fragments
    );
  });

  it("marks succeeded as terminal and not cancellable", () => {
    expect(isTerminalTaskStatus("succeeded")).toBe(true);
    expect(canTransitionTaskStatus("succeeded", "cancelled")).toBe(false);
  });
});

describe("completion model source boundaries", () => {
  it("does not use browser APIs, timers, random, React, backend, or Prisma", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "apps/frontend/src/features/task-orchestration/model/task-completion.ts"
      ),
      "utf8"
    );

    expect(source).not.toMatch(/\bDate\.now\b/);
    expect(source).not.toMatch(/\bnew Date\b/);
    expect(source).not.toMatch(/\bMath\.random\b/);
    expect(source).not.toMatch(/\bcrypto\.randomUUID\b/);
    expect(source).not.toMatch(/\bsetTimeout\b/);
    expect(source).not.toMatch(/\bsetInterval\b/);
    expect(source).not.toMatch(/from ["']react["']/);
    expect(source).not.toMatch(/@vcp\/database/);
    expect(source).not.toMatch(/prisma/i);
  });
});
