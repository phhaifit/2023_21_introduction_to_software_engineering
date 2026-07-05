import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskCompletedResult } from "@vcp/frontend/features/task-orchestration/components/task-completed-result.tsx";

afterEach(cleanup);

describe("Task workflow completion UI", () => {
  it("distinguishes a successful workflow with no returned output", () => {
    render(
      <TaskCompletedResult
        clipboardWriter={{ writeText: vi.fn(async () => undefined) }}
        isWorkflow
        result={{
          text: "Workflow execution completed successfully.",
          finalizedAt: "2026-07-05T00:00:00.000Z"
        }}
      />
    );

    expect(screen.getByText("Workflow completed successfully.")).toBeVisible();
    expect(screen.getByText("No workflow output was returned.")).toBeVisible();
  });

  it("renders actual workflow output when content is available", () => {
    render(
      <TaskCompletedResult
        clipboardWriter={{ writeText: vi.fn(async () => undefined) }}
        isWorkflow
        result={{
          text: "Quarterly summary generated from the supplied input.",
          finalizedAt: "2026-07-05T00:00:00.000Z"
        }}
      />
    );

    expect(
      screen.getByText("Quarterly summary generated from the supplied input.")
    ).toBeVisible();
    expect(screen.queryByText("No workflow output was returned.")).toBeNull();
  });
});
