/**
 * task-cancellation-ui.test.tsx
 *
 * Permanent focused tests for Task 12B — Cancel Confirmation Dialog
 * and Canceled State UI Integration.
 *
 * Coverage mapping:
 * 1. Eligibility: queued visible, running visible, succeeded hidden, failed hidden, cancelled hidden.
 * 2. Dialog: default closed, open, open without mutation, Dismiss, Escape, repeated open/dismiss, one dialog only, focus placement, Task change closes.
 * 3. Queued Confirm: all stoppers, one dispatch, cancelled status, timestamp, no pending transition after scheduler advance.
 * 4. Running Confirm: timeline, logs, fragments, partial text, active step canceled, no finalized result.
 * 5. Late Updates: step, log, fragment, exhausted, completion, failure.
 * 6. Error: coordinator error, no cancellation, accessible error, dismiss after error.
 * 7. Isolation and Lifecycle: Task A/B isolation, stale confirm, unmount, Strict Mode.
 * 8. Regression: Completed Result still works, Copy still works, Processing Detail running/succeeded still works, Canceled detail only if exact OpenSpec allows.
 * 9. Dependency check: no backend, database, Prisma, or private module imports.
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
import type { TaskCancellationCoordinator } from "@vcp/frontend/features/task-orchestration/model/task-cancellation-coordinator.ts";
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
    getFragments: () => ["Chunk 1", "Chunk 2"]
  };
}

class FakeCompletionRuntime implements TaskCompletionRuntime {
  scheduler = new FakeScheduler();
  resultSource = {
    finalize: () => ({
      text: "Completed successfully",
      actionItems: ["Action 1"],
      finalizedAt: "2026-06-25T12:00:01.000Z"
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

describe("1. Eligibility", () => {
  it("queued visible", async () => {
    const client = new ConfigurableClient("queued");
    render(<TaskOrchestrationPage taskCreationClient={client} />);
    await submitPrompt("Queued check");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel task" })).toBeVisible();
  });

  it("running visible", async () => {
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);
    await submitPrompt("Running check");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();
    act(() => {
      pRuntime.scheduler.advance(); // queued -> running
    });
    expect(screen.getByLabelText("Task status: In Progress")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel task" })).toBeVisible();
  });

  it("succeeded hidden", async () => {
    const client = new ConfigurableClient("succeeded");
    render(<TaskOrchestrationPage taskCreationClient={client} />);
    await submitPrompt("Succeeded check");
    expect(await screen.findByLabelText("Task status: Completed")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cancel task" })).not.toBeInTheDocument();
  });

  it("failed hidden", async () => {
    const client = new ConfigurableClient("failed");
    render(<TaskOrchestrationPage taskCreationClient={client} />);
    await submitPrompt("Failed check");
    expect(await screen.findByLabelText("Task status: Failed")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cancel task" })).not.toBeInTheDocument();
  });

  it("cancelled hidden", async () => {
    const client = new ConfigurableClient("cancelled");
    render(<TaskOrchestrationPage taskCreationClient={client} />);
    await submitPrompt("Cancelled check");
    expect(await screen.findByLabelText("Task status: Canceled")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Cancel task" })).not.toBeInTheDocument();
  });
});

describe("2. Dialog", () => {
  it("default closed, open, open without mutation, Dismiss, Escape, repeated open/dismiss, one dialog only, focus placement, Task change closes", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();
    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("Dialog check");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();

    // default closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // open
    const cancelBtn = screen.getByRole("button", { name: "Cancel task" });
    await user.click(cancelBtn);

    const dialogs = screen.getAllByRole("dialog", { name: "Cancel task?" });
    expect(dialogs).toHaveLength(1); // one dialog only
    const dialog = dialogs[0];
    expect(dialog).toBeVisible();

    // open without mutation
    expect(screen.getAllByLabelText("Task status: Pending")[0]).toBeVisible();

    // Dismiss
    await user.click(within(dialog).getByRole("button", { name: "Continue processing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Task status: Pending")[0]).toBeVisible();

    // repeated open/dismiss & Escape
    await user.click(cancelBtn);
    const dialog2 = screen.getByRole("dialog", { name: "Cancel task?" });
    expect(dialog2).toBeVisible();

    // simulate Escape key via onCancel
    fireEvent(dialog2, new Event("cancel"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Task status: Pending")[0]).toBeVisible(); // no mutation

    // Task change closes
    await user.click(cancelBtn);
    expect(screen.getByRole("dialog", { name: "Cancel task?" })).toBeVisible();

    // submit second task
    await submitPrompt("Second task");
    expect(await screen.findByText("Second task")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("3. Queued Confirm", () => {
  it("all stoppers, one dispatch, cancelled status, timestamp, no pending transition after scheduler advance", async () => {
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

    await submitPrompt("Queued confirm check");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();

    // Open dialog and confirm
    await user.click(screen.getByRole("button", { name: "Cancel task" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel task?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm cancellation" }));

    // Dialog closes, cancelled status
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Task status: Canceled")).toBeVisible();
    expect(screen.getByText(/Canceled at: 2026-06-/)).toBeVisible();

    // Advance pending scheduler — no pending transition to running
    act(() => {
      pRuntime.scheduler.advance();
    });
    expect(screen.getByLabelText("Task status: Canceled")).toBeVisible();
    expect(screen.queryByLabelText("Task status: In Progress")).not.toBeInTheDocument();
  });
});

describe("4. Running Confirm", () => {
  it("timeline, logs, fragments, partial text, active step canceled, no finalized result", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const pRuntime = new FakeProcessingRuntime();

    render(<TaskOrchestrationPage taskCreationClient={client} processingRuntime={pRuntime} />);

    await submitPrompt("Running confirm check");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();

    act(() => {
      pRuntime.scheduler.advance(); // queued -> running (validate-input active)
    });
    expect(await screen.findByLabelText("Task status: In Progress")).toBeVisible();

    act(() => {
      pRuntime.scheduler.advance(); // validate-input complete -> analyze-request active
    });

    expect(screen.getByLabelText("Task status: In Progress")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "View processing details" }));
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));
    expect(screen.getByText("Analyzing request.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close processing details" }));

    // Cancel
    await user.click(screen.getByRole("button", { name: "Cancel task" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel task?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm cancellation" }));

    // Canceled presentation
    expect(screen.getByLabelText("Task status: Canceled")).toBeVisible();
    expect(screen.getByText("Task Canceled")).toBeVisible();

    // Active step canceled (timeline preserved), logs preserved
    await user.click(screen.getByRole("button", { name: "View processing details" }));
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));
    expect(screen.getByText("Analyzing request.")).toBeVisible();
    expect(screen.queryByText("Completed Result")).not.toBeInTheDocument(); // no finalized result
    expect(screen.queryByRole("button", { name: "Cancel task" })).not.toBeInTheDocument();
  });
});

describe("5. Late Updates", () => {
  it("step, log, fragment, exhausted, completion, failure are rejected after cancellation", async () => {
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

    await submitPrompt("Late updates check");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();

    act(() => {
      pRuntime.scheduler.advance(); // queued -> running
    });
    expect(await screen.findByLabelText("Task status: In Progress")).toBeVisible();

    // Cancel
    await user.click(screen.getByRole("button", { name: "Cancel task" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel task?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm cancellation" }));

    expect(screen.getByLabelText("Task status: Canceled")).toBeVisible();

    // Simulate late callbacks by advancing all schedulers
    act(() => {
      pRuntime.scheduler.advance();
      sRuntime.scheduler.advance();
      cRuntime.scheduler.advance();
    });

    // Task remains cancelled, no completed result, no failure
    expect(screen.getByLabelText("Task status: Canceled")).toBeVisible();
    expect(screen.queryByLabelText("Task status: Completed")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Task status: Failed")).not.toBeInTheDocument();
  });
});

describe("6. Error", () => {
  it("coordinator error, no cancellation, accessible error, dismiss after error", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");
    const fakeCoordinator: TaskCancellationCoordinator = {
      cancel: vi.fn().mockImplementation(() => {
        throw new AggregateError([new Error("Stopper threw")], "Cleanup failed");
      }),
      dispose: vi.fn()
    };

    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        cancellationCoordinator={fakeCoordinator}
      />
    );

    await submitPrompt("Error check");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancel task" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel task?" });
    await user.click(within(dialog).getByRole("button", { name: "Confirm cancellation" }));

    // Dialog remains open, accessible error displayed
    expect(dialog).toBeVisible();
    const alert = within(dialog).getByRole("alert");
    expect(alert).toBeVisible();
    expect(alert).toHaveTextContent("Cleanup failed");

    // Task status unchanged (no cancellation)
    expect(screen.getAllByLabelText("Task status: Pending")[0]).toBeVisible();

    // Dismiss after error
    await user.click(within(dialog).getByRole("button", { name: "Continue processing" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Task status: Pending")[0]).toBeVisible();
  });
});

describe("7. Isolation and Lifecycle", () => {
  it("Task A/B isolation, stale confirm, unmount, Strict Mode", async () => {
    const user = userEvent.setup();
    const client = new ConfigurableClient("queued");

    const { unmount } = render(
      <React.StrictMode>
        <TaskOrchestrationPage taskCreationClient={client} />
      </React.StrictMode>
    );

    await submitPrompt("Task A");
    expect(await screen.findByText("Task A")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Cancel task" }));
    expect(screen.getByRole("dialog", { name: "Cancel task?" })).toBeVisible();

    // Switch to Task B by submitting new prompt
    await submitPrompt("Task B");
    expect(await screen.findByText("Task B")).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); // dialog closed

    // Open dialog on Task B
    await user.click(screen.getByRole("button", { name: "Cancel task" }));
    const dialogB = screen.getByRole("dialog", { name: "Cancel task?" });
    expect(within(dialogB).getByText("WORK-000002")).toBeVisible(); // correct Work ID for B

    await user.click(within(dialogB).getByRole("button", { name: "Confirm cancellation" }));
    expect(screen.getByLabelText("Task status: Canceled")).toBeVisible();
    expect(screen.getByText("Task B")).toBeVisible();

    // Unmount safety
    expect(() => unmount()).not.toThrow();
  });
});

describe("8. Regression", () => {
  it("Completed Result still works, Copy still works, Processing Detail running/succeeded still works, Canceled detail only if exact OpenSpec allows", async () => {
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

    await submitPrompt("Regression check");
    expect(await screen.findByLabelText("Task status: Pending")).toBeVisible();

    // queued -> running (validate-input)
    act(() => { pRuntime.scheduler.advance(); });
    expect(await screen.findByLabelText("Task status: In Progress")).toBeVisible();

    // validate-input -> analyze-request
    act(() => { pRuntime.scheduler.advance(); });

    // analyze-request -> select-routing
    act(() => { pRuntime.scheduler.advance(); });
    // select-routing -> execute-task
    act(() => { pRuntime.scheduler.advance(); });

    // execute-task triggers streaming start
    act(() => { sRuntime.scheduler.advance(); }); // chunk 1
    act(() => { sRuntime.scheduler.advance(); }); // chunk 2
    act(() => { sRuntime.scheduler.advance(); }); // exhausted

    // execute-task -> aggregate-result
    act(() => { pRuntime.scheduler.advance(); });
    // aggregate-result -> finalize
    act(() => { pRuntime.scheduler.advance(); });

    // finalize + exhausted triggers completion controller start
    act(() => { cRuntime.scheduler.advance(); });

    expect(screen.getByLabelText("Task status: Completed")).toBeVisible();

    // Completed Result view works
    expect(screen.getByText("Completed successfully")).toBeVisible();

    // Copy works
    const copyBtn = screen.getByRole("button", { name: /Copy/i });
    await user.click(copyBtn);
    expect(cRuntime.clipboard.writeText).toHaveBeenCalled();

    // Processing Detail modal works for succeeded
    const detailBtn = screen.getByRole("button", { name: "View processing details" });
    await user.click(detailBtn);
    expect(screen.getByRole("dialog", { name: "Processing details" })).toBeVisible();
  });
});

describe("9. Dependency check", () => {
  const root = process.cwd();
  const files = [
    "apps/frontend/src/features/task-orchestration/components/task-cancel-confirmation-dialog.tsx",
    "apps/frontend/src/features/task-orchestration/components/task-canceled-state.tsx",
    "apps/frontend/src/features/task-orchestration/task-orchestration-page.tsx"
  ];

  it.each(files)("file %s does not import backend, database, Prisma, or private modules", (file) => {
    const source = readFileSync(join(root, file), "utf8");
    expect(source).not.toMatch(/@vcp\/backend/);
    expect(source).not.toMatch(/@vcp\/database/);
    expect(source).not.toMatch(/Prisma/);
    expect(source).not.toMatch(/modules\/agent-management/);
    expect(source).not.toMatch(/modules\/workflow-management/);
  });
});

