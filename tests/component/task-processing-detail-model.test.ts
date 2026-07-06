import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTaskProcessingDetail } from "../../apps/frontend/src/features/task-orchestration/model/task-processing-detail";
import type { CreatedTaskRecord } from "../../apps/frontend/src/features/task-orchestration/model/task-types";

describe("Task Processing Detail Model", () => {
  function createTestTask(overrides?: Partial<CreatedTaskRecord>): CreatedTaskRecord {
    return {
      taskId: "TASK-001",
      workId: "WORK-001",
      prompt: "Test prompt",
      requestedRouting: { mode: "auto-routing" },
      status: "succeeded",
      createdAt: "2024-01-01T00:00:00Z",
      processingSnapshot: {
        startedAt: "2024-01-01T00:00:01Z",
        steps: [
          { id: "step-1", label: "Step 1", status: "completed" },
          { id: "step-2", label: "Step 2", status: "completed" }
        ],
        logs: [
          { id: "log-1", stepId: "step-1", level: "info", message: "Log 1", timestamp: "2024-01-01T00:00:01Z" }
        ]
      },
      streamingSnapshot: {
        phase: "exhausted",
        fragments: []
      },
      finalizedResult: {
        text: "Result",
        finalizedAt: "2024-01-01T00:00:05Z"
      },
      ...overrides
    } as CreatedTaskRecord;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds a valid detail model for a completed task", () => {
    const task = createTestTask();
    const detail = buildTaskProcessingDetail(task);
    
    expect(detail).not.toBeNull();
    expect(detail?.taskId).toBe("TASK-001");
    expect(detail?.workId).toBe("WORK-001");
    expect(detail?.status).toBe("completed");
    expect(detail?.routingSummary).toBe("Routing: Auto-routing");
    expect(detail?.durationMs).toBe(4000);
    expect(detail?.steps).toEqual(task.processingSnapshot.steps);
    expect(detail?.logs).toEqual(task.processingSnapshot.logs);
  });

  it("returns correct routing summary for specific-agent", () => {
    const task = createTestTask({
      requestedRouting: { mode: "specific-agent", agentId: "agent-X" }
    });
    const detail = buildTaskProcessingDetail(task);
    expect(detail?.routingSummary).toBe("Routing: Specific agent agent-X");
  });

  it("returns correct routing summary for predefined-workflow", () => {
    const task = createTestTask({
      requestedRouting: { mode: "predefined-workflow", workflowId: "workflow-Y" }
    });
    const detail = buildTaskProcessingDetail(task);
    expect(detail?.routingSummary).toBe("Routing: Predefined workflow workflow-Y");
  });

  it("calculates correct duration", () => {
    const task = createTestTask();
    const detail = buildTaskProcessingDetail(task);
    expect(detail?.durationMs).toBe(4000);
  });

  it("handles missing start timestamp correctly", () => {
    const task = createTestTask({
      processingSnapshot: {
        ...createTestTask().processingSnapshot,
        startedAt: undefined
      }
    });
    const detail = buildTaskProcessingDetail(task);
    expect(detail?.durationMs).toBeNull();
  });

  it("handles invalid duration (end before start) correctly", () => {
    const task = createTestTask({
      finalizedResult: { text: "Result", finalizedAt: "2024-01-01T00:00:00Z" } // Before startedAt
    });
    const detail = buildTaskProcessingDetail(task);
    expect(detail?.durationMs).toBeNull();
  });

  it("does not mutate input task", () => {
    const task = createTestTask();
    const taskCopy = JSON.parse(JSON.stringify(task));
    buildTaskProcessingDetail(task);
    expect(task).toEqual(taskCopy);
  });

  it("rejects unsupported statuses", () => {
    const pendingTask = createTestTask({ status: "queued" });
    expect(buildTaskProcessingDetail(pendingTask)).not.toBeNull();

    const failedTask = createTestTask({ status: "failed" });
    expect(buildTaskProcessingDetail(failedTask)).toBeNull();

    const canceledTask = createTestTask({ status: "cancelled" });
    expect(buildTaskProcessingDetail(canceledTask)).not.toBeNull();
  });

  it("builds valid detail model for in-progress task", () => {
    const task = createTestTask({ status: "running" });
    const detail = buildTaskProcessingDetail(task);
    expect(detail).not.toBeNull();
    expect(detail?.status).toBe("in-progress");
    expect(detail?.durationMs).toBeNull();
  });

  it("keeps detail creation independent for two tasks", () => {
    const task1 = createTestTask({ taskId: "T1", workId: "W1" });
    const task2 = createTestTask({ taskId: "T2", workId: "W2", status: "running" });

    const detail1 = buildTaskProcessingDetail(task1);
    const detail2 = buildTaskProcessingDetail(task2);

    expect(detail1?.taskId).toBe("T1");
    expect(detail2?.taskId).toBe("T2");
    expect(detail1?.status).toBe("completed");
    expect(detail2?.status).toBe("in-progress");
  });
});
