import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProcessingTimeline } from
  "@vcp/frontend/features/task-orchestration/components/processing-timeline.tsx";
import {
  TaskAssistantProgressSummary,
  resolveActivityLabel
} from "@vcp/frontend/features/task-orchestration/components/task-assistant-progress-summary.tsx";
import { TaskAssistantMessage } from "@vcp/frontend/features/task-orchestration/components/task-conversation.tsx";
import { TaskStatusBadge } from
  "@vcp/frontend/features/task-orchestration/components/task-status-badge.tsx";
import type {
  CreatedTaskRecord,
  ProcessingStep,
  ProcessingStepStatus,
  TaskLog,
  TaskPresentationStatus
} from "@vcp/frontend/features/task-orchestration/model/task-types.ts";

afterEach(cleanup);

const TASK_STATUS_CASES: ReadonlyArray<readonly [TaskPresentationStatus, string]> = [
  ["pending", "Pending"],
  ["in-progress", "In Progress"],
  ["completed", "Completed"],
  ["failed", "Failed"],
  ["canceled", "Canceled"]
];

const STEP_STATUS_CASES: ReadonlyArray<
  readonly [ProcessingStepStatus, string]
> = [
  ["waiting", "Waiting"],
  ["active", "Active"],
  ["completed", "Completed"],
  ["failed", "Failed"],
  ["canceled", "Canceled"]
];

describe("TaskStatusBadge", () => {
  it.each(TASK_STATUS_CASES)(
    "renders the visible %s task status",
    (status, label) => {
      render(<TaskStatusBadge status={status} />);

      expect(screen.getByText(label)).toBeVisible();
      expect(screen.getByText(label)).toHaveClass(
        `task-status-badge--${status}`
      );
    }
  );

  it("provides an accessible task-status description", () => {
    render(<TaskStatusBadge status="failed" />);

    expect(screen.getByLabelText("Task status: Failed")).toBeVisible();
  });
});

describe("ProcessingTimeline", () => {
  it("provides an accessible name and ordered-list semantics", () => {
    render(
      <ProcessingTimeline
        ariaLabel="Deployment progress"
        steps={[{ id: "validate", label: "Validate input", status: "waiting" }]}
      />
    );

    const timeline = screen.getByRole("region", {
      name: "Deployment progress"
    });
    expect(within(timeline).getByRole("list")).toBeVisible();
  });

  it("renders supplied steps in their original order", () => {
    const steps: readonly ProcessingStep[] = [
      { id: "validate", label: "Validate input", status: "completed" },
      { id: "analyze", label: "Analyze request", status: "active" },
      { id: "execute", label: "Execute task", status: "waiting" }
    ];

    render(<ProcessingTimeline steps={steps} />);

    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent)
    ).toEqual([
      "Validate inputCompleted",
      "Analyze requestActive",
      "Execute taskWaiting"
    ]);
  });

  it.each(STEP_STATUS_CASES)(
    "renders the visible %s step status",
    (status, label) => {
      render(
        <ProcessingTimeline
          steps={[{ id: status, label: `${label} step`, status }]}
        />
      );

      expect(screen.getByText(label)).toBeVisible();
    }
  );

  it("marks only an active step as the current step", () => {
    render(
      <ProcessingTimeline
        steps={[
          { id: "analyze", label: "Analyze request", status: "active" },
          { id: "execute", label: "Execute task", status: "waiting" }
        ]}
      />
    );

    expect(screen.getByText("Analyze request").closest("li")).toHaveAttribute(
      "aria-current",
      "step"
    );
    expect(screen.getByText("Execute task").closest("li")).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("renders a clear configurable empty state", () => {
    render(
      <ProcessingTimeline
        steps={[]}
        emptyMessage="Processing has not started."
      />
    );

    expect(screen.getByText("Processing has not started.")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders supported optional timestamps only when supplied", () => {
    render(
      <ProcessingTimeline
        steps={[
          {
            id: "validate",
            label: "Validate input",
            status: "completed",
            startedAt: "2026-06-23T09:00:00Z",
            completedAt: "2026-06-23T09:00:02Z"
          },
          { id: "analyze", label: "Analyze request", status: "waiting" }
        ]}
      />
    );

    const completedStep = screen.getByText("Validate input").closest("li");
    const waitingStep = screen.getByText("Analyze request").closest("li");

    expect(completedStep).not.toBeNull();
    expect(waitingStep).not.toBeNull();
    expect(within(completedStep!).getByText("Started")).toBeVisible();
    expect(
      within(completedStep!).getByText("2026-06-23T09:00:02Z")
    ).toBeVisible();
    expect(within(waitingStep!).queryByText("Started")).not.toBeInTheDocument();
  });

});

describe("TaskAssistantProgressSummary", () => {
  it.each([
    ["web search started", "Searching web"],
    ["Calling browser", "Calling browser"],
    ["Calling API", "Calling API"],
    ["Reading Roadmap.pdf", "Reading Roadmap.pdf"],
    ["Read workspace file", "Reading workspace"],
    ["reasoning about next action", "Thinking"],
    ["Thinking", "Thinking"],
    ["final output", "Composing response"]
  ])("summarizes provider activity %s", (label, expected) => {
    expect(resolveActivityLabel(label).label).toBe(expected);
  });

  it("renders runtime activity as plain markdown text without chips or status tags", () => {
    render(
      <TaskAssistantProgressSummary
        task={createRunningTask(
          [
            { id: "openclaw-web-search", label: "web search product docs", status: "completed" },
            { id: "openclaw-tool-browser", label: "Calling browser", status: "active" }
          ],
          [
            {
              id: "log-tool",
              stepId: "openclaw-tool-browser",
              level: "info",
              timestamp: "2026-06-30T00:00:01.000Z",
              message: "**Calling browser**\n\n- Open product docs\n- Capture the current release note"
            },
            {
              id: "log-output-fragment",
              stepId: "openclaw-message",
              level: "info",
              timestamp: "2026-06-30T00:00:02.000Z",
              message: "This is an assistant response fragment that belongs in the final output stream."
            }
          ]
        )}
      />
    );

    const activity = screen.getByLabelText("OpenClaw runtime activity");
    expect(activity).toBeVisible();
    expect(screen.getByLabelText("Task status: In Progress")).toBeVisible();
    expect(screen.queryByLabelText("Runtime progress")).not.toBeInTheDocument();
    expect(screen.getByText(/1\/2 steps/)).toBeVisible();
    expect(within(activity).getAllByText("Calling browser")).toHaveLength(1);
    expect(within(activity).getByText("Open product docs")).toBeVisible();
    expect(within(activity).getByText("Capture the current release note")).toBeVisible();
    expect(within(activity).queryByText("Live")).not.toBeInTheDocument();
    expect(within(activity).queryByText("Done")).not.toBeInTheDocument();
    expect(within(activity).queryByText("Composing response")).not.toBeInTheDocument();
    expect(within(activity).queryByText("OpenClaw tool activity")).not.toBeInTheDocument();
    expect(within(activity).queryByText(/assistant response fragment/)).not.toBeInTheDocument();
  });

  it("keeps captured provider activity visible after fast completion", () => {
    render(
      <TaskAssistantProgressSummary
        task={createTaskWithRuntimeProgress(
          [
            { id: "openclaw-web", label: "Searching web", status: "completed" }
          ],
          "succeeded"
        )}
      />
    );

    expect(screen.getByLabelText("Task status: Completed")).toBeVisible();
    expect(screen.getByText("Searching web")).toBeVisible();
    expect(screen.getByText(/1\/1 steps/)).toBeVisible();
  });

  it("shows real fallback provider steps while hiding generic lifecycle noise", () => {
    render(
      <TaskAssistantProgressSummary
        task={createRunningTask([
          { id: "openclaw-start", label: "start", status: "completed" },
          { id: "openclaw-activity", label: "OpenClaw activity", status: "completed" },
          { id: "openclaw-agent", label: "Agent activity", status: "completed" },
          { id: "openclaw-agent-execution", label: "Agent Execution", status: "active" }
        ])}
      />
    );

    const activity = screen.getByLabelText("OpenClaw runtime activity");
    expect(within(activity).getByText("Agent activity")).toBeVisible();
    expect(within(activity).getByText("Agent Execution")).toBeVisible();
    expect(within(activity).queryByText("start")).not.toBeInTheDocument();
    expect(within(activity).queryByText("OpenClaw activity")).not.toBeInTheDocument();
  });

  it("keeps fallback provider progress visible in a completed assistant response", () => {
    render(
      <TaskAssistantMessage
        task={{
          ...createTaskWithRuntimeProgress(
            [{ id: "step-1", label: "Agent Execution", status: "completed" }],
            "succeeded"
          ),
          finalizedResult: {
            text: "Final answer",
            finalizedAt: "2026-06-30T00:00:02.000Z"
          }
        }}
        routingSummary="Auto-routing"
        partialText=""
        isStreaming={false}
        shouldShowPartialResult={false}
        clipboardWriter={{ writeText: async () => {} }}
        onOpenDetails={() => {}}
      />
    );

    expect(screen.getByLabelText("OpenClaw runtime activity")).toBeVisible();
    expect(screen.getByText("Agent Execution")).toBeVisible();
    expect(screen.getByLabelText("Assistant final response")).toHaveTextContent("Final answer");
  });
});

function createRunningTask(steps: ProcessingStep[], logs: TaskLog[] = []): CreatedTaskRecord {
  return createTaskWithRuntimeProgress(steps, "running", logs);
}

function createTaskWithRuntimeProgress(
  steps: ProcessingStep[],
  status: CreatedTaskRecord["status"],
  logs: TaskLog[] = []
): CreatedTaskRecord {
  return {
    taskId: "TASK-001" as import("@vcp/shared").EntityId<"taskId">,
    workId: "WORK-001" as import("@vcp/shared").EntityId<"workId">,
    prompt: "Run provider activity",
    requestedRouting: { mode: "auto" },
    status,
    createdAt: "2026-06-30T00:00:00.000Z",
    processingSnapshot: {
      startedAt: "2026-06-30T00:00:00.000Z",
      steps,
      logs
    },
    streamingSnapshot: {
      phase: "idle",
      fragments: []
    }
  };
}
