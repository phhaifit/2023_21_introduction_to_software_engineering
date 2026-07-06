import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkflowEditorPage } from "@vcp/frontend/features/workflow-management/WorkflowEditorPage.tsx";
import type { WorkflowManagementApiClient } from "@vcp/frontend/features/workflow-management/api/workflow-api-client.ts";
import { DEMO_WORKSPACE_ID } from "@vcp/shared/demo-workspace.ts";
import { ToastProvider } from "@vcp/frontend/components/shared/Toast.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function createApiClient(): WorkflowManagementApiClient {
  return {
    listWorkflowAgents: vi.fn(async () => [
      {
        agentId: "agent-enabled" as any,
        workspaceId: DEMO_WORKSPACE_ID,
        name: "Enabled Workflow Agent",
        role: "Researcher",
        model: "gpt-4.1-mini",
        status: "enabled",
        updatedAt: "2026-06-28T00:00:00.000Z"
      },
      {
        agentId: "agent-disabled" as any,
        workspaceId: DEMO_WORKSPACE_ID,
        name: "Disabled Workflow Agent",
        role: "Support",
        model: "gpt-4.1-mini",
        status: "disabled",
        updatedAt: "2026-06-28T00:00:00.000Z"
      }
    ]),
    listWorkflows: vi.fn(),
    createWorkflow: vi.fn(async () => ({
      workflowId: "workflow-created" as any,
      name: "Catalog workflow",
      description: "",
      status: "published",
      triggerType: "manual",
      updatedAt: "2026-06-28T00:00:00.000Z",
      stepCount: 1
    })),
    getWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    executeWorkflow: vi.fn(),
    deleteWorkflow: vi.fn(),
    getExecutionStreamUrl: vi.fn()
  };
}

describe("WorkflowEditorPage agent catalog", () => {
  it("adds enabled agents from the public catalog instead of stale mock agents", async () => {
    const user = userEvent.setup();
    const apiClient = createApiClient();
    vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<ToastProvider><WorkflowEditorPage apiClient={apiClient} /></ToastProvider>);

    await screen.findByRole("option", { name: "Enabled Workflow Agent (Researcher)" });
    expect(screen.queryByText("Research Agent")).toBeNull();
    expect(screen.queryByText(/Disabled Workflow Agent/)).toBeNull();

    await user.type(screen.getByLabelText("Workflow Name"), "Catalog workflow");
    await user.click(screen.getByRole("button", { name: "+ Add Agent" }));

    expect(await screen.findByText("ID: agent-enabled")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save Workflow Configuration" }));

    await waitFor(() => {
      expect(apiClient.createWorkflow).toHaveBeenCalledWith(
        DEMO_WORKSPACE_ID,
        expect.objectContaining({
          name: "Catalog workflow",
          steps: [
            expect.objectContaining({
              agentId: "agent-enabled",
              stepOrder: 1
            })
          ]
        })
      );
    });
  });
});
