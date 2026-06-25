/**
 * task-failure-state.test.ts
 *
 * Permanent automated tests for the Task & Orchestration failure state model
 * (Task 13A-2 — Failure State Foundation Tests).
 *
 * Coverage:
 *  1. isFailureSimulationPrompt pure helper detection logic.
 *  2. Semantic task-failed action and reducer transitions.
 *  3. Deterministic TaskError properties and serializability.
 *  4. failActiveStep behavior and step status preservation.
 *  5. Data preservation (Task identity, logs, fragments, partial text).
 *  6. Terminal guards rejecting late updates after failure.
 */

import { describe, expect, it } from "vitest";
import type { EntityId } from "@vcp/shared";

import {
  initialTaskCreationState,
  taskCreationReducer,
  type TaskCreationAction
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import {
  failActiveStep,
  isFailureSimulationPrompt,
  ORDERED_STEP_IDS
} from "@vcp/frontend/features/task-orchestration/model/task-processing.ts";
import { selectAccumulatedPartialText } from "@vcp/frontend/features/task-orchestration/model/task-streaming.ts";
import type { TaskError } from "@vcp/frontend/features/task-orchestration/model/task-types.ts";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

const FIXED_TS = "2026-06-25T10:00:00.000Z";
const FIXED_TS2 = "2026-06-25T10:00:01.000Z";
const FIXED_TS3 = "2026-06-25T10:00:02.000Z";
const TASK_ID = "TASK-000001" as EntityId<"taskId">;
const TASK_ID_2 = "TASK-000002" as EntityId<"taskId">;
const WORK_ID = "WORK-000001" as EntityId<"workId">;
const WORK_ID_2 = "WORK-000002" as EntityId<"workId">;

const sampleError: TaskError = {
  code: "MOCK_AGGREGATION_FAILED",
  stepId: "aggregate-result",
  title: "Không thể tổng hợp kết quả",
  message: "Quá trình tổng hợp kết quả đã được mô phỏng là thất bại.",
  occurredAt: FIXED_TS2
};

/** Helper to create two queued tasks in state. */
function makeQueuedState() {
  let s = taskCreationReducer(initialTaskCreationState, {
    type: "task-created",
    request: { prompt: "FAIL_SIMULATION: test request", routing: { mode: "auto" } },
    response: { taskId: TASK_ID, workId: WORK_ID, status: "queued", createdAt: FIXED_TS }
  });
  s = taskCreationReducer(s, {
    type: "task-created",
    request: { prompt: "Normal request", routing: { mode: "auto" } },
    response: { taskId: TASK_ID_2, workId: WORK_ID_2, status: "queued", createdAt: FIXED_TS }
  });
  return s;
}

/** Helper to transition TASK_ID to running and activate aggregate-result with logs/streaming. */
function makeRunningAggregationState() {
  let s = makeQueuedState();
  s = taskCreationReducer(s, { type: "processing-started", taskId: TASK_ID, startedAt: FIXED_TS });
  s = taskCreationReducer(s, { type: "processing-started", taskId: TASK_ID_2, startedAt: FIXED_TS });

  // Advance TASK_ID to aggregate-result
  for (const stepId of ["validate-input", "analyze-request", "select-routing", "execute-task"]) {
    s = taskCreationReducer(s, { type: "processing-step-completed", taskId: TASK_ID, stepId, completedAt: FIXED_TS });
    s = taskCreationReducer(s, {
      type: "processing-log-appended",
      taskId: TASK_ID,
      log: { id: `log-${stepId}`, timestamp: FIXED_TS, level: "success", stepId, message: `${stepId} completed` }
    });
    if (stepId !== "execute-task") {
      const nextStep = ORDERED_STEP_IDS[ORDERED_STEP_IDS.indexOf(stepId) + 1];
      s = taskCreationReducer(s, { type: "processing-step-activated", taskId: TASK_ID, stepId: nextStep });
    }
  }

  // Activate aggregate-result
  s = taskCreationReducer(s, { type: "processing-step-activated", taskId: TASK_ID, stepId: "aggregate-result" });

  // Add streaming fragments to TASK_ID
  s = taskCreationReducer(s, { type: "streaming-started", taskId: TASK_ID, startedAt: FIXED_TS });
  s = taskCreationReducer(s, {
    type: "streaming-fragment-appended",
    taskId: TASK_ID,
    fragmentId: "frag-1",
    sequence: 1,
    text: "Partial text 1",
    appendedAt: FIXED_TS
  });
  s = taskCreationReducer(s, {
    type: "streaming-fragment-appended",
    taskId: TASK_ID,
    fragmentId: "frag-2",
    sequence: 2,
    text: " Partial text 2",
    appendedAt: FIXED_TS
  });

  return s;
}

/** Helper to create a failed state for TASK_ID. */
function makeFailedState() {
  const base = makeRunningAggregationState();
  return taskCreationReducer(base, {
    type: "task-failed",
    taskId: TASK_ID,
    error: sampleError
  });
}

// ---------------------------------------------------------------------------
// 5. Failure-prompt detection tests
// ---------------------------------------------------------------------------
describe("5. Failure-prompt detection tests (isFailureSimulationPrompt)", () => {
  it("FAIL_SIMULATION: ở đầu prompt trả true", () => {
    expect(isFailureSimulationPrompt("FAIL_SIMULATION:")).toBe(true);
  });

  it("FAIL_SIMULATION: something trả true", () => {
    expect(isFailureSimulationPrompt("FAIL_SIMULATION: please fail this task")).toBe(true);
  });

  it("Prompt bình thường trả false", () => {
    expect(isFailureSimulationPrompt("Write a weekly report")).toBe(false);
  });

  it("Token ở giữa prompt trả false", () => {
    expect(isFailureSimulationPrompt("Please do FAIL_SIMULATION: in the middle")).toBe(false);
  });

  it("Leading whitespace trước token trả false", () => {
    expect(isFailureSimulationPrompt(" FAIL_SIMULATION: leading space")).toBe(false);
    expect(isFailureSimulationPrompt("\tFAIL_SIMULATION: tab")).toBe(false);
  });

  it("Lowercase hoặc sai case trả false", () => {
    expect(isFailureSimulationPrompt("fail_simulation: lowercase")).toBe(false);
    expect(isFailureSimulationPrompt("Fail_Simulation: camel case")).toBe(false);
  });

  it("Empty prompt trả false", () => {
    expect(isFailureSimulationPrompt("")).toBe(false);
  });

  it("Helper không mutate input", () => {
    const input = "FAIL_SIMULATION: test";
    isFailureSimulationPrompt(input);
    expect(input).toBe("FAIL_SIMULATION: test");
  });

  it("Submitted prompt vẫn được giữ nguyên trong Task record", () => {
    const s = makeQueuedState();
    const t = s.tasks.find((task) => task.taskId === TASK_ID);
    expect(t?.prompt).toBe("FAIL_SIMULATION: test request");
  });
});

// ---------------------------------------------------------------------------
// 6. Semantic task-failed reducer tests
// ---------------------------------------------------------------------------
describe("6. Semantic task-failed reducer tests", () => {
  it("Running Task chuyển sang failed", () => {
    const base = makeRunningAggregationState();
    const next = taskCreationReducer(base, { type: "task-failed", taskId: TASK_ID, error: sampleError });
    const task = next.tasks.find((t) => t.taskId === TASK_ID);
    expect(task?.status).toBe("failed");
  });

  it("Đúng Task ID được cập nhật và Task khác không bị ảnh hưởng", () => {
    const base = makeRunningAggregationState();
    const next = taskCreationReducer(base, { type: "task-failed", taskId: TASK_ID, error: sampleError });
    const task1 = next.tasks.find((t) => t.taskId === TASK_ID);
    const task2 = next.tasks.find((t) => t.taskId === TASK_ID_2);
    expect(task1?.status).toBe("failed");
    expect(task2?.status).toBe("running"); // unaffected
  });

  it("TaskError được lưu", () => {
    const next = makeFailedState();
    const task = next.tasks.find((t) => t.taskId === TASK_ID);
    expect(task?.error).toEqual(sampleError);
  });

  it("Error object, previous state, và previous Task không bị mutate", () => {
    const base = makeRunningAggregationState();
    const baseCopy = JSON.parse(JSON.stringify(base));
    const errorCopy = JSON.parse(JSON.stringify(sampleError));

    taskCreationReducer(base, { type: "task-failed", taskId: TASK_ID, error: sampleError });

    expect(base).toEqual(baseCopy);
    expect(sampleError).toEqual(errorCopy);
  });

  it("Succeeded Task từ chối failure (returns same state reference)", () => {
    let base = makeRunningAggregationState();
    // Complete aggregate-result and activate finalize
    base = taskCreationReducer(base, { type: "processing-step-completed", taskId: TASK_ID, stepId: "aggregate-result", completedAt: FIXED_TS });
    base = taskCreationReducer(base, { type: "processing-step-activated", taskId: TASK_ID, stepId: "finalize" });
    // Exhaust streaming
    base = taskCreationReducer(base, { type: "streaming-exhausted", taskId: TASK_ID, exhaustedAt: FIXED_TS });

    // Complete TASK_ID
    const succeededState = taskCreationReducer(base, {
      type: "task-completed",
      taskId: TASK_ID,
      result: { text: "Result", finalizedAt: FIXED_TS }
    });
    const attemptFail = taskCreationReducer(succeededState, { type: "task-failed", taskId: TASK_ID, error: sampleError });
    expect(attemptFail).toBe(succeededState);
    expect(attemptFail.tasks.find((t) => t.taskId === TASK_ID)?.status).toBe("succeeded");
  });

  it("Cancelled Task từ chối failure (returns same state reference)", () => {
    const base = makeRunningAggregationState();
    const cancelledState = taskCreationReducer(base, { type: "task-cancelled", taskId: TASK_ID, cancelledAt: FIXED_TS2 });
    const attemptFail = taskCreationReducer(cancelledState, { type: "task-failed", taskId: TASK_ID, error: sampleError });
    expect(attemptFail).toBe(cancelledState);
    expect(attemptFail.tasks.find((t) => t.taskId === TASK_ID)?.status).toBe("cancelled");
  });

  it("Failed Task từ chối duplicate failure (returns same state reference)", () => {
    const failedState = makeFailedState();
    const duplicateFail = taskCreationReducer(failedState, { type: "task-failed", taskId: TASK_ID, error: sampleError });
    expect(duplicateFail).toBe(failedState);
  });

  it("Queued Task không bị generic fail nếu production reducer không cho phép", () => {
    const queuedState = makeQueuedState();
    const attemptFail = taskCreationReducer(queuedState, { type: "task-failed", taskId: TASK_ID, error: sampleError });
    // Queued -> failed is not in TASK_STATUS_TRANSITIONS, so reducer returns state unmodified
    expect(attemptFail).toBe(queuedState);
    expect(attemptFail.tasks.find((t) => t.taskId === TASK_ID)?.status).toBe("queued");
  });
});

// ---------------------------------------------------------------------------
// 7. Deterministic TaskError tests
// ---------------------------------------------------------------------------
describe("7. Deterministic TaskError tests", () => {
  it("Xác minh exact fields: code, stepId, title, message, occurredAt", () => {
    const next = makeFailedState();
    const err = next.tasks.find((t) => t.taskId === TASK_ID)?.error;
    expect(err).toBeDefined();
    expect(err?.code).toBe("MOCK_AGGREGATION_FAILED");
    expect(err?.stepId).toBe("aggregate-result");
    expect(err?.title).toBe("Không thể tổng hợp kết quả");
    expect(err?.message).toBe("Quá trình tổng hợp kết quả đã được mô phỏng là thất bại.");
    expect(err?.occurredAt).toBe(FIXED_TS2);
  });

  it("Hai run với cùng clock cho cùng error values", () => {
    const run1 = makeFailedState();
    const run2 = makeFailedState();
    expect(run1.tasks[0].error).toEqual(run2.tasks[0].error);
  });

  it("Không có stack trace và không lưu raw JavaScript Error", () => {
    const next = makeFailedState();
    const err = next.tasks.find((t) => t.taskId === TASK_ID)?.error;
    expect((err as any)?.stack).toBeUndefined();
    expect(err instanceof Error).toBe(false);
  });

  it("Error thuần dữ liệu, serializable và Reducer không tự thay đổi timestamp", () => {
    const next = makeFailedState();
    const err = next.tasks.find((t) => t.taskId === TASK_ID)?.error;
    const serialized = JSON.parse(JSON.stringify(err));
    expect(serialized).toEqual(err);
    expect(err?.occurredAt).toBe(FIXED_TS2); // unchanged by reducer
  });
});

// ---------------------------------------------------------------------------
// 8. Failed-step tests
// ---------------------------------------------------------------------------
describe("8. Failed-step tests (failActiveStep)", () => {
  it("Active aggregate-result chuyển thành failed, các step completed giữ nguyên, finalize giữ waiting", () => {
    const next = makeFailedState();
    const steps = next.tasks.find((t) => t.taskId === TASK_ID)?.processingSnapshot.steps!;

    expect(steps.find((s) => s.id === "validate-input")?.status).toBe("completed");
    expect(steps.find((s) => s.id === "analyze-request")?.status).toBe("completed");
    expect(steps.find((s) => s.id === "select-routing")?.status).toBe("completed");
    expect(steps.find((s) => s.id === "execute-task")?.status).toBe("completed");
    expect(steps.find((s) => s.id === "aggregate-result")?.status).toBe("failed");
    expect(steps.find((s) => s.id === "finalize")?.status).toBe("waiting");
  });

  it("Không later step nào thành active, completed, hoặc failed; step order giữ nguyên", () => {
    const next = makeFailedState();
    const steps = next.tasks.find((t) => t.taskId === TASK_ID)?.processingSnapshot.steps!;

    expect(steps.map((s) => s.id)).toEqual([...ORDERED_STEP_IDS]);
    const finalizeStep = steps.find((s) => s.id === "finalize");
    expect(finalizeStep?.status).not.toBe("active");
    expect(finalizeStep?.status).not.toBe("completed");
    expect(finalizeStep?.status).not.toBe("failed");
  });

  it("Existing timestamps và logs giữ nguyên, snapshot cũ không mutate", () => {
    const base = makeRunningAggregationState();
    const baseSnapshot = base.tasks.find((t) => t.taskId === TASK_ID)?.processingSnapshot!;
    const baseLogsCopy = JSON.parse(JSON.stringify(baseSnapshot.logs));

    const next = makeFailedState();
    const nextSnapshot = next.tasks.find((t) => t.taskId === TASK_ID)?.processingSnapshot!;

    expect(nextSnapshot.logs).toEqual(baseLogsCopy);
    expect(baseSnapshot.steps.find((s) => s.id === "aggregate-result")?.status).toBe("active"); // base unchanged
  });

  it("Không có active step thì helper trả snapshot theo existing convention", () => {
    const base = makeQueuedState();
    const snapshot = base.tasks.find((t) => t.taskId === TASK_ID)?.processingSnapshot!;
    const result = failActiveStep(snapshot);
    expect(result.ok).toBe(true);
    expect(result.snapshot).toBe(snapshot); // unchanged
  });

  it("Failed step khớp TaskError.stepId", () => {
    const next = makeFailedState();
    const task = next.tasks.find((t) => t.taskId === TASK_ID)!;
    const failedStep = task.processingSnapshot.steps.find((s) => s.status === "failed");
    expect(failedStep?.id).toBe(task.error?.stepId);
  });
});

// ---------------------------------------------------------------------------
// 9. Data-preservation tests
// ---------------------------------------------------------------------------
describe("9. Data-preservation tests", () => {
  it("Giữ nguyên Task ID, Work ID, prompt, routing mode, metadata, logs, completed steps", () => {
    const next = makeFailedState();
    const task = next.tasks.find((t) => t.taskId === TASK_ID)!;

    expect(task.taskId).toBe(TASK_ID);
    expect(task.workId).toBe(WORK_ID);
    expect(task.prompt).toBe("FAIL_SIMULATION: test request");
    expect(task.requestedRouting).toEqual({ mode: "auto" });
    expect(task.processingSnapshot.logs.length).toBe(4); // 4 completed steps logs
    expect(task.processingSnapshot.steps.filter((s) => s.status === "completed").length).toBe(4);
  });

  it("Fragments giữ nguyên nội dung và thứ tự, accumulated partial output không đổi", () => {
    const next = makeFailedState();
    const task = next.tasks.find((t) => t.taskId === TASK_ID)!;

    expect(task.streamingSnapshot.fragments).toHaveLength(2);
    expect(task.streamingSnapshot.fragments[0].text).toBe("Partial text 1");
    expect(task.streamingSnapshot.fragments[1].text).toBe(" Partial text 2");

    const text = selectAccumulatedPartialText(task.streamingSnapshot);
    expect(text).toBe("Partial text 1 Partial text 2");
  });

  it("Không xóa timeline, không tạo finalizedResult, incomplete output không bị đánh dấu completed", () => {
    const next = makeFailedState();
    const task = next.tasks.find((t) => t.taskId === TASK_ID)!;

    expect(task.processingSnapshot.steps.length).toBe(6);
    expect(task.finalizedResult).toBeUndefined();
    expect(task.status).not.toBe("succeeded");
  });
});

// ---------------------------------------------------------------------------
// 10. Terminal-guard tests
// ---------------------------------------------------------------------------
describe("10. Terminal-guard tests", () => {
  const sampleLog = { id: "log-late", timestamp: FIXED_TS3, level: "info" as const, stepId: "aggregate-result", message: "Late" };
  const sampleFrag = { fragmentId: "frag-late", sequence: 3, text: "Late", appendedAt: FIXED_TS3 };
  const sampleResult = { summary: "Late summary", output: "Late output" };

  const lateActions: { name: string; action: TaskCreationAction }[] = [
    { name: "Processing-step activated", action: { type: "processing-step-activated", taskId: TASK_ID, stepId: "finalize" } },
    { name: "Processing-step completed", action: { type: "processing-step-completed", taskId: TASK_ID, stepId: "aggregate-result", completedAt: FIXED_TS3 } },
    { name: "Processing-log appended", action: { type: "processing-log-appended", taskId: TASK_ID, log: sampleLog } },
    { name: "Streaming started", action: { type: "streaming-started", taskId: TASK_ID, startedAt: FIXED_TS3 } },
    { name: "Streaming fragment appended", action: { type: "streaming-fragment-appended", taskId: TASK_ID, ...sampleFrag } },
    { name: "Streaming exhausted", action: { type: "streaming-exhausted", taskId: TASK_ID, exhaustedAt: FIXED_TS3 } },
    { name: "Completion requested/completed", action: { type: "task-completed", taskId: TASK_ID, result: sampleResult } },
    { name: "Cancellation action", action: { type: "task-cancelled", taskId: TASK_ID, cancelledAt: FIXED_TS3 } },
    { name: "Duplicate failure action", action: { type: "task-failed", taskId: TASK_ID, error: sampleError } }
  ];

  it.each(lateActions)("Sau khi Task đã failed, dispatch %s là no-op", ({ action }) => {
    const failedState = makeFailedState();
    const next = taskCreationReducer(failedState, action);

    // Reducer convention for rejected terminal actions is returning the exact same state reference
    expect(next).toBe(failedState);

    const task = next.tasks.find((t) => t.taskId === TASK_ID)!;
    expect(task.status).toBe("failed");
    expect(task.error).toEqual(sampleError);
    expect(task.finalizedResult).toBeUndefined();
  });
});
