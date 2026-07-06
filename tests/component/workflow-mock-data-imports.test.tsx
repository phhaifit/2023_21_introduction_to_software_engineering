import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from
  "@vcp/frontend/features/dashboard/DashboardPage.tsx";
import { WorkflowsPage } from
  "@vcp/frontend/features/workflow-management/WorkflowsPage.tsx";
import { mockWorkflows } from
  "../../apps/frontend/src/data/workflows.ts";
import type { WorkflowManagementApiClient } from "@vcp/frontend/features/workflow-management/api/workflow-api-client.ts";
import { ToastProvider } from "@vcp/frontend/components/shared/Toast.tsx";

afterEach(cleanup);

function createMockApiClient(overrides: Partial<WorkflowManagementApiClient> = {}): WorkflowManagementApiClient {
  return {
    listWorkflows: vi.fn(async () => mockWorkflows),
    getWorkflow: vi.fn(),
    createWorkflow: vi.fn(),
    updateWorkflow: vi.fn(),
    ...overrides
  } as unknown as WorkflowManagementApiClient;
}

vi.mock("@vcp/frontend/features/workflow-management/api/workflow-api-client.ts", () => {
  return {
    createWorkflowManagementApiClient: () => ({
      listWorkflows: async () => mockWorkflows,
      getWorkflow: async () => {},
      createWorkflow: async () => {},
      updateWorkflow: async () => {}
    })
  };
});

describe("workflow mock data imports", () => {
  it("renders dashboard workflow summary from the shared demo data import", async () => {
    render(<ToastProvider><DashboardPage /></ToastProvider>);

    expect(await screen.findByText("Tổng số Workflows")).toBeVisible();
    expect(await screen.findByText(String(mockWorkflows.length))).toBeVisible();
    expect(await screen.findByText("Workflows hoạt động gần đây")).toBeVisible();
    expect(await screen.findByText(mockWorkflows[0].name)).toBeVisible();
  });

  it("renders the workflow list with deterministic demo rows", async () => {
    const user = userEvent.setup();
    const apiClient = createMockApiClient();
    render(<ToastProvider><WorkflowsPage apiClient={apiClient} /></ToastProvider>);

    await user.click(screen.getByRole("button", { name: "List" }));

    const table = await screen.findByRole("table");
    expect(within(table).getByText(mockWorkflows[0].name)).toBeVisible();
  });

  it("renders an empty workflow search state without import failures", async () => {
    const user = userEvent.setup();
    const apiClient = createMockApiClient();
    render(<ToastProvider><WorkflowsPage apiClient={apiClient} /></ToastProvider>);

    await user.click(screen.getByRole("button", { name: "List" }));
    await screen.findByRole("table");
    
    await user.type(
      screen.getByPlaceholderText("Search workflows..."),
      "khong-co-workflow"
    );
    expect(screen.getByText("No Workflows Found")).toBeVisible();
    expect(screen.getByText("No results match your search.")).toBeVisible();
  });
});
