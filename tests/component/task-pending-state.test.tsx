/**
 * task-pending-state.test.tsx
 *
 * Permanent focused tests for Task 7B — Pending Task State UI Completion
 * and Task 7 Fix — Pending Cancellation Entry Point.
 *
 * Coverage (Task 7B):
 *  1.  Successful creation renders Pending.
 *  2.  Canonical status remains queued.
 *  3.  Task ID and Work ID are rendered.
 *  4.  Prompt is preserved.
 *  5.  Auto routing summary is correct.
 *  6.  Specific-agent summary is correct.
 *  7.  Predefined-workflow summary is correct.
 *  8.  All approved timeline steps render.
 *  9.  Every step is waiting.
 * 10.  No step is active.
 * 11.  No step is completed.
 * 12.  startedAt remains null/undefined.
 * 13.  logs remain empty.
 * 14.  No streaming, completed result, or error section is rendered.
 * 15.  No automatic queued-to-running transition occurs.
 * 16.  Multiple Tasks receive independent processing snapshots.
 * 17.  No legacy timeline property is exposed on created records.
 * 18.  Existing Task 6 and Task 7A tests remain passing (verified via CI).
 *
 * Coverage (Cancellation Entry Point Fix):
 * 21.  Pending Task renders the Cancel current task button.
 * 22.  Cancel current task button has accessible role and name.
 * 23.  Clicking Cancel current task calls the semantic callback exactly once.
 * 24.  The callback receives the correct Task ID.
 * 25.  Canonical Pending presentation remains after clicking Cancel current task.
 * 26.  No Canceled or In-Progress state appears after clicking.
 * 27.  No confirmation dialog appears.
 * 28.  Initial timeline remains unchanged after clicking Cancel current task.
 * 29.  All processing steps remain Waiting after clicking Cancel current task.
 * 30.  Task ID remains visible after clicking Cancel current task.
 * 31.  Work ID remains visible after clicking Cancel current task.
 * 32.  Prompt remains visible after clicking Cancel current task.
 * 33.  Routing summary remains visible after clicking Cancel current task.
 * 34.  No cancellation execution is performed.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openProcessingDetailsFromAssistantMenu } from "./task-ui-test-helpers.ts";
import { TaskOrchestrationPage } from
  "@vcp/frontend/features/task-orchestration/task-orchestration-page.tsx";
import { resetTaskIdentitySequence } from
  "@vcp/frontend/features/task-orchestration/model/task-id.ts";
import {
  INITIAL_PROCESSING_STEPS,
  createTaskRecord
} from "@vcp/frontend/features/task-orchestration/model/task-creation-state.ts";
import type { TaskCreationClient } from
  "@vcp/frontend/features/task-orchestration/model/task-creation-client.ts";
import type { EntityId } from "@vcp/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FIXED_TS = "2026-06-24T12:00:00.000Z";
const TASK_ID_1 = "TASK-000001" as EntityId<"taskId">;
const WORK_ID_1 = "WORK-000001" as EntityId<"workId">;
const TASK_ID_2 = "TASK-000002" as EntityId<"taskId">;
const WORK_ID_2 = "WORK-000002" as EntityId<"workId">;

// ---------------------------------------------------------------------------
// Shared spy client
// ---------------------------------------------------------------------------
class SpyPendingClient implements TaskCreationClient {
  callCount = 0;

  async createTask(request: Parameters<TaskCreationClient["createTask"]>[0]) {
    this.callCount += 1;
    const seq = this.callCount.toString().padStart(6, "0");
    return {
      taskId: `TASK-${seq}` as EntityId<"taskId">,
      workId: `WORK-${seq}` as EntityId<"workId">,
      status: "queued" as const,
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
// ---------------------------------------------------------------------------
// 1. Successful creation renders Pending
// ---------------------------------------------------------------------------
describe("1. successful creation renders Pending state", () => {
  it("renders the Pending task article after a valid submission", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Draft the weekly report.");

    expect(screen.getByLabelText("Pending task")).toBeVisible();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 2. Canonical status remains queued
// ---------------------------------------------------------------------------
describe("2. canonical status remains queued", () => {
  it("createTaskRecord produces status queued", () => {
    const record = createTaskRecord(
      { prompt: "Test", routing: { mode: "auto" } },
      {
        taskId: TASK_ID_1,
        workId: WORK_ID_1,
        status: "queued",
        createdAt: FIXED_TS
      }
    );

    expect(record.status).toBe("queued");
  });

  it("page does not dispatch processing-started automatically", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Auto task.");

    // Status badge still shows Pending (not In Progress)
    expect(screen.queryByLabelText("Task status: In Progress")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 3. Task ID and Work ID are rendered
// ---------------------------------------------------------------------------
describe("3. Task ID and Work ID are rendered", () => {
  it("shows both identifiers in the Pending view", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Identify this task.");
    expect(screen.queryByText("TASK-000001")).not.toBeInTheDocument();
    await openProcessingDetailsFromAssistantMenu(user);
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));

    expect(screen.getByText("TASK-000001")).toBeVisible();
    expect(screen.getByText("WORK-000001")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4. Prompt is preserved
// ---------------------------------------------------------------------------
describe("4. submitted prompt is visible in Pending view", () => {
  it("renders the exact submitted prompt text", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    const prompt = "Prepare the Q2 summary for stakeholders.";
    await submitPrompt(prompt);

    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(within(feed).getByText(prompt)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5. Auto routing summary is correct
// ---------------------------------------------------------------------------
describe("5. auto routing summary", () => {
  it("shows 'Routing: Auto-routing' for auto mode", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Auto route this.");

    const userMessage = screen.getByLabelText("User message");
    expect(within(userMessage).getByText("Auto-routing")).toBeVisible();
    expect(screen.queryByText(/AGT-/)).not.toBeInTheDocument();
    expect(screen.queryByText(/WFL-/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. Specific-agent summary is correct
// ---------------------------------------------------------------------------
describe("6. specific-agent routing summary", () => {
  it("shows the selected agent ID in the routing summary", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await user.click(screen.getByRole("radio", { name: /Specific agent/ }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Agent" }),
      "AGT-CODE"
    );
    await submitPrompt("Review this code.");

    const userMessage = screen.getByLabelText("User message");
    expect(within(userMessage).getByText("Agent · AGT-CODE")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 7. Predefined-workflow summary is correct
// ---------------------------------------------------------------------------
describe("7. predefined-workflow routing summary", () => {
  it("shows the selected workflow ID in the routing summary", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await user.click(screen.getByRole("radio", { name: /Predefined workflow/ }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Workflow" }),
      "WFL-RESEARCH-SYNTHESIS"
    );
    await submitPrompt("Research and summarize.");

    const userMessage = screen.getByLabelText("User message");
    expect(
      within(userMessage).getByText("Workflow · WFL-RESEARCH-SYNTHESIS")
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. All approved timeline steps render
// ---------------------------------------------------------------------------
describe("8. all six approved timeline steps are rendered", () => {
  it("timeline contains exactly six steps with approved labels", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Six steps test.");
    await openProcessingDetailsFromAssistantMenu(user);

    const timeline = screen.getByRole("region", { name: "Processing timeline details" });
    const items = within(timeline).getAllByRole("listitem");

    expect(items).toHaveLength(6);

    const approvedLabels = INITIAL_PROCESSING_STEPS.map((s) => s.label);
    for (const label of approvedLabels) {
      expect(within(timeline).getByText(label)).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Every step is waiting
// ---------------------------------------------------------------------------
describe("9. every step is in waiting state on Pending", () => {
  it("all step status indicators show Waiting", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("All waiting.");
    await openProcessingDetailsFromAssistantMenu(user);

    const timeline = screen.getByRole("region", { name: "Processing timeline details" });
    const waitingLabels = within(timeline).getAllByText("Waiting");
    expect(waitingLabels).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// 10. No step is active
// ---------------------------------------------------------------------------
describe("10. no step is active in Pending state", () => {
  it("zero steps have Active status indicator", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("No active steps.");
    await openProcessingDetailsFromAssistantMenu(user);

    const timeline = screen.getByRole("region", { name: "Processing timeline details" });
    expect(within(timeline).queryAllByText("Active")).toHaveLength(0);
  });

  it("createTaskRecord initializes snapshot with no active step", () => {
    const record = createTaskRecord(
      { prompt: "T", routing: { mode: "auto" } },
      { taskId: TASK_ID_1, workId: WORK_ID_1, status: "queued", createdAt: FIXED_TS }
    );

    const activeSteps = record.processingSnapshot.steps.filter(
      (s) => s.status === "active"
    );
    expect(activeSteps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 11. No step is completed
// ---------------------------------------------------------------------------
describe("11. no step is completed in Pending state", () => {
  it("zero steps have Completed status indicator in timeline", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("No completed steps.");
    await openProcessingDetailsFromAssistantMenu(user);

    const timeline = screen.getByRole("region", { name: "Processing timeline details" });
    expect(within(timeline).queryAllByText("Completed")).toHaveLength(0);
  });

  it("createTaskRecord snapshot has no completed steps", () => {
    const record = createTaskRecord(
      { prompt: "T", routing: { mode: "auto" } },
      { taskId: TASK_ID_1, workId: WORK_ID_1, status: "queued", createdAt: FIXED_TS }
    );

    const completedSteps = record.processingSnapshot.steps.filter(
      (s) => s.status === "completed"
    );
    expect(completedSteps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 12. startedAt remains undefined in Pending state
// ---------------------------------------------------------------------------
describe("12. startedAt is undefined in Pending state", () => {
  it("createTaskRecord produces snapshot with startedAt undefined", () => {
    const record = createTaskRecord(
      { prompt: "T", routing: { mode: "auto" } },
      { taskId: TASK_ID_1, workId: WORK_ID_1, status: "queued", createdAt: FIXED_TS }
    );

    expect(record.processingSnapshot.startedAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 13. logs remain empty in Pending state
// ---------------------------------------------------------------------------
describe("13. logs are empty in Pending state", () => {
  it("createTaskRecord produces snapshot with empty logs array", () => {
    const record = createTaskRecord(
      { prompt: "T", routing: { mode: "auto" } },
      { taskId: TASK_ID_1, workId: WORK_ID_1, status: "queued", createdAt: FIXED_TS }
    );

    expect(record.processingSnapshot.logs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 14. No streaming, completed result, or error section is rendered
// ---------------------------------------------------------------------------
describe("14. Pending view does not show streaming, completed result, or error", () => {
  it("does not render Completed, Failed, or error elements", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("No extras.");

    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(within(feed).queryByText(/Completed/i)).not.toBeInTheDocument();
    expect(within(feed).queryByText(/Failed/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // No streaming indicator
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 15. No automatic queued-to-running transition
// ---------------------------------------------------------------------------
describe("15. no automatic queued-to-running transition", () => {
  it("status badge still shows Pending after 200ms without timers", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Stay pending.");

    // Small async tick — no timers should fire automatically
    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
    expect(screen.queryByLabelText("Task status: In Progress")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 16. Multiple Tasks receive independent processing snapshots
// ---------------------------------------------------------------------------
describe("16. multiple Tasks have independent processing snapshots", () => {
  it("two tasks have separate processingSnapshot objects", () => {
    const record1 = createTaskRecord(
      { prompt: "Task one.", routing: { mode: "auto" } },
      { taskId: TASK_ID_1, workId: WORK_ID_1, status: "queued", createdAt: FIXED_TS }
    );
    const record2 = createTaskRecord(
      { prompt: "Task two.", routing: { mode: "auto" } },
      { taskId: TASK_ID_2, workId: WORK_ID_2, status: "queued", createdAt: FIXED_TS }
    );

    // Snapshots are different object references
    expect(record1.processingSnapshot).not.toBe(record2.processingSnapshot);
    expect(record1.processingSnapshot.steps).not.toBe(record2.processingSnapshot.steps);
  });

  it("mutating one task snapshot does not affect another", () => {
    const record1 = createTaskRecord(
      { prompt: "Task one.", routing: { mode: "auto" } },
      { taskId: TASK_ID_1, workId: WORK_ID_1, status: "queued", createdAt: FIXED_TS }
    );
    const record2 = createTaskRecord(
      { prompt: "Task two.", routing: { mode: "auto" } },
      { taskId: TASK_ID_2, workId: WORK_ID_2, status: "queued", createdAt: FIXED_TS }
    );

    // Force-mutate record1 steps (JS only, TypeScript readonly is compile-time)
    (record1.processingSnapshot.steps as { status: string }[])[0].status = "active";

    // record2 must be unaffected
    expect(record2.processingSnapshot.steps[0].status).toBe("waiting");
  });
});

// ---------------------------------------------------------------------------
// 17. No dual mutable timeline source remains
// ---------------------------------------------------------------------------
describe("17. no dual mutable timeline source — authoritative snapshot only", () => {
  it("CreatedTaskRecord does not have a separate 'timeline' property", () => {
    const record = createTaskRecord(
      { prompt: "T", routing: { mode: "auto" } },
      { taskId: TASK_ID_1, workId: WORK_ID_1, status: "queued", createdAt: FIXED_TS }
    );

    expect(record).not.toHaveProperty("timeline");
  });

});

// ---------------------------------------------------------------------------
// 21. Pending Task renders the Cancel current task button
// ---------------------------------------------------------------------------
describe("21. Pending Task renders the Cancel current task button", () => {
  it("renders a Cancel current task button in the Pending article", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Cancel me.");

    expect(screen.getByRole("button", { name: "Cancel current task" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 22. Cancel current task button has accessible role and name
// ---------------------------------------------------------------------------
describe("22. Cancel current task button has accessible role and name", () => {
  it("has role=button and accessible name 'Cancel current task'", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Accessible cancel.");

    const btn = screen.getByRole("button", { name: "Cancel current task" });
    expect(btn).toBeVisible();
    expect(btn).toHaveAttribute("type", "button");
  });
});

// ---------------------------------------------------------------------------
// 23. Clicking Cancel current task calls the semantic callback exactly once
// ---------------------------------------------------------------------------
describe("23. clicking Cancel current task calls the callback exactly once", () => {
  it("invokes onCancelTaskRequested once per click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    const onCancel = vi.fn();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={onCancel}
      />
    );

    await submitPrompt("One click.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call the callback when no prop is provided", async () => {
    const client = new SpyPendingClient();
    // No onCancelTaskRequested prop — must not throw
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Safe click.");
    const btn = screen.getByRole("button", { name: "Cancel current task" });
    await userEvent.click(btn);

    // No assertion needed — test passes if no error was thrown
  });
});

// ---------------------------------------------------------------------------
// 24. The callback receives the correct Task ID
// ---------------------------------------------------------------------------
describe("24. callback receives correct Task ID", () => {
  it("passes TASK-000001 to onCancelTaskRequested", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    const onCancel = vi.fn();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={onCancel}
      />
    );

    await submitPrompt("Task id check.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));

    expect(onCancel).toHaveBeenCalledWith("TASK-000001");
  });
});

// ---------------------------------------------------------------------------
// 25. Canonical Pending presentation remains after clicking Cancel current task
// ---------------------------------------------------------------------------
describe("25. Pending status preserved after clicking Cancel current task", () => {
  it("status badge still shows Pending after Cancel current task click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    const onCancel = vi.fn();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={onCancel}
      />
    );

    await submitPrompt("Still pending.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));

    expect(screen.getByLabelText("Task status: Pending")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 26. No Canceled or In-Progress state appears after clicking
// ---------------------------------------------------------------------------
describe("26. no Canceled or In-Progress state after Cancel current task click", () => {
  it("does not render Canceled or In-Progress badge after click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    const onCancel = vi.fn();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={onCancel}
      />
    );

    await submitPrompt("No canceled state.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));

    expect(screen.queryByLabelText("Task status: Canceled")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Task status: In Progress")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 27. No confirmation dialog appears
// ---------------------------------------------------------------------------
describe("27. no confirmation dialog appears", () => {
  it("does not show any dialog element after click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={vi.fn()}
      />
    );

    await submitPrompt("No dialog.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("page does not call window.confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={vi.fn()}
      />
    );

    await submitPrompt("No window confirm.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// 28. Initial timeline remains unchanged after clicking Cancel current task
// ---------------------------------------------------------------------------
describe("28. timeline unchanged after Cancel current task click", () => {
  it("timeline still has six items after click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={vi.fn()}
      />
    );

    await submitPrompt("Timeline stable.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));
    await openProcessingDetailsFromAssistantMenu(user);

    const timeline = screen.getByRole("region", { name: "Processing timeline details" });
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// 29. All processing steps remain Waiting after clicking Cancel current task
// ---------------------------------------------------------------------------
describe("29. all steps remain Waiting after Cancel current task click", () => {
  it("all six step status indicators still show Waiting after click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={vi.fn()}
      />
    );

    await submitPrompt("Steps still waiting.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));
    await openProcessingDetailsFromAssistantMenu(user);

    const timeline = screen.getByRole("region", { name: "Processing timeline details" });
    expect(within(timeline).getAllByText("Waiting")).toHaveLength(6);
    expect(within(timeline).queryAllByText("Active")).toHaveLength(0);
    expect(within(timeline).queryAllByText("Completed")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 30. Task ID remains visible after clicking Cancel current task
// ---------------------------------------------------------------------------
describe("30. Task ID remains visible after Cancel current task click", () => {
  it("TASK-000001 still visible in the Pending view after click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={vi.fn()}
      />
    );

    await submitPrompt("ID stable.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));
    await openProcessingDetailsFromAssistantMenu(user);
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));

    expect(screen.getByText("TASK-000001")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 31. Work ID remains visible after clicking Cancel current task
// ---------------------------------------------------------------------------
describe("31. Work ID remains visible after Cancel current task click", () => {
  it("WORK-000001 still visible in the Pending view after click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={vi.fn()}
      />
    );

    await submitPrompt("Work ID stable.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));
    await openProcessingDetailsFromAssistantMenu(user);
    await user.click(screen.getByRole("button", { name: "Show Advanced details" }));

    expect(screen.getByText("WORK-000001")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 32. Prompt remains visible after clicking Cancel current task
// ---------------------------------------------------------------------------
describe("32. prompt remains visible after Cancel current task click", () => {
  it("submitted prompt text still visible after click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={vi.fn()}
      />
    );

    const prompt = "Prompt must remain.";
    await submitPrompt(prompt);
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));

    const feed = screen.getByRole("region", { name: /conversation/i });
    expect(within(feed).getByText(prompt)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 33. Routing summary remains visible after clicking Cancel current task
// ---------------------------------------------------------------------------
describe("33. routing summary remains visible after Cancel current task click", () => {
  it("routing summary still visible after click", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={vi.fn()}
      />
    );

    await submitPrompt("Routing stable.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));

    const userMessage = screen.getByLabelText("User message");
    expect(within(userMessage).getByText("Auto-routing")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 34. No cancellation execution is performed
// ---------------------------------------------------------------------------
describe("34. no cancellation execution is performed", () => {
  it("the task client createTask is called only once — not again on cancel", async () => {
    const user = userEvent.setup();
    const client = new SpyPendingClient();
    render(
      <TaskOrchestrationPage
        taskCreationClient={client}
        onCancelTaskRequested={vi.fn()}
      />
    );

    await submitPrompt("No extra calls.");
    await user.click(screen.getByRole("button", { name: "Cancel current task" }));

    // Client was called once for task creation only
    expect(client.callCount).toBe(1);
  });
});
