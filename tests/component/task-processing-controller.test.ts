/**
 * task-processing-controller.test.ts
 *
 * Permanent focused tests for the Task & Orchestration processing controller
 * (Task 8A — Deterministic Processing Controller Foundation).
 *
 * Coverage (30 cases):
 *  1.  scheduleStart creates exactly one scheduled callback.
 *  2.  Duplicate scheduleStart does not create a second callback.
 *  3.  No action is emitted before scheduler execution.
 *  4.  Scheduled execution emits processing-started.
 *  5.  Action order is deterministic (processing-started then log).
 *  6.  The correct Task ID is preserved in emitted actions.
 *  7.  startedAt comes from the injected clock.
 *  8.  Log ID comes from the injected identity source.
 *  9.  No raw lifecycle-status assignment exists in the controller source.
 * 10.  advance before the start callback fires throws TaskSessionNotFoundError.
 * 11.  advance completes the active step (emits processing-step-completed).
 * 12.  A completion log is emitted after step completion.
 * 13.  The next step is activated (emits processing-step-activated).
 * 14.  The activation log follows the completion log.
 * 15.  No processing step is skipped across a full advance sequence.
 * 16.  No duplicate active step: advance emits exactly one activated action per call.
 * 17.  Completed steps are not reactivated by advance.
 * 18.  The final-step boundary does not emit succeeded.
 * 19.  No completed result is created at the final-step boundary.
 * 20.  No failed or cancelled transition is emitted by advance.
 * 21.  stop cancels a pending start schedule.
 * 22.  stop emits no cancellation transition.
 * 23.  stop is safe for an unknown task (no-op).
 * 24.  dispose cancels every pending schedule handle.
 * 25.  dispose is idempotent (calling twice is safe).
 * 26.  Two tasks have independent controller sessions.
 * 27.  Failure from the action sink is propagated.
 * 28.  The controller does not mutate caller-owned inputs.
 * 29.  No global time, random, or timer usage in the controller source.
 * 30.  No React, backend, Prisma, or private-module imports in the controller source.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import type { EntityId } from "@vcp/shared";
import type { TaskCreationAction } from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import {
  createTaskProcessingController,
  TaskFinalStepBoundaryError,
  TaskSessionNotFoundError
} from "@vcp/frontend/features/task-orchestration/model/task-processing-controller.ts";
import type {
  TaskProcessingActionSink,
  TaskProcessingController,
  TaskProcessingLogIdentitySource,
  TaskProcessingScheduleHandle,
  TaskProcessingScheduler,
  TaskProcessingTimeSource
} from "@vcp/frontend/features/task-orchestration/model/task-processing-controller.ts";
import { ORDERED_STEP_IDS } from "@vcp/frontend/features/task-orchestration/model/task-processing.ts";

// ---------------------------------------------------------------------------
// Fake scheduler — deterministic, no real timers
// ---------------------------------------------------------------------------

interface ScheduledEntry {
  delayMs: number;
  callback: () => void;
  cancelled: boolean;
}

class FakeTaskProcessingScheduler implements TaskProcessingScheduler {
  readonly scheduledEntries: ScheduledEntry[] = [];

  schedule(delayMs: number, callback: () => void): TaskProcessingScheduleHandle {
    const entry: ScheduledEntry = { delayMs, callback, cancelled: false };
    this.scheduledEntries.push(entry);
    return {
      cancel: () => {
        entry.cancelled = true;
      }
    };
  }

  /** Execute the next non-cancelled callback. Throws if none exists. */
  flushNext(): void {
    const entry = this.scheduledEntries.find((e) => !e.cancelled);
    if (!entry) {
      throw new Error("No pending scheduled callback available.");
    }
    entry.callback();
  }

  /** Count of non-cancelled pending entries. */
  get pendingCount(): number {
    return this.scheduledEntries.filter((e) => !e.cancelled).length;
  }
}

// ---------------------------------------------------------------------------
// Fake clock
// ---------------------------------------------------------------------------

class FakeClock implements TaskProcessingTimeSource {
  private ts = "2026-06-24T00:00:00.000Z";
  setTime(ts: string): void { this.ts = ts; }
  now(): string { return this.ts; }
}

// ---------------------------------------------------------------------------
// Fake log identity source
// ---------------------------------------------------------------------------

class FakeLogIdentitySource implements TaskProcessingLogIdentitySource {
  private counter = 0;
  nextLogId(): string { return `LOG-${String(++this.counter).padStart(4, "0")}`; }
}

// ---------------------------------------------------------------------------
// Fake action sink
// ---------------------------------------------------------------------------

class FakeActionSink implements TaskProcessingActionSink {
  readonly dispatched: TaskCreationAction[] = [];
  shouldThrow = false;

  dispatch(action: TaskCreationAction): void {
    if (this.shouldThrow) {
      throw new Error("Simulated sink failure.");
    }
    this.dispatched.push(action);
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TASK_A = "TASK-000001" as EntityId<"taskId">;
const TASK_B = "TASK-000002" as EntityId<"taskId">;
const FIXED_TS = "2026-06-24T10:00:00.000Z";
const PENDING_DELAY = 600;

interface Fixtures {
  sched: FakeTaskProcessingScheduler;
  clock: FakeClock;
  logIds: FakeLogIdentitySource;
  sink: FakeActionSink;
  ctrl: TaskProcessingController;
}

function makeFixtures(): Fixtures {
  const sched = new FakeTaskProcessingScheduler();
  const clock = new FakeClock();
  const logIds = new FakeLogIdentitySource();
  const sink = new FakeActionSink();
  clock.setTime(FIXED_TS);
  const ctrl = createTaskProcessingController({
    scheduler: sched,
    clock,
    logIdentitySource: logIds,
    actionSink: sink,
    pendingDelayMs: PENDING_DELAY
  });
  return { sched, clock, logIds, sink, ctrl };
}

/** Schedule + flush so that the session is fully started. */
function startTask(f: Fixtures, taskId: EntityId<"taskId">): void {
  f.ctrl.scheduleStart(taskId);
  f.sched.flushNext();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("1. scheduleStart creates exactly one scheduled callback", () => {
  it("registers one scheduler entry per task", () => {
    const { ctrl, sched } = makeFixtures();
    ctrl.scheduleStart(TASK_A);
    expect(sched.scheduledEntries).toHaveLength(1);
  });

  it("uses the configured pendingDelayMs", () => {
    const { ctrl, sched } = makeFixtures();
    ctrl.scheduleStart(TASK_A);
    expect(sched.scheduledEntries[0].delayMs).toBe(PENDING_DELAY);
  });
});

describe("2. Duplicate scheduleStart does not create a second callback", () => {
  it("calling scheduleStart twice for the same task registers only one entry", () => {
    const { ctrl, sched } = makeFixtures();
    ctrl.scheduleStart(TASK_A);
    ctrl.scheduleStart(TASK_A); // duplicate — must be ignored
    expect(sched.scheduledEntries).toHaveLength(1);
  });
});

describe("3. No action is emitted before scheduler execution", () => {
  it("sink receives nothing until flushNext is called", () => {
    const { ctrl, sink } = makeFixtures();
    ctrl.scheduleStart(TASK_A);
    expect(sink.dispatched).toHaveLength(0);
  });
});

describe("4. Scheduled execution emits processing-started", () => {
  it("first action after flush is processing-started", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    const first = f.sink.dispatched[0];
    expect(first?.type).toBe("processing-started");
  });
});

describe("5. Action order is deterministic", () => {
  it("processing-started precedes the initial log", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    expect(f.sink.dispatched[0]?.type).toBe("processing-started");
    expect(f.sink.dispatched[1]?.type).toBe("processing-log-appended");
  });
});

describe("6. Correct Task ID is preserved in emitted actions", () => {
  it("processing-started carries the exact taskId", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    const action = f.sink.dispatched.find((a) => a.type === "processing-started");
    expect((action as Extract<TaskCreationAction, { type: "processing-started" }>)?.taskId).toBe(TASK_A);
  });

  it("log-appended action carries the exact taskId", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    const logAction = f.sink.dispatched.find((a) => a.type === "processing-log-appended");
    expect((logAction as Extract<TaskCreationAction, { type: "processing-log-appended" }>)?.taskId).toBe(TASK_A);
  });
});

describe("7. startedAt comes from the injected clock", () => {
  it("processing-started.startedAt equals clock.now() at flush time", () => {
    const f = makeFixtures();
    f.clock.setTime("2026-06-24T12:34:56.789Z");
    f.ctrl.scheduleStart(TASK_A);
    f.sched.flushNext();
    const action = f.sink.dispatched.find((a) => a.type === "processing-started") as
      | Extract<TaskCreationAction, { type: "processing-started" }>
      | undefined;
    expect(action?.startedAt).toBe("2026-06-24T12:34:56.789Z");
  });
});

describe("8. Log ID comes from the injected identity source", () => {
  it("log id matches the sequence produced by FakeLogIdentitySource", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    const logAction = f.sink.dispatched.find((a) => a.type === "processing-log-appended") as
      | Extract<TaskCreationAction, { type: "processing-log-appended" }>
      | undefined;
    expect(logAction?.log.id).toBe("LOG-0001");
  });
});

describe("9. No raw lifecycle-status assignment in controller source", () => {
  const src = readFileSync(
    join(
      process.cwd(),
      "apps/frontend/src/features/task-orchestration/model/task-processing-controller.ts"
    ),
    "utf8"
  );

  it("does not contain .status = ", () => {
    expect(src).not.toMatch(/\.status\s*=/);
  });

  it("does not assign status strings directly", () => {
    const forbidden = ["\"pending\"", "\"in-progress\"", "\"completed\"", "\"failed\"", "\"canceled\"", "\"running\"", "\"queued\"", "\"succeeded\"", "\"cancelled\""];
    for (const val of forbidden) {
      // Allow it in string literals for log messages, but not as .status = "..."
      expect(src).not.toMatch(new RegExp(`\\.status\\s*=\\s*${val.replace(/"/g, '\\"')}`));
    }
  });
});

describe("10. advance before start callback fires throws TaskSessionNotFoundError", () => {
  it("throws when called before flush", () => {
    const { ctrl } = makeFixtures();
    ctrl.scheduleStart(TASK_A);
    expect(() => ctrl.advance(TASK_A)).toThrow(TaskSessionNotFoundError);
  });

  it("throws when no scheduleStart was called", () => {
    const { ctrl } = makeFixtures();
    expect(() => ctrl.advance(TASK_A)).toThrow(TaskSessionNotFoundError);
  });
});

describe("11. advance completes the active step", () => {
  it("emits processing-step-completed for the current active step", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    f.sink.dispatched.length = 0; // reset — focus on advance actions
    f.ctrl.advance(TASK_A);
    const completed = f.sink.dispatched.find((a) => a.type === "processing-step-completed") as
      | Extract<TaskCreationAction, { type: "processing-step-completed" }>
      | undefined;
    expect(completed?.stepId).toBe(ORDERED_STEP_IDS[0]);
  });
});

describe("12. A completion log is emitted after step completion", () => {
  it("processing-log-appended with level success follows step completion", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    f.sink.dispatched.length = 0;
    f.ctrl.advance(TASK_A);
    const completedIdx = f.sink.dispatched.findIndex((a) => a.type === "processing-step-completed");
    const logAfter = f.sink.dispatched[completedIdx + 1];
    expect(logAfter?.type).toBe("processing-log-appended");
    expect((logAfter as Extract<TaskCreationAction, { type: "processing-log-appended" }>).log.level).toBe("success");
  });
});

describe("13. The next step is activated", () => {
  it("emits processing-step-activated for the next step", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    f.sink.dispatched.length = 0;
    f.ctrl.advance(TASK_A);
    const activated = f.sink.dispatched.find((a) => a.type === "processing-step-activated") as
      | Extract<TaskCreationAction, { type: "processing-step-activated" }>
      | undefined;
    expect(activated?.stepId).toBe(ORDERED_STEP_IDS[1]);
  });
});

describe("14. The activation log follows the completion log", () => {
  it("activation-log action is emitted after the activation action", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    f.sink.dispatched.length = 0;
    f.ctrl.advance(TASK_A);
    const activatedIdx = f.sink.dispatched.findIndex((a) => a.type === "processing-step-activated");
    expect(activatedIdx).toBeGreaterThan(-1);
    const logAfter = f.sink.dispatched[activatedIdx + 1];
    expect(logAfter?.type).toBe("processing-log-appended");
    expect((logAfter as Extract<TaskCreationAction, { type: "processing-log-appended" }>).log.level).toBe("info");
  });
});

describe("15. No processing step is skipped across a full advance sequence", () => {
  it("each ORDERED_STEP_ID appears exactly once as completed", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);

    // Drive through all steps; the last advance() will not throw
    // but the one beyond the last will throw TaskFinalStepBoundaryError.
    for (let i = 0; i < ORDERED_STEP_IDS.length - 1; i++) {
      f.ctrl.advance(TASK_A);
    }
    // Final step — no succeeded emitted
    expect(() => f.ctrl.advance(TASK_A)).not.toThrow(Error);

    // Beyond boundary
    expect(() => f.ctrl.advance(TASK_A)).toThrow(TaskFinalStepBoundaryError);

    const completedStepIds = f.sink.dispatched
      .filter((a) => a.type === "processing-step-completed")
      .map((a) => (a as Extract<TaskCreationAction, { type: "processing-step-completed" }>).stepId);

    expect(completedStepIds).toEqual([...ORDERED_STEP_IDS]);
  });
});

describe("16. No duplicate active step per advance call", () => {
  it("each advance emits exactly one processing-step-activated (except the last step)", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);

    for (let i = 0; i < ORDERED_STEP_IDS.length - 1; i++) {
      f.sink.dispatched.length = 0;
      f.ctrl.advance(TASK_A);
      const activations = f.sink.dispatched.filter((a) => a.type === "processing-step-activated");
      expect(activations).toHaveLength(1);
    }
  });

  it("advancing past the last step emits zero activations", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    // Advance through all but the last
    for (let i = 0; i < ORDERED_STEP_IDS.length - 1; i++) {
      f.ctrl.advance(TASK_A);
    }
    f.sink.dispatched.length = 0;
    // Final advance — no next step to activate
    f.ctrl.advance(TASK_A);
    const activations = f.sink.dispatched.filter((a) => a.type === "processing-step-activated");
    expect(activations).toHaveLength(0);
  });
});

describe("17. Completed steps are not reactivated", () => {
  it("processing-step-activated for validate-input never appears after first advance", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    // advance through all steps
    for (let i = 0; i < ORDERED_STEP_IDS.length; i++) {
      try { f.ctrl.advance(TASK_A); } catch { break; }
    }
    const reactivations = f.sink.dispatched
      .filter((a) => a.type === "processing-step-activated")
      .filter((a) => (a as Extract<TaskCreationAction, { type: "processing-step-activated" }>).stepId === "validate-input");
    expect(reactivations).toHaveLength(0);
  });
});

describe("18. Final-step boundary does not emit succeeded", () => {
  it("no succeeded action is ever dispatched", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    for (let i = 0; i <= ORDERED_STEP_IDS.length; i++) {
      try { f.ctrl.advance(TASK_A); } catch { /* boundary */ }
    }
    const succeeded = f.sink.dispatched.filter((a) => a.type === "task-created" && false);
    // More precisely: there is no known action type "succeeded" in TaskCreationAction.
    // Verify that none of the dispatched actions contain status="succeeded".
    const hasSuc = f.sink.dispatched.some(
      (a) => JSON.stringify(a).includes("succeeded")
    );
    expect(hasSuc).toBe(false);
  });
});

describe("19. No completed result is created at final-step boundary", () => {
  it("no finalResult or completedAt field appears in dispatched actions", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    for (let i = 0; i <= ORDERED_STEP_IDS.length; i++) {
      try { f.ctrl.advance(TASK_A); } catch { /* boundary */ }
    }
    const hasResult = f.sink.dispatched.some(
      (a) => JSON.stringify(a).includes("finalResult")
    );
    expect(hasResult).toBe(false);
  });
});

describe("20. No failed or cancelled transition is emitted by advance", () => {
  it("no failed or cancelled status appears in dispatched actions", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    for (let i = 0; i <= ORDERED_STEP_IDS.length; i++) {
      try { f.ctrl.advance(TASK_A); } catch { /* boundary */ }
    }
    const raw = JSON.stringify(f.sink.dispatched);
    // 'failed' and 'cancelled'/'canceled' must not appear as status transitions
    expect(raw).not.toMatch(/"status"\s*:\s*"failed"/);
    expect(raw).not.toMatch(/"status"\s*:\s*"cancelled"/);
    expect(raw).not.toMatch(/"status"\s*:\s*"canceled"/);
  });
});

describe("21. stop cancels a pending start schedule", () => {
  it("marks the scheduled entry as cancelled", () => {
    const f = makeFixtures();
    f.ctrl.scheduleStart(TASK_A);
    f.ctrl.stop(TASK_A);
    expect(f.sched.scheduledEntries[0].cancelled).toBe(true);
  });

  it("callback does not emit any action after stop", () => {
    const f = makeFixtures();
    f.ctrl.scheduleStart(TASK_A);
    f.ctrl.stop(TASK_A);
    // Try to flush (the entry is cancelled — flushNext would throw, which is expected)
    expect(f.sched.pendingCount).toBe(0);
    expect(f.sink.dispatched).toHaveLength(0);
  });
});

describe("22. stop emits no cancellation transition", () => {
  it("no cancelled/canceled action is dispatched by stop", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    f.ctrl.stop(TASK_A);
    const raw = JSON.stringify(f.sink.dispatched);
    expect(raw).not.toMatch(/"cancelled"/);
    expect(raw).not.toMatch(/"canceled"/);
  });
});

describe("23. stop is safe for an unknown task", () => {
  it("calling stop for a non-existent task does not throw", () => {
    const { ctrl } = makeFixtures();
    expect(() => ctrl.stop("TASK-UNKNOWN" as EntityId<"taskId">)).not.toThrow();
  });
});

describe("24. dispose cancels every pending schedule handle", () => {
  it("all pending entries are marked cancelled after dispose", () => {
    const f = makeFixtures();
    f.ctrl.scheduleStart(TASK_A);
    f.ctrl.scheduleStart(TASK_B);
    f.ctrl.dispose();
    expect(f.sched.scheduledEntries.every((e) => e.cancelled)).toBe(true);
  });
});

describe("25. dispose is idempotent", () => {
  it("calling dispose twice does not throw", () => {
    const { ctrl } = makeFixtures();
    ctrl.scheduleStart(TASK_A);
    expect(() => { ctrl.dispose(); ctrl.dispose(); }).not.toThrow();
  });
});

describe("26. Two tasks have independent controller sessions", () => {
  it("starting TASK_A does not affect TASK_B session", () => {
    const f = makeFixtures();
    f.ctrl.scheduleStart(TASK_A);
    f.ctrl.scheduleStart(TASK_B);
    // Flush only TASK_A
    f.sched.flushNext();
    const aStarted = f.sink.dispatched.some(
      (a) =>
        a.type === "processing-started" &&
        (a as Extract<TaskCreationAction, { type: "processing-started" }>).taskId === TASK_A
    );
    const bStarted = f.sink.dispatched.some(
      (a) =>
        a.type === "processing-started" &&
        (a as Extract<TaskCreationAction, { type: "processing-started" }>).taskId === TASK_B
    );
    expect(aStarted).toBe(true);
    expect(bStarted).toBe(false);
  });

  it("advancing TASK_A does not emit actions for TASK_B", () => {
    const f = makeFixtures();
    startTask(f, TASK_A);
    startTask(f, TASK_B);
    f.sink.dispatched.length = 0;
    f.ctrl.advance(TASK_A);
    const bActions = f.sink.dispatched.filter(
      (a) => "taskId" in a && (a as { taskId: string }).taskId === (TASK_B as string)
    );
    expect(bActions).toHaveLength(0);
  });
});

describe("27. Failure from the action sink is propagated", () => {
  it("throws when the sink throws during the scheduled callback", () => {
    const f = makeFixtures();
    f.sink.shouldThrow = true;
    f.ctrl.scheduleStart(TASK_A);
    expect(() => f.sched.flushNext()).toThrow("Simulated sink failure.");
  });

  it("throws when the sink throws during advance", () => {
    const f = makeFixtures();
    f.ctrl.scheduleStart(TASK_A);
    f.sink.shouldThrow = false;
    f.sched.flushNext();
    f.sink.shouldThrow = true;
    expect(() => f.ctrl.advance(TASK_A)).toThrow("Simulated sink failure.");
  });
});

describe("28. Controller does not mutate caller-owned inputs", () => {
  it("options object is not mutated by the controller", () => {
    const sched = new FakeTaskProcessingScheduler();
    const clock = new FakeClock();
    const logIds = new FakeLogIdentitySource();
    const sink = new FakeActionSink();
    const opts = {
      scheduler: sched,
      clock,
      logIdentitySource: logIds,
      actionSink: sink,
      pendingDelayMs: 100
    };
    const before = { ...opts };
    createTaskProcessingController(opts);
    expect(opts.pendingDelayMs).toBe(before.pendingDelayMs);
    expect(opts.scheduler).toBe(before.scheduler);
  });
});

describe("29. No global time, random, or timer usage in controller source", () => {
  const src = readFileSync(
    join(
      process.cwd(),
      "apps/frontend/src/features/task-orchestration/model/task-processing-controller.ts"
    ),
    "utf8"
  );

  it("does not call Date.now()", () => { expect(src).not.toMatch(/\bDate\.now\b/); });
  it("does not call new Date()", () => { expect(src).not.toMatch(/\bnew Date\b/); });
  it("does not call Math.random()", () => { expect(src).not.toMatch(/\bMath\.random\b/); });
  it("does not call crypto.randomUUID()", () => { expect(src).not.toMatch(/\bcrypto\.randomUUID\b/); });
  it("does not call global setTimeout()", () => { expect(src).not.toMatch(/\bsetTimeout\b/); });
  it("does not call global setInterval()", () => { expect(src).not.toMatch(/\bsetInterval\b/); });
});

describe("30. No React, backend, Prisma, or private-module imports in controller source", () => {
  const src = readFileSync(
    join(
      process.cwd(),
      "apps/frontend/src/features/task-orchestration/model/task-processing-controller.ts"
    ),
    "utf8"
  );

  it("does not import react", () => { expect(src).not.toMatch(/from "react"/); });
  it("does not import @vcp/backend", () => { expect(src).not.toMatch(/@vcp\/backend/); });
  it("does not import @vcp/database", () => { expect(src).not.toMatch(/@vcp\/database/); });
  it("does not import Prisma", () => { expect(src).not.toMatch(/Prisma/); });
  it("does not import private agent-management files", () => { expect(src).not.toMatch(/modules\/agent-management/); });
  it("does not import private workflow-management files", () => { expect(src).not.toMatch(/modules\/workflow-management/); });
});
