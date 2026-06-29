import { useState } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskOrchestrationPage } from "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";
import { resetTaskIdentitySequence } from "@vcp/frontend/features/task-orchestration/model/task-id.ts";
import type { TaskCreationClient } from "@vcp/frontend/features/task-orchestration/model/task-creation-client.ts";
import type { TaskProcessingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-processing-runtime.ts";
import type { TaskStreamingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-streaming-runtime.ts";
import type { TaskCompletionRuntime } from "@vcp/frontend/features/task-orchestration/model/task-completion-runtime.ts";
import type { EntityId, TaskStatus as ProductionTaskStatus } from "@vcp/shared";
import {
  taskCreationReducer,
  initialTaskCreationState,
  conversationHasNonTerminalTasks
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import { ROUTING_MODES } from "@vcp/frontend/features/task-orchestration/model/task-types.ts";
import { RoutingSelector } from "@vcp/frontend/features/task-orchestration/components/routing-selector.tsx";
import { createTaskRoutingOptions } from "@vcp/frontend/features/task-orchestration/data/task-routing-options.ts";

const FIXED_TS = "2026-06-25T12:00:00.000Z";
const seedData = createTaskRoutingOptions();

class FakeScheduler {
  callbacks: (() => void)[] = [];
  schedule(_delayMs: number, callback: () => void) {
    this.callbacks.push(callback);
    return { cancel: () => undefined };
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
  logIdentitySource = { counter: 0, nextLogId() { return "log-1"; } };
}

class FakeStreamingRuntime implements TaskStreamingRuntime {
  scheduler = new FakeScheduler();
  clock = { now: () => FIXED_TS };
  fragmentIdentitySource = { counter: 0, nextFragmentId() { return "frag-1"; } };
  fragmentSource = { getFragments: () => ["Partial output"] };
}

class FakeCompletionRuntime implements TaskCompletionRuntime {
  scheduler = new FakeScheduler();
  resultSource = {
    finalize: () => ({
      text: "Final completed text result",
      actionItems: [],
      finalizedAt: FIXED_TS
    })
  };
  clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
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
  HTMLDialogElement.prototype.showModal = vi.fn(function () {
    (this as HTMLDialogElement).open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function () {
    (this as HTMLDialogElement).open = false;
  });
});

describe("Polish UI: compact routing and composer", () => {
  it("uses segmented routing controls and compact target selectors", async () => {
    const user = userEvent.setup();

    function StatefulRoutingSelector() {
      const [mode, setMode] = useState<(typeof ROUTING_MODES)[number]>(ROUTING_MODES[0]);
      return (
        <RoutingSelector
          mode={mode}
          agents={seedData.agents}
          workflows={seedData.workflows}
          onModeChange={setMode}
          onAgentChange={vi.fn()}
          onWorkflowChange={vi.fn()}
        />
      );
    }

    render(<StatefulRoutingSelector />);

    expect(screen.getByRole("radiogroup", { name: "Routing mode" })).toBeVisible();
    expect(screen.queryByText(/Let the workspace choose/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Specific agent/ }));
    expect(screen.getByRole("combobox", { name: "Agent" })).toBeVisible();
  });
});

describe("Polish UI: chat presentation and details", () => {
  it("keeps timeline/logs out of the main feed and exposes them in processing details", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("Show chat polish");
    const conversation = screen.getByLabelText("Task chat conversation");
    expect(within(conversation).getByText("Show chat polish")).toBeVisible();
    expect(within(conversation).queryByRole("region", { name: /timeline/i })).not.toBeInTheDocument();

    await user.click(
      within(screen.getByLabelText("User message")).getByRole("button", {
        name: "More actions for this work"
      })
    );
    await user.click(screen.getByRole("menuitem", { name: "View processing details" }));

    expect(screen.getByRole("region", { name: "Processing timeline details" })).toBeVisible();
  });
});

describe("Polish UI: copy actions", () => {
  it("copies query and response without mutating lifecycle", async () => {
    const user = userEvent.setup();
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

    await submitPrompt("Copy me");
    await user.click(
      within(screen.getByLabelText("User message")).getByRole("button", {
        name: "More actions for this work"
      })
    );
    expect(screen.queryByRole("menuitem", { name: "Copy Task ID" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Copy Work ID" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Copy query" }));
    expect(cRuntime.clipboard.writeText).toHaveBeenCalledWith("Copy me");
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();

    act(() => { pRuntime.scheduler.advance(); });
    act(() => { pRuntime.scheduler.advance(); });
    act(() => { pRuntime.scheduler.advance(); });
    act(() => { pRuntime.scheduler.advance(); });
    act(() => { sRuntime.scheduler.advance(); });
    act(() => { sRuntime.scheduler.advance(); });
    act(() => { sRuntime.scheduler.advance(); });
    act(() => { pRuntime.scheduler.advance(); });
    act(() => { pRuntime.scheduler.advance(); });
    act(() => { cRuntime.scheduler.advance(); });

    await user.click(
      within(screen.getByLabelText("Assistant response")).getByRole("button", {
        name: "More actions for this work"
      })
    );
    expect(screen.queryByRole("menuitem", { name: "Delete message" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Copy response" }));
    expect(cRuntime.clipboard.writeText).toHaveBeenCalledWith("Final completed text result");
    expect(screen.getByLabelText("Task status: Completed")).toBeVisible();
  });
});

describe("Polish UI: composer cancel and inline progress", () => {
  it("shows cancel in composer and progress in assistant without a default dock", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("Running cancel test");
    expect(screen.queryByLabelText("Compact orchestration dock")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel current task" })).toBeVisible();

    const assistant = screen.getByLabelText("Assistant response");
    expect(within(assistant).getByLabelText("Task status: Pending")).toBeVisible();

    act(() => { pRuntime.scheduler.advance(); });
    expect(within(assistant).getByLabelText("Task status: In Progress")).toBeVisible();
    expect(within(assistant).getByText(/\/6 steps/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancel current task" }));
    expect(screen.getByRole("dialog", { name: "Cancel task?" })).toBeVisible();
  });

  it("returns composer to Send when the latest task is terminal", async () => {
    const client = new ConfigurableClient("succeeded");
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Terminal task");
    expect(screen.queryByRole("button", { name: "Cancel current task" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  });
});

describe("Polish UI: sidebar collapse", () => {
  it("keeps conversation row content and more actions unified for long titles", async () => {
    const user = userEvent.setup();
    render(<TaskOrchestrationPage taskCreationClient={new ConfigurableClient()} />);
    const longTitle =
      "This is a deliberately long conversation title that should truncate inside Recent work";
    await submitPrompt(longTitle);

    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    const item = within(navigation).getByRole("listitem");
    const selectButton = item.querySelector<HTMLButtonElement>(
      ".task-conversation-navigation__conversation-button"
    );
    const moreButton = within(item).getByRole("button", {
      name: /More actions for conversation This is a deliberately long conversation/
    });

    expect(selectButton).not.toBeNull();
    expect(item).toContainElement(selectButton);
    expect(item).toContainElement(moreButton);
    expect(selectButton?.getAttribute("aria-label")).toMatch(
      /This is a deliberately long conversation/
    );
    expect(selectButton).toHaveClass("task-conversation-navigation__conversation-button");
    expect(moreButton).toHaveClass("task-conversation-navigation__more-button");
    expect(item.querySelector(".task-conversation-navigation__title")).toHaveTextContent(
      longTitle.slice(0, 40)
    );

    await user.click(moreButton);
    expect(screen.getByRole("menuitem", { name: "Delete conversation" })).toBeVisible();
  });

  it("collapses and expands conversation sidebar without changing active conversation", async () => {
    const user = userEvent.setup();
    render(<TaskOrchestrationPage taskCreationClient={new ConfigurableClient()} />);
    await submitPrompt("Collapse test with full title hidden from rail");

    const sidebar = screen.getByRole("complementary", { name: "Task workspace sidebar" });
    const collapseBtn = screen.getByRole("button", { name: "Collapse conversations" });
    expect(collapseBtn).toHaveAttribute("aria-expanded", "true");
    await user.click(collapseBtn);

    expect(
      within(sidebar).getByRole("button", { name: "Expand conversations" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("searchbox", { name: /search conversations/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /filter by status/i })).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Recent work")).not.toBeInTheDocument();
    expect(within(sidebar).queryByText("Pending")).not.toBeInTheDocument();
    expect(
      within(sidebar).queryByText("Collapse test with full title hidden from rail")
    ).not.toBeInTheDocument();
    expect(within(sidebar).getByRole("button", { name: "New chat" })).toBeVisible();
    expect(
      within(sidebar).getByLabelText(/Active conversation: Collapse test with full title hidden/)
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: /conversation/i })).getByText(
        "Collapse test with full title hidden from rail"
      )
    ).toBeVisible();

    await user.click(within(sidebar).getByRole("button", { name: "Expand conversations" }));
    expect(screen.getByRole("searchbox", { name: /search conversations/i })).toBeVisible();
    expect(within(screen.getByRole("navigation", { name: /conversations/i })).getByText("Recent work")).toBeVisible();
  });
});

describe("Polish UI: delete conversation and task", () => {
  it("deletes terminal conversation and task with confirmation", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("succeeded");
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Delete me conversation");
    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    await user.click(
      within(navigation).getByRole("button", {
        name: /More actions for conversation Delete me conversation/i
      })
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete conversation" }));
    await user.click(screen.getByRole("button", { name: "Delete conversation" }));

    expect(screen.getByText("What should your virtual team work on?")).toBeVisible();

    await submitPrompt("Task to delete");
    await user.click(
      within(screen.getByLabelText("User message")).getByRole("button", {
        name: "More actions for this work"
      })
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete message" }));
    await user.click(screen.getByRole("button", { name: "Delete message" }));

    expect(
      within(screen.getByRole("region", { name: /conversation/i })).queryByText("Task to delete")
    ).not.toBeInTheDocument();
  });

  it("disables delete for running conversation tasks", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("Running delete guard");
    act(() => { pRuntime.scheduler.advance(); });

    const navigation = screen.getByRole("navigation", { name: /conversations/i });
    await user.click(
      within(navigation).getByRole("button", {
        name: /More actions for conversation Running delete guard/i
      })
    );

    expect(screen.getByRole("menuitem", { name: "Delete conversation" })).toBeDisabled();
  });
});

describe("Polish UI: delete reducer helpers", () => {
  it("removes conversation/tasks and falls back active selection", () => {
    const created = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: { prompt: "First", routing: { mode: "auto" } },
      response: {
        taskId: "TASK-000001" as EntityId<"taskId">,
        workId: "WORK-000001" as EntityId<"workId">,
        status: "succeeded",
        createdAt: FIXED_TS
      }
    });

    const deleted = taskCreationReducer(created, {
      type: "conversation-deleted",
      conversationId: "CONV-000001"
    });

    expect(deleted.conversations).toEqual([]);
    expect(deleted.tasks).toEqual([]);
    expect(deleted.activeConversationId).toBeUndefined();
    expect(deleted.activeTaskId).toBeNull();
  });

  it("detects non-terminal tasks in a conversation", () => {
    const running = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: { prompt: "Run", routing: { mode: "auto" } },
      response: {
        taskId: "TASK-000001" as EntityId<"taskId">,
        workId: "WORK-000001" as EntityId<"workId">,
        status: "running",
        createdAt: FIXED_TS
      }
    });

    expect(conversationHasNonTerminalTasks(running, "CONV-000001")).toBe(true);
  });
});
