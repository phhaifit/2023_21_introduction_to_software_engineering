/**
 * task-streaming-controller.test.ts
 *
 * Permanent focused tests for the Task & Orchestration streaming controller
 * (Task 9A — Deterministic Streaming Controller Foundation).
 *
 * Coverage (33 cases):
 *  1.  start creates exactly one session.
 *  2.  Duplicate start does not create a second session.
 *  3.  No action before valid start.
 *  4.  Start dispatches streaming-started.
 *  5.  Start schedules exactly one callback.
 *  6.  Delay uses injected fragmentDelayMs.
 *  7.  No fragment before scheduler flush.
 *  8.  One flush appends exactly one fragment.
 *  9.  Fragment ID comes from injected source.
 * 10.  Timestamp comes from injected clock.
 * 11.  Fragment order matches source order.
 * 12.  No fragment is skipped.
 * 13.  No duplicate fragment.
 * 14.  Only one pending schedule at a time.
 * 15.  Last fragment dispatches streaming-exhausted.
 * 16.  No schedule after exhausted.
 * 17.  Task remains running after full stream.
 * 18.  No terminal lifecycle action is emitted.
 * 19.  No completed result is created.
 * 20.  Start rejected when task is queued.
 * 21.  Start rejected when task is terminal.
 * 22.  stop cancels pending schedule.
 * 23.  stop prevents stale callback dispatch.
 * 24.  stop does not dispatch cancelled.
 * 25.  stop is safe for unknown task.
 * 26.  dispose cancels all pending schedules.
 * 27.  dispose is idempotent.
 * 28.  Two tasks have independent sessions.
 * 29.  Action-sink error is propagated.
 * 30.  Missing task from state reader is handled safely.
 * 31.  Empty fragment source ends stably.
 * 32.  No global timer, random, or clock usage in source.
 * 33.  No React/backend/Prisma/private imports in source.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import type { EntityId } from "@vcp/shared";
import {
  initialTaskCreationState,
  taskCreationReducer,
  type TaskCreationAction,
  type TaskCreationState
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import {
  createTaskStreamingController,
  type TaskStreamingActionSink,
  type TaskStreamingController,
  type TaskStreamingFragmentIdentitySource,
  type TaskStreamingFragmentSource,
  type TaskStreamingStateReader
} from "@vcp/frontend/features/task-orchestration/model/task-streaming-controller.ts";
import type {
  TaskProcessingScheduleHandle,
  TaskProcessingScheduler
} from "@vcp/frontend/features/task-orchestration/model/task-processing-controller.ts";
import type { TaskProcessingTimeSource } from "@vcp/frontend/features/task-orchestration/model/task-processing-controller.ts";
import { transitionTaskStatus } from "@vcp/frontend/features/task-orchestration/model/task-lifecycle.ts";

interface ScheduledEntry {
  delayMs: number;
  callback: () => void;
  cancelled: boolean;
  executed: boolean;
}

class FakeScheduler implements TaskProcessingScheduler {
  readonly scheduledEntries: ScheduledEntry[] = [];

  schedule(delayMs: number, callback: () => void): TaskProcessingScheduleHandle {
    const entry: ScheduledEntry = {
      delayMs,
      callback,
      cancelled: false,
      executed: false
    };
    this.scheduledEntries.push(entry);
    return {
      cancel: () => {
        entry.cancelled = true;
      }
    };
  }

  flushNext(): void {
    const entry = this.scheduledEntries.find(
      (e) => !e.cancelled && !e.executed
    );
    if (!entry) {
      throw new Error("No pending scheduled callback available.");
    }
    entry.executed = true;
    entry.callback();
  }

  get pendingCount(): number {
    return this.scheduledEntries.filter((e) => !e.cancelled && !e.executed)
      .length;
  }
}

class FakeClock implements TaskProcessingTimeSource {
  private ts = "2026-06-24T00:00:00.000Z";
  setTime(ts: string): void {
    this.ts = ts;
  }
  now(): string {
    return this.ts;
  }
}

class FakeFragmentIdentitySource implements TaskStreamingFragmentIdentitySource {
  private counter = 0;
  nextFragmentId(): string {
    return `FRG-${String(++this.counter).padStart(4, "0")}`;
  }
}

class MapFragmentSource implements TaskStreamingFragmentSource {
  private readonly fragmentsByTask = new Map<string, readonly string[]>();

  setFragments(taskId: EntityId<"taskId">, fragments: readonly string[]): void {
    this.fragmentsByTask.set(taskId as string, fragments);
  }

  getFragments(taskId: EntityId<"taskId">): readonly string[] {
    return this.fragmentsByTask.get(taskId as string) ?? [];
  }
}

class ReducerStateReader implements TaskStreamingStateReader {
  constructor(private readonly getState: () => TaskCreationState) {}

  findTask(taskId: EntityId<"taskId">) {
    return this.getState().tasks.find((t) => t.taskId === taskId) ?? null;
  }
}

class ReducerActionSink implements TaskStreamingActionSink {
  shouldThrow = false;

  constructor(
    private readonly apply: (action: TaskCreationAction) => void
  ) {}

  dispatch(action: TaskCreationAction): void {
    if (this.shouldThrow) {
      throw new Error("Simulated sink failure.");
    }
    this.apply(action);
  }
}

const TASK_A = "TASK-000001" as EntityId<"taskId">;
const TASK_B = "TASK-000002" as EntityId<"taskId">;
const WORK_A = "WORK-000001" as EntityId<"workId">;
const WORK_B = "WORK-000002" as EntityId<"workId">;
const FIXED_TS = "2026-06-24T10:00:00.000Z";
const FRAGMENT_DELAY = 120;

interface Fixtures {
  sched: FakeScheduler;
  clock: FakeClock;
  fragmentIds: FakeFragmentIdentitySource;
  fragmentSource: MapFragmentSource;
  getState: () => TaskCreationState;
  setState: (state: TaskCreationState) => void;
  sink: ReducerActionSink;
  reader: ReducerStateReader;
  ctrl: TaskStreamingController;
  actions: TaskCreationAction[];
}

function makeRunningState(taskId = TASK_A, workId = WORK_A): TaskCreationState {
  let state = taskCreationReducer(initialTaskCreationState, {
    type: "task-created",
    request: { prompt: "Test", routing: { mode: "auto" } },
    response: {
      taskId,
      workId,
      status: "queued",
      createdAt: FIXED_TS
    }
  });

  return taskCreationReducer(state, {
    type: "processing-started",
    taskId,
    startedAt: FIXED_TS
  });
}

function createFixtures(
  fragments: readonly string[] = ["Hello", " ", "world"],
  taskId = TASK_A
): Fixtures {
  const sched = new FakeScheduler();
  const clock = new FakeClock();
  clock.setTime(FIXED_TS);
  const fragmentIds = new FakeFragmentIdentitySource();
  const fragmentSource = new MapFragmentSource();
  fragmentSource.setFragments(taskId, fragments);

  const stateHolder = { state: makeRunningState(taskId) };
  const actions: TaskCreationAction[] = [];

  const sink = new ReducerActionSink((action) => {
    actions.push(action);
    stateHolder.state = taskCreationReducer(stateHolder.state, action);
  });

  const reader = new ReducerStateReader(() => stateHolder.state);

  const ctrl = createTaskStreamingController({
    scheduler: sched,
    clock,
    fragmentIdentitySource: fragmentIds,
    fragmentSource,
    stateReader: reader,
    actionSink: sink,
    fragmentDelayMs: FRAGMENT_DELAY
  });

  return {
    sched,
    clock,
    fragmentIds,
    fragmentSource,
    getState: () => stateHolder.state,
    setState: (next) => {
      stateHolder.state = next;
    },
    sink,
    reader,
    ctrl,
    actions
  };
}

function runFullStream(f: Fixtures, taskId = TASK_A): void {
  f.ctrl.start(taskId);
  while (f.sched.pendingCount > 0) {
    f.sched.flushNext();
  }
}

describe("1. start creates exactly one session", () => {
  it("allows start once and schedules one callback", () => {
    const f = createFixtures();
    f.ctrl.start(TASK_A);

    expect(f.actions).toHaveLength(1);
    expect(f.sched.pendingCount).toBe(1);
  });
});

describe("2. duplicate start does not create a second session", () => {
  it("ignores second start for same task", () => {
    const f = createFixtures();
    f.ctrl.start(TASK_A);
    f.ctrl.start(TASK_A);

    expect(f.actions.filter((a) => a.type === "streaming-started")).toHaveLength(1);
    expect(f.sched.pendingCount).toBe(1);
  });
});

describe("3. no action before valid start", () => {
  it("advance without start emits nothing", () => {
    const f = createFixtures();
    f.ctrl.advance(TASK_A);

    expect(f.actions).toHaveLength(0);
  });
});

describe("4. start dispatches streaming-started", () => {
  it("first action is streaming-started", () => {
    const f = createFixtures();
    f.ctrl.start(TASK_A);

    expect(f.actions[0]).toEqual({
      type: "streaming-started",
      taskId: TASK_A,
      startedAt: FIXED_TS
    });
  });
});

describe("5. start schedules exactly one callback", () => {
  it("creates one pending schedule after start", () => {
    const f = createFixtures();
    f.ctrl.start(TASK_A);

    expect(f.sched.scheduledEntries).toHaveLength(1);
    expect(f.sched.pendingCount).toBe(1);
  });
});

describe("6. delay uses injected fragmentDelayMs", () => {
  it("passes fragmentDelayMs to scheduler", () => {
    const f = createFixtures();
    f.ctrl.start(TASK_A);

    expect(f.sched.scheduledEntries[0]?.delayMs).toBe(FRAGMENT_DELAY);
  });
});

describe("7. no fragment before scheduler flush", () => {
  it("does not append fragments until callback fires", () => {
    const f = createFixtures();
    f.ctrl.start(TASK_A);

    const task = f.reader.findTask(TASK_A);
    expect(task?.streamingSnapshot.fragments).toHaveLength(0);
    expect(f.actions.every((a) => a.type !== "streaming-fragment-appended")).toBe(
      true
    );
  });
});

describe("8. one flush appends exactly one fragment", () => {
  it("adds one fragment per scheduler flush", () => {
    const f = createFixtures(["A", "B"]);
    f.ctrl.start(TASK_A);
    f.sched.flushNext();

    const task = f.reader.findTask(TASK_A);
    expect(task?.streamingSnapshot.fragments).toHaveLength(1);
    expect(task?.streamingSnapshot.fragments[0]?.text).toBe("A");
  });
});

describe("9. fragment ID comes from injected source", () => {
  it("uses fragmentIdentitySource for fragment IDs", () => {
    const f = createFixtures(["chunk"]);
    f.ctrl.start(TASK_A);
    f.sched.flushNext();

    const append = f.actions.find((a) => a.type === "streaming-fragment-appended");
    expect(append).toMatchObject({ fragmentId: "FRG-0001" });
  });
});

describe("10. timestamp comes from injected clock", () => {
  it("uses clock.now for fragment appendedAt", () => {
    const f = createFixtures(["chunk"]);
    f.clock.setTime("2026-06-24T11:00:00.000Z");
    f.ctrl.start(TASK_A);
    f.sched.flushNext();

    const append = f.actions.find((a) => a.type === "streaming-fragment-appended");
    expect(append).toMatchObject({ appendedAt: "2026-06-24T11:00:00.000Z" });
  });
});

describe("11. fragment order matches source order", () => {
  it("delivers fragments in source order", () => {
    const f = createFixtures(["one", "two", "three"]);
    runFullStream(f);

    const task = f.reader.findTask(TASK_A);
    expect(task?.streamingSnapshot.fragments.map((x) => x.text)).toEqual([
      "one",
      "two",
      "three"
    ]);
  });
});

describe("12. no fragment is skipped", () => {
  it("delivers every source fragment", () => {
    const fragments = ["a", "b", "c", "d"];
    const f = createFixtures(fragments);
    runFullStream(f);

    const task = f.reader.findTask(TASK_A);
    expect(task?.streamingSnapshot.fragments).toHaveLength(fragments.length);
  });
});

describe("13. no duplicate fragment", () => {
  it("each fragment has a unique ID and sequence", () => {
    const f = createFixtures(["x", "y"]);
    runFullStream(f);

    const task = f.reader.findTask(TASK_A);
    const ids = task?.streamingSnapshot.fragments.map((x) => x.id) ?? [];
    const sequences = task?.streamingSnapshot.fragments.map((x) => x.sequence) ?? [];

    expect(new Set(ids).size).toBe(ids.length);
    expect(sequences).toEqual([1, 2]);
  });
});

describe("14. only one pending schedule at a time", () => {
  it("never exceeds one pending schedule during streaming", () => {
    const f = createFixtures(["a", "b", "c"]);
    f.ctrl.start(TASK_A);

    expect(f.sched.pendingCount).toBe(1);
    f.sched.flushNext();
    expect(f.sched.pendingCount).toBeLessThanOrEqual(1);
    f.sched.flushNext();
    expect(f.sched.pendingCount).toBeLessThanOrEqual(1);
  });
});

describe("15. last fragment dispatches streaming-exhausted", () => {
  it("emits streaming-exhausted after final fragment", () => {
    const f = createFixtures(["only"]);
    runFullStream(f);

    expect(f.actions.at(-1)).toMatchObject({
      type: "streaming-exhausted",
      taskId: TASK_A
    });
  });
});

describe("16. no schedule after exhausted", () => {
  it("clears pending schedules when exhausted", () => {
    const f = createFixtures(["done"]);
    runFullStream(f);

    expect(f.sched.pendingCount).toBe(0);
  });
});

describe("17. task remains running after full stream", () => {
  it("does not change canonical status", () => {
    const f = createFixtures();
    runFullStream(f);

    const task = f.reader.findTask(TASK_A);
    expect(task?.status).toBe("running");
  });
});

describe("18. no terminal lifecycle action is emitted", () => {
  it("never dispatches succeeded, failed, or cancelled", () => {
    const f = createFixtures();
    runFullStream(f);

    const lifecycleTypes = new Set([
      "processing-started",
      "streaming-started",
      "streaming-fragment-appended",
      "streaming-exhausted",
      "processing-step-completed",
      "processing-step-activated",
      "processing-log-appended"
    ]);

    expect(f.actions.every((a) => lifecycleTypes.has(a.type))).toBe(true);
    expect(f.actions.some((a) => a.type.includes("cancel"))).toBe(false);
  });
});

describe("19. no completed result is created", () => {
  it("CreatedTaskRecord has no finalResult after streaming", () => {
    const f = createFixtures();
    runFullStream(f);

    const task = f.reader.findTask(TASK_A);
    expect(task).not.toHaveProperty("finalResult");
  });
});

describe("20. start rejected when task is queued", () => {
  it("does not start streaming for queued task", () => {
    const sched = new FakeScheduler();
    const clock = new FakeClock();
    const fragmentSource = new MapFragmentSource();
    fragmentSource.setFragments(TASK_A, ["x"]);

    let state = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: { prompt: "Test", routing: { mode: "auto" } },
      response: {
        taskId: TASK_A,
        workId: WORK_A,
        status: "queued",
        createdAt: FIXED_TS
      }
    });

    const actions: TaskCreationAction[] = [];
    const sink = new ReducerActionSink((action) => {
      actions.push(action);
      state = taskCreationReducer(state, action);
    });

    const ctrl = createTaskStreamingController({
      scheduler: sched,
      clock,
      fragmentIdentitySource: new FakeFragmentIdentitySource(),
      fragmentSource,
      stateReader: new ReducerStateReader(() => state),
      actionSink: sink,
      fragmentDelayMs: FRAGMENT_DELAY
    });

    ctrl.start(TASK_A);

    expect(actions).toHaveLength(0);
    expect(sched.pendingCount).toBe(0);
  });
});

describe("21. start rejected when task is terminal", () => {
  it("does not start streaming for succeeded task", () => {
    let state = makeRunningState();
    const task = state.tasks.find((t) => t.taskId === TASK_A);
    if (!task) throw new Error("Expected task");

    const succeeded = transitionTaskStatus(task, "succeeded");
    if (!succeeded.ok) throw new Error("Expected succeeded");

    state = {
      ...state,
      tasks: state.tasks.map((t) =>
        t.taskId === TASK_A ? succeeded.task : t
      )
    };

    const sched = new FakeScheduler();
    const actions: TaskCreationAction[] = [];
    const fragmentSource = new MapFragmentSource();
    fragmentSource.setFragments(TASK_A, ["x"]);

    const ctrl = createTaskStreamingController({
      scheduler: sched,
      clock: new FakeClock(),
      fragmentIdentitySource: new FakeFragmentIdentitySource(),
      fragmentSource,
      stateReader: new ReducerStateReader(() => state),
      actionSink: new ReducerActionSink((action) => {
        actions.push(action);
        state = taskCreationReducer(state, action);
      }),
      fragmentDelayMs: FRAGMENT_DELAY
    });

    ctrl.start(TASK_A);

    expect(actions).toHaveLength(0);
  });
});

describe("22. stop cancels pending schedule", () => {
  it("clears pending schedule on stop", () => {
    const f = createFixtures();
    f.ctrl.start(TASK_A);
    expect(f.sched.pendingCount).toBe(1);

    f.ctrl.stop(TASK_A);

    expect(f.sched.pendingCount).toBe(0);
  });
});

describe("23. stop prevents stale callback dispatch", () => {
  it("does not append fragments after stop", () => {
    const f = createFixtures(["late"]);
    f.ctrl.start(TASK_A);
    f.ctrl.stop(TASK_A);

    const entry = f.sched.scheduledEntries[0];
    expect(() => entry?.callback()).not.toThrow();

    const task = f.reader.findTask(TASK_A);
    expect(task?.streamingSnapshot.fragments).toHaveLength(0);
  });
});

describe("24. stop does not dispatch cancelled", () => {
  it("emits only streaming-started before stop", () => {
    const f = createFixtures(["x"]);
    f.ctrl.start(TASK_A);
    f.ctrl.stop(TASK_A);

    expect(f.actions.map((a) => a.type)).toEqual(["streaming-started"]);
  });
});

describe("25. stop is safe for unknown task", () => {
  it("does not throw for unknown taskId", () => {
    const f = createFixtures();
    expect(() => f.ctrl.stop("TASK-UNKNOWN" as EntityId<"taskId">)).not.toThrow();
  });
});

describe("26. dispose cancels all pending schedules", () => {
  it("cancels schedules for every active session", () => {
    const f = createFixtures(["a"], TASK_A);
    f.fragmentSource.setFragments(TASK_B, ["b"]);

    let state = f.getState();
    state = taskCreationReducer(state, {
      type: "task-created",
      request: { prompt: "B", routing: { mode: "auto" } },
      response: {
        taskId: TASK_B,
        workId: WORK_B,
        status: "queued",
        createdAt: FIXED_TS
      }
    });
    state = taskCreationReducer(state, {
      type: "processing-started",
      taskId: TASK_B,
      startedAt: FIXED_TS
    });

    f.setState(state);
    f.ctrl.start(TASK_A);
    f.ctrl.start(TASK_B);

    expect(f.sched.pendingCount).toBe(2);
    f.ctrl.dispose();
    expect(f.sched.pendingCount).toBe(0);
  });
});

describe("27. dispose is idempotent", () => {
  it("safe to call dispose twice", () => {
    const f = createFixtures();
    f.ctrl.start(TASK_A);

    expect(() => {
      f.ctrl.dispose();
      f.ctrl.dispose();
    }).not.toThrow();
  });
});

describe("28. two tasks have independent sessions", () => {
  it("streams each task independently", () => {
    const f = createFixtures(["A"], TASK_A);
    f.fragmentSource.setFragments(TASK_B, ["B"]);

    let state = f.getState();
    state = taskCreationReducer(state, {
      type: "task-created",
      request: { prompt: "B", routing: { mode: "auto" } },
      response: {
        taskId: TASK_B,
        workId: WORK_B,
        status: "queued",
        createdAt: FIXED_TS
      }
    });
    state = taskCreationReducer(state, {
      type: "processing-started",
      taskId: TASK_B,
      startedAt: FIXED_TS
    });
    f.setState(state);

    f.ctrl.start(TASK_A);
    while (f.sched.pendingCount > 0) {
      f.sched.flushNext();
    }

    f.ctrl.start(TASK_B);
    while (f.sched.pendingCount > 0) {
      f.sched.flushNext();
    }

    const taskA = f.reader.findTask(TASK_A);
    const taskB = f.reader.findTask(TASK_B);

    expect(taskA?.streamingSnapshot.fragments.map((x) => x.text)).toEqual(["A"]);
    expect(taskB?.streamingSnapshot.fragments.map((x) => x.text)).toEqual(["B"]);
  });
});

describe("29. action-sink error is propagated", () => {
  it("throws when sink dispatch fails during start", () => {
    const f = createFixtures();
    f.sink.shouldThrow = true;

    expect(() => f.ctrl.start(TASK_A)).toThrow("Simulated sink failure.");
  });
});

describe("30. missing task from state reader is handled safely", () => {
  it("does not throw when task disappears before callback", () => {
    const f = createFixtures(["orphan"]);
    f.ctrl.start(TASK_A);

    f.setState(initialTaskCreationState);

    expect(() => f.sched.flushNext()).not.toThrow();
    expect(f.actions.filter((a) => a.type === "streaming-fragment-appended")).toHaveLength(
      0
    );
  });
});

describe("31. empty fragment source ends stably", () => {
  it("dispatches streaming-exhausted without fragments", () => {
    const f = createFixtures([]);
    f.ctrl.start(TASK_A);
    f.sched.flushNext();

    expect(f.actions.map((a) => a.type)).toEqual([
      "streaming-started",
      "streaming-exhausted"
    ]);

    const task = f.reader.findTask(TASK_A);
    expect(task?.streamingSnapshot.phase).toBe("exhausted");
    expect(task?.streamingSnapshot.fragments).toHaveLength(0);
  });
});

describe("32. no global timer, random, or clock usage", () => {
  const sourcePath = join(
    process.cwd(),
    "apps/frontend/src/features/task-orchestration/model/task-streaming-controller.ts"
  );

  it("controller source avoids non-injected time and randomness", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toMatch(/\bDate\.now\b/);
    expect(source).not.toMatch(/\bnew Date\b/);
    expect(source).not.toMatch(/\bMath\.random\b/);
    expect(source).not.toMatch(/\bcrypto\.randomUUID\b/);
    expect(source).not.toMatch(/\bsetTimeout\b/);
    expect(source).not.toMatch(/\bsetInterval\b/);
  });
});

describe("33. no React/backend/Prisma/private imports", () => {
  const sourcePath = join(
    process.cwd(),
    "apps/frontend/src/features/task-orchestration/model/task-streaming-controller.ts"
  );

  it("controller source has no forbidden imports", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toMatch(/from ["']react["']/);
    expect(source).not.toMatch(/@vcp\/database/);
    expect(source).not.toMatch(/prisma/i);
    expect(source).not.toMatch(/agent-management/);
    expect(source).not.toMatch(/workflow-management/);
  });
});
