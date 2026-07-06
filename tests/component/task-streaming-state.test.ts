/**
 * task-streaming-state.test.ts
 *
 * Permanent tests for the Task & Orchestration partial-result streaming model
 * (Task 9A — Partial Result Model Foundation).
 *
 * Coverage (20 cases):
 *  1.  New task has streaming phase idle.
 *  2.  Initial fragments are empty.
 *  3.  streaming-started only applies when task is running.
 *  4.  startedAt comes from the action.
 *  5.  Start does not change lifecycle status.
 *  6.  Duplicate start is rejected.
 *  7.  First fragment append succeeds.
 *  8.  Next fragment append uses correct sequence.
 *  9.  Existing fragments are preserved.
 * 10.  Input objects are not mutated.
 * 11.  Skipped sequence is rejected.
 * 12.  Duplicate fragment ID is rejected.
 * 13.  Append rejected when phase is not streaming.
 * 14.  Append rejected for terminal task.
 * 15.  Exhaust transitions phase to exhausted.
 * 16.  Exhaust preserves fragments.
 * 17.  Exhaust does not create completed result.
 * 18.  Exhaust does not transition task to succeeded.
 * 19.  Selector joins partial text in order.
 * 20.  Two tasks have independent streaming snapshots.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import type { EntityId } from "@vcp/shared";
import {
  initialTaskCreationState,
  taskCreationReducer
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import {
  appendStreamingFragment,
  createInitialStreamingSnapshot,
  exhaustStreaming,
  INITIAL_STREAMING_SEQUENCE,
  selectAccumulatedPartialText,
  startStreaming
} from "@vcp/frontend/features/task-orchestration/model/task-streaming.ts";
import type { TaskStreamingSnapshot } from "@vcp/frontend/features/task-orchestration/model/task-streaming.ts";
import { transitionTaskStatus } from "@vcp/frontend/features/task-orchestration/model/task-lifecycle.ts";

const FIXED_TS = "2026-06-24T12:00:00.000Z";
const FIXED_TS2 = "2026-06-24T12:00:01.000Z";
const FIXED_TS3 = "2026-06-24T12:00:02.000Z";

const TASK_A = "TASK-000001" as EntityId<"taskId">;
const TASK_B = "TASK-000002" as EntityId<"taskId">;
const WORK_A = "WORK-000001" as EntityId<"workId">;
const WORK_B = "WORK-000002" as EntityId<"workId">;

function makeQueuedState(taskId = TASK_A, workId = WORK_A) {
  return taskCreationReducer(initialTaskCreationState, {
    type: "task-created",
    request: { prompt: "Test task", routing: { mode: "auto" } },
    response: {
      taskId,
      workId,
      status: "queued",
      createdAt: FIXED_TS
    }
  });
}

function makeRunningState(taskId = TASK_A) {
  return taskCreationReducer(makeQueuedState(taskId), {
    type: "processing-started",
    taskId,
    startedAt: FIXED_TS
  });
}

function makeStreamingState(taskId = TASK_A) {
  return taskCreationReducer(makeRunningState(taskId), {
    type: "streaming-started",
    taskId,
    startedAt: FIXED_TS2
  });
}

function freshSnapshot(): TaskStreamingSnapshot {
  return createInitialStreamingSnapshot();
}

function streamingSnapshot(): TaskStreamingSnapshot {
  const result = startStreaming(freshSnapshot(), FIXED_TS2);
  if (!result.ok) throw new Error("Expected ok in streamingSnapshot");
  return result.snapshot;
}

describe("1. new task has streaming phase idle", () => {
  it("initialises streamingSnapshot with idle phase", () => {
    const state = makeQueuedState();
    const task = state.tasks.find((t) => t.taskId === TASK_A);

    expect(task?.streamingSnapshot.phase).toBe("idle");
  });
});

describe("2. initial fragments are empty", () => {
  it("starts with no fragments", () => {
    const state = makeQueuedState();
    const task = state.tasks.find((t) => t.taskId === TASK_A);

    expect(task?.streamingSnapshot.fragments).toHaveLength(0);
    expect(task?.streamingSnapshot.startedAt).toBeNull();
    expect(task?.streamingSnapshot.exhaustedAt).toBeNull();
  });
});

describe("3. streaming-started only applies when task is running", () => {
  it("rejects streaming-started for queued task", () => {
    const state = makeQueuedState();
    const next = taskCreationReducer(state, {
      type: "streaming-started",
      taskId: TASK_A,
      startedAt: FIXED_TS2
    });

    const task = next.tasks.find((t) => t.taskId === TASK_A);
    expect(task?.streamingSnapshot.phase).toBe("idle");
  });
});

describe("4. startedAt comes from the action", () => {
  it("sets startedAt from streaming-started payload", () => {
    const state = makeStreamingState();
    const task = state.tasks.find((t) => t.taskId === TASK_A);

    expect(task?.streamingSnapshot.startedAt).toBe(FIXED_TS2);
  });
});

describe("5. start does not change lifecycle status", () => {
  it("keeps canonical status running after streaming-started", () => {
    const state = makeStreamingState();
    const task = state.tasks.find((t) => t.taskId === TASK_A);

    expect(task?.status).toBe("running");
  });
});

describe("6. duplicate start is rejected", () => {
  it("ignores second streaming-started for same task", () => {
    const once = makeStreamingState();
    const twice = taskCreationReducer(once, {
      type: "streaming-started",
      taskId: TASK_A,
      startedAt: FIXED_TS3
    });

    const task = twice.tasks.find((t) => t.taskId === TASK_A);
    expect(task?.streamingSnapshot.startedAt).toBe(FIXED_TS2);
    expect(task?.streamingSnapshot.phase).toBe("streaming");
  });

  it("startStreaming pure function rejects non-idle phase", () => {
    const snap = streamingSnapshot();
    const result = startStreaming(snap, FIXED_TS3);

    expect(result.ok).toBe(false);
    expect(result.snapshot.startedAt).toBe(FIXED_TS2);
  });
});

describe("7. first fragment append succeeds", () => {
  it("appends the first fragment via reducer", () => {
    const state = taskCreationReducer(makeStreamingState(), {
      type: "streaming-fragment-appended",
      taskId: TASK_A,
      fragmentId: "FRG-001",
      sequence: INITIAL_STREAMING_SEQUENCE,
      text: "Hello",
      appendedAt: FIXED_TS3
    });

    const task = state.tasks.find((t) => t.taskId === TASK_A);
    expect(task?.streamingSnapshot.fragments).toHaveLength(1);
    expect(task?.streamingSnapshot.fragments[0]?.text).toBe("Hello");
  });
});

describe("8. next fragment append uses correct sequence", () => {
  it("accepts sequence 2 after first fragment", () => {
    const withFirst = taskCreationReducer(makeStreamingState(), {
      type: "streaming-fragment-appended",
      taskId: TASK_A,
      fragmentId: "FRG-001",
      sequence: 1,
      text: "A",
      appendedAt: FIXED_TS2
    });

    const withSecond = taskCreationReducer(withFirst, {
      type: "streaming-fragment-appended",
      taskId: TASK_A,
      fragmentId: "FRG-002",
      sequence: 2,
      text: "B",
      appendedAt: FIXED_TS3
    });

    const task = withSecond.tasks.find((t) => t.taskId === TASK_A);
    expect(task?.streamingSnapshot.fragments).toHaveLength(2);
    expect(task?.streamingSnapshot.fragments[1]?.sequence).toBe(2);
  });
});

describe("9. existing fragments are preserved", () => {
  it("keeps prior fragments when appending", () => {
    const snap = streamingSnapshot();
    const first = appendStreamingFragment(snap, {
      id: "FRG-001",
      sequence: 1,
      text: "keep",
      appendedAt: FIXED_TS2
    });
    if (!first.ok) throw new Error("Expected first append ok");

    const second = appendStreamingFragment(first.snapshot, {
      id: "FRG-002",
      sequence: 2,
      text: "me",
      appendedAt: FIXED_TS3
    });
    if (!second.ok) throw new Error("Expected second append ok");

    expect(second.snapshot.fragments[0]?.text).toBe("keep");
    expect(second.snapshot.fragments[1]?.text).toBe("me");
  });
});

describe("10. input objects are not mutated", () => {
  it("does not mutate the input snapshot or fragments array", () => {
    const snap = streamingSnapshot();
    const originalFragments = snap.fragments;

    const result = appendStreamingFragment(snap, {
      id: "FRG-001",
      sequence: 1,
      text: "x",
      appendedAt: FIXED_TS2
    });

    expect(result.ok).toBe(true);
    expect(snap.fragments).toBe(originalFragments);
    expect(snap.fragments).toHaveLength(0);
    expect(result.snapshot.fragments).not.toBe(originalFragments);
  });
});

describe("11. skipped sequence is rejected", () => {
  it("rejects fragment with sequence 2 when none exist", () => {
    const snap = streamingSnapshot();
    const result = appendStreamingFragment(snap, {
      id: "FRG-002",
      sequence: 2,
      text: "skip",
      appendedAt: FIXED_TS2
    });

    expect(result.ok).toBe(false);
    expect(result.snapshot.fragments).toHaveLength(0);
  });
});

describe("12. duplicate fragment ID is rejected", () => {
  it("rejects duplicate fragment IDs", () => {
    const snap = streamingSnapshot();
    const first = appendStreamingFragment(snap, {
      id: "FRG-DUP",
      sequence: 1,
      text: "a",
      appendedAt: FIXED_TS2
    });
    if (!first.ok) throw new Error("Expected first append ok");

    const duplicate = appendStreamingFragment(first.snapshot, {
      id: "FRG-DUP",
      sequence: 2,
      text: "b",
      appendedAt: FIXED_TS3
    });

    expect(duplicate.ok).toBe(false);
    expect(duplicate.snapshot.fragments).toHaveLength(1);
  });
});

describe("13. append rejected when phase is not streaming", () => {
  it("rejects append in idle phase", () => {
    const state = makeRunningState();
    const next = taskCreationReducer(state, {
      type: "streaming-fragment-appended",
      taskId: TASK_A,
      fragmentId: "FRG-001",
      sequence: 1,
      text: "nope",
      appendedAt: FIXED_TS2
    });

    const task = next.tasks.find((t) => t.taskId === TASK_A);
    expect(task?.streamingSnapshot.fragments).toHaveLength(0);
  });
});

describe("14. append rejected for terminal task", () => {
  it("ignores append after task reaches succeeded", () => {
    const running = makeStreamingState();
    const task = running.tasks.find((t) => t.taskId === TASK_A);
    if (!task) throw new Error("Expected task");

    const succeeded = transitionTaskStatus(task, "succeeded");
    if (!succeeded.ok) throw new Error("Expected succeeded transition");

    const terminalState = {
      ...running,
      tasks: running.tasks.map((t) =>
        t.taskId === TASK_A ? succeeded.task : t
      )
    };

    const next = taskCreationReducer(terminalState, {
      type: "streaming-fragment-appended",
      taskId: TASK_A,
      fragmentId: "FRG-001",
      sequence: 1,
      text: "late",
      appendedAt: FIXED_TS3
    });

    const terminalTask = next.tasks.find((t) => t.taskId === TASK_A);
    expect(terminalTask?.streamingSnapshot.fragments).toHaveLength(0);
  });
});

describe("15. exhaust transitions phase to exhausted", () => {
  it("sets phase to exhausted via reducer", () => {
    const state = taskCreationReducer(makeStreamingState(), {
      type: "streaming-exhausted",
      taskId: TASK_A,
      exhaustedAt: FIXED_TS3
    });

    const task = state.tasks.find((t) => t.taskId === TASK_A);
    expect(task?.streamingSnapshot.phase).toBe("exhausted");
    expect(task?.streamingSnapshot.exhaustedAt).toBe(FIXED_TS3);
  });
});

describe("16. exhaust preserves fragments", () => {
  it("keeps all fragments after exhaust", () => {
    const withFragment = taskCreationReducer(makeStreamingState(), {
      type: "streaming-fragment-appended",
      taskId: TASK_A,
      fragmentId: "FRG-001",
      sequence: 1,
      text: "partial",
      appendedAt: FIXED_TS2
    });

    const exhausted = taskCreationReducer(withFragment, {
      type: "streaming-exhausted",
      taskId: TASK_A,
      exhaustedAt: FIXED_TS3
    });

    const task = exhausted.tasks.find((t) => t.taskId === TASK_A);
    expect(task?.streamingSnapshot.fragments).toHaveLength(1);
    expect(task?.streamingSnapshot.fragments[0]?.text).toBe("partial");
  });
});

describe("17. exhaust does not create completed result", () => {
  it("CreatedTaskRecord has no finalResult field after exhaust", () => {
    const state = taskCreationReducer(makeStreamingState(), {
      type: "streaming-exhausted",
      taskId: TASK_A,
      exhaustedAt: FIXED_TS3
    });

    const task = state.tasks.find((t) => t.taskId === TASK_A);
    expect(task).not.toHaveProperty("finalResult");
  });
});

describe("18. exhaust does not transition task to succeeded", () => {
  it("keeps canonical status running after exhaust", () => {
    const state = taskCreationReducer(makeStreamingState(), {
      type: "streaming-exhausted",
      taskId: TASK_A,
      exhaustedAt: FIXED_TS3
    });

    const task = state.tasks.find((t) => t.taskId === TASK_A);
    expect(task?.status).toBe("running");
  });
});

describe("19. selector joins partial text in order", () => {
  it("selectAccumulatedPartialText concatenates fragment text by sequence", () => {
    let snap = streamingSnapshot();
    const steps = ["Hello", " ", "world"];
    for (let i = 0; i < steps.length; i++) {
      const result = appendStreamingFragment(snap, {
        id: `FRG-${i + 1}`,
        sequence: i + 1,
        text: steps[i]!,
        appendedAt: FIXED_TS2
      });
      if (!result.ok) throw new Error("Expected append ok");
      snap = result.snapshot;
    }

    expect(selectAccumulatedPartialText(snap)).toBe("Hello world");
  });
});

describe("20. two tasks have independent streaming snapshots", () => {
  it("streaming on one task does not affect the other", () => {
    let state = makeQueuedState(TASK_A, WORK_A);
    state = taskCreationReducer(state, {
      type: "task-created",
      request: { prompt: "Task B", routing: { mode: "auto" } },
      response: {
        taskId: TASK_B,
        workId: WORK_B,
        status: "queued",
        createdAt: FIXED_TS
      }
    });

    state = taskCreationReducer(state, {
      type: "processing-started",
      taskId: TASK_A,
      startedAt: FIXED_TS
    });
    state = taskCreationReducer(state, {
      type: "processing-started",
      taskId: TASK_B,
      startedAt: FIXED_TS
    });

    state = taskCreationReducer(state, {
      type: "streaming-started",
      taskId: TASK_A,
      startedAt: FIXED_TS2
    });

    const taskA = state.tasks.find((t) => t.taskId === TASK_A);
    const taskB = state.tasks.find((t) => t.taskId === TASK_B);

    expect(taskA?.streamingSnapshot.phase).toBe("streaming");
    expect(taskB?.streamingSnapshot.phase).toBe("idle");
  });
});

describe("source invariants", () => {
  const sourcePath = join(
    process.cwd(),
    "apps/frontend/src/features/task-orchestration/model/task-streaming.ts"
  );

  it("does not use Date, random, timer, React, backend, or Prisma", () => {
    const source = readFileSync(sourcePath, "utf8");

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
