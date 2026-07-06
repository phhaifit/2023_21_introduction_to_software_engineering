import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ExecutionsPage,
  formatShortRunId
} from "@vcp/frontend/features/task-orchestration/ExecutionsPage.tsx";
import type { WorkflowManagementApiClient } from "@vcp/frontend/features/workflow-management/api/workflow-api-client.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const fullRunId = "wfe_task_0cec6d08-8551-45d3-9391-ff4c0ea11ef5";

describe("Workflow Run History identifiers", () => {
  it("formats UUID-backed and fallback execution IDs compactly", () => {
    expect(formatShortRunId(fullRunId)).toBe("#0cec6d08");
    expect(formatShortRunId("wfe_d0cd9daa-c7f1-4749-bbe3-f130fa7fd0be")).toBe(
      "#d0cd9daa"
    );
    expect(formatShortRunId("exec_local-run")).toBe("#local-ru");
  });

  it("shows a short ID while preserving full-ID search, copy, and log metadata", async () => {
    const apiClient = {
      listExecutions: vi.fn(async () => [
        {
          executionId: fullRunId,
          workspaceId: "workspace-a",
          workflowId: "workflow-a",
          workflowName: "Simple Summary Workflow",
          status: "Success",
          triggeredBy: "user-a",
          startedAt: "2026-07-05T00:00:00.000Z",
          completedAt: "2026-07-05T00:00:05.000Z"
        }
      ]),
      getExecutionLogs: vi.fn(async () => []),
      getWorkflow: vi.fn(async () => ({ steps: [] }))
    } as unknown as WorkflowManagementApiClient;
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");

    render(<ExecutionsPage apiClient={apiClient} />);

    expect(await screen.findByText("#0cec6d08")).toBeVisible();
    expect(screen.queryByText(fullRunId)).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Run" })).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: `Copy full run ID ${fullRunId}` })
    );
    expect(writeText).toHaveBeenCalledWith(fullRunId);

    const search = screen.getByPlaceholderText("Search by workflow or run ID...");
    await user.clear(search);
    await user.type(search, fullRunId);
    expect(screen.getByText("#0cec6d08")).toBeVisible();
    await user.clear(search);
    await user.type(search, "#0cec6d08");
    expect(screen.getByText("#0cec6d08")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "View Log" }));
    const dialog = screen.getByText("Full run ID:").parentElement;
    expect(dialog).not.toBeNull();
    expect(within(dialog!).getByText(fullRunId)).toBeVisible();
  });
});
