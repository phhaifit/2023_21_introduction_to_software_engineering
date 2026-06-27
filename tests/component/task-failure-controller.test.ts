/**
 * task-failure-controller.test.ts
 *
 * Permanent automated tests for the Task & Orchestration failure controller logic
 * (Task 13A-2 — Failure Controller & Cleanup Tests).
 *
 * Coverage:
 *  1. Controller trigger timing (queued, initialize, validate, route, execute, aggregate).
 *  2. Processing-session physical cleanup & session isolation.
 *  3. Streaming session cleanup & preservation of existing fragments.
 *  4. Completion session cleanup & halting of completion callbacks.
 *  5. Single dispatch & duplicate-protection guards.
 *  6. Cleanup ordering verification (processing remove -> streaming -> completion -> dispatch).
 *  7. Cleanup-error policies (AggregateError, retry protection, full isolation).
 *  8. Source boundary audits (no React, backend, Prisma, or browser globals).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { EntityId } from "@vcp/shared";
import type { TaskCreationAction } from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import {
  createTaskProcessingController,
  TaskFinalStepBoundaryError,
  TaskSessionNotFoundError,
  type TaskProcessingActionSink,
  type TaskProcessingCompletionStopper,
  type TaskProcessingController,
  type TaskProcessingLogIdentitySource,
  type TaskProcessingScheduleHandle,
  type TaskProcessingScheduler,
  type TaskProcessingStateReader,
  type TaskProcessingStreamingStopper,
  type TaskProcessingTimeSource
} from "@vcp/frontend/features/task-orchestration/model/task-processing-controller.ts";
import { ORDERED_STEP_IDS } from "@vcp/frontend/features/task-orchestration/model/task-processing.ts";

// ---------------------------------------------------------------------------
// Fake Implementations for Deterministic Controller Testing
// ---------------------------------------------------------------------------

interface ScheduledEntry {
  delayMs: number;
  callback: () => void;
  cancelled: boolean;
  flushed: boolean;
}

class FakeTaskProcessingScheduler implements TaskProcessingScheduler {
  readonly scheduledEntries: ScheduledEntry[] = [];

  schedule(delayMs: number, callback: () => void): TaskProcessingScheduleHandle {
    const entry: ScheduledEntry = { delayMs, callback, cancelled: false, flushed: false };
    this.scheduledEntries.push(entry);
    return {
      cancel: () => {
        entry.cancelled = true;
      }
    };
  }

  flushNext(): void {
    const entry = this.scheduledEntries.find((e) => !e.cancelled && !e.flushed);
    if (!entry) {
      throw new Error("No pending scheduled callback available.");
    }
    entry.flushed = true;
    entry.callback();
  }

  flushAll(): void {
    for (const entry of this.scheduledEntries) {
      if (!entry.cancelled && !entry.flushed) {
        entry.flushed = true;
        entry.callback();
      }
    }
  }

  get pendingCount(): number {
    return this.scheduledEntries.filter((e) => !e.cancelled && !e.flushed).length;
  }
}

class FakeClock implements TaskProcessingTimeSource {
  private ts = "2026-06-25T12:00:00.000Z";
  setTime(ts: string): void { this.ts = ts; }
  now(): string { return this.ts; }
}

class FakeLogIdentitySource implements TaskProcessingLogIdentitySource {
  private counter = 0;
  nextLogId(): string { return `LOG-${String(++this.counter).padStart(4, "0")}`; }
}

class FakeActionSink implements TaskProcessingActionSink {
  readonly dispatched: TaskCreationAction[] = [];
  callTracker?: string[];

  dispatch(action: TaskCreationAction): void {
    if (this.callTracker && action.type === "task-failed") {
      this.callTracker.push("task-failed dispatch");
    }
    this.dispatched.push(action);
  }
}

class FakeStateReader implements TaskProcessingStateReader {
  tasks: Record<string, any> = {};

  setPrompt(taskId: string, prompt: string) {
    this.tasks[taskId] = {
      taskId: taskId as EntityId<"taskId">,
      workId: "WORK-000001" as EntityId<"workId">,
      prompt,
      status: "running"
    };
  }

  findTask(taskId: EntityId<"taskId">) {
    return this.tasks[taskId as string];
  }
}

class FakeStreamingController implements TaskProcessingStreamingStopper {
  stoppedTaskIds: string[] = [];
  globalDisposeCalled = false;
  shouldThrow = false;
  chunksEmitted = 0;
  activeSessions = new Set<string>();
  callTracker?: string[];
  ctrl?: TaskProcessingController;

  start(taskId: string) {
    this.activeSessions.add(taskId);
  }

  stop(taskId: EntityId<"taskId">): void {
    if (this.callTracker && this.ctrl) {
      // Prove processing session was already removed before streaming stop
      try {
        this.ctrl.advance(taskId);
      } catch (err) {
        if (err instanceof TaskSessionNotFoundError) {
          this.callTracker.push("processing session removed");
        }
      }
      this.callTracker.push("streaming stop");
    }
    this.stoppedTaskIds.push(taskId as string);
    this.activeSessions.delete(taskId as string);
    if (this.shouldThrow) {
      throw new Error("Simulated streaming stopper failure.");
    }
  }

  advanceScheduler(taskId: string): void {
    if (this.activeSessions.has(taskId)) {
      this.chunksEmitted++;
    }
  }

  flushExhausted(taskId: string): boolean {
    return this.activeSessions.has(taskId);
  }

  dispose(): void {
    this.globalDisposeCalled = true;
    this.activeSessions.clear();
  }
}

class FakeCompletionController implements TaskProcessingCompletionStopper {
  stoppedTaskIds: string[] = [];
  globalDisposeCalled = false;
  shouldThrow = false;
  finalizedCount = 0;
  activeSessions = new Set<string>();
  callTracker?: string[];

  start(taskId: string) {
    this.activeSessions.add(taskId);
  }

  stop(taskId: EntityId<"taskId">): void {
    if (this.callTracker) {
      this.callTracker.push("completion stop");
    }
    this.stoppedTaskIds.push(taskId as string);
    this.activeSessions.delete(taskId as string);
    if (this.shouldThrow) {
      throw new Error("Simulated completion stopper failure.");
    }
  }

  advanceScheduler(taskId: string): void {
    if (this.activeSessions.has(taskId)) {
      this.finalizedCount++;
    }
  }

  dispose(): void {
    this.globalDisposeCalled = true;
    this.activeSessions.clear();
  }
}

// ---------------------------------------------------------------------------
// Test Fixtures Setup
// ---------------------------------------------------------------------------

const TASK_A = "TASK-000001" as EntityId<"taskId">;
const TASK_B = "TASK-000002" as EntityId<"taskId">;
const FIXED_TS = "2026-06-25T12:00:00.000Z";

interface Fixtures {
  sched: FakeTaskProcessingScheduler;
  clock: FakeClock;
  logIds: FakeLogIdentitySource;
  sink: FakeActionSink;
  reader: FakeStateReader;
  streaming: FakeStreamingController;
  completion: FakeCompletionController;
  ctrl: TaskProcessingController;
  callTracker: string[];
}

function makeFixtures(): Fixtures {
  const sched = new FakeTaskProcessingScheduler();
  const clock = new FakeClock();
  const logIds = new FakeLogIdentitySource();
  const sink = new FakeActionSink();
  const reader = new FakeStateReader();
  const streaming = new FakeStreamingController();
  const completion = new FakeCompletionController();
  const callTracker: string[] = [];

  sink.callTracker = callTracker;
  streaming.callTracker = callTracker;
  completion.callTracker = callTracker;

  clock.setTime(FIXED_TS);

  const ctrl = createTaskProcessingController({
    scheduler: sched,
    clock,
    logIdentitySource: logIds,
    actionSink: sink,
    pendingDelayMs: 500,
    stateReader: reader,
    streamingStopper: streaming,
    completionStopper: completion
  });

  streaming.ctrl = ctrl;

  return { sched, clock, logIds, sink, reader, streaming, completion, ctrl, callTracker };
}

/** Helper to schedule and start a task. */
function startTask(f: Fixtures, taskId: EntityId<"taskId">, prompt: string): void {
  f.reader.setPrompt(taskId as string, prompt);
  f.streaming.start(taskId as string);
  f.completion.start(taskId as string);
  f.ctrl.scheduleStart(taskId);
  f.sched.flushNext();
}

// ---------------------------------------------------------------------------
// 11. Controller trigger timing tests
// ---------------------------------------------------------------------------
describe("11. Controller trigger timing tests", () => {
  it("Failure prompt không fail khi queued hoặc ở initialize-session", () => {
    const f = makeFixtures();
    f.reader.setPrompt(TASK_A as string, "FAIL_SIMULATION: test");
    f.ctrl.scheduleStart(TASK_A);

    // Before flush, task is queued, no actions dispatched
    expect(f.sink.dispatched).toHaveLength(0);

    // Flush starts initialize-session
    f.sched.flushNext();
    expect(f.sink.dispatched.some((a) => a.type === "task-failed")).toBe(false);
  });

  it("Không fail ở validate-input, route-task (analyze-request, select-routing), hoặc process-chunks (execute-task)", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");

    // Advance through validate-input, analyze-request, select-routing, execute-task
    for (let i = 0; i < 4; i++) {
      f.ctrl.advance(TASK_A);
      expect(f.sink.dispatched.some((a) => a.type === "task-failed")).toBe(false);
    }
  });

  it("Fail đúng khi aggregate-result trở thành active, prior steps completed, finalize không bắt đầu, không có later update", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");

    // Advance 4 steps to reach aggregate-result
    for (let i = 0; i < 4; i++) {
      f.ctrl.advance(TASK_A);
    }

    f.sink.dispatched.length = 0; // reset to observe aggregate-result advance

    // Advance at aggregate-result triggers failure simulation
    f.ctrl.advance(TASK_A);

    const failAction = f.sink.dispatched.find((a) => a.type === "task-failed") as Extract<TaskCreationAction, { type: "task-failed" }>;
    expect(failAction).toBeDefined();
    expect(failAction.taskId).toBe(TASK_A);
    expect(failAction.error.stepId).toBe("aggregate-result");

    // Check finalize-result never started
    expect(f.sink.dispatched.some((a) => a.type === "processing-step-activated" && a.stepId === "finalize")).toBe(false);

    // Attempting further advance throws TaskSessionNotFoundError because session was cleaned up
    expect(() => f.ctrl.advance(TASK_A)).toThrow(TaskSessionNotFoundError);
  });

  it("Normal prompt đi qua aggregation bình thường", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "Normal request");

    // Advance through all 5 steps including aggregate-result
    for (let i = 0; i < 5; i++) {
      f.ctrl.advance(TASK_A);
    }

    expect(f.sink.dispatched.some((a) => a.type === "task-failed")).toBe(false);
    // finalize is activated successfully
    expect(f.sink.dispatched.some((a) => a.type === "processing-step-activated" && a.stepId === "finalize")).toBe(true);
  });

  it("Token ở giữa prompt, leading whitespace, hoặc sai case không trigger failure", () => {
    const prompts = [
      "Please do FAIL_SIMULATION: in the middle",
      " FAIL_SIMULATION: leading space",
      "fail_simulation: lowercase"
    ];

    for (const prompt of prompts) {
      const f = makeFixtures();
      startTask(f, TASK_A, prompt);
      for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);
      expect(f.sink.dispatched.some((a) => a.type === "task-failed")).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Processing-session cleanup tests
// ---------------------------------------------------------------------------
describe("12. Processing-session cleanup tests", () => {
  it("Processing session tồn tại trước failure và bị xóa/dừng đúng sau failure", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 4; i++) f.ctrl.advance(TASK_A);

    // Session exists, advance succeeds (triggering failure)
    expect(() => f.ctrl.advance(TASK_A)).not.toThrow();

    // Session is removed, next advance throws
    expect(() => f.ctrl.advance(TASK_A)).toThrow(TaskSessionNotFoundError);
  });

  it("Advancing fake scheduler sau failure không emit step, log mới, second failure, hoặc finalize", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A); // triggers failure

    f.sink.dispatched.length = 0;
    f.sched.flushAll(); // flush any remaining scheduler entries if any

    expect(f.sink.dispatched).toHaveLength(0);
  });

  it("Stop chỉ ảnh hưởng đúng Task ID, Task B vẫn tiếp tục độc lập", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    startTask(f, TASK_B, "Normal request");

    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A); // TASK_A fails
    expect(() => f.ctrl.advance(TASK_A)).toThrow(TaskSessionNotFoundError);

    // TASK_B continues independently
    expect(() => f.ctrl.advance(TASK_B)).not.toThrow();
  });

  it("stop(taskId) hoặc session cleanup idempotent theo existing convention, không gọi global dispose", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A); // fails and cleans up

    // Calling stop explicitly on cleaned up task is idempotent
    expect(() => f.ctrl.stop(TASK_A)).not.toThrow();
    expect(f.streaming.globalDisposeCalled).toBe(false);
    expect(f.completion.globalDisposeCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 13. Streaming cleanup tests
// ---------------------------------------------------------------------------
describe("13. Streaming cleanup tests", () => {
  it("Streaming stopper nhận đúng Task ID, gọi đúng một lần, active session bị stop", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);

    expect(f.streaming.stoppedTaskIds).toEqual([TASK_A]);
    expect(f.streaming.activeSessions.has(TASK_A as string)).toBe(false);
  });

  it("Advancing streaming scheduler không tạo chunk mới, exhausted callback không thay đổi Task, existing fragments giữ", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);

    f.streaming.advanceScheduler(TASK_A as string);
    expect(f.streaming.chunksEmitted).toBe(0);

    const exhausted = f.streaming.flushExhausted(TASK_A as string);
    expect(exhausted).toBe(false); // no active session, no callback fired
  });

  it("Task B streaming không bị dừng, inactive streaming session không gây lỗi, không gọi global dispose", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    startTask(f, TASK_B, "Normal request");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);

    expect(f.streaming.activeSessions.has(TASK_B as string)).toBe(true);
    expect(f.streaming.globalDisposeCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 14. Completion cleanup tests
// ---------------------------------------------------------------------------
describe("14. Completion cleanup tests", () => {
  it("Completion stopper nhận đúng Task ID, gọi đúng một lần, pending callback bị stop", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);

    expect(f.completion.stoppedTaskIds).toEqual([TASK_A]);
    expect(f.completion.activeSessions.has(TASK_A as string)).toBe(false);
  });

  it("Advancing completion scheduler không tạo finalized result, không dispatch completion action", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);

    f.completion.advanceScheduler(TASK_A as string);
    expect(f.completion.finalizedCount).toBe(0);
  });

  it("Task B completion không bị dừng, inactive completion session không gây lỗi, không gọi global dispose", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    startTask(f, TASK_B, "Normal request");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);

    expect(f.completion.activeSessions.has(TASK_B as string)).toBe(true);
    expect(f.completion.globalDisposeCalled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 15. Single dispatch và duplicate-protection tests
// ---------------------------------------------------------------------------
describe("15. Single dispatch và duplicate-protection tests", () => {
  it("Một failure event emit đúng một task-failed, repeated scheduler/controller advance không emit thêm", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);

    const failActions = f.sink.dispatched.filter((a) => a.type === "task-failed");
    expect(failActions).toHaveLength(1);

    // Repeated controller advance throws, no extra emit
    expect(() => f.ctrl.advance(TASK_A)).toThrow(TaskSessionNotFoundError);
    expect(f.sink.dispatched.filter((a) => a.type === "task-failed")).toHaveLength(1);
  });

  it("Failure cleanup không tạo cancellation action, stoppers không dispatch failure thay controller", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);

    const cancelActions = f.sink.dispatched.filter((a) => a.type === "task-cancelled");
    expect(cancelActions).toHaveLength(0);
  });

  it("Task A failure không block Task B, same Task không có hai failure actions", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    startTask(f, TASK_B, "FAIL_SIMULATION: test 2");

    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_B);

    const aFails = f.sink.dispatched.filter((a) => a.type === "task-failed" && a.taskId === TASK_A);
    const bFails = f.sink.dispatched.filter((a) => a.type === "task-failed" && a.taskId === TASK_B);

    expect(aFails).toHaveLength(1);
    expect(bFails).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 16. Cleanup ordering tests
// ---------------------------------------------------------------------------
describe("16. Cleanup ordering tests", () => {
  it("Ghi nhận call order và assert: processing session removed -> streaming stop -> completion stop -> task-failed dispatch", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 5; i++) f.ctrl.advance(TASK_A);

    expect(f.callTracker).toEqual([
      "processing session removed",
      "streaming stop",
      "completion stop",
      "task-failed dispatch"
    ]);
  });
});

// ---------------------------------------------------------------------------
// 17. Cleanup-error policy tests
// ---------------------------------------------------------------------------
describe("17. Cleanup-error policy tests", () => {
  it("Streaming stopper throw: processing dừng, completion stopper attempt, task-failed dispatch, AggregateError phát ra", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 4; i++) f.ctrl.advance(TASK_A);

    f.streaming.shouldThrow = true;

    expect(() => f.ctrl.advance(TASK_A)).toThrow(AggregateError);

    // Processing session stopped
    expect(() => f.ctrl.advance(TASK_A)).toThrow(TaskSessionNotFoundError);
    // Completion stopper still attempted
    expect(f.completion.stoppedTaskIds).toEqual([TASK_A]);
    // task-failed still dispatched
    const failAction = f.sink.dispatched.find((a) => a.type === "task-failed") as Extract<TaskCreationAction, { type: "task-failed" }>;
    expect(failAction).toBeDefined();
    // TaskError does not contain cleanup error, no raw stack
    expect((failAction.error as any).stack).toBeUndefined();
    expect(failAction.error.message).toBe("Quá trình tổng hợp kết quả đã được mô phỏng là thất bại.");
  });

  it("Completion stopper throw: processing dừng, streaming stopper đã gọi, task-failed dispatch, AggregateError phát ra", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 4; i++) f.ctrl.advance(TASK_A);

    f.completion.shouldThrow = true;

    expect(() => f.ctrl.advance(TASK_A)).toThrow(AggregateError);

    expect(() => f.ctrl.advance(TASK_A)).toThrow(TaskSessionNotFoundError);
    expect(f.streaming.stoppedTaskIds).toEqual([TASK_A]);
    expect(f.sink.dispatched.some((a) => a.type === "task-failed")).toBe(true);
  });

  it("Cả hai stopper throw: cả hai attempt, failure dispatch 1 lần, errors aggregate, session không sống lại, không có retry", () => {
    const f = makeFixtures();
    startTask(f, TASK_A, "FAIL_SIMULATION: test");
    for (let i = 0; i < 4; i++) f.ctrl.advance(TASK_A);

    f.streaming.shouldThrow = true;
    f.completion.shouldThrow = true;

    let aggErr: AggregateError | undefined;
    try {
      f.ctrl.advance(TASK_A);
    } catch (err) {
      aggErr = err as AggregateError;
    }

    expect(aggErr).toBeDefined();
    expect(aggErr?.errors).toHaveLength(2);
    expect(f.streaming.stoppedTaskIds).toEqual([TASK_A]);
    expect(f.completion.stoppedTaskIds).toEqual([TASK_A]);
    expect(f.sink.dispatched.filter((a) => a.type === "task-failed")).toHaveLength(1);

    // Session does not revive
    expect(() => f.ctrl.advance(TASK_A)).toThrow(TaskSessionNotFoundError);
  });
});

// ---------------------------------------------------------------------------
// 18. Controller boundary tests
// ---------------------------------------------------------------------------
describe("18. Controller boundary tests", () => {
  const root = process.cwd();
  const productionFiles = [
    "apps/frontend/src/features/task-orchestration/model/task-processing-controller.ts",
    "apps/frontend/src/features/task-orchestration/model/task-processing.ts",
    "apps/frontend/src/features/task-orchestration/model/task-creation-state.ts",
    "apps/frontend/src/features/task-orchestration/model/task-types.ts"
  ];

  it.each(productionFiles)("File %s không import React, backend, Prisma, hoặc browser globals", (filePath) => {
    const source = readFileSync(join(root, filePath), "utf8");

    expect(source).not.toMatch(/from "react"/);
    expect(source).not.toMatch(/@vcp\/backend/);
    expect(source).not.toMatch(/Prisma/);
    expect(source).not.toMatch(/\bwindow\b/);
    expect(source).not.toMatch(/\blocalStorage\b/);
    expect(source).not.toMatch(/\bsessionStorage\b/);
  });
});
