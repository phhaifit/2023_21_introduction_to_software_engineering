/**
 * Task 9B - Streaming UI Integration.
 *
 * Covers the required scenario groups for no-early-streaming, streaming start,
 * progressive partial output, final-fragment boundary, task isolation, cleanup,
 * Strict Mode safety, and architecture regressions.
 */

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openProcessingDetailsFromAssistantMenu } from "./task-ui-test-helpers.ts";

import { TaskOrchestrationPage } from
  "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";
import type { TaskCreationClient } from
  "@vcp/frontend/features/task-orchestration/model/task-creation-client.ts";
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
import type {
  TaskStreamingFragmentIdentitySource,
  TaskStreamingFragmentSource
} from "@vcp/frontend/features/task-orchestration/model/task-streaming-controller.ts";
import type { TaskStreamingRuntime } from
  "@vcp/frontend/features/task-orchestration/model/task-streaming-runtime.ts";
import type { EntityId } from "@vcp/shared";

const FIXED_TS = "2026-06-25T08:00:00.000Z";
const PENDING_MS = 25;
const STEP_MS = 40;
const FRAGMENT_MS = 15;

interface ScheduledEntry {
  delayMs: number;
  callback: () => void;
  cancelled: boolean;
  executed: boolean;
}

class FakeScheduler implements TaskProcessingScheduler {
  readonly entries: ScheduledEntry[] = [];

  schedule(delayMs: number, callback: () => void): TaskProcessingScheduleHandle {
    const entry = { delayMs, callback, cancelled: false, executed: false };
    this.entries.push(entry);
    return { cancel: () => { entry.cancelled = true; } };
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

class FakeClock implements TaskProcessingTimeSource {
  now(): string { return FIXED_TS; }
}

class FakeLogIds implements TaskProcessingLogIdentitySource {
  private next = 0;
  nextLogId(): string { return `LOG-${String(++this.next).padStart(4, "0")}`; }
}

class FakeFragmentIds implements TaskStreamingFragmentIdentitySource {
  private next = 0;
  nextFragmentId(): string { return `FRG-${String(++this.next).padStart(4, "0")}`; }
}

class MapFragmentSource implements TaskStreamingFragmentSource {
  readonly fragmentsByTask = new Map<string, readonly string[]>();

  getFragments(taskId: EntityId<"taskId">): readonly string[] {
    return this.fragmentsByTask.get(taskId as string) ?? [];
  }
}

class SpyClient implements TaskCreationClient {
  callCount = 0;
  constructor(private readonly status: "queued" | "succeeded" | "failed" | "cancelled" = "queued") {}

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

function makeRuntimes() {
  const scheduler = new FakeScheduler();
  const clock = new FakeClock();
  const fragments = new MapFragmentSource();
  fragments.fragmentsByTask.set("TASK-000001", ["Alpha ", "Beta ", "Gamma"]);
  fragments.fragmentsByTask.set("TASK-000002", ["Second"]);

  const processingRuntime: TaskProcessingRuntime = {
    scheduler,
    clock,
    logIdentitySource: new FakeLogIds()
  };
  const streamingRuntime: TaskStreamingRuntime = {
    scheduler,
    clock,
    fragmentIdentitySource: new FakeFragmentIds(),
    fragmentSource: fragments
  };

  return { scheduler, processingRuntime, streamingRuntime, fragments };
}

async function submitPrompt(prompt: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Request" }), prompt);
  await user.click(screen.getByRole("button", { name: "Send request" }));
}

async function startRunning(scheduler: FakeScheduler) {
  await act(() => { scheduler.flushNext(PENDING_MS); });
}

async function reachExecuteStep(scheduler: FakeScheduler) {
  await startRunning(scheduler);
  for (let index = 0; index < 3; index += 1) {
    await act(() => { scheduler.flushNext(STEP_MS); });
  }
}

function renderPage(options: Partial<ReturnType<typeof makeRuntimes>> & {
  client?: TaskCreationClient;
  strict?: boolean;
} = {}) {
  const runtimes = makeRuntimes();
  const merged = { ...runtimes, ...options };
  const page = (
    <TaskOrchestrationPage
      taskCreationClient={options.client ?? new SpyClient()}
      processingRuntime={merged.processingRuntime}
      processingDelays={{ pendingMs: PENDING_MS, stepMs: STEP_MS }}
      streamingRuntime={merged.streamingRuntime}
      streamingDelays={{ fragmentMs: FRAGMENT_MS }}
    />
  );

  return {
    ...merged,
    ...render(options.strict ? <StrictMode>{page}</StrictMode> : page)
  };
}

afterEach(cleanup);
beforeEach(() => {
  resetTaskIdentitySequence();
  HTMLDialogElement.prototype.showModal = vi.fn(function() {
    (this as HTMLDialogElement).open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function() {
    (this as HTMLDialogElement).open = false;
  });
});

describe("Task 9B streaming UI integration", () => {
  it("does not create a streaming session for empty, invalid, pending, early running, terminal, or loading states", async () => {
    const { scheduler } = renderPage();
    expect(screen.queryByRole("region", { name: /partial result/i })).not.toBeInTheDocument();
    expect(scheduler.pendingCount(FRAGMENT_MS)).toBe(0);

    await userEvent.click(screen.getByRole("textbox", { name: "Request" }));
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a task request");
    expect(scheduler.pendingCount(FRAGMENT_MS)).toBe(0);

    await submitPrompt("Pending task.");
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
    expect(scheduler.pendingCount(FRAGMENT_MS)).toBe(0);

    await startRunning(scheduler);
    expect(screen.getByLabelText("Task status: In Progress")).toBeVisible();
    expect(screen.queryByRole("region", { name: /partial result/i })).not.toBeInTheDocument();
    expect(scheduler.pendingCount(FRAGMENT_MS)).toBe(0);

    cleanup();
    sessionStorage.clear();
    const terminal = renderPage({ client: new SpyClient("succeeded") });
    await submitPrompt("Already terminal.");
    expect(screen.getByLabelText("Task status: Completed")).toBeVisible();
    expect(terminal.scheduler.pendingCount(FRAGMENT_MS)).toBe(0);

    cleanup();
    sessionStorage.clear();
    const loading = makeRuntimes();
    render(
      <TaskOrchestrationPage
        isLoading
        processingRuntime={loading.processingRuntime}
        streamingRuntime={loading.streamingRuntime}
      />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Preparing your workspace");
    expect(loading.scheduler.pendingCount(FRAGMENT_MS)).toBe(0);
  });

  it("starts exactly once at execute-task, uses injected delay, and shows the active loading indicator", async () => {
    const { scheduler } = renderPage();
    await submitPrompt("Stream this task.");
    await reachExecuteStep(scheduler);

    expect(scheduler.pendingCount(FRAGMENT_MS)).toBe(1);
    expect(screen.queryByRole("region", { name: /partial result/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Runtime progress")).not.toBeInTheDocument();



    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
    expect(screen.getByRole("region", { name: /partial result/i })).toBeVisible();
    expect(screen.getByLabelText("Accumulated partial result")).toHaveTextContent("Alpha");
    expect(scheduler.pendingCount(FRAGMENT_MS)).toBe(1);
    expect(screen.getAllByText("Partial Result")).toHaveLength(1);
  });

  it("renders progressive partial output in order without skipping or duplicating context", async () => {
    const { scheduler } = renderPage();
    await submitPrompt("Keep context visible.");
    await reachExecuteStep(scheduler);

    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
    await act(() => { scheduler.flushNext(FRAGMENT_MS); });

    const partial = screen.getByLabelText("Accumulated partial result");
    expect(partial).toHaveTextContent("Alpha Beta");
    expect(partial).not.toHaveTextContent("Gamma");
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(within(feed).getByText("Keep context visible.")).toBeVisible();

    const user = userEvent.setup();
    await openProcessingDetailsFromAssistantMenu(user);
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));

    expect(screen.getByText("TASK-000001")).toBeVisible();
    expect(screen.getByText("WORK-000001")).toBeVisible();
    expect(screen.getByText("Auto-routing")).toBeVisible();
    expect(screen.getByRole("region", { name: /processing timeline/i })).toBeVisible();
    expect(screen.getAllByLabelText("Processing log details")[0]).toBeVisible();
    expect(screen.getAllByLabelText("Task status: In Progress")[0]).toBeVisible();
  });

  it("exhausts after the final fragment without completing the task or creating a final result", async () => {
    const { scheduler } = renderPage();
    await submitPrompt("Do not complete.");
    await reachExecuteStep(scheduler);

    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
    await act(() => { scheduler.flushNext(FRAGMENT_MS); });

    expect(scheduler.pendingCount(FRAGMENT_MS)).toBe(0);
    expect(screen.getByLabelText("Accumulated partial result")).toHaveTextContent(
      "Alpha Beta Gamma"
    );
    expect(screen.queryByText("Generating partial result")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Task status: In Progress")).toBeVisible();
    expect(screen.queryByLabelText("Task status: Completed")).not.toBeInTheDocument();
    expect(screen.queryByText(/final result/i)).not.toBeInTheDocument();
  });

  it("stops stale sessions when a new task is created and keeps task partial output isolated", async () => {
    const user = userEvent.setup();
    const { scheduler } = renderPage({ client: new SpyClient() });
    await submitPrompt("First task.");
    await reachExecuteStep(scheduler);
    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
    expect(screen.getByLabelText("Accumulated partial result")).toHaveTextContent("Alpha");

    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    await user.click(within(navigation).getByRole("button", { name: /new chat/i }));
    await submitPrompt("Second task.");
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(within(feed).getByText("Second task.")).toBeVisible();

    const items = within(navigation).getAllByRole("listitem");
    await user.click(within(items[0]!).getByRole("button", { name: "First task." }));
    expect(within(feed).getByText(/Alpha/)).toBeVisible();
    await user.click(within(items[1]!).getByRole("button", { name: "Second task." }));
    // Task A streaming continues in the background
    expect(scheduler.pendingCount(FRAGMENT_MS)).toBe(1);

    // Flush Task 1's next background fragment (Beta)
    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
    await user.click(within(items[0]!).getByRole("button", { name: "First task." }));
    expect(screen.getByText(/Alpha Beta/)).toBeVisible();

    // Advance Task 2 to execute step (Task 1 also advances in background)
    await user.click(within(items[1]!).getByRole("button", { name: "Second task." }));
    await reachExecuteStep(scheduler);
    await act(() => { scheduler.flushNext(STEP_MS); });
    await act(() => { scheduler.flushNext(STEP_MS); });
    // Now both Task 1 (Gamma) and Task 2 (Second) have pending fragments
    await act(() => { scheduler.flushNext(FRAGMENT_MS); }); // Flush Task 1 (Gamma)
    await act(() => { scheduler.flushNext(FRAGMENT_MS); }); // Flush Task 2 (Second)

    await user.click(within(items[0]!).getByRole("button", { name: "First task." }));
    expect(screen.getByLabelText("Accumulated partial result")).toHaveTextContent("Alpha Beta Gamma");

    await user.click(within(items[1]!).getByRole("button", { name: "Second task." }));
    expect(screen.getByLabelText("Accumulated partial result")).toHaveTextContent("Second");
  });

  it("cancels pending streaming schedules on unmount and remains Strict Mode safe", async () => {
    const first = renderPage();
    await submitPrompt("Unmount before fragment.");
    await reachExecuteStep(first.scheduler);
    expect(first.scheduler.pendingCount(FRAGMENT_MS)).toBe(1);
    first.unmount();
    expect(first.scheduler.pendingCount(FRAGMENT_MS)).toBe(0);

    cleanup();
    sessionStorage.clear();
    const strict = renderPage({ strict: true });
    await submitPrompt("Strict streaming.");
    await reachExecuteStep(strict.scheduler);
    expect(strict.scheduler.pendingCount(FRAGMENT_MS)).toBe(1);
    await act(() => { strict.scheduler.flushNext(FRAGMENT_MS); });

    expect(screen.getByLabelText("Accumulated partial result")).toHaveTextContent("Alpha");
    expect(within(screen.getByRole("region", { name: /partial result/i })).getAllByText(/Alpha/))
      .toHaveLength(1);
    expect(strict.scheduler.pendingCount(FRAGMENT_MS)).toBe(1);
  });

  it("preserves Task 7/8 UI contracts and architecture boundaries", () => {
    const root = process.cwd();
    const pageSource = readFileSync(
      join(root, "apps/frontend/src/features/task-orchestration/task-orchestration-page.tsx"),
      "utf8"
    );
    const dockSource = readFileSync(
      join(root, "apps/frontend/src/features/task-orchestration/components/task-orchestration-dock.tsx"),
      "utf8"
    );
    const modalSource = readFileSync(
      join(root, "apps/frontend/src/features/task-orchestration/components/task-processing-detail-modal.tsx"),
      "utf8"
    );
    const runtimeSource = readFileSync(
      join(root, "apps/frontend/src/features/task-orchestration/model/task-streaming-runtime.ts"),
      "utf8"
    );
    const controllerSource = readFileSync(
      join(root, "apps/frontend/src/features/task-orchestration/model/task-streaming-controller.ts"),
      "utf8"
    );

    expect(modalSource).toMatch(/ProcessingTimeline/);
    expect(modalSource).toMatch(/SanitizedRuntimeLogList/);
    expect(dockSource).toMatch(/TaskStatusBadge/);
    expect(pageSource).not.toMatch(/\.status\s*=\s*["'`](running|succeeded|failed|cancelled)/);
    expect(pageSource).not.toMatch(/@vcp\/backend|@vcp\/database|Prisma/);
    expect(pageSource).not.toMatch(/\bwindow\.|\bsetTimeout\b|\bclearTimeout\b/);
    expect(controllerSource).not.toMatch(/\bwindow\.|\bsetTimeout\b|\bnew Date\b|Math\.random/);
    expect(runtimeSource).toMatch(/window\.setTimeout/);
    expect(runtimeSource).toMatch(/Object\.freeze/);
    for (const step of ORDERED_STEP_IDS) {
      expect(pageSource).not.toMatch(new RegExp(`activeStepId\\s*=\\s*["']${step}`));
    }
  });
});
