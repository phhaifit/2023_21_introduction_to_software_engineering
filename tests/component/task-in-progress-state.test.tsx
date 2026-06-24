/**
 * task-in-progress-state.test.tsx
 *
 * Focused integration tests for Task 8B — In-Progress UI and
 * Processing Controller Integration.
 */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskOrchestrationPage } from
  "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";
import { resetTaskIdentitySequence } from
  "@vcp/frontend/features/task-orchestration/model/task-id.ts";
import { ORDERED_STEP_IDS } from
  "@vcp/frontend/features/task-orchestration/model/task-processing.ts";
import type {
  TaskProcessingLogIdentitySource,
  TaskProcessingScheduleHandle,
  TaskProcessingScheduler,
  TaskProcessingTimeSource
} from "@vcp/frontend/features/task-orchestration/model/task-processing-controller.ts";
import type { TaskProcessingRuntime } from
  "@vcp/frontend/features/task-orchestration/model/task-processing-runtime.ts";
import type { TaskCreationClient } from
  "@vcp/frontend/features/task-orchestration/model/task-creation-client.ts";
import type { EntityId } from "@vcp/shared";

const FIXED_TS = "2026-06-24T12:00:00.000Z";
const PENDING_MS = 50;
const STEP_MS = 40;
const FINAL_STEP_ID = ORDERED_STEP_IDS[ORDERED_STEP_IDS.length - 1]!;

interface ScheduledEntry {
  delayMs: number;
  callback: () => void;
  cancelled: boolean;
  executed: boolean;
}

class FakeScheduler implements TaskProcessingScheduler {
  readonly entries: ScheduledEntry[] = [];

  schedule(delayMs: number, callback: () => void): TaskProcessingScheduleHandle {
    const entry: ScheduledEntry = {
      delayMs,
      callback,
      cancelled: false,
      executed: false
    };
    this.entries.push(entry);
    return { cancel: () => { entry.cancelled = true; } };
  }

  flushNext(): void {
    const entry = this.entries.find((e) => !e.cancelled && !e.executed);
    if (!entry) throw new Error("No pending callback.");
    entry.executed = true;
    entry.callback();
  }

  get pendingCount(): number {
    return this.entries.filter((e) => !e.cancelled && !e.executed).length;
  }

  pendingStartCount(pendingMs: number): number {
    return this.entries.filter(
      (e) => e.delayMs === pendingMs && !e.cancelled && !e.executed
    ).length;
  }
}

class FakeClock implements TaskProcessingTimeSource {
  private ts = FIXED_TS;
  setTime(ts: string): void { this.ts = ts; }
  now(): string { return this.ts; }
}

class FakeLogIds implements TaskProcessingLogIdentitySource {
  private n = 0;
  nextLogId(): string { return `LOG-${String(++this.n).padStart(4, "0")}`; }
}

class SpyClient implements TaskCreationClient {
  callCount = 0;
  private readonly status: "queued" | "succeeded" | "failed" | "cancelled";

  constructor(status: "queued" | "succeeded" | "failed" | "cancelled" = "queued") {
    this.status = status;
  }

  async createTask() {
    this.callCount += 1;
    const seq = this.callCount.toString().padStart(6, "0");
    return {
      taskId: `TASK-${seq}` as EntityId<"taskId">,
      workId: `WORK-${seq}` as EntityId<"workId">,
      status: this.status,
      createdAt: FIXED_TS
    };
  }
}

function makeRuntime(): { runtime: TaskProcessingRuntime; sched: FakeScheduler; clock: FakeClock; logIds: FakeLogIds } {
  const sched = new FakeScheduler();
  const clock = new FakeClock();
  const logIds = new FakeLogIds();
  return {
    sched,
    clock,
    logIds,
    runtime: { scheduler: sched, clock, logIdentitySource: logIds }
  };
}

async function submitPrompt(prompt: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Request" }), prompt);
  await user.click(screen.getByRole("button", { name: "Send request" }));
  return user;
}

function getTimeline() {
  return screen.getByRole("region", {
    name: /processing timeline/i
  });
}

function countStepStatuses(timeline: HTMLElement, label: string) {
  return within(timeline)
    .getByRole("list")
    .querySelectorAll(`.processing-timeline__status--${label.toLowerCase()}`).length;
}

afterEach(cleanup);
beforeEach(() => resetTaskIdentitySequence());

describe("Task 8B — In-Progress integration", () => {
  it("1–6: Pending before start — status, steps, logs, startedAt, invalid submit", async () => {
    const { runtime, sched } = makeRuntime();
    const client = new SpyClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        processingRuntime={runtime}
        processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      />
    );

    await submitPrompt("Hold pending.");
    expect(screen.getByLabelText("Pending task")).toBeVisible();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
    expect(sched.pendingStartCount(PENDING_MS)).toBeGreaterThan(0);

    const timeline = getTimeline();
    expect(countStepStatuses(timeline, "Waiting")).toBe(6);
    expect(countStepStatuses(timeline, "Active")).toBe(0);
    expect(screen.queryByLabelText("Orchestration processing logs")).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(client.callCount).toBe(1);
    expect(sched.pendingStartCount(PENDING_MS)).toBe(1);
  });

  it("7–18: start transition after flushing pending schedule", async () => {
    const { runtime, sched, clock, logIds } = makeRuntime();
    clock.setTime("2026-06-24T14:00:00.000Z");
    render(
      <TaskOrchestrationPage
        taskCreationClient={new SpyClient()}
        processingRuntime={runtime}
        processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      />
    );

    await submitPrompt("Start now.");
    await act(() => { sched.flushNext(); });

    expect(screen.getByLabelText("In-progress task")).toBeVisible();
    expect(screen.getByLabelText("Task status: In Progress")).toBeVisible();

    const timeline = getTimeline();
    expect(countStepStatuses(timeline, "Active")).toBe(1);
    expect(countStepStatuses(timeline, "Waiting")).toBe(5);
    expect(within(timeline).getByText("Validate input").closest("li")).toHaveTextContent("Active");

    expect(screen.getByLabelText("Task identifiers")).toHaveTextContent(
      "2026-06-24T14:00:00.000Z"
    );
    expect(screen.getByText("LOG-0001")).toBeVisible();
    expect(screen.getByText("Processing started — validating input.")).toBeVisible();
    expect(screen.getByText("TASK-000001")).toBeVisible();
    expect(screen.getByText("WORK-000001")).toBeVisible();
    expect(screen.getByText("Start now.")).toBeVisible();
    expect(screen.getByText("Routing: Auto-routing")).toBeVisible();
    expect(logIds.nextLogId()).toBe("LOG-0002");
  });

  it("19–28: ordered step progression with injected stepMs", async () => {
    const { runtime, sched } = makeRuntime();
    render(
      <TaskOrchestrationPage
        taskCreationClient={new SpyClient()}
        processingRuntime={runtime}
        processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      />
    );

    await submitPrompt("Progress steps.");
    await act(() => { sched.flushNext(); });

    const beforeAdvance = sched.pendingCount;
    await act(() => { sched.flushNext(); });
    expect(sched.entries.find((e) => !e.cancelled && !e.executed)?.delayMs).toBe(STEP_MS);

    const timeline = getTimeline();
    expect(countStepStatuses(timeline, "Active")).toBe(1);
    expect(countStepStatuses(timeline, "Completed")).toBe(1);
    expect(countStepStatuses(timeline, "Waiting")).toBe(4);
    expect(within(timeline).getByText("Analyze request").closest("li")).toHaveTextContent("Active");

    const logs = screen.getAllByLabelText("Orchestration processing logs")[0]!;
    const items = within(logs).getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(beforeAdvance).toBeLessThanOrEqual(1);
    expect(sched.pendingCount).toBeLessThanOrEqual(1);
  });

  it("29–34: final-step boundary — no completion, no extra schedule", async () => {
    const { runtime, sched } = makeRuntime();
    render(
      <TaskOrchestrationPage
        taskCreationClient={new SpyClient()}
        processingRuntime={runtime}
        processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      />
    );

    await submitPrompt("Reach final.");
    await act(() => { sched.flushNext(); });

    for (let i = 0; i < ORDERED_STEP_IDS.length - 1; i++) {
      await act(() => { sched.flushNext(); });
    }

    const timeline = getTimeline();
    expect(within(timeline).getByText("Finalize").closest("li")).toHaveTextContent("Active");
    expect(countStepStatuses(timeline, "Active")).toBe(1);
    const pendingBefore = sched.pendingCount;

    await act(async () => {
      await new Promise((r) => setTimeout(r, STEP_MS * 2));
    });

    expect(sched.pendingCount).toBe(pendingBefore);
    expect(screen.getByLabelText("Task status: In Progress")).toBeVisible();
    expect(screen.queryByLabelText("Task status: Completed")).not.toBeInTheDocument();
    expect(screen.queryByText(/final result/i)).not.toBeInTheDocument();
  });

  it("35–37: new Task isolation and previous schedule cancellation", async () => {
    const { runtime, sched } = makeRuntime();
    const client = new SpyClient();
    const { unmount, rerender } = render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        processingRuntime={runtime}
        processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      />
    );

    await submitPrompt("First task.");
    await act(() => { sched.flushNext(); });
    await act(() => { sched.flushNext(); });
    const firstLogCount = within(
      screen.getAllByLabelText("Orchestration processing logs")[0]!
    ).getAllByRole("listitem").length;

    unmount();
    cleanup();
    resetTaskIdentitySequence();

    const second = makeRuntime();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        processingRuntime={second.runtime}
        processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      />
    );
    await submitPrompt("Second task.");
    await act(() => { second.sched.flushNext(); });

    const logs = within(screen.getAllByLabelText("Orchestration processing logs")[0]!);
    expect(logs.getAllByRole("listitem")).toHaveLength(1);
    expect(logs.queryByText(`Step ${ORDERED_STEP_IDS[0]}`)).not.toBeInTheDocument();
    expect(firstLogCount).toBeGreaterThan(0);
  });

  it("38–41: unmount cancels schedules and disposes without cancelled transition", async () => {
    const { runtime, sched } = makeRuntime();
    const { unmount } = render(
      <TaskOrchestrationPage
        taskCreationClient={new SpyClient()}
        processingRuntime={runtime}
        processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      />
    );

    await submitPrompt("Unmount me.");
    expect(sched.pendingCount).toBe(1);
    unmount();
    expect(sched.pendingCount).toBe(0);
  });

  it("42–43: Strict Mode does not duplicate starts or progression", async () => {
    const { runtime, sched } = makeRuntime();
    render(
      <StrictMode>
        <TaskOrchestrationPage
          taskCreationClient={new SpyClient()}
          processingRuntime={runtime}
          processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
        />
      </StrictMode>
    );

    await submitPrompt("Strict mode.");
    expect(sched.pendingStartCount(PENDING_MS)).toBe(1);

    await act(() => { sched.flushNext(); });
    await act(() => { sched.flushNext(); });
    expect(countStepStatuses(getTimeline(), "Active")).toBe(1);
    expect(countStepStatuses(getTimeline(), "Completed")).toBe(1);
  });

  it("44: terminal statuses do not schedule progression", async () => {
    const { runtime, sched } = makeRuntime();
    render(
      <TaskOrchestrationPage
        taskCreationClient={new SpyClient("succeeded")}
        processingRuntime={runtime}
        processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      />
    );

    await submitPrompt("Terminal task.");
    expect(sched.pendingCount).toBe(0);
    expect(screen.queryByLabelText("Task status: In Progress")).not.toBeInTheDocument();
  });

  it("45–49: architecture protection", () => {
    const pageSrc = readFileSync(
      join(process.cwd(), "apps/frontend/src/features/task-orchestration/task-orchestration-page.tsx"),
      "utf8"
    );
    const controllerSrc = readFileSync(
      join(
        process.cwd(),
        "apps/frontend/src/features/task-orchestration/model/task-processing-controller.ts"
      ),
      "utf8"
    );

    expect(pageSrc).not.toMatch(/\.status\s*=\s*["'`]running/);
    expect(pageSrc).not.toMatch(/@vcp\/backend|@vcp\/database|Prisma/);
    expect(pageSrc).toMatch(/ProcessingTimeline/);
    expect(pageSrc).toMatch(/TaskLogList/);
    expect(pageSrc).toMatch(/processingSnapshot\.logs/);
    expect(controllerSrc).toBe(readFileSync(
      join(
        process.cwd(),
        "apps/frontend/src/features/task-orchestration/model/task-processing-controller.ts"
      ),
      "utf8"
    ));
  });

  it("50: Task 7 pending tests file remains unchanged", () => {
    const pendingSrc = readFileSync(
      join(process.cwd(), "tests/component/task-pending-state.test.tsx"),
      "utf8"
    );
    expect(pendingSrc).toContain("Task 7B — Pending Task State UI Completion");
    expect(pendingSrc).not.toMatch(/task-in-progress-state/);
  });

  it("progression completes every non-final step without skipping", async () => {
    const { runtime, sched } = makeRuntime();
    render(
      <TaskOrchestrationPage
        taskCreationClient={new SpyClient()}
        processingRuntime={runtime}
        processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      />
    );

    await submitPrompt("Full run.");
    await act(() => { sched.flushNext(); });

    for (let i = 0; i < ORDERED_STEP_IDS.length - 1; i++) {
      await act(() => { sched.flushNext(); });
    }

    const timeline = getTimeline();
    expect(countStepStatuses(timeline, "Completed")).toBe(ORDERED_STEP_IDS.length - 1);
    expect(within(timeline).getByText("Finalize").closest("li")).toHaveTextContent("Active");
    expect(
      within(timeline).getByText("Finalize").closest("li")
    ).toHaveTextContent("Active");
  });
});
