import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openProcessingDetailsFromAssistantMenu } from "./task-ui-test-helpers.ts";

vi.mock("@vcp/frontend/features/agent-management/agent-management-page.tsx", () => ({
  AgentManagementPage: () => <section>Agent management placeholder</section>
}));

vi.mock("@vcp/frontend/features/subscription-payment/subscription-payment-page.tsx", () => ({
  SubscriptionPaymentPage: () => <section>Billing placeholder</section>
}));

vi.mock("@vcp/frontend/features/dashboard/DashboardPage.tsx", () => ({
  DashboardPage: () => <section>Dashboard placeholder</section>
}));

vi.mock("@vcp/frontend/features/workflow-management/WorkflowsPage.tsx", () => ({
  WorkflowsPage: () => <section>Workflows placeholder</section>
}));

vi.mock("@vcp/frontend/features/authentication/authentication-api-client.ts", () => ({
  createAuthenticationApiClient: () => ({
    getMe: vi.fn().mockResolvedValue({ userId: "test-user", email: "test@vcp.local", displayName: "Test User" })
  })
}));

import { App } from "@vcp/frontend/App.tsx";
import { TaskOrchestrationPage } from
  "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";
import { createLocalTaskCreationClient } from
  "@vcp/frontend/features/task-orchestration/model/task-creation-client.ts";
import {
  createInitialStreamingSnapshot
} from "@vcp/frontend/features/task-orchestration/model/task-streaming.ts";
import type {
  TaskEventSubscription,
  TaskOrchestrationClient,
  TaskRuntimeEvent
} from "@vcp/frontend/features/task-orchestration/model/task-orchestration-provider.ts";
import type { CreatedTaskRecord } from
  "@vcp/frontend/features/task-orchestration/model/task-types.ts";
import type { Conversation, EntityId } from "@vcp/shared";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function() {
    (this as HTMLDialogElement).open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function() {
    (this as HTMLDialogElement).open = false;
  });
});

describe("TaskOrchestrationPage base workspace", () => {
  it("renders the semantic empty workspace without task processing data", () => {
    render(<TaskOrchestrationPage />);

    expect(screen.getByRole("complementary", { name: "Task workspace sidebar" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Task & Orchestration" })).toBeVisible();
    const main = screen.getByRole("region", { name: "Main conversation region" });
    expect(main).toBeVisible();
    expect(screen.getByRole("heading", {
      name: "What should your virtual team work on?"
    })).toBeVisible();
    expect(screen.getByRole("list", { name: "Suggested prompts" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Task composer area" })).toBeVisible();

    expect(screen.queryByText(/Task ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Work ID/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/timeline/i)).not.toBeInTheDocument();
    expect(within(main).queryByText(/Pending/i)).not.toBeInTheDocument();
  });

  it("renders a distinct accessible loading state without implying a task", () => {
    render(<TaskOrchestrationPage isLoading />);

    const loadingState = screen.getByRole("status");
    expect(loadingState).toHaveTextContent("Preparing your workspace");
    expect(loadingState).toHaveTextContent("Loading local conversation controls");
    const main = screen.getByRole("region", { name: "Main conversation region" });
    expect(within(main).queryByText(/Pending/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", {
      name: "What should your virtual team work on?"
    })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Request" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  });

  it("renders the real controlled routing selector and composer", () => {
    render(<TaskOrchestrationPage />);

    expect(screen.getByRole("radiogroup", { name: "Routing mode" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Auto-routing/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("textbox", { name: "Request" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
    const composer = screen.getByRole("region", { name: "Task composer area" });
    expect(within(composer).queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("grows the chat input for long queries and mirrors submitted queries in the right sidebar", async () => {
    const user = userEvent.setup();
    render(<TaskOrchestrationPage taskCreationClient={createLocalTaskCreationClient()} />);

    const promptBox = screen.getByRole("textbox", { name: "Request" });
    const longPrompt =
      "Prepare a detailed implementation summary for the demo workflow, including sales qualification context, market research notes, known risks, and the next validation step.";

    Object.defineProperty(promptBox, "scrollHeight", {
      configurable: true,
      value: 180
    });

    fireEvent.change(promptBox, { target: { value: longPrompt } });

    await waitFor(() => {
      expect(promptBox).toHaveStyle({ height: "180px" });
    });

    await user.click(screen.getByRole("button", { name: "Send request" }));

    const querySidebar = screen.getByRole("complementary", {
      name: "Conversation queries"
    });
    expect(within(querySidebar).getByText("Current chat")).toBeInTheDocument();
    const truncatedPrompt = longPrompt.length > 12 ? longPrompt.slice(0, 12) + "..." : longPrompt;
    expect(within(querySidebar).getByText(truncatedPrompt)).toBeInTheDocument();
    expect(within(querySidebar).getByText("Auto-routing")).toBeInTheDocument();
  });

  it("uses deterministic suggestions and renders Pending after accepted submit", async () => {
    const user = userEvent.setup();
    render(<TaskOrchestrationPage taskCreationClient={createLocalTaskCreationClient()} />);

    await user.click(screen.getByRole("textbox", { name: "Request" }));
    await user.keyboard("{Enter}");
    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Request" })).toHaveAttribute(
      "aria-invalid",
      "true"
    );

    const suggestions = screen.getByRole("list", { name: "Suggested prompts" });
    const suggestion = within(suggestions).getAllByRole("button")[0];
    await user.click(suggestion);

    const prompt = screen.getByRole("textbox", { name: "Request" });
    expect(prompt).not.toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(prompt).not.toHaveAttribute("aria-invalid");

    await user.click(screen.getByRole("button", { name: "Send request" }));

    expect(prompt).toHaveValue("");
    expect(screen.getByRole("radio", { name: /Auto-routing/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();

    await openProcessingDetailsFromAssistantMenu(user);

  });

  it("opens the workspace through the executions navigation entry", async () => {
    localStorage.setItem("vcp.auth.token", "test-token");
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);

    const navigation = await screen.findByRole("complementary", { name: "Primary navigation" });
    await user.click(within(navigation).getByRole("link", { name: "Công việc" }));

    expect(screen.getByRole("region", { name: "Main conversation region" })).toBeVisible();
  });

  it("renders reconnecting and provider unavailable states along with provider badge", () => {
    render(<TaskOrchestrationPage isReconnecting isProviderUnavailable />);

    expect(screen.getByText("Reconnecting")).toBeVisible();
    expect(screen.getByText("Execution Provider Unavailable")).toBeVisible();
  });

  it("dismisses the provider unavailable message without hiding the provider badge", async () => {
    const user = userEvent.setup();
    render(<TaskOrchestrationPage isProviderUnavailable />);

    await user.click(screen.getByRole("button", {
      name: "Dismiss provider unavailable message"
    }));

    expect(screen.queryByText("Execution Provider Unavailable")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Execution provider: Provider unavailable")).toBeVisible();
  });

  it("renders OpenClaw Gateway provider badge by default", () => {
    render(<TaskOrchestrationPage />);
    expect(screen.getByText("HTTP / OpenClaw Gateway")).toBeVisible();
  });

  it("restores a non-terminal conversation and shows replayed runtime activity", async () => {
    const taskId = "TASK-RESTORED-SEARCH" as EntityId<"taskId">;
    const workId = `work-${taskId}` as EntityId<"workId">;
    const restoredConversation: Conversation = {
      conversationId: "CONV-000001" as any,
      workspaceId: "workspace-demo" as any,
      title: "Restored search task",
      createdAt: "2026-06-26T10:00:00.000Z",
      updatedAt: "2026-06-26T10:00:10.000Z",
      messages: [
        {
          messageId: taskId as any,
          conversationId: "CONV-000001" as any,
          role: "user",
          content: "Research competitors",
          timestamp: "2026-06-26T10:00:00.000Z"
        }
      ]
    };
    const runningSnapshot: CreatedTaskRecord = {
      taskId,
      workId,
      prompt: "Research competitors",
      requestedRouting: { mode: "auto" },
      status: "running",
      createdAt: "2026-06-26T10:00:00.000Z",
      processingSnapshot: {
        startedAt: "2026-06-26T10:00:05.000Z",
        steps: [
          {
            id: "openclaw-web-search",
            label: "Searching web",
            status: "active",
            startedAt: "2026-06-26T10:00:05.000Z"
          }
        ],
        logs: []
      },
      streamingSnapshot: {
        phase: "streaming",
        startedAt: "2026-06-26T10:00:06.000Z",
        exhaustedAt: null,
        fragments: [
          {
            id: "frag-openclaw-1",
            sequence: 1,
            text: "OpenClaw partial competitor notes",
            appendedAt: "2026-06-26T10:00:06.000Z"
          }
        ]
      }
    };
    const client: TaskOrchestrationClient = {
      createTask: vi.fn(),
      getTask: vi.fn(),
      cancelTask: vi.fn(),
      deleteConversation: vi.fn(),
      deleteTask: vi.fn(),
      fetchConversations: vi.fn().mockResolvedValue([restoredConversation]),
      subscribeToTaskEvents: vi.fn((subscribedTaskId: string, handler: (event: TaskRuntimeEvent) => void): TaskEventSubscription => {
        queueMicrotask(() => {
          handler({
            kind: "step-started",
            taskId: subscribedTaskId as EntityId<"taskId">,
            workId,
            timestamp: "2026-06-26T10:00:05.000Z",
            stepName: "Searching web",
            stepIndex: 0,
            taskSnapshot: runningSnapshot
          });
        });
        return { subscriptionId: "sub-restored", taskId: subscribedTaskId };
      }),
      unsubscribeFromTaskEvents: vi.fn()
    };

    render(<TaskOrchestrationPage taskOrchestrationClient={client} />);

    const taskFeed = await screen.findByLabelText("Conversation task feed");
    expect(await within(taskFeed).findByText("Research competitors")).toBeVisible();
    expect(await screen.findByLabelText("Task status: In Progress")).toBeVisible();

    expect(screen.getByText("OpenClaw partial competitor notes")).toBeVisible();
  });

  it("renders provider progress before streamed partial output", async () => {
    const taskId = "TASK-PRE-STREAM" as EntityId<"taskId">;
    const workId = `work-${taskId}` as EntityId<"workId">;
    const restoredConversation: Conversation = {
      conversationId: "CONV-PRE-STREAM" as any,
      workspaceId: "workspace-demo" as any,
      title: "Pre-stream progress task",
      createdAt: "2026-06-26T11:00:00.000Z",
      updatedAt: "2026-06-26T11:00:00.000Z",
      messages: [
        {
          messageId: taskId as any,
          conversationId: "CONV-PRE-STREAM" as any,
          role: "user",
          content: "Research latest OpenClaw release",
          timestamp: "2026-06-26T11:00:00.000Z"
        }
      ]
    };
    const beforeStreamingSnapshot: CreatedTaskRecord = {
      taskId,
      workId,
      prompt: "Research latest OpenClaw release",
      requestedRouting: { mode: "auto" },
      status: "running",
      createdAt: "2026-06-26T11:00:00.000Z",
      processingSnapshot: {
        startedAt: "2026-06-26T11:00:01.000Z",
        steps: [
          {
            id: "openclaw-web-search",
            label: "Searching web",
            status: "active",
            startedAt: "2026-06-26T11:00:01.000Z"
          }
        ],
        logs: [
          {
            id: "log-openclaw-web-search",
            timestamp: "2026-06-26T11:00:01.000Z",
            level: "info",
            stepId: "openclaw-web-search",
            message: "Searching release notes"
          }
        ]
      },
      streamingSnapshot: createInitialStreamingSnapshot()
    };
    const afterStreamingSnapshot: CreatedTaskRecord = {
      ...beforeStreamingSnapshot,
      streamingSnapshot: {
        phase: "streaming",
        startedAt: "2026-06-26T11:00:02.000Z",
        exhaustedAt: null,
        fragments: [
          {
            id: "frag-pre-stream-1",
            sequence: 1,
            text: "Final streamed answer",
            appendedAt: "2026-06-26T11:00:02.000Z"
          }
        ]
      }
    };
    let subscribedHandler: ((event: TaskRuntimeEvent) => void) | undefined;
    const client: TaskOrchestrationClient = {
      createTask: vi.fn(),
      getTask: vi.fn(),
      cancelTask: vi.fn(),
      deleteConversation: vi.fn(),
      deleteTask: vi.fn(),
      fetchConversations: vi.fn().mockResolvedValue([restoredConversation]),
      subscribeToTaskEvents: vi.fn((subscribedTaskId: string, handler: (event: TaskRuntimeEvent) => void): TaskEventSubscription => {
        subscribedHandler = handler;
        return { subscriptionId: "sub-pre-stream", taskId: subscribedTaskId };
      }),
      unsubscribeFromTaskEvents: vi.fn()
    };

    render(<TaskOrchestrationPage taskOrchestrationClient={client} />);

    const taskFeed = await screen.findByLabelText("Conversation task feed");
    expect(await within(taskFeed).findByText("Research latest OpenClaw release")).toBeVisible();
    await waitFor(() => expect(subscribedHandler).toBeDefined());

    act(() => {
      subscribedHandler?.({
        kind: "step-started",
        taskId,
        workId,
        timestamp: "2026-06-26T11:00:01.000Z",
        stepName: "Searching web",
        stepIndex: 0,
        taskSnapshot: beforeStreamingSnapshot
      });
    });

    expect(await screen.findByText("Searching release notes")).toBeVisible();

    expect(screen.queryByText("Final streamed answer")).not.toBeInTheDocument();

    act(() => {
      subscribedHandler?.({
        kind: "partial-output",
        taskId,
        workId,
        timestamp: "2026-06-26T11:00:02.000Z",
        chunkText: "Final streamed answer",
        taskSnapshot: afterStreamingSnapshot
      });
    });

    expect(await screen.findByText("Final streamed answer")).toBeVisible();
  });

  it("does not synthesize fixed processing steps for restored completed history", async () => {
    const user = userEvent.setup();
    const taskId = "TASK-RESTORED-DONE" as EntityId<"taskId">;
    const restoredConversation: Conversation = {
      conversationId: "CONV-000001" as any,
      workspaceId: "workspace-demo" as any,
      title: "Restored completed task",
      createdAt: "2026-06-26T10:00:00.000Z",
      updatedAt: "2026-06-26T10:00:30.000Z",
      messages: [
        {
          messageId: taskId as any,
          conversationId: "CONV-000001" as any,
          role: "user",
          content: "Summarize project status",
          timestamp: "2026-06-26T10:00:00.000Z"
        },
        {
          messageId: `${taskId}-assistant` as any,
          conversationId: "CONV-000001" as any,
          role: "assistant",
          content: "Project status is green.",
          timestamp: "2026-06-26T10:00:30.000Z"
        }
      ]
    };
    const client: TaskOrchestrationClient = {
      createTask: vi.fn(),
      getTask: vi.fn(),
      cancelTask: vi.fn(),
      deleteConversation: vi.fn(),
      deleteTask: vi.fn(),
      fetchConversations: vi.fn().mockResolvedValue([restoredConversation]),
      subscribeToTaskEvents: vi.fn(() => ({ subscriptionId: "sub-restored-done", taskId })),
      unsubscribeFromTaskEvents: vi.fn()
    };

    render(<TaskOrchestrationPage taskOrchestrationClient={client} />);

    expect(await screen.findByText("Project status is green.")).toBeVisible();
    await openProcessingDetailsFromAssistantMenu(user);
    const dialog = screen.getByRole("dialog", { name: "Processing details" });

    expect(within(dialog).getByLabelText("Task status: Completed")).toBeVisible();
    expect(within(dialog).queryByText("Waiting")).not.toBeInTheDocument();
    expect(within(dialog).getByText("No runtime activity was captured for this turn.")).toBeVisible();
    expect(within(dialog).queryByText("Validate input")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Analyze request")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Execute task")).not.toBeInTheDocument();
  });
});
