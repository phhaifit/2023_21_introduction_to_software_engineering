import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TaskLogList } from
  "@vcp/frontend/features/task-orchestration/components/task-log-list.tsx";
import type {
  TaskLog,
  TaskLogLevel
} from "@vcp/frontend/features/task-orchestration/model/task-types.ts";

afterEach(cleanup);

const LOG_LEVEL_CASES: ReadonlyArray<readonly [TaskLogLevel, string]> = [
  ["info", "Info"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["error", "Error"]
];

function createLog(
  level: TaskLogLevel = "info",
  overrides: Partial<TaskLog> = {}
): TaskLog {
  return {
    id: `log-${level}`,
    timestamp: "2026-06-23T10:00:00Z",
    level,
    stepId: "validate-input",
    message: `${level} processing message`,
    ...overrides
  };
}

describe("TaskLogList", () => {
  it("provides an accessible name and semantic list markup", () => {
    render(
      <TaskLogList
        ariaLabel="Execution history"
        logs={[createLog()]}
      />
    );

    expect(
      screen.getByRole("list", { name: "Execution history" })
    ).toBeVisible();
  });

  it("renders every supplied TaskLog field", () => {
    render(
      <TaskLogList
        logs={[
          createLog("success", {
            id: "log-validation-complete",
            timestamp: "2026-06-23T10:00:02Z",
            stepId: "validate-input",
            message: "Input validation completed."
          })
        ]}
      />
    );

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Success")).toBeVisible();
    expect(within(item).getByText("2026-06-23T10:00:02Z")).toBeVisible();
    expect(within(item).getByText("Input validation completed.")).toBeVisible();
    expect(within(item).getByText("log-validation-complete")).toBeVisible();
    expect(within(item).getByText("validate-input")).toBeVisible();
  });

  it("preserves the original log order", () => {
    const logs: readonly TaskLog[] = [
      createLog("info", { id: "first", message: "First message" }),
      createLog("warning", { id: "second", message: "Second message" }),
      createLog("error", { id: "third", message: "Third message" })
    ];

    render(<TaskLogList logs={logs} />);

    expect(
      screen.getAllByRole("listitem").map((item) =>
        within(item).getByRole("paragraph").textContent
      )
    ).toEqual(["First message", "Second message", "Third message"]);
  });

  it("renders the existing timestamp field", () => {
    render(
      <TaskLogList
        logs={[createLog("info", { timestamp: "2026-06-23T10:15:30Z" })]}
      />
    );

    expect(screen.getByText("2026-06-23T10:15:30Z")).toBeVisible();
  });

  it.each(LOG_LEVEL_CASES)(
    "renders the visible %s log-level label",
    (level, label) => {
      render(<TaskLogList logs={[createLog(level)]} />);

      expect(screen.getByText(label)).toBeVisible();
      expect(screen.getByText(label)).toHaveClass(
        `task-log-list__level--${level}`
      );
    }
  );

  it("renders log messages as readable text", () => {
    render(
      <TaskLogList
        logs={[createLog("info", { message: "Analyzing the request." })]}
      />
    );

    expect(screen.getByText("Analyzing the request.")).toBeVisible();
  });

  it("renders the default empty-log state without fake entries", () => {
    render(<TaskLogList logs={[]} />);

    expect(screen.getByText("No processing logs available.")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("renders a custom empty message", () => {
    render(
      <TaskLogList
        logs={[]}
        emptyMessage="Processing has not produced any logs."
      />
    );

    expect(
      screen.getByText("Processing has not produced any logs.")
    ).toBeVisible();
  });

  it("does not change the input array", () => {
    const logs: TaskLog[] = [
      createLog("info", { id: "first" }),
      createLog("success", { id: "second" })
    ];
    const originalIds = logs.map((log) => log.id);

    render(<TaskLogList logs={logs} />);

    expect(logs.map((log) => log.id)).toEqual(originalIds);
  });

  it("does not change input log objects", () => {
    const log = createLog("warning");
    const originalLog = { ...log };

    render(<TaskLogList logs={[log]} />);

    expect(log).toEqual(originalLog);
  });
});
