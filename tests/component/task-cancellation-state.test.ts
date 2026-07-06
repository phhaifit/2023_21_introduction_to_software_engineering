/**
 * task-cancellation-state.test.ts
 *
 * Comprehensive component tests for Task & Orchestration cancellation state
 * transitions and terminal guards (Task 12A).
 */

import { describe, it, expect } from "vitest";
import type { EntityId } from "@vcp/shared";

import {
  taskCreationReducer,
  initialTaskCreationState,
  createTaskRecord,
  type TaskCreationState
} from "../../apps/frontend/src/features/task-orchestration/model/task-creation-state";
import {
  isTerminalTaskStatus,
  transitionTaskStatus
} from "../../apps/frontend/src/features/task-orchestration/model/task-lifecycle";
import { selectAccumulatedPartialText } from "../../apps/frontend/src/features/task-orchestration/model/task-streaming";
import type { CreatedTaskRecord } from "../../apps/frontend/src/features/task-orchestration/model/task-types";

describe("Task Cancellation State & Lifecycle Transitions (Task 12A)", () => {
  const mockRequest = {
    prompt: "Test cancellation prompt",
    routing: { mode: "auto" as const }
  };
  const mockResponse = {
    taskId: "TASK-000001" as EntityId<"taskId">,
    workId: "WORK-000001" as EntityId<"workId">,
    status: "queued" as const,
    createdAt: "2026-06-25T10:00:00.000Z"
  };

  const baseState = taskCreationReducer(initialTaskCreationState, {
    type: "task-created",
    request: mockRequest,
    response: mockResponse
  });

  const taskId = "TASK-000001" as EntityId<"taskId">;
  const cancelledAt = "2026-06-25T10:01:00.000Z";

  it("1. Queued Task có thể chuyển sang cancelled", () => {
    const state = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const task = state.tasks[0];
    expect(task.status).toBe("cancelled");
  });

  it("2. Running Task có thể chuyển sang cancelled", () => {
    const runningState = taskCreationReducer(baseState, {
      type: "processing-started",
      taskId,
      startedAt: "2026-06-25T10:00:01.000Z"
    });

    const state = taskCreationReducer(runningState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const task = state.tasks[0];
    expect(task.status).toBe("cancelled");
  });

  it("3. Cancellation timestamp được lưu đúng nếu model yêu cầu", () => {
    const state = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const task = state.tasks[0];
    expect(task.cancelledAt).toBe(cancelledAt);
  });

  it("4. Task ID được giữ", () => {
    const state = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].taskId).toBe(taskId);
  });

  it("5. Work ID được giữ", () => {
    const state = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].workId).toBe("WORK-000001");
  });

  it("6. Prompt được giữ", () => {
    const state = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].prompt).toBe("Test cancellation prompt");
  });

  it("7. Routing metadata được giữ", () => {
    const state = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].requestedRouting).toEqual({ mode: "auto" });
  });

  it("8. Processing steps được giữ", () => {
    const runningState = taskCreationReducer(baseState, {
      type: "processing-started",
      taskId,
      startedAt: "2026-06-25T10:00:01.000Z"
    });

    const state = taskCreationReducer(runningState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    // Active step should be marked canceled, but all steps preserved in array
    expect(state.tasks[0].processingSnapshot.steps.length).toBe(6);
    expect(state.tasks[0].processingSnapshot.steps[0].status).toBe("canceled");
  });

  it("9. Processing logs được giữ", () => {
    const runningState = taskCreationReducer(baseState, {
      type: "processing-started",
      taskId,
      startedAt: "2026-06-25T10:00:01.000Z"
    });

    const logState = taskCreationReducer(runningState, {
      type: "processing-log-appended",
      taskId,
      log: {
        id: "log-1",
        timestamp: "2026-06-25T10:00:02.000Z",
        level: "info",
        stepId: "validate-input",
        message: "Testing logs"
      }
    });

    const state = taskCreationReducer(logState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].processingSnapshot.logs.length).toBe(1);
    expect(state.tasks[0].processingSnapshot.logs[0].id).toBe("log-1");
  });

  it("10. Streaming fragments được giữ", () => {
    const runningState = taskCreationReducer(baseState, {
      type: "processing-started",
      taskId,
      startedAt: "2026-06-25T10:00:01.000Z"
    });

    const streamingState = taskCreationReducer(runningState, {
      type: "streaming-started",
      taskId,
      startedAt: "2026-06-25T10:00:03.000Z"
    });

    const fragState = taskCreationReducer(streamingState, {
      type: "streaming-fragment-appended",
      taskId,
      fragmentId: "frag-1",
      sequence: 1,
      text: "Partial text",
      appendedAt: "2026-06-25T10:00:04.000Z"
    });

    const state = taskCreationReducer(fragState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].streamingSnapshot.fragments.length).toBe(1);
    expect(state.tasks[0].streamingSnapshot.fragments[0].id).toBe("frag-1");
  });

  it("11. Partial output được giữ", () => {
    const runningState = taskCreationReducer(baseState, {
      type: "processing-started",
      taskId,
      startedAt: "2026-06-25T10:00:01.000Z"
    });

    const streamingState = taskCreationReducer(runningState, {
      type: "streaming-started",
      taskId,
      startedAt: "2026-06-25T10:00:03.000Z"
    });

    const fragState = taskCreationReducer(streamingState, {
      type: "streaming-fragment-appended",
      taskId,
      fragmentId: "frag-1",
      sequence: 1,
      text: "Partial text",
      appendedAt: "2026-06-25T10:00:04.000Z"
    });

    const state = taskCreationReducer(fragState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].streamingSnapshot.fragments).toEqual(
      fragState.tasks[0].streamingSnapshot.fragments
    );
    expect(selectAccumulatedPartialText(state.tasks[0].streamingSnapshot)).toBe("Partial text");
  });

  it("12. Finalized result không được tạo", () => {
    const state = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].finalizedResult).toBeUndefined();
  });

  it("13. Succeeded Task reject cancellation", () => {
    // Create a succeeded task
    const succeededTask: CreatedTaskRecord = {
      ...baseState.tasks[0],
      status: "succeeded",
      finalizedResult: { text: "Success", finalizedAt: "2026-06-25T10:00:10.000Z" }
    };

    const succeededState: TaskCreationState = {
      ...baseState,
      tasks: [succeededTask]
    };

    const state = taskCreationReducer(succeededState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].status).toBe("succeeded");
    expect(state.tasks[0].cancelledAt).toBeUndefined();
  });

  it("14. Failed Task reject cancellation", () => {
    const failedTask: CreatedTaskRecord = {
      ...baseState.tasks[0],
      status: "failed"
    };

    const failedState: TaskCreationState = {
      ...baseState,
      tasks: [failedTask]
    };

    const state = taskCreationReducer(failedState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].status).toBe("failed");
    expect(state.tasks[0].cancelledAt).toBeUndefined();
  });

  it("15. Cancelled Task reject/no-op duplicate cancellation", () => {
    const state1 = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const state2 = taskCreationReducer(state1, {
      type: "task-cancelled",
      taskId,
      cancelledAt: "2026-06-25T10:05:00.000Z"
    });

    expect(state2.tasks[0].status).toBe("cancelled");
    expect(state2.tasks[0].cancelledAt).toBe(cancelledAt); // Original timestamp preserved
  });

  it("16. Unknown Task xử lý theo reducer convention", () => {
    const state = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId: "UNKNOWN-TASK" as EntityId<"taskId">,
      cancelledAt
    });

    // Reducer ignores unknown tasks and returns state unmodified
    expect(state).toBe(baseState);
    expect(state.tasks[0].status).toBe("queued");
  });

  it("17. Previous state không bị mutate", () => {
    const baseStateCopy = structuredClone(baseState);

    taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(baseState).toEqual(baseStateCopy);
  });

  it("18. Task khác không bị ảnh hưởng", () => {
    const twoTasksState = taskCreationReducer(baseState, {
      type: "task-created",
      request: { prompt: "Task 2", routing: { mode: "auto" } },
      response: {
        taskId: "TASK-000002" as EntityId<"taskId">,
        workId: "WORK-000002" as EntityId<"workId">,
        status: "queued",
        createdAt: "2026-06-25T10:00:00.000Z"
      }
    });

    const state = taskCreationReducer(twoTasksState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    expect(state.tasks[0].status).toBe("cancelled");
    expect(state.tasks[1].status).toBe("queued"); // Second task unaffected
  });

  it("19. Late processing step bị reject", () => {
    const cancelledState = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const state = taskCreationReducer(cancelledState, {
      type: "processing-step-activated",
      taskId,
      stepId: "analyze-request"
    });

    expect(state).toBe(cancelledState);
    expect(state.tasks[0].processingSnapshot.steps[1].status).toBe("waiting");
  });

  it("20. Late processing log bị reject", () => {
    const cancelledState = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const state = taskCreationReducer(cancelledState, {
      type: "processing-log-appended",
      taskId,
      log: {
        id: "log-late",
        timestamp: "2026-06-25T10:02:00.000Z",
        level: "info",
        stepId: "validate-input",
        message: "Late log"
      }
    });

    expect(state).toBe(cancelledState);
    expect(state.tasks[0].processingSnapshot.logs.length).toBe(0);
  });

  it("21. Late streaming start bị reject", () => {
    const cancelledState = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const previousSnapshot = cancelledState.tasks[0].streamingSnapshot;

    const state = taskCreationReducer(cancelledState, {
      type: "streaming-started",
      taskId,
      startedAt: "2026-06-25T10:02:00.000Z"
    });

    expect(state).toBe(cancelledState);
    expect(state.tasks[0].streamingSnapshot).toBe(previousSnapshot);
    expect(state.tasks[0].streamingSnapshot.startedAt).toBeNull();
  });

  it("22. Late streaming chunk bị reject", () => {
    const cancelledState = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const state = taskCreationReducer(cancelledState, {
      type: "streaming-fragment-appended",
      taskId,
      fragmentId: "frag-late",
      sequence: 1,
      text: "Late chunk",
      appendedAt: "2026-06-25T10:02:00.000Z"
    });

    expect(state).toBe(cancelledState);
    expect(state.tasks[0].streamingSnapshot.fragments.length).toBe(0);
  });

  it("23. Late streaming exhausted update bị reject", () => {
    const cancelledState = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const previousSnapshot = cancelledState.tasks[0].streamingSnapshot;

    const state = taskCreationReducer(cancelledState, {
      type: "streaming-exhausted",
      taskId,
      exhaustedAt: "2026-06-25T10:02:00.000Z"
    });

    expect(state).toBe(cancelledState);
    expect(state.tasks[0].streamingSnapshot).toBe(previousSnapshot);
    expect(state.tasks[0].streamingSnapshot.phase).toBe("idle");
  });

  it("24. Late completion bị reject", () => {
    const cancelledState = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const state = taskCreationReducer(cancelledState, {
      type: "task-completed",
      taskId,
      result: { text: "Late completion", finalizedAt: "2026-06-25T10:02:00.000Z" }
    });

    expect(state).toBe(cancelledState);
    expect(state.tasks[0].status).toBe("cancelled");
    expect(state.tasks[0].finalizedResult).toBeUndefined();
  });

  it("25. Canceled không trở thành Failed nếu OpenSpec yêu cầu", () => {
    const cancelledState = taskCreationReducer(baseState, {
      type: "task-cancelled",
      taskId,
      cancelledAt
    });

    const transitionResult = transitionTaskStatus(cancelledState.tasks[0], "failed");

    expect(transitionResult.ok).toBe(false);
    if (!transitionResult.ok) {
      expect(transitionResult.reason).toContain("Cannot transition task from cancelled to failed");
    }
  });

  it("26. Terminal helper nhận diện cancelled", () => {
    expect(isTerminalTaskStatus("cancelled")).toBe(true);
  });

  it("27. Lifecycle transition succeeded -> cancelled bị reject", () => {
    const succeededTask: CreatedTaskRecord = {
      ...baseState.tasks[0],
      status: "succeeded"
    };

    const transitionResult = transitionTaskStatus(succeededTask, "cancelled");
    expect(transitionResult.ok).toBe(false);
  });

  it("28. Lifecycle transition failed -> cancelled bị reject", () => {
    const failedTask: CreatedTaskRecord = {
      ...baseState.tasks[0],
      status: "failed"
    };

    const transitionResult = transitionTaskStatus(failedTask, "cancelled");
    expect(transitionResult.ok).toBe(false);
  });
});
