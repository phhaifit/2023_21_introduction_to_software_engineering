import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openProcessingDetailsFromAssistantMenu } from "./task-ui-test-helpers.ts";

import { TaskOrchestrationPage } from
  "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";
import {
  createLocalTaskCreationClient,
  type TaskCreationClient
} from "@vcp/frontend/features/task-orchestration/model/task-creation-client.ts";
import { resetTaskIdentitySequence } from
  "@vcp/frontend/features/task-orchestration/model/task-id.ts";
import {
  buildCreateTaskRequest,
  initialTaskCreationState,
  taskCreationReducer
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import type { TaskStatus as ProductionTaskStatus } from "@vcp/shared";
import {
  canTransitionTaskStatus,
  isTerminalTaskStatus,
  toTaskPresentationStatus,
  transitionTaskStatus
} from "@vcp/frontend/features/task-orchestration/model/task-lifecycle.ts";
import type { TaskProcessingRuntime } from "@vcp/frontend/features/task-orchestration/model/task-processing-runtime.ts";

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
  clock = { now: () => "2026-06-24T12:00:00.000Z" };
  logIdentitySource = {
    counter: 0,
    nextLogId() {
      this.counter += 1;
      return `log-${this.counter}`;
    }
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

class SpyTaskCreationClient implements TaskCreationClient {
  calls: Parameters<TaskCreationClient["createTask"]>[0][] = [];
  shouldReject = false;
  status: ProductionTaskStatus = "queued";

  async createTask(request: Parameters<TaskCreationClient["createTask"]>[0]) {
    this.calls.push(structuredClone(request));

    if (this.shouldReject) {
      throw new Error("Rejected by test client.");
    }

    const sequence = this.calls.length.toString().padStart(6, "0");
    return {
      taskId: `TASK-${sequence}` as ReturnType<typeof createTaskId>,
      workId: `WORK-${sequence}` as ReturnType<typeof createWorkId>,
      status: this.status,
      createdAt: `2026-06-24T12:00:0${this.calls.length}.000Z`
    };
  }
}

function createTaskId() {
  return "TASK-000000" as import("@vcp/shared").EntityId<"taskId">;
}

function createWorkId() {
  return "WORK-000000" as import("@vcp/shared").EntityId<"workId">;
}

async function submitPrompt(prompt = "Prepare a launch summary.") {
  const user = userEvent.setup();
  await user.type(screen.getByRole("textbox", { name: "Request" }), prompt);
  await user.click(screen.getByRole("button", { name: "Send request" }));
  return user;
}

describe("Task 6B task creation UI flow", () => {
  it("creates one pending auto-routed task through the public client boundary", async () => {
    const client = new SpyTaskCreationClient();
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("Draft the weekly report.");

    expect(client.calls).toEqual([
      {
        prompt: "Draft the weekly report.",
        routing: { mode: "auto" }
      }
    ]);
    expect(screen.getByLabelText("Pending task")).toBeVisible();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(within(feed).getByText("Draft the weekly report.")).toBeVisible();

    const user = userEvent.setup();
    await openProcessingDetailsFromAssistantMenu(user);
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));

    expect(screen.getByText("WORK-000001")).toBeVisible();
    expect(screen.getByText("TASK-000001")).toBeVisible();
    expect(screen.getByText("Routing: Auto-routing")).toBeVisible();
    expect(screen.queryByText(/AGT-/)).not.toBeInTheDocument();
    expect(screen.queryByText(/WFL-/)).not.toBeInTheDocument();
    expect(within(feed).queryByText(/Completed/i)).not.toBeInTheDocument();
    expect(within(feed).queryByText(/Failed/i)).not.toBeInTheDocument();

    const timeline = screen.getByRole("region", { name: /processing timeline/i });
    expect(within(timeline).getAllByText("Waiting")).toHaveLength(6);
    expect(within(timeline).queryByText("Active")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /processing log details/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /partial result/i })).not.toBeInTheDocument();
  });

  it("preserves canonical specific-agent routing in the request and Pending summary", async () => {
    const user = userEvent.setup();
    const client = new SpyTaskCreationClient();
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await user.click(screen.getByRole("radio", { name: /Specific agent/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Agent" }), "AGT-CODE");
    await submitPrompt("Review this branch.");

    expect(client.calls).toEqual([
      {
        prompt: "Review this branch.",
        routing: { mode: "specific-agent", agentId: "AGT-CODE" }
      }
    ]);
    expect(client.calls[0].routing).not.toHaveProperty("workflowId");
    await openProcessingDetailsFromAssistantMenu(user);
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));
    expect(screen.getByText("Routing: Specific agent AGT-CODE")).toBeVisible();
  });

  it("preserves canonical predefined-workflow routing in the request and Pending summary", async () => {
    const user = userEvent.setup();
    const client = new SpyTaskCreationClient();
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await user.click(screen.getByRole("radio", { name: /Predefined workflow/ }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Workflow" }),
      "WFL-RESEARCH-SYNTHESIS"
    );
    await submitPrompt("Research and summarize.");

    expect(client.calls).toEqual([
      {
        prompt: "Research and summarize.",
        routing: {
          mode: "predefined-workflow",
          workflowId: "WFL-RESEARCH-SYNTHESIS"
        }
      }
    ]);
    expect(client.calls[0].routing).not.toHaveProperty("agentId");
    await openProcessingDetailsFromAssistantMenu(user);
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));
    expect(screen.getByText(
      "Routing: Predefined workflow WFL-RESEARCH-SYNTHESIS"
    )).toBeVisible();
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "]
  ])("rejects an %s prompt before calling the client", async (_case, prompt) => {
    const user = userEvent.setup();
    const client = new SpyTaskCreationClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    const promptInput = screen.getByRole("textbox", { name: "Request" });
    if (prompt) {
      await user.type(promptInput, prompt);
    } else {
      await user.click(promptInput);
    }
    await user.keyboard("{Enter}");

    expect(client.calls).toHaveLength(0);
    expect(screen.queryByLabelText("Pending task")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a task request before sending."
    );
  });

  it.each([
    [/Specific agent/, "Select an available agent before sending."],
    [/Predefined workflow/, "Select a predefined workflow before sending."]
  ] as const)("rejects missing explicit routing targets", async (modeName, message) => {
    const user = userEvent.setup();
    const client = new SpyTaskCreationClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await user.click(screen.getByRole("radio", { name: modeName }));
    await submitPrompt("Route this task.");

    expect(client.calls).toHaveLength(0);
    expect(screen.queryByLabelText("Pending task")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("keeps unique task records across multiple successful submissions", async () => {
    const client = new SpyTaskCreationClient();
    client.status = "succeeded";
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("First task.");
    await submitPrompt("Second task.");

    expect(client.calls).toHaveLength(2);
    const user = userEvent.setup();
    await openProcessingDetailsFromAssistantMenu(user);
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));
    expect(screen.getByText("TASK-000002")).toBeVisible();
    expect(screen.getByText("WORK-000002")).toBeVisible();

    let state = initialTaskCreationState;
    state = taskCreationReducer(state, { type: "submit-started" });
    state = taskCreationReducer(state, {
      type: "task-created",
      request: { prompt: "First task.", routing: { mode: "auto" } },
      response: {
        taskId: createTaskId(),
        workId: createWorkId(),
        status: "queued",
        createdAt: "2026-06-24T12:00:01.000Z"
      }
    });
    state = taskCreationReducer(state, { type: "submit-started" });
    state = taskCreationReducer(state, {
      type: "task-created",
      request: { prompt: "Second task.", routing: { mode: "auto" } },
      response: {
        taskId: "TASK-000002" as ReturnType<typeof createTaskId>,
        workId: "WORK-000002" as ReturnType<typeof createWorkId>,
        status: "queued",
        createdAt: "2026-06-24T12:00:02.000Z"
      }
    });

    expect(state.tasks.map((task) => task.prompt)).toEqual([
      "First task.",
      "Second task."
    ]);
    expect(new Set(state.tasks.map((task) => task.taskId)).size).toBe(2);
    expect(new Set(state.tasks.map((task) => task.workId)).size).toBe(2);
  });

  it("prevents duplicate in-flight submissions", async () => {
    const user = userEvent.setup();
    let resolveCreate: (() => void) | undefined;
    const client: TaskCreationClient = {
      createTask: vi.fn(
        () => new Promise((resolve) => {
          resolveCreate = () => resolve({
            taskId: createTaskId(),
            workId: createWorkId(),
            status: "queued",
            createdAt: "2026-06-24T12:00:00.000Z"
          });
        })
      )
    };
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await user.type(screen.getByRole("textbox", { name: "Request" }), "Slow task");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    await user.click(screen.getByRole("button", { name: "Sending request" }));
    resolveCreate?.();

    expect(client.createTask).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText("Pending task")).toBeVisible();
  });

  it("keeps the draft recoverable after client rejection", async () => {
    const client = new SpyTaskCreationClient();
    client.shouldReject = true;
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("Retry me.");

    expect(client.calls).toHaveLength(1);
    expect(screen.queryByLabelText("Pending task")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Task could not be created");
    expect(screen.getByRole("textbox", { name: "Request" })).toHaveValue("Retry me.");
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });
});

describe("Task 6B model boundaries", () => {
  it("maps production status to PA5 presentation status without inventing requires_action", () => {
    expect(toTaskPresentationStatus("queued")).toBe("pending");
    expect(toTaskPresentationStatus("running")).toBe("in-progress");
    expect(toTaskPresentationStatus("succeeded")).toBe("completed");
    expect(toTaskPresentationStatus("failed")).toBe("failed");
    expect(toTaskPresentationStatus("cancelled")).toBe("canceled");
    expect(toTaskPresentationStatus("requires_action")).toBeNull();
  });

  it("enforces immutable canonical lifecycle transitions", () => {
    const task = taskCreationReducer(initialTaskCreationState, {
      type: "task-created",
      request: { prompt: "Task", routing: { mode: "auto" } },
      response: {
        taskId: createTaskId(),
        workId: createWorkId(),
        status: "queued",
        createdAt: "2026-06-24T12:00:00.000Z"
      }
    }).tasks[0];

    const running = transitionTaskStatus(task, "running");
    expect(running.ok).toBe(true);
    expect(running.ok ? running.task.status : "").toBe("running");
    expect(task.status).toBe("queued");
    expect(canTransitionTaskStatus("queued", "succeeded")).toBe(false);
    expect(transitionTaskStatus(task, "succeeded").ok).toBe(false);
    expect(isTerminalTaskStatus("succeeded")).toBe(true);
    expect(isTerminalTaskStatus("failed")).toBe(true);
    expect(isTerminalTaskStatus("cancelled")).toBe(true);
    expect(canTransitionTaskStatus("succeeded", "running")).toBe(false);
  });

  it("creates deterministic local client responses without request aliasing", async () => {
    const client = createLocalTaskCreationClient({
      now: () => "2026-06-24T12:00:00.000Z"
    });
    const request = buildCreateTaskRequest({
      prompt: "  Local task  ",
      routingMode: "auto"
    });
    expect(request.ok).toBe(true);

    const response = request.ok ? await client.createTask(request.request) : undefined;
    if (request.ok) {
      request.request.prompt = "mutated";
    }

    expect(response).toMatchObject({
      taskId: "TASK-000001",
      workId: "WORK-000001",
      status: "queued",
      createdAt: "2026-06-24T12:00:00.000Z"
    });
  });

  it("keeps presentation components out of canonical lifecycle mutation", () => {
    const root = process.cwd();
    const files = [
      "apps/frontend/src/features/task-orchestration/components/task-status-badge.tsx",
      "apps/frontend/src/features/task-orchestration/components/processing-timeline.tsx"
    ];

    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source).not.toMatch(/useState|useReducer|setTaskStatus|ProductionTaskStatus/);
    }
  });

  it("keeps frontend Task & Orchestration imports inside public boundaries", () => {
    const root = process.cwd();
    const files = [
      "apps/frontend/src/features/task-orchestration/task-orchestration-page.tsx",
      "apps/frontend/src/features/task-orchestration/model/task-creation-client.ts",
      "apps/frontend/src/features/task-orchestration/model/task-creation-state.ts",
      "apps/frontend/src/features/task-orchestration/model/task-lifecycle.ts"
    ];

    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source).not.toMatch(/@vcp\/backend|@vcp\/database|Prisma/);
      expect(source).not.toMatch(/modules\/agent-management|modules\/workflow-management/);
    }
  });
});
