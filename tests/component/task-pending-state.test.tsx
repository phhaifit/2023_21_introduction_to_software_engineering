/**
 * task-pending-state.test.tsx
 *
 * Permanent focused tests for Task 7B — Pending Task State UI Completion.
 *
 * Coverage:
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
 * 17.  No dual mutable timeline source remains.
 * 18.  Presentation components do not mutate canonical status.
 * 19.  No backend, Prisma, or private-module import exists.
 * 20.  Existing Task 6 and Task 7A tests remain passing (verified via CI).
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Identify this task.");

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

    expect(screen.getByText(prompt)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 5. Auto routing summary is correct
// ---------------------------------------------------------------------------
describe("5. auto routing summary", () => {
  it("shows 'Routing: Auto-routing' for auto mode", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Auto route this.");

    expect(screen.getByText("Routing: Auto-routing")).toBeVisible();
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

    expect(screen.getByText("Routing: Specific agent AGT-CODE")).toBeVisible();
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

    expect(
      screen.getByText("Routing: Predefined workflow WFL-RESEARCH-SYNTHESIS")
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. All approved timeline steps render
// ---------------------------------------------------------------------------
describe("8. all six approved timeline steps are rendered", () => {
  it("timeline contains exactly six steps with approved labels", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("Six steps test.");

    const timeline = screen.getByRole("region", { name: "Initial processing timeline" });
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
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("All waiting.");

    const timeline = screen.getByRole("region", { name: "Initial processing timeline" });
    const waitingLabels = within(timeline).getAllByText("Waiting");
    expect(waitingLabels).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// 10. No step is active
// ---------------------------------------------------------------------------
describe("10. no step is active in Pending state", () => {
  it("zero steps have Active status indicator", async () => {
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("No active steps.");

    const timeline = screen.getByRole("region", { name: "Initial processing timeline" });
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
    const client = new SpyPendingClient();
    render(<TaskOrchestrationPage taskCreationClient={client} />);

    await submitPrompt("No completed steps.");

    const timeline = screen.getByRole("region", { name: "Initial processing timeline" });
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

    expect(screen.queryByText(/Completed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed/i)).not.toBeInTheDocument();
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

  it("task-types.ts CreatedTaskRecord no longer defines a timeline field", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "apps/frontend/src/features/task-orchestration/model/task-types.ts"
      ),
      "utf8"
    );

    // timeline field must not appear inside CreatedTaskRecord
    const createdRecordBlock = source.slice(
      source.indexOf("CreatedTaskRecord"),
      source.indexOf("}", source.indexOf("CreatedTaskRecord")) + 1
    );
    expect(createdRecordBlock).not.toMatch(/\btimeline\b/);
  });

  it("page renders timeline from processingSnapshot.steps, not a legacy field", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "apps/frontend/src/features/task-orchestration/task-orchestration-page.tsx"
      ),
      "utf8"
    );

    expect(source).toMatch(/processingSnapshot\.steps/);
    expect(source).not.toMatch(/activeTask\.timeline/);
  });
});

// ---------------------------------------------------------------------------
// 18. Presentation components do not mutate canonical status
// ---------------------------------------------------------------------------
describe("18. presentation components do not mutate canonical status", () => {
  it("TaskStatusBadge does not contain useState, useReducer, or setTaskStatus", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "apps/frontend/src/features/task-orchestration/components/task-status-badge.tsx"
      ),
      "utf8"
    );

    expect(source).not.toMatch(/useState|useReducer|setTaskStatus|ProductionTaskStatus/);
  });

  it("ProcessingTimeline does not contain useState, useReducer, or setTaskStatus", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "apps/frontend/src/features/task-orchestration/components/processing-timeline.tsx"
      ),
      "utf8"
    );

    expect(source).not.toMatch(/useState|useReducer|setTaskStatus|ProductionTaskStatus/);
  });
});

// ---------------------------------------------------------------------------
// 19. No backend, Prisma, or private-module import
// ---------------------------------------------------------------------------
describe("19. no forbidden imports in frontend Task & Orchestration files", () => {
  const root = process.cwd();

  const frontendFiles = [
    "apps/frontend/src/features/task-orchestration/task-orchestration-page.tsx",
    "apps/frontend/src/features/task-orchestration/model/task-creation-state.ts",
    "apps/frontend/src/features/task-orchestration/model/task-lifecycle.ts",
    "apps/frontend/src/features/task-orchestration/model/task-types.ts",
    "apps/frontend/src/features/task-orchestration/model/task-processing.ts"
  ];

  it.each(frontendFiles)(
    "file %s does not import backend, database, Prisma, or private modules",
    (file) => {
      const source = readFileSync(join(root, file), "utf8");

      expect(source).not.toMatch(/@vcp\/backend/);
      expect(source).not.toMatch(/@vcp\/database/);
      expect(source).not.toMatch(/Prisma/);
      expect(source).not.toMatch(/modules\/agent-management/);
      expect(source).not.toMatch(/modules\/workflow-management/);
    }
  );
});
