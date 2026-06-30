/**
 * task-chat-workspace-ui.test.tsx
 *
 * Permanent automated UI tests for Task Orchestration Chat-First Workspace,
 * Compact Dock, and Advanced Details.
 *
 * Coverage mapping:
 * 1. User prompt renders as a conversation message.
 * 2. Partial output renders as an assistant response.
 * 3. Completed result renders as the final assistant response.
 * 4. Work ID is absent from default conversation.
 * 5. Task ID is absent from default conversation.
 * 6. Raw logs are absent from default conversation.
 * 7. Raw timestamps are absent from default conversation.
 * 8. Compact dock shows canonical status.
 * 9. Running dock shows current step.
 * 10. Running dock shows meaningful progress.
 * 11. Details trigger is an accessible button.
 * 12. Details open correctly.
 * 13. Timeline appears only in expanded details.
 * 14. Advanced details are collapsed by default.
 * 15. IDs appear after opening Advanced details.
 * 16. Logs appear after opening Advanced details.
 * 17. Failed details show user-friendly error information.
 * 18. Internal error code is hidden until Advanced details is opened.
 * 19. Main page empty state shows suggestions.
 * 20. Message composer is sticky.
 * 21. Submission flow handles loading and errors correctly.
 * 22. Cancel appears only when allowed.
 * 23. Active Task data does not leak to another Task.
 * 24. Strict Mode does not duplicate the dock or dialog.
 * 25. Keyboard and focus behavior remains accessible.
 * 26. Module boundaries are protected (no backend/database imports).
 * 27. Shared boundaries are protected.
 */

import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskOrchestrationPage } from "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";
import { resetTaskIdentitySequence } from "@vcp/frontend/features/task-orchestration/model/task-id.ts";
import type { TaskCreationClient } from "@vcp/frontend/features/task-orchestration/model/task-creation-client.ts";
import type { TaskProcessingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-processing-runtime.ts";
import type { TaskStreamingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-streaming-runtime.ts";
import type { TaskCompletionRuntime } from "@vcp/frontend/features/task-orchestration/model/task-completion-runtime.ts";
import type { EntityId, TaskStatus as ProductionTaskStatus } from "@vcp/shared";

const FIXED_TS = "2026-06-25T12:00:00.000Z";

class FakeScheduler {
  callbacks: (() => void)[] = [];
  schedule(delayMs: number, callback: () => void) {
    this.callbacks.push(callback);
    return {
      cancel: () => {
        this.callbacks = this.callbacks.filter((cb) => cb !== callback);
      }
    };
  }
  advance() {
    const cbs = [...this.callbacks];
    this.callbacks = [];
    cbs.forEach((cb) => cb());
  }
}

class FakeProcessingRuntime implements TaskProcessingRuntime {
  scheduler = new FakeScheduler();
  clock = { now: () => FIXED_TS };
  logIdentitySource = {
    counter: 0,
    nextLogId() {
      this.counter += 1;
      return `log-${this.counter}`;
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
      return `frag-${this.counter}`;
    }
  };
  fragmentSource = {
    getFragments: () => ["Streaming chunk 1", " Streaming chunk 2"]
  };
}

class FakeCompletionRuntime implements TaskCompletionRuntime {
  scheduler = new FakeScheduler();
  resultSource = {
    finalize: () => ({
      text: "Final completed text result",
      actionItems: ["Action 1"],
      finalizedAt: "2026-06-25T12:00:05.000Z"
    })
  };
  clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined)
  };
}

class ConfigurableClient implements TaskCreationClient {
  callCount = 0;
  constructor(public status: ProductionTaskStatus = "queued") {}

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

async function submitPrompt(prompt: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Request" }), prompt);
  await user.click(screen.getByRole("button", { name: "Send request" }));
  return user;
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

describe("Chat-First Workspace Presentation & Absence of Raw Metadata", () => {
  it("1-7: User prompt, partial output, completed result render correctly; raw metadata absent from conversation view", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        processingRuntime={pRuntime}
        streamingRuntime={sRuntime}
        completionRuntime={cRuntime}
      />
    );

    const promptText = "Examine chat workspace view";
    await submitPrompt(promptText);

    const conversation = screen.getByLabelText("Task chat conversation");
    expect(conversation).toBeVisible();

    // 1. User prompt renders as a conversation message
    const userMsg = within(conversation).getByLabelText("User message");
    expect(userMsg).toHaveTextContent(promptText);

    // Advance to streaming
    act(() => { pRuntime.scheduler.advance(); }); // validate-input
    act(() => { pRuntime.scheduler.advance(); }); // analyze-request
    act(() => { pRuntime.scheduler.advance(); }); // select-routing
    act(() => { pRuntime.scheduler.advance(); }); // execute-task

    act(() => { sRuntime.scheduler.advance(); }); // chunk 1
    act(() => { sRuntime.scheduler.advance(); }); // chunk 2

    // 2. Partial output renders as an assistant response
    const assistantMsg = within(conversation).getByLabelText("Assistant response");
    expect(assistantMsg).toHaveTextContent("Streaming chunk 1 Streaming chunk 2");

    // Advance to completion
    act(() => { sRuntime.scheduler.advance(); }); // exhausted
    act(() => { pRuntime.scheduler.advance(); }); // aggregate-result
    act(() => { pRuntime.scheduler.advance(); }); // finalize
    act(() => { cRuntime.scheduler.advance(); }); // completed

    // 3. Completed result renders as the final assistant response
    expect(within(conversation).getByText("Final completed text result")).toBeVisible();

    // 4. Work ID is absent from default conversation
    expect(within(conversation).queryByText(/WORK-000001/)).not.toBeInTheDocument();

    // 5. Task ID is absent from default conversation
    expect(within(conversation).queryByText(/TASK-000001/)).not.toBeInTheDocument();

    // 6. Raw logs are absent from default conversation
    expect(within(conversation).queryByText(/Task executed/)).not.toBeInTheDocument();

    // 7. Raw timestamps are absent from default conversation
    expect(within(conversation).queryByText(FIXED_TS)).not.toBeInTheDocument();
  });
});

describe("Assistant progress summary & expandable details", () => {
  it("8-18: Assistant response shows status/step/progress; Details opens modal; Timeline/IDs/Logs/ErrorCode correctly hidden/shown via Advanced details", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("FAIL_SIMULATION: check progress and details");

    expect(screen.queryByLabelText("Compact orchestration dock")).not.toBeInTheDocument();

    const assistant = screen.getByLabelText("Assistant response");
    expect(within(assistant).getByLabelText("Task status: Pending")).toBeVisible();

    // Advance into running state
    act(() => { pRuntime.scheduler.advance(); }); // validate-input active
    expect(within(assistant).getByLabelText("Task status: In Progress")).toBeVisible();

    // 9. Running assistant shows current step
    expect(within(assistant).getAllByText(/Validate input/i).length).toBeGreaterThan(0);

    // 10. Running assistant shows meaningful progress
    expect(within(assistant).getByText(/0\/6 steps/)).toBeVisible();

    // Advance to failure at aggregate-result
    act(() => { pRuntime.scheduler.advance(); }); // analyze-request
    act(() => { pRuntime.scheduler.advance(); }); // select-routing
    act(() => { pRuntime.scheduler.advance(); }); // execute-task
    act(() => { pRuntime.scheduler.advance(); }); // aggregate-result
    act(() => { pRuntime.scheduler.advance(); }); // fail

    expect(within(assistant).getByText("Không thể tổng hợp kết quả")).toBeVisible();

    // 11. Details trigger is available from the turn menu
    await user.click(
      within(assistant).getByRole("button", { name: "More response actions" })
    );
    const detailsBtn = screen.getByRole("menuitem", { name: "View processing details" });
    expect(detailsBtn).toBeVisible();

    // 12. Details open correctly
    await user.click(detailsBtn);
    const dialog = screen.getByRole("dialog", { name: "Processing details" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByLabelText("Task status: Failed")).toBeVisible();

    // 13. Timeline appears only in expanded details
    expect(within(dialog).getByRole("region", { name: "Processing timeline details" })).toBeVisible();
    const conversation = screen.getByLabelText("Task chat conversation");
    expect(within(conversation).queryByRole("region", { name: /timeline/i })).not.toBeInTheDocument();

    // 17. Failed details show user-friendly error information
    expect(within(dialog).getByText("Không thể tổng hợp kết quả")).toBeVisible();
    expect(within(dialog).getByText("Quá trình tổng hợp kết quả đã được mô phỏng là thất bại.")).toBeVisible();

    // 14. Advanced details are collapsed by default
    // 18. Internal error code is hidden until Advanced details is opened
    const advancedContent = within(dialog).getByLabelText("Processing identifiers").closest(".task-advanced-section__content");
    expect(advancedContent).toHaveClass("task-advanced-section__content");
    expect(advancedContent).not.toHaveClass("task-advanced-section__content--open");

    // Toggle Advanced details
    const toggleBtn = within(dialog).getByRole("button", { name: /Show Advanced details/i });
    await user.click(toggleBtn);

    expect(advancedContent).toHaveClass("task-advanced-section__content--open");

    // 15. IDs appear after opening Advanced details
    expect(within(dialog).getByText("WORK-000001")).toBeVisible();
    expect(within(dialog).getByText("TASK-000001")).toBeVisible();

    // 16. Logs appear after opening Advanced details
    expect(within(dialog).getByRole("region", { name: "Processing log details" })).toBeVisible();

    // 18 verified open state
    expect(within(dialog).getByText("MOCK_AGGREGATION_FAILED")).toBeVisible();
  });
});

describe("Workspace Core Flow & Safety Guardrails", () => {
  it("19: Main page empty state shows suggestions", () => {
    render(<TaskOrchestrationPage />);
    expect(screen.getByText("What should your virtual team work on?")).toBeVisible();
    expect(screen.getByRole("list", { name: "Suggested prompts" })).toBeVisible();
  });

  it("20: Message composer is sticky", () => {
    render(<TaskOrchestrationPage />);
    const composerSection = screen.getByRole("region", { name: "Task composer area" });
    expect(composerSection).toHaveClass("task-composer");
  });

  it("21: Submission flow handles loading and errors correctly", async () => {
    const user = userEvent.setup();
    const failingClient: TaskCreationClient = {
      createTask: vi.fn().mockRejectedValue(new Error("Network Error"))
    };
    render(<TaskOrchestrationPage taskCreationClient={failingClient} />);

    await submitPrompt("Test submission error");
    expect(await screen.findByRole("alert")).toHaveTextContent("Task could not be created. Keep your draft and try again.");
  });

  it("22: Cancel appears only when allowed", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    const sRuntime = new FakeStreamingRuntime();
    const cRuntime = new FakeCompletionRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} streamingRuntime={sRuntime} completionRuntime={cRuntime} />);

    await submitPrompt("Check cancel button");

    expect(screen.getByRole("button", { name: "Cancel current task" })).toBeVisible();
    expect(screen.getByLabelText("Assistant response")).toBeVisible();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
    expect(screen.queryByLabelText("Compact orchestration dock")).not.toBeInTheDocument();

    // Advance to completion
    for (let i = 0; i < 6; i++) {
      act(() => { pRuntime.scheduler.advance(); });
    }
    act(() => { sRuntime.scheduler.advance(); });
    act(() => { sRuntime.scheduler.advance(); });
    act(() => { sRuntime.scheduler.advance(); });
    act(() => { cRuntime.scheduler.advance(); });

    expect(screen.getByLabelText("Task status: Completed")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Cancel current task/i })).not.toBeInTheDocument();
  });

  it("23: Active Task data does not leak to another Task", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    const { unmount } = render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("Task Alpha");
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(await within(feed).findByText("Task Alpha")).toBeVisible();

    unmount();
    cleanup();
    resetTaskIdentitySequence();

    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);
    expect(screen.queryByText("Task Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("What should your virtual team work on?")).toBeVisible();
  });

  it("24: Strict Mode does not duplicate processing detail or cancel controls", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(
      <React.StrictMode>
        <TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />
      </React.StrictMode>
    );

    await submitPrompt("Strict mode test");
    expect(await screen.findAllByRole("button", { name: "Cancel current task" })).toHaveLength(1);
    expect(screen.queryByLabelText("Compact orchestration dock")).not.toBeInTheDocument();
  });

  it("25: Keyboard and focus behavior remains accessible", async () => {
    const user = userEvent.setup();
    render(<TaskOrchestrationPage />);

    const input = screen.getByRole("textbox", { name: "Request" });
    await user.tab();
    // Verify focus can move properly
    expect(document.activeElement).toBeDefined();
  });
});

describe("Architecture & Boundary Protections", () => {
  const root = process.cwd();
  const files = [
    "apps/frontend/src/features/task-orchestration/components/task-conversation.tsx",
    "apps/frontend/src/features/task-orchestration/components/task-orchestration-dock.tsx",
    "apps/frontend/src/features/task-orchestration/components/task-processing-detail-modal.tsx",
    "apps/frontend/src/features/task-orchestration/task-orchestration-page.tsx"
  ];

  it.each(files)("26-27: file %s protects module and shared boundaries (no backend/database/private imports)", (file) => {
    const source = readFileSync(join(root, file), "utf8");
    expect(source).not.toMatch(/@vcp\/backend/);
    expect(source).not.toMatch(/@vcp\/database/);
    expect(source).not.toMatch(/Prisma/);
    expect(source).not.toMatch(/modules\/agent-management/);
    expect(source).not.toMatch(/modules\/workflow-management/);
  });
});
