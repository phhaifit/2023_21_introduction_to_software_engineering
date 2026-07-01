import { cleanup, render, screen, within } from "@testing-library/react";
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

afterEach(cleanup);
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
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));

    expect(screen.getByText(/Task ID/i)).toBeVisible();
    expect(screen.getByText(/Work ID/i)).toBeVisible();
    expect(screen.queryByText(/processing log/i)).not.toBeInTheDocument();
  });

  it("opens the workspace through the executions navigation entry", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);

    const navigation = screen.getByRole("complementary", { name: "Primary navigation" });
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
      streamingSnapshot: createInitialStreamingSnapshot()
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

    expect(await screen.findByText("Research competitors")).toBeVisible();
    expect(await screen.findByLabelText("Task status: In Progress")).toBeVisible();
    expect(screen.getByText("Searching web")).toBeVisible();
  });
});
