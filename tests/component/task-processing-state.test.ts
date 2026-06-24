/**
 * task-processing-state.test.ts
 *
 * Permanent tests for the Task & Orchestration processing-lifecycle model
 * (Task 7A — Processing Lifecycle Model Foundation).
 *
 * Coverage:
 *  1.  Initial snapshot contains all approved steps in waiting state.
 *  2.  Starting a queued Task changes canonical status to running.
 *  3.  Starting processing initialises startedAt.
 *  4.  Task identity, Work identity, prompt, and routing are preserved.
 *  5.  Starting twice is rejected.
 *  6.  Missing Task ID is rejected (reducer ignores unknown taskId).
 *  7.  Terminal Task cannot start.
 *  8.  Only one step is active at a time.
 *  9.  Step activation follows the approved order.
 * 10.  Completed step cannot regress.
 * 11.  Completing a non-active step is rejected.
 * 12.  Logs append immutably.
 * 13.  Duplicate log IDs are rejected.
 * 14.  Unknown step IDs are rejected.
 * 15.  Existing state objects and arrays are not mutated.
 * 16.  No Date, random, timer, backend, Prisma, or private-module dependency.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  INITIAL_PROCESSING_STEPS,
  initialTaskCreationState,
  taskCreationReducer
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import {
  activateNextStep,
  appendProcessingLog,
  completeActiveStep,
  createInitialProcessingSnapshot,
  ORDERED_STEP_IDS,
  startProcessing
} from "@vcp/frontend/features/task-orchestration/model/task-processing.ts";
import type { ProcessingSnapshot } from "@vcp/frontend/features/task-orchestration/model/task-processing.ts";
import type { TaskLog } from "@vcp/frontend/features/task-orchestration/model/task-types.ts";
import type { EntityId } from "@vcp/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_TS = "2026-06-24T12:00:00.000Z";
const FIXED_TS2 = "2026-06-24T12:00:01.000Z";

const TASK_ID = "TASK-000001" as EntityId<"taskId">;
const WORK_ID = "WORK-000001" as EntityId<"workId">;

/** Build a queued CreatedTaskRecord via the reducer. */
function makeQueuedState() {
  return taskCreationReducer(initialTaskCreationState, {
    type: "task-created",
    request: { prompt: "Test task", routing: { mode: "auto" } },
    response: {
      taskId: TASK_ID,
      workId: WORK_ID,
      status: "queued",
      createdAt: FIXED_TS
    }
  });
}

/** Start processing on the queued task (via reducer). */
function makeRunningState() {
  return taskCreationReducer(makeQueuedState(), {
    type: "processing-started",
    taskId: TASK_ID,
    startedAt: FIXED_TS
  });
}

/** Convenience: build a fresh initial ProcessingSnapshot. */
function freshSnapshot(): ProcessingSnapshot {
  return createInitialProcessingSnapshot(INITIAL_PROCESSING_STEPS);
}

/** Convenience: build a started ProcessingSnapshot (first step active). */
function startedSnapshot(): ProcessingSnapshot {
  const result = startProcessing(freshSnapshot(), FIXED_TS);
  if (!result.ok) throw new Error("Expected ok: true in startedSnapshot");
  return result.snapshot;
}

// ---------------------------------------------------------------------------
// 1. Initial snapshot contains all approved steps in waiting state
// ---------------------------------------------------------------------------
describe("1. createInitialProcessingSnapshot", () => {
  it("contains all six approved steps in waiting state", () => {
    const snap = freshSnapshot();

    expect(snap.steps).toHaveLength(6);
    expect(snap.steps.map((s) => s.id)).toEqual([...ORDERED_STEP_IDS]);
    expect(snap.steps.every((s) => s.status === "waiting")).toBe(true);
  });

  it("has no logs and no startedAt initially", () => {
    const snap = freshSnapshot();

    expect(snap.startedAt).toBeUndefined();
    expect(snap.logs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Starting a queued Task changes canonical status to running
// ---------------------------------------------------------------------------
describe("2. queued → running canonical status transition", () => {
  it("changes status from queued to running via reducer", () => {
    const state = makeRunningState();
    const task = state.tasks.find((t) => t.taskId === TASK_ID);

    expect(task?.status).toBe("running");
  });
});

// ---------------------------------------------------------------------------
// 3. Starting processing initialises startedAt
// ---------------------------------------------------------------------------
describe("3. startProcessing initialises startedAt", () => {
  it("sets startedAt to the supplied timestamp", () => {
    const snap = startedSnapshot();

    expect(snap.startedAt).toBe(FIXED_TS);
  });

  it("activates the first step (validate-input) on start", () => {
    const snap = startedSnapshot();
    const first = snap.steps.find((s) => s.id === "validate-input");

    expect(first?.status).toBe("active");
    expect(snap.steps.filter((s) => s.status === "active")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Task identity, Work identity, prompt, and routing are preserved
// ---------------------------------------------------------------------------
describe("4. Task identity and routing preserved after processing starts", () => {
  it("preserves taskId, workId, prompt, routing, and createdAt", () => {
    const state = makeRunningState();
    const task = state.tasks.find((t) => t.taskId === TASK_ID);

    expect(task?.taskId).toBe(TASK_ID);
    expect(task?.workId).toBe(WORK_ID);
    expect(task?.prompt).toBe("Test task");
    expect(task?.requestedRouting).toEqual({ mode: "auto" });
    expect(task?.createdAt).toBe(FIXED_TS);
  });
});

// ---------------------------------------------------------------------------
// 5. Starting twice is rejected
// ---------------------------------------------------------------------------
describe("5. duplicate start is rejected", () => {
  it("returns the same state when processing-started is dispatched twice", () => {
    const once = makeRunningState();
    const twice = taskCreationReducer(once, {
      type: "processing-started",
      taskId: TASK_ID,
      startedAt: FIXED_TS2
    });

    // State reference should be identical (no change)
    const taskOnce = once.tasks.find((t) => t.taskId === TASK_ID);
    const taskTwice = twice.tasks.find((t) => t.taskId === TASK_ID);

    expect(taskTwice?.processingSnapshot?.startedAt).toBe(FIXED_TS);
    expect(taskOnce?.status).toBe("running");
    expect(taskTwice?.status).toBe("running");
  });

  it("startProcessing pure function rejects already-started snapshot", () => {
    const snap = startedSnapshot();
    const result = startProcessing(snap, FIXED_TS2);

    expect(result.ok).toBe(false);
    expect(result.snapshot.startedAt).toBe(FIXED_TS); // unchanged
  });
});

// ---------------------------------------------------------------------------
// 6. Missing Task ID is rejected (reducer returns unchanged state)
// ---------------------------------------------------------------------------
describe("6. missing Task ID is rejected", () => {
  it("reducer returns unchanged state for unknown taskId", () => {
    const state = makeQueuedState();
    const unknown = "TASK-999999" as EntityId<"taskId">;
    const next = taskCreationReducer(state, {
      type: "processing-started",
      taskId: unknown,
      startedAt: FIXED_TS
    });

    expect(next).toStrictEqual(state);
  });
});

// ---------------------------------------------------------------------------
// 7. Terminal Task cannot start
// ---------------------------------------------------------------------------
describe("7. terminal Task cannot start processing", () => {
  const terminalStatuses = ["succeeded", "failed", "cancelled"] as const;

  it.each(terminalStatuses)(
    "rejects processing-started for %s task",
    (terminalStatus) => {
      // Craft state directly with a terminal status
      const queued = makeQueuedState();
      const task = queued.tasks[0];
      const terminalTask = { ...task, status: terminalStatus as typeof task.status };
      const terminalState = {
        ...queued,
        tasks: [terminalTask]
      };

      const next = taskCreationReducer(terminalState, {
        type: "processing-started",
        taskId: TASK_ID,
        startedAt: FIXED_TS
      });

      const resultTask = next.tasks.find((t) => t.taskId === TASK_ID);
      expect(resultTask?.status).toBe(terminalStatus);
      expect(resultTask?.processingSnapshot).toBeUndefined();
    }
  );
});

// ---------------------------------------------------------------------------
// 8. Only one step is active at a time
// ---------------------------------------------------------------------------
describe("8. only one step active at a time", () => {
  it("exactly one step is active after startProcessing", () => {
    const snap = startedSnapshot();
    const activeSteps = snap.steps.filter((s) => s.status === "active");

    expect(activeSteps).toHaveLength(1);
  });

  it("activateNextStep rejects when another step is still active", () => {
    const snap = startedSnapshot(); // validate-input is active

    // Try to activate analyze-request without completing validate-input
    const result = activateNextStep(snap, "analyze-request");

    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. Step activation follows the approved order
// ---------------------------------------------------------------------------
describe("9. step activation follows approved order", () => {
  it("cannot activate analyze-request before validate-input is completed", () => {
    const snap = startedSnapshot(); // validate-input active

    const result = activateNextStep(snap, "analyze-request");

    expect(result.ok).toBe(false);
  });

  it("can activate analyze-request after validate-input is completed", () => {
    const snap = startedSnapshot();
    const completed = completeActiveStep(snap, "validate-input", FIXED_TS2);
    if (!completed.ok) throw new Error("Expected ok");

    const activated = activateNextStep(completed.snapshot, "analyze-request");

    expect(activated.ok).toBe(true);
    if (activated.ok) {
      const step = activated.snapshot.steps.find(
        (s) => s.id === "analyze-request"
      );
      expect(step?.status).toBe("active");
    }
  });

  it("steps activate in the full approved order", () => {
    let snap = startedSnapshot(); // validate-input is active

    for (let i = 0; i < ORDERED_STEP_IDS.length; i++) {
      const stepId = ORDERED_STEP_IDS[i];
      const activeStep = snap.steps.find((s) => s.status === "active");
      expect(activeStep?.id).toBe(stepId);

      const completed = completeActiveStep(snap, stepId, FIXED_TS2);
      if (!completed.ok) throw new Error(`Cannot complete step ${stepId}`);
      snap = completed.snapshot;

      if (i + 1 < ORDERED_STEP_IDS.length) {
        const nextId = ORDERED_STEP_IDS[i + 1];
        const activated = activateNextStep(snap, nextId);
        if (!activated.ok) throw new Error(`Cannot activate step ${nextId}`);
        snap = activated.snapshot;
      }
    }

    expect(snap.steps.every((s) => s.status === "completed")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. Completed step cannot regress
// ---------------------------------------------------------------------------
describe("10. completed step cannot regress", () => {
  it("cannot activate a completed step", () => {
    const snap = startedSnapshot();
    const afterComplete = completeActiveStep(snap, "validate-input", FIXED_TS2);
    if (!afterComplete.ok) throw new Error("Expected ok");

    const result = activateNextStep(afterComplete.snapshot, "validate-input");

    expect(result.ok).toBe(false);
  });

  it("original snapshot is unchanged after failed activation", () => {
    const snap = startedSnapshot();
    const after = completeActiveStep(snap, "validate-input", FIXED_TS2);
    if (!after.ok) throw new Error("Expected ok");
    const snapBefore = after.snapshot;

    activateNextStep(snapBefore, "validate-input");

    const step = snapBefore.steps.find((s) => s.id === "validate-input");
    expect(step?.status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// 11. Completing a non-active step is rejected
// ---------------------------------------------------------------------------
describe("11. completing a non-active step is rejected", () => {
  it("returns ok: false when completing a waiting step", () => {
    const snap = startedSnapshot(); // validate-input is active

    const result = completeActiveStep(snap, "analyze-request", FIXED_TS);

    expect(result.ok).toBe(false);
    expect(result.snapshot).toBe(snap); // no mutation, same ref
  });

  it("returns ok: false when completing an already-completed step", () => {
    const snap = startedSnapshot();
    const after = completeActiveStep(snap, "validate-input", FIXED_TS2);
    if (!after.ok) throw new Error("Expected ok");

    const result = completeActiveStep(after.snapshot, "validate-input", FIXED_TS2);

    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 12. Logs append immutably
// ---------------------------------------------------------------------------
describe("12. logs append immutably", () => {
  const sampleLog: TaskLog = {
    id: "log-001",
    timestamp: FIXED_TS,
    level: "info",
    stepId: "validate-input",
    message: "Validating prompt."
  };

  it("appends a log and returns a new snapshot reference", () => {
    const snap = startedSnapshot();
    const result = appendProcessingLog(snap, sampleLog);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.logs).toHaveLength(1);
      expect(result.snapshot.logs[0]).toEqual(sampleLog);
      // original is untouched
      expect(snap.logs).toHaveLength(0);
    }
  });

  it("appending two different logs preserves order", () => {
    const log2: TaskLog = {
      id: "log-002",
      timestamp: FIXED_TS2,
      level: "success",
      stepId: "validate-input",
      message: "Validation complete."
    };

    let snap = startedSnapshot();
    const r1 = appendProcessingLog(snap, sampleLog);
    if (!r1.ok) throw new Error("Expected ok");
    snap = r1.snapshot;
    const r2 = appendProcessingLog(snap, log2);
    if (!r2.ok) throw new Error("Expected ok");

    expect(r2.snapshot.logs.map((l) => l.id)).toEqual(["log-001", "log-002"]);
  });
});

// ---------------------------------------------------------------------------
// 13. Duplicate log IDs are rejected
// ---------------------------------------------------------------------------
describe("13. duplicate log IDs are rejected", () => {
  it("returns ok: false for a repeated log id", () => {
    const log: TaskLog = {
      id: "log-dup",
      timestamp: FIXED_TS,
      level: "info",
      stepId: "validate-input",
      message: "First"
    };

    let snap = startedSnapshot();
    const r1 = appendProcessingLog(snap, log);
    if (!r1.ok) throw new Error("Expected ok");
    snap = r1.snapshot;

    const r2 = appendProcessingLog(snap, { ...log, message: "Second" });

    expect(r2.ok).toBe(false);
    expect(snap.logs).toHaveLength(1); // unchanged
  });
});

// ---------------------------------------------------------------------------
// 14. Unknown step IDs are rejected
// ---------------------------------------------------------------------------
describe("14. unknown step IDs are rejected", () => {
  it("activateNextStep returns ok: false for an unknown step ID", () => {
    const snap = startedSnapshot();
    const result = activateNextStep(snap, "nonexistent-step");

    expect(result.ok).toBe(false);
  });

  it("completeActiveStep returns ok: false for an unknown step ID", () => {
    const snap = startedSnapshot();
    const result = completeActiveStep(snap, "ghost-step", FIXED_TS);

    expect(result.ok).toBe(false);
  });

  it("appendProcessingLog rejects log with unknown stepId", () => {
    const snap = startedSnapshot();
    const result = appendProcessingLog(snap, {
      id: "log-bad",
      timestamp: FIXED_TS,
      level: "info",
      stepId: "unknown-step",
      message: "Bad log"
    });

    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 15. Existing state objects and arrays are not mutated
// ---------------------------------------------------------------------------
describe("15. immutability — input objects and arrays are not mutated", () => {
  it("startProcessing does not mutate the input snapshot", () => {
    const snap = freshSnapshot();
    const originalSteps = snap.steps.map((s) => ({ ...s }));

    startProcessing(snap, FIXED_TS);

    expect(snap.startedAt).toBeUndefined();
    expect(snap.steps).toEqual(originalSteps);
    expect(snap.logs).toHaveLength(0);
  });

  it("activateNextStep does not mutate the input snapshot", () => {
    // Build a snapshot where validate-input is completed and analyze-request is waiting
    const base = startedSnapshot();
    const afterComplete = completeActiveStep(base, "validate-input", FIXED_TS2);
    if (!afterComplete.ok) throw new Error("Expected ok");
    const snap = afterComplete.snapshot;
    const stepsBefore = snap.steps.map((s) => ({ ...s }));

    activateNextStep(snap, "analyze-request");

    expect(snap.steps).toEqual(stepsBefore);
  });

  it("completeActiveStep does not mutate the input snapshot", () => {
    const snap = startedSnapshot();
    const stepsBefore = snap.steps.map((s) => ({ ...s }));

    completeActiveStep(snap, "validate-input", FIXED_TS);

    expect(snap.steps).toEqual(stepsBefore);
  });

  it("appendProcessingLog does not mutate the input snapshot's logs array", () => {
    const snap = startedSnapshot();
    const logsBefore = [...snap.logs];

    appendProcessingLog(snap, {
      id: "log-mut",
      timestamp: FIXED_TS,
      level: "info",
      stepId: "validate-input",
      message: "Test"
    });

    expect(snap.logs).toEqual(logsBefore);
  });

  it("reducer does not mutate the input tasks array", () => {
    const state = makeQueuedState();
    const tasksBefore = state.tasks.map((t) => ({ ...t }));

    taskCreationReducer(state, {
      type: "processing-started",
      taskId: TASK_ID,
      startedAt: FIXED_TS
    });

    expect(state.tasks).toEqual(tasksBefore);
  });
});

// ---------------------------------------------------------------------------
// 16. No Date, random, timer, backend, Prisma, or private-module dependency
// ---------------------------------------------------------------------------
describe("16. static dependency audit — no forbidden imports", () => {
  const root = process.cwd();

  const modelFiles = [
    "apps/frontend/src/features/task-orchestration/model/task-processing.ts",
    "apps/frontend/src/features/task-orchestration/model/task-creation-state.ts",
    "apps/frontend/src/features/task-orchestration/model/task-lifecycle.ts"
  ];

  it.each(modelFiles)(
    "file %s does not import backend, database, Prisma, or private modules",
    (file) => {
      const source = readFileSync(join(root, file), "utf8");

      expect(source).not.toMatch(/@vcp\/backend/);
      expect(source).not.toMatch(/@vcp\/database/);
      expect(source).not.toMatch(/Prisma/);
      expect(source).not.toMatch(/modules\/agent-management/);
      expect(source).not.toMatch(/modules\/workflow-management/);
    }
  );

  it("task-processing.ts does not use global Date, Math.random, setTimeout, or setInterval", () => {
    const source = readFileSync(
      join(
        root,
        "apps/frontend/src/features/task-orchestration/model/task-processing.ts"
      ),
      "utf8"
    );

    expect(source).not.toMatch(/\bnew Date\b/);
    expect(source).not.toMatch(/\bDate\.now\b/);
    expect(source).not.toMatch(/\bMath\.random\b/);
    expect(source).not.toMatch(/\bsetTimeout\b/);
    expect(source).not.toMatch(/\bsetInterval\b/);
    expect(source).not.toMatch(/\buseState\b/);
    expect(source).not.toMatch(/\buseEffect\b/);
    expect(source).not.toMatch(/\buseReducer\b/);
    expect(source).not.toMatch(/from "react"/);
  });
});
