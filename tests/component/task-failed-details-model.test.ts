import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTaskProcessingDetail } from "../../apps/frontend/src/features/task-orchestration/model/task-processing-detail";
import type { CreatedTaskRecord, TaskError } from "../../apps/frontend/src/features/task-orchestration/model/task-types";

describe("Task Failed Details Model", () => {
  const sampleError: TaskError = {
    code: "ERR_AGGREGATION_FAILURE",
    stepId: "aggregate-result",
    title: "Aggregation Failed",
    message: "The aggregation stage failed deterministically.",
    occurredAt: "2026-06-25T10:00:05.000Z"
  };

  function createTestTask(overrides?: Partial<CreatedTaskRecord>): CreatedTaskRecord {
    return {
      taskId: "TASK-001",
      workId: "WORK-001",
      prompt: "FAIL_SIMULATION: test prompt",
      requestedRouting: { mode: "auto-routing" },
      status: "failed",
      createdAt: "2026-06-25T10:00:00.000Z",
      processingSnapshot: {
        startedAt: "2026-06-25T10:00:01.000Z",
        steps: [
          { id: "validate-input", label: "Validate Input", status: "completed" },
          { id: "aggregate-result", label: "Aggregate Result", status: "failed" }
        ],
        logs: [
          { id: "log-1", stepId: "validate-input", level: "success", message: "Validated", timestamp: "2026-06-25T10:00:01.000Z" }
        ]
      },
      streamingSnapshot: {
        phase: "stopped",
        fragments: []
      },
      error: sampleError,
      ...overrides
    } as CreatedTaskRecord;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1. Model Creation: Task status failed, error có sẵn, buildTaskProcessingDetail trả đúng detail", () => {
    const task = createTestTask();
    const detail = buildTaskProcessingDetail(task);

    expect(detail).not.toBeNull();
    expect(detail?.taskId).toBe("TASK-001");
    expect(detail?.workId).toBe("WORK-001");
    expect(detail?.status).toBe("failed");
    expect(detail?.steps).toEqual(task.processingSnapshot.steps);
    expect(detail?.logs).toEqual(task.processingSnapshot.logs);
  });

  it("2. Status Mapping: failed thành failed, formatRoutingSummary chính xác cho auto/agent/workflow", () => {
    const taskAuto = createTestTask({
      requestedRouting: { mode: "auto-routing" }
    });
    const detailAuto = buildTaskProcessingDetail(taskAuto);
    expect(detailAuto?.status).toBe("failed");
    expect(detailAuto?.routingSummary).toBe("Routing: Auto-routing");

    const taskAgent = createTestTask({
      requestedRouting: { mode: "specific-agent", agentId: "AGT-CODE" }
    });
    const detailAgent = buildTaskProcessingDetail(taskAgent);
    expect(detailAgent?.status).toBe("failed");
    expect(detailAgent?.routingSummary).toBe("Routing: Specific agent AGT-CODE");

    const taskWorkflow = createTestTask({
      requestedRouting: { mode: "predefined-workflow", workflowId: "WFL-CODE-REVIEW" }
    });
    const detailWorkflow = buildTaskProcessingDetail(taskWorkflow);
    expect(detailWorkflow?.status).toBe("failed");
    expect(detailWorkflow?.routingSummary).toBe("Routing: Predefined workflow WFL-CODE-REVIEW");
  });

  it("3. Deterministic Duration: occurredAt - startedAt tính đúng số ms", () => {
    const task = createTestTask();
    const detail = buildTaskProcessingDetail(task);
    // startedAt: 10:00:01, occurredAt: 10:00:05 -> 4000ms
    expect(detail?.durationMs).toBe(4000);
  });

  it("4. Error Preservation: TaskError (code, stepId, title, message, occurredAt) giữ đúng trong detail.error", () => {
    const task = createTestTask();
    const detail = buildTaskProcessingDetail(task);
    expect(detail?.error).toEqual(sampleError);
    expect(detail?.error?.code).toBe("ERR_AGGREGATION_FAILURE");
    expect(detail?.error?.stepId).toBe("aggregate-result");
    expect(detail?.error?.title).toBe("Aggregation Failed");
    expect(detail?.error?.message).toBe("The aggregation stage failed deterministically.");
    expect(detail?.error?.occurredAt).toBe("2026-06-25T10:00:05.000Z");
  });

  it("5. Failed Step ID: detail.failedStepId lấy đúng từ TaskError.stepId", () => {
    const task = createTestTask();
    const detail = buildTaskProcessingDetail(task);
    expect(detail?.failedStepId).toBe("aggregate-result");
  });

  it("6. Missing/Invalid Data: không có error thì trả null; không có startedAt thì durationMs null; occurredAt trước startedAt thì durationMs null", () => {
    // không có error thì trả null
    const taskNoError = createTestTask({ error: undefined });
    expect(buildTaskProcessingDetail(taskNoError)).toBeNull();

    // không có startedAt thì durationMs null
    const taskNoStartedAt = createTestTask({
      processingSnapshot: {
        ...createTestTask().processingSnapshot,
        startedAt: undefined
      }
    });
    const detailNoStartedAt = buildTaskProcessingDetail(taskNoStartedAt);
    expect(detailNoStartedAt).not.toBeNull();
    expect(detailNoStartedAt?.durationMs).toBeNull();

    // occurredAt trước startedAt thì durationMs null
    const taskInvalidTime = createTestTask({
      error: {
        ...sampleError,
        occurredAt: "2026-06-25T10:00:00.000Z" // 10:00:00 < startedAt (10:00:01)
      }
    });
    const detailInvalidTime = buildTaskProcessingDetail(taskInvalidTime);
    expect(detailInvalidTime).not.toBeNull();
    expect(detailInvalidTime?.durationMs).toBeNull();
  });

  it("7. Pure Function: không mutate task đầu vào", () => {
    const task = createTestTask();
    const taskCopy = JSON.parse(JSON.stringify(task));
    buildTaskProcessingDetail(task);
    expect(task).toEqual(taskCopy);
  });

  it("8. Independence: hai task (một failed, một running/succeeded) được build độc lập, không rò rỉ dữ liệu", () => {
    const taskFailed = createTestTask({ taskId: "TASK-FAIL", workId: "WORK-FAIL", status: "failed" });
    const taskSucceeded = createTestTask({
      taskId: "TASK-SUCC",
      workId: "WORK-SUCC",
      status: "succeeded",
      error: undefined,
      finalizedResult: { text: "Success", finalizedAt: "2026-06-25T10:00:06.000Z" }
    });

    const detailFailed = buildTaskProcessingDetail(taskFailed);
    const detailSucceeded = buildTaskProcessingDetail(taskSucceeded);

    expect(detailFailed?.taskId).toBe("TASK-FAIL");
    expect(detailFailed?.status).toBe("failed");
    expect(detailFailed?.error).toBeDefined();

    expect(detailSucceeded?.taskId).toBe("TASK-SUCC");
    expect(detailSucceeded?.status).toBe("completed");
    expect(detailSucceeded?.error).toBeUndefined();
    expect(detailSucceeded?.durationMs).toBe(5000);
  });
});
