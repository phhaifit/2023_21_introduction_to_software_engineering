import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProcessingTimeline } from
  "@vcp/frontend/features/task-orchestration/components/processing-timeline.tsx";
import { TaskStatusBadge } from
  "@vcp/frontend/features/task-orchestration/components/task-status-badge.tsx";
import type {
  ProcessingStep,
  ProcessingStepStatus,
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

  it("does not change the input array", () => {
    const steps: ProcessingStep[] = [
      { id: "validate", label: "Validate input", status: "waiting" },
      { id: "analyze", label: "Analyze request", status: "active" }
    ];
    const originalOrder = steps.map((step) => step.id);

    render(<ProcessingTimeline steps={steps} />);

    expect(steps.map((step) => step.id)).toEqual(originalOrder);
  });

  it("does not change input step objects", () => {
    const step: ProcessingStep = {
      id: "validate",
      label: "Validate input",
      status: "completed",
      completedAt: "2026-06-23T09:00:02Z"
    };
    const originalStep = { ...step };

    render(<ProcessingTimeline steps={[step]} />);

    expect(step).toEqual(originalStep);
  });
});
