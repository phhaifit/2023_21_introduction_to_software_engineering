/**
 * task-runtime-isolation.test.tsx
 *
 * High-value runtime isolation tests covering background task progression,
 * background completion, background failure isolation, isolated cancellation,
 * reset/unmount cleanup, and Strict Mode idempotency.
 */

import React, { useEffect, useReducer, useRef, StrictMode } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  taskCreationReducer,
  initialTaskCreationState,
  getActiveTask
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state";
import { createTaskRuntimeRegistry, type TaskRuntimeRegistry } from "@vcp/frontend/features/task-orchestration/model/task-runtime-registry";
import { TaskConversation } from "@vcp/frontend/features/task-orchestration/components/task-conversation";
import { resetTaskIdentitySequence } from "@vcp/frontend/features/task-orchestration/model/task-id";
import type { TaskProcessingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-processing-runtime";
import type { TaskStreamingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-streaming-runtime";
import type { TaskCompletionRuntime } from "@vcp/frontend/features/task-orchestration/model/task-completion-runtime";
import type { EntityId } from "@vcp/shared";

const FIXED_TS = "2026-06-25T12:00:00.000Z";
const PENDING_MS = 25;
const STEP_MS = 40;
const FRAGMENT_MS = 15;
const COMPLETION_MS = 50;

interface ScheduledEntry {
  delayMs: number;
  callback: () => void;
  cancelled: boolean;
  executed: boolean;
}

class FakeScheduler {
  readonly entries: ScheduledEntry[] = [];

  schedule(delayMs: number, callback: () => void) {
    const entry = { delayMs, callback, cancelled: false, executed: false };
    this.entries.push(entry);
    return {
      cancel: () => {
        entry.cancelled = true;
      }
    };
  }

  flushNext(delayMs?: number): void {
    const entry = this.entries.find(
      (e) => !e.cancelled && !e.executed && (delayMs === undefined || e.delayMs === delayMs)
    );
    if (!entry) throw new Error(`No pending callback for ${delayMs ?? "any"}ms.`);
    entry.executed = true;
    entry.callback();
  }

  pendingCount(delayMs?: number): number {
    return this.entries.filter(
      (e) => !e.cancelled && !e.executed && (delayMs === undefined || e.delayMs === delayMs)
    ).length;
  }
}

class FakeProcessingRuntime implements TaskProcessingRuntime {
  scheduler = new FakeScheduler();
  clock = { now: () => FIXED_TS };
  logIdentitySource = {
    counter: 0,
    nextLogId() {
      this.counter += 1;
      return `LOG-${String(this.counter).padStart(4, "0")}`;
    }
  };
}

class FakeStreamingRuntime implements TaskStreamingRuntime {
  scheduler = new FakeScheduler();
  clock = { now: () => FIXED_TS };
  fragmentIdentitySource = {
    counter: 0,
    nextFragmentId() {
      this.counter += 1;
      return `FRG-${String(this.counter).padStart(4, "0")}`;
    }
  };
  fragmentSource = {
    getFragments: () => ["Alpha ", "Beta ", "Gamma"]
  };
}

class FakeCompletionRuntime implements TaskCompletionRuntime {
  scheduler = new FakeScheduler();
  resultSource = {
    finalize: (task: any) => ({
      text: `Finalized: ${task.prompt}`,
      actionItems: ["Action 1"],
      finalizedAt: FIXED_TS
    })
  };
  clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined)
  };
}

function IsolationTestHarness({
  pRuntime,
  sRuntime,
  cRuntime
}: {
  pRuntime: FakeProcessingRuntime;
  sRuntime: FakeStreamingRuntime;
  cRuntime: FakeCompletionRuntime;
}) {
  const [state, dispatch] = useReducer(taskCreationReducer, initialTaskCreationState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const mountedRef = useRef(false);
  const registryRef = useRef<TaskRuntimeRegistry | null>(null);

  function getOrCreateRegistry() {
    if (registryRef.current) return registryRef.current;
    const reg = createTaskRuntimeRegistry({
      processingRuntime: pRuntime,
      processingDelays: { pendingMs: PENDING_MS, stepMs: STEP_MS },
      streamingRuntime: sRuntime,
      streamingDelays: { fragmentMs: FRAGMENT_MS },
      completionRuntime: cRuntime,
      completionDelays: { completionMs: COMPLETION_MS },
      stateReader: {
        findTask: (taskId) => stateRef.current.tasks.find((t) => t.taskId === taskId)
      },
      actionSink: {
        dispatch: (action) => {
          if (mountedRef.current) {
            stateRef.current = taskCreationReducer(stateRef.current, action);
            dispatchRef.current(action);
          }
        }
      }
    });
    registryRef.current = reg;
    return reg;
  }

  useEffect(() => {
    mountedRef.current = true;
    const reg = getOrCreateRegistry();
    return () => {
      mountedRef.current = false;
      reg.dispose();
      if (registryRef.current === reg) {
        registryRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    getOrCreateRegistry().syncTasks(state.tasks);
  }, [state.tasks]);

  const activeTask = getActiveTask(state);

  return (
    <div data-testid="harness">
      <div data-testid="task-records">
        {state.tasks.map((t) => (
          <div
            key={t.taskId as string}
            data-testid={`record-${t.taskId as string}`}
            data-status={t.status}
            data-active-step={t.processingSnapshot.steps.find((s) => s.status === "active")?.id ?? "none"}
            data-logs-count={t.processingSnapshot.logs.length}
            data-error={t.error ? t.error.code : "none"}
            data-finalized={t.finalizedResult ? t.finalizedResult.text : "none"}
          />
        ))}
      </div>
      <div data-testid="active-view">
        {activeTask ? (
          <TaskConversation
            task={activeTask}
            routingSummary="Auto-routing"
            clipboardWriter={cRuntime.clipboard}
            canDeleteTask={false}
            onOpenDetails={() => undefined}
            onDeleteTask={() => undefined}
          />
        ) : (
          <p>No active task</p>
        )}
      </div>
      <div className="controls">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "task-created",
              request: { prompt: "Task A prompt", routing: { mode: "auto" } },
              response: { taskId: "TASK-000001" as EntityId<"taskId">, workId: "WORK-000001" as EntityId<"workId">, status: "queued", createdAt: FIXED_TS },
              conversationId: "CONV-000001"
            })
          }
        >
          Create Task A
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "task-created",
              request: { prompt: "FAIL_SIMULATION: Task A", routing: { mode: "auto" } },
              response: { taskId: "TASK-000001" as EntityId<"taskId">, workId: "WORK-000001" as EntityId<"workId">, status: "queued", createdAt: FIXED_TS },
              conversationId: "CONV-000001"
            })
          }
        >
          Create Fail Task A
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "task-created",
              request: { prompt: "Task B prompt", routing: { mode: "auto" } },
              response: { taskId: "TASK-000002" as EntityId<"taskId">, workId: "WORK-000002" as EntityId<"workId">, status: "queued", createdAt: FIXED_TS },
              conversationId: "CONV-000002"
            })
          }
        >
          Create Task B
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "conversation-selected", conversationId: "CONV-000001" })}
        >
          Select Task A
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "conversation-selected", conversationId: "CONV-000002" })}
        >
          Select Task B
        </button>
        <button
          type="button"
          onClick={() => getOrCreateRegistry().cancelTask("TASK-000002" as EntityId<"taskId">)}
        >
          Cancel Task B
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "reset" })}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

afterEach(cleanup);
beforeEach(() => {
  resetTaskIdentitySequence();
});

describe("Task Runtime Isolation", () => {
  it("Test 1 — Two Tasks progress independently", async () => {
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    const user = userEvent.setup();

    render(<IsolationTestHarness pRuntime={pRuntime} sRuntime={sRuntime} cRuntime={cRuntime} />);

    // Create Task A
    await user.click(screen.getByRole("button", { name: "Create Task A" }));
    expect(screen.getByTestId("record-TASK-000001")).toHaveAttribute("data-status", "queued");

    // Create Task B (also activates B)
    await user.click(screen.getByRole("button", { name: "Create Task B" }));
    expect(screen.getByTestId("record-TASK-000002")).toHaveAttribute("data-status", "queued");

    // Verify Task A is not stopped simply because B is active.
    // Both tasks have pending start schedules (PENDING_MS)
    expect(pRuntime.scheduler.pendingCount(PENDING_MS)).toBe(2);

    // Advance the fake scheduler for both tasks
    await act(() => { pRuntime.scheduler.flushNext(PENDING_MS); }); // Task A starts
    await act(() => { pRuntime.scheduler.flushNext(PENDING_MS); }); // Task B starts

    expect(screen.getByTestId("record-TASK-000001")).toHaveAttribute("data-status", "running");
    expect(screen.getByTestId("record-TASK-000002")).toHaveAttribute("data-status", "running");

    // Advance steps for both tasks
    await act(() => { pRuntime.scheduler.flushNext(STEP_MS); }); // Task A step 2
    await act(() => { pRuntime.scheduler.flushNext(STEP_MS); }); // Task B step 2

    expect(screen.getByTestId("record-TASK-000001")).toHaveAttribute("data-active-step", "analyze-request");
    expect(screen.getByTestId("record-TASK-000002")).toHaveAttribute("data-active-step", "analyze-request");
  });

  it("Test 2 — Background completion", async () => {
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    const user = userEvent.setup();

    render(<IsolationTestHarness pRuntime={pRuntime} sRuntime={sRuntime} cRuntime={cRuntime} />);

    // Create Task A
    await user.click(screen.getByRole("button", { name: "Create Task A" }));
    await act(() => { pRuntime.scheduler.flushNext(PENDING_MS); }); // start

    // Create Task B (B becomes active)
    await user.click(screen.getByRole("button", { name: "Create Task B" }));
    await act(() => { pRuntime.scheduler.flushNext(PENDING_MS); }); // start

    // Advance Task A and B to execute step (3 steps each = 6 flushes)
    for (let i = 0; i < 6; i++) {
      await act(() => { pRuntime.scheduler.flushNext(STEP_MS); });
    }

    // Flush streaming fragments for Task A and B (3 fragments each = 6 flushes)
    for (let i = 0; i < 6; i++) {
      await act(() => { sRuntime.scheduler.flushNext(FRAGMENT_MS); });
    }

    // Advance Task A and B through aggregate-result and finalize steps (2 steps each = 4 flushes)
    for (let i = 0; i < 4; i++) {
      await act(() => { pRuntime.scheduler.flushNext(STEP_MS); });
    }

    // Both tasks now have pending completion schedules. Flush Task A's completion.
    await act(() => { cRuntime.scheduler.flushNext(COMPLETION_MS); });

    // Verify A becomes Completed. Verify B remains unchanged (running).
    expect(screen.getByTestId("record-TASK-000001")).toHaveAttribute("data-status", "succeeded");
    expect(screen.getByTestId("record-TASK-000002")).toHaveAttribute("data-status", "running");

    // Verify the visible workspace still represents B until A is selected again.
    expect(within(screen.getByTestId("active-view")).getByText("Task B prompt")).toBeVisible();
    expect(within(screen.getByTestId("active-view")).queryByText("Finalized: Task A prompt")).not.toBeInTheDocument();

    // Select Task A again
    await user.click(screen.getByRole("button", { name: "Select Task A" }));
    expect(within(screen.getByTestId("active-view")).getByText("Finalized: Task A prompt")).toBeVisible();
  });

  it("Test 3 — Background failure isolation", async () => {
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    const user = userEvent.setup();

    render(<IsolationTestHarness pRuntime={pRuntime} sRuntime={sRuntime} cRuntime={cRuntime} />);

    // Create Task A with deterministic FAIL_SIMULATION:
    await user.click(screen.getByRole("button", { name: "Create Fail Task A" }));
    await act(() => { pRuntime.scheduler.flushNext(PENDING_MS); }); // start A

    // Keep Task B active
    await user.click(screen.getByRole("button", { name: "Create Task B" }));
    await act(() => { pRuntime.scheduler.flushNext(PENDING_MS); }); // start B

    // Advance until A fails (aggregate-result step fails on 5th step advancement)
    // 4 step advances each to reach aggregate-result (8 flushes)
    for (let i = 0; i < 8; i++) {
      await act(() => { pRuntime.scheduler.flushNext(STEP_MS); });
    }
    // Next step advance for A triggers failure
    await act(() => { pRuntime.scheduler.flushNext(STEP_MS); });

    // Verify only A becomes Failed.
    expect(screen.getByTestId("record-TASK-000001")).toHaveAttribute("data-status", "failed");
    expect(screen.getByTestId("record-TASK-000002")).toHaveAttribute("data-status", "running");

    // Verify B does not receive A's error, status, logs, or output.
    expect(within(screen.getByTestId("active-view")).getByText("Task B prompt")).toBeVisible();
    expect(within(screen.getByTestId("active-view")).queryByText(/Task Failed/i)).not.toBeInTheDocument();
    expect(within(screen.getByTestId("active-view")).queryByText(/MOCK_AGGREGATION_FAILED/i)).not.toBeInTheDocument();
  });

  it("Test 4 — Isolated cancellation", async () => {
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    const user = userEvent.setup();

    render(<IsolationTestHarness pRuntime={pRuntime} sRuntime={sRuntime} cRuntime={cRuntime} />);

    // Run A and B
    await user.click(screen.getByRole("button", { name: "Create Task A" }));
    await user.click(screen.getByRole("button", { name: "Create Task B" }));
    await act(() => { pRuntime.scheduler.flushNext(PENDING_MS); }); // start A
    await act(() => { pRuntime.scheduler.flushNext(PENDING_MS); }); // start B

    // Cancel B
    await user.click(screen.getByRole("button", { name: "Cancel Task B" }));

    // Verify B becomes Canceled.
    expect(screen.getByTestId("record-TASK-000002")).toHaveAttribute("data-status", "cancelled");

    // Verify A continues processing. Verify no handle belonging to A is stopped.
    expect(screen.getByTestId("record-TASK-000001")).toHaveAttribute("data-status", "running");
    expect(pRuntime.scheduler.pendingCount(STEP_MS)).toBe(1);

    await act(() => { pRuntime.scheduler.flushNext(STEP_MS); });
    expect(screen.getByTestId("record-TASK-000001")).toHaveAttribute("data-active-step", "analyze-request");
  });

  it("Test 5 — Reset or unmount cleanup", async () => {
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    const user = userEvent.setup();

    const { unmount } = render(<IsolationTestHarness pRuntime={pRuntime} sRuntime={sRuntime} cRuntime={cRuntime} />);

    await user.click(screen.getByRole("button", { name: "Create Task A" }));
    expect(pRuntime.scheduler.pendingCount(PENDING_MS)).toBe(1);

    // Required invariant: all remaining scheduled handles are canceled; no late callback updates removed or unmounted Task state.
    unmount();
    expect(pRuntime.scheduler.pendingCount(PENDING_MS)).toBe(0);
  });

  it("Test 6 — Strict Mode idempotency", async () => {
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    const user = userEvent.setup();

    render(
      <StrictMode>
        <IsolationTestHarness pRuntime={pRuntime} sRuntime={sRuntime} cRuntime={cRuntime} />
      </StrictMode>
    );

    await user.click(screen.getByRole("button", { name: "Create Task A" }));
    // Verify no duplicate Task creation, no duplicate processing-start event
    expect(pRuntime.scheduler.pendingCount(PENDING_MS)).toBe(1);
    await act(() => { pRuntime.scheduler.flushNext(PENDING_MS); });
    expect(pRuntime.scheduler.pendingCount(PENDING_MS)).toBe(0);
    expect(pRuntime.scheduler.pendingCount(STEP_MS)).toBe(1);
  });
});
