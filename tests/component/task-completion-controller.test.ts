import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { EntityId } from "@vcp/shared";
import {
  initialTaskCreationState,
  taskCreationReducer,
  type TaskCreationAction,
  type TaskCreationState
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import {
  createTaskCompletionController,
  type TaskCompletionActionSink,
  type TaskCompletionController,
  type TaskCompletionStateReader,
  type TaskFinalizedResultSource
} from "@vcp/frontend/features/task-orchestration/model/task-completion-controller.ts";
import type {
  TaskProcessingScheduleHandle,
  TaskProcessingScheduler
} from "@vcp/frontend/features/task-orchestration/model/task-processing-controller.ts";
import { ORDERED_STEP_IDS } from "@vcp/frontend/features/task-orchestration/model/task-processing.ts";
import type { CreatedTaskRecord } from "@vcp/frontend/features/task-orchestration/model/task-types.ts";

interface ScheduledEntry {
  delayMs: number;
  callback: () => void;
  cancelled: boolean;
  executed: boolean;
}

class FakeScheduler implements TaskProcessingScheduler {
  readonly entries: ScheduledEntry[] = [];

  schedule(delayMs: number, callback: () => void): TaskProcessingScheduleHandle {
    const entry: ScheduledEntry = {
      delayMs,
      callback,
      cancelled: false,
      executed: false
    };
    this.entries.push(entry);
    return {
      cancel: () => {
        entry.cancelled = true;
      }
    };
  }

  flushNext(): void {
    const entry = this.entries.find((candidate) => !candidate.cancelled && !candidate.executed);
    if (!entry) throw new Error("No pending callback.");
    entry.executed = true;
    entry.callback();
  }

  get pendingCount(): number {
    return this.entries.filter((entry) => !entry.cancelled && !entry.executed)
      .length;
  }
}

class ReducerStateReader implements TaskCompletionStateReader {
  constructor(private readonly getState: () => TaskCreationState) {}

  findTask(taskId: EntityId<"taskId">): CreatedTaskRecord | null {
    return this.getState().tasks.find((task) => task.taskId === taskId) ?? null;
  }
}

class ReducerActionSink implements TaskCompletionActionSink {
  shouldThrow = false;
  readonly actions: TaskCreationAction[] = [];

  constructor(private readonly apply: (action: TaskCreationAction) => void) {}

  dispatch(action: TaskCreationAction): void {
    if (this.shouldThrow) {
      throw new Error("Simulated completion sink failure.");
    }
    this.actions.push(action);
    this.apply(action);
  }
}

class FakeResultSource implements TaskFinalizedResultSource {
  calls: CreatedTaskRecord[] = [];
  shouldThrow = false;
  textByTask = new Map<string, string>();

  finalize(task: CreatedTaskRecord) {
    if (this.shouldThrow) {
      throw new Error("Simulated result-source failure.");
    }
    this.calls.push(task);
    return {
      text: this.textByTask.get(task.taskId as string) ?? "Final result.",
      finalizedAt: "2026-06-24T10:10:00.000Z"
    };
  }
}

const TASK_A = "TASK-000001" as EntityId<"taskId">;
const TASK_B = "TASK-000002" as EntityId<"taskId">;
const WORK_A = "WORK-000001" as EntityId<"workId">;
const WORK_B = "WORK-000002" as EntityId<"workId">;
const CREATED_AT = "2026-06-24T10:00:00.000Z";
const DELAY_MS = 250;

function makeQueuedState(
  taskId: EntityId<"taskId"> = TASK_A,
  workId: EntityId<"workId"> = WORK_A
): TaskCreationState {
  return taskCreationReducer(initialTaskCreationState, {
    type: "task-created",
    request: { prompt: `Prompt ${taskId}`, routing: { mode: "auto" } },
    response: {
      taskId,
      workId,
      status: "queued",
      createdAt: CREATED_AT
    }
  });
}

function makeRunningState(
  taskId: EntityId<"taskId"> = TASK_A,
  workId: EntityId<"workId"> = WORK_A
) {
  return taskCreationReducer(makeQueuedState(taskId, workId), {
    type: "processing-started",
    taskId,
    startedAt: CREATED_AT
  });
}

function driveToFinalizeActive(state: TaskCreationState, taskId = TASK_A) {
  let next = state;
  for (let index = 0; index < ORDERED_STEP_IDS.length - 1; index++) {
    next = taskCreationReducer(next, {
      type: "processing-step-completed",
      taskId,
      stepId: ORDERED_STEP_IDS[index]!,
      completedAt: CREATED_AT
    });
    next = taskCreationReducer(next, {
      type: "processing-step-activated",
      taskId,
      stepId: ORDERED_STEP_IDS[index + 1]!
    });
  }
  return next;
}

function makeEligibleState(taskId = TASK_A, workId = WORK_A) {
  let state = driveToFinalizeActive(makeRunningState(taskId, workId), taskId);
  state = taskCreationReducer(state, {
    type: "streaming-started",
    taskId,
    startedAt: CREATED_AT
  });
  state = taskCreationReducer(state, {
    type: "streaming-fragment-appended",
    taskId,
    fragmentId: `FRG-${taskId}`,
    sequence: 1,
    text: "partial",
    appendedAt: CREATED_AT
  });
  return taskCreationReducer(state, {
    type: "streaming-exhausted",
    taskId,
    exhaustedAt: CREATED_AT
  });
}

function createFixtures(initialState: TaskCreationState = makeEligibleState()) {
  const holder = { state: initialState };
  const scheduler = new FakeScheduler();
  const source = new FakeResultSource();
  const sink = new ReducerActionSink((action) => {
    holder.state = taskCreationReducer(holder.state, action);
  });
  const reader = new ReducerStateReader(() => holder.state);
  const controller = createTaskCompletionController({
    scheduler,
    stateReader: reader,
    resultSource: source,
    actionSink: sink,
    completionDelayMs: DELAY_MS
  });

  return {
    scheduler,
    source,
    sink,
    reader,
    controller,
    getState: () => holder.state,
    setState: (state: TaskCreationState) => {
      holder.state = state;
    }
  };
}

describe("completion controller", () => {
  it("completes an eligible task through an injected scheduled delay", () => {
    const f = createFixtures();

    f.controller.start(TASK_A);
    expect(f.scheduler.entries[0]?.delayMs).toBe(DELAY_MS);
    expect(f.sink.actions).toHaveLength(0);

    f.scheduler.flushNext();

    expect(f.sink.actions).toHaveLength(1);
    expect(f.sink.actions[0]).toMatchObject({
      type: "task-completed",
      taskId: TASK_A
    });
    expect(f.reader.findTask(TASK_A)?.status).toBe("succeeded");
  });

  it("can complete an eligible task immediately through complete()", () => {
    const f = createFixtures();

    f.controller.complete(TASK_A);

    expect(f.sink.actions).toHaveLength(1);
    expect(f.reader.findTask(TASK_A)?.status).toBe("succeeded");
  });

  it("does not dispatch for unknown, queued, or active-streaming tasks", () => {
    const unknown = createFixtures();
    unknown.controller.start("TASK-UNKNOWN" as EntityId<"taskId">);

    const queued = createFixtures(makeQueuedState());
    queued.controller.start(TASK_A);

    const streaming = createFixtures(
      taskCreationReducer(driveToFinalizeActive(makeRunningState()), {
        type: "streaming-started",
        taskId: TASK_A,
        startedAt: CREATED_AT
      })
    );
    streaming.controller.start(TASK_A);

    expect(unknown.sink.actions).toHaveLength(0);
    expect(queued.sink.actions).toHaveLength(0);
    expect(streaming.sink.actions).toHaveLength(0);
    expect(streaming.scheduler.pendingCount).toBe(0);
  });

  it("does not complete when the result source returns an invalid result", () => {
    const f = createFixtures();
    f.source.textByTask.set(TASK_A as string, "   ");

    f.controller.start(TASK_A);
    f.scheduler.flushNext();

    expect(f.source.calls).toHaveLength(1);
    expect(f.sink.actions).toHaveLength(0);
    expect(f.reader.findTask(TASK_A)?.status).toBe("running");
  });

  it("uses the injected result source once and attaches the result to the same task", () => {
    const f = createFixtures();
    f.source.textByTask.set(TASK_A as string, "Final A");

    f.controller.start(TASK_A);
    f.scheduler.flushNext();

    expect(f.source.calls).toHaveLength(1);
    expect(f.source.calls[0]?.taskId).toBe(TASK_A);
    expect(f.reader.findTask(TASK_A)?.finalizedResult).toEqual({
      text: "Final A",
      finalizedAt: "2026-06-24T10:10:00.000Z"
    });
  });

  it("prevents duplicate start and duplicate completion dispatch", () => {
    const f = createFixtures();

    f.controller.start(TASK_A);
    f.controller.start(TASK_A);
    expect(f.scheduler.pendingCount).toBe(1);

    f.scheduler.flushNext();
    f.controller.start(TASK_A);

    expect(f.sink.actions.filter((action) => action.type === "task-completed"))
      .toHaveLength(1);
  });

  it("emits no failed or cancelled terminal action", () => {
    const f = createFixtures();

    f.controller.start(TASK_A);
    f.scheduler.flushNext();

    const raw = JSON.stringify(f.sink.actions);
    expect(raw).not.toMatch(/failed/);
    expect(raw).not.toMatch(/cancelled|canceled/);
  });

  it("stop cancels pending completion and stale callback dispatch", () => {
    const f = createFixtures();

    f.controller.start(TASK_A);
    const entry = f.scheduler.entries[0];
    f.controller.stop(TASK_A);
    entry?.callback();

    expect(entry?.cancelled).toBe(true);
    expect(f.sink.actions).toHaveLength(0);
    expect(f.reader.findTask(TASK_A)?.status).toBe("running");
  });

  it("dispose cancels pending completion and is idempotent", () => {
    const f = createFixtures();

    f.controller.start(TASK_A);
    f.controller.dispose();
    f.controller.dispose();

    expect(f.scheduler.pendingCount).toBe(0);
    expect(f.sink.actions).toHaveLength(0);
  });

  it("keeps two task sessions isolated", () => {
    let state = makeEligibleState(TASK_A, WORK_A);
    const second = makeEligibleState(TASK_B, WORK_B).tasks[0]!;
    state = { ...state, tasks: [...state.tasks, second] };
    const f = createFixtures(state);
    f.source.textByTask.set(TASK_A as string, "Final A");
    f.source.textByTask.set(TASK_B as string, "Final B");

    f.controller.start(TASK_A);
    f.controller.start(TASK_B);
    f.scheduler.flushNext();

    expect(f.reader.findTask(TASK_A)?.status).toBe("succeeded");
    expect(f.reader.findTask(TASK_B)?.status).toBe("running");
    expect(f.reader.findTask(TASK_A)?.finalizedResult?.text).toBe("Final A");
  });

  it("propagates result-source and action-sink errors", () => {
    const sourceFailure = createFixtures();
    sourceFailure.source.shouldThrow = true;
    sourceFailure.controller.start(TASK_A);

    expect(() => sourceFailure.scheduler.flushNext()).toThrow(
      "Simulated result-source failure."
    );

    const sinkFailure = createFixtures();
    sinkFailure.sink.shouldThrow = true;
    sinkFailure.controller.start(TASK_A);

    expect(() => sinkFailure.scheduler.flushNext()).toThrow(
      "Simulated completion sink failure."
    );
  });
});

describe("completion controller source boundaries", () => {
  const source = readFileSync(
    join(
      process.cwd(),
      "apps/frontend/src/features/task-orchestration/model/task-completion-controller.ts"
    ),
    "utf8"
  );

  it("does not use global timer, random, clock, React, backend, or Prisma", () => {
    expect(source).not.toMatch(/\bDate\.now\b/);
    expect(source).not.toMatch(/\bnew Date\b/);
    expect(source).not.toMatch(/\bMath\.random\b/);
    expect(source).not.toMatch(/\bcrypto\.randomUUID\b/);
    expect(source).not.toMatch(/\bsetTimeout\b/);
    expect(source).not.toMatch(/\bsetInterval\b/);
    expect(source).not.toMatch(/from ["']react["']/);
    expect(source).not.toMatch(/@vcp\/backend/);
    expect(source).not.toMatch(/@vcp\/database/);
    expect(source).not.toMatch(/prisma/i);
    expect(source).not.toMatch(/agent-management/);
    expect(source).not.toMatch(/workflow-management/);
  });
});
