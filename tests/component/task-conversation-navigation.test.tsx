import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskOrchestrationPage } from "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";
import { resetTaskIdentitySequence } from "@vcp/frontend/features/task-orchestration/model/task-id.ts";
import type { TaskCreationClient } from "@vcp/frontend/features/task-orchestration/model/task-creation-client.ts";
import type { TaskProcessingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-processing-runtime.ts";
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

describe("Conversation Navigation & Switching", () => {
  it("Test 1 — New Chat preserves existing conversation", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    // Submit Task A to create conversation A
    await submitPrompt("Task A prompt");
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(await within(feed).findByText("Task A prompt")).toBeVisible();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();

    // Activate New Chat
    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    await user.click(within(navigation).getByRole("button", { name: /new chat/i }));

    // Verify exactly one additional empty conversation exists
    const items = within(navigation).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    // Verify conversation A remains in navigation (items[0] is A, items[1] is new chat)
    expect(within(items[0]).getByText("Task A prompt")).toBeVisible();
    expect(within(items[1]).getByText("New conversation")).toBeVisible();

    // Verify empty conversation has no dock
    expect(screen.queryByLabelText(/orchestration dock/i)).not.toBeInTheDocument();

    // Verify Task A remains in state and is not canceled by switching back to A
    await user.click(within(items[0]).getByRole("button", { name: "Task A prompt" }));
    expect(within(feed).getByText("Task A prompt")).toBeVisible();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
  });

  it("Test 2 — Submission into empty conversation", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    // Create an initial conversation A
    await submitPrompt("Initial prompt");
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(await within(feed).findByText("Initial prompt")).toBeVisible();

    // Create an empty conversation through New Chat
    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    await user.click(within(navigation).getByRole("button", { name: /new chat/i }));
    expect(within(navigation).getAllByRole("listitem")).toHaveLength(2);
    expect(within(navigation).getByText("New conversation")).toBeVisible();

    // Submit the first prompt into empty conversation
    await submitPrompt("Submitting into empty");
    expect(await within(feed).findByText("Submitting into empty")).toBeVisible();

    // Verify no extra fallback conversation is created (still 2 items)
    const items = within(navigation).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    // Verify title changes from 'New conversation' to the reducer-derived title
    expect(within(navigation).queryByText("New conversation")).not.toBeInTheDocument();
    expect(within(items[0]).getByText("Initial prompt")).toBeVisible();
    expect(within(items[1]).getByText("Submitting into empty")).toBeVisible();
  });

  it("Test 3 — A → B → A history restoration", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    // Create conversation A with two turns
    await submitPrompt("Conversation A turn 1");
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(await within(feed).findByText("Conversation A turn 1")).toBeVisible();
    await submitPrompt("Conversation A turn 2");
    expect(await within(feed).findByText("Conversation A turn 2")).toBeVisible();

    // Create conversation B with a distinct prompt via New Chat
    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    await user.click(within(navigation).getByRole("button", { name: /new chat/i }));
    await submitPrompt("Conversation B turn 1");
    expect(await within(feed).findByText("Conversation B turn 1")).toBeVisible();

    // Select A
    const items = within(navigation).getAllByRole("listitem");
    // items[0] is A, items[1] is B
    await user.click(within(items[0]).getByRole("button", { name: "Conversation A turn 1" }));
    expect(within(feed).getByText("Conversation A turn 1")).toBeVisible();
    expect(within(feed).getByText("Conversation A turn 2")).toBeVisible();
    expect(within(feed).queryByText("Conversation B turn 1")).not.toBeInTheDocument();

    // Select B
    await user.click(within(items[1]).getByRole("button", { name: "Conversation B turn 1" }));
    expect(within(feed).getByText("Conversation B turn 1")).toBeVisible();
    expect(within(feed).queryByText("Conversation A turn 1")).not.toBeInTheDocument();
    expect(within(feed).queryByText("Conversation A turn 2")).not.toBeInTheDocument();

    // Select A again
    await user.click(within(items[0]).getByRole("button", { name: "Conversation A turn 1" }));
    expect(within(feed).getByText("Conversation A turn 1")).toBeVisible();
    expect(within(feed).getByText("Conversation A turn 2")).toBeVisible();
    expect(within(feed).queryByText("Conversation B turn 1")).not.toBeInTheDocument();
  });

  it("Test 4 — Dock and details isolation", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    // Create conversation A (advance to In Progress)
    await submitPrompt("Task A prompt");
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(await within(feed).findByText("Task A prompt")).toBeVisible();
    act(() => { pRuntime.scheduler.advance(); });
    expect(screen.getByLabelText("Task status: In Progress")).toBeVisible();

    // Create conversation B via New Chat (remains Pending)
    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    await user.click(within(navigation).getByRole("button", { name: /new chat/i }));
    await submitPrompt("Task B prompt");
    expect(await within(feed).findByText("Task B prompt")).toBeVisible();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();

    // Select A and verify A's dock/details (items[0] is A)
    const items = within(navigation).getAllByRole("listitem");
    await user.click(within(items[0]).getByRole("button", { name: "Task A prompt" }));
    expect(screen.getByLabelText("Task status: In Progress")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "View processing details" }));
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));
    expect(screen.getByText("TASK-000001")).toBeVisible();
    expect(screen.getByText("WORK-000001")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close processing details" }));

    // Select B and verify B's dock/details (items[1] is B)
    await user.click(within(items[1]).getByRole("button", { name: "Task B prompt" }));
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "View processing details" }));
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));
    expect(screen.getByText("TASK-000002")).toBeVisible();
    expect(screen.getByText("WORK-000002")).toBeVisible();
    expect(screen.queryByText("TASK-000001")).not.toBeInTheDocument();
    expect(screen.queryByText("WORK-000001")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close processing details" }));

    // Verify selecting an empty conversation hides the dock/details trigger
    await user.click(within(navigation).getByRole("button", { name: /new chat/i }));
    expect(screen.queryByRole("button", { name: "View processing details" })).not.toBeInTheDocument();
  });

  it("Test 5 — History filtering, search matching, empty conversation filtering rules, and presentation-only scoping", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const runtime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={runtime} />);

    // Create Conversation A (Task 1)
    await submitPrompt("Unique Alpha Prompt");
    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    expect(within(navigation).getByText("Unique Alpha Prompt")).toBeVisible();

    // Create Conversation B (Task 2) via New Chat
    await user.click(within(navigation).getByRole("button", { name: /new chat/i }));
    await submitPrompt("Distinct Beta Request");
    expect(within(navigation).getByText("Distinct Beta Request")).toBeVisible();

    // Create Conversation C (empty) via New Chat
    await user.click(within(navigation).getByRole("button", { name: /new chat/i }));
    expect(within(navigation).getByText("New conversation")).toBeVisible();

    // Verify explicit visual notice confirming history data is session-scoped
    expect(within(navigation).getByText("Session-scoped history (in-memory).")).toBeVisible();

    // 1. Search input filtering by prompt text
    const searchInput = within(navigation).getByRole("searchbox", { name: /search conversations/i });
    await user.type(searchInput, "Alpha");
    expect(within(navigation).getByText("Unique Alpha Prompt")).toBeVisible();
    expect(within(navigation).queryByText("Distinct Beta Request")).not.toBeInTheDocument();
    expect(within(navigation).queryByText("New conversation")).not.toBeInTheDocument();

    // Clear search
    const clearBtn = within(navigation).getByRole("button", { name: /^clear filters$/i });
    await user.click(clearBtn);
    expect(within(navigation).getByText("Distinct Beta Request")).toBeVisible();

    // 2. Search input filtering by Task ID (e.g. TASK-000002)
    await user.type(searchInput, "TASK-000002");
    expect(within(navigation).getByText("Distinct Beta Request")).toBeVisible();
    expect(within(navigation).queryByText("Unique Alpha Prompt")).not.toBeInTheDocument();
    await user.click(within(navigation).getByRole("button", { name: /^clear filters$/i }));

    // 3. Status filter controls (filter by Pending, empty conversation should NOT match)
    const statusSelect = within(navigation).getByRole("combobox", { name: /filter by status/i });
    await user.selectOptions(statusSelect, "pending");
    expect(within(navigation).getByText("Unique Alpha Prompt")).toBeVisible();
    expect(within(navigation).getByText("Distinct Beta Request")).toBeVisible();
    expect(within(navigation).queryByText("New conversation")).not.toBeInTheDocument();

    // 4. Graceful selection handling when active conversation is filtered out
    // Currently active conversation is C (empty), which is filtered out by 'pending'
    expect(within(navigation).getByText("Active conversation is hidden by current filters.")).toBeVisible();
    const restoreBtn = within(navigation).getByRole("button", { name: /clear filters to view active conversation/i });
    await user.click(restoreBtn);
    expect(within(navigation).getByText("New conversation")).toBeVisible();
  });

  it("Test 6 — Conversation containing multiple Tasks correctly matches status of the latest Task", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const runtime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={runtime} />);

    // Create Task 1 (queued -> pending) in Conversation A
    await submitPrompt("First task prompt");
    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    expect(within(navigation).getByText("First task prompt")).toBeVisible();

    // Now change client status to succeeded (completed) and submit Task 2 in the SAME conversation
    client.status = "succeeded";
    await submitPrompt("Second task prompt");

    // Filter by 'completed' (status of the latest Task in Conversation A)
    const statusSelect = within(navigation).getByRole("combobox", { name: /filter by status/i });
    await user.selectOptions(statusSelect, "completed");

    // Conversation A should remain visible because its latest Task is completed
    expect(within(navigation).getByText("First task prompt")).toBeVisible();

    // Filter by 'pending' (status of the older Task in Conversation A)
    await user.selectOptions(statusSelect, "pending");

    // Conversation A should be hidden because 'pending' is NOT the latest Task status
    expect(within(navigation).queryByText("First task prompt")).not.toBeInTheDocument();
  });
});

