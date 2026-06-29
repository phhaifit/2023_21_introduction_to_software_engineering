/**
 * Task 10B - Completed Result UI Integration.
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
import type { TaskCompletionRuntime, TaskClipboardWriter } from
  "@vcp/frontend/features/task-orchestration/model/task-completion-runtime.ts";
import type { TaskFinalizedResultSource } from
  "@vcp/frontend/features/task-orchestration/model/task-completion-controller.ts";
import { createDefaultFinalizedResultSource } from
  "@vcp/frontend/features/task-orchestration/model/task-completion-runtime.ts";
import type { EntityId } from "@vcp/shared";

const FIXED_TS = "2026-06-25T08:00:00.000Z";
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

class FakeClipboardWriter implements TaskClipboardWriter {
  writtenText: string | null = null;
  shouldFail = false;

  async writeText(text: string): Promise<void> {
    if (this.shouldFail) {
      throw new Error("Simulated clipboard failure");
    }
    this.writtenText = text;
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
  const clipboardWriter = new FakeClipboardWriter();
  const completionRuntime: TaskCompletionRuntime = {
    scheduler,
    clipboard: clipboardWriter,
    resultSource: createDefaultFinalizedResultSource()
  };

  return { scheduler, processingRuntime, streamingRuntime, completionRuntime, fragments, clipboardWriter };
}

async function submitPrompt(prompt: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Request" }), prompt);
  await user.click(screen.getByRole("button", { name: "Send request" }));
  const feed = screen.getByRole("region", { name: /conversation/i });
  await within(feed).findByText(prompt);
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

async function completeTask(scheduler: FakeScheduler, numFragments = 3) {
  await reachExecuteStep(scheduler);
  // execute-task step streaming
  for (let i = 0; i < numFragments; i++) {
    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
  }
  // Next step
  await act(() => { scheduler.flushNext(STEP_MS); });
  // Final step
  await act(() => { scheduler.flushNext(STEP_MS); });
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
      completionRuntime={merged.completionRuntime}
      completionDelays={{ completionMs: COMPLETION_MS }}
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

describe("Task 10B Completed Result UI Integration", () => {
  it("does not complete early for empty, pending, running before final step, or streaming", async () => {
    const { scheduler } = renderPage();
    expect(scheduler.pendingCount(COMPLETION_MS)).toBe(0);

    await userEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(scheduler.pendingCount(COMPLETION_MS)).toBe(0);

    await submitPrompt("Pending task.");
    expect(scheduler.pendingCount(COMPLETION_MS)).toBe(0);

    await startRunning(scheduler);
    expect(scheduler.pendingCount(COMPLETION_MS)).toBe(0);

    // Reach execute step (already started, so just 3 steps)
    for (let index = 0; index < 3; index += 1) {
      await act(() => { scheduler.flushNext(STEP_MS); });
    }
    expect(scheduler.pendingCount(COMPLETION_MS)).toBe(0);

    // Stream first chunk
    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
    expect(scheduler.pendingCount(COMPLETION_MS)).toBe(0);

    // Stream to exhaustion
    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
    await act(() => { scheduler.flushNext(FRAGMENT_MS); });
    
    // Partial output alone does not render final assistant response.
    expect(screen.queryByRole("region", { name: /completed result/i })).not.toBeInTheDocument();
    expect(scheduler.pendingCount(COMPLETION_MS)).toBe(0);
  });

  it("completes when final step is active and streaming exhausted", async () => {
    const { scheduler } = renderPage();
    await submitPrompt("Complete me.");
    await completeTask(scheduler);
    
    expect(scheduler.pendingCount(COMPLETION_MS)).toBe(1);
    await act(() => { scheduler.flushNext(COMPLETION_MS); });

    expect(screen.getByLabelText("Task status: Completed")).toBeVisible();
    expect(screen.getByText("Alpha Beta Gamma")).toBeVisible();
    expect(screen.queryByText("Completed Result")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy finalized result" })).not.toBeInTheDocument();
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(within(feed).getByText("Complete me.")).toBeVisible();
    expect(screen.queryByRole("region", { name: /partial result/i })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await openProcessingDetailsFromAssistantMenu(user);
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));

    expect(screen.getByText("TASK-000001")).toBeVisible();
    expect(screen.getByText("WORK-000001")).toBeVisible();
    expect(screen.getByText("Auto-routing")).toBeVisible();
    expect(screen.getByRole("region", { name: /processing timeline/i })).toBeVisible();
  });

  it("supports exactly once completion and terminal protection", async () => {
    const { scheduler } = renderPage();
    await submitPrompt("Complete me once.");
    await completeTask(scheduler);
    await act(() => { scheduler.flushNext(COMPLETION_MS); });

    expect(scheduler.pendingCount(COMPLETION_MS)).toBe(0);
    expect(screen.queryByRole("button", { name: "Cancel current task" })).not.toBeInTheDocument();

    // No late logs or steps or streaming chunks
    expect(scheduler.pendingCount(STEP_MS)).toBe(0);
    expect(scheduler.pendingCount(FRAGMENT_MS)).toBe(0);
  });

  it("supports response copy from the assistant actions menu", async () => {
    const { scheduler, clipboardWriter } = renderPage();
    const user = userEvent.setup();

    await submitPrompt("Test copy.");
    await completeTask(scheduler);
    await act(() => { scheduler.flushNext(COMPLETION_MS); });

    await user.click(
      within(screen.getByLabelText("Assistant response")).getByRole("button", {
        name: "More actions for this work"
      })
    );
    await user.click(screen.getByRole("menuitem", { name: "Copy response" }));

    expect(clipboardWriter.writtenText).toBe("Alpha Beta Gamma");
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  it("stops stale sessions when task changes or unmounts, tasks isolated", async () => {
    const user = userEvent.setup();
    const first = renderPage({ client: new SpyClient() });
    await submitPrompt("First task.");
    await completeTask(first.scheduler);
    expect(first.scheduler.pendingCount(COMPLETION_MS)).toBe(1);

    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    await user.click(within(navigation).getByRole("button", { name: /new chat/i }));
    await submitPrompt("Second task.");
    // Creating another Task does not stop the first Task; the first Task continues in the background.
    expect(first.scheduler.pendingCount(COMPLETION_MS)).toBe(1);

    // Flush the background completion for Task 1
    await act(() => { first.scheduler.flushNext(COMPLETION_MS); });

    const items = within(navigation).getAllByRole("listitem");
    await user.click(within(items[0]!).getByRole("button", { name: "First task." }));
    expect(screen.getAllByText("Alpha Beta Gamma")).toHaveLength(1);

    await user.click(within(items[1]!).getByRole("button", { name: "Second task." }));
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(within(feed).getByText("Second task.")).toBeVisible();

    // Progress Task 2 to completion
    await completeTask(first.scheduler, 1);
    expect(first.scheduler.pendingCount(COMPLETION_MS)).toBe(1);
    // Unmount stops remaining runtime resources
    first.unmount();
    expect(first.scheduler.pendingCount(COMPLETION_MS)).toBe(0);
  });

  it("remains Strict Mode safe", async () => {
    const strict = renderPage({ strict: true });
    await submitPrompt("Strict complete.");
    await completeTask(strict.scheduler);
    expect(strict.scheduler.pendingCount(COMPLETION_MS)).toBe(1);
    await act(() => { strict.scheduler.flushNext(COMPLETION_MS); });
    expect(strict.scheduler.pendingCount(COMPLETION_MS)).toBe(0);
    expect(screen.getAllByText(/Alpha Beta Gamma/)).toHaveLength(1);
  });

  it("preserves Task 7-9 UI contracts and architecture boundaries", () => {
    const root = process.cwd();
    const pageSource = readFileSync(
      join(root, "apps/frontend/src/features/task-orchestration/task-orchestration-page.tsx"),
      "utf8"
    );
    const conversationSource = readFileSync(
      join(root, "apps/frontend/src/features/task-orchestration/components/task-conversation.tsx"),
      "utf8"
    );
    const runtimeSource = readFileSync(
      join(root, "apps/frontend/src/features/task-orchestration/model/task-completion-runtime.ts"),
      "utf8"
    );
    
    expect(conversationSource).toMatch(/TaskCompletedResult/);
    expect(pageSource).not.toMatch(/\.status\s*=\s*["'`]succeeded/);
    expect(pageSource).not.toMatch(/@vcp\/backend|@vcp\/database|Prisma/);
    expect(pageSource).not.toMatch(/\bwindow\.|\bsetTimeout\b|\bclearTimeout\b|\bnavigator\.clipboard\b/);
    expect(runtimeSource).toMatch(/window\.setTimeout/);
    expect(runtimeSource).toMatch(/navigator\.clipboard/);
  });
});
